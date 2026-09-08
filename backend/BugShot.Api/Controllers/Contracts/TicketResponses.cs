using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record CreatedTicketResponse(Guid Id, string UploadToken, DateTimeOffset UploadTokenExpiresAt);

public record TicketListItem(
    Guid Id,
    string Description,
    string PageUrl,
    TicketStatus Status,
    DateTimeOffset? ReportedAt,
    DateTimeOffset ReceivedAt,
    DateTimeOffset UpdatedAt);

public record TicketAttachmentResponse(
    Guid Id,
    AttachmentKind Kind,
    string Uri,
    string FileName,
    string ContentType,
    long SizeBytes);

public record TicketCommentResponse(
    Guid Id,
    string Author,
    string Body,
    DateTimeOffset CreatedAt);

public record TicketStatusChangeResponse(
    TicketStatus FromStatus,
    TicketStatus ToStatus,
    string ChangedBy,
    DateTimeOffset ChangedAt);

public record TicketStatusResponse(
    Guid Id,
    TicketStatus Status,
    string RowVersion,
    DateTimeOffset UpdatedAt);

public record TicketDetails(
    Guid Id,
    Guid ProjectId,
    string ProjectKey,
    string Description,
    string PageUrl,
    string UserAgent,
    TicketStatus Status,
    DateTimeOffset? ReportedAt,
    DateTimeOffset ReceivedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string RowVersion,
    IReadOnlyList<TicketAttachmentResponse> Attachments,
    string? ConsoleLogUri,
    int CommentCount,
    IReadOnlyList<TicketStatusChangeResponse> StatusHistory);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
