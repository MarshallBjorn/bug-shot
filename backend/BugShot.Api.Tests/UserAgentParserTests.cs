using BugShot.Api.Analytics;

namespace BugShot.Api.Tests;

public class UserAgentParserTests
{
    [Theory]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Chrome", "Windows", "desktop")]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
        "Edge", "Windows", "desktop")]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 OPR/121.0.0.0",
        "Opera", "Windows", "desktop")]
    [InlineData(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
        "Safari", "macOS", "desktop")]
    [InlineData(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
        "Safari", "iOS", "mobile")]
    [InlineData(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.0.0 Mobile/15E148 Safari/604.1",
        "Chrome", "iOS", "mobile")]
    [InlineData(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Safari", "iOS", "tablet")]
    [InlineData(
        "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
        "Chrome", "Android", "mobile")]
    [InlineData(
        "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Chrome", "Android", "tablet")]
    [InlineData(
        "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
        "Samsung Internet", "Android", "mobile")]
    [InlineData(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
        "Firefox", "Windows", "desktop")]
    [InlineData(
        "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
        "Firefox", "Linux", "desktop")]
    [InlineData(
        "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Chrome", "ChromeOS", "desktop")]
    [InlineData("Mozilla/5.0 (demo)", "Other", "Other", "desktop")]
    public void RozpoznajePrzegladarkeSystemIUrzadzenie(string userAgent, string browser, string os, string device)
    {
        Assert.Equal(new UserAgentInfo(browser, os, device), UserAgentParser.Parse(userAgent));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void PustyUserAgentZostawiaPustePola(string? userAgent)
    {
        Assert.Equal(new UserAgentInfo(string.Empty, string.Empty, string.Empty), UserAgentParser.Parse(userAgent));
    }
}
