using System.Net;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class WidgetCorsTests : IDisposable
{
    private const string ConfiguredOrigin = "http://127.0.0.1:5500";
    private const string ProjectOrigin = "http://127.0.0.1:5599";

    private static readonly string SigningKey = TestKeys.Signing();

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-cors-{Guid.NewGuid():N}");

    private readonly Guid projectId = Guid.NewGuid();
    private readonly ApiFactory factory;
    private readonly HttpClient client;

    public WidgetCorsTests()
    {
        using (var db = TestDatabase.OpenContext())
        {
            db.Projects.Add(new Project
            {
                Id = projectId,
                Name = "Cors",
                Key = $"cors-{projectId:N}",
                Origins = [new ProjectOrigin { Origin = ProjectOrigin }]
            });
            db.SaveChanges();
        }

        Directory.CreateDirectory(attachmentsPath);
        factory = new ApiFactory(attachmentsPath);
        client = factory.CreateClient();
    }

    public void Dispose()
    {
        client.Dispose();
        factory.Dispose();

        using (var db = TestDatabase.OpenContext())
        {
            db.Projects.Where(p => p.Id == projectId).ExecuteDelete();
        }

        Directory.Delete(attachmentsPath, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Theory]
    [InlineData(ConfiguredOrigin)]
    [InlineData(ProjectOrigin)]
    public async Task PreflightPrzepuszczaOriginZKonfiguracjiAlboZProjektu(string origin)
    {
        var response = await Preflight("/api/v1/tickets", origin, "content-type");

        Assert.Equal(origin, AllowedOrigin(response));
    }

    [Fact]
    public async Task PreflightNieznanegoOriginuNieDostajeZgody()
    {
        var response = await Preflight("/api/v1/tickets", "http://127.0.0.1:5598", "content-type");

        Assert.Null(AllowedOrigin(response));
    }

    [Fact]
    public async Task WysylkaZalacznikowPrzepuszczaOriginZProjektu()
    {
        var response = await Preflight(
            $"/api/v1/tickets/{Guid.NewGuid()}/attachments",
            ProjectOrigin,
            $"content-type,{UploadToken.HeaderName.ToLowerInvariant()}");

        Assert.Equal(ProjectOrigin, AllowedOrigin(response));
    }

    // panel dostaje cookie wiec jego lista nie moze rosnac o originy widgetu
    [Fact]
    public async Task OriginProjektuNieOtwieraPanelu()
    {
        var response = await Preflight("/api/v1/projects", ProjectOrigin, "authorization");

        Assert.Null(AllowedOrigin(response));
    }

    private async Task<HttpResponseMessage> Preflight(string path, string origin, string headers)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, path);
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", headers);

        return await client.SendAsync(request);
    }

    private static string? AllowedOrigin(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? values.Single() : null;

    private sealed class ApiFactory(string attachmentsPath) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseSetting("Storage:AttachmentsPath", attachmentsPath);
            builder.UseSetting("JWT_SIGNING_KEY", SigningKey);
            builder.UseSetting("Cors:WidgetOrigins:0", ConfiguredOrigin);
            builder.UseSetting("Cors:DashboardOrigins:0", "http://localhost:5173");
        }
    }
}
