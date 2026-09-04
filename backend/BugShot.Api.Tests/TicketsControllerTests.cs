using BugShot.Api.Attachments;
using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    private static BugShotDbContext NewContext()
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

        var db = new BugShotDbContext(options);
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

    [Fact]
    public async Task ZgloszenieZnanegoProjektuJestZapisywane()
    {
        using var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var controller = new TicketsController(db, new AttachmentStorageOptions(Path.GetTempPath()));

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
        var controller = new TicketsController(db, new AttachmentStorageOptions(Path.GetTempPath()));

        await controller.Create(Request("demo"), CancellationToken.None);

        var ticket = await db.Tickets.SingleAsync();
        Assert.NotEqual(default, ticket.CreatedAt);
        Assert.Equal(ticket.CreatedAt, ticket.UpdatedAt);
    }

    [Fact]
    public async Task NieznanyKluczProjektuJestOdrzucany()
    {
        using var db = NewContext();
        var controller = new TicketsController(db, new AttachmentStorageOptions(Path.GetTempPath()));

        var result = await controller.Create(Request("nie-istnieje"), CancellationToken.None);

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task SzczegolyNieistniejacegoZgloszeniaDaja404()
    {
        using var db = NewContext();
        var controller = new TicketsController(db, new AttachmentStorageOptions(Path.GetTempPath()));

        var result = await controller.GetById(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }
    [Fact]
    public async Task PustyKomentarzJestOdrzucany()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = new TicketsController(db, storage);
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
    public async Task KomentarzJestZapisywany()
    {
        using var db = NewContext();
        var storage = NewStorage();
        var controller = new TicketsController(db, storage);
        var ticketResult = await controller.Create(Request("demo"), CancellationToken.None);
        var ticket = Assert.IsType<CreatedAtActionResult>(ticketResult.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(ticket.Value);

        var request = new CreateTicketCommentRequest("tester", "Pierwszy komentarz");

        var result = await controller.AddComment(
            payload.Id,
            request,
            CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result.Result);
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
        var controller = new TicketsController(db, storage);
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
        var controller = new TicketsController(db, storage);

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
        var controller = new TicketsController(db, storage);

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
        var controller = new TicketsController(db, storage);

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
        var controller = new TicketsController(db, NewStorage());

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
        var controller = new TicketsController(db, NewStorage());

        var result = await controller.GetComments(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task UsuniecieNieistniejacegoTicketuDaje404()
    {
        using var db = NewContext();
        var controller = new TicketsController(db, NewStorage());

        var result = await controller.Delete(
            Guid.NewGuid(),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task UsuniecieTicketuUsuwaWszystkieKomentarze()
    {
        using var db = NewContext();
        var controller = new TicketsController(db, NewStorage());

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
        var controller = new TicketsController(db, storage);

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
}
