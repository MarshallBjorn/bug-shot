using System.Net;
using BugShot.Api.Notifications.Webhooks;

namespace BugShot.Api.Tests.Notifications.Webhooks;

public sealed class SsrfProtectionTests
{
    [Theory]
    [InlineData("0.0.0.0")]
    [InlineData("10.0.0.1")]
    [InlineData("10.255.255.255")]
    [InlineData("100.64.0.1")]
    [InlineData("100.127.255.255")]
    [InlineData("127.0.0.1")]
    [InlineData("169.254.0.1")]
    [InlineData("169.254.169.254")]
    [InlineData("172.16.0.1")]
    [InlineData("172.16.1.1")]
    [InlineData("172.31.255.255")]
    [InlineData("192.0.0.1")]
    [InlineData("192.0.0.255")]
    [InlineData("192.0.2.1")]
    [InlineData("192.0.2.255")]
    [InlineData("192.168.1.1")]
    [InlineData("192.168.255.255")]
    [InlineData("198.18.0.1")]
    [InlineData("198.19.255.255")]
    [InlineData("198.51.100.1")]
    [InlineData("203.0.113.1")]
    [InlineData("224.0.0.1")]
    [InlineData("255.255.255.255")]
    public void IsSafeIp_RejectsBlockedIpv4(string value)
    {
        Assert.False(
            SsrfProtection.IsSafeIp(
                IPAddress.Parse(value)));
    }

    [Theory]
    [InlineData("::")]
    [InlineData("::1")]
    [InlineData("fc00::1")]
    [InlineData("fd12:3456:789a:1::1")]
    [InlineData("fe80::1")]
    [InlineData("ff02::1")]
    [InlineData("::ffff:127.0.0.1")]
    public void IsSafeIp_RejectsBlockedIpv6(string value)
    {
        Assert.False(
            SsrfProtection.IsSafeIp(
                IPAddress.Parse(value)));
    }

    [Theory]
    [InlineData("8.8.8.8")]
    [InlineData("1.1.1.1")]
    [InlineData("172.32.0.1")]
    [InlineData("192.0.3.1")]
    [InlineData("198.20.0.1")]
    [InlineData("104.244.42.1")]
    [InlineData("2606:4700:4700::1111")]
    [InlineData("2001:4860:4860::8888")]
    public void IsSafeIp_AllowsPublicAddresses(string value)
    {
        Assert.True(
            SsrfProtection.IsSafeIp(
                IPAddress.Parse(value)));
    }

    [Theory]
    [InlineData("http://example.com")]
    [InlineData("ftp://example.com")]
    [InlineData("example.com")]
    [InlineData("http://127.0.0.1")]
    [InlineData("https://127.0.0.1")]
    [InlineData("https://169.254.169.254")]
    [InlineData("https://user:password@example.com")]
    public void ValidateWebhookUri_RejectsUnsafeUris(string value)
    {
        Assert.Throws<ArgumentException>(
            () => SsrfProtection.ValidateWebhookUri(value));
    }

    [Theory]
    [InlineData("https://example.com")]
    [InlineData("https://example.com:443")]
    public void ValidateWebhookUri_AllowsHttps(string value)
    {
        var uri = SsrfProtection.ValidateWebhookUri(value);

        Assert.Equal(
            Uri.UriSchemeHttps,
            uri.Scheme);
    }

    [Fact]
    public void CreateSafeHandler_DisablesRedirects()
    {
        using var handler =
            SsrfProtection.CreateSafeHandler();

        Assert.False(handler.AllowAutoRedirect);
    }
}
