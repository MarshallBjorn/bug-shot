namespace BugShot.Api.Models;

public class Ticket : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    public string Description { get; set; } = string.Empty;

    public string PageUrl { get; set; } = string.Empty;

    public string UserAgent { get; set; } = string.Empty;

    // logi z przegladarki zebrane przy zgloszeniu
    public string? ConsoleLog { get; set; }

    public TicketStatus Status { get; set; }

    // czas podany przez przegladarke bo zegar klienta bywa przestawiony
    public DateTimeOffset? ReportedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<TicketAttachment> Attachments { get; set; } = [];

    public ICollection<TicketComment> Comments { get; set; } = [];

    public ICollection<TicketStatusChange> StatusHistory { get; set; } = [];
}
