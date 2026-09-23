using System.Security.Cryptography;
using System.Text;

namespace BugShot.Api.Security;

// bez ADMIN_EMAIL pierwsze konto zaklada w panelu ten kto zna token z logu API
// token zyje tylko w pamieci wiec restart wystawia nowy
public sealed class SetupToken
{
    private readonly Lock gate = new();

    private string? token;

    public bool IsOpen
    {
        get
        {
            lock (gate)
            {
                return token is not null;
            }
        }
    }

    public string Open()
    {
        lock (gate)
        {
            token = UserTokens.Create();
            return token;
        }
    }

    // token dziala raz wiec drugi rownolegly kreator dostaje odmowe
    // gdy zapis konta sie nie uda nowy token daje dopiero restart API
    public bool TryConsume(string provided)
    {
        lock (gate)
        {
            if (token is null
                || !CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(token),
                    Encoding.UTF8.GetBytes(provided)))
            {
                return false;
            }

            token = null;
            return true;
        }
    }
}
