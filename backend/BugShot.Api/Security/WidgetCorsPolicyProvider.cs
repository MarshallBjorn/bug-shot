using BugShot.Api.Data;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BugShot.Api.Security;

// originy widgetu dopisuje sie w panelu wiec lista z konfiguracji sama nie wystarczy
// dlatego polityka widgetu doklada origin z zadania jesli ma go ktorykolwiek projekt
public sealed class WidgetCorsPolicyProvider(IOptions<CorsOptions> options) : ICorsPolicyProvider
{
    private readonly DefaultCorsPolicyProvider configured = new(options);

    public async Task<CorsPolicy?> GetPolicyAsync(HttpContext context, string? policyName)
    {
        var policy = await configured.GetPolicyAsync(context, policyName);

        if (policy is null || policyName is not (CorsPolicies.Widget or CorsPolicies.WidgetUpload))
        {
            return policy;
        }

        var origin = context.Request.Headers.Origin.ToString();

        if (string.IsNullOrEmpty(origin) || policy.IsOriginAllowed(origin))
        {
            return policy;
        }

        // przegladarka wysyla origin lowercase ale w bazie moze byc wpisany recznie
        var lowered = origin.ToLowerInvariant();
        var db = context.RequestServices.GetRequiredService<BugShotDbContext>();

        if (!await db.ProjectOrigins.AnyAsync(o => o.Origin.ToLower() == lowered, context.RequestAborted))
        {
            return policy;
        }

        // o projekcie decyduje dopiero kontroler bo preflight nie niesie projectKey
        // kopia polityki sprawdzalaby stara liste originow wiec warunek idzie wprost
        return new CorsPolicyBuilder(policy)
            .SetIsOriginAllowed(candidate =>
                string.Equals(candidate, origin, StringComparison.OrdinalIgnoreCase) || policy.IsOriginAllowed(candidate))
            .Build();
    }
}
