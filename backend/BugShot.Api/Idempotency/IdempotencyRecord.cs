namespace BugShot.Api.Idempotency;

public sealed record IdempotencyRecord(string BodyHash, Guid TicketId, string UploadToken, DateTimeOffset UploadTokenExpiresAt);
