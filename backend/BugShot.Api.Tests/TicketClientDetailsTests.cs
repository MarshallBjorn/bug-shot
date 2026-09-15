using BugShot.Api.Analytics;
using BugShot.Api.Contracts;
using BugShot.Api.Models;

namespace BugShot.Api.Tests;

public class TicketClientDetailsTests
{
    private const string IphoneAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

    private static CreateTicketRequest Request() => new()
    {
        ProjectKey = "demo",
        Description = "Koszyk gubi produkty",
        PageUrl = "https://acme.example/cart",
        UserAgent = IphoneAgent,
        Viewport = new TicketViewport { Width = 393, Height = 745, DevicePixelRatio = 3 },
        Language = "pl-PL",
        TimeZone = "Europe/Warsaw"
    };

    [Fact]
    public void PoprawneMetadaneTrafiajaDoZgloszenia()
    {
        var ticket = new Ticket();

        TicketClientDetails.Apply(ticket, Request());

        Assert.Equal("Safari", ticket.BrowserName);
        Assert.Equal("iOS", ticket.OsName);
        Assert.Equal("mobile", ticket.DeviceType);
        Assert.Equal(393, ticket.ViewportWidth);
        Assert.Equal(745, ticket.ViewportHeight);
        Assert.Equal(3, ticket.DevicePixelRatio);
        Assert.Equal("pl-PL", ticket.Language);
        Assert.Equal("Europe/Warsaw", ticket.TimeZone);
    }

    [Theory]
    [InlineData("C")]
    [InlineData("pl PL")]
    [InlineData("to-nie-jest-zaden-jezyk-bo-jest-o-wiele-za-dlugi")]
    public void ZlyJezykJestPomijanyZamiastOdrzucacZgloszenie(string language)
    {
        var request = Request();
        request.Language = language;
        var ticket = new Ticket();

        TicketClientDetails.Apply(ticket, request);

        Assert.Null(ticket.Language);
        Assert.Equal("Europe/Warsaw", ticket.TimeZone);
    }

    [Theory]
    [InlineData("Central European Standard Time")]
    [InlineData("../etc/passwd")]
    public void ZlaStrefaJestPomijana(string timeZone)
    {
        var request = Request();
        request.TimeZone = timeZone;
        var ticket = new Ticket();

        TicketClientDetails.Apply(ticket, request);

        Assert.Null(ticket.TimeZone);
    }

    [Fact]
    public void ZerowyViewportJestPomijanyAZlaGestoscPikseliTylkoOna()
    {
        var zero = Request();
        zero.Viewport = new TicketViewport { Width = 0, Height = 745, DevicePixelRatio = 3 };
        var zeroTicket = new Ticket();

        TicketClientDetails.Apply(zeroTicket, zero);

        Assert.Null(zeroTicket.ViewportWidth);
        Assert.Null(zeroTicket.ViewportHeight);
        Assert.Null(zeroTicket.DevicePixelRatio);

        var dense = Request();
        dense.Viewport = new TicketViewport { Width = 393, Height = 745, DevicePixelRatio = 50 };
        var denseTicket = new Ticket();

        TicketClientDetails.Apply(denseTicket, dense);

        Assert.Equal(393, denseTicket.ViewportWidth);
        Assert.Null(denseTicket.DevicePixelRatio);
    }

    [Fact]
    public void CzyszczenieZostawiaPustePolaJakWTombstone()
    {
        var ticket = new Ticket { Page = "acme.example/cart" };
        TicketClientDetails.Apply(ticket, Request());

        TicketClientDetails.Clear(ticket);

        Assert.Equal(string.Empty, ticket.Page);
        Assert.Equal(string.Empty, ticket.BrowserName);
        Assert.Equal(string.Empty, ticket.OsName);
        Assert.Equal(string.Empty, ticket.DeviceType);
        Assert.Null(ticket.ViewportWidth);
        Assert.Null(ticket.Language);
        Assert.Null(ticket.TimeZone);
    }
}
