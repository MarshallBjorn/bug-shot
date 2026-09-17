using System.Buffers.Text;
using System.Globalization;
using System.Text;

namespace BugShot.Api.Tickets;

// miejsce w liscie zgloszen czyli klucz sortowania ostatniego wiersza i jego identyfikator
public sealed record TicketListCursor(TicketSort Sort, DateTimeOffset Key, Guid Id)
{
    private const char Separator = '|';

    // kursor niesie sortowanie bo od niego zalezy warunek keysetu
    // filtry go nie zmieniaja wiec zostaja poza kursorem
    public string Encode()
    {
        var payload = string.Create(
            CultureInfo.InvariantCulture,
            $"{Sort.Name}{Separator}{Key.UtcTicks}{Separator}{Id:N}");

        return Base64Url.EncodeToString(Encoding.UTF8.GetBytes(payload));
    }

    public static bool TryDecode(string value, out TicketListCursor cursor)
    {
        cursor = null!;

        byte[] payload;

        try
        {
            payload = Base64Url.DecodeFromChars(value);
        }
        catch (FormatException)
        {
            return false;
        }

        string decoded;

        try
        {
            decoded = new UTF8Encoding(false, true).GetString(payload);
        }
        catch (DecoderFallbackException)
        {
            return false;
        }

        var parts = decoded.Split(Separator);

        if (parts.Length != 3)
        {
            return false;
        }

        // sortowanie porownujemy po nazwie bo Parse cofa nieznane do domyslnego
        // i zepsuty kursor przeszedlby jako kursor listy domyslnej
        var sort = TicketSort.Parse(parts[0]);

        if (sort.Name != parts[0])
        {
            return false;
        }

        if (!long.TryParse(parts[1], CultureInfo.InvariantCulture, out var ticks)
            || ticks < DateTimeOffset.MinValue.UtcTicks
            || ticks > DateTimeOffset.MaxValue.UtcTicks)
        {
            return false;
        }

        if (!Guid.TryParseExact(parts[2], "N", out var id))
        {
            return false;
        }

        cursor = new TicketListCursor(sort, new DateTimeOffset(ticks, TimeSpan.Zero), id);

        return true;
    }
}
