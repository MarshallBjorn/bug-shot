using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Notifications.Email;
using BugShot.Api.Notifications.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Http;
using System.Text.Json;

namespace BugShot.Api.Notifications;

public sealed class NotificationDispatcherHostedService(
    IServiceScopeFactory scopeFactory,
    INotificationWorkerSignal workerSignal,
    ILogger<NotificationDispatcherHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);
    private const int BatchSize = 20;
    private const int MaxAttempts = 4;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation(
            "Notification Dispatcher Hosted Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDeliveriesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "An error occurred while processing notification deliveries.");
            }

            try
            {
                await workerSignal.WaitAsync(PollInterval, stoppingToken);
            }
            catch (TimeoutException)
            {
                // Fallback polling.
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        logger.LogInformation(
            "Notification Dispatcher Hosted Service is stopping.");
    }

    private async Task ProcessDeliveriesAsync(
        CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<BugShotDbContext>();

        var emailSender = scope.ServiceProvider
            .GetRequiredService<IEmailSender>();

        var webhookSender = scope.ServiceProvider
            .GetRequiredService<IWebhookSender>();

        var deliveryIds = await ClaimDeliveriesAsync(
            db,
            cancellationToken);

        foreach (var deliveryId in deliveryIds)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            await ProcessDeliveryAsync(
                db,
                emailSender,
                webhookSender,
                deliveryId,
                cancellationToken);
        }
    }

    private static async Task<List<Guid>> ClaimDeliveriesAsync(
        BugShotDbContext db,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        await using var transaction =
            await db.Database.BeginTransactionAsync(
                cancellationToken);

        var deliveries = await db.NotificationDeliveries
            .FromSqlInterpolated($"""
                SELECT *
                FROM notification_deliveries
                WHERE status IN ('pending'::notification_delivery_status, 'failed'::notification_delivery_status)
                  AND next_attempt_at <= {now}
                  AND attempt_count < {MaxAttempts}
                ORDER BY next_attempt_at
                LIMIT {BatchSize}
                FOR UPDATE SKIP LOCKED
                """)
            .ToListAsync(cancellationToken);

        if (deliveries.Count == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return [];
        }

        foreach (var delivery in deliveries)
        {
            delivery.Status = NotificationDeliveryStatus.Sending;
            delivery.AttemptCount++;
            delivery.LastAttemptAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return deliveries
            .Select(delivery => delivery.Id)
            .ToList();
    }

    private static async Task ProcessDeliveryAsync(
        BugShotDbContext db,
        IEmailSender emailSender,
        IWebhookSender webhookSender,
        Guid deliveryId,
        CancellationToken cancellationToken)
    {
        var delivery = await db.NotificationDeliveries
            .Include(value => value.Channel)
            .SingleOrDefaultAsync(
                value => value.Id == deliveryId,
                cancellationToken);

        if (delivery is null)
        {
            return;
        }

        if (!delivery.Channel.IsEnabled)
        {
            delivery.Status = NotificationDeliveryStatus.Failed;
            delivery.LastError = "Notification channel is disabled.";

            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        if (delivery.Channel.ThrottleWindowSeconds is int windowSeconds &&
            delivery.Channel.ThrottleMaxEvents is int maxEvents)
        {
            var windowStart =
                DateTimeOffset.UtcNow.AddSeconds(-windowSeconds);

            var recentSentCount =
                await db.NotificationDeliveries
                    .CountAsync(
                        value =>
                            value.ChannelId == delivery.ChannelId &&
                            value.Status == NotificationDeliveryStatus.Sent &&
                            value.SentAt >= windowStart,
                        cancellationToken);

            if (recentSentCount >= maxEvents)
            {
                delivery.Status = NotificationDeliveryStatus.Throttled;
                delivery.LastError =
                    "Delivery dropped by channel throttling policy.";

                await db.SaveChangesAsync(cancellationToken);
                return;
            }
        }

        try
        {
            if (delivery.Channel.Type == NotificationChannelType.Email)
            {
                if (string.IsNullOrWhiteSpace(
                    delivery.Channel.EmailAddress))
                {
                    throw new InvalidOperationException(
                        "Brak adresu e-mail dla kanaĹ‚u.");
                }

                await emailSender.SendEmailAsync(
                    delivery.Channel.EmailAddress,
                    delivery.RenderedSubject ??
                        "Bug-Shot Notification",
                    delivery.RenderedBody,
                    cancellationToken);
            }

            if (delivery.Channel.Type == NotificationChannelType.Webhook)
            {
                if (string.IsNullOrWhiteSpace(
                    delivery.Channel.WebhookUrl))
                {
                    throw new InvalidOperationException(
                        "Brak adresu URL dla webhooka.");
                }

                var payload = new
                {
                    eventId = delivery.Id,
                    projectId = delivery.ProjectId,
                    ticketId = delivery.TicketId,
                    eventType = delivery.EventType,
                    subject = delivery.RenderedSubject,
                    body = delivery.RenderedBody,
                    createdAt = delivery.CreatedAt
                };

                await webhookSender.SendWebhookAsync(
                    delivery.Channel.WebhookUrl,
                    delivery.Channel.WebhookSecret,
                    delivery.Id,
                    delivery.EventType.ToString(),
                    JsonSerializer.Serialize(payload),
                    cancellationToken);
            }

            delivery.Status = NotificationDeliveryStatus.Sent;
            delivery.SentAt = DateTimeOffset.UtcNow;
            delivery.LastError = null;

            await db.SaveChangesAsync(cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            await HandleFailureAsync(
                db,
                delivery,
                ex.StatusCode is null ||
                (int)ex.StatusCode >= 500,
                ex.Message,
                cancellationToken);
        }
        catch (Exception ex)
        {
            await HandleFailureAsync(
                db,
                delivery,
                true,
                ex.Message,
                cancellationToken);
        }
    }

    private static async Task HandleFailureAsync(
        BugShotDbContext db,
        NotificationDelivery delivery,
        bool retryable,
        string error,
        CancellationToken cancellationToken)
    {
        delivery.LastError = error;

        if (!retryable || delivery.AttemptCount >= MaxAttempts)
        {
            delivery.Status = NotificationDeliveryStatus.Failed;
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        delivery.Status = NotificationDeliveryStatus.Failed;

        var delay = delivery.AttemptCount switch
        {
            1 => TimeSpan.FromMinutes(1),
            2 => TimeSpan.FromMinutes(5),
            _ => TimeSpan.FromMinutes(25)
        };

        delivery.NextAttemptAt =
            DateTimeOffset.UtcNow.Add(delay);

        await db.SaveChangesAsync(cancellationToken);
    }
}
