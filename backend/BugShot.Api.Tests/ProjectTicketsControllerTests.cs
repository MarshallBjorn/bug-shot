using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class ProjectTicketsControllerTests
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
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        var db = new BugShotDbContext(options);
        db.Tickets.ExecuteDelete();

        return db;
    }

    private static Ticket NewTicket(Guid projectId, string description, DateTimeOffset? reportedAt) => new()
    {
        ProjectId = projectId,
        Description = description,
        PageUrl = "https://acme.example/cart",
        UserAgent = "Mozilla/5.0",
        Status = TicketStatus.New,
        ReportedAt = reportedAt
    };

    private static async Task<(BugShotDbContext Db, Guid ProjectId)> SeedAsync()
    {
        var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var baseTime = new DateTimeOffset(2026, 8, 31, 12, 0, 0, TimeSpan.Zero);

        var wczesniej = NewTicket(project.Id, "z reportedAt wczesniej", baseTime);
        var bez = NewTicket(project.Id, "bez reportedAt", null);
        var pozniej = NewTicket(project.Id, "z reportedAt pozniej", baseTime.AddHours(2));

        db.Tickets.AddRange(wczesniej, bez, pozniej);
        await db.SaveChangesAsync();

        // receivedAt stempluje kontekst przy dodaniu wiec ustawiamy go osobnym zapisem
        wczesniej.ReceivedAt = baseTime.AddHours(5);
        bez.ReceivedAt = baseTime.AddHours(1);
        pozniej.ReceivedAt = baseTime.AddHours(6);
        await db.SaveChangesAsync();

        return (db, project.Id);
    }

    private static IReadOnlyList<string> Descriptions(ActionResult<PagedResult<TicketListItem>> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var payload = Assert.IsType<PagedResult<TicketListItem>>(ok.Value);

        return payload.Items.Select(i => i.Description).ToList();
    }

    [Fact]
    public async Task SortowanieRosnacoUstawiaZgloszenieBezReportedAtPoDacieZListy()
    {
        var (db, projectId) = await SeedAsync();
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var result = await controller.GetList(projectId, CancellationToken.None, sort: "reportedAt:asc");

        Assert.Equal(
            ["z reportedAt wczesniej", "bez reportedAt", "z reportedAt pozniej"],
            Descriptions(result));
    }

    // kolejnosc po id domyka sortowanie zeby ticket nie powtorzyl sie na dwoch stronach
    [Fact]
    public async Task RowneZnacznikiCzasuDajaStalaKolejnosc()
    {
        using var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var moment = new DateTimeOffset(2026, 8, 31, 12, 0, 0, TimeSpan.Zero);

        // identyfikatory nadane recznie w innej kolejnosci niz zapis bo generator daje je sekwencyjnie
        var a = NewTicket(project.Id, "rowne A", moment);
        a.Id = new Guid("aaaaaaaa-0000-0000-0000-000000000003");
        var b = NewTicket(project.Id, "rowne B", moment);
        b.Id = new Guid("aaaaaaaa-0000-0000-0000-000000000001");
        var c = NewTicket(project.Id, "rowne C", moment);
        c.Id = new Guid("aaaaaaaa-0000-0000-0000-000000000002");

        db.Tickets.AddRange(a, b, c);
        await db.SaveChangesAsync();

        var controller = new ProjectTicketsController(db);

        var result = await controller.GetList(project.Id, CancellationToken.None, sort: "reportedAt:asc");

        Assert.Equal(["rowne B", "rowne C", "rowne A"], Descriptions(result));
    }

    [Fact]
    public async Task SortowanieMalejacoUstawiaZgloszenieBezReportedAtPoDacieZListy()
    {
        var (db, projectId) = await SeedAsync();
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var result = await controller.GetList(projectId, CancellationToken.None, sort: "reportedAt:desc");

        Assert.Equal(
            ["z reportedAt pozniej", "bez reportedAt", "z reportedAt wczesniej"],
            Descriptions(result));
    }
}
