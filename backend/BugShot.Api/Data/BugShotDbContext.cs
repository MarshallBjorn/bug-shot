using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Data;

public class BugShotDbContext(DbContextOptions<BugShotDbContext> options) : DbContext(options)
{
}
