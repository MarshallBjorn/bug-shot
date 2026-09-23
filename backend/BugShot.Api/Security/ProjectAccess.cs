using System.Security.Claims;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Security;

// rola w projekcie nie siedzi w tokenie wiec zmiana dostepu dziala od nastepnego zadania
public class ProjectAccess(BugShotDbContext db)
{
    // admin instancji ma w kazdym projekcie prawa maintainera bez wpisu w project_members
    public async Task<ProjectRole?> RoleIn(
        ClaimsPrincipal user,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        if (user.IsAdmin())
        {
            return await db.Projects.AnyAsync(p => p.Id == projectId, cancellationToken)
                ? ProjectRole.Maintainer
                : null;
        }

        var userId = user.UserId();

        return await db.ProjectMembers
            .Where(m => m.ProjectId == projectId && m.UserId == userId)
            .Select(m => (ProjectRole?)m.Role)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public IQueryable<Project> Visible(ClaimsPrincipal user)
    {
        if (user.IsAdmin())
        {
            return db.Projects;
        }

        var userId = user.UserId();

        return db.Projects.Where(p => p.Members.Any(m => m.UserId == userId));
    }
}
