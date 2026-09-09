using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace BugShot.Api.Security;

public static class ClaimsPrincipalExtensions
{
    // token przechodzi walidacje wiec sub zawsze jest i zawsze jest guidem
    public static Guid UserId(this ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
}
