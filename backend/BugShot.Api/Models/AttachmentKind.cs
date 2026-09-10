using System.Text.Json.Serialization;

namespace BugShot.Api.Models;

// konwerter z AddJsonOptions ustawia sama serializacje a schemat OpenAPI opisywal enum jako liczbe
// atrybut na typie trzyma jedno i drugie przy stringu
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum AttachmentKind
{
    Screenshot,
    UserUpload,
    ConsoleLog
}
