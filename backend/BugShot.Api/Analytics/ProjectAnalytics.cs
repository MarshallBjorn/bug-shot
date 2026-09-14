using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Analytics;

// agregaty z filtrami i percentyle nie maja sensownego odpowiednika w LINQ wiec metryki licza sie raw SQL
// zakres zawsze idzie po received_at bo reported_at podaje zegar klienta
public static class ProjectAnalytics
{
    private const int TopPageCount = 10;

    private const int RisingPageCount = 5;

    private const int TopNameCount = 8;

    public static async Task<ProjectAnalyticsResponse> ComputeAsync(
        BugShotDbContext db,
        Guid projectId,
        AnalyticsWindow window,
        CancellationToken cancellationToken)
    {
        var from = window.Start;
        var to = window.To;
        var previousFrom = window.PreviousFrom ?? from;
        var previousTo = window.PreviousTo ?? from;
        var timeZone = window.TimeZoneName;
        var bucket = window.Bucket;

        var summary = await db.Database.SqlQuery<SummaryRow>($"""
            select
                count(*)::int as new_tickets,
                count(*) filter (where t.status <> 'deleted')::int as live_tickets,
                count(*) filter (where t.status = 'resolved')::int as resolved_tickets,
                count(*) filter (where t.status = 'rejected')::int as rejected_tickets,
                count(*) filter (where t.received_at >= {window.TodayStart})::int as new_today,
                count(*) filter (
                    where t.status <> 'deleted'
                    and exists (select 1 from ticket_attachments a where a.ticket_id = t.id and a.kind = 'screenshot')
                )::int as with_screenshot,
                (select count(*)::int from tickets p
                    where p.project_id = {projectId} and p.received_at >= {previousFrom} and p.received_at < {previousTo}
                ) as previous_new_tickets,
                (select count(*)::int from tickets o
                    where o.project_id = {projectId} and o.status in ('new', 'in_progress')
                ) as open_backlog
            from tickets t
            where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
            """).SingleAsync(cancellationToken);

        // czas do rozwiazania liczy sie do ostatniego przejscia na resolved bo ponowne otwarcie zeruje poprzednia poprawke
        // pierwsza reakcja to pierwsza zmiana statusu albo pierwszy komentarz zaleznie co bylo wczesniej
        var durations = await db.Database.SqlQuery<DurationRow>($"""
            with scope as (
                select t.id, t.received_at, t.status from tickets t
                where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
            ),
            resolve as (
                select extract(epoch from max(c.changed_at) - s.received_at)::float8 / 3600 as hours
                from scope s
                join ticket_status_changes c on c.ticket_id = s.id and c.to_status = 'resolved'
                where s.status = 'resolved'
                group by s.id, s.received_at
            ),
            first_response as (
                select extract(epoch from least(
                    (select min(c.changed_at) from ticket_status_changes c where c.ticket_id = s.id),
                    (select min(m.created_at) from ticket_comments m where m.ticket_id = s.id)
                ) - s.received_at)::float8 / 3600 as hours
                from scope s
                where s.status <> 'deleted'
            )
            select
                (select percentile_cont(0.5) within group (order by hours) from resolve) as resolve_median,
                (select percentile_cont(0.9) within group (order by hours) from resolve) as resolve_p90,
                (select count(*)::int from resolve) as resolve_samples,
                (select percentile_cont(0.5) within group (order by hours) from first_response where hours is not null) as first_response_median,
                (select percentile_cont(0.9) within group (order by hours) from first_response where hours is not null) as first_response_p90,
                (select count(*)::int from first_response where hours is not null) as first_response_samples
            """).SingleAsync(cancellationToken);

        var created = await db.Database.SqlQuery<BucketRow>($"""
            select date_trunc({bucket}, t.received_at at time zone {timeZone})::date as day, count(*)::int as count
            from tickets t
            where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
            group by 1
            """).ToListAsync(cancellationToken);

        var resolved = await db.Database.SqlQuery<BucketRow>($"""
            select date_trunc({bucket}, c.changed_at at time zone {timeZone})::date as day, count(*)::int as count
            from ticket_status_changes c
            join tickets t on t.id = c.ticket_id
            where t.project_id = {projectId} and c.to_status = 'resolved'
                and c.changed_at >= {from} and c.changed_at < {to}
            group by 1
            """).ToListAsync(cancellationToken);

        var statuses = await db.Database.SqlQuery<NameRow>($"""
            select t.status::text as name, count(*)::int as count
            from tickets t
            where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
            group by t.status
            order by count(*) desc
            """).ToListAsync(cancellationToken);

        // skasowane zgloszenie traci adres i user agenta wiec nie ma go w stronach ani przegladarkach
        var topPages = await db.Database.SqlQuery<NameRow>($"""
            select t.page as name, count(*)::int as count
            from tickets t
            where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
                and t.status <> 'deleted' and t.page <> ''
            group by t.page
            order by count(*) desc, t.page
            limit {TopPageCount}
            """).ToListAsync(cancellationToken);

        var risingPages = window.From is null
            ? []
            : await db.Database.SqlQuery<RisingRow>($"""
                select
                    t.page as page,
                    count(*) filter (where t.received_at >= {from})::int as current_count,
                    count(*) filter (where t.received_at < {previousTo})::int as previous_count
                from tickets t
                where t.project_id = {projectId} and t.received_at >= {previousFrom} and t.received_at < {to}
                    and t.status <> 'deleted' and t.page <> ''
                group by t.page
                having count(*) filter (where t.received_at >= {from}) > count(*) filter (where t.received_at < {previousTo})
                order by count(*) filter (where t.received_at >= {from}) - count(*) filter (where t.received_at < {previousTo}) desc, t.page
                limit {RisingPageCount}
                """).ToListAsync(cancellationToken);

        var environment = await db.Database.SqlQuery<DimensionRow>($"""
            with scope as (
                select t.browser_name, t.os_name, t.device_type from tickets t
                where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
                    and t.status <> 'deleted'
            )
            select 'browser' as dimension, coalesce(nullif(browser_name, ''), {UserAgentParser.Other}) as name, count(*)::int as count
            from scope group by 2
            union all
            select 'os', coalesce(nullif(os_name, ''), {UserAgentParser.Other}), count(*)::int
            from scope group by 2
            union all
            select 'device', coalesce(nullif(device_type, ''), 'unknown'), count(*)::int
            from scope group by 2
            """).ToListAsync(cancellationToken);

        var sanitization = await db.Database.SqlQuery<SanitizationRow>($"""
            select
                r.id as rule_id,
                r.pattern as pattern,
                r.project_id is null as is_global,
                sum(l.match_count)::int as matches,
                count(distinct l.ticket_id)::int as tickets
            from sanitization_logs l
            join tickets t on t.id = l.ticket_id
            join sanitization_rules r on r.id = l.rule_id
            where t.project_id = {projectId} and t.received_at >= {from} and t.received_at < {to}
            group by r.id, r.pattern, r.project_id
            order by sum(l.match_count) desc, r.pattern
            """).ToListAsync(cancellationToken);

        return new ProjectAnalyticsResponse(
            window.Range,
            window.TimeZoneName,
            window.IncludeToday,
            window.From,
            window.To,
            bucket,
            new AnalyticsSummary(
                summary.NewTickets,
                window.From is null ? null : summary.PreviousNewTickets,
                summary.NewToday,
                summary.OpenBacklog,
                Rate(summary.ResolvedTickets, summary.LiveTickets),
                Rate(summary.RejectedTickets, summary.LiveTickets),
                Rate(summary.WithScreenshot, summary.LiveTickets),
                new AnalyticsDuration(Hours(durations.ResolveMedian), Hours(durations.ResolveP90), durations.ResolveSamples),
                new AnalyticsDuration(
                    Hours(durations.FirstResponseMedian),
                    Hours(durations.FirstResponseP90),
                    durations.FirstResponseSamples)),
            Timeline(window, created, resolved),
            statuses.Select(s => new AnalyticsStatusCount(ParseStatus(s.Name), s.Count)).ToList(),
            topPages.Select(p => new AnalyticsPageCount(p.Name, p.Count)).ToList(),
            risingPages.Select(p => new AnalyticsRisingPage(p.Page, p.CurrentCount, p.PreviousCount)).ToList(),
            Dimension(environment, "browser"),
            Dimension(environment, "os"),
            Dimension(environment, "device"),
            sanitization.Select(s => new AnalyticsSanitizationHit(s.RuleId, s.Pattern, s.IsGlobal, s.Matches, s.Tickets)).ToList());
    }

    // baza oddaje tylko kubelki z danymi a wykres potrzebuje tez pustych dni
    private static List<AnalyticsTimelinePoint> Timeline(
        AnalyticsWindow window,
        IReadOnlyList<BucketRow> created,
        IReadOnlyList<BucketRow> resolved)
    {
        var week = window.Bucket == AnalyticsWindow.WeekBucket;
        var createdByDay = created.ToDictionary(r => r.Day, r => r.Count);
        var resolvedByDay = resolved.ToDictionary(r => r.Day, r => r.Count);

        var last = Truncate(window.LastDay, week);
        var first = window.From is { } from
            ? Truncate(window.LocalDate(from), week)
            : createdByDay.Keys.Concat(resolvedByDay.Keys).DefaultIfEmpty(last).Min();

        var points = new List<AnalyticsTimelinePoint>();

        for (var day = first; day <= last; day = day.AddDays(week ? 7 : 1))
        {
            points.Add(new AnalyticsTimelinePoint(
                day,
                createdByDay.GetValueOrDefault(day),
                resolvedByDay.GetValueOrDefault(day)));
        }

        return points;
    }

    // date_trunc w Postgresie zaczyna tydzien od poniedzialku
    private static DateOnly Truncate(DateOnly day, bool week) =>
        week ? day.AddDays(-(((int)day.DayOfWeek + 6) % 7)) : day;

    private static List<AnalyticsNameCount> Dimension(IEnumerable<DimensionRow> rows, string dimension) =>
        rows.Where(r => r.Dimension == dimension)
            .OrderByDescending(r => r.Count)
            .ThenBy(r => r.Name, StringComparer.Ordinal)
            .Take(TopNameCount)
            .Select(r => new AnalyticsNameCount(r.Name, r.Count))
            .ToList();

    // natywny enum schodzi z bazy jako in_progress a kontrakt mowi InProgress
    private static TicketStatus ParseStatus(string value) =>
        Enum.Parse<TicketStatus>(value.Replace("_", string.Empty), ignoreCase: true);

    private static double? Rate(int part, int whole) =>
        whole == 0 ? null : Math.Round((double)part / whole, 4);

    private static double? Hours(double? value) =>
        value is null ? null : Math.Round(value.Value, 1);

    // kolumny wierszy przechodza przez konwencje snake_case tak jak encje wiec aliasy w SQL musza sie z nia zgadzac
    private sealed class SummaryRow
    {
        public int NewTickets { get; set; }

        public int LiveTickets { get; set; }

        public int ResolvedTickets { get; set; }

        public int RejectedTickets { get; set; }

        public int NewToday { get; set; }

        public int WithScreenshot { get; set; }

        public int PreviousNewTickets { get; set; }

        public int OpenBacklog { get; set; }
    }

    private sealed class DurationRow
    {
        public double? ResolveMedian { get; set; }

        public double? ResolveP90 { get; set; }

        public int ResolveSamples { get; set; }

        public double? FirstResponseMedian { get; set; }

        public double? FirstResponseP90 { get; set; }

        public int FirstResponseSamples { get; set; }
    }

    private sealed class BucketRow
    {
        public DateOnly Day { get; set; }

        public int Count { get; set; }
    }

    private sealed class NameRow
    {
        public string Name { get; set; } = string.Empty;

        public int Count { get; set; }
    }

    private sealed class RisingRow
    {
        public string Page { get; set; } = string.Empty;

        public int CurrentCount { get; set; }

        public int PreviousCount { get; set; }
    }

    private sealed class DimensionRow
    {
        public string Dimension { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public int Count { get; set; }
    }

    private sealed class SanitizationRow
    {
        public Guid RuleId { get; set; }

        public string Pattern { get; set; } = string.Empty;

        public bool IsGlobal { get; set; }

        public int Matches { get; set; }

        public int Tickets { get; set; }
    }
}
