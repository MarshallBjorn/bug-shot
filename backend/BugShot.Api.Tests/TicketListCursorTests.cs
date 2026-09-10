using BugShot.Api.Tickets;

namespace BugShot.Api.Tests;

public class TicketListCursorTests
{
    [Theory]
    [InlineData("receivedAt:desc")]
    [InlineData("receivedAt:asc")]
    [InlineData("reportedAt:desc")]
    [InlineData("reportedAt:asc")]
    public void KursorWracaZTaSamaTrescia(string sort)
    {
        var order = TicketSort.Parse(sort);
        var key = new DateTimeOffset(2026, 9, 1, 8, 30, 15, 123, TimeSpan.Zero).AddTicks(4560);
        var id = Guid.NewGuid();

        var encoded = new TicketListCursor(order, key, id).Encode();

        Assert.True(TicketListCursor.TryDecode(encoded, out var decoded));
        Assert.Equal(order, decoded.Sort);
        Assert.Equal(key, decoded.Key);
        Assert.Equal(id, decoded.Id);
    }

    // przesuniecie klienta nie moze przesunac miejsca w liscie
    [Fact]
    public void KursorZapisujeChwileWUtc()
    {
        var order = TicketSort.Default;
        var key = new DateTimeOffset(2026, 9, 1, 10, 0, 0, TimeSpan.FromHours(2));

        Assert.True(TicketListCursor.TryDecode(new TicketListCursor(order, key, Guid.Empty).Encode(), out var decoded));
        Assert.Equal(key.UtcDateTime, decoded.Key.UtcDateTime);
        Assert.Equal(TimeSpan.Zero, decoded.Key.Offset);
    }

    [Theory]
    [InlineData("")]
    [InlineData("nie-kursor")]
    [InlineData("!!!")]
    public void ZepsutyKursorNieDekodujeSie(string value)
    {
        Assert.False(TicketListCursor.TryDecode(value, out _));
    }

    [Theory]
    // za malo czlonow
    [InlineData("receivedAt:desc|123")]
    // sortowanie spoza listy nie moze cicho zejsc na domyslne
    [InlineData("createdAt:desc|123|00000000000000000000000000000001")]
    // klucz nie jest liczba
    [InlineData("receivedAt:desc|wczoraj|00000000000000000000000000000001")]
    // identyfikator nie jest guidem
    [InlineData("receivedAt:desc|123|nie-guid")]
    // klucz poza zakresem daty
    [InlineData("receivedAt:desc|99999999999999999999|00000000000000000000000000000001")]
    public void NiepoprawnaTrescKursoraNieDekodujeSie(string payload)
    {
        var encoded = System.Buffers.Text.Base64Url.EncodeToString(System.Text.Encoding.UTF8.GetBytes(payload));

        Assert.False(TicketListCursor.TryDecode(encoded, out _));
    }

    [Fact]
    public void NiepoprawneBajtyNieDekodujaSie()
    {
        var encoded = System.Buffers.Text.Base64Url.EncodeToString([0xC3, 0x28]);

        Assert.False(TicketListCursor.TryDecode(encoded, out _));
    }
}
