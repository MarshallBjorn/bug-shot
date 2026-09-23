using BugShot.Api.Analytics;
using BugShot.Api.Data;
using BugShot.Api.Migrations;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace BugShot.Api.Tests;

// migracja powtarza reguly parsera w SQL wiec rozjazd miedzy nimi dalby inne liczby dla starych i nowych zgloszen
[Collection("PostgreSQL tests")]
public class TicketClientDetailsBackfillTests
{
    private static readonly string[] UserAgents =
    [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 OPR/121.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.0.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Mozilla/5.0 (demo)",
        "   ",
        ""
    ];

    private static readonly string[] PageUrls =
    [
        "https://Sklep.example/Koszyk?utm_source=newsletter#opinie",
        "https://sklep.example/",
        "http://127.0.0.1:5500/cart/",
        "https://sklep.example/produkt#opinie?x=1",
        " https://sklep.example/kontakt ",
        ""
    ];

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
                npgsql.MapEnum<ProjectRole>("project_role");
                npgsql.MapEnum<UserTokenPurpose>("user_token_purpose");
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BugShotDbContext(options);
    }

    [Fact]
    public async Task MigracjaUzupelniaStareZgloszeniaTakSamoJakKodPrzyPrzyjeciu()
    {
        using var db = NewContext();

        var project = new Project { Name = "Projekt migracji", Key = $"test-{Guid.NewGuid():N}" };
        db.Projects.Add(project);

        var tickets = UserAgents
            .Select((agent, index) => new Ticket
            {
                ProjectId = project.Id,
                Description = "Zgloszenie sprzed migracji",
                PageUrl = PageUrls[index % PageUrls.Length],
                UserAgent = agent,
                Status = TicketStatus.New
            })
            .ToList();

        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();

        var backfill = new AddTicketClientDetails().UpOperations.OfType<SqlOperation>().Single().Sql;

        // warunek zawezony do projektu testu zeby nie przepisywac reszty bazy
        await db.Database.ExecuteSqlRawAsync($"{backfill} where project_id = {{0}}", project.Id);

        var stored = await db.Tickets
            .AsNoTracking()
            .Where(t => t.ProjectId == project.Id)
            .ToDictionaryAsync(t => t.Id);

        foreach (var ticket in tickets)
        {
            var row = stored[ticket.Id];
            var agent = UserAgentParser.Parse(ticket.UserAgent);

            Assert.Equal(PageAddress.Normalize(ticket.PageUrl), row.Page);
            Assert.Equal(new UserAgentInfo(agent.Browser, agent.Os, agent.DeviceType), new UserAgentInfo(row.BrowserName, row.OsName, row.DeviceType));
        }
    }
}
