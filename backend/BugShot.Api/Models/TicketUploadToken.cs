namespace BugShot.Api.Models;

public class TicketUploadToken : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid TicketId { get; set; }

    public Ticket Ticket { get; set; } = null!;

    // w bazie lezy wylacznie skrot bo sam token widzi tylko klient
    public byte[] TokenHash { get; set; } = [];

    public DateTimeOffset ExpiresAt { get; set; }

    // wypelnione oznacza token zuzyty i nie do ponownego uzycia
    public DateTimeOffset? UsedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
