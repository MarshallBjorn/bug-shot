using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

// testy czyszcza tabele wiec chodza po wlasnej bazie a nie po tej z docker compose
// adres podaje ConnectionStrings__DefaultConnection czyli TEST_CONNECTION z Makefile
public static class TestDatabase
{
    public static string ConnectionString =>
        Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
        ?? throw new InvalidOperationException(
            "ConnectionStrings__DefaultConnection is not configured.");

    public static BugShotDbContext OpenContext()
    {
        var options = new DbContextOptionsBuilder<BugShotDbContext>()
            .UseNpgsql(ConnectionString, npgsql =>
            {
                npgsql.MapEnum<TicketStatus>("ticket_status");
                npgsql.MapEnum<AttachmentKind>("attachment_kind");
                npgsql.MapEnum<NotificationChannelType>("notification_channel_type");
                npgsql.MapEnum<NotificationEventType>("notification_event_type");
                npgsql.MapEnum<NotificationDeliveryStatus>("notification_delivery_status");
                npgsql.MapEnum<ProjectRole>("project_role");
                npgsql.MapEnum<UserTokenPurpose>("user_token_purpose");
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BugShotDbContext(options);
    }
}

// wszystkie testy bazodanowe dziela jedna baze wiec ida po kolei
[CollectionDefinition("PostgreSQL tests", DisableParallelization = true)]
public class PostgreSqlTestCollection : ICollectionFixture<PostgreSqlFixture>
{
}

// schemat zaklada sie raz na cala kolekcje wiec swiezy klon nie potrzebuje osobnego kroku
public class PostgreSqlFixture
{
    public PostgreSqlFixture()
    {
        using var db = TestDatabase.OpenContext();

        db.Database.Migrate();
    }
}
