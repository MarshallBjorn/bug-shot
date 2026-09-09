using System.Security.Claims;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace BugShot.Api.Tests;

public class AccessTokenIssuerTests
{
    private static readonly AccessTokenIssuer Issuer = new(TestKeys.Signing());

    private static User NewUser(bool isAdmin = false) => new()
    {
        Id = Guid.NewGuid(),
        Email = "dev@bug-shot.test",
        IsAdmin = isAdmin
    };

    private static async Task<ClaimsPrincipal> Read(string token, AccessTokenIssuer issuer)
    {
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, issuer.ValidationParameters);

        Assert.True(result.IsValid);

        return new ClaimsPrincipal(result.ClaimsIdentity);
    }

    // HS256 kluczem krotszym niz skrot da sie podpisac ale nie da sie na tym polegac
    [Fact]
    public void ZaKrotkiKluczNieJestPrzyjmowany()
    {
        var tooShort = new string('a', 31);

        Assert.Throws<InvalidOperationException>(() => new AccessTokenIssuer(tooShort));
    }

    [Fact]
    public async Task TokenNiesieIdentyfikatorIAdresKonta()
    {
        var user = NewUser();
        var (token, _) = Issuer.Issue(user);

        var principal = await Read(token, Issuer);

        Assert.Equal(user.Id, principal.UserId());
        Assert.Equal(user.Email, principal.FindFirstValue(JwtRegisteredClaimNames.Email));
    }

    [Fact]
    public async Task AdminDostajeRoleAZwyklyUzytkownikNie()
    {
        var (adminToken, _) = Issuer.Issue(NewUser(isAdmin: true));
        var (userToken, _) = Issuer.Issue(NewUser());

        Assert.True((await Read(adminToken, Issuer)).IsInRole(AccessTokenIssuer.AdminRole));
        Assert.False((await Read(userToken, Issuer)).IsInRole(AccessTokenIssuer.AdminRole));
    }

    [Fact]
    public void TokenWygasaPoKwadransie()
    {
        var (_, expiresAt) = Issuer.Issue(NewUser());

        Assert.InRange(
            expiresAt,
            DateTimeOffset.UtcNow.Add(AccessTokenIssuer.Lifetime).AddSeconds(-30),
            DateTimeOffset.UtcNow.Add(AccessTokenIssuer.Lifetime));
    }

    [Fact]
    public async Task TokenPodpisanyInnymKluczemNieJestWazny()
    {
        var other = new AccessTokenIssuer(TestKeys.Signing());
        var (token, _) = other.Issue(NewUser());

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, Issuer.ValidationParameters);

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task TokenDlaInnegoOdbiorcyNieJestWazny()
    {
        var (token, _) = Issuer.Issue(NewUser());

        var parameters = Issuer.ValidationParameters;
        parameters.ValidAudience = "ktos-inny";

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, parameters);

        Assert.False(result.IsValid);
    }

    // domyslne piec minut tolerancji przedluzyloby kwadransowy token o jedna trzecia
    [Fact]
    public void WalidacjaNieDajeTolerancjiNaRozjazdZegarow()
    {
        Assert.Equal(TimeSpan.Zero, Issuer.ValidationParameters.ClockSkew);
    }
}
