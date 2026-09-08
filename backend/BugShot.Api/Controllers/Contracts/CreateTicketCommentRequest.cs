using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record CreateTicketCommentRequest(
    [Required, RegularExpression(@".*\S.*", ErrorMessage = "Author cannot be empty or whitespace.")] string Author,
    [Required] string Body);
