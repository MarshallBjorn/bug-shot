using System.Text.Json.Serialization;
using BugShot.Api;
using BugShot.Api.Attachments;
using BugShot.Api.Sanitization;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.OpenApi;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// compose podaje to jako ConnectionStrings__DefaultConnection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string DefaultConnection is not configured.");

// katalog zalacznikow zawsze z env bo w kazdym srodowisku montuje sie gdzie indziej
var attachmentsPath = builder.Configuration["Storage:AttachmentsPath"]
    ?? throw new InvalidOperationException("Storage:AttachmentsPath is not configured.");

// bez klucza nie da sie podpisac tokena wiec API ma nie wstac zamiast wstac bez ochrony
// pusty lapiemy osobno bo compose podaje zmienna bez wartosci domyslnej
var signingKey = builder.Configuration["JWT_SIGNING_KEY"];

if (string.IsNullOrWhiteSpace(signingKey))
{
    throw new InvalidOperationException("JWT_SIGNING_KEY is not configured.");
}

var widgetOrigins = builder.Configuration.GetSection("Cors:WidgetOrigins").Get<string[]>() ?? [];
var dashboardOrigins = builder.Configuration.GetSection("Cors:DashboardOrigins").Get<string[]>() ?? [];

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddHealthChecks();

var attachmentStorage = new AttachmentStorageOptions(attachmentsPath);
attachmentStorage.EnsureWritable();

builder.Services.AddSingleton(attachmentStorage);

// poza deweloperka dokument stoi tylko gdy ktos go wlaczy i poda haslo
var openApiAccess = OpenApiAccess.Read(builder.Configuration, builder.Environment);

if (openApiAccess is not null)
{
    builder.Services.AddOpenApi(options => options.Describe());
}

var accessTokens = new AccessTokenIssuer(signingKey);

builder.Services.AddSingleton(accessTokens);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = accessTokens.ValidationParameters;

        // nazwy claimow zostaja takie jak w tokenie bo mapowanie na typy WS-Federation tylko myli
        options.MapInboundClaims = false;

        options.Events = new JwtBearerEvents
        {
            // token niesie stan konta z chwili logowania wiec bez zajrzenia do bazy
            // wylaczone konto pracowaloby dalej az do wygasniecia swojego access tokena
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<BugShotDbContext>();
                var userId = context.Principal!.UserId();

                var active = await db.Users
                    .AsNoTracking()
                    .AnyAsync(u => u.Id == userId && u.IsActive, context.HttpContext.RequestAborted);

                if (!active)
                {
                    context.Fail("Account is no longer active.");
                }
            }
        };
    });

// nowy endpoint jest chroniony dopoki sam nie powie inaczej
builder.Services.AddAuthorization(options => options.FallbackPolicy = new AuthorizationPolicyBuilder()
    .RequireAuthenticatedUser()
    .Build());

// zaplecze Idempotency-Key na POST /tickets. Podmiana na Redis to jedna linia
builder.Services.AddDistributedMemoryCache();
builder.Services.AddDbContext<BugShotDbContext>(options => options
    .UseNpgsql(connectionString, npgsql =>
    {
        npgsql.MapEnum<TicketStatus>("ticket_status");
        npgsql.MapEnum<AttachmentKind>("attachment_kind");
    })
    .UseSnakeCaseNamingConvention());

builder.Services.AddScoped<ISanitizationService, SanitizationService>();
builder.Services.AddCors(options =>
{
    // widget siedzi na cudzych domenach i moze tylko zglaszac
    options.AddPolicy(CorsPolicies.Widget, policy => policy
        .WithOrigins(widgetOrigins)
        .WithMethods("POST")
        .WithHeaders("Content-Type"));

    // wysylka zalacznikow potrzebuje wlasnego naglowka wiec nie miesci sie w polityce wyzej
    options.AddPolicy(CorsPolicies.WidgetUpload, policy => policy
        .WithOrigins(widgetOrigins)
        .WithMethods("POST")
        .WithHeaders("Content-Type", UploadToken.HeaderName));

    // panel dosyla cookie z tokenem odswiezajacym wiec sama lista originow tu nie wystarczy
    options.AddPolicy(CorsPolicies.Dashboard, policy => policy
        .WithOrigins(dashboardOrigins)
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BugShotDbContext>();

    await db.Database.MigrateAsync();

    await AdminSeeder.EnsureAdmin(
        db,
        app.Configuration,
        app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(AdminSeeder)));
}

if (openApiAccess is not null)
{
    if (openApiAccess.RequiresPassword)
    {
        // brama stoi przed routingiem bo ma zamykac tak samo dokument jak i strone interfejsu
        app.UseWhen(
            context => context.Request.Path.StartsWithSegments("/swagger")
                || context.Request.Path.StartsWithSegments("/openapi"),
            branch => branch.UseMiddleware<OpenApiBasicAuthMiddleware>(openApiAccess));
    }

    // dokument nie zna tokena panelu wiec zostaje anonimowy niezaleznie od FallbackPolicy
    app.MapOpenApi().AllowAnonymous();

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Bug-shot API v1");
        options.RoutePrefix = "swagger";
        options.DocumentTitle = "Bug-shot API";
    });
}

app.UseCors();

app.MapHealthChecks("/healthz").AllowAnonymous();;
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// testy integracyjne stawiaja te sama aplikacje wiec potrzebuja uchwytu na jej klase startowa
public partial class Program;
