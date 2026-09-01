using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects/{projectId:guid}/tickets")]
[EnableCors(CorsPolicies.Dashboard)]
public class ProjectTicketsController(BugShotDbContext db) : ControllerBase
{
    private const int MaxPageSize = 100;

    [HttpGet]
    public async Task<ActionResult<PagedResult<TicketListItem>>> GetList(
        Guid projectId,
        CancellationToken cancellationToken,
        [FromQuery] TicketStatus? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string sort = "receivedAt:desc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.Tickets.AsNoTracking().Where(t => t.ProjectId == projectId);

        if (status is not null)
        {
            query = query.Where(t => t.Status == status);
        }
        else
        {
            // tombstone nie ma czego pokazac na liscie
            query = query.Where(t => t.Status != TicketStatus.Deleted);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(t => EF.Functions.ILike(t.Description, pattern) || EF.Functions.ILike(t.PageUrl, pattern));
        }

        var ordered = sort switch
        {
            "receivedAt:asc" => query.OrderBy(t => t.ReceivedAt),
            // brak reportedAt schodzi na receivedAt bo taka date pokazuje lista
            "reportedAt:desc" => query.OrderByDescending(t => t.ReportedAt ?? t.ReceivedAt),
            "reportedAt:asc" => query.OrderBy(t => t.ReportedAt ?? t.ReceivedAt),
            _ => query.OrderByDescending(t => t.ReceivedAt)
        };

        // rowne znaczniki bez domkniecia kolejnosci potrafia powtorzyc ticket na dwoch stronach
        query = ordered.ThenBy(t => t.Id);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TicketListItem(t.Id, t.Description, t.PageUrl, t.Status, t.ReportedAt, t.ReceivedAt, t.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResult<TicketListItem>(items, total, page, pageSize));
    }
}
