using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record ProjectAnalyticsResponse(
    string Range,
    string TimeZone,
    bool IncludeToday,
    DateTimeOffset? From,
    DateTimeOffset To,
    string Bucket,
    AnalyticsSummary Summary,
    IReadOnlyList<AnalyticsTimelinePoint> Timeline,
    IReadOnlyList<AnalyticsStatusCount> Statuses,
    IReadOnlyList<AnalyticsPageCount> TopPages,
    IReadOnlyList<AnalyticsRisingPage> RisingPages,
    IReadOnlyList<AnalyticsNameCount> Browsers,
    IReadOnlyList<AnalyticsNameCount> OperatingSystems,
    IReadOnlyList<AnalyticsNameCount> Devices,
    IReadOnlyList<AnalyticsSanitizationHit> Sanitization);

public record AnalyticsSummary(
    int NewTickets,
    int? PreviousNewTickets,
    int NewToday,
    int OpenBacklog,
    double? ResolvedRate,
    double? RejectedRate,
    double? ScreenshotRate,
    AnalyticsDuration TimeToResolve,
    AnalyticsDuration TimeToFirstResponse);

public record AnalyticsDuration(double? MedianHours, double? P90Hours, int Samples);

public record AnalyticsTimelinePoint(DateOnly Date, int Created, int Resolved);

public record AnalyticsStatusCount(TicketStatus Status, int Count);

public record AnalyticsPageCount(string Page, int Count);

public record AnalyticsRisingPage(string Page, int Current, int Previous);

public record AnalyticsNameCount(string Name, int Count);

public record AnalyticsSanitizationHit(Guid RuleId, string Pattern, bool IsGlobal, int Matches, int Tickets);
