namespace BugShot.Api.Security;

// link w mailu prowadzi do panelu z ktorego wyszlo zadanie wiec nie trzeba osobnej zmiennej z adresem
public sealed class DashboardOrigins(IReadOnlyList<string> origins)
{
    public string? For(HttpRequest request)
    {
        var origin = request.Headers.Origin.ToString();

        var matching = origins.FirstOrDefault(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase));

        // bez naglowka Origin na przyklad z curla zostaje pierwszy panel z konfiguracji
        return (matching ?? origins.FirstOrDefault())?.TrimEnd('/');
    }
}
