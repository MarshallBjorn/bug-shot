using BugShot.Api.Notifications.Email;
using Microsoft.Extensions.Configuration;

namespace BugShot.Api.Tests.Notifications;

public sealed class SmtpOptionsTests
{
    [Fact]
    public void Read_NoConfiguration_ReturnsSafeDefaults()
    {
        var configuration = Build(new Dictionary<string, string?>());

        var options = SmtpOptions.Read(configuration);

        Assert.Equal("localhost", options.Host);
        Assert.Equal(25, options.Port);
        Assert.Null(options.Username);
        Assert.Null(options.Password);
        Assert.Equal("noreply@bug-shot.test", options.FromAddress);
        Assert.Equal("Bug-Shot", options.FromName);
        Assert.False(options.UseStartTls);
    }

    [Fact]
    public void Read_SmtpSectionSyntax_IsRespected()
    {
        var configuration = Build(new()
        {
            ["Smtp:Host"] = "smtp.section.test",
            ["Smtp:Port"] = "2525",
            ["Smtp:Username"] = "section-user",
            ["Smtp:Password"] = "section-pass",
            ["Smtp:FromAddress"] = "section@bug-shot.test",
            ["Smtp:FromName"] = "Section Sender",
            ["Smtp:UseStartTls"] = "true"
        });

        var options = SmtpOptions.Read(configuration);

        Assert.Equal("smtp.section.test", options.Host);
        Assert.Equal(2525, options.Port);
        Assert.Equal("section-user", options.Username);
        Assert.Equal("section-pass", options.Password);
        Assert.Equal("section@bug-shot.test", options.FromAddress);
        Assert.Equal("Section Sender", options.FromName);
        Assert.True(options.UseStartTls);
    }

    [Fact]
    public void Read_DoubleUnderscoreSyntax_IsRespected()
    {
        // Tak wygladaja zmienne w docker-compose (Smtp__Host itd.) - to jest
        // dokladnie ta forma ktora ustawiaja compose/E2E overridy.
        var configuration = Build(new()
        {
            ["Smtp__Host"] = "mailpit-e2e",
            ["Smtp__Port"] = "1025",
            ["Smtp__FromAddress"] = "noreply@bug-shot.test",
            ["Smtp__FromName"] = "Bug-Shot",
            ["Smtp__UseStartTls"] = "false"
        });

        var options = SmtpOptions.Read(configuration);

        Assert.Equal("mailpit-e2e", options.Host);
        Assert.Equal(1025, options.Port);
        Assert.Equal("noreply@bug-shot.test", options.FromAddress);
        Assert.Equal("Bug-Shot", options.FromName);
        Assert.False(options.UseStartTls);
    }

    [Fact]
    public void Read_ScreamingSnakeCaseSyntax_IsRespected()
    {
        var configuration = Build(new()
        {
            ["SMTP_HOST"] = "smtp.prod.test",
            ["SMTP_PORT"] = "587",
            ["SMTP_USERNAME"] = "prod-user",
            ["SMTP_PASSWORD"] = "prod-pass",
            ["SMTP_FROM_ADDRESS"] = "prod@bug-shot.test",
            ["SMTP_FROM_NAME"] = "Bug-Shot Prod",
            ["SMTP_USE_STARTTLS"] = "true"
        });

        var options = SmtpOptions.Read(configuration);

        Assert.Equal("smtp.prod.test", options.Host);
        Assert.Equal(587, options.Port);
        Assert.Equal("prod-user", options.Username);
        Assert.Equal("prod-pass", options.Password);

        // Regresja: SMTP_FROM_ADDRESS jest udokumentowana nazwa uzywana wszedzie
        // (README, .env.prod.example) - musi byc respektowana, nie tylko
        // stary SMTP_FROM.
        Assert.Equal("prod@bug-shot.test", options.FromAddress);

        Assert.Equal("Bug-Shot Prod", options.FromName);
        Assert.True(options.UseStartTls);
    }

    [Fact]
    public void Read_LegacySmtpFromWithoutAddressSuffix_StillWorks()
    {
        // Backward-compat: kod historycznie czytal SMTP_FROM (bez _ADDRESS).
        // Nie usuwamy tego, tylko dokladamy wlasciwa, udokumentowana nazwe.
        var configuration = Build(new()
        {
            ["SMTP_FROM"] = "legacy@bug-shot.test"
        });

        var options = SmtpOptions.Read(configuration);

        Assert.Equal("legacy@bug-shot.test", options.FromAddress);
    }

    [Fact]
    public void Read_SmtpFromAddressTakesPrecedenceOverLegacySmtpFrom()
    {
        var configuration = Build(new()
        {
            ["SMTP_FROM_ADDRESS"] = "correct@bug-shot.test",
            ["SMTP_FROM"] = "legacy@bug-shot.test"
        });

        var options = SmtpOptions.Read(configuration);

        Assert.Equal("correct@bug-shot.test", options.FromAddress);
    }

    [Fact]
    public void Read_InvalidPortOrBool_KeepsDefaultInsteadOfThrowing()
    {
        var configuration = Build(new()
        {
            ["SMTP_PORT"] = "not-a-number",
            ["SMTP_USE_STARTTLS"] = "not-a-bool"
        });

        var options = SmtpOptions.Read(configuration);

        Assert.Equal(25, options.Port);
        Assert.False(options.UseStartTls);
    }

    private static IConfiguration Build(Dictionary<string, string?> values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
}
