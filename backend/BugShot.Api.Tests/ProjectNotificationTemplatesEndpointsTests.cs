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
public class ProjectNotificationTemplatesEndpointsTests : IDisposable
{
    private const string AdminEmail = "admin@bug-shot.test";
    private const string AdminPassword = "bug-shot-admin-2026";
    private static readonly string SigningKey = TestKeys.Signing();

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-templates-{Guid.NewGuid():N}");

    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public ProjectNotificationTemplatesEndpointsTests()
    {
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
    public async Task UnauthorizedWithoutToken_Returns401()
    {
        using var response = await client.GetAsync(
            $"/api/v1/projects/{Guid.NewGuid()}/templates");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetReturnsSeededTemplatesAndProjectOverride()
    {
        var session = await LoginAsAdmin();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session.AccessToken);

        Guid projectId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;
        }

        var getResponse = await client.GetAsync(
            $"/api/v1/projects/{projectId}/templates");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var before =
            await getResponse.Content.ReadFromJsonAsync<
                IReadOnlyList<NotificationTemplateResponse>>();

        Assert.NotNull(before);
        Assert.NotEmpty(before);
        Assert.Contains(
            before,
            template => template.ProjectId is null);

        var upsertRequest = new UpsertNotificationTemplateRequest(
            "Ticket {{ticket.id}}",
            "Custom description: {{ticket.description}}");

        var upsertResponse = await client.PutAsJsonAsync(
            $"/api/v1/projects/{projectId}/templates/TicketCreated/Email",
            upsertRequest);

        Assert.Equal(HttpStatusCode.OK, upsertResponse.StatusCode);

        var updated =
            await upsertResponse.Content.ReadFromJsonAsync<
                NotificationTemplateResponse>();

        Assert.NotNull(updated);
        Assert.Equal(projectId, updated.ProjectId);
        Assert.Equal("Ticket {{ticket.id}}", updated.Subject);
        Assert.Equal(
            "Custom description: {{ticket.description}}",
            updated.Body);

        var getAfterResponse = await client.GetAsync(
            $"/api/v1/projects/{projectId}/templates");

        Assert.Equal(HttpStatusCode.OK, getAfterResponse.StatusCode);

        var after =
            await getAfterResponse.Content.ReadFromJsonAsync<
                IReadOnlyList<NotificationTemplateResponse>>();

        Assert.NotNull(after);

        var resolved = Assert.Single(
            after,
            template =>
                template.EventType == NotificationEventType.TicketCreated
                && template.ChannelType == NotificationChannelType.Email);

        Assert.Equal(projectId, resolved.ProjectId);
        Assert.Equal("Ticket {{ticket.id}}", resolved.Subject);
        Assert.Equal(
            "Custom description: {{ticket.description}}",
            resolved.Body);
    }

    [Fact]
    public async Task UpsertUpdatesExistingProjectOverride()
    {
        var session = await LoginAsAdmin();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session.AccessToken);

        Guid projectId;

        using (var db = OpenContext())
        {
            projectId = db.Projects.Single(p => p.Key == "demo").Id;
        }

        var first = new UpsertNotificationTemplateRequest(
            "First {{ticket.id}}",
            "First body");

        var firstResponse = await client.PutAsJsonAsync(
            $"/api/v1/projects/{projectId}/templates/CommentAdded/Webhook",
            first);

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        var firstTemplate =
            await firstResponse.Content.ReadFromJsonAsync<
                NotificationTemplateResponse>();

        Assert.NotNull(firstTemplate);

        var second = new UpsertNotificationTemplateRequest(
            "Second {{ticket.id}}",
            "Second {{ticket.description}}");

        var secondResponse = await client.PutAsJsonAsync(
            $"/api/v1/projects/{projectId}/templates/CommentAdded/Webhook",
            second);

        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        var secondTemplate =
            await secondResponse.Content.ReadFromJsonAsync<
                NotificationTemplateResponse>();

        Assert.NotNull(secondTemplate);
        Assert.Equal(firstTemplate.Id, secondTemplate.Id);
        Assert.Equal("Second {{ticket.id}}", secondTemplate.Subject);
        Assert.Equal(
            "Second {{ticket.description}}",
            secondTemplate.Body);

        using var dbCheck = OpenContext();

        var stored = await dbCheck.NotificationTemplates
            .SingleAsync(t => t.Id == firstTemplate.Id);

        Assert.Equal("Second {{ticket.id}}", stored.Subject);
        Assert.Equal(
            "Second {{ticket.description}}",
            stored.Body);
    }

    [Fact]
    public async Task UnknownProject_Returns404()
    {
        var session = await LoginAsAdmin();

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var request = new UpsertNotificationTemplateRequest(
            "Subject",
            "Body");

        var response = await client.PutAsJsonAsync(
            $"/api/v1/projects/{Guid.NewGuid()}/templates/TicketCreated/Email",
            request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<Session> LoginAsAdmin()
    {
        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/login",
            new
            {
                email = AdminEmail,
                password = AdminPassword
            });

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