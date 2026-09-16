using System.Security.Cryptography;
using System.Text;
using BugShot.Api.Models;
using BugShot.Api.Notifications;

namespace BugShot.Api.Notifications.Webhooks;

public interface IWebhookSender
{
    Task SendWebhookAsync(
        string url,
        string? secret,
        Guid deliveryId,
        NotificationEventType eventType,
        string payloadBody,
        CancellationToken cancellationToken);
}

public sealed class WebhookSender(IHttpClientFactory httpClientFactory) : IWebhookSender
{
    public async Task SendWebhookAsync(
        string url,
        string? secret,
        Guid deliveryId,
        NotificationEventType eventType,
        string payloadBody,
        CancellationToken cancellationToken)
    {
        var validatedUri = SsrfProtection.ValidateWebhookUri(url);

        using var client = httpClientFactory.CreateClient("NotificationWebhook");
        client.Timeout = TimeSpan.FromSeconds(10);

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            validatedUri)
        {
            Content = new StringContent(
                payloadBody,
                Encoding.UTF8,
                "application/json")
        };

        request.Headers.Add(
            "X-Bugshot-Delivery-Id",
            deliveryId.ToString());

        request.Headers.Add(
            "X-Bugshot-Event",
            eventType.ToString());

        if (!string.IsNullOrEmpty(secret))
        {
            var rawBytes = Encoding.UTF8.GetBytes(payloadBody);
            var secretBytes = Encoding.UTF8.GetBytes(secret);

            using var hmac = new HMACSHA256(secretBytes);

            var hashBytes = hmac.ComputeHash(rawBytes);
            var signature = Convert.ToHexString(hashBytes)
                .ToLowerInvariant();

            request.Headers.Add(
                "X-Bugshot-Signature",
                $"sha256={signature}");
        }

        using var response = await client.SendAsync(
            request,
            cancellationToken);

        response.EnsureSuccessStatusCode();
    }
}