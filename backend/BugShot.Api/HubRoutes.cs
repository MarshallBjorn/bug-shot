namespace BugShot.Api;

// kanal live niesie kontrakty wersji v1 wiec siedzi pod tym samym prefiksem co reszta API
// jeden prefiks to tez jedna regula na proxy zamiast dwoch
public static class HubRoutes
{
    public const string Prefix = "/api/v1/hubs";

    public const string Tickets = $"{Prefix}/tickets";
}
