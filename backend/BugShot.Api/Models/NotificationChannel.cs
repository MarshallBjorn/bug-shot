using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Models;

public sealed class NotificationChannel : ICreatedAt
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public NotificationChannelType Type { get; set; }
    public bool IsEnabled { get; set; } = true;

    [EmailAddress]
    [MaxLength(320)]
    public string? EmailAddress { get; set; }

    [MaxLength(2048)]
    public string? WebhookUrl { get; set; }

    [MaxLength(256)]
    public string? WebhookSecret { get; set; }

    public int? ThrottleWindowSeconds { get; set; }
    public int? ThrottleMaxEvents { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<NotificationDelivery> Deliveries { get; set; } = [];
}