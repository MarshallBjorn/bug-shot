using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace BugShot.Api.Security;

public static class UploadToken
{
    // widget wysyla zalaczniki zaraz po utworzeniu zgloszenia wiec okno jest waskie
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);

    // wlasny naglowek zamiast pola formularza zeby dalo sie odrzucic zadanie przed odczytem ciala
    public const string HeaderName = "X-Upload-Token";

    private const int ByteLength = 32;

    public static string Create() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(ByteLength));

    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
