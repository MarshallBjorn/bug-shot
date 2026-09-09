using System.Security.Cryptography;
using System.Text;

namespace BugShot.Api.OpenApi;

// dokument opisuje cale API razem z ksztaltami cial i naglowkow tras za tokenem
// wiec poza deweloperka nie moze stac otworem
public sealed class OpenApiAccess
{
    public const string EnabledVariable = "SWAGGER_ENABLED";
    public const string UserVariable = "SWAGGER_USER";
    public const string PasswordVariable = "SWAGGER_PASSWORD";

    private readonly byte[]? user;
    private readonly byte[]? password;

    private OpenApiAccess(string? user, string? password)
    {
        this.user = user is null ? null : Digest(user);
        this.password = password is null ? null : Digest(password);
    }

    public bool RequiresPassword => user is not null;

    // null oznacza ze dokumentu nie wystawiamy w ogole i obie trasy koncza sie na 404
    public static OpenApiAccess? Read(IConfiguration configuration, IHostEnvironment environment)
    {
        var enabled = configuration.GetValue<bool?>(EnabledVariable);

        // lokalnie caly stack stoi na petli zwrotnej wiec haslo tylko przeszkadza
        if (environment.IsDevelopment())
        {
            return enabled == false ? null : new OpenApiAccess(null, null);
        }

        if (enabled != true)
        {
            return null;
        }

        var user = configuration[UserVariable];
        var password = configuration[PasswordVariable];

        // brak hasla ma zatrzymac start a nie po cichu wystawic dokument kazdemu
        if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                $"{EnabledVariable} outside Development requires {UserVariable} and {PasswordVariable}.");
        }

        return new OpenApiAccess(user, password);
    }

    // porownanie na skrotach bo rowna dlugosc wejsc jest tu jedynym sposobem
    // zeby czas odpowiedzi nie zdradzal ile pierwszych znakow sie zgadza
    public bool Matches(string providedUser, string providedPassword) =>
        user is not null
        && password is not null
        && CryptographicOperations.FixedTimeEquals(Digest(providedUser), user)
        && CryptographicOperations.FixedTimeEquals(Digest(providedPassword), password);

    private static byte[] Digest(string value) => SHA256.HashData(Encoding.UTF8.GetBytes(value));
}
