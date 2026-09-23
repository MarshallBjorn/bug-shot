using System.Net.Mime;
using BugShot.Api.Analytics;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects/{projectId:guid}/analytics")]
[EnableCors(CorsPolicies.Dashboard)]
[ProjectAccess(ProjectRole.Viewer)]
[Produces(MediaTypeNames.Application.Json)]
public class ProjectAnalyticsController(BugShotDbContext db) : ControllerBase
{
    /// <summary>Zwraca analityke zgloszen projektu.</summary>
    /// <remarks>
    /// Zakres to pelne dni kalendarzowe w strefie z parametru tz. Bez dzisiejszego dnia konczy sie wczoraj o polnocy.
    /// Skasowane zgloszenia wchodza do sum i statusow ale nie do stron przegladarek i urzadzen.
    /// </remarks>
    /// <param name="projectId">Projekt ktorego dotyczy analityka.</param>
    /// <param name="cancellationToken">Token anulowania zadania.</param>
    /// <param name="range">Zakres 7d 30d 90d albo all.</param>
    /// <param name="tz">Strefa IANA w ktorej licza sie dni na przyklad Europe/Warsaw.</param>
    /// <param name="includeToday">Czy liczyc dzisiejszy jeszcze trwajacy dzien.</param>
    [HttpGet]
    [ProducesResponseType<ProjectAnalyticsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProjectAnalyticsResponse>> Get(
        Guid projectId,
        CancellationToken cancellationToken,
        [FromQuery] string range = "30d",
        [FromQuery] string tz = "UTC",
        [FromQuery] bool includeToday = true)
    {
        if (!AnalyticsWindow.IsRange(range))
        {
            ModelState.AddModelError(nameof(range), "Range must be one of 7d, 30d, 90d or all.");
        }

        // nazwa musi byc w postaci IANA bo .NET przyjmuje tez nazwy z Windows ktorych Postgres nie zna
        TimeZoneInfo? zone = null;

        if (!TicketClientDetails.IsTimeZoneName(tz) || !TimeZoneInfo.TryFindSystemTimeZoneById(tz, out zone))
        {
            ModelState.AddModelError(nameof(tz), "Time zone must be an IANA name, for example Europe/Warsaw.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var window = AnalyticsWindow.Create(range, tz, zone!, includeToday, DateTimeOffset.UtcNow);

        return Ok(await ProjectAnalytics.ComputeAsync(db, projectId, window, cancellationToken));
    }
}
