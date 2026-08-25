namespace BugShot.Api.Models;

public class ProjectOrigin
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    // jeden projekt bywa hostowany na prod stagingu i preview
    public string Origin { get; set; } = string.Empty;
}
