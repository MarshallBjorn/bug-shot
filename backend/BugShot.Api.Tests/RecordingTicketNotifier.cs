using BugShot.Api.Contracts;
using BugShot.Api.Live;

namespace BugShot.Api.Tests;

// zapamietuje zdarzenia kanalu live zamiast je wysylac
public class RecordingTicketNotifier : ITicketNotifier
{
    public record Sent(string Event, Guid ProjectId, Guid TicketId, TicketListItem? Ticket);

    public List<Sent> Events { get; } = [];

    public Task Created(Guid projectId, TicketListItem ticket)
    {
        Events.Add(new Sent("created", projectId, ticket.Id, ticket));
        return Task.CompletedTask;
    }

    public Task Changed(Guid projectId, TicketListItem ticket)
    {
        Events.Add(new Sent("changed", projectId, ticket.Id, ticket));
        return Task.CompletedTask;
    }

    public Task Deleted(Guid projectId, Guid ticketId)
    {
        Events.Add(new Sent("deleted", projectId, ticketId, null));
        return Task.CompletedTask;
    }
}
