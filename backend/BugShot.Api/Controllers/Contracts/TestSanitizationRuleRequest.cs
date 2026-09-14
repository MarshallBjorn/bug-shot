using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record TestSanitizationRuleRequest(
    [Required][MaxLength(512)] string Pattern,
    [Required(AllowEmptyStrings = true)][MaxLength(128)] string Replacement,
    [Required(AllowEmptyStrings = true)][MaxLength(2000)] string SampleText);
