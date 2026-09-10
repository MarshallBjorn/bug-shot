using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record CreateProjectOriginRequest([Required][MaxLength(2048)] string Origin);
