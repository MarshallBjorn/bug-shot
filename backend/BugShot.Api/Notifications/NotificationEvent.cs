using BugShot.Api.Models;

namespace BugShot.Api.Notifications;

public sealed record NotificationEvent(
    Guid ProjectId,
    Guid TicketId,
    NotificationEventType EventType,
    Guid? RelatedEntityId = null);
