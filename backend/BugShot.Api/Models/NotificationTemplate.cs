using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Models;

public sealed class NotificationTemplate : ICreatedAt
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ProjectId { get; set; }
    public Project? Project { get; set; }

    public NotificationEventType EventType { get; set; }
    public NotificationChannelType ChannelType { get; set; }

    [MaxLength(255)]
    public string? Subject { get; set; }

    [Required]
    [MaxLength(4000)]
    public string Body { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}