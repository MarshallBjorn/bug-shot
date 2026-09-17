using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class ProjectTicketsControllerTests
{
    private static BugShotDbContext NewContext()
    {
        var db = TestDatabase.OpenContext();
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

    // kolejne zgloszenia w odstepie minuty zeby kolejnosc byla jednoznaczna
    private static async Task<(BugShotDbContext Db, Guid ProjectId)> SeedSequenceAsync(int count)
    {
        var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var baseTime = new DateTimeOffset(2026, 9, 1, 8, 0, 0, TimeSpan.Zero);

        var tickets = Enumerable
            .Range(1, count)
            .Select(number => NewTicket(project.Id, $"zgloszenie {number}", baseTime.AddMinutes(number)))
            .ToList();

        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();

        for (var index = 0; index < tickets.Count; index++)
        {
            tickets[index].ReceivedAt = baseTime.AddMinutes(index + 1);
        }

        await db.SaveChangesAsync();

        return (db, project.Id);
    }

    private static CursorPage<TicketListItem> Page(ActionResult<CursorPage<TicketListItem>> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);

        return Assert.IsType<CursorPage<TicketListItem>>(ok.Value);
    }

    private static IReadOnlyList<string> Descriptions(ActionResult<CursorPage<TicketListItem>> result) =>
        Page(result).Items.Select(i => i.Description).ToList();

    private static int ProblemStatus(ActionResult<CursorPage<TicketListItem>> result)
    {
        var problem = Assert.IsType<ObjectResult>(result.Result);

        return problem.StatusCode ?? 0;
    }

    // numer statusu nadaje fabryka problemow w pelnym pipeline wiec nagi kontroler oddaje sam opis bledu
    private static IDictionary<string, string[]> ValidationErrors(ActionResult<CursorPage<TicketListItem>> result) =>
        Assert.IsType<ValidationProblemDetails>(Assert.IsType<ObjectResult>(result.Result).Value).Errors;

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

    [Theory]
    [InlineData("receivedAt:desc")]
    [InlineData("receivedAt:asc")]
    [InlineData("reportedAt:desc")]
    [InlineData("reportedAt:asc")]
    public async Task ChodzenieKursoremDajeTaSamaListeCoJednaStrona(string sort)
    {
        var (db, projectId) = await SeedSequenceAsync(5);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var jednaStrona = Descriptions(
            await controller.GetList(projectId, CancellationToken.None, sort: sort, limit: 100));

        var zebrane = new List<string>();
        string? cursor = null;
        var stron = 0;

        do
        {
            var page = Page(await controller.GetList(
                projectId,
                CancellationToken.None,
                sort: sort,
                cursor: cursor,
                limit: 2));

            zebrane.AddRange(page.Items.Select(i => i.Description));
            cursor = page.NextCursor;
            stron++;
        }
        while (cursor is not null && stron < 10);

        Assert.Equal(jednaStrona, zebrane);
        Assert.Equal(3, stron);
    }

    // ostatnia pelna strona nie moze oddac kursora prowadzacego w pustke
    [Fact]
    public async Task OstatniaPelnaStronaKonczySieBezKursora()
    {
        var (db, projectId) = await SeedSequenceAsync(4);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(projectId, CancellationToken.None, limit: 2));

        Assert.NotNull(pierwsza.NextCursor);

        var druga = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            cursor: pierwsza.NextCursor,
            limit: 2));

        Assert.Equal(2, druga.Items.Count);
        Assert.Null(druga.NextCursor);
    }

    // dopisanie zgloszenia miedzy stronami przesuwa OFFSET a kursora nie rusza
    [Fact]
    public async Task ZgloszenieDopisaneMiedzyStronamiNiePowtarzaAniNieGubiWiersza()
    {
        var (db, projectId) = await SeedSequenceAsync(4);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(projectId, CancellationToken.None, limit: 2));

        Assert.Equal(["zgloszenie 4", "zgloszenie 3"], pierwsza.Items.Select(i => i.Description));

        var swieze = NewTicket(projectId, "zgloszenie swieze", null);
        db.Tickets.Add(swieze);
        await db.SaveChangesAsync();

        var druga = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            cursor: pierwsza.NextCursor,
            limit: 2));

        Assert.Equal(["zgloszenie 2", "zgloszenie 1"], druga.Items.Select(i => i.Description));
        Assert.Null(druga.NextCursor);
    }

    [Fact]
    public async Task FiltrTrzymaSieKursoraMiedzyStronami()
    {
        var (db, projectId) = await SeedSequenceAsync(4);
        using var _ = db;

        var odrzucone = await db.Tickets.OrderBy(t => t.ReceivedAt).FirstAsync();
        odrzucone.Status = TicketStatus.Rejected;
        await db.SaveChangesAsync();

        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            status: "New",
            limit: 2));

        var druga = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            status: "New",
            cursor: pierwsza.NextCursor,
            limit: 2));

        Assert.Equal(["zgloszenie 4", "zgloszenie 3"], pierwsza.Items.Select(i => i.Description));
        Assert.Equal(["zgloszenie 2"], druga.Items.Select(i => i.Description));
        Assert.Null(druga.NextCursor);
    }

    [Fact]
    public async Task LicznikWszystkichPasujacychIdzieTylkoNaZadanie()
    {
        var (db, projectId) = await SeedSequenceAsync(5);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var bezLicznika = Page(await controller.GetList(projectId, CancellationToken.None, limit: 2));
        var zLicznikiem = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            limit: 2,
            withTotal: true));

        Assert.Null(bezLicznika.Total);
        Assert.Equal(5, zLicznikiem.Total);
        Assert.Equal(2, zLicznikiem.Items.Count);
    }

    // przy doladowaniu licznik nic nowego nie mowi wiec nie ma po co placic za COUNT
    [Fact]
    public async Task LicznikNieLiczySieDlaKolejnychStron()
    {
        var (db, projectId) = await SeedSequenceAsync(5);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            limit: 2,
            withTotal: true));

        var druga = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            cursor: pierwsza.NextCursor,
            limit: 2,
            withTotal: true));

        Assert.Equal(5, pierwsza.Total);
        Assert.Null(druga.Total);
    }

    [Fact]
    public async Task LicznikLiczyTylkoPasujaceDoFiltra()
    {
        var (db, projectId) = await SeedSequenceAsync(5);
        using var _ = db;

        var odrzucone = await db.Tickets.OrderBy(t => t.ReceivedAt).Take(2).ToListAsync();

        foreach (var ticket in odrzucone)
        {
            ticket.Status = TicketStatus.Rejected;
        }

        await db.SaveChangesAsync();

        var controller = new ProjectTicketsController(db);

        var poStatusie = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            status: "New",
            limit: 1,
            withTotal: true));

        var poFrazie = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            search: "zgloszenie 4",
            limit: 1,
            withTotal: true));

        Assert.Equal(3, poStatusie.Total);
        Assert.Equal(1, poFrazie.Total);
    }

    [Fact]
    public async Task ZepsutyKursorKonczySieNa400()
    {
        var (db, projectId) = await SeedSequenceAsync(2);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var result = await controller.GetList(projectId, CancellationToken.None, cursor: "nie-kursor");

        Assert.Equal(StatusCodes.Status400BadRequest, ProblemStatus(result));
    }

    // kursor z innego sortowania cicho oddalby zle wyniki
    [Fact]
    public async Task KursorZInnegoSortowaniaKonczySieNa400()
    {
        var (db, projectId) = await SeedSequenceAsync(4);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(projectId, CancellationToken.None, limit: 2));

        var result = await controller.GetList(
            projectId,
            CancellationToken.None,
            sort: "receivedAt:asc",
            cursor: pierwsza.NextCursor);

        Assert.Equal(StatusCodes.Status400BadRequest, ProblemStatus(result));
    }

    [Fact]
    public async Task LimitPozaZakresemWracaDoGranicy()
    {
        var (db, projectId) = await SeedSequenceAsync(3);
        using var _ = db;
        var controller = new ProjectTicketsController(db);

        var zero = Page(await controller.GetList(projectId, CancellationToken.None, limit: 0));
        var duzy = Page(await controller.GetList(projectId, CancellationToken.None, limit: 500));

        Assert.Single(zero.Items);
        Assert.Equal(3, duzy.Items.Count);
        Assert.Null(duzy.NextCursor);
    }

    [Fact]
    public async Task KursorNieWchodziMiedzyZgloszeniaOTejSamejDacie()
    {
        using var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var moment = new DateTimeOffset(2026, 9, 1, 10, 0, 0, TimeSpan.Zero);

        var tickets = Enumerable
            .Range(1, 4)
            .Select(number =>
            {
                var ticket = NewTicket(project.Id, $"rowne {number}", moment);
                ticket.Id = new Guid($"bbbbbbbb-0000-0000-0000-00000000000{number}");
                return ticket;
            })
            .ToList();

        db.Tickets.AddRange(tickets);
        await db.SaveChangesAsync();

        foreach (var ticket in tickets)
        {
            ticket.ReceivedAt = moment;
        }

        await db.SaveChangesAsync();

        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(project.Id, CancellationToken.None, limit: 2));
        var druga = Page(await controller.GetList(
            project.Id,
            CancellationToken.None,
            cursor: pierwsza.NextCursor,
            limit: 2));

        Assert.Equal(["rowne 1", "rowne 2"], pierwsza.Items.Select(i => i.Description));
        Assert.Equal(["rowne 3", "rowne 4"], druga.Items.Select(i => i.Description));
        Assert.Null(druga.NextCursor);
    }

    // osobny seed bo filtry potrzebuja adresu przegladarki zalacznika i komentarza a nie tylko czasu
    private static async Task<(BugShotDbContext Db, Guid ProjectId)> SeedFiltersAsync()
    {
        var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var baseTime = new DateTimeOffset(2026, 9, 10, 8, 0, 0, TimeSpan.Zero);

        Ticket Build(string description, string page, string browser, string os, string device, TicketStatus status) => new()
        {
            ProjectId = project.Id,
            Description = description,
            PageUrl = $"https://{page}?utm_source=mail",
            Page = page,
            UserAgent = "Mozilla/5.0",
            BrowserName = browser,
            OsName = os,
            DeviceType = device,
            Status = status
        };

        var koszyk = Build("koszyk gubi produkty", "acme.example/cart", "Chrome", "Windows", "desktop", TicketStatus.New);
        var kasa = Build("blad na kasie", "acme.example/checkout", "Firefox", "Linux", "desktop", TicketStatus.InProgress);
        var stopka = Build("literowka w stopce", "acme.example/cart", "Safari", "iOS", "mobile", TicketStatus.Resolved);

        db.Tickets.AddRange(koszyk, kasa, stopka);
        await db.SaveChangesAsync();

        koszyk.ReceivedAt = baseTime;
        kasa.ReceivedAt = baseTime.AddDays(1);
        stopka.ReceivedAt = baseTime.AddDays(2);

        db.TicketAttachments.Add(new TicketAttachment
        {
            TicketId = koszyk.Id,
            Kind = AttachmentKind.Screenshot,
            Uri = "/attachments/zrzut.png",
            FileName = "zrzut.png",
            ContentType = "image/png",
            SizeBytes = 128
        });

        db.TicketComments.Add(new TicketComment
        {
            TicketId = kasa.Id,
            Author = "bartek",
            Body = "sprawdzam"
        });

        await db.SaveChangesAsync();

        return (db, project.Id);
    }

    [Fact]
    public async Task StatusPrzyjmujeListePoPrzecinku()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var page = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            status: "New,Resolved",
            withTotal: true));

        Assert.Equal(2, page.Total);

        Assert.Equal(
            ["koszyk gubi produkty", "literowka w stopce"],
            page.Items.Select(i => i.Description).OrderBy(d => d, StringComparer.Ordinal));
    }

    [Fact]
    public async Task NieznanyStatusDaje400()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var result = await controller.GetList(projectId, CancellationToken.None, status: "New,Wymyslony");

        Assert.Contains("status", ValidationErrors(result).Keys);
    }

    [Fact]
    public async Task FiltrStronyPrzyjmujePelnyAdresZZapytaniem()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        // adres przechodzi ta sama normalizacje co przy przyjeciu wiec utm i kotwica nie psuja filtra
        var page = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            page: "https://Acme.example/Cart?utm_source=mail#top",
            withTotal: true));

        Assert.Equal(2, page.Total);
        Assert.All(page.Items, item => Assert.Equal("acme.example/cart", item.Page));
    }

    [Fact]
    public async Task FiltryPrzegladarkiSystemuIUrzadzeniaZawezajaLacznie()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var page = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            browser: "safari",
            os: "iOS",
            device: "mobile",
            withTotal: true));

        Assert.Equal(1, page.Total);
        Assert.Equal("literowka w stopce", Assert.Single(page.Items).Description);
    }

    [Fact]
    public async Task FiltryZrzutuIKomentarzyDzialajaWObieStrony()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var zeZrzutem = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            hasScreenshot: true,
            withTotal: true));

        var bezZrzutu = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            hasScreenshot: false,
            withTotal: true));

        var zKomentarzem = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            hasComments: true,
            withTotal: true));

        Assert.Equal(1, zeZrzutem.Total);
        Assert.Equal("koszyk gubi produkty", Assert.Single(zeZrzutem.Items).Description);
        Assert.Equal(2, bezZrzutu.Total);
        Assert.Equal(1, zKomentarzem.Total);
        Assert.Equal("blad na kasie", Assert.Single(zKomentarzem.Items).Description);
    }

    [Fact]
    public async Task ZakresDatObejmujePoczatekAleNieKoniec()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var page = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            dateFrom: new DateTimeOffset(2026, 9, 11, 0, 0, 0, TimeSpan.Zero),
            dateTo: new DateTimeOffset(2026, 9, 12, 0, 0, 0, TimeSpan.Zero),
            withTotal: true));

        Assert.Equal(1, page.Total);
        Assert.Equal("blad na kasie", Assert.Single(page.Items).Description);
    }

    [Fact]
    public async Task OdwroconyZakresDatDaje400()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var result = await controller.GetList(
            projectId,
            CancellationToken.None,
            dateFrom: new DateTimeOffset(2026, 9, 12, 0, 0, 0, TimeSpan.Zero),
            dateTo: new DateTimeOffset(2026, 9, 11, 0, 0, 0, TimeSpan.Zero));

        Assert.Contains("dateFrom", ValidationErrors(result).Keys);
    }

    [Fact]
    public async Task WierszListyNiesieStroneLicznikiIZrzut()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var page = Page(await controller.GetList(projectId, CancellationToken.None));

        var koszyk = Assert.Single(page.Items, i => i.Description == "koszyk gubi produkty");
        var kasa = Assert.Single(page.Items, i => i.Description == "blad na kasie");

        Assert.Equal("acme.example/cart", koszyk.Page);
        Assert.Equal("Chrome", koszyk.BrowserName);
        Assert.Equal("Windows", koszyk.OsName);
        Assert.Equal("desktop", koszyk.DeviceType);
        Assert.True(koszyk.HasScreenshot);
        Assert.Equal(0, koszyk.CommentCount);

        Assert.False(kasa.HasScreenshot);
        Assert.Equal(1, kasa.CommentCount);
    }

    [Fact]
    public async Task KursorTrzymaSieFiltraStronyMiedzyStronami()
    {
        var (db, projectId) = await SeedFiltersAsync();
        using var _ = db;

        var controller = new ProjectTicketsController(db);

        var pierwsza = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            page: "acme.example/cart",
            limit: 1));

        var druga = Page(await controller.GetList(
            projectId,
            CancellationToken.None,
            page: "acme.example/cart",
            cursor: pierwsza.NextCursor,
            limit: 1));

        Assert.Equal("literowka w stopce", Assert.Single(pierwsza.Items).Description);
        Assert.Equal("koszyk gubi produkty", Assert.Single(druga.Items).Description);
        Assert.Null(druga.NextCursor);
    }
}
