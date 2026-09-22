using BugShot.Api.Models;

namespace BugShot.Api.Notifications;

public interface INotificationEnqueuer
{
    Task EnqueueAsync(
        NotificationEvent notificationEvent,
        CancellationToken cancellationToken);
}
