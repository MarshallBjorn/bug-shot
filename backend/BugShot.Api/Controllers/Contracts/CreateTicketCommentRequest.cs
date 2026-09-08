using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

// limity musza odpowiadac kolumnom bo inaczej za dlugie pole wychodzi z bazy jako 500
public record CreateTicketCommentRequest(
    [Required, MaxLength(128), RegularExpression(@".*\S.*", ErrorMessage = "Author cannot be empty or whitespace.")] string Author,
    [Required, MaxLength(5000)] string Body);
