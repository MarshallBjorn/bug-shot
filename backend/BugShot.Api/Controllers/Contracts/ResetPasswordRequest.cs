using System.ComponentModel.DataAnnotations;
using BugShot.Api.Security;

namespace BugShot.Api.Contracts;

public record ResetPasswordRequest(
    [Required][PasswordPolicy] string Password);
