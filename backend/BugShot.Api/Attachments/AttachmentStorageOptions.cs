namespace BugShot.Api.Attachments;

public record AttachmentStorageOptions(string RootPath)
{
    // nginx wystawia ten sam wolumen pod tym prefiksem
    public const string UriPrefix = "/media";
}
