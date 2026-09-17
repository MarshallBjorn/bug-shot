using BugShot.Api.Contracts;

namespace BugShot.Api.Live;

public interface ITicketNotifier
{
    Task Created(Guid projectId, TicketListItem ticket);

    Task Changed(Guid projectId, TicketListItem ticket);

    Task Deleted(Guid projectId, Guid ticketId);
}
