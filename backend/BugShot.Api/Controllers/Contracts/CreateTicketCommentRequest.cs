using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

// limity musza odpowiadac kolumnom bo inaczej za dlugie pole wychodzi z bazy jako 500
// (?s) jest konieczne bo DataAnnotations wymaga dopasowania calego napisu a komentarz bywa wielolinijkowy
public record CreateTicketCommentRequest(
    [Required, MaxLength(128), RegularExpression(@"(?s).*\S.*", ErrorMessage = "Author cannot be empty or whitespace.")] string Author,
    [Required, MaxLength(5000), RegularExpression(@"(?s).*\S.*", ErrorMessage = "Body cannot be empty or whitespace.")] string Body);
