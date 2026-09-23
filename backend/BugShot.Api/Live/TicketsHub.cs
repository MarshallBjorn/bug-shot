using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BugShot.Api.Live;

// panel slucha zdarzen jednego projektu na raz wiec subskrypcja jest jawna
[Authorize]
public class TicketsHub(ProjectAccess access) : Hub<ITicketClient>
{
    // dostep sprawdzany tylko przy zapisie do grupy wiec odebrany w trakcie polaczenia dziala od nastepnego
    public async Task Subscribe(Guid projectId)
    {
        if (await access.RoleIn(Context.User!, projectId, Context.ConnectionAborted) is null)
        {
            throw new HubException("Project not found.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, ProjectGroup(projectId), Context.ConnectionAborted);
    }

    public Task Unsubscribe(Guid projectId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ProjectGroup(projectId), Context.ConnectionAborted);

    internal static string ProjectGroup(Guid projectId) => $"project:{projectId}";
}
