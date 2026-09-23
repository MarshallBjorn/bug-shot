using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Security;

// pierwsze konto bierze sie z env a bez env z kreatora w panelu
public static class AdminSeeder
{
    public const string EmailVariable = "ADMIN_EMAIL";

    public const string PasswordVariable = "ADMIN_PASSWORD";

    public static async Task EnsureAdmin(
        BugShotDbContext db,
        IConfiguration configuration,
        SetupToken setup,
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
            // log to jedyne miejsce ktore widzi tylko ten kto stawia instancje
            logger.LogWarning(
                "Brak {EmailVariable} albo {PasswordVariable} wiec pierwsze konto administratora zaklada sie w panelu pod /setup tokenem {SetupToken}",
                EmailVariable,
                PasswordVariable,
                setup.Open());

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
