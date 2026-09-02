using System.Text;
using BugShot.Api.Attachments;

namespace BugShot.Api.Tests;

public class AttachmentContentInspectorTests
{
    private static MemoryStream Bytes(params byte[][] parts)
    {
        var stream = new MemoryStream();

        foreach (var part in parts)
        {
            stream.Write(part);
        }

        stream.Position = 0;
        return stream;
    }

    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] PngTrailer = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];

    [Fact]
    public void PngZNaglowkiemITrailerem()
    {
        using var file = Bytes(PngHeader, [0x01, 0x02, 0x03], PngTrailer);

        var detected = AttachmentContentInspector.Detect(file);

        Assert.NotNull(detected);
        Assert.Equal("image/png", detected.ContentType);
        Assert.Equal("png", detected.Extension);
    }

    [Fact]
    public void JpegZNaglowkiemITrailerem()
    {
        using var file = Bytes([0xFF, 0xD8, 0xFF], [0x11, 0x22], [0xFF, 0xD9]);

        var detected = AttachmentContentInspector.Detect(file);

        Assert.Equal("image/jpeg", detected?.ContentType);
        Assert.Equal("jpg", detected?.Extension);
    }

    [Fact]
    public void Gif87aZNaglowkiemITrailerem()
    {
        using var file = Bytes("GIF87a"u8.ToArray(), [0x01, 0x02, 0x03], [0x3B]);

        var detected = AttachmentContentInspector.Detect(file);

        Assert.NotNull(detected);
        Assert.Equal("image/gif", detected.ContentType);
        Assert.Equal("gif", detected.Extension);
    }

    [Fact]
    public void Gif89aZNaglowkiemITrailerem()
    {
        using var file = Bytes("GIF89a"u8.ToArray(), [0x01, 0x02, 0x03], [0x3B]);

        var detected = AttachmentContentInspector.Detect(file);

        Assert.NotNull(detected);
        Assert.Equal("image/gif", detected.ContentType);
        Assert.Equal("gif", detected.Extension);
    }

    [Fact]
    public void WebpZKonteneremRiffPrzechodzi()
    {
        using var file = Bytes(
            "RIFF"u8.ToArray(),
            [0x0C, 0x00, 0x00, 0x00],
            "WEBP"u8.ToArray(),
            [0x01, 0x02, 0x03, 0x04]
        );

        var detected = AttachmentContentInspector.Detect(file);

        Assert.NotNull(detected);
        Assert.Equal("image/webp", detected.ContentType);
        Assert.Equal("webp", detected.Extension);
    }

    [Fact]
    public void PdfZTrailerem()
    {
        using var file = Bytes(Encoding.ASCII.GetBytes("%PDF-1.7\nstuff\n%%EOF\n"));

        var detected = AttachmentContentInspector.Detect(file);

        Assert.Equal("application/pdf", detected?.ContentType);
        Assert.Equal("pdf", detected?.Extension);
    }

    [Fact]
    public void PlikPodszywajacySieNaglowkiemJestOdrzucany()
    {
        // rozszerzenie i naglowek klienta moga mowic png a w srodku siedzi cos innego
        using var file = Bytes(Encoding.ASCII.GetBytes("MZ\x90\x00 executable"));

        Assert.Null(AttachmentContentInspector.Detect(file));
    }

    [Fact]
    public void ObrazBezTraileraJestOdrzucany()
    {
        using var file = Bytes(PngHeader, [0x01, 0x02, 0x03]);

        Assert.Null(AttachmentContentInspector.Detect(file));
    }

    [Fact]
    public void GifBezTraileraJestOdrzucany()
    {
        using var file = Bytes("GIF89a"u8.ToArray(), [0x01, 0x02, 0x03]);

        Assert.Null(AttachmentContentInspector.Detect(file));
    }

    [Fact]
    public void WebpBezRIFFJestOdrzucany()
    {
        using var file = Bytes(
            [0x00, 0x00, 0x00, 0x00],
            [0x0C, 0x00, 0x00, 0x00],
            "WEBP"u8.ToArray()
        );

        Assert.Null(AttachmentContentInspector.Detect(file));
    }

    [Fact]
    public void WebpBezMarkeraWEBPJestOdrzucany()
    {
        using var file = Bytes(
            "RIFF"u8.ToArray(),
            [0x0C, 0x00, 0x00, 0x00],
            "XXXX"u8.ToArray(),
            [0x01, 0x02, 0x03, 0x04]
        );

        Assert.Null(AttachmentContentInspector.Detect(file));
    }

    [Fact]
    public void PustyPlikJestOdrzucany()
    {
        using var file = Bytes();

        Assert.Null(AttachmentContentInspector.Detect(file));
    }

    [Fact]
    public void LogWUtf8Przechodzi()
    {
        using var file = Bytes(Encoding.UTF8.GetBytes("[error] koszyk gubi produkty, zażółć gęślą jaźń"));

        Assert.True(AttachmentContentInspector.IsUtf8Text(file));
    }

    [Fact]
    public void LogZeSmieciamiBinarnymiJestOdrzucany()
    {
        using var file = Bytes([0xC3, 0x28, 0xA0, 0xA1]);

        Assert.False(AttachmentContentInspector.IsUtf8Text(file));
    }

    [Fact]
    public void LogUrwanyWSrodkuZnakuJestOdrzucany()
    {
        var text = Encoding.UTF8.GetBytes("zażółć");
        using var file = Bytes(text[..^1]);

        Assert.False(AttachmentContentInspector.IsUtf8Text(file));
    }
}
