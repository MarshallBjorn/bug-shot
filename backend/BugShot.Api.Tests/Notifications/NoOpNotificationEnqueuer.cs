using BugShot.Api.Models;
using BugShot.Api.Notifications;

namespace BugShot.Api.Tests.Notifications;

public sealed class NoOpNotificationEnqueuer : INotificationEnqueuer
{
    public Task EnqueueAsync(
        NotificationEvent notificationEvent,
        CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
