using BugShot.Api.Contracts;

namespace BugShot.Api.Live;

// metody wolane po stronie panelu przez kanal live
public interface ITicketClient
{
    Task TicketCreated(TicketListItem ticket);

    Task TicketChanged(TicketListItem ticket);

    Task TicketDeleted(Guid ticketId);
}
