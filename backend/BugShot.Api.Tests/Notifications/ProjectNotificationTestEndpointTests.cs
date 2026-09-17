using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Notifications;
using BugShot.Api.Notifications.Webhooks;
using BugShot.Api.Security;
using BugShot.Api.Tests;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace BugShot.Api.Tests.Notifications;

// Pokrywa POST /api/v1/projects/{projectId}/notifications/{channelId}/test.
// Wczesniej ten endpoint (uzywany przez AC6 "Wyslij testowe zdarzenie") nie mial
// zadnego testu integracyjnego/HTTP - tylko RTL po stronie frontendu.
[Collection("PostgreSQL tests")]
public class ProjectNotificationTestEndpointTests : IDisposable
{
    private const string AdminEmail = "admin@bug-shot.test";
    private const string AdminPassword = "bug-shot-admin-2026";
    private static readonly string SigningKey = TestKeys.Signing();

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-notif-test-{Guid.NewGuid():N}");

    private readonly FakeWebhookSender webhookSender = new();
    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public ProjectNotificationTestEndpointTests()
    {
        using (var db = OpenContext())
        {
            db.Users.ExecuteDelete();
            db.NotificationChannels.ExecuteDelete();
        }

        Directory.CreateDirectory(attachmentsPath);
        factory = new ApiFactory(attachmentsPath, webhookSender);
        client = factory.CreateClient();
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();

        using (var db = OpenContext())
        {
            db.Users.ExecuteDelete();
            db.NotificationChannels.ExecuteDelete();
        }

        Directory.Delete(attachmentsPath, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task UnauthorizedWithoutToken_Returns401()
    {
        var (projectId, channelId) = await SeedWebhookChannelAsync(isEnabled: true);

        var response = await client.PostAsync(
            $"/api/v1/projects/{projectId}/notifications/{channelId}/test",
            null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(webhookSender.SentWebhooks);
    }

    [Fact]
    public async Task WebhookChannel_Enabled_SendsWellFormedTestPayload()
    {
        await AuthenticateAsAdmin();
        var (projectId, channelId) = await SeedWebhookChannelAsync(isEnabled: true);

        var start = DateTimeOffset.UtcNow;

        var response = await client.PostAsync(
            $"/api/v1/projects/{projectId}/notifications/{channelId}/test",
            null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var sent = Assert.Single(webhookSender.SentWebhooks);
        Assert.Equal("https://example.com/webhook", sent.Url);

        using var json = JsonDocument.Parse(sent.Payload);
        var root = json.RootElement;

        // Kazde pole musi byc obecne i sensowne - to jest dokladnie kontrakt
        // ktory admin panel pokazuje jako "test event".
        Assert.True(root.TryGetProperty("eventId", out var eventId));
        Assert.NotEqual(Guid.Empty, eventId.GetGuid());

        Assert.Equal("test", root.GetProperty("eventType").GetString());
        Assert.Equal(projectId, root.GetProperty("projectId").GetGuid());

        Assert.False(
            string.IsNullOrWhiteSpace(root.GetProperty("message").GetString()));

        var createdAt = root.GetProperty("createdAt").GetDateTimeOffset();
        Assert.InRange(createdAt, start.AddSeconds(-5), DateTimeOffset.UtcNow.AddSeconds(5));

        // Payload nie moze zawierac surowych placeholderow ani sekretu kanalu.
        Assert.DoesNotContain("{{", sent.Payload, StringComparison.Ordinal);
        Assert.DoesNotContain("super-secret", sent.Payload, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task WebhookChannel_Disabled_ReturnsValidationProblemAndDoesNotSend()
    {
        await AuthenticateAsAdmin();
        var (projectId, channelId) = await SeedWebhookChannelAsync(isEnabled: false);

        var response = await client.PostAsync(
            $"/api/v1/projects/{projectId}/notifications/{channelId}/test",
            null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(webhookSender.SentWebhooks);
    }

    [Fact]
    public async Task EmailChannel_ReturnsValidationProblemAndDoesNotSend()
    {
        await AuthenticateAsAdmin();

        Guid projectId;
        Guid channelId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;

            var channel = new NotificationChannel
            {
                ProjectId = projectId,
                Type = NotificationChannelType.Email,
                IsEnabled = true,
                EmailAddress = "admin@example.com"
            };

            db.NotificationChannels.Add(channel);
            await db.SaveChangesAsync();

            channelId = channel.Id;
        }

        var response = await client.PostAsync(
            $"/api/v1/projects/{projectId}/notifications/{channelId}/test",
            null);

        // Test event jest webhook-only - email channel musi byc odrzucony,
        // nie po cichu zignorowany.
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(webhookSender.SentWebhooks);
    }

    [Fact]
    public async Task UnknownChannel_ReturnsNotFound()
    {
        await AuthenticateAsAdmin();

        Guid projectId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;
        }

        var response = await client.PostAsync(
            $"/api/v1/projects/{projectId}/notifications/{Guid.NewGuid()}/test",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(webhookSender.SentWebhooks);
    }

    [Fact]
    public async Task ChannelFromOtherProject_ReturnsNotFound()
    {
        await AuthenticateAsAdmin();
        var (_, channelId) = await SeedWebhookChannelAsync(isEnabled: true);

        Guid otherProjectId;

        using (var db = OpenContext())
        {
            var otherProject = new Project
            {
                Name = "Other",
                Key = $"other-{Guid.NewGuid():N}"
            };

            db.Projects.Add(otherProject);
            await db.SaveChangesAsync();

            otherProjectId = otherProject.Id;
        }

        var response = await client.PostAsync(
            $"/api/v1/projects/{otherProjectId}/notifications/{channelId}/test",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(webhookSender.SentWebhooks);
    }

    private async Task AuthenticateAsAdmin()
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new { email = AdminEmail, password = AdminPassword });

        response.EnsureSuccessStatusCode();

        var session = await response.Content.ReadFromJsonAsync<Session>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session!.AccessToken);
    }

    private async Task<(Guid ProjectId, Guid ChannelId)> SeedWebhookChannelAsync(
        bool isEnabled)
    {
        Guid projectId;
        Guid channelId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;

            var channel = new NotificationChannel
            {
                ProjectId = projectId,
                Type = NotificationChannelType.Webhook,
                IsEnabled = isEnabled,
                WebhookUrl = "https://example.com/webhook",
                WebhookSecret = "super-secret-test-value"
            };

            db.NotificationChannels.Add(channel);
            await db.SaveChangesAsync();

            channelId = channel.Id;
        }

        return (projectId, channelId);
    }

    private static BugShotDbContext OpenContext()
    {
        var connectionString =
            Environment.GetEnvironmentVariable(
                "ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings__DefaultConnection is not configured.");

        var options = new DbContextOptionsBuilder<BugShotDbContext>()
            .UseNpgsql(
                connectionString,
                npgsql =>
                {
                    npgsql.MapEnum<TicketStatus>("ticket_status");
                    npgsql.MapEnum<AttachmentKind>("attachment_kind");
                    npgsql.MapEnum<NotificationChannelType>(
                        "notification_channel_type");
                    npgsql.MapEnum<NotificationEventType>(
                        "notification_event_type");
                    npgsql.MapEnum<NotificationDeliveryStatus>(
                        "notification_delivery_status");
                })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BugShotDbContext(options);
    }

    private record Session(
        string AccessToken,
        DateTimeOffset ExpiresAt);

    private sealed class ApiFactory(
        string attachmentsPath,
        IWebhookSender webhookSender)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting(
                "Storage:AttachmentsPath",
                attachmentsPath);

            builder.UseSetting(
                "JWT_SIGNING_KEY",
                SigningKey);

            builder.UseSetting(
                AdminSeeder.EmailVariable,
                AdminEmail);

            builder.UseSetting(
                AdminSeeder.PasswordVariable,
                AdminPassword);

            // Real WebhookSender wykonuje prawdziwe HTTP - w tym pliku
            // podmieniamy go, bo testujemy wylacznie kontrakt endpointu
            // (co dokladnie wychodzi do IWebhookSender), a nie SSRF/HTTP stack,
            // ktory ma juz osobne pokrycie w SsrfProtectionTests.
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IWebhookSender>();
                services.AddSingleton(webhookSender);
            });
        }
    }

    private sealed class FakeWebhookSender : IWebhookSender
    {
        public List<(string Url, string Payload)> SentWebhooks { get; } = [];

        public Task SendWebhookAsync(
            string url,
            string? secret,
            Guid deliveryId,
        string eventType,
        string payload,
            CancellationToken cancellationToken)
        {
            SentWebhooks.Add((url, payload));
            return Task.CompletedTask;
        }
    }
}
