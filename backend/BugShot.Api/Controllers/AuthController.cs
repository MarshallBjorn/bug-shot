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
[Route("api/v1/auth")]
[EnableCors(CorsPolicies.Dashboard)]
[Produces(MediaTypeNames.Application.Json)]
public class AuthController(
    BugShotDbContext db,
    AccessTokenIssuer tokens,
    SetupToken setup,
    ILogger<AuthController> logger) : ControllerBase
{
    // powtorka tego samego zadania z panelu nie jest jeszcze kradzieza tokena
    private static readonly TimeSpan ReuseGrace = TimeSpan.FromSeconds(30);

    /// <summary>Otwiera sesje panelu.</summary>
    /// <remarks>
    /// Zwraca access token na kwadrans i doklada cookie z tokenem odswiezajacym na tydzien.
    /// Nieznany adres zle haslo i wylaczone konto koncza sie ta sama odpowiedzia 401.
    /// </remarks>
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

        // zaproszone konto bez hasla odpowiada tak samo jak nieznany adres
        if (user?.PasswordHash is null)
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

    /// <summary>Wymienia cookie z tokenem odswiezajacym na nowy access token.</summary>
    /// <remarks>
    /// Token odswiezajacy rotuje przy kazdym uzyciu. Podany drugi raz zamyka wszystkie sesje konta.
    /// </remarks>
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

    /// <summary>Zamyka sesje i czysci cookie.</summary>
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

    /// <summary>Zwraca konto z biezacego tokena.</summary>
    /// <remarks>Konto wylaczone w trakcie zycia tokena dostaje 401 bez czekania na jego wygasniecie.</remarks>
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

    /// <summary>Mowi czy instancja czeka na zalozenie pierwszego konta.</summary>
    /// <remarks>Prawda tylko wtedy gdy API wystartowalo bez ADMIN_EMAIL i nie ma jeszcze zadnego konta.</remarks>
    [HttpGet("setup")]
    [AllowAnonymous]
    [ProducesResponseType<SetupStatusResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SetupStatusResponse>> SetupStatus(CancellationToken cancellationToken) =>
        Ok(new SetupStatusResponse(setup.IsOpen && !await db.Users.AnyAsync(cancellationToken)));

    /// <summary>Zaklada pierwsze konto administratora i otwiera jego sesje.</summary>
    /// <remarks>
    /// Token pochodzi z logu API i dziala raz. Zly token konczy sie na 403, a instancja z kontem na 409.
    /// </remarks>
    [HttpPost("setup")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AccessTokenResponse>> Setup(
        SetupRequest request,
        CancellationToken cancellationToken)
    {
        if (await db.Users.AnyAsync(cancellationToken))
        {
            return Problem(title: "Setup is already done.", statusCode: StatusCodes.Status409Conflict);
        }

        if (!setup.TryConsume(request.Token))
        {
            return Problem(title: "Setup token is not valid.", statusCode: StatusCodes.Status403Forbidden);
        }

        var user = new User
        {
            Email = Normalize(request.Email),
            PasswordHash = PasswordHasher.Hash(request.Password),
            IsAdmin = true
        };

        db.Users.Add(user);

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Kreator zalozyl pierwsze konto administratora {UserId}", user.Id);

        return await IssueSession(user, cancellationToken);
    }

    /// <summary>Sprawdza link z maila zanim konto ustawi haslo.</summary>
    /// <remarks>Nieznany, zuzyty, wygasly link i wylaczone konto koncza sie ta sama odpowiedzia 404.</remarks>
    [HttpPost("account-token")]
    [AllowAnonymous]
    [ProducesResponseType<AccountTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccountTokenResponse>> InspectAccountToken(
        AccountTokenRequest request,
        CancellationToken cancellationToken)
    {
        var hash = UserTokens.Hash(request.Token);
        var now = DateTimeOffset.UtcNow;

        var found = await db.UserTokens
            .AsNoTracking()
            .Where(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > now && t.User.IsActive)
            .Select(t => new AccountTokenResponse(t.User.Email, t.Purpose))
            .SingleOrDefaultAsync(cancellationToken);

        return found is null ? InvalidLink() : Ok(found);
    }

    /// <summary>Ustawia haslo z linku w mailu i otwiera sesje.</summary>
    /// <remarks>
    /// Link dziala raz. Ustawienie hasla zamyka wszystkie dotychczasowe sesje konta.
    /// Nieznany, zuzyty, wygasly link i wylaczone konto koncza sie ta sama odpowiedzia 404.
    /// </remarks>
    [HttpPost("set-password")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccessTokenResponse>> SetPassword(
        SetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var hash = UserTokens.Hash(request.Token);
        var now = DateTimeOffset.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // pojedynczy update bo dwa rownolegle zadania z tym samym linkiem nie moga przejsc oba
        var consumed = await db.UserTokens
            .Where(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(t => t.UsedAt, now), cancellationToken);

        if (consumed != 1)
        {
            return InvalidLink();
        }

        var user = await db.UserTokens
            .Where(t => t.TokenHash == hash)
            .Select(t => t.User)
            .SingleAsync(cancellationToken);

        if (!user.IsActive)
        {
            return InvalidLink();
        }

        user.PasswordHash = PasswordHasher.Hash(request.Password);

        await db.SaveChangesAsync(cancellationToken);

        await RevokeAll(user.Id, now, cancellationToken);

        // drugi link do tego samego konta nie moze pozniej nadpisac swiezo ustawionego hasla
        await db.UserTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ExecuteDeleteAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return await IssueSession(user, cancellationToken);
    }

    /// <summary>Zmienia haslo zalogowanego konta.</summary>
    /// <remarks>
    /// Wymaga obecnego hasla. Zle obecne haslo konczy sie bledem walidacji na polu currentPassword.
    /// Pozostale sesje konta zostaja zamkniete, biezaca dziala dalej.
    /// </remarks>
    [HttpPost("password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleAsync(u => u.Id == User.UserId(), cancellationToken);

        // 400 a nie 401 bo panel traktuje 401 jako koniec sesji i wylogowalby konto
        if (user.PasswordHash is null || !PasswordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            ModelState.AddModelError(nameof(ChangePasswordRequest.CurrentPassword), "Current password is not valid.");
            return ValidationProblem(ModelState);
        }

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);

        await db.SaveChangesAsync(cancellationToken);

        byte[]? current = Request.Cookies.TryGetValue(RefreshToken.CookieName, out var provided)
            && !string.IsNullOrWhiteSpace(provided)
                ? RefreshToken.Hash(provided)
                : null;

        await db.UserRefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedAt == null && t.TokenHash != current)
            .ExecuteUpdateAsync(
                update => update.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow),
                cancellationToken);

        return NoContent();
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

    private ObjectResult InvalidLink() =>
        Problem(title: "This link is not valid anymore.", statusCode: StatusCodes.Status404NotFound);

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
