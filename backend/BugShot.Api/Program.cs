using System.Text.Json.Serialization;
using BugShot.Api;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// compose podaje to jako ConnectionStrings__DefaultConnection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string DefaultConnection is not configured.");

var widgetOrigins = builder.Configuration.GetSection("Cors:WidgetOrigins").Get<string[]>() ?? [];
var dashboardOrigins = builder.Configuration.GetSection("Cors:DashboardOrigins").Get<string[]>() ?? [];

builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddOpenApi();
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

    options.AddPolicy(CorsPolicies.Dashboard, policy => policy
        .WithOrigins(dashboardOrigins)
        .AllowAnyMethod()
        .AllowAnyHeader());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

app.MapControllers();

app.Run();
