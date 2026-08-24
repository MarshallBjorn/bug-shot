using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Data;

public class BugShotDbContext(DbContextOptions<BugShotDbContext> options) : DbContext(options)
{
    public DbSet<Project> Projects => Set<Project>();

    public DbSet<Ticket> Tickets => Set<Ticket>();

    public DbSet<TicketAttachment> TicketAttachments => Set<TicketAttachment>();

    public DbSet<TicketComment> TicketComments => Set<TicketComment>();

    public DbSet<TicketStatusChange> TicketStatusChanges => Set<TicketStatusChange>();

    public override int SaveChanges()
    {
        ApplyTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyTimestamps()
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
            if (entry.State is EntityState.Added or EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Project>(entity =>
        {
            entity.Property(p => p.Name).HasMaxLength(128);
            entity.Property(p => p.Key).HasMaxLength(64);
            entity.Property(p => p.AllowedOrigin).HasMaxLength(2048);

            entity.HasIndex(p => p.Key).IsUnique();
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.Property(t => t.Description).HasMaxLength(1200);
            entity.Property(t => t.PageUrl).HasMaxLength(2048);
            entity.Property(t => t.UserAgent).HasMaxLength(512);
            entity.Property(t => t.Status).HasConversion<string>().HasMaxLength(32);

            // dashboard zawsze patrzy w obrebie projektu
            entity.HasIndex(t => new { t.ProjectId, t.Status, t.CreatedAt });

            // dwoch deweloperow nie moze po cichu nadpisac sobie statusu
            entity.Property<uint>("xmin")
                .HasColumnType("xid")
                .ValueGeneratedOnAddOrUpdate()
                .IsConcurrencyToken();

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
            entity.Property(a => a.Kind).HasConversion<string>().HasMaxLength(32);

            entity.HasOne(a => a.Ticket)
                .WithMany(t => t.Attachments)
                .HasForeignKey(a => a.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketComment>(entity =>
        {
            entity.Property(c => c.Author).HasMaxLength(128);
            entity.Property(c => c.Body).HasMaxLength(5000);

            entity.HasOne(c => c.Ticket)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TicketStatusChange>(entity =>
        {
            entity.Property(s => s.ChangedBy).HasMaxLength(128);
            entity.Property(s => s.FromStatus).HasConversion<string>().HasMaxLength(32);
            entity.Property(s => s.ToStatus).HasConversion<string>().HasMaxLength(32);

            entity.HasOne(s => s.Ticket)
                .WithMany(t => t.StatusHistory)
                .HasForeignKey(s => s.TicketId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
