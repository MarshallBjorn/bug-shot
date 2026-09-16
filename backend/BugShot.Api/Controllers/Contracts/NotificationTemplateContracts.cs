using System.ComponentModel.DataAnnotations;
using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record NotificationTemplateResponse(
    Guid Id,
    Guid? ProjectId,
    NotificationEventType EventType,
    NotificationChannelType ChannelType,
    string? Subject,
    string Body,
    DateTimeOffset CreatedAt);

public record UpsertNotificationTemplateRequest(
    [MaxLength(255)] string? Subject,
    [Required, MaxLength(4000)] string Body);