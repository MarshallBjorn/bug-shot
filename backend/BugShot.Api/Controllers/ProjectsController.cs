using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/projects")]
[EnableCors(CorsPolicies.Dashboard)]
[Produces(MediaTypeNames.Application.Json)]
public class ProjectsController(BugShotDbContext db) : ControllerBase
{
    /// <summary>Zwraca wszystkie projekty razem z ich originami.</summary>
    /// <remarks>Dla kazdego zalogowanego, dashboard wybiera z tej listy projekt.</remarks>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProjectResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<ProjectResponse>>> GetList(CancellationToken cancellationToken)
    {
        var projects = await db.Projects
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new ProjectResponse(
                p.Id,
                p.Name,
                p.Key,
                p.CreatedAt,
                p.Origins.Select(o => new ProjectOriginResponse(o.Id, o.Origin)).ToList()))
            .ToListAsync(cancellationToken);

        return Ok(projects);
    }

    /// <summary>Zaklada projekt.</summary>
    /// <remarks>Tylko dla administratora. Zajety klucz konczy sie bledem walidacji.</remarks>
    [HttpPost]
    [Authorize(Roles = AccessTokenIssuer.AdminRole)]
    [ProducesResponseType<ProjectResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ProjectResponse>> Create(
        CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var key = request.Key.Trim();

        if (await db.Projects.AnyAsync(p => p.Key == key, cancellationToken))
        {
            return KeyTaken();
        }

        var project = new Project { Name = request.Name.Trim(), Key = key };

        db.Projects.Add(project);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            // rownolegle zadanie zajelo klucz miedzy sprawdzeniem a zapisem
            return KeyTaken();
        }

        // bez Location bo edycja i tak schodzi po id z listy
        return Created((string?)null, Describe(project));
    }

    /// <summary>Zmienia nazwe projektu.</summary>
    /// <remarks>Tylko dla administratora. Klucz jest wpiety w widget wiec zostaje niezmienny.</remarks>
    [HttpPatch("{id:guid}")]
    [Authorize(Roles = AccessTokenIssuer.AdminRole)]
    [ProducesResponseType<ProjectResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProjectResponse>> Update(
        Guid id,
        UpdateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var project = await db.Projects
            .Include(p => p.Origins)
            .SingleOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (project is null)
        {
            return NotFound();
        }

        project.Name = request.Name.Trim();

        await db.SaveChangesAsync(cancellationToken);

        return Ok(Describe(project));
    }

    /// <summary>Kasuje projekt.</summary>
    /// <remarks>
    /// Tylko dla administratora. Projekt z choc jednym zgloszeniem nie da sie skasowac i konczy sie na 409.
    /// </remarks>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = AccessTokenIssuer.AdminRole)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (project is null)
        {
            return NotFound();
        }

        if (await db.Tickets.AnyAsync(t => t.ProjectId == id, cancellationToken))
        {
            return Problem(
                title: "Project has tickets and cannot be deleted.",
                statusCode: StatusCodes.Status409Conflict);
        }

        db.Projects.Remove(project);

        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>Dodaje dozwolony origin projektu.</summary>
    /// <remarks>
    /// Tylko dla administratora. Origin to sam schemat http albo https z hostem i opcjonalnym portem.
    /// Powtorzony origin tego samego projektu konczy sie na 409.
    /// </remarks>
    [HttpPost("{id:guid}/origins")]
    [Authorize(Roles = AccessTokenIssuer.AdminRole)]
    [ProducesResponseType<ProjectOriginResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProjectOriginResponse>> AddOrigin(
        Guid id,
        CreateProjectOriginRequest request,
        CancellationToken cancellationToken)
    {
        var projectExists = await db.Projects.AnyAsync(p => p.Id == id, cancellationToken);

        if (!projectExists)
        {
            return NotFound();
        }

        if (!TryNormalizeOrigin(request.Origin, out var origin))
        {
            ModelState.AddModelError(
                nameof(request.Origin),
                "Origin must be a scheme and host without a path, for example https://acme.example.");
            return ValidationProblem(ModelState);
        }

        if (await db.ProjectOrigins.AnyAsync(o => o.ProjectId == id && o.Origin == origin, cancellationToken))
        {
            return OriginTaken();
        }

        var projectOrigin = new ProjectOrigin { ProjectId = id, Origin = origin };

        db.ProjectOrigins.Add(projectOrigin);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            return OriginTaken();
        }

        return Created((string?)null, new ProjectOriginResponse(projectOrigin.Id, projectOrigin.Origin));
    }

    /// <summary>Usuwa origin projektu.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    [HttpDelete("{id:guid}/origins/{originId:guid}")]
    [Authorize(Roles = AccessTokenIssuer.AdminRole)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveOrigin(Guid id, Guid originId, CancellationToken cancellationToken)
    {
        var origin = await db.ProjectOrigins
            .SingleOrDefaultAsync(o => o.Id == originId && o.ProjectId == id, cancellationToken);

        if (origin is null)
        {
            return NotFound();
        }

        db.ProjectOrigins.Remove(origin);

        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    // przegladarka wysyla origin bez sciezki i bez domyslnego portu wiec w tej samej postaci trafia do bazy
    private static bool TryNormalizeOrigin(string value, out string origin)
    {
        origin = string.Empty;

        if (!Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || uri.AbsolutePath != "/"
            || uri.Query.Length > 0
            || uri.Fragment.Length > 0
            || uri.UserInfo.Length > 0)
        {
            return false;
        }

        origin = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }

    private static bool IsUniqueViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private ActionResult KeyTaken()
    {
        ModelState.AddModelError(nameof(CreateProjectRequest.Key), "A project with this key already exists.");
        return ValidationProblem(ModelState);
    }

    private ObjectResult OriginTaken() => Problem(
        title: "This origin is already allowed for the project.",
        statusCode: StatusCodes.Status409Conflict);

    private static ProjectResponse Describe(Project project) => new(
        project.Id,
        project.Name,
        project.Key,
        project.CreatedAt,
        project.Origins.Select(o => new ProjectOriginResponse(o.Id, o.Origin)).ToList());
}
