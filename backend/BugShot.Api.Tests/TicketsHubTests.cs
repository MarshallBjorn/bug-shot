using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BugShot.Api;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class TicketsHubTests : IDisposable
{
    private const string AdminEmail = "hub-admin@bug-shot.test";
    private const string AdminPassword = "bug-shot-admin-2026";
    private const string AllowedOrigin = "http://127.0.0.1:5500";
    private static readonly string HubPath = HubRoutes.Tickets.TrimStart('/');

    private static readonly string SigningKey = TestKeys.Signing();

    // zdarzenie leci przez petle sieciowa wiec czekanie ma miec gorna granice
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-hub-{Guid.NewGuid():N}");

    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public TicketsHubTests()
    {
        using (var db = TestDatabase.OpenContext())
        {
            db.Tickets.ExecuteDelete();
            db.Users.ExecuteDelete();
        }

        Directory.CreateDirectory(attachmentsPath);
        factory = new ApiFactory(attachmentsPath);
        client = factory.CreateClient();
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();
        Directory.Delete(attachmentsPath, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task NegocjacjaBezTokenaKonczySieNa401()
    {
        var response = await client.PostAsync($"/{HubPath}/negotiate?negotiateVersion=1", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // WebSocket nie ustawia naglowkow wiec token musi przejsc adresem
    [Fact]
    public async Task NegocjacjaZTokenemWAdresieDochodziDoSkutku()
    {
        var token = await SignIn();

        var response = await client.PostAsync(
            $"/{HubPath}/negotiate?negotiateVersion=1&access_token={token}",
            null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.False(string.IsNullOrWhiteSpace(payload.RootElement.GetProperty("connectionId").GetString()));
    }

    [Fact]
    public async Task TokenSpozaTejInstancjiNieWpuszczaNaHub()
    {
        var obcy = new AccessTokenIssuer(TestKeys.Signing()).Issue(
            new User { Id = Guid.NewGuid(), Email = AdminEmail, IsAdmin = true, IsActive = true });

        var response = await client.PostAsync(
            $"/{HubPath}/negotiate?negotiateVersion=1&access_token={obcy.Token}",
            null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task NoweZgloszenieDochodziDoSubskrybenta()
    {
        var projectId = await DemoProjectId();
        await using var connection = await Connect();

        var przyszlo = new TaskCompletionSource<TicketListItem>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<TicketListItem>("TicketCreated", ticket => przyszlo.TrySetResult(ticket));

        await connection.InvokeAsync("Subscribe", projectId);

        var created = await CreateTicket();
        var ticket = await Wait(przyszlo.Task);

        Assert.Equal(created.Id, ticket.Id);
        Assert.Equal("Koszyk gubi produkty", ticket.Description);
        Assert.Equal(TicketStatus.New, ticket.Status);
    }

    [Fact]
    public async Task ZmianaStatusuIKasowanieDochodzaDoSubskrybenta()
    {
        var projectId = await DemoProjectId();
        await using var connection = await Connect();

        var zmienione = new TaskCompletionSource<TicketListItem>(TaskCreationOptions.RunContinuationsAsynchronously);
        var skasowane = new TaskCompletionSource<Guid>(TaskCreationOptions.RunContinuationsAsynchronously);

        connection.On<TicketListItem>("TicketChanged", ticket => zmienione.TrySetResult(ticket));
        connection.On<Guid>("TicketDeleted", id => skasowane.TrySetResult(id));

        await connection.InvokeAsync("Subscribe", projectId);

        var created = await CreateTicket();
        var details = await client.GetFromJsonAsync<TicketDetails>($"/api/v1/tickets/{created.Id}");

        using var patch = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/tickets/{created.Id}/status")
        {
            Content = JsonContent.Create(new { status = "InProgress", changedBy = "bartek" })
        };

        patch.Headers.TryAddWithoutValidation("If-Match", details!.RowVersion);

        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(patch)).StatusCode);

        var ticket = await Wait(zmienione.Task);

        Assert.Equal(created.Id, ticket.Id);
        Assert.Equal(TicketStatus.InProgress, ticket.Status);

        Assert.Equal(
            HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/v1/tickets/{created.Id}")).StatusCode);

        Assert.Equal(created.Id, await Wait(skasowane.Task));
    }

    [Fact]
    public async Task ZdarzeniaInnegoProjektuNieDochodza()
    {
        await using var connection = await Connect();

        var przyszlo = new TaskCompletionSource<TicketListItem>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<TicketListItem>("TicketCreated", ticket => przyszlo.TrySetResult(ticket));

        await connection.InvokeAsync("Subscribe", Guid.NewGuid());
        await CreateTicket();

        var wygaslo = await Task.WhenAny(przyszlo.Task, Task.Delay(TimeSpan.FromSeconds(2)));

        Assert.NotSame(przyszlo.Task, wygaslo);
    }

    [Fact]
    public async Task ZdarzenieNieDochodziPoOdsubskrybowaniu()
    {
        var projectId = await DemoProjectId();
        await using var connection = await Connect();

        var przyszlo = new TaskCompletionSource<TicketListItem>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<TicketListItem>("TicketCreated", ticket => przyszlo.TrySetResult(ticket));

        await connection.InvokeAsync("Subscribe", projectId);
        await connection.InvokeAsync("Unsubscribe", projectId);
        await CreateTicket();

        var wygaslo = await Task.WhenAny(przyszlo.Task, Task.Delay(TimeSpan.FromSeconds(2)));

        Assert.NotSame(przyszlo.Task, wygaslo);
    }

    private async Task<HubConnection> Connect()
    {
        var token = await SignIn();

        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(client.BaseAddress!, HubPath), options =>
            {
                // serwer testowy nie wystawia WebSocketa wiec kanal idzie dlugim odpytywaniem
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                options.AccessTokenProvider = () => Task.FromResult<string?>(token);
            })
            .Build();

        await connection.StartAsync();

        return connection;
    }

    private static async Task<T> Wait<T>(Task<T> task)
    {
        var finished = await Task.WhenAny(task, Task.Delay(Timeout));

        Assert.Same(task, finished);

        return await task;
    }

    private async Task<string> SignIn()
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new { email = AdminEmail, password = AdminPassword });

        response.EnsureSuccessStatusCode();

        using var payload = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var token = payload.RootElement.GetProperty("accessToken").GetString();

        client.DefaultRequestHeaders.Authorization = new("Bearer", token);

        return token!;
    }

    private async Task<CreatedTicketResponse> CreateTicket()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/tickets")
        {
            Content = JsonContent.Create(new
            {
                projectKey = "demo",
                description = "Koszyk gubi produkty",
                pageUrl = "https://acme.example/cart",
                userAgent = "Mozilla/5.0"
            })
        };

        request.Headers.TryAddWithoutValidation("Origin", AllowedOrigin);

        var response = await client.SendAsync(request);

        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<CreatedTicketResponse>())!;
    }

    private static async Task<Guid> DemoProjectId()
    {
        using var db = TestDatabase.OpenContext();

        return await db.Projects.Where(p => p.Key == "demo").Select(p => p.Id).SingleAsync();
    }

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
