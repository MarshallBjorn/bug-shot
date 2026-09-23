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
[Route("api/v1/users")]
[EnableCors(CorsPolicies.Dashboard)]
[Authorize(Roles = AccessTokenIssuer.AdminRole)]
[Produces(MediaTypeNames.Application.Json)]
public class UsersController(BugShotDbContext db, AccountLinks links) : ControllerBase
{
    /// <summary>Zwraca wszystkie konta panelu razem z ich dostepem do projektow.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    // lista bez paginacji bo konta zaklada admin recznie i jest ich tyle co osob w zespole
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<UserAccountResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<UserAccountResponse>>> GetList(CancellationToken cancellationToken)
    {
        var users = await Accounts()
            .OrderBy(u => u.Email)
            .ToListAsync(cancellationToken);

        return Ok(users.Select(Describe).ToList());
    }

    /// <summary>Zaklada konto i wysyla zaproszenie mailem.</summary>
    /// <remarks>
    /// Tylko dla administratora. Konto dostaje haslo dopiero z linku w mailu wazny 72 godziny.
    /// Gdy mail nie wyjdzie konto i tak powstaje a odpowiedz niesie link do przekazania recznie.
    /// Zajety adres konczy sie na 409.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType<CreatedUserResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CreatedUserResponse>> Create(
        CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var projects = request.Projects ?? [];

        if (await InvalidProjects(projects, cancellationToken) is { } invalid)
        {
            return invalid;
        }

        var email = AuthController.Normalize(request.Email);

        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return EmailTaken();
        }

        var user = new User
        {
            Email = email,
            IsAdmin = request.IsAdmin,
            Memberships = projects
                .Select(p => new ProjectMember { ProjectId = p.ProjectId, Role = p.Role })
                .ToList()
        };

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation
        })
        {
            // rownolegle zaproszenie na ten sam adres przeszlo miedzy sprawdzeniem a zapisem
            return EmailTaken();
        }

        var delivery = await links.Issue(Request, user, UserTokenPurpose.Invitation, cancellationToken);

        // bez Location bo konto nie ma wlasnego adresu i zostaje sama lista
        return Created(
            (string?)null,
            new CreatedUserResponse(await Account(user.Id, cancellationToken), delivery.EmailSent, delivery.Link));
    }

    /// <summary>Nadaje albo odbiera konto administratora.</summary>
    /// <remarks>
    /// Tylko dla administratora. Wlasnej roli zmienic nie mozna wiec taka proba konczy sie na 409.
    /// Zmiana dziala od nastepnego zadania konta bez czekania na nowy token.
    /// </remarks>
    [HttpPatch("{id:guid}")]
    [ProducesResponseType<UserAccountResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserAccountResponse>> Update(
        Guid id,
        UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        // wystarcza jedna blokada bo zmieniajacy zawsze sam zostaje administratorem
        if (id == User.UserId())
        {
            return Problem(
                title: "You cannot change your own administrator role.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        user.IsAdmin = request.IsAdmin;

        await db.SaveChangesAsync(cancellationToken);

        return Ok(await Account(id, cancellationToken));
    }

    /// <summary>Ustawia pelna liste projektow konta razem z rola w kazdym z nich.</summary>
    /// <remarks>
    /// Tylko dla administratora. Projekt spoza listy traci dostep od nastepnego zadania.
    /// Administrator widzi wszystkie projekty niezaleznie od tej listy.
    /// </remarks>
    [HttpPut("{id:guid}/projects")]
    [ProducesResponseType<UserAccountResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserAccountResponse>> SetProjects(
        Guid id,
        IReadOnlyList<ProjectAccessRequest> projects,
        CancellationToken cancellationToken)
    {
        if (await InvalidProjects(projects, cancellationToken) is { } invalid)
        {
            return invalid;
        }

        if (!await db.Users.AnyAsync(u => u.Id == id, cancellationToken))
        {
            return NotFound();
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        await db.ProjectMembers
            .Where(m => m.UserId == id)
            .ExecuteDeleteAsync(cancellationToken);

        db.ProjectMembers.AddRange(projects.Select(p => new ProjectMember
        {
            ProjectId = p.ProjectId,
            UserId = id,
            Role = p.Role
        }));

        await db.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Ok(await Account(id, cancellationToken));
    }

    /// <summary>Wylacza konto i zamyka jego sesje.</summary>
    /// <remarks>
    /// Tylko dla administratora. Wlasnego konta wylaczyc nie mozna wiec taka proba konczy sie na 409.
    /// Konto traci dostep od razu a nie po wygasnieciu swojego access tokena. Niewykorzystany link z maila przestaje dzialac.
    /// </remarks>
    [HttpPatch("{id:guid}/deactivate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        // bez tego ostatni admin potrafi zamknac sie na zewnatrz jednym klikiem
        if (id == User.UserId())
        {
            return Problem(
                title: "You cannot deactivate your own account.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        user.IsActive = false;

        await db.SaveChangesAsync(cancellationToken);

        // bez tego wylaczone konto zylo by jeszcze tyle ile zostalo jego tokenowi odswiezajacemu
        await RevokeSessions(id, cancellationToken);

        await db.UserTokens
            .Where(t => t.UserId == id && t.UsedAt == null)
            .ExecuteDeleteAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>Wlacza z powrotem wylaczone konto.</summary>
    /// <remarks>Tylko dla administratora. Konto loguje sie dotychczasowym haslem i ma dotychczasowe projekty.</remarks>
    [HttpPatch("{id:guid}/activate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Activate(Guid id, CancellationToken cancellationToken)
    {
        var updated = await db.Users
            .Where(u => u.Id == id)
            .ExecuteUpdateAsync(update => update.SetProperty(u => u.IsActive, true), cancellationToken);

        return updated == 0 ? NotFound() : NoContent();
    }

    /// <summary>Wysyla zaproszenie jeszcze raz.</summary>
    /// <remarks>
    /// Tylko dla administratora. Poprzedni link przestaje dzialac. Konto z ustawionym haslem albo wylaczone konczy sie na 409.
    /// </remarks>
    [HttpPost("{id:guid}/invitation")]
    [ProducesResponseType<AccountLinkResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AccountLinkResponse>> ResendInvitation(Guid id, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        if (user.PasswordHash is not null || !user.IsActive)
        {
            return Problem(
                title: "Only an active account without a password can be invited.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return Ok(await links.Issue(Request, user, UserTokenPurpose.Invitation, cancellationToken));
    }

    /// <summary>Wysyla link do ustawienia nowego hasla.</summary>
    /// <remarks>
    /// Tylko dla administratora. Link jest wazny godzine. Dotychczasowe haslo i sesje dzialaja do czasu ustawienia nowego.
    /// Konto bez hasla albo wylaczone konczy sie na 409.
    /// </remarks>
    [HttpPost("{id:guid}/reset-password")]
    [ProducesResponseType<AccountLinkResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AccountLinkResponse>> ResetPassword(Guid id, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        if (user.PasswordHash is null || !user.IsActive)
        {
            return Problem(
                title: "Only an active account with a password can reset it.",
                statusCode: StatusCodes.Status409Conflict);
        }

        return Ok(await links.Issue(Request, user, UserTokenPurpose.PasswordReset, cancellationToken));
    }

    /// <summary>Usuwa konto, ktore nie przyjelo zaproszenia.</summary>
    /// <remarks>
    /// Tylko dla administratora. Konto z ustawionym haslem mozna tylko wylaczyc bo wisi na historii zmian, taka proba konczy sie na 409.
    /// </remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        if (user.PasswordHash is not null)
        {
            return Problem(
                title: "Only an account that never accepted its invitation can be deleted.",
                statusCode: StatusCodes.Status409Conflict);
        }

        db.Users.Remove(user);

        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    internal static UserAccountState State(User user) =>
        !user.IsActive ? UserAccountState.Disabled
        : user.PasswordHash is null ? UserAccountState.Invited
        : UserAccountState.Active;

    private IQueryable<User> Accounts() =>
        db.Users
            .AsNoTracking()
            .Include(u => u.Memberships)
            .ThenInclude(m => m.Project);

    private async Task<UserAccountResponse> Account(Guid id, CancellationToken cancellationToken) =>
        Describe(await Accounts().SingleAsync(u => u.Id == id, cancellationToken));

    private static UserAccountResponse Describe(User user) => new(
        user.Id,
        user.Email,
        user.IsAdmin,
        State(user),
        user.CreatedAt,
        user.Memberships
            .OrderBy(m => m.Project.Name)
            .Select(m => new UserProjectResponse(m.ProjectId, m.Project.Name, m.Role))
            .ToList());

    private async Task<ActionResult?> InvalidProjects(
        IReadOnlyList<ProjectAccessRequest> projects,
        CancellationToken cancellationToken)
    {
        var field = nameof(CreateUserRequest.Projects);

        if (projects.Any(p => !Enum.IsDefined(p.Role)))
        {
            ModelState.AddModelError(field, "Unknown project role.");
        }

        if (projects.Select(p => p.ProjectId).Distinct().Count() != projects.Count)
        {
            ModelState.AddModelError(field, "Each project can appear only once.");
        }

        var ids = projects.Select(p => p.ProjectId).Distinct().ToList();

        var known = await db.Projects.CountAsync(p => ids.Contains(p.Id), cancellationToken);

        if (known != ids.Count)
        {
            ModelState.AddModelError(field, "Unknown project.");
        }

        return ModelState.IsValid ? null : ValidationProblem(ModelState);
    }

    private ObjectResult EmailTaken() => Problem(
        title: "A user with this email already exists.",
        statusCode: StatusCodes.Status409Conflict);

    private Task<int> RevokeSessions(Guid userId, CancellationToken cancellationToken) =>
        db.UserRefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow),
                cancellationToken);
}
