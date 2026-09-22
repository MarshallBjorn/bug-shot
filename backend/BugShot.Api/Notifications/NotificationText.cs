using Microsoft.EntityFrameworkCore.Metadata;

namespace BugShot.Api.Notifications;

public static class NotificationText
{
    private const string Ellipsis = "\u2026";

    public static string? Truncate(
        string? value,
        int maxLength)
    {
        if (value is null)
        {
            return null;
        }

        if (maxLength <= 0)
        {
            return string.Empty;
        }

        if (value.Length <= maxLength)
        {
            return value;
        }

        if (maxLength == 1)
        {
            return value[..1];
        }

        var contentLength = maxLength - 1;

        if (contentLength > 0 &&
            contentLength < value.Length &&
            char.IsHighSurrogate(value[contentLength - 1]) &&
            char.IsLowSurrogate(value[contentLength]))
        {
            contentLength--;
        }

        return value[..contentLength] + Ellipsis;
    }

    public static string? FitToColumn<T>(
        IModel model,
        string propertyName,
        string? value)
    {
        if (value is null)
        {
            return null;
        }

        var maxLength = model
            .FindEntityType(typeof(T))
            ?.FindProperty(propertyName)
            ?.GetMaxLength();

        if (maxLength is null)
        {
            return value;
        }

        return Truncate(value, maxLength.Value);
    }
}