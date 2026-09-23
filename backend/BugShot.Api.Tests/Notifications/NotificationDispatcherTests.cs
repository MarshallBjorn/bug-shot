using System.Net.Http;

using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Notifications;
using BugShot.Api.Notifications.Email;
using BugShot.Api.Notifications.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace BugShot.Api.Tests.Notifications;

[Collection("PostgreSQL tests")]
public class NotificationDispatcherTests
{
    [Fact]
    public async Task Success_Email_DeliveryMarkedAsSent()
    {
        var (_, _, _, delivery) =
            await SeedDeliveryAsync(NotificationChannelType.Email);

        var emailSender = new FakeEmailSender();

        await RunDispatcherOnceAsync(
            emailSender,
            new FakeWebhookSender(),
            emailSender.Tcs.Task);

        await using var assertDb = OpenContext();

        var updated =
            await assertDb.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(NotificationDeliveryStatus.Sent, updated.Status);
        Assert.Equal(1, updated.AttemptCount);
        Assert.NotNull(updated.SentAt);
        Assert.NotNull(updated.LastAttemptAt);
        Assert.Single(emailSender.SentEmails);
    }

    [Fact]
    public async Task Success_Webhook_DeliveryMarkedAsSent()
    {
        var (_, _, _, delivery) =
            await SeedDeliveryAsync(NotificationChannelType.Webhook);

        var webhookSender = new FakeWebhookSender();

        await RunDispatcherOnceAsync(
            new FakeEmailSender(),
            webhookSender,
            webhookSender.Tcs.Task);

        await using var assertDb = OpenContext();

        var updated =
            await assertDb.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(NotificationDeliveryStatus.Sent, updated.Status);
        Assert.Equal(1, updated.AttemptCount);
        Assert.NotNull(updated.SentAt);
        Assert.Single(webhookSender.SentWebhooks);
    }

    [Fact]
    public async Task Retry_Backoff_SequenceAndMaxAttempts()
    {
        var (_, _, _, delivery) =
            await SeedDeliveryAsync(NotificationChannelType.Webhook);

        var webhookSender = new FakeWebhookSender
        {
            ExceptionToThrow = new HttpRequestException("HTTP 503")
        };

        webhookSender.ResetTcs();

        await RunDispatcherOnceAsync(
            new FakeEmailSender(),
            webhookSender,
            webhookSender.Tcs.Task);

        await using var db1 = OpenContext();

        var d1 =
            await db1.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(NotificationDeliveryStatus.Pending, d1.Status);
        Assert.Equal(1, d1.AttemptCount);
        Assert.NotNull(d1.LastError);

        Assert.InRange(
            d1.NextAttemptAt,
            DateTimeOffset.UtcNow.AddSeconds(45),
            DateTimeOffset.UtcNow.AddMinutes(75));

        await db1.NotificationDeliveries
            .Where(d => d.Id == delivery.Id)
            .ExecuteUpdateAsync(s =>
                s.SetProperty(
                    d => d.NextAttemptAt,
                    DateTimeOffset.UtcNow.AddMinutes(-10)));

        webhookSender.ResetTcs();

        await RunDispatcherOnceAsync(
            new FakeEmailSender(),
            webhookSender,
            webhookSender.Tcs.Task);

        await using var db2 = OpenContext();

        var d2 =
            await db2.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(2, d2.AttemptCount);

        Assert.InRange(
            d2.NextAttemptAt,
            DateTimeOffset.UtcNow.AddMinutes(3),
            DateTimeOffset.UtcNow.AddMinutes(7));

        await db2.NotificationDeliveries
            .Where(d => d.Id == delivery.Id)
            .ExecuteUpdateAsync(s =>
                s.SetProperty(
                    d => d.NextAttemptAt,
                    DateTimeOffset.UtcNow.AddMinutes(-10)));

        webhookSender.ResetTcs();

        await RunDispatcherOnceAsync(
            new FakeEmailSender(),
            webhookSender,
            webhookSender.Tcs.Task);

        await using var db3 = OpenContext();

        var d3 =
            await db3.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(3, d3.AttemptCount);

        Assert.InRange(
            d3.NextAttemptAt,
            DateTimeOffset.UtcNow.AddMinutes(20),
            DateTimeOffset.UtcNow.AddMinutes(30));

        await db3.NotificationDeliveries
            .Where(d => d.Id == delivery.Id)
            .ExecuteUpdateAsync(s =>
                s.SetProperty(
                    d => d.NextAttemptAt,
                    DateTimeOffset.UtcNow.AddMinutes(-10)));

        webhookSender.ResetTcs();

        await RunDispatcherOnceAsync(
            new FakeEmailSender(),
            webhookSender,
            webhookSender.Tcs.Task);

        await using var db4 = OpenContext();

        var d4 =
            await db4.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(4, d4.AttemptCount);
        Assert.Equal(NotificationDeliveryStatus.Failed, d4.Status);

        await db4.NotificationDeliveries
            .Where(d => d.Id == delivery.Id)
            .ExecuteUpdateAsync(s =>
                s.SetProperty(
                    d => d.NextAttemptAt,
                    DateTimeOffset.UtcNow.AddMinutes(-10)));

        await using var dbFinal = OpenContext();

        var dFinal =
            await dbFinal.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(4, dFinal.AttemptCount);

        var eligibleAfterMaxAttempts =
            await dbFinal.NotificationDeliveries.CountAsync(d =>
                d.Id == delivery.Id
                && (
                    d.Status == NotificationDeliveryStatus.Pending
                    || d.Status == NotificationDeliveryStatus.Failed)
                && d.NextAttemptAt <= DateTimeOffset.UtcNow
                && d.AttemptCount < 4);

        Assert.Equal(0, eligibleAfterMaxAttempts);
    }

    [Fact]
    public async Task Throttling_DropsExcessDeliveries()
    {
        await using var seedDb = OpenContext();

        var project = new Project
        {
            Name = "ThrottleProj",
            Key = $"t-{Guid.NewGuid():N}"[..15]
        };

        seedDb.Projects.Add(project);
        await seedDb.SaveChangesAsync();

        var channel = new NotificationChannel
        {
            ProjectId = project.Id,
            Type = NotificationChannelType.Email,
            EmailAddress = "admin@example.com",
            ThrottleWindowSeconds = 3600,
            ThrottleMaxEvents = 1
        };

        seedDb.NotificationChannels.Add(channel);
        await seedDb.SaveChangesAsync();

        var ticket = new Ticket
        {
            ProjectId = project.Id,
            Description = "Test ticket",
            PageUrl = "https://example.com",
            UserAgent = "Test"
        };

        seedDb.Tickets.Add(ticket);
        await seedDb.SaveChangesAsync();

        var d1 = new NotificationDelivery
        {
            ProjectId = project.Id,
            ChannelId = channel.Id,
            TicketId = ticket.Id,
            EventType = NotificationEventType.TicketCreated,
            RenderedBody = "Body 1",
            Status = NotificationDeliveryStatus.Pending,
            NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };

        var d2 = new NotificationDelivery
        {
            ProjectId = project.Id,
            ChannelId = channel.Id,
            TicketId = ticket.Id,
            EventType = NotificationEventType.TicketCreated,
            RenderedBody = "Body 2",
            Status = NotificationDeliveryStatus.Pending,
            NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        };

        seedDb.NotificationDeliveries.AddRange(d1, d2);
        await seedDb.SaveChangesAsync();

        var emailSender = new FakeEmailSender();

        await RunDispatcherOnceAsync(
            emailSender,
            new FakeWebhookSender(),
            emailSender.Tcs.Task);

        await using var assertDb = OpenContext();

        var updated1 =
            await assertDb.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == d1.Id);

        var updated2 =
            await assertDb.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == d2.Id);

        Assert.Equal(NotificationDeliveryStatus.Sent, updated1.Status);
        Assert.Equal(NotificationDeliveryStatus.Throttled, updated2.Status);
        Assert.Single(emailSender.SentEmails);
    }

    [Fact]
    public async Task Webhook_FailurePolicy_RetriesOnAnyHttpRequestException()
    {
        var (_, _, _, delivery) =
            await SeedDeliveryAsync(NotificationChannelType.Webhook);

        var webhookSender = new FakeWebhookSender
        {
            ExceptionToThrow =
                new HttpRequestException("HTTP 400 Bad Request", null, System.Net.HttpStatusCode.BadRequest)
        };

        await RunDispatcherOnceAsync(
            new FakeEmailSender(),
            webhookSender,
            webhookSender.Tcs.Task);

        await using var assertDb = OpenContext();

        var updated =
            await assertDb.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(NotificationDeliveryStatus.Failed, updated.Status);
        Assert.Equal(1, updated.AttemptCount);
        Assert.Contains("400", updated.LastError);
    }

    [Fact]
    public async Task Atomic_Claim_SkipLockedPreventsDoubleProcessing()
    {
        var (_, _, _, delivery) =
            await SeedDeliveryAsync(NotificationChannelType.Email);

        var sharedCompletion =
            new TaskCompletionSource<bool>(
                TaskCreationOptions.RunContinuationsAsynchronously);

        var emailSender1 = new FakeEmailSender
        {
            Tcs = sharedCompletion
        };

        var emailSender2 = new FakeEmailSender
        {
            Tcs = sharedCompletion
        };

        var task1 =
            RunDispatcherOnceAsync(
                emailSender1,
                new FakeWebhookSender(),
                sharedCompletion.Task);

        var task2 =
            RunDispatcherOnceAsync(
                emailSender2,
                new FakeWebhookSender(),
                sharedCompletion.Task);

        await Task.WhenAll(task1, task2);

        await using var assertDb = OpenContext();

        var updated =
            await assertDb.NotificationDeliveries
                .AsNoTracking()
                .SingleAsync(d => d.Id == delivery.Id);

        Assert.Equal(NotificationDeliveryStatus.Sent, updated.Status);
        Assert.Equal(1, updated.AttemptCount);

        var totalSent =
            emailSender1.SentEmails.Count
            + emailSender2.SentEmails.Count;

        Assert.Equal(1, totalSent);
    }

    private static async Task<(
        Project Project,
        NotificationChannel Channel,
        Ticket Ticket,
        NotificationDelivery Delivery)>
        SeedDeliveryAsync(NotificationChannelType channelType)
    {
        await using var seedDb = OpenContext();

        var project = new Project
        {
            Name = "TestProj",
            Key = $"p-{Guid.NewGuid():N}"[..15]
        };

        seedDb.Projects.Add(project);
        await seedDb.SaveChangesAsync();

        var channel = new NotificationChannel
        {
            ProjectId = project.Id,
            Type = channelType,
            EmailAddress =
                channelType == NotificationChannelType.Email
                    ? "test@bug-shot.test"
                    : null,
            WebhookUrl =
                channelType == NotificationChannelType.Webhook
                    ? "https://example.com/webhook"
                    : null
        };

        seedDb.NotificationChannels.Add(channel);
        await seedDb.SaveChangesAsync();

        var ticket = new Ticket
        {
            ProjectId = project.Id,
            Description = "Test ticket description",
            PageUrl = "https://example.com",
            UserAgent = "TestAgent"
        };

        seedDb.Tickets.Add(ticket);
        await seedDb.SaveChangesAsync();

        var delivery = new NotificationDelivery
        {
            ProjectId = project.Id,
            ChannelId = channel.Id,
            TicketId = ticket.Id,
            EventType = NotificationEventType.TicketCreated,
            RenderedSubject = "Test Subject",
            RenderedBody = "Test Body",
            Status = NotificationDeliveryStatus.Pending,
            NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };

        seedDb.NotificationDeliveries.Add(delivery);
        await seedDb.SaveChangesAsync();

        return (project, channel, ticket, delivery);
    }

    private static async Task RunDispatcherOnceAsync(
        IEmailSender emailSender,
        IWebhookSender webhookSender,
        Task? completionTask = null)
    {
        var scopeFactory =
            new SingleScopeFactory(
                emailSender,
                webhookSender);

        var signal =
            new NotificationWorkerSignal();

        signal.Signal();

        var dispatcher =
            new NotificationDispatcherHostedService(
                scopeFactory,
                signal,
                NullLogger<NotificationDispatcherHostedService>.Instance);

        using var cts =
            new CancellationTokenSource(
                TimeSpan.FromSeconds(5));

        await dispatcher.StartAsync(cts.Token);

        if (completionTask is not null)
        {
            await completionTask.WaitAsync(
                TimeSpan.FromSeconds(3));
        }

        for (var attempt = 0; attempt < 30; attempt++)
        {
            await using var checkDb = OpenContext();

            var hasSending =
                await checkDb.NotificationDeliveries
                    .AnyAsync(
                        d => d.Status == NotificationDeliveryStatus.Sending);

            if (!hasSending)
            {
                break;
            }

            await Task.Delay(50, cts.Token);
        }

        await dispatcher.StopAsync(
            CancellationToken.None);
    }

    private static BugShotDbContext OpenContext()
    {
        var connectionString =
            Environment.GetEnvironmentVariable(
                "ConnectionStrings__DefaultConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings__DefaultConnection is not configured.");

        var options =
            new DbContextOptionsBuilder<BugShotDbContext>()
                .UseNpgsql(
                    connectionString,
                    npgsql =>
                    {
                        npgsql.MapEnum<TicketStatus>(
                            "ticket_status");

                        npgsql.MapEnum<AttachmentKind>(
                            "attachment_kind");

                        npgsql.MapEnum<NotificationChannelType>(
                            "notification_channel_type");

                        npgsql.MapEnum<NotificationEventType>(
                            "notification_event_type");

                        npgsql.MapEnum<NotificationDeliveryStatus>(
                            "notification_delivery_status");
                        npgsql.MapEnum<ProjectRole>(
                            "project_role");
                        npgsql.MapEnum<UserTokenPurpose>(
                            "user_token_purpose");
                    })
                .UseSnakeCaseNamingConvention()
                .Options;

        return new BugShotDbContext(options);
    }

    private sealed class SingleScopeFactory : IServiceScopeFactory
    {
        private readonly IEmailSender _emailSender;
        private readonly IWebhookSender _webhookSender;

        public SingleScopeFactory(
            IEmailSender emailSender,
            IWebhookSender webhookSender)
        {
            _emailSender = emailSender;
            _webhookSender = webhookSender;
        }

        public IServiceScope CreateScope() =>
            new SingleScope(
                _emailSender,
                _webhookSender);
    }

    private sealed class SingleScope : IServiceScope
    {
        private readonly IEmailSender _emailSender;
        private readonly IWebhookSender _webhookSender;

        public SingleScope(
            IEmailSender emailSender,
            IWebhookSender webhookSender)
        {
            _emailSender = emailSender;
            _webhookSender = webhookSender;
        }

        public IServiceProvider ServiceProvider =>
            new SingleServiceProvider(
                _emailSender,
                _webhookSender);

        public void Dispose()
        {
        }
    }

    private sealed class SingleServiceProvider : IServiceProvider
    {
        private readonly IEmailSender _emailSender;
        private readonly IWebhookSender _webhookSender;

        public SingleServiceProvider(
            IEmailSender emailSender,
            IWebhookSender webhookSender)
        {
            _emailSender = emailSender;
            _webhookSender = webhookSender;
        }

        public object? GetService(Type serviceType)
        {
            if (serviceType == typeof(BugShotDbContext))
            {
                return OpenContext();
            }

            if (serviceType == typeof(IEmailSender))
            {
                return _emailSender;
            }

            if (serviceType == typeof(IWebhookSender))
            {
                return _webhookSender;
            }

            return null;
        }
    }

    private sealed class FakeEmailSender : IEmailSender
    {
        public TaskCompletionSource<bool> Tcs { get; set; } =
            new(
                TaskCreationOptions.RunContinuationsAsynchronously);

        public List<(string To, string Subject, string Body)> SentEmails
        {
            get;
        } = [];

        public Task SendEmailAsync(
            string toAddress,
            string subject,
            string body,
            CancellationToken cancellationToken)
        {
            SentEmails.Add(
                (toAddress, subject, body));

            Tcs.TrySetResult(true);

            return Task.CompletedTask;
        }
    }

    private sealed class FakeWebhookSender : IWebhookSender
    {
        public TaskCompletionSource<bool> Tcs { get; set; } =
            new(
                TaskCreationOptions.RunContinuationsAsynchronously);

        public Exception? ExceptionToThrow { get; set; }

        public List<(string Url, string Payload)> SentWebhooks
        {
            get;
        } = [];

        public void ResetTcs()
        {
            Tcs =
                new(
                    TaskCreationOptions.RunContinuationsAsynchronously);
        }

        public Task SendWebhookAsync(
            string url,
            string? secret,
            Guid deliveryId,
            string eventType,
            string payload,
            CancellationToken cancellationToken)
        {
            if (ExceptionToThrow is not null)
            {
                Tcs.TrySetResult(true);

                throw ExceptionToThrow;
            }

            SentWebhooks.Add(
                (url, payload));

            Tcs.TrySetResult(true);

            return Task.CompletedTask;
        }
    }
}