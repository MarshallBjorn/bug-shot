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
    public bool UseStartTls { get; set; }

    public static SmtpOptions Read(IConfiguration configuration)
    {
        var options = new SmtpOptions();
        var section = configuration.GetSection(SectionName);

        if (section.Exists())
        {
            section.Bind(options);
        }

        var host = configuration["Smtp:Host"]
                   ?? configuration["SMTP_HOST"]
                   ?? configuration["Smtp__Host"];

        if (!string.IsNullOrWhiteSpace(host))
        {
            options.Host = host;
        }

        var portValue = configuration["Smtp:Port"]
                        ?? configuration["SMTP_PORT"]
                        ?? configuration["Smtp__Port"];

        if (!string.IsNullOrWhiteSpace(portValue) &&
            int.TryParse(portValue, out var port))
        {
            options.Port = port;
        }

        var username = configuration["Smtp:Username"]
                       ?? configuration["SMTP_USERNAME"]
                       ?? configuration["Smtp__Username"];

        if (!string.IsNullOrWhiteSpace(username))
        {
            options.Username = username;
        }

        var password = configuration["Smtp:Password"]
                       ?? configuration["SMTP_PASSWORD"]
                       ?? configuration["Smtp__Password"];

        if (!string.IsNullOrWhiteSpace(password))
        {
            options.Password = password;
        }

        var fromAddress = configuration["Smtp:FromAddress"]
                          ?? configuration["SMTP_FROM"]
                          ?? configuration["Smtp__FromAddress"];

        if (!string.IsNullOrWhiteSpace(fromAddress))
        {
            options.FromAddress = fromAddress;
        }

        var fromName = configuration["Smtp:FromName"]
                       ?? configuration["SMTP_FROM_NAME"]
                       ?? configuration["Smtp__FromName"];

        if (!string.IsNullOrWhiteSpace(fromName))
        {
            options.FromName = fromName;
        }

        var tlsValue = configuration["Smtp:UseStartTls"]
                       ?? configuration["SMTP_USE_STARTTLS"]
                       ?? configuration["Smtp__UseStartTls"];

        if (!string.IsNullOrWhiteSpace(tlsValue) &&
            bool.TryParse(tlsValue, out var useStartTls))
        {
            options.UseStartTls = useStartTls;
        }

        return options;
    }
}
