using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/documents")]
[Authorize]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly ILogger<DocumentsController> _logger;

    public DocumentsController(IDocumentService documentService, ILogger<DocumentsController> logger)
    {
        _documentService = documentService;
        _logger = logger;
    }

    private (Guid UserId, string Username) GetCurrentUser()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
        var userId = Guid.TryParse(idStr, out var parsed) ? parsed : Guid.Empty;
        return (userId, username);
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadDocument(
        [FromForm] Guid patientId,
        [FromForm] Guid? encounterId,
        [FromForm] DocumentCategory category,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = new { code = "INVALID_FILE", message = "No file was attached in the upload payload." } });
        }

        var (userId, _) = GetCurrentUser();

        try
        {
            using var stream = file.OpenReadStream();
            var doc = await _documentService.UploadDocumentAsync(
                patientId,
                encounterId,
                category,
                file.FileName,
                file.ContentType,
                stream,
                userId,
                cancellationToken);

            return CreatedAtAction(nameof(GetDocumentById), new { id = doc.Id }, doc);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = new { code = "INVALID_DOCUMENT_ARGUMENT", message = ex.Message } });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = new { code = "ENTITY_NOT_FOUND", message = ex.Message } });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetDocuments(
        [FromQuery] Guid? patientId,
        [FromQuery] Guid? encounterId,
        [FromQuery] DocumentCategory? category,
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _documentService.GetDocumentsAsync(
            patientId,
            encounterId,
            category,
            query,
            page,
            pageSize,
            cancellationToken);

        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDocumentById(Guid id, CancellationToken cancellationToken)
    {
        var doc = await _documentService.GetDocumentByIdAsync(id, cancellationToken);
        if (doc == null)
        {
            return NotFound(new { error = new { code = "DOCUMENT_NOT_FOUND", message = $"Document with ID '{id}' was not found." } });
        }
        return Ok(doc);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> DownloadDocument(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var (stream, mimeType, fileName) = await _documentService.GetDocumentStreamAsync(id, cancellationToken);
            return File(stream, mimeType, fileName);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = new { code = "DOCUMENT_NOT_FOUND", message = ex.Message } });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = new { code = "FILE_MISSING_ON_DISK", message = ex.Message } });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteDocument(Guid id, CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        var deleted = await _documentService.DeleteDocumentAsync(id, userId, cancellationToken);
        if (!deleted)
        {
            return NotFound(new { error = new { code = "DOCUMENT_NOT_FOUND", message = $"Document with ID '{id}' was not found." } });
        }
        return NoContent();
    }
}
