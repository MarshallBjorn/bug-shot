namespace BugShot.Api.Models;

public class TicketStatusChange
{
    public Guid Id { get; set; }

    public Guid TicketId { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public TicketStatus FromStatus { get; set; }

    public TicketStatus ToStatus { get; set; }

    public string ChangedBy { get; set; } = string.Empty;

    public DateTimeOffset ChangedAt { get; set; }
}
