namespace BugShot.Api.Security;

public static class PasswordHasher
{
    // bcrypt liczy tylko pierwsze 72 bajty wiec dluzsze haslo odrzuca walidacja kontraktu
    public const int MaxPasswordBytes = 72;

    public const int MinPasswordLength = 12;

    private const int WorkFactor = 12;

    // porownanie z ta wartoscia kosztuje tyle samo co z prawdziwym hashem
    // wiec czas odpowiedzi nie zdradza ktore konta istnieja
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("bugshot-timing-guard", WorkFactor);

    public static string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    public static bool Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);

    public static void BurnTiming(string password) => BCrypt.Net.BCrypt.Verify(password, DummyHash);
}
