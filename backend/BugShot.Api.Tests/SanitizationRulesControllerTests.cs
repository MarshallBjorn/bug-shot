using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Sanitization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class SanitizationRulesControllerTests
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

    private static async Task<Project> NewProject(BugShotDbContext db)
    {
        var project = new Project { Name = "Projekt sanityzacji", Key = $"test-{Guid.NewGuid():N}" };
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return project;
    }

    private static async Task<Ticket> NewTicket(BugShotDbContext db, Guid projectId)
    {
        var ticket = new Ticket
        {
            ProjectId = projectId,
            Description = "placeholder",
            PageUrl = "https://acme.example/cart",
            UserAgent = "Mozilla/5.0",
            Status = TicketStatus.New
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        return ticket;
    }

    [Fact]
    public async Task ZalozenieRegulyZNiepoprawnymWzorcemDajeBladWalidacji()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);

        var result = await controller.Create(
            new CreateSanitizationRuleRequest(null, "(niedomkniety", "***"),
            CancellationToken.None);

        var badRequest = Assert.IsType<ObjectResult>(result.Result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(nameof(CreateSanitizationRuleRequest.Pattern), problem.Errors.Keys);
    }

    [Fact]
    public async Task ZalozenieRegulyDlaNieistniejacegoProjektuDaje404()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);

        var result = await controller.Create(
            new CreateSanitizationRuleRequest(Guid.NewGuid(), "sekret", "***"),
            CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task TestRegulyPokazujeWynikIMatchCountBezZapisu()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);
        var before = await db.SanitizationRules.CountAsync();

        var response = controller.Test(new TestSanitizationRuleRequest(
            @"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+",
            "***",
            "Kontakt: jan.kowalski@example.com"));

        var ok = Assert.IsType<OkObjectResult>(response.Result);
        var body = Assert.IsType<TestSanitizationRuleResponse>(ok.Value);

        Assert.Equal("Kontakt: ***", body.Result);
        Assert.Equal(1, body.MatchCount);
        Assert.Equal(before, await db.SanitizationRules.CountAsync());
    }

    [Fact]
    public void TestRegulyZNiepoprawnymWzorcemDajeBladWalidacji()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);

        var response = controller.Test(new TestSanitizationRuleRequest("(niedomkniety", "***", "tresc"));

        var badRequest = Assert.IsType<ObjectResult>(response.Result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(nameof(TestSanitizationRuleRequest.Pattern), problem.Errors.Keys);
    }

    // wzorzec z katastrofalnym nawrotem ktory na takim tekscie zawsze przekracza limit czasu
    private const string SlowPattern = "(a+)+$";

    private static readonly string SlowText = new string('a', 40) + "!";

    [Fact]
    public void TestRegulyPrzekraczajacejLimitCzasuDajeBladWalidacji()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);

        var response = controller.Test(new TestSanitizationRuleRequest(SlowPattern, "***", SlowText));

        var badRequest = Assert.IsType<ObjectResult>(response.Result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(nameof(TestSanitizationRuleRequest.Pattern), problem.Errors.Keys);
    }

    [Fact]
    public async Task RegulaPrzekraczajacaLimitCzasuJestPomijanaPrzySanityzacji()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);
        var sanitization = new SanitizationService(db);

        var project = await NewProject(db);
        var ticket = await NewTicket(db, project.Id);

        await controller.Create(new CreateSanitizationRuleRequest(project.Id, SlowPattern, "***"), CancellationToken.None);
        await controller.Create(new CreateSanitizationRuleRequest(project.Id, "sekret", "***"), CancellationToken.None);

        var masked = await sanitization.SanitizeAsync(
            project.Id, ticket.Id, "Description", $"sekret {SlowText}", CancellationToken.None);

        Assert.Equal($"*** {SlowText}", masked);
    }

    [Fact]
    public async Task WylaczenieRegulyDzialaNatychmiastBezRestartuApi()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);
        var sanitization = new SanitizationService(db);

        var project = await NewProject(db);
        var ticket = await NewTicket(db, project.Id);

        var created = await controller.Create(
            new CreateSanitizationRuleRequest(project.Id, "sekret", "***"),
            CancellationToken.None);
        var rule = Assert.IsType<SanitizationRuleResponse>(Assert.IsType<CreatedResult>(created.Result).Value);

        var maskedWhileEnabled = await sanitization.SanitizeAsync(
            project.Id, ticket.Id, "Description", "to jest sekret", CancellationToken.None);
        Assert.Equal("to jest ***", maskedWhileEnabled);

        var disabled = await controller.SetEnabled(
            rule.Id, new UpdateSanitizationRuleEnabledRequest(false), CancellationToken.None);
        var disabledRule = Assert.IsType<SanitizationRuleResponse>(Assert.IsType<OkObjectResult>(disabled.Result).Value);
        Assert.False(disabledRule.IsEnabled);

        var untouchedWhileDisabled = await sanitization.SanitizeAsync(
            project.Id, ticket.Id, "Description", "to jest sekret", CancellationToken.None);
        Assert.Equal("to jest sekret", untouchedWhileDisabled);

        var enabled = await controller.SetEnabled(
            rule.Id, new UpdateSanitizationRuleEnabledRequest(true), CancellationToken.None);
        var enabledRule = Assert.IsType<SanitizationRuleResponse>(Assert.IsType<OkObjectResult>(enabled.Result).Value);
        Assert.True(enabledRule.IsEnabled);

        var maskedAgain = await sanitization.SanitizeAsync(
            project.Id, ticket.Id, "Description", "to jest sekret", CancellationToken.None);
        Assert.Equal("to jest ***", maskedAgain);
    }

    [Fact]
    public async Task ListaRegulZProjectIdDoliczaRegulyGlobalne()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);
        var project = await NewProject(db);

        await controller.Create(new CreateSanitizationRuleRequest(project.Id, "projektowa", "***"), CancellationToken.None);

        var result = await controller.GetList(CancellationToken.None, project.Id);
        var rules = Assert.IsType<List<SanitizationRuleResponse>>(Assert.IsType<OkObjectResult>(result.Result).Value);

        Assert.Contains(rules, r => r.ProjectId == project.Id && r.Pattern == "projektowa");
        Assert.Contains(rules, r => r.ProjectId == null);
    }

    [Fact]
    public async Task KasowanieRegulyUsuwaJaZBazy()
    {
        var db = NewContext();
        var controller = new SanitizationRulesController(db);

        var created = await controller.Create(
            new CreateSanitizationRuleRequest(null, "do-skasowania", "***"),
            CancellationToken.None);
        var rule = Assert.IsType<SanitizationRuleResponse>(Assert.IsType<CreatedResult>(created.Result).Value);

        var result = await controller.Delete(rule.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await db.SanitizationRules.AnyAsync(r => r.Id == rule.Id));
    }
}
