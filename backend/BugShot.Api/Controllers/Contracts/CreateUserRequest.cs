using System.ComponentModel.DataAnnotations;
using BugShot.Api.Security;

namespace BugShot.Api.Contracts;

public record CreateUserRequest(
    [Required][EmailAddress][MaxLength(256)] string Email,
    [Required][PasswordPolicy] string Password,
    bool IsAdmin);
