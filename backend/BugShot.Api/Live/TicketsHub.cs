using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BugShot.Api.Live;

// panel slucha zdarzen jednego projektu na raz wiec subskrypcja jest jawna
[Authorize]
public class TicketsHub : Hub<ITicketClient>
{
    public Task Subscribe(Guid projectId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, ProjectGroup(projectId), Context.ConnectionAborted);

    public Task Unsubscribe(Guid projectId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ProjectGroup(projectId), Context.ConnectionAborted);

    // grupa odcina ruch a nie dostep bo kazde zalogowane konto widzi wszystkie projekty
    internal static string ProjectGroup(Guid projectId) => $"project:{projectId}";
}
