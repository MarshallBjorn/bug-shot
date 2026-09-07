using System.Text.Json.Serialization;
using BugShot.Api;
using BugShot.Api.Attachments;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// compose podaje to jako ConnectionStrings__DefaultConnection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string DefaultConnection is not configured.");

// katalog zalacznikow zawsze z env bo w kazdym srodowisku montuje sie gdzie indziej
var attachmentsPath = builder.Configuration["Storage:AttachmentsPath"]
    ?? throw new InvalidOperationException("Storage:AttachmentsPath is not configured.");

var widgetOrigins = builder.Configuration.GetSection("Cors:WidgetOrigins").Get<string[]>() ?? [];
var dashboardOrigins = builder.Configuration.GetSection("Cors:DashboardOrigins").Get<string[]>() ?? [];

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var attachmentStorage = new AttachmentStorageOptions(attachmentsPath);
attachmentStorage.EnsureWritable();

builder.Services.AddSingleton(attachmentStorage);
builder.Services.AddOpenApi();

// backend Idempotency-Key, podmiana na Redis to jedna linia
builder.Services.AddDistributedMemoryCache();
builder.Services.AddDbContext<BugShotDbContext>(options => options
    .UseNpgsql(connectionString, npgsql =>
    {
        npgsql.MapEnum<TicketStatus>("ticket_status");
        npgsql.MapEnum<AttachmentKind>("attachment_kind");
    })
    .UseSnakeCaseNamingConvention());

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

    options.AddPolicy(CorsPolicies.Dashboard, policy => policy
        .WithOrigins(dashboardOrigins)
        .AllowAnyMethod()
        .AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<BugShotDbContext>();
    await db.Database.MigrateAsync();

    app.MapOpenApi();

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Bug-shot API v1");
        options.RoutePrefix = "swagger";
        options.DocumentTitle = "Bug-shot API";
    });
}

app.UseCors();

app.MapControllers();

app.Run();
