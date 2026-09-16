using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace BugShot.Api.Notifications.Email;

public interface IEmailSender
{
    Task SendEmailAsync(
        string toAddress,
        string subject,
        string body,
        CancellationToken cancellationToken);
}

public sealed class SmtpEmailSender(SmtpOptions options) : IEmailSender
{
    private readonly SmtpOptions _config = options;

    public async Task SendEmailAsync(
        string toAddress,
        string subject,
        string body,
        CancellationToken cancellationToken)
    {
        var message = new MimeMessage();
        message.From.Add(
            new MailboxAddress(
                _config.FromName,
                _config.FromAddress));

        message.To.Add(MailboxAddress.Parse(toAddress));
        message.Subject = subject;
        message.Body = new TextPart("plain")
        {
            Text = body
        };

        using var client = new SmtpClient();
        client.Timeout = 10000;

        var socketOptions = _config.UseStartTls
            ? SecureSocketOptions.StartTls
            : SecureSocketOptions.None;

        await client.ConnectAsync(
            _config.Host,
            _config.Port,
            socketOptions,
            cancellationToken);

        if (!string.IsNullOrEmpty(_config.Username))
        {
            await client.AuthenticateAsync(
                _config.Username,
                _config.Password ?? string.Empty,
                cancellationToken);
        }

        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
