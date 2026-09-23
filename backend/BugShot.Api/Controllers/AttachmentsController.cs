using System.Net.Mime;
using BugShot.Api.Attachments;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

// wydawanie plikow siedzi osobno od ich przyjmowania bo to inna trasa i inna autoryzacja
[ApiController]
[Route("api/v1/attachments")]
[EnableCors(CorsPolicies.Dashboard)]
public class AttachmentsController(BugShotDbContext db, AttachmentStorageOptions storage) : ControllerBase
{
    /// <summary>Pobiera zalacznik zgloszenia.</summary>
    /// <remarks>
    /// Jedyna droga do plikow. nginx ich nie serwuje wiec bez tokena nie ma jak ich odczytac.
    /// Odpowiedz nie trafia do cache wspoldzielonego.
    /// </remarks>
    [HttpGet("{id:guid}/download")]
    [ProjectAccess(ProjectRole.Viewer, ProjectAccessScope.Attachment, "id")]
    // typ konkretnego pliku znany jest dopiero przy odpowiedzi wiec dokument opisuje same bajty
    [Produces(MediaTypeNames.Application.Octet)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(Guid id, CancellationToken cancellationToken)
    {
        var attachment = await db.TicketAttachments
            .AsNoTracking()
            .Where(a => a.Id == id)
            .Select(a => new { a.Uri, a.FileName, a.ContentType })
            .SingleOrDefaultAsync(cancellationToken);

        if (attachment is null)
        {
            return NotFound();
        }

        // uri opisuje polozenie pod prefiksem a nie sciezke na dysku wiec bierzemy z niego sama nazwe
        var name = Path.GetFileName(attachment.Uri);
        var path = Path.GetFullPath(Path.Combine(storage.RootPath, name));

        // plik moze zniknac z wolumenu niezaleznie od wiersza w bazie
        if (!System.IO.File.Exists(path))
        {
            return NotFound();
        }

        // typ pliku jest sprawdzany przy wysylce ale przegladarka nie ma go zgadywac ponownie
        Response.Headers["X-Content-Type-Options"] = "nosniff";

        // bez tego kopia zostaje w cache i wychodzi z niego przy zadaniu bez tokena
        Response.Headers.CacheControl = "private, no-store";

        return PhysicalFile(path, attachment.ContentType, attachment.FileName);
    }
}
