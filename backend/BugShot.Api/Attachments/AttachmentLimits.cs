namespace BugShot.Api.Attachments;

public static class AttachmentLimits
{
    public const int MaxFiles = 5;

    // tyle miesci kolumna ticket_attachments.file_name
    public const int MaxFileNameLength = 260;

    public const long MaxFileBytes = 10 * 1024 * 1024;

    public const long MaxConsoleLogBytes = 256 * 1024;

    // piec plikow plus log plus zapas na naglowki sekcji multipart
    public const long MaxRequestBytes = (MaxFiles * MaxFileBytes) + MaxConsoleLogBytes + (1024 * 1024);

    public const string ScreenshotField = "screenshot";

    public const string FilesField = "files";

    public const string ConsoleLogField = "consoleLog";
}
