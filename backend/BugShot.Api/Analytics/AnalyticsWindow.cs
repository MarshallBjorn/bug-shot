namespace BugShot.Api.Analytics;

// zakres to pelne dni kalendarzowe w strefie ogladajacego zeby os czasu nie zaczynala sie od urwanego dnia
// poprzedni okres to tyle samo pelnych dni tuz przed biezacym niezaleznie od tego czy dzisiaj sie liczy
public sealed record AnalyticsWindow(
    string Range,
    string TimeZoneName,
    TimeZoneInfo Zone,
    bool IncludeToday,
    DateTimeOffset? From,
    DateTimeOffset To,
    DateTimeOffset? PreviousFrom,
    DateTimeOffset? PreviousTo,
    DateTimeOffset TodayStart)
{
    public const string DayBucket = "day";

    public const string WeekBucket = "week";

    private static readonly Dictionary<string, int?> Ranges = new()
    {
        ["7d"] = 7,
        ["30d"] = 30,
        ["90d"] = 90,
        ["all"] = null
    };

    // zapytania zawsze porownuja z dolna granica wiec all dostaje date sprzed jakiegokolwiek zgloszenia
    public DateTimeOffset Start => From ?? DateTimeOffset.UnixEpoch;

    // prawie sto punktow dziennych dla 90d jeszcze sie czyta a cala historia dzienna juz nie
    public string Bucket => From is null ? WeekBucket : DayBucket;

    // bez dzisiejszego dnia zakres konczy sie o polnocy wiec ostatnim dniem jest wczoraj
    public DateOnly LastDay => LocalDate(IncludeToday ? To : To.AddTicks(-1));

    public static bool IsRange(string range) => Ranges.ContainsKey(range);

    public static AnalyticsWindow Create(
        string range,
        string timeZoneName,
        TimeZoneInfo zone,
        bool includeToday,
        DateTimeOffset now)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, zone).DateTime);
        var todayStart = Midnight(today, zone);
        var to = includeToday ? now : todayStart;

        if (Ranges[range] is not { } days)
        {
            return new AnalyticsWindow(range, timeZoneName, zone, includeToday, null, to, null, null, todayStart);
        }

        var firstDay = today.AddDays(includeToday ? 1 - days : -days);
        var from = Midnight(firstDay, zone);
        var previousFrom = Midnight(firstDay.AddDays(-days), zone);
        return new AnalyticsWindow(range, timeZoneName, zone, includeToday, from, to, previousFrom, from, todayStart);
    }

    public DateOnly LocalDate(DateTimeOffset moment) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(moment, Zone).DateTime);

    // timestamptz przyjmuje tylko UTC wiec polnoc w strefie od razu schodzi na UTC
    private static DateTimeOffset Midnight(DateOnly day, TimeZoneInfo zone)
    {
        var local = day.ToDateTime(TimeOnly.MinValue);

        return new DateTimeOffset(local, zone.GetUtcOffset(local)).ToUniversalTime();
    }
}
