using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record CreateProjectRequest(
    [Required][MaxLength(128)] string Name,
    [Required][MaxLength(64)] string Key);
