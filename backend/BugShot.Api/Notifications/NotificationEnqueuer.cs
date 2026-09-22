using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Notifications;

public sealed class NotificationEnqueuer(
    BugShotDbContext db,
    INotificationRenderer renderer) : INotificationEnqueuer
{
    public async Task EnqueueAsync(
        NotificationEvent notificationEvent,
        CancellationToken cancellationToken)
    {
        var project = db.Projects.Local
            .FirstOrDefault(value => value.Id == notificationEvent.ProjectId);

        if (project is null)
        {
            project = await db.Projects
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    value => value.Id == notificationEvent.ProjectId,
                    cancellationToken);
        }

        if (project is null)
        {
            return;
        }

        var ticket = db.Tickets.Local
            .FirstOrDefault(value => value.Id == notificationEvent.TicketId);

        if (ticket is null)
        {
            ticket = await db.Tickets
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    value => value.Id == notificationEvent.TicketId,
                    cancellationToken);
        }

        if (ticket is null)
        {
            return;
        }

        TicketComment? comment = null;
        TicketStatusChange? statusChange = null;

        if (notificationEvent.EventType == NotificationEventType.CommentAdded &&
            notificationEvent.RelatedEntityId is Guid commentId)
        {
            comment = db.TicketComments.Local
                .FirstOrDefault(value => value.Id == commentId);

            if (comment is null)
            {
                comment = await db.TicketComments
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        value => value.Id == commentId,
                        cancellationToken);
            }
        }

        if (notificationEvent.EventType == NotificationEventType.StatusChanged &&
            notificationEvent.RelatedEntityId is Guid statusChangeId)
        {
            statusChange = db.TicketStatusChanges.Local
                .FirstOrDefault(value => value.Id == statusChangeId);

            if (statusChange is null)
            {
                statusChange = await db.TicketStatusChanges
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        value => value.Id == statusChangeId,
                        cancellationToken);
            }
        }

        var channels = await db.NotificationChannels
            .AsNoTracking()
            .Where(channel =>
                channel.ProjectId == notificationEvent.ProjectId &&
                channel.IsEnabled)
            .ToListAsync(cancellationToken);

        if (channels.Count == 0)
        {
            return;
        }

        foreach (var channel in channels)
        {
            var template = await db.NotificationTemplates
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    value =>
                        value.ProjectId == notificationEvent.ProjectId &&
                        value.EventType == notificationEvent.EventType &&
                        value.ChannelType == channel.Type,
                    cancellationToken);

            if (template is null)
            {
                template = await db.NotificationTemplates
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        value =>
                            value.ProjectId == null &&
                            value.EventType == notificationEvent.EventType &&
                            value.ChannelType == channel.Type,
                        cancellationToken);
            }

            if (template is null)
            {
                continue;
            }

            var subject = template.Subject ?? string.Empty;
            var body = template.Body;

            var renderedSubject = renderer.Render(
                subject,
                notificationEvent.EventType,
                project,
                ticket,
                comment,
                statusChange);

            var renderedBody = renderer.Render(
                body,
                notificationEvent.EventType,
                project,
                ticket,
                comment,
                statusChange);

            var fittedSubject =
                NotificationText.FitToColumn<NotificationDelivery>(
                    db.Model,
                    nameof(NotificationDelivery.RenderedSubject),
                    renderedSubject.Content);

            var fittedBody =
                NotificationText.FitToColumn<NotificationDelivery>(
                    db.Model,
                    nameof(NotificationDelivery.RenderedBody),
                    renderedBody.Content) ?? string.Empty;

            db.NotificationDeliveries.Add(new NotificationDelivery
            {
                ProjectId = notificationEvent.ProjectId,
                ChannelId = channel.Id,
                TicketId = notificationEvent.TicketId,
                EventType = notificationEvent.EventType,
                Status = NotificationDeliveryStatus.Pending,
                AttemptCount = 0,
                NextAttemptAt = DateTimeOffset.UtcNow,
                RenderedSubject = fittedSubject,
                RenderedBody = fittedBody
            });
        }
    }
}
