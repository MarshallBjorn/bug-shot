using BugShot.Api.Analytics;
using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class ProjectAnalyticsControllerTests
{
    private const string ChromeAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

    private static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;

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

        return new BugShotDbContext(options);
    }

    // kazdy test ma wlasny projekt bo inne klasy czyszcza tickety calej bazy
    private static async Task<Project> NewProject(BugShotDbContext db)
    {
        var project = new Project { Name = "Projekt analityki", Key = $"test-{Guid.NewGuid():N}" };
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        return project;
    }

    private static async Task<Ticket> AddTicket(
        BugShotDbContext db,
        Guid projectId,
        DateTimeOffset receivedAt,
        string pageUrl = "https://sklep.example/koszyk",
        string userAgent = ChromeAgent)
    {
        var agent = UserAgentParser.Parse(userAgent);

        var ticket = new Ticket
        {
            ProjectId = projectId,
            Description = "Zgloszenie do analityki",
            PageUrl = pageUrl,
            Page = PageAddress.Normalize(pageUrl),
            UserAgent = userAgent,
            BrowserName = agent.Browser,
            OsName = agent.Os,
            DeviceType = agent.DeviceType,
            Status = TicketStatus.New
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        // receivedAt stempluje kontekst przy dodaniu wiec ustawiamy go osobnym zapisem
        ticket.ReceivedAt = receivedAt;
        await db.SaveChangesAsync();

        return ticket;
    }

    private static async Task Change(BugShotDbContext db, Ticket ticket, TicketStatus status, DateTimeOffset at)
    {
        db.TicketStatusChanges.Add(new TicketStatusChange
        {
            TicketId = ticket.Id,
            FromStatus = ticket.Status,
            ToStatus = status,
            ChangedBy = "test",
            ChangedAt = at
        });

        ticket.Status = status;
        await db.SaveChangesAsync();
    }

    private static async Task Comment(BugShotDbContext db, Ticket ticket, DateTimeOffset at)
    {
        var comment = new TicketComment { TicketId = ticket.Id, Author = "test", Body = "komentarz" };
        db.TicketComments.Add(comment);
        await db.SaveChangesAsync();

        comment.CreatedAt = at;
        await db.SaveChangesAsync();
    }

    private static async Task<ProjectAnalyticsResponse> Analytics(
        BugShotDbContext db,
        Guid projectId,
        string range = "30d",
        string tz = "UTC",
        bool includeToday = true)
    {
        var result = await new ProjectAnalyticsController(db).Get(projectId, CancellationToken.None, range, tz, includeToday);

        return Assert.IsType<ProjectAnalyticsResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
    }

    [Fact]
    public async Task ZakresLiczyOstatnieDniIPorownujeZPoprzednimOkresem()
    {
        using var db = NewContext();
        var project = await NewProject(db);

        await AddTicket(db, project.Id, Now.AddDays(-1));
        await AddTicket(db, project.Id, Now.AddDays(-3));
        await AddTicket(db, project.Id, Now.AddDays(-10));
        await AddTicket(db, project.Id, Now.AddDays(-20));

        var week = await Analytics(db, project.Id, "7d");

        Assert.Equal(2, week.Summary.NewTickets);
        Assert.Equal(1, week.Summary.PreviousNewTickets);
        Assert.Equal(4, week.Summary.OpenBacklog);

        var all = await Analytics(db, project.Id, "all");

        Assert.Equal(4, all.Summary.NewTickets);
        Assert.Null(all.Summary.PreviousNewTickets);
        Assert.Equal(AnalyticsWindow.WeekBucket, all.Bucket);
        Assert.Empty(all.RisingPages);
    }

    [Fact]
    public async Task CzasDoRozwiazaniaLiczySieDoOstatniegoRozwiazaniaAReakcjaTezZKomentarza()
    {
        using var db = NewContext();
        var project = await NewProject(db);
        var start = Now.AddDays(-5);

        var szybki = await AddTicket(db, project.Id, start);
        await Change(db, szybki, TicketStatus.InProgress, start.AddHours(2));
        await Change(db, szybki, TicketStatus.Resolved, start.AddHours(10));

        // ponownie otwarte liczy sie do drugiego rozwiazania
        var wracajacy = await AddTicket(db, project.Id, start);
        await Change(db, wracajacy, TicketStatus.Resolved, start.AddHours(4));
        await Change(db, wracajacy, TicketStatus.InProgress, start.AddHours(20));
        await Change(db, wracajacy, TicketStatus.Resolved, start.AddHours(30));

        var zKomentarzem = await AddTicket(db, project.Id, start);
        await Comment(db, zKomentarzem, start.AddHours(1));

        await AddTicket(db, project.Id, start);

        var analytics = await Analytics(db, project.Id);

        Assert.Equal(new AnalyticsDuration(20, 28, 2), analytics.Summary.TimeToResolve);
        Assert.Equal(new AnalyticsDuration(2, 3.6, 3), analytics.Summary.TimeToFirstResponse);
        Assert.Equal(0.5, analytics.Summary.ResolvedRate);
        Assert.Equal(2, analytics.Summary.OpenBacklog);
    }

    [Fact]
    public async Task SkasowaneWchodzaDoSumAleNieDoStronIPrzegladarek()
    {
        using var db = NewContext();
        var project = await NewProject(db);
        const string iphone =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

        await AddTicket(db, project.Id, Now.AddDays(-2), "https://sklep.example/koszyk?utm_source=google");
        await AddTicket(db, project.Id, Now.AddDays(-2), "https://sklep.example/koszyk#opinie");
        var odrzucony = await AddTicket(db, project.Id, Now.AddDays(-2), "https://sklep.example/koszyk/");
        await AddTicket(db, project.Id, Now.AddDays(-2), "https://sklep.example/platnosc", iphone);

        await Change(db, odrzucony, TicketStatus.Rejected, Now.AddDays(-1));

        var skasowany = await AddTicket(db, project.Id, Now.AddDays(-2), "https://sklep.example/tajne");
        TicketClientDetails.Clear(skasowany);
        skasowany.PageUrl = string.Empty;
        skasowany.UserAgent = string.Empty;
        await Change(db, skasowany, TicketStatus.Deleted, Now.AddDays(-1));

        db.TicketAttachments.Add(new TicketAttachment
        {
            TicketId = odrzucony.Id,
            Kind = AttachmentKind.Screenshot,
            Uri = "/attachments/zrzut.png",
            FileName = "zrzut.png",
            ContentType = "image/png",
            SizeBytes = 3
        });
        await db.SaveChangesAsync();

        var analytics = await Analytics(db, project.Id);

        Assert.Equal(5, analytics.Summary.NewTickets);
        Assert.Contains(new AnalyticsStatusCount(TicketStatus.Deleted, 1), analytics.Statuses);
        Assert.Contains(new AnalyticsStatusCount(TicketStatus.New, 3), analytics.Statuses);
        Assert.Equal(0.25, analytics.Summary.RejectedRate);
        Assert.Equal(0.25, analytics.Summary.ScreenshotRate);

        Assert.Equal(
            [new AnalyticsPageCount("sklep.example/koszyk", 3), new AnalyticsPageCount("sklep.example/platnosc", 1)],
            analytics.TopPages);

        Assert.Equal([new AnalyticsNameCount("Chrome", 3), new AnalyticsNameCount("Safari", 1)], analytics.Browsers);
        Assert.Equal([new AnalyticsNameCount("Windows", 3), new AnalyticsNameCount("iOS", 1)], analytics.OperatingSystems);
        Assert.Equal([new AnalyticsNameCount("desktop", 3), new AnalyticsNameCount("mobile", 1)], analytics.Devices);
    }

    [Fact]
    public async Task OsCzasuLiczyDniWStrefieIWypelniaPusteDni()
    {
        using var db = NewContext();
        var project = await NewProject(db);
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");
        var window = AnalyticsWindow.Create("7d", "Europe/Warsaw", zone, true, Now);

        // pol godziny przed polnoca w Warszawie to wczoraj mimo ze w UTC moze byc jeszcze inny dzien
        var lateEvening = window.TodayStart.AddMinutes(-30);
        var ticket = await AddTicket(db, project.Id, lateEvening);
        await Change(db, ticket, TicketStatus.Resolved, lateEvening.AddMinutes(20));

        // srodek dzisiejszego dnia zeby test nie zalezal od godziny uruchomienia
        await AddTicket(db, project.Id, window.TodayStart + (Now - window.TodayStart) / 2);

        var analytics = await Analytics(db, project.Id, "7d", "Europe/Warsaw");
        var today = window.LocalDate(Now);
        var yesterday = today.AddDays(-1);

        Assert.Equal(7, analytics.Timeline.Count);
        Assert.Equal(today, analytics.Timeline[^1].Date);
        Assert.Equal(new AnalyticsTimelinePoint(yesterday, 1, 1), analytics.Timeline[^2]);
        Assert.Equal(1, analytics.Timeline[^1].Created);
        Assert.Equal(2, analytics.Summary.NewTickets);
        Assert.Equal(1, analytics.Summary.NewToday);

        var withoutToday = await Analytics(db, project.Id, "7d", "Europe/Warsaw", includeToday: false);

        Assert.False(withoutToday.IncludeToday);
        Assert.Equal(7, withoutToday.Timeline.Count);
        Assert.Equal(yesterday, withoutToday.Timeline[^1].Date);
        Assert.Equal(1, withoutToday.Summary.NewTickets);
    }

    [Fact]
    public async Task PoprzedniOkresToTyleSamoPelnychDniTuzPrzedBiezacym()
    {
        using var db = NewContext();
        var project = await NewProject(db);
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");
        var window = AnalyticsWindow.Create("7d", "Europe/Warsaw", zone, true, Now);
        var from = window.From!.Value;

        await AddTicket(db, project.Id, window.PreviousFrom!.Value.AddSeconds(-1));
        await AddTicket(db, project.Id, window.PreviousFrom!.Value.AddSeconds(1));
        await AddTicket(db, project.Id, from.AddSeconds(-1));
        await AddTicket(db, project.Id, from.AddSeconds(1));

        var analytics = await Analytics(db, project.Id, "7d", "Europe/Warsaw");

        Assert.Equal(from.AddDays(-7), window.PreviousFrom);
        Assert.Equal(from, window.PreviousTo);
        Assert.Equal(1, analytics.Summary.NewTickets);
        Assert.Equal(2, analytics.Summary.PreviousNewTickets);
    }

    [Fact]
    public async Task RosnaceStronyPokazujaTylkoPrzyrostWzgledemPoprzedniegoOkresu()
    {
        using var db = NewContext();
        var project = await NewProject(db);

        foreach (var daysAgo in new[] { 1, 2, 3 })
        {
            await AddTicket(db, project.Id, Now.AddDays(-daysAgo), "https://sklep.example/platnosc");
        }

        await AddTicket(db, project.Id, Now.AddDays(-9), "https://sklep.example/platnosc");

        await AddTicket(db, project.Id, Now.AddDays(-1), "https://sklep.example/koszyk");
        await AddTicket(db, project.Id, Now.AddDays(-9), "https://sklep.example/koszyk");
        await AddTicket(db, project.Id, Now.AddDays(-10), "https://sklep.example/koszyk");

        var analytics = await Analytics(db, project.Id, "7d");

        Assert.Equal([new AnalyticsRisingPage("sklep.example/platnosc", 3, 1)], analytics.RisingPages);
    }

    [Fact]
    public async Task SanityzacjaSumujeTrafieniaPerRegule()
    {
        using var db = NewContext();
        var project = await NewProject(db);

        var rule = new SanitizationRule { ProjectId = project.Id, Pattern = "sekret", Replacement = "***" };
        db.SanitizationRules.Add(rule);
        await db.SaveChangesAsync();

        var pierwszy = await AddTicket(db, project.Id, Now.AddDays(-1));
        var drugi = await AddTicket(db, project.Id, Now.AddDays(-2));

        db.SanitizationLogs.AddRange(
            new SanitizationLog { TicketId = pierwszy.Id, RuleId = rule.Id, FieldName = "Description", MatchCount = 2 },
            new SanitizationLog { TicketId = drugi.Id, RuleId = rule.Id, FieldName = "PageUrl", MatchCount = 1 });
        await db.SaveChangesAsync();

        var analytics = await Analytics(db, project.Id);

        Assert.Equal([new AnalyticsSanitizationHit(rule.Id, "sekret", false, 3, 2)], analytics.Sanitization);
    }

    [Theory]
    [InlineData("14d", "UTC", "range")]
    [InlineData("30d", "Central European Standard Time", "tz")]
    [InlineData("30d", "Mars/Olympus_Mons", "tz")]
    public async Task ZlyZakresAlboStrefaDajeBladWalidacji(string range, string tz, string field)
    {
        using var db = NewContext();
        var project = await NewProject(db);

        var result = await new ProjectAnalyticsController(db).Get(project.Id, CancellationToken.None, range, tz);

        var badRequest = Assert.IsType<ObjectResult>(result.Result);
        var problem = Assert.IsType<ValidationProblemDetails>(badRequest.Value);
        Assert.Contains(field, problem.Errors.Keys);
    }

    [Fact]
    public async Task NieznanyProjektDaje404()
    {
        using var db = NewContext();

        var result = await new ProjectAnalyticsController(db).Get(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }
}
