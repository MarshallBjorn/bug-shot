using System.ComponentModel.DataAnnotations;
using BugShot.Api.Models;
using BugShot.Api.Security;

namespace BugShot.Api.Contracts;

public record SetupStatusResponse(bool Required);

public record SetupRequest(
    [Required][MaxLength(128)] string Token,
    [Required][EmailAddress][MaxLength(256)] string Email,
    [Required][PasswordPolicy] string Password);

// token idzie w ciele a nie w adresie zeby nie zostawal w logach proxy
public record AccountTokenRequest(
    [Required][MaxLength(128)] string Token);

public record AccountTokenResponse(string Email, UserTokenPurpose Purpose);

public record SetPasswordRequest(
    [Required][MaxLength(128)] string Token,
    [Required][PasswordPolicy] string Password);

public record ChangePasswordRequest(
    [Required][MaxLength(512)] string CurrentPassword,
    [Required][PasswordPolicy] string NewPassword);
