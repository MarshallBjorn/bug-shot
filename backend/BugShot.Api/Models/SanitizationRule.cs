namespace BugShot.Api.Models;

public class SanitizationRule : ICreatedAt
{
    public Guid Id { get; set; }

    // null oznacza regule globalna
    public Guid? ProjectId { get; set; }

    public Project? Project { get; set; }

    public string Pattern { get; set; } = string.Empty;

    public string Replacement { get; set; } = string.Empty;

    public bool IsEnabled { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }
}
