using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BugShot.Api.Attachments;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Idempotency;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/tickets")]
public class TicketsController(
    BugShotDbContext db,
    AttachmentStorageOptions storage,
    IDistributedCache idempotencyCache,
    ILogger<TicketsController> logger) : ControllerBase
{
    private const string IdempotencyKeyHeader = "Idempotency-Key";
    private static readonly TimeSpan IdempotencyTtl = TimeSpan.FromHours(24);

    [HttpPost]
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

        db.Tickets.Add(ticket);

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

    [HttpGet("{id:guid}")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<TicketDetails>(StatusCodes.Status200OK)]
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
                        a.Uri,
                        a.FileName,
                        a.ContentType,
                        a.SizeBytes))
                    .ToList(),
                t.Attachments
                    .Where(a => a.Kind == AttachmentKind.ConsoleLog)
                    .Select(a => a.Uri)
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

    [HttpPost("{id:guid}/comments")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<TicketCommentResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TicketCommentResponse>> AddComment(
        Guid id,
        CreateTicketCommentRequest request,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets
            .Where(t => t.Id == id)
            .Select(t => new { t.Status })
            .SingleOrDefaultAsync(cancellationToken);

        if (ticket is null || ticket.Status == TicketStatus.Deleted)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Author))
        {
            ModelState.AddModelError(nameof(request.Author), "Comment author cannot be empty.");
            return ValidationProblem(ModelState);
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            ModelState.AddModelError(nameof(request.Body), "Comment body cannot be empty.");
            return ValidationProblem(ModelState);
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

    [HttpGet("{id:guid}/comments")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType<PagedResult<TicketCommentResponse>>(StatusCodes.Status200OK)]
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

    [HttpDelete("{id:guid}")]
    [EnableCors(CorsPolicies.Dashboard)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid id,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets
            .Include(t => t.Attachments)
            .Include(t => t.Comments)
            .SingleOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (ticket is null)
        {
            return NotFound();
        }

        var attachmentPaths = ticket.Attachments
            .Select(a => Path.GetFileName(a.Uri))
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => Path.Combine(storage.RootPath, name))
            .ToList();

        var fromStatus = ticket.Status;

        ticket.Description = string.Empty;
        ticket.PageUrl = string.Empty;
        ticket.UserAgent = string.Empty;
        ticket.Status = TicketStatus.Deleted;
        ticket.DeletedAt = DateTimeOffset.UtcNow;
        ticket.DeletedBy = "system";

        db.TicketStatusChanges.Add(new TicketStatusChange
        {
            TicketId = ticket.Id,
            FromStatus = fromStatus,
            ToStatus = TicketStatus.Deleted,
            ChangedBy = "system",
            ChangedAt = DateTimeOffset.UtcNow
        });

        await using var transaction =
            await db.Database.BeginTransactionAsync(cancellationToken);

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
            catch (DirectoryNotFoundException)
            {
                // DB tombstone has already been committed.
            }
            catch (IOException)
            {
                // DB tombstone has already been committed.
            }
        }

        return NoContent();
    }

    private static string CacheKey(Guid projectId, string idempotencyKey) =>
        $"idempotency:tickets:{projectId}:{idempotencyKey}";

    // skrot liczony z modelu po zbindowaniu bo strumien ciala jest juz wtedy przeczytany
    private static string HashRequestBody(CreateTicketRequest request)
    {
        var json = JsonSerializer.Serialize(request);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
    }
}
