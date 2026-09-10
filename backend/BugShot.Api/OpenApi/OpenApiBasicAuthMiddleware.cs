using System.Net.Http.Headers;
using System.Text;

namespace BugShot.Api.OpenApi;

// Swagger UI to strona otwierana w przegladarce a access token panelu zyje w pamieci karty
// wiec nie ma kto dolozyc naglowka Authorization. Basic auth przegladarka poda sama
public sealed class OpenApiBasicAuthMiddleware(RequestDelegate next, OpenApiAccess access)
{
    private const string Scheme = "Basic";
    private const string Challenge = $"{Scheme} realm=\"bug-shot\", charset=\"UTF-8\"";

    public async Task InvokeAsync(HttpContext context)
    {
        if (Authorized(context.Request))
        {
            await next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.Headers.WWWAuthenticate = Challenge;
    }

    private bool Authorized(HttpRequest request)
    {
        if (!AuthenticationHeaderValue.TryParse(request.Headers.Authorization, out var header)
            || !Scheme.Equals(header.Scheme, StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrEmpty(header.Parameter))
        {
            return false;
        }

        string decoded;

        try
        {
            decoded = Encoding.UTF8.GetString(Convert.FromBase64String(header.Parameter));
        }
        catch (FormatException)
        {
            return false;
        }

        var separator = decoded.IndexOf(':');

        if (separator < 0)
        {
            return false;
        }

        return access.Matches(decoded[..separator], decoded[(separator + 1)..]);
    }
}
