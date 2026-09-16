namespace BugShot.Api.Notifications;

public interface INotificationWorkerSignal
{
    void Signal();

    Task WaitAsync(CancellationToken cancellationToken);
}