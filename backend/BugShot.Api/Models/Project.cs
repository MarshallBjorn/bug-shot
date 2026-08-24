namespace BugShot.Api.Models;

public class Project : ICreatedAt
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    // publiczny identyfikator wpinany w widget
    public string Key { get; set; } = string.Empty;

    // origin dopuszczany w CORS dla widgetu tego projektu
    public string AllowedOrigin { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Ticket> Tickets { get; set; } = [];
}
