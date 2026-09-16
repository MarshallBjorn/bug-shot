using System.ComponentModel.DataAnnotations;
using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record CreateNotificationChannelRequest(
    [Required] NotificationChannelType? Type,
    bool IsEnabled,
    [MaxLength(320)] string? EmailAddress,
    [MaxLength(2048)] string? WebhookUrl,
    [MaxLength(256)] string? WebhookSecret,
    int? ThrottleWindowSeconds,
    int? ThrottleMaxEvents);

public record UpdateNotificationChannelRequest(
    bool IsEnabled,
    [MaxLength(320)] string? EmailAddress,
    [MaxLength(2048)] string? WebhookUrl,
    [MaxLength(256)] string? WebhookSecret,
    int? ThrottleWindowSeconds,
    int? ThrottleMaxEvents);

public record NotificationChannelResponse(
    Guid Id,
    Guid ProjectId,
    NotificationChannelType Type,
    bool IsEnabled,
    string? EmailAddress,
    string? WebhookUrl,
    int? ThrottleWindowSeconds,
    int? ThrottleMaxEvents,
    DateTimeOffset CreatedAt);