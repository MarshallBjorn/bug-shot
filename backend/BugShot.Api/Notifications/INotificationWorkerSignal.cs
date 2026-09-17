namespace BugShot.Api.Notifications;

public interface INotificationWorkerSignal
{
    void Signal();

    Task<bool> WaitAsync(
        TimeSpan timeout,
        CancellationToken cancellationToken);
}