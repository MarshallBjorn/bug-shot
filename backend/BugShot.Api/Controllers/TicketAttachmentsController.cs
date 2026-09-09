using BugShot.Api.Attachments;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/tickets/{ticketId:guid}/attachments")]
public class TicketAttachmentsController(BugShotDbContext db, AttachmentStorageOptions storage) : ControllerBase
{
    [HttpPost]
    // wysylka z widgetu autoryzuje sie jednorazowym uploadToken a nie tokenem sesji
    [AllowAnonymous]
    [EnableCors(CorsPolicies.WidgetUpload)]
    [RequestSizeLimit(AttachmentLimits.MaxRequestBytes)]
    [DisableFormValueModelBinding]
    [ProducesResponseType<IReadOnlyList<TicketAttachmentResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> Upload(Guid ticketId, CancellationToken cancellationToken)
    {
        if (!Request.Headers.TryGetValue(UploadToken.HeaderName, out var provided)
            || string.IsNullOrWhiteSpace(provided))
        {
            return Unauthorized();
        }

        if (!MediaTypeHeaderValue.TryParse(Request.ContentType, out var contentType)
            || !contentType.MediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase)
            || !contentType.Boundary.HasValue)
        {
            ModelState.AddModelError("request", "Expected a multipart/form-data body.");
            return ValidationProblem(ModelState);
        }

        // naglowek moze klamac wiec liczymy tez sami ale odrzucenie tutaj oszczedza caly transfer
        if (Request.ContentLength > AttachmentLimits.MaxRequestBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        if (!await ConsumeToken(ticketId, provided!, cancellationToken))
        {
            return Unauthorized();
        }

        // status sprawdzamy dopiero po tokenie zeby nie zdradzac stanu zgloszenia bez uprawnien
        var status = await db.Tickets
            .AsNoTracking()
            .Where(t => t.Id == ticketId)
            .Select(t => t.Status)
            .SingleAsync(cancellationToken);

        // tombstone stracil juz swoje dane wiec doklejenie pliku cofneloby skutek kasowania
        if (status == TicketStatus.Deleted)
        {
            var conflict = Problem(
                title: "Deleted ticket cannot be modified.",
                statusCode: StatusCodes.Status409Conflict);

            ((ProblemDetails)conflict.Value!).Extensions["currentStatus"] = status;

            return conflict;
        }

        var written = new List<string>();

        try
        {
            var reader = new MultipartReader(contentType.Boundary.Value!, Request.Body);
            var saved = new List<TicketAttachment>();
            var singleUse = new HashSet<string>();
            var fileCount = 0;

            while (await reader.ReadNextSectionAsync(cancellationToken) is { } section)
            {
                if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition)
                    || !disposition.FileName.HasValue)
                {
                    continue;
                }

                var field = disposition.Name.Value ?? string.Empty;
                var kind = KindOf(field);

                if (kind is null)
                {
                    ModelState.AddModelError(field, "Unknown form field.");
                    continue;
                }

                // zrzut i log sa z definicji pojedyncze wiec drugi taki sam odrzucamy zamiast go zapisac
                if (kind != AttachmentKind.UserUpload && !singleUse.Add(field))
                {
                    ModelState.AddModelError(field, "Only one file is accepted for this field.");
                    continue;
                }

                if (kind != AttachmentKind.ConsoleLog && ++fileCount > AttachmentLimits.MaxFiles)
                {
                    ModelState.AddModelError(AttachmentLimits.FilesField,
                        $"At most {AttachmentLimits.MaxFiles} files are accepted.");
                    break;
                }

                var limit = kind == AttachmentKind.ConsoleLog
                    ? AttachmentLimits.MaxConsoleLogBytes
                    : AttachmentLimits.MaxFileBytes;

                var target = Path.Combine(storage.RootPath, $"{Guid.NewGuid()}.tmp");
                written.Add(target);

                var size = await Copy(section.Body, target, limit, cancellationToken);

                if (size < 0)
                {
                    Discard(written);
                    return StatusCode(StatusCodes.Status413PayloadTooLarge);
                }

                var attachment = Store(target, field, kind.Value, disposition.FileName.Value!, size, written);

                if (attachment is not null)
                {
                    attachment.TicketId = ticketId;
                    saved.Add(attachment);
                }
            }

            if (saved.Count == 0 && ModelState.IsValid)
            {
                ModelState.AddModelError("request", "No files were sent.");
            }

            if (!ModelState.IsValid)
            {
                Discard(written);
                return ValidationProblem(ModelState);
            }

            db.TicketAttachments.AddRange(saved);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return StatusCode(StatusCodes.Status201Created, saved
                .Select(a => new TicketAttachmentResponse(a.Id, a.Kind, a.FileName, a.ContentType, a.SizeBytes))
                .ToList());
        }
        catch
        {
            Discard(written);
            throw;
        }
    }

    // pojedynczy update zamiast odczytu i zapisu bo dwa rownolegle zadania moga trafic w ten sam token
    private async Task<bool> ConsumeToken(Guid ticketId, string provided, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var hash = UploadToken.Hash(provided);

        var consumed = await db.TicketUploadTokens
            .Where(t => t.TicketId == ticketId
                && t.TokenHash == hash
                && t.UsedAt == null
                && t.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(t => t.UsedAt, now), cancellationToken);

        return consumed == 1;
    }

    private TicketAttachment? Store(
        string temporaryPath,
        string field,
        AttachmentKind kind,
        string clientFileName,
        long size,
        List<string> written)
    {
        DetectedContent detected;

        // uchwyt musi byc zamkniety przed Rename bo Windows nie pozwala przeniesc otwartego pliku
        using (var file = System.IO.File.OpenRead(temporaryPath))
        {
            if (kind == AttachmentKind.ConsoleLog)
            {
                if (!AttachmentContentInspector.IsUtf8Text(file))
                {
                    ModelState.AddModelError(field, "Console log must be valid UTF-8 text.");
                    return null;
                }

                detected = new DetectedContent("text/plain", "txt");
            }
            else
            {
                var inspected = AttachmentContentInspector.Detect(file);

                if (inspected is null)
                {
                    ModelState.AddModelError(field, "File content does not match an accepted type.");
                    return null;
                }

                detected = inspected;
            }
        }

        return Rename(temporaryPath, detected, kind, clientFileName, size, written);
    }

    private TicketAttachment Rename(
        string temporaryPath,
        DetectedContent detected,
        AttachmentKind kind,
        string clientFileName,
        long size,
        List<string> written)
    {
        var name = $"{Guid.NewGuid()}.{detected.Extension}";
        var finalPath = Path.Combine(storage.RootPath, name);

        System.IO.File.Move(temporaryPath, finalPath);
        written.Remove(temporaryPath);
        written.Add(finalPath);

        return new TicketAttachment
        {
            Kind = kind,
            Uri = $"{AttachmentStorageOptions.UriPrefix}/{name}",
            // nazwa od klienta nigdy nie trafia do sciezki
            FileName = MetadataFileName(clientFileName),
            ContentType = detected.ContentType,
            SizeBytes = size
        };
    }

    // nazwa jest sama metadana wiec za dluga przycinamy zamiast odrzucac poprawna wysylke
    private static string MetadataFileName(string clientFileName)
    {
        var name = Path.GetFileName(clientFileName);

        if (name.Length <= AttachmentLimits.MaxFileNameLength)
        {
            return name;
        }

        var extension = Path.GetExtension(name);

        if (extension.Length >= AttachmentLimits.MaxFileNameLength)
        {
            return name[..AttachmentLimits.MaxFileNameLength];
        }

        return string.Concat(
            name.AsSpan(0, AttachmentLimits.MaxFileNameLength - extension.Length),
            extension);
    }

    private static AttachmentKind? KindOf(string field) => field switch
    {
        AttachmentLimits.ScreenshotField => AttachmentKind.Screenshot,
        AttachmentLimits.FilesField => AttachmentKind.UserUpload,
        AttachmentLimits.ConsoleLogField => AttachmentKind.ConsoleLog,
        _ => null
    };

    private static async Task<long> Copy(Stream source, string path, long limit, CancellationToken cancellationToken)
    {
        await using var target = System.IO.File.Create(path);

        var buffer = new byte[81920];
        long total = 0;
        int read;

        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            total += read;

            // przerywamy w polowie transferu zeby nie wciagac calego pliku ponad limit
            if (total > limit)
            {
                return -1;
            }

            await target.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }

        return total;
    }

    private static void Discard(IEnumerable<string> paths)
    {
        foreach (var path in paths)
        {
            System.IO.File.Delete(path);
        }
    }
}
