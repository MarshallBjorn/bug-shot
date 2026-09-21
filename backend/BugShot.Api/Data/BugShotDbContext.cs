using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Data;

public class BugShotDbContext(DbContextOptions<BugShotDbContext> options) : DbContext(options)
{
    public DbSet<Project> Projects => Set<Project>();

    public DbSet<ProjectOrigin> ProjectOrigins => Set<ProjectOrigin>();

    public DbSet<Ticket> Tickets => Set<Ticket>();

    public DbSet<TicketAttachment> TicketAttachments => Set<TicketAttachment>();

    public DbSet<TicketUploadToken> TicketUploadTokens => Set<TicketUploadToken>();

    public DbSet<TicketComment> TicketComments => Set<TicketComment>();

    public DbSet<TicketStatusChange> TicketStatusChanges => Set<TicketStatusChange>();

    public DbSet<SanitizationRule> SanitizationRules => Set<SanitizationRule>();

    public DbSet<SanitizationLog> SanitizationLogs => Set<SanitizationLog>();

    public DbSet<User> Users => Set<User>();

    public DbSet<UserRefreshToken> UserRefreshTokens => Set<UserRefreshToken>();

    public DbSet<NotificationChannel> NotificationChannels => Set<NotificationChannel>();

    public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();

    public DbSet<NotificationDelivery> NotificationDeliveries => Set<NotificationDelivery>();

    public override int SaveChanges()
    {
        ApplyAuditFields();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditFields();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyAuditFields()
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<ICreatedAt>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
            }
        }

        foreach (var entry in ChangeTracker.Entries<Ticket>())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
            {
                continue;
            }

            entry.Entity.UpdatedAt = now;

            // Postgres nie ma odpowiednika rowversion wiec pilnujemy tego sami
            entry.Entity.RowVersion = Guid.NewGuid().ToByteArray();

            if (entry.State == EntityState.Added)
            {
                entry.Entity.ReceivedAt = now;
            }
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum<TicketStatus>();
        modelBuilder.HasPostgresEnum<AttachmentKind>();
        modelBuilder.HasPostgresEnum<NotificationChannelType>();
        modelBuilder.HasPostgresEnum<NotificationEventType>();
        modelBuilder.HasPostgresEnum<NotificationDeliveryStatus>();

        modelBuilder.Entity<Project>(entity =>
        {
            entity.Property(p => p.Name).HasMaxLength(128);
            entity.Property(p => p.Key).HasMaxLength(64);

            entity.HasIndex(p => p.Key).IsUnique();

            // projekt startowy zeby widget i dashboard mialy w co celowac na dev
            entity.HasData(new Project
            {
                Id = new Guid("11111111-1111-1111-1111-111111111111"),
                Name = "Projekt demo",
                Key = "demo",
                CreatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
            });
        });

        modelBuilder.Entity<ProjectOrigin>(entity =>
        {
            entity.Property(o => o.Origin).HasMaxLength(2048);

            entity.HasIndex(o => new { o.ProjectId, o.Origin }).IsUnique();

            entity.HasOne(o => o.Project)
                .WithMany(p => p.Origins)
                .HasForeignKey(o => o.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasData(new ProjectOrigin
            {
                Id = new Guid("22222222-2222-2222-2222-222222222222"),
                ProjectId = new Guid("11111111-1111-1111-1111-111111111111"),
                Origin = "http://127.0.0.1:5500"
            });
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.Property(t => t.Description).HasMaxLength(1200);
            entity.Property(t => t.PageUrl).HasMaxLength(2048);
            entity.Property(t => t.UserAgent).HasMaxLength(512);
            entity.Property(t => t.Page).HasMaxLength(2048);
            entity.Property(t => t.BrowserName).HasMaxLength(32);
            entity.Property(t => t.OsName).HasMaxLength(32);
            entity.Property(t => t.DeviceType).HasMaxLength(16);
            entity.Property(t => t.Language).HasMaxLength(Analytics.TicketClientDetails.LanguageMaxLength);
            entity.Property(t => t.TimeZone).HasMaxLength(Analytics.TicketClientDetails.TimeZoneMaxLength);
            entity.Property(t => t.DeletedBy).HasMaxLength(128);
            entity.Property(t => t.RowVersion).IsConcurrencyToken();

            // listing dashboardu
            entity.HasIndex(t => new { t.ProjectId, t.Status, t.ReportedAt })
                .IsDescending(false, false, true);

            // sortowanie domyslne
            entity.HasIndex(t => new { t.ProjectId, t.ReceivedAt })
                .IsDescending(false, true);

            // kasowanie projektu nie moze po cichu zabrac wszystkich zgloszen
            entity.HasOne(t => t.Project)
                .WithMany(p => p.Tickets)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TicketAttachment>(entity =>
        {
            entity.Property(a => a.Uri).HasMaxLength(2048);
            entity.Property(a => a.FileName).HasMaxLength(260);
            entity.Property(a => a.ContentType).HasMaxLength(128);

            entity.HasIndex(a => a.TicketId);

            entity.HasOne(a => a.Ticket)
                .WithMany(t => t.Attachments)
                .HasForeignKey(a => a.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketUploadToken>(entity =>
        {
            // wyszukanie tokena przy wysylce zalacznikow idzie po skrocie
            entity.HasIndex(t => t.TokenHash).IsUnique();

            entity.HasOne(t => t.Ticket)
                .WithMany(t => t.UploadTokens)
                .HasForeignKey(t => t.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketComment>(entity =>
        {
            entity.Property(c => c.Author).HasMaxLength(128);
            entity.Property(c => c.Body).HasMaxLength(5000);

            entity.HasIndex(c => new { c.TicketId, c.CreatedAt });

            entity.HasOne(c => c.Ticket)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketStatusChange>(entity =>
        {
            entity.Property(s => s.ChangedBy).HasMaxLength(128);

            entity.HasIndex(s => new { s.TicketId, s.ChangedAt });

            entity.HasOne(s => s.Ticket)
                .WithMany(t => t.StatusHistory)
                .HasForeignKey(s => s.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SanitizationRule>(entity =>
        {
            entity.Property(r => r.Pattern).HasMaxLength(512);
            entity.Property(r => r.Replacement).HasMaxLength(128);

            entity.HasOne(r => r.Project)
                .WithMany(p => p.SanitizationRules)
                .HasForeignKey(r => r.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                ProjectId = null,
                Pattern = @"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+",
                Replacement = "***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                ProjectId = null,
                Pattern = @"(?i)""?\b(password|passwd|pwd)""?\s*[:=]\s*""?[^""'\r\n,\s}]+""?",
                Replacement = "***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("44444444-4444-4444-4444-444444444444"),
                ProjectId = null,
                Pattern = @"(?i)""?\b(login|username|user_name)""?\s*[:=]\s*""?[^""'\r\n,\s}]+""?",
                Replacement = "***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("55555555-5555-5555-5555-555555555555"),
                ProjectId = null,
                Pattern = @"(?i)(\bAuthorization\s*:\s*(?:Bearer|Digest)\s+)\S+",
                Replacement = "$1***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("66666666-6666-6666-6666-666666666666"),
                ProjectId = null,
                Pattern = @"(?i)(\bAuthorization\s*:\s*Basic\s+)\S+",
                Replacement = "$1***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
                ProjectId = null,
                Pattern = @"(?i)""?\b(?:access_token|refresh_token|id_token|session_id|sessionId)""?\s*[:=]\s*""?[^""'\r\n,\s}]+""?",
                Replacement = "***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
                ProjectId = null,
                Pattern = @"(?i)""?\b(?:api[_-]?key|x-api-key|client[_-]?secret|x-client-secret|api[_-]?secret)""?\s*[:=]\s*""?[^""'\r\n,\s}]+""?",
                Replacement = "***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("99999999-9999-9999-9999-999999999999"),
                ProjectId = null,
                Pattern = @"(?i)""?\b(?:csrf[_-]?token|xsrf[_-]?token|x-csrf-token|x-xsrf-token)""?\s*[:=]\s*""?[^""'\r\n,\s}]+""?",
                Replacement = "***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });

            entity.HasData(new SanitizationRule
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                ProjectId = null,
                Pattern = @"(?i)(\bCookie\s*:\s*)[^\r\n]+",
                Replacement = "$1***",
                IsEnabled = true,
                CreatedAt = new DateTimeOffset(
                    2026,
                    1,
                    1,
                    0,
                    0,
                    0,
                    TimeSpan.Zero)
            });
        });

                        modelBuilder.Entity<NotificationChannel>(entity =>
        {
            entity.Property(c => c.EmailAddress).HasMaxLength(320);
            entity.Property(c => c.WebhookUrl).HasMaxLength(2048);
            entity.Property(c => c.WebhookSecret).HasMaxLength(256);

            entity.HasIndex(c => c.ProjectId);

            entity.HasOne(c => c.Project)
                .WithMany()
                .HasForeignKey(c => c.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NotificationTemplate>(entity =>
        {
            entity.Property(t => t.Subject).HasMaxLength(255);
            entity.Property(t => t.Body).HasMaxLength(4000);

            entity.HasOne(t => t.Project)
                .WithMany()
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(t => new { t.EventType, t.ChannelType })
                .IsUnique()
                .HasFilter("project_id IS NULL");

            entity.HasIndex(t => new { t.ProjectId, t.EventType, t.ChannelType })
                .IsUnique()
                .HasFilter("project_id IS NOT NULL");
        });

        modelBuilder.Entity<NotificationDelivery>(entity =>
        {
            entity.Property(d => d.RenderedSubject).HasMaxLength(255);
            entity.Property(d => d.RenderedBody).HasMaxLength(8000);
            entity.Property(d => d.LastError).HasMaxLength(2000);

            entity.HasOne(d => d.Project)
                .WithMany()
                .HasForeignKey(d => d.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.Channel)
                .WithMany(c => c.Deliveries)
                .HasForeignKey(d => d.ChannelId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(d => d.Ticket)
                .WithMany()
                .HasForeignKey(d => d.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(d => new { d.Status, d.NextAttemptAt });
            entity.HasIndex(d => new { d.ChannelId, d.CreatedAt });
            entity.HasIndex(d => d.TicketId);
        });

        var notificationTemplateCreatedAt =
            new DateTimeOffset(2026, 9, 15, 0, 0, 0, TimeSpan.Zero);

        modelBuilder.Entity<NotificationTemplate>().HasData(
            new NotificationTemplate
            {
                Id = new Guid("10000000-0000-0000-0000-000000000001"),
                EventType = NotificationEventType.TicketCreated,
                ChannelType = NotificationChannelType.Email,
                Subject = "[{{project.name}}] New ticket {{ticket.id}}",
                Body = "{{ticket.description}}",
                CreatedAt = notificationTemplateCreatedAt
            },
            new NotificationTemplate
            {
                Id = new Guid("10000000-0000-0000-0000-000000000002"),
                EventType = NotificationEventType.TicketCreated,
                ChannelType = NotificationChannelType.Webhook,
                Subject = null,
                Body = "{{ticket.description}}",
                CreatedAt = notificationTemplateCreatedAt
            },
            new NotificationTemplate
            {
                Id = new Guid("10000000-0000-0000-0000-000000000003"),
                EventType = NotificationEventType.CommentAdded,
                ChannelType = NotificationChannelType.Email,
                Subject = "[{{project.name}}] New comment on {{ticket.id}}",
                Body = "{{comment.author}}: {{comment.body}}",
                CreatedAt = notificationTemplateCreatedAt
            },
            new NotificationTemplate
            {
                Id = new Guid("10000000-0000-0000-0000-000000000004"),
                EventType = NotificationEventType.CommentAdded,
                ChannelType = NotificationChannelType.Webhook,
                Subject = null,
                Body = "{{comment.author}}: {{comment.body}}",
                CreatedAt = notificationTemplateCreatedAt
            },
            new NotificationTemplate
            {
                Id = new Guid("10000000-0000-0000-0000-000000000005"),
                EventType = NotificationEventType.StatusChanged,
                ChannelType = NotificationChannelType.Email,
                Subject = "[{{project.name}}] Status changed for {{ticket.id}}",
                Body = "{{status.from}} -> {{status.to}}",
                CreatedAt = notificationTemplateCreatedAt
            },
            new NotificationTemplate
            {
                Id = new Guid("10000000-0000-0000-0000-000000000006"),
                EventType = NotificationEventType.StatusChanged,
                ChannelType = NotificationChannelType.Webhook,
                Subject = null,
                Body = "{{status.from}} -> {{status.to}}",
                CreatedAt = notificationTemplateCreatedAt
            }
        );
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(u => u.Email).HasMaxLength(256);

            // hash bcrypt ma 60 znakow a zapas zostaje na inny algorytm
            entity.Property(u => u.PasswordHash).HasMaxLength(100);

            // adres trafia do bazy zawsze malymi literami wiec zwykly unikalny indeks wystarczy
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<UserRefreshToken>(entity =>
        {
            // rotacja szuka tokena po skrocie
            entity.HasIndex(t => t.TokenHash).IsUnique();

            // uniewaznienie wszystkich tokenow uzytkownika idzie po tym indeksie
            entity.HasIndex(t => t.UserId);

            entity.HasOne(t => t.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SanitizationLog>(entity =>
        {
            entity.Property(l => l.FieldName).HasMaxLength(64);

            entity.HasOne(l => l.Ticket)
                .WithMany(t => t.SanitizationLogs)
                .HasForeignKey(l => l.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(l => l.Rule)
                .WithMany()
                .HasForeignKey(l => l.RuleId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
