using System.Security.Cryptography;

namespace BugShot.Api.Tests;

internal static class TestKeys
{
    // klucz losowany na uruchomienie zeby w repo nie lezal napis wygladajacy jak sekret
    public static string Signing() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
}
