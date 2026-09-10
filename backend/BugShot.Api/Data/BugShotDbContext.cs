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

        });

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
