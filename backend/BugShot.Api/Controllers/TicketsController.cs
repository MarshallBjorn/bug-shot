using System.Net.Mime;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BugShot.Api.Analytics;
using BugShot.Api.Attachments;
using BugShot.Api.Sanitization;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Idempotency;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/tickets")]
[Produces(MediaTypeNames.Application.Json)]
public class TicketsController(
    BugShotDbContext db,
    AttachmentStorageOptions storage,
    IDistributedCache idempotencyCache,
    ILogger<TicketsController> logger,
    ISanitizationService sanitization) : ControllerBase
{
    private const string IdempotencyKeyHeader = "Idempotency-Key";
    private static readonly TimeSpan IdempotencyTtl = TimeSpan.FromHours(24);

    /// <summary>Przyjmuje zgloszenie z widgetu.</summary>
    /// <remarks>
    /// Zwraca jednorazowy uploadToken do wysylki zalacznikow.
    /// Naglowek Origin musi byc na liscie originow projektu.
    /// Idempotency-Key trzyma wynik przez dobe. Ten sam klucz z innym cialem konczy sie na 409.
    /// </remarks>
    [HttpPost]
    // widget zglasza z cudzej domeny i nie ma skad wziac tokena wiec chroni go Origin i projectKey
    [AllowAnonymous]
    [EnableCors(CorsPolicies.Widget)]
    [ProducesResponseType<CreatedTicketResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CreatedTicketResponse>> Create(
        CreateTicketRequest request,
        CancellationToken cancellationToken)
    {
        var project = await db.Projects
            .Where(p => p.Key == request.ProjectKey)
            .Select(p => new { p.Id, Origins = p.Origins.Select(o => o.Origin).ToList() })
            .SingleOrDefaultAsync(cancellationToken);

        if (project is null)
        {
            ModelState.AddModelError(nameof(request.ProjectKey), "Unknown project key.");
            return ValidationProblem(ModelState);
        }

        var origin = Request.Headers.Origin.ToString();

        // pusta lista originow blokuje wszystko a brak naglowka traktujemy tak samo
        // bo poza przegladarka CORS niczego nie sprawdza
        // przegladarka wysyla origin lowercase ale w project_origins moze wpisac go czlowiek
        if (string.IsNullOrEmpty(origin) || !project.Origins.Contains(origin, StringComparer.OrdinalIgnoreCase))
        {
            return Problem(title: "Origin is not allowed for this project.", statusCode: StatusCodes.Status403Forbidden);
        }

        var idempotencyKey = Request.Headers[IdempotencyKeyHeader].ToString();
        var bodyHash = HashRequestBody(request);

        if (string.IsNullOrEmpty(idempotencyKey))
        {
            logger.LogWarning(
                "POST /tickets bez naglowka {Header}, projectKey={ProjectKey}",
                IdempotencyKeyHeader,
                request.ProjectKey);
        }
        else
        {
            var cached = await idempotencyCache.GetStringAsync(CacheKey(project.Id, idempotencyKey), cancellationToken);

            if (cached is not null)
            {
                var record = JsonSerializer.Deserialize<IdempotencyRecord>(cached)!;

                if (record.BodyHash != bodyHash)
                {
                    return Problem(
                        title: "Idempotency-Key was already used with a different request body.",
                        statusCode: StatusCodes.Status409Conflict);
                }

                return CreatedAtAction(
                    nameof(GetById),
                    new { id = record.TicketId },
                    new CreatedTicketResponse(record.TicketId, record.UploadToken, record.UploadTokenExpiresAt));
            }
        }

        var ticket = new Ticket
        {
            ProjectId = project.Id,
            Description = request.Description,
            PageUrl = request.PageUrl,
            UserAgent = request.UserAgent,
            // timestamptz przyjmuje tylko UTC a klient przysyla swoje przesuniecie
            ReportedAt = request.ReportedAt?.ToUniversalTime(),
            Status = TicketStatus.New
        };

        // rodzina przegladarki niczego nie zdradza wiec liczymy ja z oryginalu zanim sanityzacja cos zamaskuje
        TicketClientDetails.Apply(ticket, request);

        db.Tickets.Add(ticket);

        ticket.Description = await sanitization.SanitizeAsync(
            project.Id,
            ticket.Id,
            nameof(Ticket.Description),
            ticket.Description,
            cancellationToken);

        ticket.PageUrl = await sanitization.SanitizeAsync(
            project.Id,
            ticket.Id,
            nameof(Ticket.PageUrl),
            ticket.PageUrl,
            cancellationToken);

        // strona liczona z zamaskowanego adresu bo inaczej sekret wracalby do bazy w drugiej kolumnie
        ticket.Page = PageAddress.Normalize(ticket.PageUrl);

        ticket.UserAgent = await sanitization.SanitizeAsync(
            project.Id,
            ticket.Id,
            nameof(Ticket.UserAgent),
            ticket.UserAgent,
            cancellationToken);

        var uploadToken = UploadToken.Create();
        var expiresAt = DateTimeOffset.UtcNow.Add(UploadToken.Lifetime);

        db.TicketUploadTokens.Add(new TicketUploadToken
        {
            Ticket = ticket,
            TokenHash = UploadToken.Hash(uploadToken),
            ExpiresAt = expiresAt
        });

        await db.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var record = new IdempotencyRecord(bodyHash, ticket.Id, uploadToken, expiresAt);

            await idempotencyCache.SetStringAsync(
                CacheKey(project.Id, idempotencyKey),
                JsonSerializer.Serialize(record),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = IdempotencyTtl },
                cancellationToken);
        }

        // token wraca w odpowiedzi jeden raz bo w bazie zostaje sam skrot
        return CreatedAtAction(
            nameof(GetById),
            new { id = ticket.Id },
            new CreatedTicketResponse(ticket.Id, uploadToken, expiresAt));
    }

    /// <summary>Zwraca zgloszenie razem z zalacznikami i historia statusow.</summary>
    /// <remarks>Skasowane zgloszenie odpowiada 200 ze statusem Deleted i pustymi polami.</remarks>
    [HttpGet("{id:guid}")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<TicketDetails>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TicketDetails>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new TicketDetails(
                t.Id,
                t.ProjectId,
                t.Project.Key,
                t.Description,
                t.PageUrl,
                t.UserAgent,
                t.Status,
                t.ReportedAt,
                t.ReceivedAt,
                t.CreatedAt,
                t.UpdatedAt,
                Convert.ToBase64String(t.RowVersion),
                t.Attachments
                    .Where(a => a.Kind != AttachmentKind.ConsoleLog)
                    .Select(a => new TicketAttachmentResponse(
                        a.Id,
                        a.Kind,
                        a.FileName,
                        a.ContentType,
                        a.SizeBytes))
                    .ToList(),
                t.Attachments
                    .Where(a => a.Kind == AttachmentKind.ConsoleLog)
                    .Select(a => new TicketAttachmentResponse(
                        a.Id,
                        a.Kind,
                        a.FileName,
                        a.ContentType,
                        a.SizeBytes))
                    .FirstOrDefault(),
                t.Comments.Count,
                t.StatusHistory
                    .OrderBy(h => h.ChangedAt)
                    .Select(h => new TicketStatusChangeResponse(
                        h.FromStatus,
                        h.ToStatus,
                        h.ChangedBy,
                        h.ChangedAt))
                    .ToList()))
            .SingleOrDefaultAsync(cancellationToken);

        return ticket is null ? NotFound() : Ok(ticket);
    }

    /// <summary>Dopisuje komentarz do zgloszenia.</summary>
    /// <remarks>Skasowane zgloszenie konczy sie na 409 bo nie ma juz czego komentowac.</remarks>
    [HttpPost("{id:guid}/comments")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<TicketCommentResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TicketCommentResponse>> AddComment(
        Guid id,
        CreateTicketCommentRequest request,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets
            .AsNoTracking()
            .SingleOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (ticket is null)
        {
            return NotFound();
        }

        // GET na tym samym id zwraca 200 wiec tombstone nie jest brakiem zasobu tylko jego stanem
        if (ticket.Status == TicketStatus.Deleted)
        {
            return TombstoneConflict(ticket);
        }

        var comment = new TicketComment
        {
            TicketId = id,
            Author = request.Author,
            Body = request.Body
        };

        db.TicketComments.Add(comment);

        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetComments),
            new { id },
            new TicketCommentResponse(
                comment.Id,
                comment.Author,
                comment.Body,
                comment.CreatedAt));
    }

    /// <summary>Zwraca strone komentarzy zgloszenia.</summary>
    /// <param name="id">Zgloszenie ktorego dotycza komentarze.</param>
    /// <param name="cancellationToken">Token anulowania zadania.</param>
    /// <param name="page">Numer strony liczony od 1.</param>
    /// <param name="pageSize">Rozmiar strony przycinany do 100.</param>
    [HttpGet("{id:guid}/comments")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<PagedResult<TicketCommentResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResult<TicketCommentResponse>>> GetComments(
        Guid id,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var ticketExists = await db.Tickets
            .AsNoTracking()
            .AnyAsync(t => t.Id == id, cancellationToken);

        if (!ticketExists)
        {
            return NotFound();
        }

        var query = db.TicketComments
            .AsNoTracking()
            .Where(c => c.TicketId == id)
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Id);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new TicketCommentResponse(
                c.Id,
                c.Author,
                c.Body,
                c.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResult<TicketCommentResponse>(
            items,
            total,
            page,
            pageSize));
    }

    /// <summary>Kasuje zgloszenie zostawiajac tombstone.</summary>
    /// <remarks>
    /// Czysci opis adres strony dane przegladarki i komentarze oraz usuwa pliki z wolumenu.
    /// Wiersz zostaje ze statusem Deleted wiec drugie kasowanie tez konczy sie na 204.
    /// </remarks>
    [HttpDelete("{id:guid}")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets
            .SingleOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (ticket is null)
        {
            return NotFound();
        }

        // kasowanie jest idempotentne wiec powtorka nie dopisuje historii ani nie nadpisuje deleted_at
        if (ticket.Status == TicketStatus.Deleted)
        {
            return NoContent();
        }

        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;

        // token przestaje byc wazny bo inaczej wysylka moze dokleic plik do tombstone
        // aktualizacja blokuje te wiersze wiec wysylka w locie zatrzymuje sie tutaj
        await db.TicketUploadTokens
            .Where(t => t.TicketId == id && t.UsedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(t => t.ExpiresAt, now), cancellationToken);

        // zalaczniki czytamy dopiero po blokadzie zeby zobaczyc te z wysylki ktora wlasnie sie domknela
        await db.Entry(ticket).Collection(t => t.Attachments).LoadAsync(cancellationToken);
        await db.Entry(ticket).Collection(t => t.Comments).LoadAsync(cancellationToken);

        var attachmentPaths = ticket.Attachments
            .Select(a => Path.GetFileName(a.Uri))
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => Path.Combine(storage.RootPath, name))
            .ToList();

        var fromStatus = ticket.Status;

        ticket.Description = string.Empty;
        ticket.PageUrl = string.Empty;
        ticket.UserAgent = string.Empty;
        TicketClientDetails.Clear(ticket);
        ticket.Status = TicketStatus.Deleted;
        ticket.DeletedAt = now;
        ticket.DeletedBy = "system";

        db.TicketStatusChanges.Add(new TicketStatusChange
        {
            TicketId = ticket.Id,
            FromStatus = fromStatus,
            ToStatus = TicketStatus.Deleted,
            ChangedBy = "system",
            ChangedAt = now
        });

        db.TicketComments.RemoveRange(ticket.Comments);
        db.TicketAttachments.RemoveRange(ticket.Attachments);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        foreach (var attachmentPath in attachmentPaths)
        {
            try
            {
                System.IO.File.Delete(attachmentPath);
            }
            // tombstone jest juz zapisany wiec nieudane sprzatniecie pliku nie moze wywalic zadania
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(
                    exception,
                    "Nie udalo sie usunac pliku {Path} przy kasowaniu zgloszenia {TicketId}",
                    attachmentPath,
                    ticket.Id);
            }
        }

        return NoContent();
    }

    /// <summary>Zmienia status zgloszenia.</summary>
    /// <remarks>
    /// Wymaga naglowka If-Match z rowVersion z ostatniego odczytu. Brak naglowka konczy sie na 428.
    /// Nieaktualna wersja konczy sie na 409 i niczego nie zapisuje.
    /// Kazda zmiana zostawia wpis w historii statusow.
    /// </remarks>
    [HttpPatch("{id:guid}/status")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<TicketStatusResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<ActionResult<TicketStatusResponse>> UpdateStatus(
        Guid id,
        UpdateTicketStatusRequest request,
        [FromHeader(Name = "If-Match")] string? ifMatch,
        CancellationToken cancellationToken)
    {
        var newStatus = request.Status!.Value;

        if (newStatus == TicketStatus.Deleted)
        {
            ModelState.AddModelError(nameof(request.Status), "Use DELETE /tickets/{id} to delete a ticket.");
            return ValidationProblem(ModelState);
        }

        var ticket = await db.Tickets.SingleOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (ticket is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(ifMatch))
        {
            return Problem(
                title: "If-Match with the rowVersion from the last GET is required.",
                statusCode: StatusCodes.Status428PreconditionRequired);
        }

        // rowVersion wychodzi jako goly base64 ale klient moze opakowac go w cudzyslowy etaga
        var expected = ifMatch.Trim().Trim('"');

        if (!string.Equals(expected, Convert.ToBase64String(ticket.RowVersion), StringComparison.Ordinal))
        {
            return VersionConflict(ticket);
        }

        // tombstone stracil juz swoje dane wiec powrot do zywego statusu niczego nie odtworzy
        if (ticket.Status == TicketStatus.Deleted)
        {
            return TombstoneConflict(ticket);
        }

        // ten sam status nie jest zmiana wiec nie ma czego zapisac w historii
        if (ticket.Status == newStatus)
        {
            return Ok(StatusResponse(ticket));
        }

        var fromStatus = ticket.Status;
        ticket.Status = newStatus;

        var statusChange = new TicketStatusChange
        {
            TicketId = ticket.Id,
            FromStatus = fromStatus,
            ToStatus = newStatus,
            ChangedBy = request.ChangedBy,
            ChangedAt = DateTimeOffset.UtcNow
        };

        db.TicketStatusChanges.Add(statusChange);

        try
        {
            // row_version jest tokenem wspolbieznosci wiec update trafia tylko w wersje ktora czytalismy
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // zapis nie przeszedl wiec wpis historii nie ma juz czego opisywac
            db.Entry(statusChange).State = EntityState.Detached;

            var entry = db.Entry(ticket);
            await entry.ReloadAsync(cancellationToken);

            return entry.State == EntityState.Detached ? NotFound() : VersionConflict(ticket);
        }

        return Ok(StatusResponse(ticket));
    }

    private static string CacheKey(Guid projectId, string idempotencyKey) =>
        $"idempotency:tickets:{projectId}:{idempotencyKey}";

    // skrot liczony z modelu po zbindowaniu bo strumien ciala jest juz wtedy przeczytany
    private static string HashRequestBody(CreateTicketRequest request)
    {
        var json = JsonSerializer.Serialize(request);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
    }

    private static TicketStatusResponse StatusResponse(Ticket ticket) => new(
        ticket.Id,
        ticket.Status,
        Convert.ToBase64String(ticket.RowVersion),
        ticket.UpdatedAt);

    // konflikt oddaje aktualny stan zeby dashboard odswiezyl sie bez dodatkowego GET
    private ObjectResult VersionConflict(Ticket ticket) =>
        ConflictWithState(ticket, "Ticket was changed by another request.");

    // tombstone jest do odczytu wiec kazdy zapis na nim jest konfliktem ze stanem zasobu
    private ObjectResult TombstoneConflict(Ticket ticket) =>
        ConflictWithState(ticket, "Deleted ticket cannot be modified.");

    private ObjectResult ConflictWithState(Ticket ticket, string title)
    {
        var conflict = Problem(title: title, statusCode: StatusCodes.Status409Conflict);

        var details = (ProblemDetails)conflict.Value!;
        details.Extensions["currentStatus"] = ticket.Status;
        details.Extensions["rowVersion"] = Convert.ToBase64String(ticket.RowVersion);

        return conflict;
    }
}
