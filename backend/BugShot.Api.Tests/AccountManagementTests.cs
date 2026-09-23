using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Notifications.Email;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public partial class AccountManagementTests : IDisposable
{
    private const string AdminEmail = "admin@bug-shot.test";
    private const string AdminPassword = "bug-shot-admin-2026";
    private const string NewPassword = "wlasne-haslo-z-linku";
    private const string Dashboard = "http://localhost:5173";

    private static readonly string SigningKey = TestKeys.Signing();

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-accounts-{Guid.NewGuid():N}");

    private readonly List<Guid> projects = [];

    private readonly RecordingEmailSender mail = new();

    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public AccountManagementTests()
    {
        using (var db = TestDatabase.OpenContext())
        {
            db.Users.ExecuteDelete();
        }

        Directory.CreateDirectory(attachmentsPath);
        factory = new ApiFactory(attachmentsPath, mail, seedAdmin: true);
        client = factory.CreateClient();
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();

        using (var db = TestDatabase.OpenContext())
        {
            db.Users.ExecuteDelete();
            db.Tickets.Where(t => projects.Contains(t.ProjectId)).ExecuteDelete();
            db.Projects.Where(p => projects.Contains(p.Id)).ExecuteDelete();
        }

        Directory.Delete(attachmentsPath, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task ZaproszenieWysylaMailZLinkiemKtoryUstawiaHasloIOtwieraSesje()
    {
        var admin = await AdminSession();
        var projectId = await NewProject();

        var created = await Send(HttpMethod.Post, "/api/v1/users", admin, new
        {
            email = "Nowa@Bug-Shot.test",
            isAdmin = false,
            projects = new[] { new { projectId, role = "Viewer" } }
        });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var body = await ReadJson(created);

        Assert.True(body.GetProperty("emailSent").GetBoolean());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("link").ValueKind);
        Assert.Equal("Invited", body.GetProperty("user").GetProperty("state").GetString());
        Assert.Equal("Viewer", body.GetProperty("user").GetProperty("projects")[0].GetProperty("role").GetString());

        var email = Assert.Single(mail.Sent);
        Assert.Equal("nowa@bug-shot.test", email.To);

        // konto bez hasla nie loguje sie niczym dopoki nie uzyje linku
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login("nowa@bug-shot.test", NewPassword)).StatusCode);

        var token = TokenFrom(email.Body);

        var info = await ReadJson(await client.PostAsJsonAsync("/api/v1/auth/account-token", new { token }));
        Assert.Equal("nowa@bug-shot.test", info.GetProperty("email").GetString());
        Assert.Equal("Invitation", info.GetProperty("purpose").GetString());

        var accepted = await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = NewPassword });

        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        Assert.Contains(accepted.Headers.GetValues("Set-Cookie"), c => c.StartsWith(RefreshToken.CookieName));
        Assert.Equal(HttpStatusCode.OK, (await Login("nowa@bug-shot.test", NewPassword)).StatusCode);

        // link dziala raz
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = "jeszcze-inne-haslo" })).StatusCode);
    }

    [Fact]
    public async Task LinkProwadziDoPaneluZKtoregoWyszloZaproszenie()
    {
        var admin = await AdminSession();

        await Send(HttpMethod.Post, "/api/v1/users", admin, new { email = "link@bug-shot.test", isAdmin = false });

        Assert.Contains($"{Dashboard}{AccountLinks.SetPasswordPath}#", Assert.Single(mail.Sent).Body);
    }

    [Fact]
    public async Task GdySmtpNieDzialaKontoPowstajeALinkWracaDoPanelu()
    {
        var admin = await AdminSession();
        mail.Fail = true;

        var created = await Send(HttpMethod.Post, "/api/v1/users", admin, new { email = "bez-maila@bug-shot.test", isAdmin = false });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var body = await ReadJson(created);

        Assert.False(body.GetProperty("emailSent").GetBoolean());

        var token = TokenFrom(body.GetProperty("link").GetString()!);

        Assert.Equal(
            HttpStatusCode.OK,
            (await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = NewPassword })).StatusCode);
    }

    [Fact]
    public async Task PonowneZaproszenieUniewaznaStaryLink()
    {
        var admin = await AdminSession();

        var user = await Invite(admin, "ponownie@bug-shot.test");
        var first = TokenFrom(mail.Sent.Last().Body);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/v1/users/{user}/invitation", admin)).StatusCode);

        var second = TokenFrom(mail.Sent.Last().Body);

        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/v1/auth/account-token", new { token = first })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/auth/account-token", new { token = second })).StatusCode);
    }

    [Fact]
    public async Task WygaslyLinkNieDziala()
    {
        var admin = await AdminSession();

        await Invite(admin, "wygasly@bug-shot.test");
        var token = TokenFrom(mail.Sent.Last().Body);

        using (var db = TestDatabase.OpenContext())
        {
            await db.UserTokens.ExecuteUpdateAsync(u => u.SetProperty(t => t.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = NewPassword })).StatusCode);
    }

    [Fact]
    public async Task ZaKrotkieHasloZLinkuJestOdrzucaneILinkDzialaDalej()
    {
        var admin = await AdminSession();

        await Invite(admin, "krotkie@bug-shot.test");
        var token = TokenFrom(mail.Sent.Last().Body);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = "krotkie" })).StatusCode);

        Assert.Equal(
            HttpStatusCode.OK,
            (await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = NewPassword })).StatusCode);
    }

    [Fact]
    public async Task ResetHaslaZostawiaStareHasloDoCzasuUstawieniaNowego()
    {
        var admin = await AdminSession();
        var user = await ActiveUser(admin, "reset@bug-shot.test");
        var oldRefresh = CookieValue(await Login("reset@bug-shot.test", NewPassword));

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/api/v1/users/{user}/reset-password", admin)).StatusCode);

        var email = mail.Sent.Last();
        Assert.Equal("Zmiana hasła w Bug-Shot", email.Subject);

        // sama prosba o reset nie wylacza nikogo z pracy
        Assert.Equal(HttpStatusCode.OK, (await Login("reset@bug-shot.test", NewPassword)).StatusCode);

        var token = TokenFrom(email.Body);

        Assert.Equal(
            HttpStatusCode.OK,
            (await client.PostAsJsonAsync("/api/v1/auth/set-password", new { token, password = "haslo-po-resecie-2026" })).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Login("reset@bug-shot.test", NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(oldRefresh)).StatusCode);
    }

    [Fact]
    public async Task ResetHaslaZaproszonegoKontaKonczySieNa409()
    {
        var admin = await AdminSession();
        var user = await Invite(admin, "bez-hasla@bug-shot.test");

        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/api/v1/users/{user}/reset-password", admin)).StatusCode);
    }

    [Fact]
    public async Task ZaproszoneKontoMoznaUsunacAAktywnegoNie()
    {
        var admin = await AdminSession();
        var invited = await Invite(admin, "do-usuniecia@bug-shot.test");
        var active = await ActiveUser(admin, "zostaje@bug-shot.test");

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/v1/users/{invited}", admin)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/api/v1/users/{active}", admin)).StatusCode);
    }

    [Fact]
    public async Task WylaczenieUniewaznaLinkAWlaczeniePrzywracaLogowanie()
    {
        var admin = await AdminSession();
        var invited = await Invite(admin, "wylaczony@bug-shot.test");
        var token = TokenFrom(mail.Sent.Last().Body);
        var active = await ActiveUser(admin, "wraca@bug-shot.test");

        await Send(HttpMethod.Patch, $"/api/v1/users/{invited}/deactivate", admin);
        await Send(HttpMethod.Patch, $"/api/v1/users/{active}/deactivate", admin);

        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/v1/auth/account-token", new { token })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Login("wraca@bug-shot.test", NewPassword)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Patch, $"/api/v1/users/{active}/activate", admin)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login("wraca@bug-shot.test", NewPassword)).StatusCode);
    }

    [Fact]
    public async Task OdebranieAdminaDzialaOdNastepnegoZadania()
    {
        var admin = await AdminSession();
        var second = await ActiveUser(admin, "drugi-admin@bug-shot.test", isAdmin: true);
        var secondSession = await Session("drugi-admin@bug-shot.test", NewPassword);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/v1/users", secondSession)).StatusCode);

        var demoted = await Send(HttpMethod.Patch, $"/api/v1/users/{second}", admin, new { isAdmin = false });
        Assert.Equal(HttpStatusCode.OK, demoted.StatusCode);

        // ten sam access token z rola admina juz nie wystarcza
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/v1/users", secondSession)).StatusCode);
    }

    [Fact]
    public async Task WlasnejRoliAdminaNieDaSieZmienic()
    {
        var admin = await AdminSession();
        var me = await Me(admin);

        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Patch, $"/api/v1/users/{me}", admin, new { isAdmin = false })).StatusCode);
    }

    [Fact]
    public async Task NieznanyProjektWZaproszeniuKonczySieBledemWalidacjiIBezKonta()
    {
        var admin = await AdminSession();

        var response = await Send(HttpMethod.Post, "/api/v1/users", admin, new
        {
            email = "zly-projekt@bug-shot.test",
            isAdmin = false,
            projects = new[] { new { projectId = Guid.NewGuid(), role = "Member" } }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(mail.Sent);

        using var db = TestDatabase.OpenContext();
        Assert.False(await db.Users.AnyAsync(u => u.Email == "zly-projekt@bug-shot.test"));
    }

    [Fact]
    public async Task ZmianaWlasnegoHaslaWymagaObecnegoIZamykaInneSesje()
    {
        var admin = await AdminSession();
        await ActiveUser(admin, "zmiana@bug-shot.test");

        var other = CookieValue(await Login("zmiana@bug-shot.test", NewPassword));
        var currentResponse = await Login("zmiana@bug-shot.test", NewPassword);
        var current = CookieValue(currentResponse);
        var session = (await ReadJson(currentResponse)).GetProperty("accessToken").GetString()!;

        var wrong = await Send(HttpMethod.Post, "/api/v1/auth/password", session, new
        {
            currentPassword = "to-nie-jest-moje-haslo",
            newPassword = "zupelnie-nowe-haslo-2026"
        });

        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/password")
        {
            Content = JsonContent.Create(new { currentPassword = NewPassword, newPassword = "zupelnie-nowe-haslo-2026" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session);
        request.Headers.Add("Cookie", $"{RefreshToken.CookieName}={current}");

        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(request)).StatusCode);

        // biezaca najpierw bo odswiezenie uniewaznionej sesji zamyka wszystkie jako podejrzenie kradziezy
        Assert.Equal(HttpStatusCode.OK, (await Refresh(current)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(other)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login("zmiana@bug-shot.test", "zupelnie-nowe-haslo-2026")).StatusCode);
    }

    [Fact]
    public async Task ViewerCzytaZgloszeniaAleNieZmieniaStatusu()
    {
        var admin = await AdminSession();
        var projectId = await NewProject();
        var ticketId = await NewTicket(projectId);

        await ActiveUser(admin, "viewer@bug-shot.test", projects: [new { projectId, role = "Viewer" }]);
        var viewer = await Session("viewer@bug-shot.test", NewPassword);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/v1/projects/{projectId}/tickets", viewer)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/v1/tickets/{ticketId}", viewer)).StatusCode);

        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Post, $"/api/v1/tickets/{ticketId}/comments", viewer, new { author = "viewer", body = "komentarz" })).StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Delete, $"/api/v1/tickets/{ticketId}", viewer)).StatusCode);
    }

    [Fact]
    public async Task MemberObrabiaZgloszeniaAleNieRuszaUstawienProjektu()
    {
        var admin = await AdminSession();
        var projectId = await NewProject();
        var ticketId = await NewTicket(projectId);

        await ActiveUser(admin, "member@bug-shot.test", projects: [new { projectId, role = "Member" }]);
        var member = await Session("member@bug-shot.test", NewPassword);

        Assert.Equal(
            HttpStatusCode.Created,
            (await Send(HttpMethod.Post, $"/api/v1/tickets/{ticketId}/comments", member, new { author = "member", body = "biore to" })).StatusCode);

        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Patch, $"/api/v1/projects/{projectId}", member, new { name = "Przejety" })).StatusCode);
    }

    [Fact]
    public async Task MaintainerZmieniaUstawieniaSwojegoProjektuAleNieZakladaNowych()
    {
        var admin = await AdminSession();
        var projectId = await NewProject();

        await ActiveUser(admin, "maintainer@bug-shot.test", projects: [new { projectId, role = "Maintainer" }]);
        var maintainer = await Session("maintainer@bug-shot.test", NewPassword);

        Assert.Equal(
            HttpStatusCode.OK,
            (await Send(HttpMethod.Patch, $"/api/v1/projects/{projectId}", maintainer, new { name = "Nowa nazwa" })).StatusCode);

        Assert.Equal(
            HttpStatusCode.Forbidden,
            (await Send(HttpMethod.Post, "/api/v1/projects", maintainer, new { name = "Swoj", key = $"swoj-{Guid.NewGuid():N}" })).StatusCode);
    }

    [Fact]
    public async Task CudzyProjektIJegoZgloszeniaOdpowiadajaJakNieistniejace()
    {
        var admin = await AdminSession();
        var mine = await NewProject();
        var foreign = await NewProject();
        var foreignTicket = await NewTicket(foreign);

        await ActiveUser(admin, "obcy@bug-shot.test", projects: [new { projectId = mine, role = "Member" }]);
        var session = await Session("obcy@bug-shot.test", NewPassword);

        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/projects/{foreign}/tickets", session)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/tickets/{foreignTicket}", session)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/projects/{foreign}/analytics", session)).StatusCode);

        var list = await ReadJson(await Send(HttpMethod.Get, "/api/v1/projects", session));

        var visible = Assert.Single(list.EnumerateArray());
        Assert.Equal(mine, visible.GetProperty("id").GetGuid());
        Assert.Equal("Member", visible.GetProperty("role").GetString());
    }

    [Fact]
    public async Task OdebranieProjektuDzialaOdNastepnegoZadania()
    {
        var admin = await AdminSession();
        var projectId = await NewProject();

        var user = await ActiveUser(admin, "traci@bug-shot.test", projects: [new { projectId, role = "Member" }]);
        var session = await Session("traci@bug-shot.test", NewPassword);

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, $"/api/v1/projects/{projectId}/tickets", session)).StatusCode);

        Assert.Equal(
            HttpStatusCode.OK,
            (await Send(HttpMethod.Put, $"/api/v1/users/{user}/projects", admin, Array.Empty<object>())).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, $"/api/v1/projects/{projectId}/tickets", session)).StatusCode);
    }

    [Fact]
    public async Task AdminWidziKazdyProjektJakoMaintainer()
    {
        var admin = await AdminSession();
        var projectId = await NewProject();

        var list = await ReadJson(await Send(HttpMethod.Get, "/api/v1/projects", admin));

        var project = list.EnumerateArray().Single(p => p.GetProperty("id").GetGuid() == projectId);
        Assert.Equal("Maintainer", project.GetProperty("role").GetString());
    }

    [Fact]
    public async Task ZEnvKreatorJestNiepotrzebny()
    {
        var status = await ReadJson(await client.GetAsync("/api/v1/auth/setup"));

        Assert.False(status.GetProperty("required").GetBoolean());
    }

    [Fact]
    public async Task BezEnvKreatorZakladaPierwszegoAdminaTokenemZLoguJedenRaz()
    {
        // domyslna fabryka juz zaseedowala admina wiec kreator dostaje pusta tabele i wlasna instancje
        using (var db = TestDatabase.OpenContext())
        {
            db.Users.ExecuteDelete();
        }

        using var setupFactory = new ApiFactory(attachmentsPath, mail, seedAdmin: false);
        using var setupClient = setupFactory.CreateClient();

        var status = await ReadJson(await setupClient.GetAsync("/api/v1/auth/setup"));
        Assert.True(status.GetProperty("required").GetBoolean());

        var token = setupFactory.Services.GetRequiredService<SetupToken>();

        var wrong = await setupClient.PostAsJsonAsync("/api/v1/auth/setup", new
        {
            token = "zgadywany-token",
            email = "pierwszy@bug-shot.test",
            password = NewPassword
        });

        Assert.Equal(HttpStatusCode.Forbidden, wrong.StatusCode);
        Assert.True(token.IsOpen);

        // prawdziwy token jest tylko w logu wiec test podmienia go na znany
        var known = token.Open();

        var created = await setupClient.PostAsJsonAsync("/api/v1/auth/setup", new
        {
            token = known,
            email = "Pierwszy@bug-shot.test",
            password = NewPassword
        });

        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        Assert.True((await ReadJson(created)).GetProperty("user").GetProperty("isAdmin").GetBoolean());

        var again = await setupClient.PostAsJsonAsync("/api/v1/auth/setup", new
        {
            token = known,
            email = "drugi@bug-shot.test",
            password = NewPassword
        });

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.False((await ReadJson(await setupClient.GetAsync("/api/v1/auth/setup"))).GetProperty("required").GetBoolean());
    }

    private async Task<Guid> Invite(string admin, string email, bool isAdmin = false, object[]? projects = null)
    {
        var response = await Send(HttpMethod.Post, "/api/v1/users", admin, new { email, isAdmin, projects });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return (await ReadJson(response)).GetProperty("user").GetProperty("id").GetGuid();
    }

    private async Task<Guid> ActiveUser(string admin, string email, bool isAdmin = false, object[]? projects = null)
    {
        var id = await Invite(admin, email, isAdmin, projects);

        var accepted = await client.PostAsJsonAsync(
            "/api/v1/auth/set-password",
            new { token = TokenFrom(mail.Sent.Last().Body), password = NewPassword });

        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);

        return id;
    }

    private async Task<Guid> NewProject()
    {
        using var db = TestDatabase.OpenContext();

        var project = new Project { Name = $"Dostep {Guid.NewGuid():N}", Key = $"dostep-{Guid.NewGuid():N}" };

        db.Projects.Add(project);
        await db.SaveChangesAsync();

        projects.Add(project.Id);

        return project.Id;
    }

    private static async Task<Guid> NewTicket(Guid projectId)
    {
        using var db = TestDatabase.OpenContext();

        var ticket = new Ticket
        {
            ProjectId = projectId,
            Description = "Zgloszenie do testu dostepu",
            PageUrl = "https://acme.example/cart",
            UserAgent = "Mozilla/5.0",
            Status = TicketStatus.New
        };

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();

        return ticket.Id;
    }

    private Task<string> AdminSession() => Session(AdminEmail, AdminPassword);

    private async Task<string> Session(string email, string password) =>
        (await ReadJson(await Login(email, password))).GetProperty("accessToken").GetString()!;

    private async Task<Guid> Me(string token) =>
        (await ReadJson(await Send(HttpMethod.Get, "/api/v1/auth/me", token))).GetProperty("id").GetGuid();

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = body is null ? null : JsonContent.Create(body)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("Origin", Dashboard);

        return client.SendAsync(request);
    }

    private Task<HttpResponseMessage> Login(string email, string password) =>
        client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });

    private Task<HttpResponseMessage> Refresh(string refreshToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        request.Headers.Add("Cookie", $"{RefreshToken.CookieName}={refreshToken}");

        return client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJson(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>(Json);
    }

    private static string CookieValue(HttpResponseMessage response)
    {
        var cookie = response.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith($"{RefreshToken.CookieName}=", StringComparison.Ordinal));

        return cookie[(RefreshToken.CookieName.Length + 1)..cookie.IndexOf(';')];
    }

    private static string TokenFrom(string text) => LinkToken().Match(text).Groups[1].Value;

    [GeneratedRegex(@"/set-password#([A-Za-z0-9_-]+)")]
    private static partial Regex LinkToken();

    private sealed class ApiFactory(string attachmentsPath, RecordingEmailSender mail, bool seedAdmin)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Storage:AttachmentsPath", attachmentsPath);
            builder.UseSetting("JWT_SIGNING_KEY", SigningKey);
            builder.UseSetting("Cors:WidgetOrigins:0", "http://127.0.0.1:5500");
            builder.UseSetting("Cors:DashboardOrigins:0", "http://127.0.0.1:4173");
            builder.UseSetting("Cors:DashboardOrigins:1", Dashboard);

            if (seedAdmin)
            {
                builder.UseSetting(AdminSeeder.EmailVariable, AdminEmail);
                builder.UseSetting(AdminSeeder.PasswordVariable, AdminPassword);
            }

            builder.ConfigureTestServices(services => services.AddSingleton<IEmailSender>(mail));
        }
    }
}
