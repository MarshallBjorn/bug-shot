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
[Route("api/v1/auth")]
[EnableCors(CorsPolicies.Dashboard)]
public class AuthController(
    BugShotDbContext db,
    AccessTokenIssuer tokens,
    ILogger<AuthController> logger) : ControllerBase
{
    // powtorka tego samego zadania z panelu nie jest jeszcze kradzieza tokena
    private static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(30);

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AccessTokenResponse>> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var email = Normalize(request.Email);

        var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (user is null)
        {
            // bez tego nieznany adres odpowiada zauwazalnie szybciej niz znany
            PasswordHasher.BurnTiming(request.Password);
            return InvalidCredentials();
        }

        if (!PasswordHasher.Verify(request.Password, user.PasswordHash) || !user.IsActive)
        {
            return InvalidCredentials();
        }

        return await IssueSession(user, cancellationToken);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AccessTokenResponse>> Refresh(CancellationToken cancellationToken)
    {
        if (!Request.Cookies.TryGetValue(RefreshToken.CookieName, out var provided)
            || string.IsNullOrWhiteSpace(provided))
        {
            return ExpiredSession();
        }

        var hash = RefreshToken.Hash(provided);
        var now = DateTimeOffset.UtcNow;

        var token = await db.UserRefreshTokens
            .AsNoTracking()
            .SingleOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);

        if (token is null || token.ExpiresAt <= now)
        {
            return ExpiredSession();
        }

        if (token.RevokedAt is not null || token.UsedAt is not null)
        {
            // token wraca po czasie wiec albo trafil do kogos obcego albo klient ma blad
            // w obu przypadkach bezpieczniej zamknac wszystkie sesje niz udawac ze nic sie nie stalo
            if (token.UsedAt is null || now - token.UsedAt > ReuseGrace)
            {
                await RevokeAll(token.UserId, now, cancellationToken);

                logger.LogWarning(
                    "Ponowne uzycie tokena odswiezajacego uzytkownika {UserId}, uniewazniono wszystkie sesje",
                    token.UserId);
            }

            return ExpiredSession();
        }

        // pojedynczy update zamiast odczytu i zapisu bo dwa rownolegle zadania moga trafic w ten sam token
        var consumed = await db.UserRefreshTokens
            .Where(t => t.TokenHash == hash && t.UsedAt == null && t.RevokedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(t => t.UsedAt, now), cancellationToken);

        if (consumed != 1)
        {
            return ExpiredSession();
        }

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == token.UserId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            await RevokeAll(token.UserId, now, cancellationToken);
            return ExpiredSession();
        }

        return await IssueSession(user, cancellationToken);
    }

    [HttpPost("logout")]
    // wylogowanie ma dzialac takze z wygaslym access tokenem wiec liczy sie samo cookie
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        if (Request.Cookies.TryGetValue(RefreshToken.CookieName, out var provided)
            && !string.IsNullOrWhiteSpace(provided))
        {
            var hash = RefreshToken.Hash(provided);

            await db.UserRefreshTokens
                .Where(t => t.TokenHash == hash && t.RevokedAt == null)
                .ExecuteUpdateAsync(
                    update => update.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        ClearRefreshCookie();

        return NoContent();
    }

    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken cancellationToken)
    {
        var user = await db.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(u => u.Id == User.UserId(), cancellationToken);

        // konto wylaczone w trakcie zycia tokena traci dostep bez czekania na jego wygasniecie
        if (user is null || !user.IsActive)
        {
            return ExpiredSession();
        }

        return Ok(Describe(user));
    }

    internal static UserResponse Describe(User user) =>
        new(user.Id, user.Email, user.IsAdmin, user.IsActive, user.CreatedAt);

    internal static string Normalize(string email) => email.Trim().ToLowerInvariant();

    private async Task<ActionResult<AccessTokenResponse>> IssueSession(
        User user,
        CancellationToken cancellationToken)
    {
        var refresh = RefreshToken.Create();
        var refreshExpiresAt = DateTimeOffset.UtcNow.Add(RefreshToken.Lifetime);

        db.UserRefreshTokens.Add(new UserRefreshToken
        {
            UserId = user.Id,
            TokenHash = RefreshToken.Hash(refresh),
            ExpiresAt = refreshExpiresAt
        });

        await db.SaveChangesAsync(cancellationToken);

        var (accessToken, accessExpiresAt) = tokens.Issue(user);

        Response.Cookies.Append(RefreshToken.CookieName, refresh, RefreshCookie(refreshExpiresAt));

        return Ok(new AccessTokenResponse(accessToken, accessExpiresAt, Describe(user)));
    }

    private Task<int> RevokeAll(Guid userId, DateTimeOffset now, CancellationToken cancellationToken) =>
        db.UserRefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(t => t.RevokedAt, now), cancellationToken);

    private ObjectResult InvalidCredentials() =>
        // ta sama odpowiedz dla nieznanego adresu zlego hasla i wylaczonego konta
        Problem(title: "Invalid email or password.", statusCode: StatusCodes.Status401Unauthorized);

    private ObjectResult ExpiredSession()
    {
        ClearRefreshCookie();
        return Problem(title: "Session is not valid.", statusCode: StatusCodes.Status401Unauthorized);
    }

    private void ClearRefreshCookie() =>
        Response.Cookies.Delete(RefreshToken.CookieName, RefreshCookie(DateTimeOffset.UnixEpoch));

    // Lax wystarcza bo panel i API sa same-site zarowno lokalnie jak i za wspolnym proxy
    private static CookieOptions RefreshCookie(DateTimeOffset expiresAt) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Lax,
        Path = RefreshToken.CookiePath,
        Expires = expiresAt,
        IsEssential = true
    };
}
