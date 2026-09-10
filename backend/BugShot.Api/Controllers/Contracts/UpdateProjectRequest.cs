using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record UpdateProjectRequest([Required][MaxLength(128)] string Name);
