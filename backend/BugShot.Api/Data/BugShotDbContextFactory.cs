using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace BugShot.Api.Data;

// narzedzia EF buduja kontekst same zamiast uruchamiac cala aplikacje wiec migracje potrzebuja tylko connection stringa
public class BugShotDbContextFactory : IDesignTimeDbContextFactory<BugShotDbContext>
{
    public BugShotDbContext CreateDbContext(string[] args)
    {
        // ten sam lancuch zrodel co w aplikacji zeby migracje nie widzialy innej konfiguracji niz API
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string DefaultConnection is not configured.");

        var options = new DbContextOptionsBuilder<BugShotDbContext>()
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MapEnum<TicketStatus>("ticket_status");
                npgsql.MapEnum<AttachmentKind>("attachment_kind");
                npgsql.MapEnum<NotificationChannelType>("notification_channel_type");
                npgsql.MapEnum<NotificationEventType>("notification_event_type");
                npgsql.MapEnum<NotificationDeliveryStatus>("notification_delivery_status");
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BugShotDbContext(options);
    }
}
