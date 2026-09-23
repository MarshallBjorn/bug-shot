namespace BugShot.Api.Models;

public class ProjectMember : ICreatedAt
{
    public Guid ProjectId { get; set; }

    public Project Project { get; set; } = null!;

    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public ProjectRole Role { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
