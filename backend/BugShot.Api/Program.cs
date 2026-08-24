using BugShot.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// compose podaje to jako ConnectionStrings__DefaultConnection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string DefaultConnection is not configured.");

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddDbContext<BugShotDbContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

app.Run();
