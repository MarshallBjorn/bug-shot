using System.Net;
using System.Net.Sockets;

namespace BugShot.Api.Notifications.Webhooks;

public static class SsrfProtection
{
    public static Uri ValidateWebhookUri(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException(
                "Webhook URL must be an absolute URI.",
                nameof(value));
        }

        if (!string.Equals(
                uri.Scheme,
                Uri.UriSchemeHttps,
                StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                "Webhook URL must use HTTPS.",
                nameof(value));
        }

        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            throw new ArgumentException(
                "Webhook URL must not contain user information.",
                nameof(value));
        }

        if (string.IsNullOrWhiteSpace(uri.Host))
        {
            throw new ArgumentException(
                "Webhook URL must contain a host.",
                nameof(value));
        }

        if (IPAddress.TryParse(uri.Host, out var address) &&
            !IsSafeIp(address))
        {
            throw new ArgumentException(
                "Webhook URL resolves to a blocked IP address.",
                nameof(value));
        }

        return uri;
    }

    public static bool IsSafeIp(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (IPAddress.IsLoopback(ip) ||
            IPAddress.Any.Equals(ip) ||
            IPAddress.IPv6Any.Equals(ip))
        {
            return false;
        }

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var bytes = ip.GetAddressBytes();

            if (IsIpv4InRange(bytes, 0, 0, 0, 8) ||
                IsIpv4InRange(bytes, 10, 0, 0, 8) ||
                IsIpv4InRange(bytes, 100, 64, 0, 10) ||
                IsIpv4InRange(bytes, 169, 254, 0, 16) ||
                IsIpv4InRange(bytes, 172, 16, 0, 12) ||
                IsIpv4InRange(bytes, 192, 0, 0, 24) ||
                IsIpv4InRange(bytes, 192, 0, 2, 24) ||
                IsIpv4InRange(bytes, 192, 168, 0, 16) ||
                IsIpv4InRange(bytes, 198, 18, 0, 15) ||
                IsIpv4InRange(bytes, 198, 51, 100, 24) ||
                IsIpv4InRange(bytes, 203, 0, 113, 24) ||
                IsIpv4InRange(bytes, 224, 0, 0, 4) ||
                IsIpv4InRange(bytes, 240, 0, 0, 4))
            {
                return false;
            }

            return true;
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var bytes = ip.GetAddressBytes();

            if (bytes.All(value => value == 0))
            {
                return false;
            }

            if ((bytes[0] & 0xfe) == 0xfc)
            {
                return false;
            }

            if (bytes[0] == 0xfe &&
                (bytes[1] & 0xc0) == 0x80)
            {
                return false;
            }

            if (bytes[0] == 0xff)
            {
                return false;
            }

            return true;
        }

        return false;
    }

    public static SocketsHttpHandler CreateSafeHandler()
    {
        return new SocketsHttpHandler
        {
            AllowAutoRedirect = false,

            ConnectCallback = static async (
                context,
                cancellationToken) =>
            {
                var addresses = await Dns.GetHostAddressesAsync(
                    context.DnsEndPoint.Host,
                    cancellationToken);

                var safeIp = addresses.FirstOrDefault(IsSafeIp);

                if (safeIp is null)
                {
                    throw new HttpRequestException(
                        $"All resolved addresses for '{context.DnsEndPoint.Host}' are blocked by SSRF protection.");
                }

                var socket = new Socket(
                    safeIp.AddressFamily,
                    SocketType.Stream,
                    ProtocolType.Tcp);

                try
                {
                    await socket.ConnectAsync(
                        new IPEndPoint(
                            safeIp,
                            context.DnsEndPoint.Port),
                        cancellationToken);

                    return new NetworkStream(
                        socket,
                        ownsSocket: true);
                }
                catch
                {
                    socket.Dispose();
                    throw;
                }
            }
        };
    }

    private static bool IsIpv4InRange(
        byte[] bytes,
        byte first,
        byte second,
        byte third,
        int prefixLength)
    {
        if (bytes.Length != 4)
        {
            return false;
        }

        var value =
            ((uint)bytes[0] << 24) |
            ((uint)bytes[1] << 16) |
            ((uint)bytes[2] << 8) |
            bytes[3];

        var network =
            ((uint)first << 24) |
            ((uint)second << 16) |
            ((uint)third << 8);

        var mask = prefixLength == 0
            ? 0u
            : uint.MaxValue << (32 - prefixLength);

        return (value & mask) == (network & mask);
    }
}

