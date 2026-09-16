namespace BugShot.Api.Analytics;

public record UserAgentInfo(string Browser, string Os, string DeviceType);

// kilka regul na popularne przegladarki zamiast biblioteki bo analityce wystarcza rodzina i system
// te same reguly powtarza migracja uzupelniajaca stare zgloszenia wiec zmiana wymaga zmiany w obu miejscach
public static class UserAgentParser
{
    public const string Other = "Other";

    public static UserAgentInfo Parse(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return new UserAgentInfo(string.Empty, string.Empty, string.Empty);
        }

        return new UserAgentInfo(Browser(userAgent), Os(userAgent), Device(userAgent));
    }

    // kolejnosc ma znaczenie bo Edge Opera i Samsung udaja Chrome a Chrome udaje Safari
    private static string Browser(string userAgent) => userAgent switch
    {
        _ when Has(userAgent, "Edg/") || Has(userAgent, "EdgA/") || Has(userAgent, "EdgiOS/") => "Edge",
        _ when Has(userAgent, "OPR/") || Has(userAgent, "Opera") => "Opera",
        _ when Has(userAgent, "SamsungBrowser/") => "Samsung Internet",
        _ when Has(userAgent, "Firefox/") || Has(userAgent, "FxiOS/") => "Firefox",
        _ when Has(userAgent, "Chrome/") || Has(userAgent, "CriOS/") => "Chrome",
        _ when Has(userAgent, "Safari/") && Has(userAgent, "Version/") => "Safari",
        _ => Other
    };

    // iPhone i Android podaja tez Mac OS X albo Linux wiec sprawdzamy je pierwsze
    private static string Os(string userAgent) => userAgent switch
    {
        _ when Has(userAgent, "iPhone") || Has(userAgent, "iPad") || Has(userAgent, "iPod") => "iOS",
        _ when Has(userAgent, "Android") => "Android",
        _ when Has(userAgent, "Windows") => "Windows",
        _ when Has(userAgent, "CrOS") => "ChromeOS",
        _ when Has(userAgent, "Macintosh") || Has(userAgent, "Mac OS X") => "macOS",
        _ when Has(userAgent, "Linux") => "Linux",
        _ => Other
    };

    // Android bez Mobile to tablet wedlug wytycznych Google
    private static string Device(string userAgent) => userAgent switch
    {
        _ when Has(userAgent, "iPad") || Has(userAgent, "Tablet")
            || (Has(userAgent, "Android") && !Has(userAgent, "Mobile")) => "tablet",
        _ when Has(userAgent, "Mobi") || Has(userAgent, "iPhone") || Has(userAgent, "iPod") => "mobile",
        _ => "desktop"
    };

    private static bool Has(string value, string fragment) =>
        value.Contains(fragment, StringComparison.OrdinalIgnoreCase);
}
