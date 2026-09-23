using System.Text.Json.Serialization;

namespace BugShot.Api.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum NotificationDeliveryStatus
{
    Pending,
    Sending,
    Sent,
    Failed,
    Throttled
}
