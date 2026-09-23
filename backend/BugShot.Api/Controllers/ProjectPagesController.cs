using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using BugShot.Api.Tickets;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects/{projectId:guid}/pages")]
[EnableCors(CorsPolicies.Dashboard)]
[ProjectAccess(ProjectRole.Viewer)]
[Produces(MediaTypeNames.Application.Json)]
public class ProjectPagesController(BugShotDbContext db) : ControllerBase
{
    /// <summary>Zwraca strony projektu z licznikami zgloszen.</summary>
    /// <remarks>
    /// Strona to adres bez schematu zapytania i fragmentu wyliczony przy przyjeciu zgloszenia.
    /// Utm i kotwica sa wiec uciete zanim dojdzie do grupowania.
    /// Skasowane zgloszenia nie wchodza bo tombstone traci adres razem z opisem.
    /// Kolejnosc idzie po liczbie zgloszen malejaco a przy rownej liczbie po adresie.
    /// </remarks>
    /// <param name="projectId">Projekt ktorego dotycza strony.</param>
    /// <param name="cancellationToken">Token anulowania zadania.</param>
    /// <param name="limit">Liczba stron przycinana do 1000.</param>
    [HttpGet]
    [ProducesResponseType<ProjectPagesResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProjectPagesResponse>> GetList(
        Guid projectId,
        CancellationToken cancellationToken,
        [FromQuery] int limit = ProjectPages.DefaultLimit)
    {
        if (!await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken))
        {
            return NotFound();
        }

        var pages = await ProjectPages.ListAsync(
            db,
            projectId,
            Math.Clamp(limit, 1, ProjectPages.MaxLimit),
            cancellationToken);

        return Ok(new ProjectPagesResponse(pages));
    }
}
