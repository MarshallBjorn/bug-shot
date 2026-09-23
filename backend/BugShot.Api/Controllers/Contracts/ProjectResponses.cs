using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record ProjectOriginResponse(Guid Id, string Origin);

public record ProjectResponse(
    Guid Id,
    string Name,
    string Key,
    DateTimeOffset CreatedAt,
    IReadOnlyList<ProjectOriginResponse> Origins,
    ProjectRole Role);
