using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

// haslo bez polityki bo przy logowaniu kazda niezgodnosc konczy sie tym samym 401
public record LoginRequest(
    [Required][EmailAddress][MaxLength(256)] string Email,
    [Required][MaxLength(512)] string Password);
