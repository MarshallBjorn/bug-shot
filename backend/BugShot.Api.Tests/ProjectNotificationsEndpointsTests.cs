using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class ProjectNotificationsEndpointsTests : IDisposable
{
    private const string AdminEmail = "admin@bug-shot.test";
    private const string AdminPassword = "bug-shot-admin-2026";
    private static readonly string SigningKey = TestKeys.Signing();

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-notif-{Guid.NewGuid():N}");

    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public ProjectNotificationsEndpointsTests()
    {
        using (var db = OpenContext())
        {
            db.Users.ExecuteDelete();
            db.NotificationChannels.ExecuteDelete();
        }

        Directory.CreateDirectory(attachmentsPath);
        factory = new ApiFactory(attachmentsPath);
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
        var response = await client.GetAsync(
            $"/api/v1/projects/{Guid.NewGuid()}/notifications");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task NonAdmin_ReturnsForbidden()
    {
        var developer = await CreateDeveloper();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", developer.AccessToken);

        var response = await client.GetAsync(
            $"/api/v1/projects/{Guid.NewGuid()}/notifications");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CrudOperations_WithAdmin_WorkAndHideSecret()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", admin.AccessToken);

        Guid projectId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;
        }

        var createRequest = new CreateNotificationChannelRequest(
            NotificationChannelType.Webhook,
            true,
            null,
            "https://example.com/webhook",
            "super-secret-key",
            null,
            null);

        var createResponse = await client.PostAsJsonAsync(
            $"/api/v1/projects/{projectId}/notifications",
            createRequest);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var createdChannel =
            await createResponse.Content.ReadFromJsonAsync<NotificationChannelResponse>();

        Assert.NotNull(createdChannel);
        Assert.Equal("https://example.com/webhook", createdChannel.WebhookUrl);

        using (var db = OpenContext())
        {
            var dbChannel = await db.NotificationChannels
                .SingleAsync(c => c.Id == createdChannel.Id);

            Assert.Equal("super-secret-key", dbChannel.WebhookSecret);
        }

        var getResponse = await client.GetAsync(
            $"/api/v1/projects/{projectId}/notifications");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var rawJson = await getResponse.Content.ReadAsStringAsync();

        Assert.DoesNotContain("super-secret-key", rawJson);
        Assert.DoesNotContain("webhookSecret", rawJson, StringComparison.OrdinalIgnoreCase);

        var updateRequest = new UpdateNotificationChannelRequest(
            false,
            null,
            "https://example.com/updated-webhook",
            null,
            null,
            null);

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/v1/projects/{projectId}/notifications/{createdChannel.Id}",
            updateRequest);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using (var db = OpenContext())
        {
            var dbChannel = await db.NotificationChannels
                .SingleAsync(c => c.Id == createdChannel.Id);

            Assert.Equal("super-secret-key", dbChannel.WebhookSecret);
            Assert.False(dbChannel.IsEnabled);
            Assert.Equal(
                "https://example.com/updated-webhook",
                dbChannel.WebhookUrl);
        }

        var deleteResponse = await client.DeleteAsync(
            $"/api/v1/projects/{projectId}/notifications/{createdChannel.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        using (var db = OpenContext())
        {
            Assert.False(
                await db.NotificationChannels.AnyAsync(
                    c => c.Id == createdChannel.Id));
        }
    }

    [Fact]
    public async Task CrossProjectUpdateOrDelete_ReturnsNotFound()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", admin.AccessToken);

        Guid projectAId;
        Guid projectBId;

        using (var db = OpenContext())
        {
            projectAId = db.Projects.Single(p => p.Key == "demo").Id;

            var projectB = new Project
            {
                Name = "Other",
                Key = $"other-{Guid.NewGuid():N}"
            };

            db.Projects.Add(projectB);
            await db.SaveChangesAsync();

            projectBId = projectB.Id;
        }

        var channel = new NotificationChannel
        {
            ProjectId = projectAId,
            Type = NotificationChannelType.Email,
            EmailAddress = "test@example.com"
        };

        using (var db = OpenContext())
        {
            db.NotificationChannels.Add(channel);
            await db.SaveChangesAsync();
        }

        var updateRequest = new UpdateNotificationChannelRequest(
            true,
            "new@example.com",
            null,
            null,
            null,
            null);

        var updateResponse = await client.PutAsJsonAsync(
            $"/api/v1/projects/{projectBId}/notifications/{channel.Id}",
            updateRequest);

        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);

        var deleteResponse = await client.DeleteAsync(
            $"/api/v1/projects/{projectBId}/notifications/{channel.Id}");

        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task ValidationRules_RejectBadEmailAndSsrfAndUnpairedThrottle()
    {
        var admin = await Read(await Login(client, AdminEmail, AdminPassword));
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", admin.AccessToken);

        Guid projectId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;
        }

        var badEmail = new CreateNotificationChannelRequest(
            NotificationChannelType.Email,
            true,
            "not-an-email",
            null,
            null,
            null,
            null);

        var emailResponse = await client.PostAsJsonAsync(
            $"/api/v1/projects/{projectId}/notifications",
            badEmail);

        Assert.Equal(HttpStatusCode.BadRequest, emailResponse.StatusCode);

        var ssrfHook = new CreateNotificationChannelRequest(
            NotificationChannelType.Webhook,
            true,
            null,
            "https://127.0.0.1/hook",
            null,
            null,
            null);

        var ssrfResponse = await client.PostAsJsonAsync(
            $"/api/v1/projects/{projectId}/notifications",
            ssrfHook);

        Assert.Equal(HttpStatusCode.BadRequest, ssrfResponse.StatusCode);

        var badThrottle = new CreateNotificationChannelRequest(
            NotificationChannelType.Email,
            true,
            "admin@example.com",
            null,
            null,
            3600,
            null);

        var throttleResponse = await client.PostAsJsonAsync(
            $"/api/v1/projects/{projectId}/notifications",
            badThrottle);

        Assert.Equal(HttpStatusCode.BadRequest, throttleResponse.StatusCode);
    }

    private async Task<Session> CreateDeveloper()
    {
        using (var db = OpenContext())
        {
            db.Users.Add(new User
            {
                Email = "dev@bug-shot.test",
                PasswordHash = PasswordHasher.Hash(AdminPassword),
                IsAdmin = false
            });

            await db.SaveChangesAsync();
        }

        var response = await Login(
            client,
            "dev@bug-shot.test",
            AdminPassword);

        return await Read(response);
    }

    private static Task<HttpResponseMessage> Login(
        HttpClient client,
        string email,
        string password) =>
        client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new { email, password });

    private static async Task<Session> Read(
        HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<Session>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web)))!;
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
        DateTimeOffset ExpiresAt,
        SessionUser User);

    private record SessionUser(
        Guid Id,
        string Email,
        bool IsAdmin,
        bool IsActive);

    private sealed class ApiFactory(string attachmentsPath)
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
        }
    }
}