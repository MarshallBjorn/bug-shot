using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class ProjectsControllerTests
{
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
                npgsql.MapEnum<NotificationChannelType>("notification_channel_type");
                npgsql.MapEnum<NotificationEventType>("notification_event_type");
                npgsql.MapEnum<NotificationDeliveryStatus>("notification_delivery_status");
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BugShotDbContext(options);
    }

    private static string UniqueKey() => $"test-{Guid.NewGuid():N}";

    private static async Task<ProjectResponse> CreateProject(ProjectsController controller, string name = "Projekt testowy")
    {
        var created = await controller.Create(new CreateProjectRequest(name, UniqueKey()), CancellationToken.None);

        return Assert.IsType<ProjectResponse>(Assert.IsType<CreatedResult>(created.Result).Value);
    }

    [Fact]
    public async Task UtworzenieProjektuZZajetymKluczemDajeBladWalidacji()
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var key = UniqueKey();

        var pierwszy = await controller.Create(new CreateProjectRequest("Pierwszy", key), CancellationToken.None);
        Assert.IsType<CreatedResult>(pierwszy.Result);

        var drugi = await controller.Create(new CreateProjectRequest("Drugi", key), CancellationToken.None);

        var badRequest = Assert.IsType<ObjectResult>(drugi.Result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(nameof(CreateProjectRequest.Key), problem.Errors.Keys);
    }

    [Fact]
    public async Task ZmianaNazwyProjektuNieRuszaKlucza()
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var project = await CreateProject(controller, "Stara nazwa");

        var updated = await controller.Update(project.Id, new UpdateProjectRequest("Nowa nazwa"), CancellationToken.None);

        var response = Assert.IsType<ProjectResponse>(Assert.IsType<OkObjectResult>(updated.Result).Value);
        Assert.Equal("Nowa nazwa", response.Name);
        Assert.Equal(project.Key, response.Key);
    }

    [Fact]
    public async Task UsuniecieProjektuZTicketamiJestZablokowaneZKomunikatem()
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var project = await CreateProject(controller, "Z ticketem");

        db.Tickets.Add(new Ticket
        {
            ProjectId = project.Id,
            Description = "Zgloszenie blokujace kasowanie",
            PageUrl = "https://acme.example/cart",
            UserAgent = "Mozilla/5.0",
            Status = TicketStatus.New
        });
        await db.SaveChangesAsync();

        var result = await controller.Delete(project.Id, CancellationToken.None);

        var conflict = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.True(await db.Projects.AnyAsync(p => p.Id == project.Id));
    }

    [Fact]
    public async Task UsuniecieProjektuBezTicketowDzialaOdRazu()
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var project = await CreateProject(controller, "Bez ticketow");

        var result = await controller.Delete(project.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await db.Projects.AnyAsync(p => p.Id == project.Id));
    }

    [Fact]
    public async Task DodanieIUsuniecieOriginuDzialaNaProjekcie()
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var project = await CreateProject(controller, "Z originami");

        var added = await controller.AddOrigin(
            project.Id,
            new CreateProjectOriginRequest("https://acme.example/"),
            CancellationToken.None);
        var origin = Assert.IsType<ProjectOriginResponse>(Assert.IsType<CreatedResult>(added.Result).Value);

        // koncowy ukosnik jest ucinany zeby nie tworzyc fantomowego duplikatu
        Assert.Equal("https://acme.example", origin.Origin);

        var duplicate = await controller.AddOrigin(
            project.Id,
            new CreateProjectOriginRequest("https://acme.example"),
            CancellationToken.None);
        var conflict = Assert.IsType<ObjectResult>(duplicate.Result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);

        var removed = await controller.RemoveOrigin(project.Id, origin.Id, CancellationToken.None);
        Assert.IsType<NoContentResult>(removed);
        Assert.False(await db.ProjectOrigins.AnyAsync(o => o.Id == origin.Id));
    }

    [Theory]
    [InlineData("acme.example")]
    [InlineData("localhost:5500")]
    [InlineData("https://acme.example/cart")]
    [InlineData("https://acme.example?utm=1")]
    [InlineData("ftp://acme.example")]
    [InlineData("https://user@acme.example")]
    public async Task OriginInnyNizSchematIHostDajeBladWalidacji(string value)
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var project = await CreateProject(controller, "Zle originy");

        var added = await controller.AddOrigin(project.Id, new CreateProjectOriginRequest(value), CancellationToken.None);

        var badRequest = Assert.IsType<ObjectResult>(added.Result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(nameof(CreateProjectOriginRequest.Origin), problem.Errors.Keys);
        Assert.False(await db.ProjectOrigins.AnyAsync(o => o.ProjectId == project.Id));
    }

    [Fact]
    public async Task OriginTrafiaDoBazyWPostaciWysylanejPrzezPrzegladarke()
    {
        var db = NewContext();
        var controller = new ProjectsController(db);
        var project = await CreateProject(controller, "Normalizacja originu");

        var added = await controller.AddOrigin(
            project.Id,
            new CreateProjectOriginRequest(" HTTPS://Sklep.Example:443/ "),
            CancellationToken.None);
        var origin = Assert.IsType<ProjectOriginResponse>(Assert.IsType<CreatedResult>(added.Result).Value);

        Assert.Equal("https://sklep.example", origin.Origin);

        var withPort = await controller.AddOrigin(
            project.Id,
            new CreateProjectOriginRequest("http://127.0.0.1:5500"),
            CancellationToken.None);
        var portOrigin = Assert.IsType<ProjectOriginResponse>(Assert.IsType<CreatedResult>(withPort.Result).Value);

        Assert.Equal("http://127.0.0.1:5500", portOrigin.Origin);

        // ten sam origin w innym zapisie to nadal duplikat
        var duplicate = await controller.AddOrigin(
            project.Id,
            new CreateProjectOriginRequest("https://sklep.example"),
            CancellationToken.None);
        var conflict = Assert.IsType<ObjectResult>(duplicate.Result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
    }
}
