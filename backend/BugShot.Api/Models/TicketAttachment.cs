namespace BugShot.Api.Models;

public class TicketAttachment : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid TicketId { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public AttachmentKind Kind { get; set; }

    // sam plik lezy w volume i serwuje go nginx
    public string Uri { get; set; } = string.Empty;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
