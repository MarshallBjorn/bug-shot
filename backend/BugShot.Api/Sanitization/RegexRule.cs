using System.Text.RegularExpressions;

namespace BugShot.Api.Sanitization;

// wspolna logika stosowania jednej reguly, uzywana przy sanityzacji ticketow i przy tescie reguly w panelu
public static class RegexRule
{
    public static readonly TimeSpan Timeout = TimeSpan.FromMilliseconds(100);

    public static bool IsValidPattern(string pattern)
    {
        try
        {
            _ = new Regex(pattern, RegexOptions.CultureInvariant, Timeout);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    // false oznacza niepoprawny wzorzec albo timeout dopasowania, wtedy result i matchCount nie licza sie
    public static bool TryApply(string pattern, string replacement, string value, out string result, out int matchCount)
    {
        result = value;
        matchCount = 0;

        Regex regex;

        try
        {
            regex = new Regex(pattern, RegexOptions.CultureInvariant, Timeout);
        }
        catch (ArgumentException)
        {
            return false;
        }

        MatchCollection matches;

        try
        {
            matches = regex.Matches(value);
        }
        catch (RegexMatchTimeoutException)
        {
            return false;
        }

        if (matches.Count == 0)
        {
            return true;
        }

        result = regex.Replace(value, replacement);
        matchCount = matches.Count;

        return true;
    }
}
