using BugShot.Api.Models;

namespace BugShot.Api.Sanitization;

public interface ISanitizationService
{
    Task<string> SanitizeAsync(
        Guid projectId,
        Guid ticketId,
        string fieldName,
        string value,
        CancellationToken cancellationToken = default);
}
