using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public record CreateTicketCommentRequest(
    [Required] string Author,
    [Required] string Body);
