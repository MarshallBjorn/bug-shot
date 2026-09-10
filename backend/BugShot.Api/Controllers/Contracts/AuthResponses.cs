namespace BugShot.Api.Contracts;

public record AccessTokenResponse(
    string AccessToken,
    DateTimeOffset ExpiresAt,
    UserResponse User);

public record UserResponse(
    Guid Id,
    string Email,
    bool IsAdmin,
    bool IsActive,
    DateTimeOffset CreatedAt);
