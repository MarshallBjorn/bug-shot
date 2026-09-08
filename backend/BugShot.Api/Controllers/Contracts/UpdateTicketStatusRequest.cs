using System.ComponentModel.DataAnnotations;
using BugShot.Api.Models;

namespace BugShot.Api.Contracts;

public record UpdateTicketStatusRequest(
    [Required] TicketStatus? Status,
    [Required][MaxLength(128)] string ChangedBy);
