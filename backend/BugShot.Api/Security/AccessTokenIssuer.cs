using System.Security.Claims;
using System.Text;
using BugShot.Api.Models;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace BugShot.Api.Security;

// wystawianie i sprawdzanie tokena siedzi w jednym miejscu zeby nie rozjechaly sie parametry
public class AccessTokenIssuer
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    public const string Issuer = "bug-shot";

    public const string Audience = "bug-shot-dashboard";

    public const string AdminRole = "admin";

    public const string RoleClaim = "role";

    // HS256 wymaga klucza nie krotszego niz dlugosc skrotu
    private const int MinKeyBytes = 32;

    private readonly SigningCredentials credentials;
    private readonly SymmetricSecurityKey key;

    public AccessTokenIssuer(string signingKey)
    {
        var bytes = Encoding.UTF8.GetBytes(signingKey);

        if (bytes.Length < MinKeyBytes)
        {
            throw new InvalidOperationException(
                $"JWT_SIGNING_KEY must be at least {MinKeyBytes} bytes long.");
        }

        key = new SymmetricSecurityKey(bytes);
        credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    }

    public TokenValidationParameters ValidationParameters => new()
    {
        ValidateIssuer = true,
        ValidIssuer = Issuer,
        ValidateAudience = true,
        ValidAudience = Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = key,
        ValidateLifetime = true,
        // domyslne piec minut tolerancji przedluzyloby kwadransowy token o jedna trzecia
        ClockSkew = TimeSpan.Zero,
        NameClaimType = JwtRegisteredClaimNames.Sub,
        RoleClaimType = RoleClaim
    };

    public (string Token, DateTimeOffset ExpiresAt) Issue(User user)
    {
        var expiresAt = DateTimeOffset.UtcNow.Add(Lifetime);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (user.IsAdmin)
        {
            claims.Add(new Claim(RoleClaim, AdminRole));
        }

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = Audience,
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = credentials
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expiresAt);
    }
}
