using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record UpdateSanitizationRuleRequest(
    [Required][MaxLength(512)] string Pattern,
    [Required][MaxLength(128)] string Replacement);

public record UpdateSanitizationRuleEnabledRequest([Required] bool? IsEnabled);
