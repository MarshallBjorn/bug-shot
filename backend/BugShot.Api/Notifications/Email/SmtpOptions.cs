using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace BugShot.Api.Notifications.Email;

public class SmtpOptions
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 25;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string FromAddress { get; set; } = "noreply@bug-shot.test";
    public string FromName { get; set; } = "Bug-Shot";
    public bool? UseStartTls { get; set; }

    public static SmtpOptions Read(
        IConfiguration configuration)
    {
        var options = new SmtpOptions();

        var host =
            configuration["Smtp:Host"]
            ?? configuration["SMTP_HOST"]
            ?? configuration["Smtp__Host"];

        if (!string.IsNullOrWhiteSpace(host))
        {
            options.Host = host;
        }

        var portValue =
            configuration["Smtp:Port"]
            ?? configuration["SMTP_PORT"]
            ?? configuration["Smtp__Port"];

        if (!string.IsNullOrWhiteSpace(portValue))
        {
            if (!int.TryParse(
                portValue,
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var port))
            {
                throw new FormatException(
                    $"Invalid SMTP port '{portValue}'.");
            }

            if (port is < 1 or > 65535)
            {
                throw new FormatException(
                    $"SMTP port '{portValue}' must be between 1 and 65535.");
            }

            options.Port = port;
        }

        var username =
            configuration["Smtp:Username"]
            ?? configuration["SMTP_USERNAME"]
            ?? configuration["Smtp__Username"];

        if (!string.IsNullOrWhiteSpace(username))
        {
            options.Username = username;
        }

        var password =
            configuration["Smtp:Password"]
            ?? configuration["SMTP_PASSWORD"]
            ?? configuration["Smtp__Password"];

        if (!string.IsNullOrWhiteSpace(password))
        {
            options.Password = password;
        }

        var fromAddress =
            configuration["Smtp:FromAddress"]
            ?? configuration["SMTP_FROM_ADDRESS"]
            ?? configuration["SMTP_FROM"]
            ?? configuration["Smtp__FromAddress"];

        if (!string.IsNullOrWhiteSpace(fromAddress))
        {
            options.FromAddress = fromAddress;
        }

        var fromName =
            configuration["Smtp:FromName"]
            ?? configuration["SMTP_FROM_NAME"]
            ?? configuration["Smtp__FromName"];

        if (!string.IsNullOrWhiteSpace(fromName))
        {
            options.FromName = fromName;
        }

        var tlsValue =
            configuration["Smtp:UseStartTls"]
            ?? configuration["SMTP_USE_STARTTLS"]
            ?? configuration["Smtp__UseStartTls"];

        if (!string.IsNullOrWhiteSpace(tlsValue))
        {
            if (!bool.TryParse(
                tlsValue,
                out var useStartTls))
            {
                throw new FormatException(
                    $"Invalid SMTP_USE_STARTTLS value '{tlsValue}'.");
            }

            options.UseStartTls = useStartTls;
        }

        return options;
    }
}
