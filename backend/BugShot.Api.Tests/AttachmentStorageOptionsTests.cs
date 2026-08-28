using BugShot.Api.Attachments;

namespace BugShot.Api.Tests;

public class AttachmentStorageOptionsTests
{
    [Fact]
    public void BrakujacyKatalogJestZakladany()
    {
        var root = Path.Combine(Path.GetTempPath(), $"bugshot-{Guid.NewGuid():N}", "media");

        try
        {
            new AttachmentStorageOptions(root).EnsureWritable();

            Assert.True(Directory.Exists(root));
            Assert.Empty(Directory.GetFileSystemEntries(root));
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(root)!, recursive: true);
        }
    }

    [Fact]
    public void SciezkaKtorejNieDaSieUtworzycZatrzymujeStart()
    {
        // istniejacy plik w miejscu katalogu zachowuje sie tak samo jak brak uprawnien
        var file = Path.Combine(Path.GetTempPath(), $"bugshot-{Guid.NewGuid():N}");
        File.WriteAllText(file, "zajete");

        try
        {
            var exception = Assert.Throws<InvalidOperationException>(
                () => new AttachmentStorageOptions(Path.Combine(file, "media")).EnsureWritable());

            Assert.Contains("not writable", exception.Message);
        }
        finally
        {
            File.Delete(file);
        }
    }
}
