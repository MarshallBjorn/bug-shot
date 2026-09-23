using System.Collections.Concurrent;
using BugShot.Api.Notifications.Email;

namespace BugShot.Api.Tests;

public sealed record SentEmail(string To, string Subject, string Body);

// zamiast SMTP zapisuje wiadomosci a na zyczenie udaje awarie serwera
public sealed class RecordingEmailSender : IEmailSender
{
    public ConcurrentQueue<SentEmail> Sent { get; } = new();

    public bool Fail { get; set; }

    public Task SendEmailAsync(string toAddress, string subject, string body, CancellationToken cancellationToken)
    {
        if (Fail)
        {
            throw new InvalidOperationException("SMTP is down.");
        }

        Sent.Enqueue(new SentEmail(toAddress, subject, body));

        return Task.CompletedTask;
    }
}
