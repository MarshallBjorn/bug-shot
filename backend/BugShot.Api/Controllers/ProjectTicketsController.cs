using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Tickets;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects/{projectId:guid}/tickets")]
[EnableCors(CorsPolicies.Dashboard)]
[Produces(MediaTypeNames.Application.Json)]
public class ProjectTicketsController(BugShotDbContext db) : ControllerBase
{
    private const int MaxLimit = 100;

    /// <summary>Zwraca strone listy zgloszen projektu.</summary>
    /// <remarks>
    /// Strona wychodzi z kursorem do nastepnej. Ostatnia ma nextCursor pusty.
    /// Z withTotal pierwsza strona dolicza liczbe wszystkich pasujacych. Kolejne zostawiaja total pusty.
    /// Kursor jest nieprzezroczysty i nalezy do tego sortowania z ktorym powstal.
    /// Filtry sa poza kursorem bo tylko zawezaja zbior wiec doladowanie dziala dalej poprawnie.
    /// Bez podanego statusu lista pomija tickety skasowane. Jawne status=Deleted je zwroci.
    /// Szukanie idzie po opisie i adresie strony bez rozroznienia wielkosci liter.
    /// Sortowanie przyjmuje receivedAt:desc receivedAt:asc reportedAt:desc i reportedAt:asc.
    /// Nierozpoznana wartosc wpada w domyslne receivedAt:desc.
    /// </remarks>
    /// <param name="projectId">Projekt ktorego dotyczy lista.</param>
    /// <param name="cancellationToken">Token anulowania zadania.</param>
    /// <param name="status">Filtr statusu. Lista po przecinku na przyklad New,InProgress. Pusty pomija tombstone.</param>
    /// <param name="search">Fraza szukana w opisie i adresie strony.</param>
    /// <param name="page">Znormalizowany adres strony. Pelny link z zapytaniem i kotwica tez przejdzie.</param>
    /// <param name="browser">Rozpoznana przegladarka na przyklad Chrome.</param>
    /// <param name="os">Rozpoznany system na przyklad Windows.</param>
    /// <param name="device">Rozpoznany typ urzadzenia na przyklad desktop.</param>
    /// <param name="hasScreenshot">Zaweza do zgloszen ze zrzutem albo bez niego.</param>
    /// <param name="hasComments">Zaweza do zgloszen z komentarzem albo bez niego.</param>
    /// <param name="dateFrom">Poczatek zakresu po czasie przyjecia. Granica wchodzi do wyniku.</param>
    /// <param name="dateTo">Koniec zakresu po czasie przyjecia. Granica nie wchodzi do wyniku.</param>
    /// <param name="sort">Kolejnosc listy.</param>
    /// <param name="cursor">Kursor z poprzedniej strony. Pusty zaczyna od poczatku listy.</param>
    /// <param name="limit">Rozmiar strony przycinany do 100.</param>
    /// <param name="withTotal">Dolicza liczbe wszystkich pasujacych. Dziala tylko bez kursora.</param>
    [HttpGet]
    [ProducesResponseType<CursorPage<TicketListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CursorPage<TicketListItem>>> GetList(
        Guid projectId,
        CancellationToken cancellationToken,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string? page = null,
        [FromQuery] string? browser = null,
        [FromQuery] string? os = null,
        [FromQuery] string? device = null,
        [FromQuery] bool? hasScreenshot = null,
        [FromQuery] bool? hasComments = null,
        [FromQuery] DateTimeOffset? dateFrom = null,
        [FromQuery] DateTimeOffset? dateTo = null,
        [FromQuery] string sort = TicketSort.DefaultName,
        [FromQuery] string? cursor = null,
        [FromQuery] int limit = 20,
        [FromQuery] bool withTotal = false)
    {
        limit = Math.Clamp(limit, 1, MaxLimit);

        if (!TicketListFilter.TryParseStatuses(status, out var statuses))
        {
            ModelState.AddModelError(nameof(status), "Status must be a comma separated list of known statuses.");
        }

        if (dateFrom is { } start && dateTo is { } end && start >= end)
        {
            ModelState.AddModelError(nameof(dateFrom), "dateFrom must be earlier than dateTo.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var order = TicketSort.Parse(sort);
        TicketListCursor? position = null;

        if (!string.IsNullOrEmpty(cursor))
        {
            if (!TicketListCursor.TryDecode(cursor, out position))
            {
                return Problem(title: "Cursor is malformed.", statusCode: StatusCodes.Status400BadRequest);
            }

            // kursor z innego sortowania wskazuje w innej skali wiec cicho oddalby zle wyniki
            if (position.Sort != order)
            {
                return Problem(
                    title: "Cursor belongs to a different sort order.",
                    statusCode: StatusCodes.Status400BadRequest);
            }
        }

        var filter = TicketListFilter.Create(
            statuses,
            search,
            page,
            browser,
            os,
            device,
            hasScreenshot,
            hasComments,
            dateFrom,
            dateTo);

        var query = filter.Apply(db.Tickets.AsNoTracking().Where(t => t.ProjectId == projectId));

        // licznik idzie tylko przy wejsciu w liste bo przy doladowaniu nie mowi nic nowego
        // a COUNT to dokladnie ten koszt ktory kursor mial zdjac
        int? total = withTotal && position is null
            ? await query.CountAsync(cancellationToken)
            : null;

        // o jeden wiecej niz strona zeby wiedziec czy jest co doladowac
        var items = await Seek(query, order, position)
            .Take(limit + 1)
            .Select(t => new TicketListItem(
                t.Id,
                t.Description,
                t.PageUrl,
                t.Page,
                t.BrowserName,
                t.OsName,
                t.DeviceType,
                t.Status,
                t.ReportedAt,
                t.ReceivedAt,
                t.UpdatedAt,
                t.Comments.Count,
                t.Attachments.Any(a => a.Kind == AttachmentKind.Screenshot)))
            .ToListAsync(cancellationToken);

        if (items.Count <= limit)
        {
            return Ok(new CursorPage<TicketListItem>(items, null, total));
        }

        items.RemoveAt(limit);
        var last = items[^1];

        return Ok(new CursorPage<TicketListItem>(
            items,
            new TicketListCursor(order, SortKey(last, order), last.Id).Encode(),
            total));
    }

    // kursor porownuje sie z ta sama wartoscia po ktorej idzie ORDER BY
    // wiec sortowanie po zgloszeniu schodzi na przyjecie tak samo w obu miejscach
    private static IQueryable<Ticket> Seek(IQueryable<Ticket> query, TicketSort order, TicketListCursor? position)
    {
        var key = position?.Key ?? default;
        var id = position?.Id ?? default;

        if (order.Key == TicketSortKey.ReportedAt)
        {
            if (position is not null)
            {
                query = order.Descending
                    ? query.Where(t => (t.ReportedAt ?? t.ReceivedAt) < key
                        || ((t.ReportedAt ?? t.ReceivedAt) == key && t.Id > id))
                    : query.Where(t => (t.ReportedAt ?? t.ReceivedAt) > key
                        || ((t.ReportedAt ?? t.ReceivedAt) == key && t.Id > id));
            }

            // rowne znaczniki bez domkniecia kolejnosci potrafia powtorzyc ticket na dwoch stronach
            return order.Descending
                ? query.OrderByDescending(t => t.ReportedAt ?? t.ReceivedAt).ThenBy(t => t.Id)
                : query.OrderBy(t => t.ReportedAt ?? t.ReceivedAt).ThenBy(t => t.Id);
        }

        if (position is not null)
        {
            query = order.Descending
                ? query.Where(t => t.ReceivedAt < key || (t.ReceivedAt == key && t.Id > id))
                : query.Where(t => t.ReceivedAt > key || (t.ReceivedAt == key && t.Id > id));
        }

        return order.Descending
            ? query.OrderByDescending(t => t.ReceivedAt).ThenBy(t => t.Id)
            : query.OrderBy(t => t.ReceivedAt).ThenBy(t => t.Id);
    }

    private static DateTimeOffset SortKey(TicketListItem item, TicketSort order) =>
        order.Key == TicketSortKey.ReportedAt ? item.ReportedAt ?? item.ReceivedAt : item.ReceivedAt;
}
