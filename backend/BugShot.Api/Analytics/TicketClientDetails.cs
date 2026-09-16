using System.Text.RegularExpressions;
using BugShot.Api.Contracts;
using BugShot.Api.Models;

namespace BugShot.Api.Analytics;

// metadane z widgetu przepuszczamy tylko gdy wygladaja sensownie a reszte pomijamy zamiast odrzucac zgloszenie
public static partial class TicketClientDetails
{
    public const int LanguageMaxLength = 35;

    public const int TimeZoneMaxLength = 64;

    public static void Apply(Ticket ticket, CreateTicketRequest request)
    {
        var agent = UserAgentParser.Parse(request.UserAgent);

        ticket.BrowserName = agent.Browser;
        ticket.OsName = agent.Os;
        ticket.DeviceType = agent.DeviceType;

        if (request.Viewport is { } viewport
            && viewport.Width is > 0 and <= 100_000
            && viewport.Height is > 0 and <= 100_000)
        {
            ticket.ViewportWidth = viewport.Width;
            ticket.ViewportHeight = viewport.Height;
            ticket.DevicePixelRatio = viewport.DevicePixelRatio is > 0 and <= 20 ? viewport.DevicePixelRatio : null;
        }

        ticket.Language = request.Language is { Length: <= LanguageMaxLength } language && LanguagePattern().IsMatch(language)
            ? language
            : null;

        ticket.TimeZone = request.TimeZone is { } timeZone && IsTimeZoneName(timeZone) ? timeZone : null;
    }

    public static bool IsTimeZoneName(string value) =>
        value.Length <= TimeZoneMaxLength && TimeZonePattern().IsMatch(value);

    public static void Clear(Ticket ticket)
    {
        ticket.Page = string.Empty;
        ticket.BrowserName = string.Empty;
        ticket.OsName = string.Empty;
        ticket.DeviceType = string.Empty;
        ticket.ViewportWidth = null;
        ticket.ViewportHeight = null;
        ticket.DevicePixelRatio = null;
        ticket.Language = null;
        ticket.TimeZone = null;
    }

    // tag BCP 47 na przyklad pl-PL albo zh-Hant-TW
    [GeneratedRegex("^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$")]
    private static partial Regex LanguagePattern();

    // nazwa strefy IANA na przyklad Europe/Warsaw albo America/Argentina/Buenos_Aires
    [GeneratedRegex("^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$")]
    private static partial Regex TimeZonePattern();
}
