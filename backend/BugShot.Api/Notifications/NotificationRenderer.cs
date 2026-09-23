using System.Text.RegularExpressions;
using BugShot.Api.Models;

namespace BugShot.Api.Notifications;

public sealed record NotificationRenderResult(
    string Content,
    IReadOnlyList<string> MissingTokens);

public interface INotificationRenderer
{
    NotificationRenderResult Render(
        string template,
        NotificationEventType eventType,
        Project project,
        Ticket ticket,
        TicketComment? comment = null,
        TicketStatusChange? statusChange = null);
}

public sealed partial class NotificationRenderer : INotificationRenderer
{
    [GeneratedRegex(@"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")]
    private static partial Regex TokenRegex();

    public NotificationRenderResult Render(
        string template,
        NotificationEventType eventType,
        Project project,
        Ticket ticket,
        TicketComment? comment = null,
        TicketStatusChange? statusChange = null)
    {
        if (string.IsNullOrEmpty(template))
        {
            return new NotificationRenderResult(
                string.Empty,
                Array.Empty<string>());
        }

        var missingTokens = new List<string>();

        var content = TokenRegex().Replace(template, match =>
        {
            var token = match.Groups[1].Value;
            var resolution = ResolveToken(
                token,
                eventType,
                project,
                ticket,
                comment,
                statusChange);

            if (!resolution.IsKnown)
            {
                missingTokens.Add(token);
                return string.Empty;
            }

            return resolution.Value ?? string.Empty;
        });

        return new NotificationRenderResult(
            content,
            missingTokens.Distinct(StringComparer.OrdinalIgnoreCase).ToArray());
    }

    private static TokenResolution ResolveToken(
        string token,
        NotificationEventType eventType,
        Project project,
        Ticket ticket,
        TicketComment? comment,
        TicketStatusChange? statusChange)
    {
        var normalized = token.ToLowerInvariant();

        return normalized switch
        {
            "project.id" =>
                Known(project.Id.ToString()),

            "project.name" =>
                Known(project.Name),

            "project.key" =>
                Known(project.Key),

            "ticket.id" =>
                Known(ticket.Id.ToString()),

            "ticket.description" =>
                Known(ticket.Description),

            "ticket.pageurl" =>
                Known(ticket.PageUrl),

            "ticket.status" =>
                Known(ticket.Status.ToString()),

            "ticket.reportedat" =>
                Known(ticket.ReportedAt?.ToString("O")),

            "comment.author" when eventType == NotificationEventType.CommentAdded =>
                Known(comment?.Author),

            "comment.body" when eventType == NotificationEventType.CommentAdded =>
                Known(comment?.Body),

            "status.from" when eventType == NotificationEventType.StatusChanged =>
                Known(statusChange?.FromStatus.ToString()),

            "status.to" when eventType == NotificationEventType.StatusChanged =>
                Known(statusChange?.ToStatus.ToString()),

            "status.changedby" when eventType == NotificationEventType.StatusChanged =>
                Known(statusChange?.ChangedBy),

            _ =>
                Missing()
        };
    }

    private static TokenResolution Known(string? value)
        => new(true, value);

    private static TokenResolution Missing()
        => new(false, null);

    private readonly record struct TokenResolution(
        bool IsKnown,
        string? Value);
}
