using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Notifications.Email;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Security;

// zaproszenie i reset hasla to ten sam jednorazowy link rozniacy sie trescia maila i waznoscia
public sealed class AccountLinks(
    BugShotDbContext db,
    IEmailSender email,
    DashboardOrigins dashboards,
    ILogger<AccountLinks> logger)
{
    // token siedzi we fragmencie adresu bo ten nie trafia do serwera ani do logow proxy
    public const string SetPasswordPath = "/set-password";

    public async Task<AccountLinkResponse> Issue(
        HttpRequest request,
        User user,
        UserTokenPurpose purpose,
        CancellationToken cancellationToken)
    {
        // nowy link uniewaznia poprzedni tego samego rodzaju
        await db.UserTokens
            .Where(t => t.UserId == user.Id && t.Purpose == purpose && t.UsedAt == null)
            .ExecuteDeleteAsync(cancellationToken);

        var token = UserTokens.Create();

        db.UserTokens.Add(new UserToken
        {
            UserId = user.Id,
            Purpose = purpose,
            TokenHash = UserTokens.Hash(token),
            ExpiresAt = DateTimeOffset.UtcNow.Add(UserTokens.Lifetime(purpose))
        });

        await db.SaveChangesAsync(cancellationToken);

        var link = $"{dashboards.For(request)}{SetPasswordPath}#{token}";

        try
        {
            var (subject, body) = Message(purpose, user.Email, link);

            await email.SendEmailAsync(user.Email, subject, body, cancellationToken);

            return new AccountLinkResponse(EmailSent: true, Link: null);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // konto i token juz sa wiec admin dostaje link do przekazania innym kanalem
            logger.LogWarning(
                exception,
                "Nie udalo sie wyslac maila {Purpose} do uzytkownika {UserId}, link wraca do panelu",
                purpose,
                user.Id);

            return new AccountLinkResponse(EmailSent: false, Link: link);
        }
    }

    private static (string Subject, string Body) Message(UserTokenPurpose purpose, string address, string link) =>
        purpose switch
        {
            UserTokenPurpose.Invitation => (
                "Zaproszenie do Bug-Shot",
                $"""
                Założono dla Ciebie konto w panelu Bug-Shot na adres {address}.

                Ustaw hasło i zaloguj się przez ten link:
                {link}

                Link działa jeden raz przez 72 godziny. Jeśli nie spodziewasz się tej wiadomości, zignoruj ją.
                """),
            UserTokenPurpose.PasswordReset => (
                "Zmiana hasła w Bug-Shot",
                $"""
                Administrator panelu Bug-Shot poprosił o ustawienie nowego hasła dla konta {address}.

                Nowe hasło ustawisz przez ten link:
                {link}

                Link działa jeden raz przez godzinę. Dotychczasowe hasło działa do czasu ustawienia nowego.
                """),
            _ => throw new ArgumentOutOfRangeException(nameof(purpose))
        };
}
