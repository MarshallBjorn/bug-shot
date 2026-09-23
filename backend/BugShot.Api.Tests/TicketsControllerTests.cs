using BugShot.Api.Attachments;
using BugShot.Api.Sanitization;
using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class TicketsControllerTests
{
    private static AttachmentStorageOptions NewStorage()
    {
        var rootPath = Path.Combine(
            Path.GetTempPath(),
            $"bugshot-delete-{Guid.NewGuid():N}");

        Directory.CreateDirectory(rootPath);
        return new AttachmentStorageOptions(rootPath);
    }

    // origin zaseedowany dla projektu demo w InitialCreate
    private const string AllowedOrigin = "http://127.0.0.1:5500";

    private static BugShotDbContext NewContext()
    {
        var db = TestDatabase.OpenContext();
        db.Tickets.ExecuteDelete();

        return db;
    }

    private static CreateTicketRequest Request(string projectKey) => new()
    {
        ProjectKey = projectKey,
        Description = "Koszyk gubi produkty",
        PageUrl = "https://acme.example/cart",
        UserAgent = "Mozilla/5.0"
    };

    private static TicketsController NewController(
        BugShotDbContext db,
        string? origin = AllowedOrigin,
        string? idempotencyKey = null,
        AttachmentStorageOptions? storage = null,
        IDistributedCache? cache = null,
        RecordingTicketNotifier? notifier = null)
    {
        var context = new DefaultHttpContext();

        if (origin is not null)
        {
            context.Request.Headers.Origin = origin;
        }

        if (idempotencyKey is not null)
        {
            context.Request.Headers["Idempotency-Key"] = idempotencyKey;
        }

        return new TicketsController(
            db,
            storage ?? NewStorage(),
            cache ?? NewCache(),
            notifier ?? new RecordingTicketNotifier(),
            NullLogger<TicketsController>.Instance,
            new SanitizationService(db))
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
    }

    private static UpdateTicketStatusRequest StatusRequest(TicketStatus status) =>
        new(status, "bartek");

    private static async Task<Ticket> NewTicket(BugShotDbContext db)
    {
        var projectId = await db.Projects
            .Where(p => p.Key == "demo")
            .Select(p => p.Id)
            .SingleAsync();

        var ticket = new Ticket
        {
            ProjectId = projectId,
            Description = "Koszyk gubi produkty",
            PageUrl = "https://acme.example/cart",
            UserAgent = "Mozilla/5.0",
            Status = TicketStatus.New
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        return ticket;
    }

    private static string RowVersion(Ticket ticket) =>
        Convert.ToBase64String(ticket.RowVersion);

    private static IDistributedCache NewCache() =>
        new MemoryDistributedCache(
            Options.Create(new MemoryDistributedCacheOptions()));

    private static async Task<Project> CreateProjectWithoutOrigins(
        BugShotDbContext db)
    {
        var project = new Project
        {
            Name = "Bez originow",
            Key = $"bez-originow-{Guid.NewGuid():N}"
        };

        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return project;
    }

    [Fact]
    public async Task ZgloszenieZnanegoProjektuJestZapisywane()
    {
        using var db = NewContext();

        var project = await db.Projects
            .SingleAsync(p => p.Key == "demo");

        var controller = NewController(db);

        var result = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        var ticket = await db.Tickets.SingleAsync();

        Assert.Equal(payload.Id, ticket.Id);
        Assert.Equal(project.Id, ticket.ProjectId);
        Assert.Equal(TicketStatus.New, ticket.Status);
        Assert.Equal("acme.example/cart", ticket.Page);
        Assert.Equal("Other", ticket.BrowserName);
        Assert.Equal("desktop", ticket.DeviceType);
    }

    [Fact]
    public async Task StronaLiczySieZZamaskowanegoAdresuAMetadaneWidgetuSaZapisywane()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var request = Request("demo");
        request.PageUrl = "https://acme.example/konto/jan.kowalski@example.com?tab=zamowienia";
        request.UserAgent =
            "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";
        request.Viewport = new TicketViewport { Width = 412, Height = 839, DevicePixelRatio = 2.625 };
        request.Language = "pl-PL";
        request.TimeZone = "Europe/Warsaw";

        await controller.Create(request, CancellationToken.None);

        var ticket = await db.Tickets.SingleAsync();

        // globalna regula maskuje adres e-mail wiec nie moze wrocic do bazy przez kolumne ze strona
        Assert.Equal("acme.example/konto/***", ticket.Page);
        Assert.Equal("Chrome", ticket.BrowserName);
        Assert.Equal("Android", ticket.OsName);
        Assert.Equal("mobile", ticket.DeviceType);
        Assert.Equal(412, ticket.ViewportWidth);
        Assert.Equal(2.625, ticket.DevicePixelRatio);
        Assert.Equal("pl-PL", ticket.Language);
        Assert.Equal("Europe/Warsaw", ticket.TimeZone);
    }

    [Fact]
    public async Task ZapisUstawiaZnacznikiCzasu()
    {
        using var db = NewContext();
        var controller = NewController(db);

        await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var ticket = await db.Tickets.SingleAsync();

        Assert.NotEqual(default, ticket.CreatedAt);
        Assert.Equal(ticket.CreatedAt, ticket.UpdatedAt);
    }

    [Fact]
    public async Task NieznanyKluczProjektuJestOdrzucany()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.Create(
            Request("nie-istnieje"),
            CancellationToken.None);

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task SzczegolyNieistniejacegoZgloszeniaDaja404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.GetById(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task KomentarzNaSkasowanymTickecieDaje409()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var ticket = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            ticket.Value);

        var deleteResult = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(deleteResult);

        var result = await controller.AddComment(
            payload.Id,
            new CreateTicketCommentRequest(
                "tester",
                "Komentarz po usunięciu"),
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);

        Assert.Equal(
            StatusCodes.Status409Conflict,
            problem.StatusCode);

        var details = Assert.IsType<ProblemDetails>(
            problem.Value);

        Assert.Equal(
            TicketStatus.Deleted,
            details.Extensions["currentStatus"]);

        Assert.False(
            await db.TicketComments
                .AnyAsync(c => c.TicketId == payload.Id));
    }

    [Fact]
    public async Task UtworzonyKomentarzMaLocationDoListyKomentarzy()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var ticket = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            ticket.Value);

        var result = await controller.AddComment(
            payload.Id,
            new CreateTicketCommentRequest(
                "tester",
                "Pierwszy komentarz"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            result.Result);

        Assert.Equal(
            nameof(TicketsController.GetComments),
            created.ActionName);

        var routeValues = created.RouteValues
            ?? throw new Xunit.Sdk.XunitException(
                "CreatedAtAction nie zawiera RouteValues.");

        Assert.Equal(payload.Id, routeValues["id"]);
    }

    [Fact]
    public async Task UsuniecieTicketuNieZwracaBleduGdyKatalogZalacznikaNieIstnieje()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var ticket = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            ticket.Value);

        const string fileName =
            "missing-directory-attachment.png";

        db.TicketAttachments.Add(new TicketAttachment
        {
            TicketId = payload.Id,
            Kind = AttachmentKind.Screenshot,
            Uri = $"{AttachmentStorageOptions.UriPrefix}/{fileName}",
            FileName = fileName,
            ContentType = "image/png",
            SizeBytes = 3
        });

        await db.SaveChangesAsync();

        Directory.Delete(
            storage.RootPath,
            recursive: true);

        var result = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);

        var deletedTicket = await db.Tickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == payload.Id);

        Assert.Equal(
            TicketStatus.Deleted,
            deletedTicket.Status);

        Assert.False(
            await db.TicketAttachments
                .AnyAsync(a => a.TicketId == payload.Id));
    }

    [Fact]
    public async Task KomentarzJestZapisywany()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var ticket = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            ticket.Value);

        var request = new CreateTicketCommentRequest(
            "tester",
            "Pierwszy komentarz");

        var result = await controller.AddComment(
            payload.Id,
            request,
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            result.Result);

        var response = Assert.IsType<TicketCommentResponse>(
            created.Value);

        var comment = await db.TicketComments.SingleAsync();

        Assert.Equal(response.Id, comment.Id);
        Assert.Equal("tester", comment.Author);
        Assert.Equal(
            "Pierwszy komentarz",
            comment.Body);
    }

    [Fact]
    public async Task ListaKomentarzyJestRosnacoPoCreatedAtIZwracaDomyslnie50()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var ticket = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            ticket.Value);

        var baseTime = DateTimeOffset.UtcNow.AddMinutes(-10);

        db.TicketComments.AddRange(
            Enumerable.Range(0, 51)
                .Select(i => new TicketComment
                {
                    TicketId = payload.Id,
                    Author = "tester",
                    Body = $"Komentarz {i}",
                    CreatedAt = baseTime.AddMinutes(i)
                }));

        await db.SaveChangesAsync();

        var result = await controller.GetComments(
            payload.Id,
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(
            result.Result);

        var response = Assert.IsType<PagedResult<TicketCommentResponse>>(
            ok.Value);

        Assert.Equal(51, response.Total);
        Assert.Equal(1, response.Page);
        Assert.Equal(50, response.PageSize);
        Assert.Equal(50, response.Items.Count);

        Assert.True(
            response.Items
                .Zip(response.Items.Skip(1))
                .All(pair =>
                    pair.First.CreatedAt <= pair.Second.CreatedAt));
    }

    [Fact]
    public async Task ListaKomentarzyObslugujePaginacje()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        var baseTime = DateTimeOffset.UtcNow.AddMinutes(-10);

        var comments = Enumerable.Range(1, 5)
            .Select(i => new TicketComment
            {
                TicketId = payload.Id,
                Author = "tester",
                Body = $"Komentarz {i}"
            })
            .ToList();

        db.TicketComments.AddRange(comments);
        await db.SaveChangesAsync();

        for (var i = 0; i < comments.Count; i++)
        {
            comments[i].CreatedAt =
                baseTime.AddMinutes(i);
        }

        await db.SaveChangesAsync();

        var result = await controller.GetComments(
            payload.Id,
            CancellationToken.None,
            page: 2,
            pageSize: 2);

        var ok = Assert.IsType<OkObjectResult>(
            result.Result);

        var response = Assert.IsType<PagedResult<TicketCommentResponse>>(
            ok.Value);

        Assert.Equal(5, response.Total);
        Assert.Equal(2, response.Page);
        Assert.Equal(2, response.PageSize);
        Assert.Equal(2, response.Items.Count);
        Assert.Equal(
            "Komentarz 3",
            response.Items[0].Body);
        Assert.Equal(
            "Komentarz 4",
            response.Items[1].Body);
    }

    [Fact]
    public async Task UsuniecieTicketuRobiTombstone()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(
            db,
            storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        db.TicketComments.Add(new TicketComment
        {
            TicketId = payload.Id,
            Author = "tester",
            Body = "Komentarz"
        });

        await db.SaveChangesAsync();

        var result = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);

        var ticket = await db.Tickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == payload.Id);

        Assert.Equal(
            TicketStatus.Deleted,
            ticket.Status);

        Assert.Equal(
            string.Empty,
            ticket.Description);

        Assert.Equal(
            string.Empty,
            ticket.PageUrl);

        Assert.Equal(
            string.Empty,
            ticket.UserAgent);

        // pola wyliczone z adresu i user agenta znikaja razem z nimi
        Assert.Equal(string.Empty, ticket.Page);
        Assert.Equal(string.Empty, ticket.BrowserName);
        Assert.Equal(string.Empty, ticket.DeviceType);

        Assert.NotNull(ticket.DeletedAt);
        Assert.Equal("system", ticket.DeletedBy);

        Assert.Empty(
            await db.TicketComments
                .Where(c => c.TicketId == payload.Id)
                .ToListAsync());

        var history = await db.TicketStatusChanges
            .AsNoTracking()
            .SingleAsync(h => h.TicketId == payload.Id);

        Assert.Equal(
            TicketStatus.New,
            history.FromStatus);

        Assert.Equal(
            TicketStatus.Deleted,
            history.ToStatus);

        Assert.Equal(
            "system",
            history.ChangedBy);

        var getResult = await controller.GetById(
            payload.Id,
            CancellationToken.None);

        var getOk = Assert.IsType<OkObjectResult>(
            getResult.Result);

        var details = Assert.IsType<TicketDetails>(
            getOk.Value);

        Assert.Equal(
            TicketStatus.Deleted,
            details.Status);

        Assert.Equal(
            string.Empty,
            details.Description);

        Assert.Equal(
            string.Empty,
            details.PageUrl);

        Assert.Equal(
            string.Empty,
            details.UserAgent);

        Assert.Equal(
            0,
            details.CommentCount);

        Assert.Empty(details.Attachments);
        Assert.Null(details.ConsoleLog);
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaPlikZWolumenu()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(
            db,
            storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        const string fileName =
            "test-attachment.png";

        var filePath = Path.Combine(
            storage.RootPath,
            fileName);

        await System.IO.File.WriteAllBytesAsync(
            filePath,
            [1, 2, 3]);

        db.TicketAttachments.Add(
            new TicketAttachment
            {
                TicketId = payload.Id,
                Kind = AttachmentKind.Screenshot,
                Uri = $"{AttachmentStorageOptions.UriPrefix}/{fileName}",
                FileName = fileName,
                ContentType = "image/png",
                SizeBytes = 3
            });

        await db.SaveChangesAsync();

        Assert.True(
            System.IO.File.Exists(filePath));

        var result = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);

        Assert.False(
            System.IO.File.Exists(filePath));

        Assert.False(
            await db.TicketAttachments
                .AnyAsync(a => a.TicketId == payload.Id));
    }

    [Fact]
    public async Task NieistniejacyTicketDlaKomentarzaDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.AddComment(
            Guid.NewGuid(),
            new CreateTicketCommentRequest(
                "tester",
                "Komentarz"),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(
            result.Result);
    }

    [Fact]
    public async Task NieistniejacyTicketDlaListyKomentarzyDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.GetComments(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(
            result.Result);
    }

    [Fact]
    public async Task UsuniecieNieistniejacegoTicketuDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.Delete(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(
            result);
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaWszystkieKomentarze()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        db.TicketComments.AddRange(
            new TicketComment
            {
                TicketId = payload.Id,
                Author = "tester",
                Body = "Komentarz 1"
            },
            new TicketComment
            {
                TicketId = payload.Id,
                Author = "tester",
                Body = "Komentarz 2"
            });

        await db.SaveChangesAsync();

        await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.Equal(
            0,
            await db.TicketComments.CountAsync(
                c => c.TicketId == payload.Id));
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaWszystkiePlikiZWolumenu()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(
            db,
            storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        var fileNames = new[]
        {
            "first.png",
            "second.png"
        };

        foreach (var fileName in fileNames)
        {
            await System.IO.File.WriteAllBytesAsync(
                Path.Combine(storage.RootPath, fileName),
                [1, 2, 3]);
        }

        db.TicketAttachments.AddRange(
            fileNames.Select(fileName =>
                new TicketAttachment
                {
                    TicketId = payload.Id,
                    Kind = AttachmentKind.Screenshot,
                    Uri = $"{AttachmentStorageOptions.UriPrefix}/{fileName}",
                    FileName = fileName,
                    ContentType = "image/png",
                    SizeBytes = 3
                }));

        await db.SaveChangesAsync();

        await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.All(
            fileNames,
            fileName =>
                Assert.False(
                    System.IO.File.Exists(
                        Path.Combine(
                            storage.RootPath,
                            fileName))));

        Assert.Equal(
            0,
            await db.TicketAttachments.CountAsync(
                a => a.TicketId == payload.Id));
    }

    [Fact]
    public async Task BrakNaglowkaOriginJestOdrzucany()
    {
        using var db = NewContext();
        var controller = NewController(
            db,
            origin: null);

        var result = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status403Forbidden,
            problem.StatusCode);

        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task OriginSpozaListyProjektuJestOdrzucany()
    {
        using var db = NewContext();

        var controller = NewController(
            db,
            origin: "https://ktos-obcy.example");

        var result = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status403Forbidden,
            problem.StatusCode);

        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task OriginPorownywanyJestBezWzgleduNaWielkoscLiter()
    {
        using var db = NewContext();

        var controller = NewController(
            db,
            origin: "HTTP://127.0.0.1:5500");

        var result = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(
            result.Result);

        Assert.Single(db.Tickets);
    }

    [Fact]
    public async Task PustaListaOriginowProjektuBlokujeKazdeZadanie()
    {
        using var db = NewContext();

        var project = await CreateProjectWithoutOrigins(db);

        var controller = NewController(
            db,
            origin: "https://cokolwiek.example");

        var result = await controller.Create(
            Request(project.Key),
            CancellationToken.None);

        // projekt nie znika z NewContext bo czyszczone sa tylko tickety
        db.Projects.Remove(project);
        await db.SaveChangesAsync();

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status403Forbidden,
            problem.StatusCode);

        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task PowtorkaZTymSamymKluczemICialemZwracaOryginalnyWynik()
    {
        using var db = NewContext();
        var cache = NewCache();

        var first = await NewController(
                db,
                idempotencyKey: "klucz-1",
                cache: cache)
            .Create(
                Request("demo"),
                CancellationToken.None);

        var second = await NewController(
                db,
                idempotencyKey: "klucz-1",
                cache: cache)
            .Create(
                Request("demo"),
                CancellationToken.None);

        var firstPayload =
            Assert.IsType<CreatedTicketResponse>(
                Assert.IsType<CreatedAtActionResult>(
                    first.Result).Value);

        var secondPayload =
            Assert.IsType<CreatedTicketResponse>(
                Assert.IsType<CreatedAtActionResult>(
                    second.Result).Value);

        Assert.Equal(
            firstPayload.Id,
            secondPayload.Id);

        Assert.Equal(
            firstPayload.UploadToken,
            secondPayload.UploadToken);

        Assert.Single(db.Tickets);
    }

    [Fact]
    public async Task PowtorkaZTymSamymKluczemIInnymCialemDaje409()
    {
        using var db = NewContext();
        var cache = NewCache();

        await NewController(
                db,
                idempotencyKey: "klucz-2",
                cache: cache)
            .Create(
                Request("demo"),
                CancellationToken.None);

        var innyOpis = Request("demo");
        innyOpis.Description =
            "Inny opis pod tym samym kluczem";

        var result = await NewController(
                db,
                idempotencyKey: "klucz-2",
                cache: cache)
            .Create(
                innyOpis,
                CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status409Conflict,
            problem.StatusCode);

        Assert.Single(db.Tickets);
    }

    [Fact]
    public async Task BrakKluczaIdempotencjiNieBlokujeZgloszenia()
    {
        using var db = NewContext();

        var controller = NewController(
            db,
            idempotencyKey: null);

        var first = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var second = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var firstResult = Assert.IsType<CreatedAtActionResult>(
            first.Result);

        var secondResult = Assert.IsType<CreatedAtActionResult>(
            second.Result);

        var firstPayload = Assert.IsType<CreatedTicketResponse>(
            firstResult.Value);

        var secondPayload = Assert.IsType<CreatedTicketResponse>(
            secondResult.Value);

        Assert.NotEqual(
            firstPayload.Id,
            secondPayload.Id);

        Assert.Equal(
            2,
            await db.Tickets.CountAsync());
    }

    [Fact]
    public async Task PoprawnyIfMatchZmieniaStatus()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var previousRowVersion =
            RowVersion(ticket);

        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            previousRowVersion,
            CancellationToken.None);

        var payload =
            Assert.IsType<TicketStatusResponse>(
                Assert.IsType<OkObjectResult>(
                    result.Result).Value);

        Assert.Equal(
            TicketStatus.InProgress,
            payload.Status);

        Assert.NotEqual(
            previousRowVersion,
            payload.RowVersion);

        var saved = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == ticket.Id);

        Assert.Equal(
            TicketStatus.InProgress,
            saved.Status);

        Assert.Equal(
            payload.RowVersion,
            Convert.ToBase64String(
                saved.RowVersion));
    }

    [Fact]
    public async Task NieaktualnyIfMatchDaje409BezZmianyStatusu()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.Resolved),
            Convert.ToBase64String(
                Guid.NewGuid().ToByteArray()),
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status409Conflict,
            problem.StatusCode);

        var details = Assert.IsType<ProblemDetails>(
            problem.Value);

        Assert.Equal(
            TicketStatus.New,
            details.Extensions["currentStatus"]);

        Assert.Equal(
            RowVersion(ticket),
            details.Extensions["rowVersion"]);

        var saved = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == ticket.Id);

        Assert.Equal(
            TicketStatus.New,
            saved.Status);

        Assert.Empty(
            db.TicketStatusChanges
                .Where(h => h.TicketId == ticket.Id));
    }

    [Fact]
    public async Task BrakIfMatchDaje428()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.Resolved),
            null,
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status428PreconditionRequired,
            problem.StatusCode);

        var saved = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == ticket.Id);

        Assert.Equal(
            TicketStatus.New,
            saved.Status);
    }

    [Fact]
    public async Task ZmianaStatusuZapisujeWpisWHistorii()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            RowVersion(ticket),
            CancellationToken.None);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.Resolved),
            RowVersion(ticket),
            CancellationToken.None);

        var history = await db.TicketStatusChanges
            .AsNoTracking()
            .Where(h => h.TicketId == ticket.Id)
            .OrderBy(h => h.ChangedAt)
            .ToListAsync();

        Assert.Collection(
            history,
            first =>
            {
                Assert.Equal(
                    TicketStatus.New,
                    first.FromStatus);

                Assert.Equal(
                    TicketStatus.InProgress,
                    first.ToStatus);

                Assert.Equal(
                    "bartek",
                    first.ChangedBy);
            },
            second =>
            {
                Assert.Equal(
                    TicketStatus.InProgress,
                    second.FromStatus);

                Assert.Equal(
                    TicketStatus.Resolved,
                    second.ToStatus);
            });
    }

    [Fact]
    public async Task PowtorzenieTegoSamegoStatusuNieDopisujeHistorii()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var rowVersion = RowVersion(ticket);
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.New),
            rowVersion,
            CancellationToken.None);

        var payload =
            Assert.IsType<TicketStatusResponse>(
                Assert.IsType<OkObjectResult>(
                    result.Result).Value);

        Assert.Equal(
            rowVersion,
            payload.RowVersion);

        Assert.Empty(
            db.TicketStatusChanges
                .Where(h => h.TicketId == ticket.Id));
    }

    [Fact]
    public async Task StatusDeletedWCieleJestOdrzucany()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.Deleted),
            RowVersion(ticket),
            CancellationToken.None);

        Assert.IsType<ObjectResult>(
            result.Result);

        Assert.False(
            controller.ModelState.IsValid);

        var saved = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == ticket.Id);

        Assert.Equal(
            TicketStatus.New,
            saved.Status);
    }

    [Fact]
    public async Task ZmianaStatusuNieistniejacegoZgloszeniaDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            Guid.NewGuid(),
            StatusRequest(TicketStatus.InProgress),
            Convert.ToBase64String(
                Guid.NewGuid().ToByteArray()),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(
            result.Result);
    }

    [Fact]
    public async Task ZapisMiedzyOdczytemAZapisemDaje409()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var rowVersion = RowVersion(ticket);
        var controller = NewController(db);

        // druga sesja przestawia status zanim pierwsza zdazy zapisac
        using (var other = TestDatabase.OpenContext())
        {
            var sameTicket = await other.Tickets
                .SingleAsync(
                    t => t.Id == ticket.Id);

            sameTicket.Status =
                TicketStatus.Rejected;

            await other.SaveChangesAsync();
        }

        // kontroler dostaje sledzona encje wiec If-Match zgadza sie mimo nieaktualnej bazy
        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            rowVersion,
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(
            result.Result);

        Assert.Equal(
            StatusCodes.Status409Conflict,
            problem.StatusCode);

        var details = Assert.IsType<ProblemDetails>(
            problem.Value);

        Assert.Equal(
            TicketStatus.Rejected,
            details.Extensions["currentStatus"]);

        var saved = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == ticket.Id);

        Assert.Equal(
            TicketStatus.Rejected,
            saved.Status);

        Assert.Empty(
            db.TicketStatusChanges
                .Where(h => h.TicketId == ticket.Id));
    }

    [Fact]
    public async Task PowtorzoneKasowanieNieDopisujeHistoriiAniNieNadpisujeDeletedAt()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(
            db,
            storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        Assert.IsType<NoContentResult>(
            await controller.Delete(
                payload.Id,
                CancellationToken.None));

        var poPierwszym = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == payload.Id);

        Assert.IsType<NoContentResult>(
            await controller.Delete(
                payload.Id,
                CancellationToken.None));

        var poDrugim = await db.Tickets
            .AsNoTracking()
            .SingleAsync(
                t => t.Id == payload.Id);

        Assert.Equal(
            poPierwszym.DeletedAt,
            poDrugim.DeletedAt);

        Assert.Equal(
            poPierwszym.RowVersion,
            poDrugim.RowVersion);

        var history = await db.TicketStatusChanges
            .AsNoTracking()
            .Where(h => h.TicketId == payload.Id)
            .ToListAsync();

        Assert.Single(history);

        Assert.Equal(
            TicketStatus.New,
            history[0].FromStatus);

        Assert.Equal(
            TicketStatus.Deleted,
            history[0].ToStatus);
    }

    [Fact]
    public async Task KasowanieUniewaznaWystawioneTokenyUploadu()
    {
        using var db = NewContext();
        var storage = NewStorage();

        var controller = NewController(
            db,
            storage: storage);

        var ticketResult = await controller.Create(
            Request("demo"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(
            ticketResult.Result);

        var payload = Assert.IsType<CreatedTicketResponse>(
            created.Value);

        var przedKasowaniem =
            await db.TicketUploadTokens
                .AsNoTracking()
                .SingleAsync(
                    t => t.TicketId == payload.Id);

        Assert.True(
            przedKasowaniem.ExpiresAt >
            DateTimeOffset.UtcNow);

        Assert.IsType<NoContentResult>(
            await controller.Delete(
                payload.Id,
                CancellationToken.None));

        var poKasowaniu =
            await db.TicketUploadTokens
                .AsNoTracking()
                .SingleAsync(
                    t => t.TicketId == payload.Id);

        Assert.True(
            poKasowaniu.ExpiresAt <=
            DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task NoweZgloszenieIdzieDoKanaluLive()
    {
        using var db = NewContext();
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        var result = await controller.Create(Request("demo"), CancellationToken.None);
        var payload = Assert.IsType<CreatedTicketResponse>(Assert.IsType<CreatedAtActionResult>(result.Result).Value);

        var sent = Assert.Single(notifier.Events);
        var projectId = await db.Projects.Where(p => p.Key == "demo").Select(p => p.Id).SingleAsync();

        Assert.Equal("created", sent.Event);
        Assert.Equal(projectId, sent.ProjectId);
        Assert.Equal(payload.Id, sent.TicketId);
        Assert.Equal("Koszyk gubi produkty", sent.Ticket!.Description);
        Assert.Equal(TicketStatus.New, sent.Ticket.Status);
    }

    // powtorka nie zaklada ticketu wiec nie ma o czym powiadamiac
    [Fact]
    public async Task PowtorkaIdempotencjiNieWysylaDrugiegoZdarzenia()
    {
        using var db = NewContext();
        var cache = NewCache();
        var notifier = new RecordingTicketNotifier();

        await NewController(db, idempotencyKey: "klucz-live", cache: cache, notifier: notifier)
            .Create(Request("demo"), CancellationToken.None);
        await NewController(db, idempotencyKey: "klucz-live", cache: cache, notifier: notifier)
            .Create(Request("demo"), CancellationToken.None);

        Assert.Single(notifier.Events);
    }

    [Fact]
    public async Task ZmianaStatusuIdzieDoKanaluLive()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            RowVersion(ticket),
            CancellationToken.None);

        var sent = Assert.Single(notifier.Events);

        Assert.Equal("changed", sent.Event);
        Assert.Equal(ticket.ProjectId, sent.ProjectId);
        Assert.Equal(ticket.Id, sent.TicketId);
        Assert.Equal(TicketStatus.InProgress, sent.Ticket!.Status);
    }

    [Fact]
    public async Task PowtorzenieTegoSamegoStatusuNieWysylaZdarzenia()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.New),
            RowVersion(ticket),
            CancellationToken.None);

        Assert.Empty(notifier.Events);
    }

    [Fact]
    public async Task KonfliktWersjiNieWysylaZdarzenia()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            Convert.ToBase64String(Guid.NewGuid().ToByteArray()),
            CancellationToken.None);

        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(result.Result).StatusCode);
        Assert.Empty(notifier.Events);
    }

    [Fact]
    public async Task KomentarzIdzieDoKanaluLiveZNowymLicznikiem()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        await controller.AddComment(
            ticket.Id,
            new CreateTicketCommentRequest("tester", "Pierwszy komentarz"),
            CancellationToken.None);

        var sent = Assert.Single(notifier.Events);

        Assert.Equal("changed", sent.Event);
        Assert.Equal(ticket.ProjectId, sent.ProjectId);
        Assert.Equal(ticket.Id, sent.TicketId);
        Assert.Equal(1, sent.Ticket!.CommentCount);
    }

    [Fact]
    public async Task KomentarzDoTombstoneNieWysylaZdarzenia()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        await controller.Delete(ticket.Id, CancellationToken.None);
        notifier.Events.Clear();

        await controller.AddComment(
            ticket.Id,
            new CreateTicketCommentRequest("tester", "Za pozno"),
            CancellationToken.None);

        Assert.Empty(notifier.Events);
    }

    // drugie kasowanie niczego nie zapisuje wiec nie ma o czym powiadamiac
    [Fact]
    public async Task KasowanieIdzieDoKanaluLiveTylkoRaz()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var notifier = new RecordingTicketNotifier();
        var controller = NewController(db, notifier: notifier);

        Assert.IsType<NoContentResult>(await controller.Delete(ticket.Id, CancellationToken.None));
        Assert.IsType<NoContentResult>(await controller.Delete(ticket.Id, CancellationToken.None));

        var sent = Assert.Single(notifier.Events);

        Assert.Equal("deleted", sent.Event);
        Assert.Equal(ticket.ProjectId, sent.ProjectId);
        Assert.Equal(ticket.Id, sent.TicketId);
    }

    [Fact]
    public async Task GlobalnaRegulaEmailMaskujeWszystkiePolaITworzyLogi()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var request = Request("demo");

        request.Description =
            "Kontakt: foo@bar.com oraz drugi foo@bar.com";

        request.PageUrl =
            "https://example.com/?email=foo@bar.com";

        request.UserAgent =
            "Browser foo@bar.com";

        var result = await controller.Create(
            request,
            CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(
            result.Result);

        var ticket = await db.Tickets
            .AsNoTracking()
            .SingleAsync();

        Assert.Equal(
            "Kontakt: *** oraz drugi ***",
            ticket.Description);

        Assert.Equal(
            "https://example.com/?email=***",
            ticket.PageUrl);

        Assert.Equal(
            "Browser ***",
            ticket.UserAgent);

        var rule = await db.SanitizationRules
            .AsNoTracking()
            .SingleAsync(r =>
                r.ProjectId == null &&
                r.IsEnabled &&
                r.Pattern ==
                @"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+");

        var logs = await db.SanitizationLogs
            .AsNoTracking()
            .Where(l => l.TicketId == ticket.Id)
            .OrderBy(l => l.FieldName)
            .ToListAsync();

        Assert.Equal(
            3,
            logs.Count);

        Assert.Collection(
            logs,
            description =>
            {
                Assert.Equal(
                    nameof(Ticket.Description),
                    description.FieldName);

                Assert.Equal(
                    2,
                    description.MatchCount);

                Assert.Equal(
                    rule.Id,
                    description.RuleId);
            },
            pageUrl =>
            {
                Assert.Equal(
                    nameof(Ticket.PageUrl),
                    pageUrl.FieldName);

                Assert.Equal(
                    1,
                    pageUrl.MatchCount);

                Assert.Equal(
                    rule.Id,
                    pageUrl.RuleId);
            },
            userAgent =>
            {
                Assert.Equal(
                    nameof(Ticket.UserAgent),
                    userAgent.FieldName);

                Assert.Equal(
                    1,
                    userAgent.MatchCount);

                Assert.Equal(
                    rule.Id,
                    userAgent.RuleId);
            });

        var getResult = await controller.GetById(
            ticket.Id,
            CancellationToken.None);

        var getOk = Assert.IsType<OkObjectResult>(
            getResult.Result);

        var details = Assert.IsType<TicketDetails>(
            getOk.Value);

        Assert.Equal(
            ticket.Id,
            details.Id);

        Assert.Equal(
            "Kontakt: *** oraz drugi ***",
            details.Description);

        Assert.Equal(
            "https://example.com/?email=***",
            details.PageUrl);

        Assert.Equal(
            "Browser ***",
            details.UserAgent);
    }

    [Fact]
    public async Task GlobalneRegulyMaskujaCredentialsyAleNieUserAgenta()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var request = Request("demo");

        request.Description =
            """
            email=foo@bar.com
            password=qwerty123
            username=radek123
            Authorization: Bearer very-secret-bearer
            Authorization: Basic very-secret-basic
            access_token=access-secret
            refresh_token=refresh-secret
            id_token=id-secret
            session_id=session-secret
            api_key=api-secret
            client_secret=client-secret
            csrf_token=csrf-secret
            Cookie: session=very-secret-cookie
            """;

        request.PageUrl =
            "https://example.com/?email=foo@bar.com&access_token=url-secret";

        request.UserAgent =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0";

        var result = await controller.Create(
            request,
            CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(
            result.Result);

        var ticket = await db.Tickets
            .AsNoTracking()
            .SingleAsync();

        Assert.DoesNotContain(
            "foo@bar.com",
            ticket.Description);

        Assert.DoesNotContain(
            "qwerty123",
            ticket.Description);

        Assert.DoesNotContain(
            "radek123",
            ticket.Description);

        Assert.DoesNotContain(
            "very-secret-bearer",
            ticket.Description);

        Assert.DoesNotContain(
            "very-secret-basic",
            ticket.Description);

        Assert.DoesNotContain(
            "access-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "refresh-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "id-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "session-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "api-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "client-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "csrf-secret",
            ticket.Description);

        Assert.DoesNotContain(
            "very-secret-cookie",
            ticket.Description);

        Assert.DoesNotContain(
            "foo@bar.com",
            ticket.PageUrl);

        Assert.DoesNotContain(
            "url-secret",
            ticket.PageUrl);

        Assert.Equal(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0",
            ticket.UserAgent);

        Assert.Contains(
            "***",
            ticket.Description);

        Assert.Contains(
            "***",
            ticket.PageUrl);
    }

    [Fact]
    public async Task RegulyCredentialowTworzaLogiZMatchCount()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var request = Request("demo");

        request.Description =
            """
            password=pass123
            username=radek123
            Authorization: Bearer bearer123
            Authorization: Basic basic123
            access_token=access123
            refresh_token=refresh123
            id_token=id123
            session_id=session123
            api_key=api123
            client_secret=client123
            csrf_token=csrf123
            Cookie: session=cookie123
            """;

        var result = await controller.Create(
            request,
            CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(
            result.Result);

        var ticket = await db.Tickets
            .AsNoTracking()
            .SingleAsync();

        var logs = await db.SanitizationLogs
            .AsNoTracking()
            .Where(l => l.TicketId == ticket.Id)
            .ToListAsync();

        Assert.Equal(
            8,
            logs.Count);

        Assert.All(
            logs,
            log => Assert.Equal(
                nameof(Ticket.Description),
                log.FieldName));

        Assert.Equal(
            1,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "33333333-3333-3333-3333-333333333333"))
            .MatchCount);

        Assert.Equal(
            1,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "44444444-4444-4444-4444-444444444444"))
            .MatchCount);

        Assert.Equal(
            1,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "55555555-5555-5555-5555-555555555555"))
            .MatchCount);

        Assert.Equal(
            1,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "66666666-6666-6666-6666-666666666666"))
            .MatchCount);

        Assert.Equal(
            4,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "77777777-7777-7777-7777-777777777777"))
            .MatchCount);

        Assert.Equal(
            2,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "88888888-8888-8888-8888-888888888888"))
            .MatchCount);

        Assert.Equal(
            1,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "99999999-9999-9999-9999-999999999999"))
            .MatchCount);

        Assert.Equal(
            1,
            logs.Single(log =>
                log.RuleId ==
                Guid.Parse(
                    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"))
            .MatchCount);
    }

    [Fact]
    public async Task RegulaProjektowaNadpisujeGlobalna()
    {
        using var db = NewContext();

        var project = await db.Projects
            .SingleAsync(
                p => p.Key == "demo");

        var globalRule = await db.SanitizationRules
            .AsNoTracking()
            .SingleAsync(r =>
                r.Id ==
                Guid.Parse(
                    "22222222-2222-2222-2222-222222222222") &&
                r.ProjectId == null &&
                r.IsEnabled);

        await db.SanitizationRules
            .Where(r =>
                r.ProjectId == project.Id &&
                r.Pattern == globalRule.Pattern)
            .ExecuteDeleteAsync();

        var projectRule = new SanitizationRule
        {
            Id = Guid.NewGuid(),
            ProjectId = project.Id,
            Pattern = globalRule.Pattern,
            Replacement = "[PROJECT]",
            IsEnabled = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.SanitizationRules.Add(projectRule);
        await db.SaveChangesAsync();

        try
        {
            var controller = NewController(db);

            var request = Request("demo");

            request.Description =
                "Kontakt: foo@bar.com";

            var result = await controller.Create(
                request,
                CancellationToken.None);

            Assert.IsType<CreatedAtActionResult>(
                result.Result);

            var ticket = await db.Tickets
                .AsNoTracking()
                .SingleAsync();

            Assert.Equal(
                "Kontakt: [PROJECT]",
                ticket.Description);

            var logs = await db.SanitizationLogs
                .AsNoTracking()
                .Where(l => l.TicketId == ticket.Id)
                .ToListAsync();

            var log = Assert.Single(logs);

            Assert.Equal(
                projectRule.Id,
                log.RuleId);

            Assert.Equal(
                nameof(Ticket.Description),
                log.FieldName);

            Assert.Equal(
                1,
                log.MatchCount);

            Assert.DoesNotContain(
                logs,
                l => l.RuleId == globalRule.Id);
        }
        finally
        {
            await db.SanitizationLogs
                .Where(l => l.RuleId == projectRule.Id)
                .ExecuteDeleteAsync();

            await db.SanitizationRules
                .Where(r => r.Id == projectRule.Id)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task RegulaProjektowaNieWplywaNaInnyProjekt()
    {
        using var db = NewContext();

        var demoProject = await db.Projects
            .SingleAsync(
                p => p.Key == "demo");

        var globalRule = await db.SanitizationRules
            .AsNoTracking()
            .SingleAsync(r =>
                r.ProjectId == null &&
                r.IsEnabled &&
                r.Pattern ==
                @"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+");

        var otherProject = new Project
        {
            Id = Guid.NewGuid(),
            Name = "Sanitization test project",
            Key = $"sanitization-{Guid.NewGuid():N}"[..20]
        };

        db.Projects.Add(otherProject);
        await db.SaveChangesAsync();

        db.ProjectOrigins.Add(
            new ProjectOrigin
            {
                Id = Guid.NewGuid(),
                ProjectId = otherProject.Id,
                Origin = AllowedOrigin
            });

        await db.SaveChangesAsync();

        await db.SanitizationRules
            .Where(r =>
                r.ProjectId == demoProject.Id &&
                r.Pattern == globalRule.Pattern)
            .ExecuteDeleteAsync();

        var projectRule = new SanitizationRule
        {
            Id = Guid.NewGuid(),
            ProjectId = demoProject.Id,
            Pattern = globalRule.Pattern,
            Replacement = "[PROJECT]",
            IsEnabled = true,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.SanitizationRules.Add(projectRule);
        await db.SaveChangesAsync();

        try
        {
            var controller = NewController(db);

            var request = Request(
                otherProject.Key);

            request.Description =
                "Kontakt: foo@bar.com";

            var result = await controller.Create(
                request,
                CancellationToken.None);

            Assert.IsType<CreatedAtActionResult>(
                result.Result);

            var ticket = await db.Tickets
                .AsNoTracking()
                .SingleAsync();

            Assert.Equal(
                "Kontakt: ***",
                ticket.Description);

            var logs = await db.SanitizationLogs
                .AsNoTracking()
                .Where(l => l.TicketId == ticket.Id)
                .ToListAsync();

            var log = Assert.Single(logs);

            Assert.Equal(
                globalRule.Id,
                log.RuleId);

            Assert.Equal(
                nameof(Ticket.Description),
                log.FieldName);

            Assert.Equal(
                1,
                log.MatchCount);
        }
        finally
        {
            await db.SanitizationLogs
                .Where(l => l.RuleId == projectRule.Id)
                .ExecuteDeleteAsync();

            await db.SanitizationRules
                .Where(r => r.Id == projectRule.Id)
                .ExecuteDeleteAsync();

            await db.Tickets.ExecuteDeleteAsync();

            await db.Projects
                .Where(p => p.Id == otherProject.Id)
                .ExecuteDeleteAsync();
        }
    }

    [Fact]
    public async Task SzczegolyNiosaStroneIDaneSrodowiska()
    {
        using var db = NewContext();

        var controller = NewController(db, idempotencyKey: null);

        var created = Assert.IsType<CreatedTicketResponse>(
            Assert.IsType<CreatedAtActionResult>(
                (await controller.Create(
                    new CreateTicketRequest
                    {
                        ProjectKey = "demo",
                        Description = "Koszyk gubi produkty",
                        PageUrl = "https://Acme.example/Cart?utm_source=mail#top",
                        UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        Viewport = new TicketViewport { Width = 1536, Height = 730, DevicePixelRatio = 1.25 },
                        Language = "pl-PL",
                        TimeZone = "Europe/Warsaw"
                    },
                    CancellationToken.None)).Result).Value);

        var details = Assert.IsType<TicketDetails>(
            Assert.IsType<OkObjectResult>(
                (await controller.GetById(created.Id, CancellationToken.None)).Result).Value);

        Assert.Equal("acme.example/cart", details.Page);
        Assert.Equal("Chrome", details.Environment.BrowserName);
        Assert.Equal("Windows", details.Environment.OsName);
        Assert.Equal(1536, details.Environment.ViewportWidth);
        Assert.Equal("pl-PL", details.Environment.Language);
        Assert.Equal("Europe/Warsaw", details.Environment.TimeZone);
    }

    [Fact]
    public async Task PrzejscieePozaMapaDaje400IZostawiaStatus()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        // New idzie tylko w InProgress albo Rejected wiec skok na Resolved omija prace nad zgloszeniem
        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.Resolved),
            RowVersion(ticket),
            CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(
            Assert.IsType<ObjectResult>(result.Result).Value);

        Assert.Contains(
            nameof(UpdateTicketStatusRequest.Status),
            problem.Errors.Keys);

        var saved = await db.Tickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == ticket.Id);

        Assert.Equal(TicketStatus.New, saved.Status);

        Assert.Empty(
            await db.TicketStatusChanges
                .Where(h => h.TicketId == ticket.Id)
                .ToListAsync());
    }

    [Fact]
    public async Task RozwiazaneZgloszenieWracaDoInProgress()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            RowVersion(ticket),
            CancellationToken.None);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.Resolved),
            RowVersion(ticket),
            CancellationToken.None);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            RowVersion(ticket),
            CancellationToken.None);

        var payload = Assert.IsType<TicketStatusResponse>(
            Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Equal(TicketStatus.InProgress, payload.Status);
    }

    [Fact]
    public async Task SzczegolyNiosaDozwolonePrzejsciaZAktualnegoStanu()
    {
        using var db = NewContext();

        var ticket = await NewTicket(db);
        var controller = NewController(db);

        var nowe = Assert.IsType<TicketDetails>(
            Assert.IsType<OkObjectResult>(
                (await controller.GetById(ticket.Id, CancellationToken.None)).Result).Value);

        Assert.Equal(
            [TicketStatus.InProgress, TicketStatus.Rejected],
            nowe.AllowedStatuses);

        await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            RowVersion(ticket),
            CancellationToken.None);

        var wTrakcie = Assert.IsType<TicketDetails>(
            Assert.IsType<OkObjectResult>(
                (await controller.GetById(ticket.Id, CancellationToken.None)).Result).Value);

        Assert.Equal(
            [TicketStatus.Resolved, TicketStatus.Rejected],
            wTrakcie.AllowedStatuses);
    }
}
