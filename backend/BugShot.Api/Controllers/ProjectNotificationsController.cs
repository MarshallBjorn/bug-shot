using System.ComponentModel.DataAnnotations;
using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Notifications.Webhooks;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects/{projectId:guid}/notifications")]
[EnableCors(CorsPolicies.Dashboard)]
[Authorize(Roles = AccessTokenIssuer.AdminRole)]
[Produces(MediaTypeNames.Application.Json)]
public class ProjectNotificationsController(BugShotDbContext db, IWebhookSender webhookSender) : ControllerBase
{
    private static readonly EmailAddressAttribute EmailValidator = new();

    /// <summary>Returns notification channels.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<NotificationChannelResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<NotificationChannelResponse>>> GetList(
        Guid projectId,
        CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var channels = await db.NotificationChannels
            .AsNoTracking()
            .Where(c => c.ProjectId == projectId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => MapToResponse(c))
            .ToListAsync(cancellationToken);

        return Ok(channels);
    }

    /// <summary>Tworzy kanaĹ‚ powiadomieĹ„.</summary>
    /// <remarks>Admin only. Validates addresses, types, and throttling configuration.</remarks>
    [HttpPost]
    [ProducesResponseType<NotificationChannelResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NotificationChannelResponse>> Create(
        Guid projectId,
        CreateNotificationChannelRequest request,
        CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        ValidateChannelParameters(
            request.Type,
            request.EmailAddress,
            request.WebhookUrl,
            request.ThrottleWindowSeconds,
            request.ThrottleMaxEvents);

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var channel = new NotificationChannel
        {
            ProjectId = projectId,
            Type = request.Type!.Value,
            IsEnabled = request.IsEnabled,
            EmailAddress = request.Type == NotificationChannelType.Email
                ? request.EmailAddress?.Trim()
                : null,
            WebhookUrl = request.Type == NotificationChannelType.Webhook
                ? request.WebhookUrl?.Trim()
                : null,
            WebhookSecret = request.Type == NotificationChannelType.Webhook
                ? request.WebhookSecret?.Trim()
                : null,
            ThrottleWindowSeconds = request.ThrottleWindowSeconds,
            ThrottleMaxEvents = request.ThrottleMaxEvents
        };

        db.NotificationChannels.Add(channel);
        await db.SaveChangesAsync(cancellationToken);

        return Created((string?)null, MapToResponse(channel));
    }

    /// <summary>Aktualizuje kanaĹ‚ powiadomieĹ„.</summary>
    /// <remarks>Tylko dla administratora. Typ kanaĹ‚u pozostaje niezmienny.</remarks>
    [HttpPut("{channelId:guid}")]
    [ProducesResponseType<NotificationChannelResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NotificationChannelResponse>> Update(
        Guid projectId,
        Guid channelId,
        UpdateNotificationChannelRequest request,
        CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var channel = await db.NotificationChannels
            .SingleOrDefaultAsync(
                c => c.Id == channelId && c.ProjectId == projectId,
                cancellationToken);

        if (channel is null)
        {
            return NotFound();
        }

        ValidateChannelParameters(
            channel.Type,
            request.EmailAddress,
            request.WebhookUrl,
            request.ThrottleWindowSeconds,
            request.ThrottleMaxEvents);

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        channel.IsEnabled = request.IsEnabled;

        if (channel.Type == NotificationChannelType.Email)
        {
            channel.EmailAddress = request.EmailAddress?.Trim();
        }

        if (channel.Type == NotificationChannelType.Webhook)
        {
            channel.WebhookUrl = request.WebhookUrl?.Trim();

            if (!string.IsNullOrWhiteSpace(request.WebhookSecret))
            {
                channel.WebhookSecret = request.WebhookSecret.Trim();
            }
        }

        channel.ThrottleWindowSeconds = request.ThrottleWindowSeconds;
        channel.ThrottleMaxEvents = request.ThrottleMaxEvents;

        await db.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(channel));
    }

    /// <summary>Usuwa kanaĹ‚ powiadomieĹ„.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    [HttpDelete("{channelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid projectId,
        Guid channelId,
        CancellationToken cancellationToken)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var channel = await db.NotificationChannels
            .SingleOrDefaultAsync(
                c => c.Id == channelId && c.ProjectId == projectId,
                cancellationToken);

        if (channel is null)
        {
            return NotFound();
        }

        db.NotificationChannels.Remove(channel);
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>Wysyła testowe zdarzenie webhooka dla kanału projektu.</summary>
    [HttpPost("{channelId:guid}/test")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SendTestWebhook(
        Guid projectId,
        Guid channelId,
        CancellationToken cancellationToken)
    {
        var channel = await db.NotificationChannels
            .SingleOrDefaultAsync(
                c => c.Id == channelId && c.ProjectId == projectId,
                cancellationToken);

        if (channel is null)
        {
            return NotFound();
        }

        if (channel.Type != NotificationChannelType.Webhook)
        {
            ModelState.AddModelError(
                nameof(channelId),
                "Test event is available only for webhook channels.");

            return ValidationProblem(ModelState);
        }

        if (!channel.IsEnabled)
        {
            ModelState.AddModelError(
                nameof(channelId),
                "The webhook channel is disabled.");

            return ValidationProblem(ModelState);
        }

        if (string.IsNullOrWhiteSpace(channel.WebhookUrl))
        {
            ModelState.AddModelError(
                nameof(channelId),
                "The webhook channel has no URL.");

            return ValidationProblem(ModelState);
        }

        var deliveryId = Guid.NewGuid();

        var payload = $$"""
        {
          "eventId": "{{Guid.NewGuid()}}",
          "eventType": "test",
          "projectId": "{{projectId}}",
          "message": "BugShot test webhook",
          "createdAt": "{{DateTimeOffset.UtcNow:O}}"
        }
        """;

        await webhookSender.SendWebhookAsync(
            channel.WebhookUrl,
            channel.WebhookSecret,
            deliveryId,
            NotificationEventType.TicketCreated,
            payload,
            cancellationToken);

        return NoContent();
    }
    private void ValidateChannelParameters(
        NotificationChannelType? type,
        string? emailAddress,
        string? webhookUrl,
        int? throttleWindowSeconds,
        int? throttleMaxEvents)
    {
        if (type == NotificationChannelType.Email)
        {
            if (string.IsNullOrWhiteSpace(emailAddress) || !EmailValidator.IsValid(emailAddress))
            {
                ModelState.AddModelError(
                    nameof(emailAddress),
                    "A valid email address is required for email channels.");
            }
        }

        if (type == NotificationChannelType.Webhook)
        {
            if (string.IsNullOrWhiteSpace(webhookUrl))
            {
                ModelState.AddModelError(
                    nameof(webhookUrl),
                    "Webhook URL is required for webhook channels.");
            }

            if (!string.IsNullOrWhiteSpace(webhookUrl))
            {
                try
                {
                    SsrfProtection.ValidateWebhookUri(webhookUrl);
                }
                catch (Exception ex)
                {
                    ModelState.AddModelError(nameof(webhookUrl), ex.Message);
                }
            }
        }

        if (type is not NotificationChannelType.Email
            and not NotificationChannelType.Webhook)
        {
            ModelState.AddModelError(nameof(type), "Invalid channel type.");
        }

        var hasWindow = throttleWindowSeconds.HasValue;
        var hasEvents = throttleMaxEvents.HasValue;

        if (hasWindow != hasEvents)
        {
            ModelState.AddModelError(
                nameof(throttleWindowSeconds),
                "Both throttle window and max events must be provided together or left null.");
        }

        if (hasWindow && throttleWindowSeconds <= 0)
        {
            ModelState.AddModelError(
                nameof(throttleWindowSeconds),
                "Throttle window must be greater than zero.");
        }

        if (hasEvents && throttleMaxEvents <= 0)
        {
            ModelState.AddModelError(
                nameof(throttleMaxEvents),
                "Throttle max events must be greater than zero.");
        }
    }

    private static NotificationChannelResponse MapToResponse(NotificationChannel channel) =>
        new(
            channel.Id,
            channel.ProjectId,
            channel.Type,
            channel.IsEnabled,
            channel.EmailAddress,
            channel.WebhookUrl,
            channel.ThrottleWindowSeconds,
            channel.ThrottleMaxEvents,
            channel.CreatedAt);
}
