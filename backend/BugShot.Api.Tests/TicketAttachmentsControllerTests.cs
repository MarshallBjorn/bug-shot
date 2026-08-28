using System.Text;
using BugShot.Api.Attachments;
using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class TicketAttachmentsControllerTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), $"bugshot-{Guid.NewGuid():N}");

    private static readonly byte[] Png =
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x01, 0x02, 0x03,
        0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ];

    public void Dispose()
    {
        if (Directory.Exists(root))
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private static BugShotDbContext NewContext()
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings__DefaultConnection is not configured.");

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

    private static async Task<CreatedTicketResponse> CreateTicket(BugShotDbContext db)
    {
        var request = new CreateTicketRequest
        {
            ProjectKey = "demo",
            Description = "Koszyk gubi produkty",
            PageUrl = "https://acme.example/cart",
            UserAgent = "Mozilla/5.0"
        };

        var result = await new TicketsController(db).Create(request, CancellationToken.None);
        return (CreatedTicketResponse)((CreatedAtActionResult)result.Result!).Value!;
    }

    private TicketAttachmentsController NewController(BugShotDbContext db, string? token, Stream body, string contentType)
    {
        var context = new DefaultHttpContext();
        context.Request.Body = body;
        context.Request.ContentType = contentType;
        context.Request.ContentLength = body.Length;

        if (token is not null)
        {
            context.Request.Headers[UploadToken.HeaderName] = token;
        }

        return new TicketAttachmentsController(db, new AttachmentStorageOptions(root))
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
    }

    private static (Stream Body, string ContentType) Multipart(params (string Field, string FileName, byte[] Content)[] parts)
    {
        var boundary = $"----bugshot{Guid.NewGuid():N}";
        var buffer = new MemoryStream();

        foreach (var (field, fileName, content) in parts)
        {
            var header = $"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{fileName}\"\r\n\r\n";
            buffer.Write(Encoding.UTF8.GetBytes(header));
            buffer.Write(content);
            buffer.Write("\r\n"u8);
        }

        buffer.Write(Encoding.UTF8.GetBytes($"--{boundary}--\r\n"));
        buffer.Position = 0;

        return (buffer, $"multipart/form-data; boundary={boundary}");
    }

    private async Task<IActionResult> Upload(BugShotDbContext db, Guid ticketId, string? token,
        params (string Field, string FileName, byte[] Content)[] parts)
    {
        Directory.CreateDirectory(root);
        var (body, contentType) = Multipart(parts);
        var controller = NewController(db, token, body, contentType);
        return await controller.Upload(ticketId, CancellationToken.None);
    }

    private static int StatusOf(IActionResult result) => result switch
    {
        StatusCodeResult status => status.StatusCode,
        ObjectResult { StatusCode: { } code } => code,
        ObjectResult { Value: ProblemDetails { Status: { } status } } => status,
        // ValidationProblem bez ProblemDetailsFactory nie wypelnia statusu a sam obiekt oznacza 400
        ObjectResult { Value: ValidationProblemDetails } => StatusCodes.Status400BadRequest,
        _ => 0
    };

    [Fact]
    public async Task PlikTrafiaNaDyskAUriWBazieProwadziDoNiego()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var result = await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", Png));

        Assert.Equal(StatusCodes.Status201Created, StatusOf(result));

        var attachment = await db.TicketAttachments.SingleAsync();
        Assert.Equal(AttachmentKind.Screenshot, attachment.Kind);
        Assert.Equal("image/png", attachment.ContentType);
        Assert.Equal(Png.Length, attachment.SizeBytes);
        Assert.StartsWith("/attachments/", attachment.Uri);

        var onDisk = Path.Combine(root, Path.GetFileName(attachment.Uri));
        Assert.True(File.Exists(onDisk));
        Assert.Equal(Png, await File.ReadAllBytesAsync(onDisk));
    }

    [Fact]
    public async Task ZuzytyTokenDaje401()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", Png));
        var second = await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", Png));

        Assert.Equal(StatusCodes.Status401Unauthorized, StatusOf(second));
        Assert.Equal(1, await db.TicketAttachments.CountAsync());
    }

    [Fact]
    public async Task NieznanyTokenDaje401()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var result = await Upload(db, ticket.Id, "nie-ten-token", ("screenshot", "zrzut.png", Png));

        Assert.Equal(StatusCodes.Status401Unauthorized, StatusOf(result));
        Assert.Empty(db.TicketAttachments);
    }

    [Fact]
    public async Task BrakNaglowkaDaje401()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var result = await Upload(db, ticket.Id, null, ("screenshot", "zrzut.png", Png));

        Assert.Equal(StatusCodes.Status401Unauthorized, StatusOf(result));
    }

    [Fact]
    public async Task TokenWystawionyDlaInnegoZgloszeniaDaje401()
    {
        using var db = NewContext();
        var first = await CreateTicket(db);
        var second = await CreateTicket(db);

        var result = await Upload(db, second.Id, first.UploadToken, ("screenshot", "zrzut.png", Png));

        Assert.Equal(StatusCodes.Status401Unauthorized, StatusOf(result));
    }

    [Fact]
    public async Task PlikPonadLimitDaje413()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var zaDuzy = new byte[AttachmentLimits.MaxFileBytes + 1024];
        Png.CopyTo(zaDuzy, 0);

        var result = await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", zaDuzy));

        Assert.Equal(StatusCodes.Status413PayloadTooLarge, StatusOf(result));
        Assert.Empty(db.TicketAttachments);
        Assert.Empty(Directory.GetFiles(root));
    }

    [Fact]
    public async Task LogPonadLimitDaje413()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var zaDlugi = Encoding.UTF8.GetBytes(new string('x', (int)AttachmentLimits.MaxConsoleLogBytes + 1));

        var result = await Upload(db, ticket.Id, ticket.UploadToken, ("consoleLog", "konsola.log", zaDlugi));

        Assert.Equal(StatusCodes.Status413PayloadTooLarge, StatusOf(result));
    }

    [Fact]
    public async Task ZawartoscNiezgodnaZTypemDaje400ZListaPol()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var podszywacz = Encoding.ASCII.GetBytes("MZ to nie jest obrazek");

        var result = await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", podszywacz));

        Assert.Equal(StatusCodes.Status400BadRequest, StatusOf(result));

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsType<ObjectResult>(result).Value);
        Assert.Contains("screenshot", problem.Errors.Keys);
        Assert.Empty(db.TicketAttachments);
        Assert.Empty(Directory.GetFiles(root));
    }

    [Fact]
    public async Task OdrzuconeZadanieNieZuzywaTokena()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", Encoding.ASCII.GetBytes("MZ")));
        var retry = await Upload(db, ticket.Id, ticket.UploadToken, ("screenshot", "zrzut.png", Png));

        Assert.Equal(StatusCodes.Status201Created, StatusOf(retry));
    }

    [Fact]
    public async Task DrugiZrzutWTymSamymZadaniuJestOdrzucany()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var result = await Upload(db, ticket.Id, ticket.UploadToken,
            ("screenshot", "a.png", Png),
            ("screenshot", "b.png", Png));

        Assert.Equal(StatusCodes.Status400BadRequest, StatusOf(result));
    }

    [Fact]
    public async Task SzostyPlikJestOdrzucany()
    {
        using var db = NewContext();
        var ticket = await CreateTicket(db);

        var parts = Enumerable.Range(0, AttachmentLimits.MaxFiles + 1)
            .Select(i => ("files", $"plik{i}.png", Png))
            .ToArray();

        var result = await Upload(db, ticket.Id, ticket.UploadToken, parts);

        Assert.Equal(StatusCodes.Status400BadRequest, StatusOf(result));
    }
}
