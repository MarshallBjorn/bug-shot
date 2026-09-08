using BugShot.Api.Attachments;
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

[CollectionDefinition("PostgreSQL tests", DisableParallelization = true)]
public class PostgreSqlTestCollection
{
}

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

    private static BugShotDbContext OpenContext()
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings__DefaultConnection is not configured.");

        var options = new DbContextOptionsBuilder<BugShotDbContext>()
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MapEnum<TicketStatus>("ticket_status");
                npgsql.MapEnum<AttachmentKind>("attachment_kind");
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BugShotDbContext(options);
    }

    private static BugShotDbContext NewContext()
    {
        var db = OpenContext();
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
        IDistributedCache? cache = null)
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

        return new TicketsController(db, storage ?? NewStorage(), cache ?? NewCache(), NullLogger<TicketsController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
    }

    private static UpdateTicketStatusRequest StatusRequest(TicketStatus status) => new(status, "bartek");

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

    private static string RowVersion(Ticket ticket) => Convert.ToBase64String(ticket.RowVersion);

    private static IDistributedCache NewCache() =>
        new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));

    private static async Task<Project> CreateProjectWithoutOrigins(BugShotDbContext db)
    {
        var project = new Project { Name = "Bez originow", Key = $"bez-originow-{Guid.NewGuid():N}" };
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return project;
    }

    [Fact]
    public async Task ZgloszenieZnanegoProjektuJestZapisywane()
    {
        using var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var controller = NewController(db);

        var result = await controller.Create(Request("demo"), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

        var ticket = await db.Tickets.SingleAsync();
        Assert.Equal(payload.Id, ticket.Id);
        Assert.Equal(project.Id, ticket.ProjectId);
        Assert.Equal(TicketStatus.New, ticket.Status);
    }

    [Fact]
    public async Task ZapisUstawiaZnacznikiCzasu()
    {
        using var db = NewContext();
        var controller = NewController(db);

        await controller.Create(Request("demo"), CancellationToken.None);

        var ticket = await db.Tickets.SingleAsync();
        Assert.NotEqual(default, ticket.CreatedAt);
        Assert.Equal(ticket.CreatedAt, ticket.UpdatedAt);
    }

    [Fact]
    public async Task NieznanyKluczProjektuJestOdrzucany()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.Create(Request("nie-istnieje"), CancellationToken.None);

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task SzczegolyNieistniejacegoZgloszeniaDaja404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.GetById(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }
    [Fact]
    public async Task PustyKomentarzJestOdrzucany()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);
        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var request = new CreateTicketCommentRequest("tester", "   ");

        var result = await controller.AddComment(
            payload.Id,
            request,
            CancellationToken.None);

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);
        Assert.False(await db.TicketComments.AnyAsync());
    }

    [Fact]
    public async Task WhitespaceWAutorzeJestOdrzucany()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var request = new CreateTicketCommentRequest("   ", "Komentarz");

        var result = await controller.AddComment(
            payload.Id,
            request,
            CancellationToken.None);

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);
        Assert.False(await db.TicketComments.AnyAsync());
    }

    [Fact]
    public async Task KomentarzNaSkasowanymTickecieDaje409()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var deleteResult = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(deleteResult);

        var result = await controller.AddComment(
            payload.Id,
            new CreateTicketCommentRequest("tester", "Komentarz po usunięciu"),
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);

        var details = Assert.IsType<ProblemDetails>(problem.Value);
        Assert.Equal(TicketStatus.Deleted, details.Extensions["currentStatus"]);
        Assert.False(await db.TicketComments.AnyAsync(c => c.TicketId == payload.Id));
    }

    [Fact]
    public async Task UtworzonyKomentarzMaLocationDoListyKomentarzy()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var result = await controller.AddComment(
            payload.Id,
            new CreateTicketCommentRequest("tester", "Pierwszy komentarz"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);

        Assert.Equal(nameof(TicketsController.GetComments), created.ActionName);

        var routeValues = created.RouteValues
            ?? throw new Xunit.Sdk.XunitException("CreatedAtAction nie zawiera RouteValues.");

        Assert.Equal(payload.Id, routeValues["id"]);
    }

    [Fact]
    public async Task UsuniecieTicketuNieZwracaBleduGdyKatalogZalacznikaNieIstnieje()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        const string fileName = "missing-directory-attachment.png";

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

        Directory.Delete(storage.RootPath, recursive: true);

        var result = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);

        var deletedTicket = await db.Tickets
            .AsNoTracking()
            .SingleAsync(t => t.Id == payload.Id);

        Assert.Equal(TicketStatus.Deleted, deletedTicket.Status);
        Assert.False(await db.TicketAttachments.AnyAsync(a => a.TicketId == payload.Id));
    }
    [Fact]
    public async Task KomentarzJestZapisywany()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);
        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var request = new CreateTicketCommentRequest("tester", "Pierwszy komentarz");

        var result = await controller.AddComment(
            payload.Id,
            request,
            CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var response = Assert.IsType<TicketCommentResponse>(created.Value);

        var comment = await db.TicketComments.SingleAsync();

        Assert.Equal(response.Id, comment.Id);
        Assert.Equal("tester", comment.Author);
        Assert.Equal("Pierwszy komentarz", comment.Body);
    }

    [Fact]
    public async Task ListaKomentarzyJestRosnacoPoCreatedAtIZwracaDomyslnie50()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);
        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var baseTime = DateTimeOffset.UtcNow.AddMinutes(-10);

        db.TicketComments.AddRange(
            Enumerable.Range(0, 51).Select(i => new TicketComment
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

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<PagedResult<TicketCommentResponse>>(ok.Value);

        Assert.Equal(51, response.Total);
        Assert.Equal(1, response.Page);
        Assert.Equal(50, response.PageSize);
        Assert.Equal(50, response.Items.Count);
        Assert.True(
            response.Items.Zip(response.Items.Skip(1))
                .All(pair => pair.First.CreatedAt <= pair.Second.CreatedAt));
    }
    [Fact]
    public async Task ListaKomentarzyObslugujePaginacje()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

        var baseTime = DateTimeOffset.UtcNow.AddMinutes(-10);

        var comments = Enumerable.Range(1, 5).Select(i => new TicketComment
        {
            TicketId = payload.Id,
            Author = "tester",
            Body = $"Komentarz {i}"
        }).ToList();

        db.TicketComments.AddRange(comments);
        await db.SaveChangesAsync();

        for (var i = 0; i < comments.Count; i++)
        {
            comments[i].CreatedAt = baseTime.AddMinutes(i);
        }

        await db.SaveChangesAsync();

        var result = await controller.GetComments(
            payload.Id,
            CancellationToken.None,
            page: 2,
            pageSize: 2);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<PagedResult<TicketCommentResponse>>(ok.Value);

        Assert.Equal(5, response.Total);
        Assert.Equal(2, response.Page);
        Assert.Equal(2, response.PageSize);
        Assert.Equal(2, response.Items.Count);
        Assert.Equal("Komentarz 3", response.Items[0].Body);
        Assert.Equal("Komentarz 4", response.Items[1].Body);
    }

    [Fact]
    public async Task UsuniecieTicketuRobiTombstone()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

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

        Assert.Equal(TicketStatus.Deleted, ticket.Status);
        Assert.Equal(string.Empty, ticket.Description);
        Assert.Equal(string.Empty, ticket.PageUrl);
        Assert.Equal(string.Empty, ticket.UserAgent);
        Assert.NotNull(ticket.DeletedAt);
        Assert.Equal("system", ticket.DeletedBy);

        Assert.Empty(await db.TicketComments
            .Where(c => c.TicketId == payload.Id)
            .ToListAsync());

        var history = await db.TicketStatusChanges
            .AsNoTracking()
            .SingleAsync(h => h.TicketId == payload.Id);

        Assert.Equal(TicketStatus.New, history.FromStatus);
        Assert.Equal(TicketStatus.Deleted, history.ToStatus);
        Assert.Equal("system", history.ChangedBy);

        var getResult = await controller.GetById(
            payload.Id,
            CancellationToken.None);

        var getOk = Assert.IsType<OkObjectResult>(getResult.Result);
        var details = Assert.IsType<TicketDetails>(getOk.Value);

        Assert.Equal(TicketStatus.Deleted, details.Status);
        Assert.Equal(string.Empty, details.Description);
        Assert.Equal(string.Empty, details.PageUrl);
        Assert.Equal(string.Empty, details.UserAgent);
        Assert.Equal(0, details.CommentCount);
        Assert.Empty(details.Attachments);
        Assert.Null(details.ConsoleLogUri);
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaPlikZWolumenu()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

        const string fileName = "test-attachment.png";
        var filePath = Path.Combine(storage.RootPath, fileName);

        await System.IO.File.WriteAllBytesAsync(filePath, [1, 2, 3]);

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

        Assert.True(System.IO.File.Exists(filePath));

        var result = await controller.Delete(
            payload.Id,
            CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.False(System.IO.File.Exists(filePath));
        Assert.False(await db.TicketAttachments
            .AnyAsync(a => a.TicketId == payload.Id));
    }

    [Fact]
    public async Task NieistniejacyTicketDlaKomentarzaDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.AddComment(
            Guid.NewGuid(),
            new CreateTicketCommentRequest("tester", "Komentarz"),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task NieistniejacyTicketDlaListyKomentarzyDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.GetComments(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task UsuniecieNieistniejacegoTicketuDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.Delete(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaWszystkieKomentarze()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

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

        await controller.Delete(payload.Id, CancellationToken.None);

        Assert.Equal(
            0,
            await db.TicketComments.CountAsync(c => c.TicketId == payload.Id));
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaWszystkiePlikiZWolumenu()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

        var fileNames = new[] { "first.png", "second.png" };

        foreach (var fileName in fileNames)
        {
            await System.IO.File.WriteAllBytesAsync(
                Path.Combine(storage.RootPath, fileName),
                [1, 2, 3]);
        }

        db.TicketAttachments.AddRange(
            fileNames.Select(fileName => new TicketAttachment
            {
                TicketId = payload.Id,
                Kind = AttachmentKind.Screenshot,
                Uri = $"{AttachmentStorageOptions.UriPrefix}/{fileName}",
                FileName = fileName,
                ContentType = "image/png",
                SizeBytes = 3
            }));

        await db.SaveChangesAsync();

        await controller.Delete(payload.Id, CancellationToken.None);

        Assert.All(
            fileNames,
            fileName => Assert.False(
                System.IO.File.Exists(Path.Combine(storage.RootPath, fileName))));

        Assert.Equal(
            0,
            await db.TicketAttachments.CountAsync(a => a.TicketId == payload.Id));
    }

    [Fact]
    public async Task BrakNaglowkaOriginJestOdrzucany()
    {
        using var db = NewContext();
        var controller = NewController(db, origin: null);

        var result = await controller.Create(Request("demo"), CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, problem.StatusCode);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task OriginSpozaListyProjektuJestOdrzucany()
    {
        using var db = NewContext();
        var controller = NewController(db, origin: "https://ktos-obcy.example");

        var result = await controller.Create(Request("demo"), CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, problem.StatusCode);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task OriginPorownywanyJestBezWzgleduNaWielkoscLiter()
    {
        using var db = NewContext();
        var controller = NewController(db, origin: "HTTP://127.0.0.1:5500");

        var result = await controller.Create(Request("demo"), CancellationToken.None);

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Single(db.Tickets);
    }

    [Fact]
    public async Task PustaListaOriginowProjektuBlokujeKazdeZadanie()
    {
        using var db = NewContext();
        var project = await CreateProjectWithoutOrigins(db);
        var controller = NewController(db, origin: "https://cokolwiek.example");

        var result = await controller.Create(Request(project.Key), CancellationToken.None);

        // projekt nie znika z NewContext bo czyszczone sa tylko tickety
        db.Projects.Remove(project);
        await db.SaveChangesAsync();

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, problem.StatusCode);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task PowtorkaZTymSamymKluczemICialemZwracaOryginalnyWynik()
    {
        using var db = NewContext();
        var cache = NewCache();

        var first = await NewController(db, idempotencyKey: "klucz-1", cache: cache)
            .Create(Request("demo"), CancellationToken.None);
        var second = await NewController(db, idempotencyKey: "klucz-1", cache: cache)
            .Create(Request("demo"), CancellationToken.None);

        var firstPayload = Assert.IsType<CreatedTicketResponse>(Assert.IsType<CreatedAtActionResult>(first.Result).Value);
        var secondPayload = Assert.IsType<CreatedTicketResponse>(Assert.IsType<CreatedAtActionResult>(second.Result).Value);

        Assert.Equal(firstPayload.Id, secondPayload.Id);
        Assert.Equal(firstPayload.UploadToken, secondPayload.UploadToken);
        Assert.Single(db.Tickets);
    }

    [Fact]
    public async Task PowtorkaZTymSamymKluczemIInnymCialemDaje409()
    {
        using var db = NewContext();
        var cache = NewCache();

        await NewController(db, idempotencyKey: "klucz-2", cache: cache)
            .Create(Request("demo"), CancellationToken.None);

        var innyOpis = Request("demo");
        innyOpis.Description = "Inny opis pod tym samym kluczem";

        var result = await NewController(db, idempotencyKey: "klucz-2", cache: cache)
            .Create(innyOpis, CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);
        Assert.Single(db.Tickets);
    }

    [Fact]
    public async Task BrakKluczaIdempotencjiNieBlokujeZgloszenia()
    {
        using var db = NewContext();
        var controller = NewController(db, idempotencyKey: null);

        var first = await controller.Create(Request("demo"), CancellationToken.None);
        var second = await controller.Create(Request("demo"), CancellationToken.None);

        var firstPayload = Assert.IsType<CreatedTicketResponse>(Assert.IsType<CreatedAtActionResult>(first.Result).Value);
        var secondPayload = Assert.IsType<CreatedTicketResponse>(Assert.IsType<CreatedAtActionResult>(second.Result).Value);

        Assert.NotEqual(firstPayload.Id, secondPayload.Id);
        Assert.Equal(2, await db.Tickets.CountAsync());
    }

    [Fact]
    public async Task PoprawnyIfMatchZmieniaStatus()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var previousRowVersion = RowVersion(ticket);
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            previousRowVersion,
            CancellationToken.None);

        var payload = Assert.IsType<TicketStatusResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(TicketStatus.InProgress, payload.Status);
        Assert.NotEqual(previousRowVersion, payload.RowVersion);

        var saved = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        Assert.Equal(TicketStatus.InProgress, saved.Status);
        Assert.Equal(payload.RowVersion, Convert.ToBase64String(saved.RowVersion));
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
            Convert.ToBase64String(Guid.NewGuid().ToByteArray()),
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);

        var details = Assert.IsType<ProblemDetails>(problem.Value);
        Assert.Equal(TicketStatus.New, details.Extensions["currentStatus"]);
        Assert.Equal(RowVersion(ticket), details.Extensions["rowVersion"]);

        var saved = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        Assert.Equal(TicketStatus.New, saved.Status);
        Assert.Empty(db.TicketStatusChanges.Where(h => h.TicketId == ticket.Id));
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

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status428PreconditionRequired, problem.StatusCode);

        var saved = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        Assert.Equal(TicketStatus.New, saved.Status);
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
                Assert.Equal(TicketStatus.New, first.FromStatus);
                Assert.Equal(TicketStatus.InProgress, first.ToStatus);
                Assert.Equal("bartek", first.ChangedBy);
            },
            second =>
            {
                Assert.Equal(TicketStatus.InProgress, second.FromStatus);
                Assert.Equal(TicketStatus.Resolved, second.ToStatus);
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

        var payload = Assert.IsType<TicketStatusResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.Equal(rowVersion, payload.RowVersion);
        Assert.Empty(db.TicketStatusChanges.Where(h => h.TicketId == ticket.Id));
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

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);

        var saved = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        Assert.Equal(TicketStatus.New, saved.Status);
    }

    [Fact]
    public async Task ZmianaStatusuNieistniejacegoZgloszeniaDaje404()
    {
        using var db = NewContext();
        var controller = NewController(db);

        var result = await controller.UpdateStatus(
            Guid.NewGuid(),
            StatusRequest(TicketStatus.InProgress),
            Convert.ToBase64String(Guid.NewGuid().ToByteArray()),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task ZapisMiedzyOdczytemAZapisemDaje409()
    {
        using var db = NewContext();
        var ticket = await NewTicket(db);
        var rowVersion = RowVersion(ticket);
        var controller = NewController(db);

        // druga sesja przestawia status zanim pierwsza zdazy zapisac
        using (var other = OpenContext())
        {
            var sameTicket = await other.Tickets.SingleAsync(t => t.Id == ticket.Id);
            sameTicket.Status = TicketStatus.Rejected;
            await other.SaveChangesAsync();
        }

        // kontroler dostaje sledzona encje wiec If-Match zgadza sie mimo nieaktualnej bazy
        var result = await controller.UpdateStatus(
            ticket.Id,
            StatusRequest(TicketStatus.InProgress),
            rowVersion,
            CancellationToken.None);

        var problem = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status409Conflict, problem.StatusCode);

        var details = Assert.IsType<ProblemDetails>(problem.Value);
        Assert.Equal(TicketStatus.Rejected, details.Extensions["currentStatus"]);

        var saved = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == ticket.Id);
        Assert.Equal(TicketStatus.Rejected, saved.Status);
        Assert.Empty(db.TicketStatusChanges.Where(h => h.TicketId == ticket.Id));
    }

    [Fact]
    public async Task PowtorzoneKasowanieNieDopisujeHistoriiAniNieNadpisujeDeletedAt()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = NewController(db, storage: storage);

        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

        Assert.IsType<NoContentResult>(await controller.Delete(payload.Id, CancellationToken.None));

        var poPierwszym = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == payload.Id);

        Assert.IsType<NoContentResult>(await controller.Delete(payload.Id, CancellationToken.None));

        var poDrugim = await db.Tickets.AsNoTracking().SingleAsync(t => t.Id == payload.Id);

        Assert.Equal(poPierwszym.DeletedAt, poDrugim.DeletedAt);
        Assert.Equal(poPierwszym.RowVersion, poDrugim.RowVersion);

        var history = await db.TicketStatusChanges
            .AsNoTracking()
            .Where(h => h.TicketId == payload.Id)
            .ToListAsync();

        Assert.Single(history);
        Assert.Equal(TicketStatus.New, history[0].FromStatus);
        Assert.Equal(TicketStatus.Deleted, history[0].ToStatus);
    }
}
