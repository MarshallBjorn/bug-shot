using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Sanitization;

public sealed class SanitizationService(BugShotDbContext db) : ISanitizationService
{
    public async Task<string> SanitizeAsync(
        Guid projectId,
        Guid ticketId,
        string fieldName,
        string value,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        var globalRules = await db.SanitizationRules
            .AsNoTracking()
            .Where(r => r.ProjectId == null && r.IsEnabled)
            .ToListAsync(cancellationToken);

        var projectRules = await db.SanitizationRules
            .AsNoTracking()
            .Where(r => r.ProjectId == projectId && r.IsEnabled)
            .ToListAsync(cancellationToken);

        var overriddenPatterns = projectRules
            .Select(r => r.Pattern)
            .ToHashSet(StringComparer.Ordinal);

        var effectiveRules = globalRules
            .Where(r => !overriddenPatterns.Contains(r.Pattern))
            .Concat(projectRules)
            .OrderBy(r => r.CreatedAt)
            .ThenBy(r => r.Id)
            .ToList();

        foreach (var rule in effectiveRules)
        {
            if (!RegexRule.TryApply(rule.Pattern, rule.Replacement, value, out var replaced, out var matchCount))
                continue;

            if (matchCount == 0)
                continue;

            value = replaced;

            db.SanitizationLogs.Add(new SanitizationLog
            {
                TicketId = ticketId,
                RuleId = rule.Id,
                FieldName = fieldName,
                MatchCount = matchCount
            });
        }

        return value;
    }
}
