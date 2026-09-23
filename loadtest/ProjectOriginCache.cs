using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace BugShot.Api.Caching;

public sealed class ProjectOriginCache
{
    private readonly IMemoryCache _cache;
    private readonly IServiceScopeFactory _scopeFactory;
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);

    public ProjectOriginCache(IMemoryCache cache, IServiceScopeFactory scopeFactory)
    {
        _cache = cache;
        _scopeFactory = scopeFactory;
    }

    public async Task<HashSet<string>> GetOriginsAsync(Guid projectId, CancellationToken ct)
    {
        var key = $"origins:{projectId}";

        if (_cache.TryGetValue(key, out HashSet<string>? cached))
            return cached!;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.BugShotDbContext>();

        var origins = await db.ProjectOrigins
            .Where(o => o.ProjectId == projectId)
            .Select(o => o.Origin.ToLower())
            .ToListAsync(ct);

        var set = new HashSet<string>(origins, StringComparer.OrdinalIgnoreCase);

        _cache.Set(key, set, Ttl);
        return set;
    }

    public void Invalidate(Guid projectId)
    {
        _cache.Remove($"origins:{projectId}");
    }
}
