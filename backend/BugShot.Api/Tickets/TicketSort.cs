namespace BugShot.Api.Tickets;

public enum TicketSortKey
{
    ReceivedAt,
    ReportedAt
}

// kolejnosc listy zgloszen rozlozona na kolumne i kierunek
public sealed record TicketSort(TicketSortKey Key, bool Descending)
{
    public const string DefaultName = "receivedAt:desc";

    public static readonly TicketSort Default = new(TicketSortKey.ReceivedAt, true);

    // nierozpoznana wartosc wpada w domyslna kolejnosc zamiast konczyc sie bledem
    public static TicketSort Parse(string? value) => value switch
    {
        "receivedAt:asc" => new TicketSort(TicketSortKey.ReceivedAt, false),
        "reportedAt:desc" => new TicketSort(TicketSortKey.ReportedAt, true),
        "reportedAt:asc" => new TicketSort(TicketSortKey.ReportedAt, false),
        _ => Default
    };

    public string Name =>
        $"{(Key == TicketSortKey.ReportedAt ? "reportedAt" : "receivedAt")}:{(Descending ? "desc" : "asc")}";
}
