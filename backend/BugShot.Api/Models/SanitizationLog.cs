namespace BugShot.Api.Models;

public class SanitizationLog : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid TicketId { get; set; }

    public Ticket Ticket { get; set; } = null!;

    public Guid RuleId { get; set; }

    public SanitizationRule Rule { get; set; } = null!;

    public string FieldName { get; set; } = string.Empty;

    // sam oryginal nigdy nie jest zapisywany
    public int MatchCount { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
