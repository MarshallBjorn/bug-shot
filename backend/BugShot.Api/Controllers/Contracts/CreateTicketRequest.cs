using System.ComponentModel.DataAnnotations;

namespace BugShot.Api.Contracts;

public class CreateTicketRequest
{
    [Required]
    [MaxLength(64)]
    public string ProjectKey { get; set; } = string.Empty;

    // ten sam limit co maxlength w widgecie
    [Required]
    [MaxLength(1200)]
    public string Description { get; set; } = string.Empty;

    [Required]
    [MaxLength(2048)]
    [Url]
    public string PageUrl { get; set; } = string.Empty;

    [MaxLength(512)]
    public string UserAgent { get; set; } = string.Empty;

    public DateTimeOffset? ReportedAt { get; set; }
}
