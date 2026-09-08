using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Security;

// pierwszy uzytkownik musi wziac sie skads zanim istnieje ekran do zakladania kont
public static class AdminSeeder
{
    public const string EmailVariable = "ADMIN_EMAIL";

    public const string PasswordVariable = "ADMIN_PASSWORD";

    public static async Task EnsureAdmin(
        BugShotDbContext db,
        IConfiguration configuration,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        // seed tylko na pustej tabeli bo skasowany admin ma nie wracac przy kazdym restarcie
        if (await db.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        var email = configuration[EmailVariable];
        var password = configuration[PasswordVariable];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning(
                "Brak {EmailVariable} albo {PasswordVariable} wiec konto administratora nie powstalo i nie da sie zalogowac do panelu",
                EmailVariable,
                PasswordVariable);

            return;
        }

        db.Users.Add(new User
        {
            Email = email.Trim().ToLowerInvariant(),
            PasswordHash = PasswordHasher.Hash(password),
            IsAdmin = true
        });

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Zaseedowano konto administratora z {EmailVariable}", EmailVariable);
    }
}
