namespace BugShot.Api.Notifications;

public sealed class NotificationWorkerSignal : INotificationWorkerSignal
{
    private readonly SemaphoreSlim signal = new(0, 1);

    public void Signal()
    {
        try
        {
            signal.Release();
        }
        catch (SemaphoreFullException)
        {
        }
    }

    public Task<bool> WaitAsync(
        TimeSpan timeout,
        CancellationToken cancellationToken) =>
        signal.WaitAsync(timeout, cancellationToken);
}
