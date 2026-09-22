using System.Text.Json.Serialization;

namespace BugShot.Api.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum NotificationEventType
{
    TicketCreated,
    CommentAdded,
    StatusChanged
}
