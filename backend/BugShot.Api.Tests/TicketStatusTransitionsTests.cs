using BugShot.Api.Models;
using BugShot.Api.Tickets;

namespace BugShot.Api.Tests;

public class TicketStatusTransitionsTests
{
    [Theory]
    [InlineData(TicketStatus.New, TicketStatus.InProgress)]
    [InlineData(TicketStatus.New, TicketStatus.Rejected)]
    [InlineData(TicketStatus.InProgress, TicketStatus.Resolved)]
    [InlineData(TicketStatus.InProgress, TicketStatus.Rejected)]
    [InlineData(TicketStatus.Resolved, TicketStatus.InProgress)]
    [InlineData(TicketStatus.Rejected, TicketStatus.InProgress)]
    public void PrzejsciaZMapyPrzechodza(TicketStatus from, TicketStatus to)
    {
        Assert.True(TicketStatusTransitions.IsAllowed(from, to));
    }

    [Theory]
    [InlineData(TicketStatus.New, TicketStatus.Resolved)]
    [InlineData(TicketStatus.Resolved, TicketStatus.Rejected)]
    [InlineData(TicketStatus.Rejected, TicketStatus.Resolved)]
    [InlineData(TicketStatus.Resolved, TicketStatus.New)]
    [InlineData(TicketStatus.InProgress, TicketStatus.New)]
    public void SkokiPozaMapaNiePrzechodza(TicketStatus from, TicketStatus to)
    {
        Assert.False(TicketStatusTransitions.IsAllowed(from, to));
    }

    [Fact]
    public void ZadenStanNieWchodziWDeleted()
    {
        foreach (var status in Enum.GetValues<TicketStatus>())
        {
            Assert.DoesNotContain(TicketStatus.Deleted, TicketStatusTransitions.From(status));
        }
    }

    [Fact]
    public void TombstoneNieMaWyjscia()
    {
        Assert.Empty(TicketStatusTransitions.From(TicketStatus.Deleted));
    }

    [Fact]
    public void ZadenStanNieWchodziWSiebie()
    {
        foreach (var status in Enum.GetValues<TicketStatus>())
        {
            Assert.DoesNotContain(status, TicketStatusTransitions.From(status));
        }
    }
}
