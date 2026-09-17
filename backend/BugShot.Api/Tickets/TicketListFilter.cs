using BugShot.Api.Analytics;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tickets;

// filtry tylko zawezaja zbior wiec kursor policzony przy jednym zestawie dziala dalej przy innym
public sealed record TicketListFilter
{
    private TicketListFilter()
    {
    }

    public IReadOnlyList<TicketStatus> Statuses { get; private init; } = [];

    public string? Search { get; private init; }

    public string? Page { get; private init; }

    public string? Browser { get; private init; }

    public string? Os { get; private init; }

    public string? Device { get; private init; }

    public bool? HasScreenshot { get; private init; }

    public bool? HasComments { get; private init; }

    public DateTimeOffset? From { get; private init; }

    public DateTimeOffset? To { get; private init; }

    // statusy przychodza lista po przecinku wiec pojedyncza wartosc dalej dziala tak jak wczesniej
    public static bool TryParseStatuses(string? value, out IReadOnlyList<TicketStatus> statuses)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            statuses = [];
            return true;
        }

        var parsed = new List<TicketStatus>();

        foreach (var part in value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (!Enum.TryParse<TicketStatus>(part, ignoreCase: true, out var status))
            {
                statuses = [];
                return false;
            }

            if (!parsed.Contains(status))
            {
                parsed.Add(status);
            }
        }

        statuses = parsed;
        return true;
    }

    public static TicketListFilter Create(
        IReadOnlyList<TicketStatus> statuses,
        string? search,
        string? page,
        string? browser,
        string? os,
        string? device,
        bool? hasScreenshot,
        bool? hasComments,
        DateTimeOffset? dateFrom,
        DateTimeOffset? dateTo) => new()
        {
            Statuses = statuses,
            Search = Trimmed(search),
            // adres przechodzi ta sama normalizacje co przy przyjeciu zgloszenia
            // wiec do filtra da sie wkleic pelny link z zapytaniem i kotwica
            Page = Trimmed(page) is { } value ? PageAddress.Normalize(value) : null,
            Browser = Trimmed(browser),
            Os = Trimmed(os),
            Device = Trimmed(device),
            HasScreenshot = hasScreenshot,
            HasComments = hasComments,
            From = dateFrom,
            To = dateTo
        };

    public IQueryable<Ticket> Apply(IQueryable<Ticket> query)
    {
        if (Statuses.Count > 0)
        {
            var statuses = Statuses;
            query = query.Where(t => statuses.Contains(t.Status));
        }
        else
        {
            // tombstone nie ma czego pokazac na liscie
            query = query.Where(t => t.Status != TicketStatus.Deleted);
        }

        if (Search is { } search)
        {
            var pattern = $"%{search}%";
            query = query.Where(t => EF.Functions.ILike(t.Description, pattern) || EF.Functions.ILike(t.PageUrl, pattern));
        }

        if (Page is { } page)
        {
            query = query.Where(t => t.Page == page);
        }

        // rozpoznane nazwy sa kanoniczne ale adres bywa pisany rekami wiec porownanie pomija wielkosc liter
        if (Browser is { } browser)
        {
            query = query.Where(t => EF.Functions.ILike(t.BrowserName, browser));
        }

        if (Os is { } os)
        {
            query = query.Where(t => EF.Functions.ILike(t.OsName, os));
        }

        if (Device is { } device)
        {
            query = query.Where(t => EF.Functions.ILike(t.DeviceType, device));
        }

        if (HasScreenshot is { } hasScreenshot)
        {
            query = hasScreenshot
                ? query.Where(t => t.Attachments.Any(a => a.Kind == AttachmentKind.Screenshot))
                : query.Where(t => !t.Attachments.Any(a => a.Kind == AttachmentKind.Screenshot));
        }

        if (HasComments is { } hasComments)
        {
            query = hasComments
                ? query.Where(t => t.Comments.Any())
                : query.Where(t => !t.Comments.Any());
        }

        // zakres idzie po received_at bo reported_at podaje zegar klienta
        // przedzial jest domkniety z lewej i otwarty z prawej wiec kolejne dni nie nachodza na siebie
        if (From is { } from)
        {
            query = query.Where(t => t.ReceivedAt >= from);
        }

        if (To is { } to)
        {
            query = query.Where(t => t.ReceivedAt < to);
        }

        return query;
    }

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
