using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record CreateSanitizationRuleRequest(
    Guid? ProjectId,
    [Required][MaxLength(512)] string Pattern,
    [Required(AllowEmptyStrings = true)][MaxLength(128)] string Replacement);
