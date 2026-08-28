namespace BugShot.Api.Attachments;

public record AttachmentStorageOptions(string RootPath)
{
    // nginx wystawia ten sam wolumen pod tym prefiksem
    public const string UriPrefix = "/media";

    // katalog sprawdzamy na starcie bo inaczej zla konfiguracja wychodzi dopiero przy pierwszej wysylce
    public void EnsureWritable()
    {
        var probe = Path.Combine(RootPath, $".write-check-{Guid.NewGuid():N}");

        try
        {
            Directory.CreateDirectory(RootPath);
            File.WriteAllBytes(probe, []);
            File.Delete(probe);
        }
        catch (Exception exception)
        {
            throw new InvalidOperationException(
                $"Attachments directory '{RootPath}' is not writable by the application user.", exception);
        }
    }
}
