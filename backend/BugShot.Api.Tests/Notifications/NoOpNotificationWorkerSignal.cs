using BugShot.Api.Notifications;

namespace BugShot.Api.Tests.Notifications;

public sealed class NoOpNotificationWorkerSignal : INotificationWorkerSignal
{
    public void Signal()
    {
    }

    public Task<bool> WaitAsync(
        TimeSpan timeout,
        CancellationToken cancellationToken) =>
        Task.FromResult(true);
}