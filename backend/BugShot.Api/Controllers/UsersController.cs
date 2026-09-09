using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[EnableCors(CorsPolicies.Dashboard)]
[Authorize(Roles = AccessTokenIssuer.AdminRole)]
[Produces(MediaTypeNames.Application.Json)]
public class UsersController(BugShotDbContext db) : ControllerBase
{
    /// <summary>Zwraca wszystkie konta panelu.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    // lista bez paginacji bo konta zaklada admin recznie i jest ich tyle co osob w zespole
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<UserResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<UserResponse>>> GetList(CancellationToken cancellationToken)
    {
        var users = await db.Users
            .AsNoTracking()
            .OrderBy(u => u.Email)
            .Select(u => new UserResponse(u.Id, u.Email, u.IsAdmin, u.IsActive, u.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(users);
    }

    /// <summary>Zaklada konto panelu.</summary>
    /// <remarks>Tylko dla administratora. Zajety adres konczy sie na 409.</remarks>
    [HttpPost]
    [ProducesResponseType<UserResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserResponse>> Create(
        CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var email = AuthController.Normalize(request.Email);

        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return Problem(
                title: "A user with this email already exists.",
                statusCode: StatusCodes.Status409Conflict);
        }

        var user = new User
        {
            Email = email,
            PasswordHash = PasswordHasher.Hash(request.Password),
            IsAdmin = request.IsAdmin
        };

        db.Users.Add(user);

        await db.SaveChangesAsync(cancellationToken);

        // bez Location bo konto nie ma wlasnego adresu i zostaje sama lista
        return Created((string?)null, AuthController.Describe(user));
    }

    /// <summary>Wylacza konto i zamyka jego sesje.</summary>
    /// <remarks>
    /// Tylko dla administratora. Wlasnego konta wylaczyc nie mozna wiec taka proba konczy sie na 409.
    /// Konto traci dostep od razu a nie po wygasnieciu swojego access tokena.
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

        return NoContent();
    }

    /// <summary>Ustawia nowe haslo konta.</summary>
    /// <remarks>Tylko dla administratora. Zmiana hasla zamyka wszystkie sesje konta.</remarks>
    [HttpPost("{id:guid}/reset-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResetPassword(
        Guid id,
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user is null)
        {
            return NotFound();
        }

        user.PasswordHash = PasswordHasher.Hash(request.Password);

        // jedna transakcja bo token odswiezajacy nie zna hasla
        // wiec sam zapis bez uniewaznienia zostawilby stare sesje zywe na tydzien
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        await RevokeSessions(id, cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return NoContent();
    }

    private Task<int> RevokeSessions(Guid userId, CancellationToken cancellationToken) =>
        db.UserRefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(
                update => update.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow),
                cancellationToken);
}
