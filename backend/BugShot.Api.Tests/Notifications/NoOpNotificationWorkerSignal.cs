using BugShot.Api.Notifications;

namespace BugShot.Api.Tests.Notifications;

public sealed class NoOpNotificationWorkerSignal : INotificationWorkerSignal
{
    public void Signal()
    {
    }

    public Task WaitAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}