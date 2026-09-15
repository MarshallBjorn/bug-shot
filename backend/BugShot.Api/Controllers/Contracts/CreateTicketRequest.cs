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

    // metadane sa opcjonalne i bez walidacji bo zla wartosc nie moze zablokowac zgloszenia
    public TicketViewport? Viewport { get; set; }

    public string? Language { get; set; }

    public string? TimeZone { get; set; }
}

public class TicketViewport
{
    public int Width { get; set; }

    public int Height { get; set; }

    public double DevicePixelRatio { get; set; }
}
