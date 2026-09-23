using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects/{projectId:guid}/templates")]
[EnableCors(CorsPolicies.Dashboard)]
[ProjectAccess(ProjectRole.Maintainer)]
[Produces(MediaTypeNames.Application.Json)]
public class ProjectNotificationTemplatesController(BugShotDbContext db) : ControllerBase
{
    /// <summary>Returns notification templates for the project, including inherited global templates.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<NotificationTemplateResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<NotificationTemplateResponse>>> GetList(
        Guid projectId,
        CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var templates = await db.NotificationTemplates
            .AsNoTracking()
            .Where(t => t.ProjectId == null || t.ProjectId == projectId)
            .OrderBy(t => t.EventType)
            .ThenBy(t => t.ChannelType)
            .ToListAsync(cancellationToken);

        var resolved = templates
            .GroupBy(t => new { t.EventType, t.ChannelType })
            .Select(group => group
                .OrderByDescending(t => t.ProjectId.HasValue)
                .First())
            .Select(t => new NotificationTemplateResponse(
                t.Id,
                t.ProjectId,
                t.EventType,
                t.ChannelType,
                t.Subject,
                t.Body,
                t.CreatedAt))
            .ToList();

        return Ok(resolved);
    }

    /// <summary>Tworzy lub aktualizuje projektowe nadpisanie szablonu powiadomienia.</summary>
    [HttpPut("{eventType}/{channelType}")]
    [ProducesResponseType<NotificationTemplateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NotificationTemplateResponse>> Upsert(
        Guid projectId,
        NotificationEventType eventType,
        NotificationChannelType channelType,
        UpsertNotificationTemplateRequest request,
        CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var template = await db.NotificationTemplates
            .SingleOrDefaultAsync(
                t => t.ProjectId == projectId
                    && t.EventType == eventType
                    && t.ChannelType == channelType,
                cancellationToken);

        if (template is null)
        {
            template = new NotificationTemplate
            {
                ProjectId = projectId,
                EventType = eventType,
                ChannelType = channelType,
                Subject = request.Subject?.Trim(),
                Body = request.Body.Trim()
            };

            db.NotificationTemplates.Add(template);
        }
        else
        {
            template.Subject = request.Subject?.Trim();
            template.Body = request.Body.Trim();
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new NotificationTemplateResponse(
            template.Id,
            template.ProjectId,
            template.EventType,
            template.ChannelType,
            template.Subject,
            template.Body,
            template.CreatedAt));
    }
}
