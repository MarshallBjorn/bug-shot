using BugShot.Api.Analytics;

namespace BugShot.Api.Tests;

public class PageAddressTests
{
    [Theory]
    [InlineData("https://Sklep.example/Koszyk?utm_source=newsletter#opinie", "sklep.example/koszyk")]
    [InlineData("https://sklep.example/szukaj?q=buty", "sklep.example/szukaj")]
    [InlineData("https://sklep.example/", "sklep.example")]
    [InlineData("http://127.0.0.1:5500/cart/", "127.0.0.1:5500/cart")]
    [InlineData("https://sklep.example/produkt#opinie?x=1", "sklep.example/produkt")]
    [InlineData(" https://sklep.example/kontakt ", "sklep.example/kontakt")]
    [InlineData("", "")]
    [InlineData(null, "")]
    public void AdresTraciZapytanieFragmentISchemat(string? url, string expected)
    {
        Assert.Equal(expected, PageAddress.Normalize(url));
    }
}
