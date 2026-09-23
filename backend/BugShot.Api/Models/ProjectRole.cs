using System.Text.Json.Serialization;

namespace BugShot.Api.Models;

// kolejnosc ma znaczenie bo wyzsza rola zawiera nizsza
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ProjectRole
{
    Viewer,
    Member,
    Maintainer
}
