using BugShot.Api.Contracts;
using Microsoft.AspNetCore.SignalR;

namespace BugShot.Api.Live;

public class SignalRTicketNotifier(
    IHubContext<TicketsHub, ITicketClient> hub,
    ILogger<SignalRTicketNotifier> logger) : ITicketNotifier
{
    public Task Created(Guid projectId, TicketListItem ticket) =>
        Send(projectId, client => client.TicketCreated(ticket), nameof(ITicketClient.TicketCreated));

    public Task Changed(Guid projectId, TicketListItem ticket) =>
        Send(projectId, client => client.TicketChanged(ticket), nameof(ITicketClient.TicketChanged));

    public Task Deleted(Guid projectId, Guid ticketId) =>
        Send(projectId, client => client.TicketDeleted(ticketId), nameof(ITicketClient.TicketDeleted));

    private async Task Send(Guid projectId, Func<ITicketClient, Task> send, string eventName)
    {
        try
        {
            await send(hub.Clients.Group(TicketsHub.ProjectGroup(projectId)));
        }
        // zapis jest juz zatwierdzony wiec zerwany kanal nie moze wywrocic zadania
        catch (Exception exception)
        {
            logger.LogWarning(
                exception,
                "Nie udalo sie wyslac {Event} dla projektu {ProjectId}",
                eventName,
                projectId);
        }
    }
}
