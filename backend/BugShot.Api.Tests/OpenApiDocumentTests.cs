using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BugShot.Api.Attachments;
using BugShot.Api.OpenApi;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class OpenApiDocumentTests : IDisposable
{
    private const string DocumentPath = "/openapi/v1.json";
    private const string UiPath = "/swagger/index.html";
    private const string User = "docs";
    private const string Password = "swagger-password-2026";

    private readonly string attachmentsPath = Path.Combine(
        Path.GetTempPath(),
        $"bugshot-openapi-{Guid.NewGuid():N}");

    public OpenApiDocumentTests() => Directory.CreateDirectory(attachmentsPath);

    public void Dispose()
    {
        Directory.Delete(attachmentsPath, recursive: true);
        GC.SuppressFinalize(this);
    }

    [Fact]
    public async Task DokumentNiesieSchematTokena()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var document = await ReadDocument(client);

        var scheme = document
            .GetProperty("components")
            .GetProperty("securitySchemes")
            .GetProperty(OpenApiSetup.SecuritySchemeName);

        Assert.Equal("http", scheme.GetProperty("type").GetString());
        Assert.Equal("bearer", scheme.GetProperty("scheme").GetString());
        Assert.Equal("JWT", scheme.GetProperty("bearerFormat").GetString());
    }

    [Fact]
    public async Task TrasaZaTokenemWymagaGoWDokumencieAWidgetNie()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var paths = (await ReadDocument(client)).GetProperty("paths");

        var guarded = paths.GetProperty("/api/v1/tickets/{id}").GetProperty("get");
        var anonymous = paths.GetProperty("/api/v1/tickets").GetProperty("post");

        Assert.Equal(
            OpenApiSetup.SecuritySchemeName,
            guarded.GetProperty("security")[0].EnumerateObject().Single().Name);

        Assert.False(anonymous.TryGetProperty("security", out _));
    }

    // opis kazdej trasy jest calym sensem karty wiec pilnujemy go testem a nie przegladem
    [Fact]
    public async Task KazdaTrasaMaOpisIOdpowiedzNaBrakTokena()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var paths = (await ReadDocument(client)).GetProperty("paths");

        foreach (var path in paths.EnumerateObject())
        {
            foreach (var operation in path.Value.EnumerateObject())
            {
                var name = $"{operation.Name.ToUpperInvariant()} {path.Name}";

                Assert.True(operation.Value.TryGetProperty("summary", out _), $"{name} nie ma opisu");

                if (!operation.Value.TryGetProperty("security", out _))
                {
                    continue;
                }

                Assert.True(
                    operation.Value.GetProperty("responses").TryGetProperty("401", out _),
                    $"{name} stoi za tokenem ale nie opisuje odpowiedzi 401");
            }
        }
    }

    // konwerter serializacji ustawia sie osobno od schematu wiec latwo o dokument
    // ktory obiecuje liczbe a dostaje sie z API napis
    [Fact]
    public async Task StatusyOpisaneSaNapisamiATakSchodzaZApi()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var status = (await ReadDocument(client))
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty(nameof(Models.TicketStatus))
            .GetProperty("enum")
            .EnumerateArray()
            .Select(value => value.GetString())
            .ToArray();

        Assert.Equal(Enum.GetNames<Models.TicketStatus>(), status);
    }

    // kontroler czyta strumien sam wiec dokument nie ma skad wziac ksztaltu ciala
    [Fact]
    public async Task WysylkaZalacznikowOpisujeFormularzITokenWNaglowku()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var upload = (await ReadDocument(client))
            .GetProperty("paths")
            .GetProperty("/api/v1/tickets/{ticketId}/attachments")
            .GetProperty("post");

        var pola = upload
            .GetProperty("requestBody")
            .GetProperty("content")
            .GetProperty("multipart/form-data")
            .GetProperty("schema")
            .GetProperty("properties");

        Assert.True(pola.TryGetProperty(AttachmentLimits.ScreenshotField, out _));
        Assert.True(pola.TryGetProperty(AttachmentLimits.FilesField, out _));
        Assert.True(pola.TryGetProperty(AttachmentLimits.ConsoleLogField, out _));

        var naglowek = upload
            .GetProperty("parameters")
            .EnumerateArray()
            .Single(parameter => parameter.GetProperty("name").GetString() == UploadToken.HeaderName);

        Assert.Equal("header", naglowek.GetProperty("in").GetString());
        Assert.True(naglowek.GetProperty("required").GetBoolean());
    }

    // API odsyla wylacznie JSON a dokument obiecywal przy okazji text/plain
    [Fact]
    public async Task OdpowiedziOpisujeSamJson()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var typy = (await ReadDocument(client))
            .GetProperty("paths")
            .GetProperty("/api/v1/users")
            .GetProperty("get")
            .GetProperty("responses")
            .GetProperty("200")
            .GetProperty("content")
            .EnumerateObject()
            .Select(content => content.Name);

        Assert.Equal(["application/json"], typy);
    }

    [Fact]
    public async Task InterfejsStoiPodSwagger()
    {
        using var factory = NewFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync(UiPath);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task PozaDeweloperkaDokumentuNieMaBezWlaczenia()
    {
        using var factory = NewFactory(environment: "Production");
        using var client = factory.CreateClient();

        Assert.NotEqual(HttpStatusCode.OK, (await client.GetAsync(DocumentPath)).StatusCode);
        Assert.NotEqual(HttpStatusCode.OK, (await client.GetAsync(UiPath)).StatusCode);
    }

    [Fact]
    public async Task PozaDeweloperkaDokumentPytaOHaslo()
    {
        using var factory = NewFactory(environment: "Production", password: true);
        using var client = factory.CreateClient();

        foreach (var path in new[] { DocumentPath, UiPath })
        {
            var response = await client.GetAsync(path);

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Equal("Basic", Assert.Single(response.Headers.WwwAuthenticate).Scheme);
        }
    }

    [Fact]
    public async Task PozaDeweloperkaHasloOtwieraDokumentIInterfejs()
    {
        using var factory = NewFactory(environment: "Production", password: true);
        using var client = factory.CreateClient();

        client.DefaultRequestHeaders.Authorization = Basic(User, Password);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(DocumentPath)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(UiPath)).StatusCode);
    }

    [Fact]
    public async Task ZleHasloNieOtwieraDokumentu()
    {
        using var factory = NewFactory(environment: "Production", password: true);
        using var client = factory.CreateClient();

        client.DefaultRequestHeaders.Authorization = Basic(User, "nie-to-haslo");

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(DocumentPath)).StatusCode);

        client.DefaultRequestHeaders.Authorization = Basic("ktos-inny", Password);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(DocumentPath)).StatusCode);
    }

    // wlaczony dokument bez hasla poza deweloperka wystawilby cale API wiec API ma nie wstac
    [Fact]
    public void WlaczonyDokumentBezHaslaZatrzymujeStart()
    {
        using var factory = NewFactory(environment: "Production", enabled: true);

        var failure = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());

        Assert.Contains(OpenApiAccess.UserVariable, failure.Message);
        Assert.Contains(OpenApiAccess.PasswordVariable, failure.Message);
    }

    private ApiFactory NewFactory(
        string environment = "Development",
        bool enabled = false,
        bool password = false) =>
        new(attachmentsPath, environment, enabled || password, password);

    private static async Task<JsonElement> ReadDocument(HttpClient client)
    {
        var response = await client.GetAsync(DocumentPath);

        response.EnsureSuccessStatusCode();

        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
    }

    private static AuthenticationHeaderValue Basic(string user, string password) =>
        new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{user}:{password}")));

    private sealed class ApiFactory(
        string attachmentsPath,
        string environment,
        bool enabled,
        bool password) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("Storage:AttachmentsPath", attachmentsPath);
            builder.UseSetting("JWT_SIGNING_KEY", TestKeys.Signing());
            builder.UseSetting(AdminSeeder.EmailVariable, "admin@bug-shot.test");
            builder.UseSetting(AdminSeeder.PasswordVariable, "bug-shot-admin-2026");

            if (enabled)
            {
                builder.UseSetting(OpenApiAccess.EnabledVariable, "true");
            }

            if (password)
            {
                builder.UseSetting(OpenApiAccess.UserVariable, User);
                builder.UseSetting(OpenApiAccess.PasswordVariable, Password);
            }
        }
    }
}
