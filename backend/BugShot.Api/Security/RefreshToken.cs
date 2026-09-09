using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace BugShot.Api.Security;

public static class RefreshToken
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    // cookie zamiast naglowka bo tokena odswiezajacego nie ma widziec javascript panelu
    public const string CookieName = "bugshot_refresh";

    // cookie wedruje tylko do endpointow ktore go czytaja
    public const string CookiePath = "/api/v1/auth";

    private const int ByteLength = 32;

    public static string Create() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(ByteLength));

    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
