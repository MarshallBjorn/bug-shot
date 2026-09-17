using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record CreatedTicketResponse(Guid Id, string UploadToken, DateTimeOffset UploadTokenExpiresAt);

// page jest znormalizowanym adresem po ktorym idzie grupowanie a pageUrl zostaje do pokazania
public record TicketListItem(
    Guid Id,
    string Description,
    string PageUrl,
    string Page,
    string BrowserName,
    TicketStatus Status,
    DateTimeOffset? ReportedAt,
    DateTimeOffset ReceivedAt,
    DateTimeOffset UpdatedAt,
    int CommentCount,
    bool HasScreenshot);

// bez uri bo plik wychodzi wylacznie przez GET /attachments/{id}/download
public record TicketAttachmentResponse(
    Guid Id,
    AttachmentKind Kind,
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
    string Page,
    string UserAgent,
    TicketClientEnvironment Environment,
    TicketStatus Status,
    DateTimeOffset? ReportedAt,
    DateTimeOffset ReceivedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string RowVersion,
    IReadOnlyList<TicketAttachmentResponse> Attachments,
    TicketAttachmentResponse? ConsoleLog,
    int CommentCount,
    IReadOnlyList<TicketStatusChangeResponse> StatusHistory)
{
    // mapa przejsc przylozona do aktualnego stanu na serwerze wiec panel nie zgaduje czym moze ruszyc
    // poza projekcja bo statyczne wyliczenie nie przechodzi przez tlumaczenie zapytania
    public IReadOnlyList<TicketStatus> AllowedStatuses { get; init; } = [];
}

// dane rozpoznane z user agenta i metadanych widgetu. Kasowanie zgloszenia zeruje je razem z adresem
public record TicketClientEnvironment(
    string BrowserName,
    string OsName,
    string DeviceType,
    int? ViewportWidth,
    int? ViewportHeight,
    double? DevicePixelRatio,
    string? Language,
    string? TimeZone);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

// nextCursor puste oznacza koniec listy
// total wypelnia sie tylko na zadanie i tylko na pierwszej stronie
public record CursorPage<T>(IReadOnlyList<T> Items, string? NextCursor, int? Total = null);

// liczniki per status zeby sidebar nie musial dopytywac o kazda strone osobno
public record ProjectPageCount(
    string Page,
    int Total,
    int New,
    int InProgress,
    int Resolved,
    int Rejected);

public record ProjectPagesResponse(IReadOnlyList<ProjectPageCount> Items);
