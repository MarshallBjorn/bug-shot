namespace BugShot.Api.Analytics;

public static class PageAddress
{
    // zapytanie i fragment wypadaja bo utm i kotwice rozbijalyby jedna strone na kilka
    // calosc schodzi do malych liter tak samo jak w migracji uzupelniajacej stare zgloszenia
    public static string Normalize(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return string.Empty;
        }

        var value = url.Trim();

        var cut = value.IndexOfAny(['?', '#']);

        if (cut >= 0)
        {
            value = value[..cut];
        }

        var scheme = value.IndexOf("://", StringComparison.Ordinal);

        if (scheme >= 0)
        {
            value = value[(scheme + 3)..];
        }

        return value.TrimEnd('/').ToLowerInvariant();
    }
}
