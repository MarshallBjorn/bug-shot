using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class AuthEndpointsTests : IDisposable
{
    private const string AdminEmail = "admin@bug-shot.test";
    private const string AdminPassword = "bug-shot-admin-2026";
    private const string DeveloperEmail = "dev@bug-shot.test";

    private static readonly string SigningKey = TestKeys.Signing();
    private const string AllowedOrigin = "http://127.0.0.1:5500";

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-auth-{Guid.NewGuid():N}");

    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public AuthEndpointsTests()
    {
        // seed admina dziala tylko na pustej tabeli wiec czyscimy ja przed startem aplikacji
        using (var db = TestDatabase.OpenContext())
        {
            db.Users.ExecuteDelete();
        }

        Directory.CreateDirectory(attachmentsPath);
        factory = new ApiFactory(attachmentsPath);

        // klient stawia aplikacje wiec musi powstac zanim test dolozy wlasnych uzytkownikow
        client = factory.CreateClient();
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();

        // konta z testow zostawione w bazie blokuja seed admina przy nastepnym starcie API
        using (var db = TestDatabase.OpenContext())
        {
            db.Users.ExecuteDelete();
        }

        Directory.Delete(attachmentsPath, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task LogowanieZwracaTokenICookieZRefreshem()
    {
        var response = await Login(client, AdminEmail, AdminPassword);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var session = await Read(response);

        Assert.False(string.IsNullOrWhiteSpace(session.AccessToken));
        Assert.Equal(AdminEmail, session.User.Email);
        Assert.True(session.User.IsAdmin);

        // kwadrans z karty liczony od wystawienia tokena
        Assert.InRange(session.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(14), DateTimeOffset.UtcNow.AddMinutes(16));

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));

        Assert.StartsWith($"{RefreshToken.CookieName}=", cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains($"path={RefreshToken.CookiePath}", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SeedAdminaBierzeDaneZEnvIHashujeBcryptemZKosztem12()
    {
        using var db = TestDatabase.OpenContext();

        var admin = await db.Users.SingleAsync(u => u.Email == AdminEmail);

        Assert.True(admin.IsAdmin);
        Assert.True(admin.IsActive);
        Assert.StartsWith("$2", admin.PasswordHash);
        Assert.Contains("$12$", admin.PasswordHash);
        Assert.NotEqual(AdminPassword, admin.PasswordHash);
    }

    [Fact]
    public async Task ZleHasloINieznanyAdresOdpowiadajaTakSamo()
    {
        var wrongPassword = await Login(client, AdminEmail, "zupelnie-inne-haslo");
        var unknownEmail = await Login(client, "nikt@bug-shot.test", AdminPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);

        // identyczna tresc bledu bo inaczej odpowiedz mowi ktore konta istnieja
        Assert.Equal(await Title(wrongPassword), await Title(unknownEmail));
        Assert.False(unknownEmail.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task ChronionyEndpointBezTokenaZwraca401()
    {
        var response = await client.GetAsync($"/api/v1/tickets/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ChronionyEndpointZTokenemDziala()
    {
        var session = await Read(await Login(client, AdminEmail, AdminPassword));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        // nieistniejace zgloszenie ma odpowiedziec 404 a nie 401
        var response = await client.GetAsync($"/api/v1/tickets/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ZgloszenieZWidgetuPrzechodziBezTokena()
    {
        using (var db = TestDatabase.OpenContext())
        {
            db.Tickets.ExecuteDelete();
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/tickets")
        {
            Content = JsonContent.Create(new
            {
                projectKey = "demo",
                description = "Zgloszenie z widgetu bez logowania",
                pageUrl = "https://acme.example/cart",
                userAgent = "Mozilla/5.0"
            })
        };

        request.Headers.Add("Origin", AllowedOrigin);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task RefreshRotujeTokenAStaryPrzestajeDzialac()
    {
        var login = await Login(client, AdminEmail, AdminPassword);
        var first = CookieValue(login);

        var rotated = await Refresh(client, first);

        Assert.Equal(HttpStatusCode.OK, rotated.StatusCode);

        var second = CookieValue(rotated);

        Assert.NotEqual(first, second);

        var replayed = await Refresh(client, first);

        Assert.Equal(HttpStatusCode.Unauthorized, replayed.StatusCode);

        // nowy token zostaje wazny bo powtorka przyszla w oknie na duble z panelu
        Assert.Equal(HttpStatusCode.OK, (await Refresh(client, second)).StatusCode);
    }

    [Fact]
    public async Task WylogowanieUniewazniaRefreshICzysciCookie()
    {
        var refresh = CookieValue(await Login(client, AdminEmail, AdminPassword));

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        request.Headers.Add("Cookie", $"{RefreshToken.CookieName}={refresh}");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains(
            "expires=Thu, 01 Jan 1970",
            Assert.Single(response.Headers.GetValues("Set-Cookie")),
            StringComparison.OrdinalIgnoreCase);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, refresh)).StatusCode);
    }

    [Fact]
    public async Task PanelUserowJestTylkoDlaAdmina()
    {
        var developer = await CreateDeveloper();
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));

        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Get, "/api/v1/users", developer.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/v1/users", admin.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/users")).StatusCode);
    }

    [Fact]
    public async Task DezaktywacjaZamykaSesjeIBlokujeLogowanie()
    {
        var developer = await CreateDeveloper();
        var developerRefresh = CookieValue(await Login(client, DeveloperEmail, AdminPassword));
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));

        var deactivated = await Send(
            HttpMethod.Patch,
            $"/api/v1/users/{developer.User.Id}/deactivate",
            admin.AccessToken);

        Assert.Equal(HttpStatusCode.NoContent, deactivated.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, developerRefresh)).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await Login(client, DeveloperEmail, AdminPassword)).StatusCode);
    }

    [Fact]
    public async Task AdminNieMozeDezaktywowacSamegoSiebie()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));

        var response = await Send(
            HttpMethod.Patch,
            $"/api/v1/users/{admin.User.Id}/deactivate",
            admin.AccessToken);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task ZalacznikBezTokenaNieWychodziAZTokenemTak()
    {
        Guid attachmentId;

        using (var db = TestDatabase.OpenContext())
        {
            db.Tickets.ExecuteDelete();

            var ticket = new Ticket
            {
                ProjectId = new Guid("11111111-1111-1111-1111-111111111111"),
                Description = "Zgloszenie z zalacznikiem",
                PageUrl = "https://acme.example/cart",
                UserAgent = "Mozilla/5.0",
                Status = TicketStatus.New
            };

            var attachment = new TicketAttachment
            {
                Ticket = ticket,
                Kind = AttachmentKind.Screenshot,
                Uri = "/attachments/zrzut.png",
                FileName = "zrzut.png",
                ContentType = "image/png",
                SizeBytes = 3
            };

            db.Tickets.Add(ticket);
            db.TicketAttachments.Add(attachment);

            await db.SaveChangesAsync();

            attachmentId = attachment.Id;
        }

        await File.WriteAllTextAsync(Path.Combine(attachmentsPath, "zrzut.png"), "png");

        var path = $"/api/v1/attachments/{attachmentId}/download";

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);

        var session = await Read(await Login(client, AdminEmail, AdminPassword));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var response = await client.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("png", await response.Content.ReadAsStringAsync());
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition!.DispositionType);

        // bez tego kopia zostaje w cache przegladarki i wychodzi z niego przy zadaniu bez tokena
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.True(response.Headers.CacheControl.Private);
    }

    [Fact]
    public async Task PowtorzonyTokenPoOknieNaDubleZamykaWszystkieSesje()
    {
        var first = CookieValue(await Login(client, AdminEmail, AdminPassword));
        var second = CookieValue(await Refresh(client, first));

        // cofamy moment zuzycia poza okno na duble z panelu
        using (var db = TestDatabase.OpenContext())
        {
            await db.UserRefreshTokens
                .Where(t => t.UsedAt != null)
                .ExecuteUpdateAsync(update => update.SetProperty(
                    t => t.UsedAt,
                    DateTimeOffset.UtcNow.AddMinutes(-5)));
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, first)).StatusCode);

        // token wystawiony w zamian tez przepada bo nie wiadomo kto trzyma ktory
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, second)).StatusCode);
    }

    [Fact]
    public async Task WygasnietyTokenOdswiezajacyNieDziala()
    {
        var refresh = CookieValue(await Login(client, AdminEmail, AdminPassword));

        using (var db = TestDatabase.OpenContext())
        {
            await db.UserRefreshTokens
                .Where(t => t.UsedAt == null)
                .ExecuteUpdateAsync(update => update.SetProperty(
                    t => t.ExpiresAt,
                    DateTimeOffset.UtcNow.AddMinutes(-1)));
        }

        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, refresh)).StatusCode);
    }

    [Fact]
    public async Task ZalozoneKontoMozeSieZalogowac()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));

        var created = await Send(
            HttpMethod.Post,
            "/api/v1/users",
            admin.AccessToken,
            new { email = "NOWY@Bug-Shot.test", password = "wystarczajaco-dlugie-haslo", isAdmin = false });

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        // adres trafia do bazy malymi literami wiec logowanie dziala niezaleznie od wielkosci liter
        var session = await Read(await Login(client, "Nowy@bug-shot.TEST", "wystarczajaco-dlugie-haslo"));

        Assert.Equal("nowy@bug-shot.test", session.User.Email);
        Assert.False(session.User.IsAdmin);
    }

    [Fact]
    public async Task DrugieKontoNaTenSamAdresJestOdrzucane()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));
        var body = new { email = "duplikat@bug-shot.test", password = "wystarczajaco-dlugie-haslo", isAdmin = false };

        Assert.Equal(
            HttpStatusCode.Created,
            (await Send(HttpMethod.Post, "/api/v1/users", admin.AccessToken, body)).StatusCode);

        Assert.Equal(
            HttpStatusCode.Conflict,
            (await Send(HttpMethod.Post, "/api/v1/users", admin.AccessToken, body)).StatusCode);
    }

    [Fact]
    public async Task ZaKrotkieHasloNieZakladaKonta()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));

        var response = await Send(
            HttpMethod.Post,
            "/api/v1/users",
            admin.AccessToken,
            new { email = "krotkie@bug-shot.test", password = "krotkie", isAdmin = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var db = TestDatabase.OpenContext();

        Assert.False(await db.Users.AnyAsync(u => u.Email == "krotkie@bug-shot.test"));
    }

    [Fact]
    public async Task ZwyklyUzytkownikNieZakladaKont()
    {
        var developer = await CreateDeveloper();

        var response = await Send(
            HttpMethod.Post,
            "/api/v1/users",
            developer.AccessToken,
            new { email = "ktos@bug-shot.test", password = "wystarczajaco-dlugie-haslo", isAdmin = true });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ResetHaslaUniewazniaStareHasloISesje()
    {
        var developer = await CreateDeveloper();
        var developerRefresh = CookieValue(await Login(client, DeveloperEmail, AdminPassword));
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));

        var reset = await Send(
            HttpMethod.Post,
            $"/api/v1/users/{developer.User.Id}/reset-password",
            admin.AccessToken,
            new { password = "zupelnie-nowe-dlugie-haslo" });

        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, DeveloperEmail, AdminPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(client, developerRefresh)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Login(client, DeveloperEmail, "zupelnie-nowe-dlugie-haslo")).StatusCode);
    }

    [Fact]
    public async Task WylaczonyAdminNieDzialaNaZadnymEndpoincie()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));
        var drugi = await CreateAdmin("drugi-admin@bug-shot.test");

        // token dostal dopiero co wiec jest wazny jeszcze kwadrans
        Assert.Equal(
            HttpStatusCode.OK,
            (await Send(HttpMethod.Get, "/api/v1/auth/me", drugi.AccessToken)).StatusCode);

        await Send(HttpMethod.Patch, $"/api/v1/users/{drugi.User.Id}/deactivate", admin.AccessToken);

        // access token zyje jeszcze kwadrans wiec kazdy endpoint musi sam sprawdzic czy konto nadal istnieje
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await Send(HttpMethod.Get, "/api/v1/auth/me", drugi.AccessToken)).StatusCode);

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await Send(HttpMethod.Get, "/api/v1/users", drugi.AccessToken)).StatusCode);

        // bez tego wylaczony administrator zakladal sobie nowe konto i wracal nim po wygasnieciu tokena
        var body = new { email = "tylne-drzwi@bug-shot.test", password = "konto-po-wylaczeniu", isAdmin = true };

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await Send(HttpMethod.Post, "/api/v1/users", drugi.AccessToken, body)).StatusCode);
    }

    [Fact]
    public async Task NieznanyZalacznikZTokenemDaje404()
    {
        var session = await Read(await Login(client, AdminEmail, AdminPassword));

        var response = await Send(
            HttpMethod.Get,
            $"/api/v1/attachments/{Guid.NewGuid()}/download",
            session.AccessToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<Session> CreateAdmin(string email)
    {
        using (var db = TestDatabase.OpenContext())
        {
            db.Users.Add(new User
            {
                Email = email,
                PasswordHash = PasswordHasher.Hash(AdminPassword),
                IsAdmin = true
            });

            await db.SaveChangesAsync();
        }

        return await Read(await Login(client, email, AdminPassword));
    }

    private async Task<Session> CreateDeveloper()
    {
        using (var db = TestDatabase.OpenContext())
        {
            db.Users.Add(new User
            {
                Email = DeveloperEmail,
                PasswordHash = PasswordHasher.Hash(AdminPassword),
                IsAdmin = false
            });

            await db.SaveChangesAsync();
        }

        return await Read(await Login(client, DeveloperEmail, AdminPassword));
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, string token, object? body = null)
    {
        var request = new HttpRequestMessage(method, path)
        {
            Content = body is null ? null : JsonContent.Create(body)
        };

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        return client.SendAsync(request);
    }

    private static Task<HttpResponseMessage> Login(HttpClient client, string email, string password) =>
        client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });

    private static Task<HttpResponseMessage> Refresh(HttpClient client, string refreshToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        request.Headers.Add("Cookie", $"{RefreshToken.CookieName}={refreshToken}");

        return client.SendAsync(request);
    }

    // traceId jest inne w kazdej odpowiedzi wiec porownujemy sam opis bledu
    private static async Task<string?> Title(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ProblemDetails>())?.Title;

    private static async Task<Session> Read(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<Session>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web)))!;
    }

    private static string CookieValue(HttpResponseMessage response)
    {
        var cookie = response.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith($"{RefreshToken.CookieName}=", StringComparison.Ordinal));

        return cookie[(RefreshToken.CookieName.Length + 1)..cookie.IndexOf(';')];
    }

    private record Session(string AccessToken, DateTimeOffset ExpiresAt, SessionUser User);

    private record SessionUser(Guid Id, string Email, bool IsAdmin, bool IsActive);

    // aplikacja stawiana tak jak w compose czyli caly pipeline razem z autoryzacja
    private sealed class ApiFactory(string attachmentsPath) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Storage:AttachmentsPath", attachmentsPath);
            builder.UseSetting("JWT_SIGNING_KEY", SigningKey);
            builder.UseSetting(AdminSeeder.EmailVariable, AdminEmail);
            builder.UseSetting(AdminSeeder.PasswordVariable, AdminPassword);
            builder.UseSetting("Cors:WidgetOrigins:0", AllowedOrigin);
            builder.UseSetting("Cors:DashboardOrigins:0", "http://localhost:5173");
        }
    }
}
