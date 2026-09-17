using BugShot.Api.Models;

namespace BugShot.Api.Tickets;

// przejscia sa jawna mapa a nie regula wyliczana bo kolejnosc statusow nie wynika z ich wartosci
public static class TicketStatusTransitions
{
    private static readonly Dictionary<TicketStatus, TicketStatus[]> Allowed = new()
    {
        [TicketStatus.New] = [TicketStatus.InProgress, TicketStatus.Rejected],
        [TicketStatus.InProgress] = [TicketStatus.Resolved, TicketStatus.Rejected],
        [TicketStatus.Resolved] = [TicketStatus.InProgress],
        [TicketStatus.Rejected] = [TicketStatus.InProgress]
    };

    // tombstone nie ma wyjscia bo opis i zalaczniki sa juz skasowane
    // kasowanie wchodzi wylacznie przez DELETE wiec Deleted nie jest celem zadnego przejscia
    public static IReadOnlyList<TicketStatus> From(TicketStatus status) =>
        Allowed.TryGetValue(status, out var targets) ? targets : [];

    public static bool IsAllowed(TicketStatus from, TicketStatus to) =>
        Array.IndexOf(Allowed.GetValueOrDefault(from, []), to) >= 0;
}
