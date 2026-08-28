namespace BugShot.Api.Models;

public class Ticket : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    public string Description { get; set; } = string.Empty;

    public string PageUrl { get; set; } = string.Empty;

    public string UserAgent { get; set; } = string.Empty;

    public TicketStatus Status { get; set; }

    // czas podany przez przegladarke bo zegar klienta bywa przestawiony
    public DateTimeOffset? ReportedAt { get; set; }

    // czas stemplowany przez serwer niezaleznie od klienta
    public DateTimeOffset ReceivedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    // wypelnione oznacza tombstone po skasowaniu
    public DateTimeOffset? DeletedAt { get; set; }

    public string? DeletedBy { get; set; }

    public byte[] RowVersion { get; set; } = [];

    public ICollection<TicketAttachment> Attachments { get; set; } = [];

    public ICollection<TicketComment> Comments { get; set; } = [];

    public ICollection<TicketStatusChange> StatusHistory { get; set; } = [];

    public ICollection<TicketUploadToken> UploadTokens { get; set; } = [];

    public ICollection<SanitizationLog> SanitizationLogs { get; set; } = [];
}
