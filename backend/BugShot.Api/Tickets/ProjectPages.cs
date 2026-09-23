using BugShot.Api.Contracts;
using BugShot.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tickets;

// agregat po stronie idzie raw SQL tak samo jak topPages w analityce bo count filter nie ma odpowiednika w LINQ
public static class ProjectPages
{
    public const int DefaultLimit = 200;

    public const int MaxLimit = 1000;

    public static async Task<IReadOnlyList<ProjectPageCount>> ListAsync(
        BugShotDbContext db,
        Guid projectId,
        int limit,
        CancellationToken cancellationToken)
    {
        // skasowane zgloszenie traci adres wiec wpadloby do jednej grupy z pustym page
        var rows = await db.Database.SqlQuery<PageRow>($"""
            select
                t.page as page,
                count(*)::int as total,
                count(*) filter (where t.status = 'new')::int as new_count,
                count(*) filter (where t.status = 'in_progress')::int as in_progress_count,
                count(*) filter (where t.status = 'resolved')::int as resolved_count,
                count(*) filter (where t.status = 'rejected')::int as rejected_count
            from tickets t
            where t.project_id = {projectId} and t.status <> 'deleted' and t.page <> ''
            group by t.page
            order by count(*) desc, t.page
            limit {limit}
            """).ToListAsync(cancellationToken);

        return rows
            .Select(r => new ProjectPageCount(
                r.Page,
                r.Total,
                r.NewCount,
                r.InProgressCount,
                r.ResolvedCount,
                r.RejectedCount))
            .ToList();
    }

    // aliasy w SQL musza zgadzac sie z konwencja snake_case tak samo jak kolumny encji
    private sealed class PageRow
    {
        public string Page { get; set; } = string.Empty;

        public int Total { get; set; }

        public int NewCount { get; set; }

        public int InProgressCount { get; set; }

        public int ResolvedCount { get; set; }

        public int RejectedCount { get; set; }
    }
}
