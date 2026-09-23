using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record ProjectAccessRequest(Guid ProjectId, ProjectRole Role);

// bez hasla bo konto ustawia je samo z linku w mailu
public record CreateUserRequest(
    [Required][EmailAddress][MaxLength(256)] string Email,
    bool IsAdmin,
    IReadOnlyList<ProjectAccessRequest>? Projects);

public record UpdateUserRequest(bool IsAdmin);

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum UserAccountState
{
    Active,
    Invited,
    Disabled
}

public record UserProjectResponse(Guid ProjectId, string ProjectName, ProjectRole Role);

public record UserAccountResponse(
    Guid Id,
    string Email,
    bool IsAdmin,
    UserAccountState State,
    DateTimeOffset CreatedAt,
    IReadOnlyList<UserProjectResponse> Projects);

// link wraca tylko gdy mail nie wyszedl i admin musi przekazac go sam
public record AccountLinkResponse(bool EmailSent, string? Link);

public record CreatedUserResponse(UserAccountResponse User, bool EmailSent, string? Link);
