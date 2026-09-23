using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using BugShot.Api.Models;

namespace BugShot.Api.Security;

public static class UserTokens
{
    private const int ByteLength = 32;

    // zaproszenie czeka az odbiorca zajrzy do poczty a reset idzie od razu po prosbie
    public static TimeSpan Lifetime(UserTokenPurpose purpose) => purpose switch
    {
        UserTokenPurpose.Invitation => TimeSpan.FromHours(72),
        UserTokenPurpose.PasswordReset => TimeSpan.FromHours(1),
        _ => throw new ArgumentOutOfRangeException(nameof(purpose))
    };

    public static string Create() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(ByteLength));

    public static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
