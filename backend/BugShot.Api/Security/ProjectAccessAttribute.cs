using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Security;

// skad wziac projekt gdy trasa niesie identyfikator czegos w srodku projektu
public enum ProjectAccessScope
{
    Project,
    Ticket,
    Attachment
}

public sealed class ProjectAccessAttribute : TypeFilterAttribute
{
    public ProjectAccessAttribute(
        ProjectRole minimum,
        ProjectAccessScope scope = ProjectAccessScope.Project,
        string routeKey = "projectId")
        : base(typeof(ProjectAccessFilter))
    {
        Arguments = [minimum, scope, routeKey];
    }
}

public sealed class ProjectAccessFilter(
    ProjectRole minimum,
    ProjectAccessScope scope,
    string routeKey,
    BugShotDbContext db,
    ProjectAccess access,
    ProblemDetailsFactory problems) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var cancellationToken = context.HttpContext.RequestAborted;

        if (!context.RouteData.Values.TryGetValue(routeKey, out var raw)
            || !Guid.TryParse(raw?.ToString(), out var id))
        {
            context.Result = Problem(context, StatusCodes.Status404NotFound, title: null);
            return;
        }

        var projectId = scope switch
        {
            ProjectAccessScope.Project => id,
            ProjectAccessScope.Ticket => await db.Tickets
                .Where(t => t.Id == id)
                .Select(t => (Guid?)t.ProjectId)
                .SingleOrDefaultAsync(cancellationToken),
            ProjectAccessScope.Attachment => await db.TicketAttachments
                .Where(a => a.Id == id)
                .Select(a => (Guid?)a.Ticket.ProjectId)
                .SingleOrDefaultAsync(cancellationToken),
            _ => throw new ArgumentOutOfRangeException(nameof(scope))
        };

        var role = projectId is null
            ? null
            : await access.RoleIn(context.HttpContext.User, projectId.Value, cancellationToken);

        // cudzy projekt odpowiada jak nieistniejacy zeby nie zdradzac co jest w instancji
        if (role is null)
        {
            context.Result = Problem(context, StatusCodes.Status404NotFound, title: null);
            return;
        }

        if (role < minimum)
        {
            context.Result = Problem(
                context,
                StatusCodes.Status403Forbidden,
                "Your role in this project does not allow this action.");
        }
    }

    private ObjectResult Problem(AuthorizationFilterContext context, int statusCode, string? title) =>
        new(problems.CreateProblemDetails(context.HttpContext, statusCode, title))
        {
            StatusCode = statusCode
        };
}
