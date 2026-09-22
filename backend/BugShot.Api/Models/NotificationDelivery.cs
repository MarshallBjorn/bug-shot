using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Models;

public sealed class NotificationDelivery : ICreatedAt
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;

    public Guid ChannelId { get; set; }
    public NotificationChannel Channel { get; set; } = null!;

    public Guid TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;

    public NotificationEventType EventType { get; set; }

    [MaxLength(255)]
    public string? RenderedSubject { get; set; }

    public string RenderedBody { get; set; } = string.Empty;

    public NotificationDeliveryStatus Status { get; set; } = NotificationDeliveryStatus.Pending;

    public int AttemptCount { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public DateTimeOffset? LastAttemptAt { get; set; }

    [MaxLength(2000)]
    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
}