using System.Text;

namespace BugShot.Api.Attachments;

public record DetectedContent(string ContentType, string Extension);

public static class AttachmentContentInspector
{
    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] PngTrailer = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
    private static readonly byte[] JpegHeader = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] JpegTrailer = [0xFF, 0xD9];
    private static readonly byte[] Gif87aHeader = "GIF87a"u8.ToArray();
    private static readonly byte[] Gif89aHeader = "GIF89a"u8.ToArray();
    private static readonly byte[] GifTrailer = [0x3B];
    private static readonly byte[] WebpRiffHeader = "RIFF"u8.ToArray();
    private static readonly byte[] WebpMarker = "WEBP"u8.ToArray();
    private static readonly byte[] PdfHeader = "%PDF-"u8.ToArray();
    private static readonly byte[] PdfTrailer = "%%EOF"u8.ToArray();

    // naglowek klienta jest ignorowany bo latwo go podrobic i przemycic cos wykonywalnego
    public static DetectedContent? Detect(Stream file)
    {
        if (StartsWith(file, PngHeader) && EndsWith(file, PngTrailer))
        {
            return new DetectedContent("image/png", "png");
        }

        if (StartsWith(file, JpegHeader) && EndsWith(file, JpegTrailer))
        {
            return new DetectedContent("image/jpeg", "jpg");
        }

        if (
            (StartsWith(file, Gif87aHeader) || StartsWith(file, Gif89aHeader))
            && EndsWith(file, GifTrailer))
        {
            return new DetectedContent("image/gif", "gif");
        }

        if (IsWebp(file))
        {
            return new DetectedContent("image/webp", "webp");
        }

        if (StartsWith(file, PdfHeader) && EndsWith(file, PdfTrailer))
        {
            return new DetectedContent("application/pdf", "pdf");
        }

        return null;
    }

    public static bool IsUtf8Text(Stream file)
    {
        file.Position = 0;
        var decoder = new UTF8Encoding(false, true).GetDecoder();
        var bytes = new byte[8192];
        var chars = new char[8192];

        int read;
        while ((read = file.Read(bytes)) > 0)
        {
            try
            {
                decoder.Convert(bytes.AsSpan(0, read), chars, flush: false, out _, out _, out _);
            }
            catch (DecoderFallbackException)
            {
                return false;
            }
        }

        try
        {
            decoder.Convert([], chars, flush: true, out _, out _, out _);
        }
        catch (DecoderFallbackException)
        {
            // urwany znak wielobajtowy na koncu pliku
            return false;
        }

        return true;
    }

    private static bool IsWebp(Stream file)
    {
        if (file.Length < 12)
        {
            return false;
        }

        file.Position = 0;

        var header = new byte[12];
        file.ReadExactly(header);

        return header.AsSpan(0, 4).SequenceEqual(WebpRiffHeader)
            && header.AsSpan(8, 4).SequenceEqual(WebpMarker);
    }

    private static bool StartsWith(Stream file, byte[] signature)
    {
        if (file.Length < signature.Length)
        {
            return false;
        }

        file.Position = 0;
        return Matches(file, signature);
    }

    private static bool EndsWith(Stream file, byte[] signature)
    {
        if (file.Length < signature.Length)
        {
            return false;
        }

        // trailer PDF bywa domkniety bialymi znakami wiec szukamy go w ogonie pliku
        var tailLength = (int)Math.Min(file.Length, Math.Max(signature.Length, 64));
        file.Position = file.Length - tailLength;

        var tail = new byte[tailLength];
        file.ReadExactly(tail);

        return tail.AsSpan().LastIndexOf(signature) >= 0;
    }

    private static bool Matches(Stream file, byte[] signature)
    {
        var buffer = new byte[signature.Length];
        file.ReadExactly(buffer);
        return buffer.AsSpan().SequenceEqual(signature);
    }
}