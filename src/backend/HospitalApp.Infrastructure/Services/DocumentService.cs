using System.Security.Cryptography;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class DocumentService : IDocumentService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<DocumentService> _logger;
    private readonly string _storageRoot;
    private const long MaxFileSizeBytes = 25 * 1024 * 1024; // 25 MB

    public DocumentService(
        ApplicationDbContext context,
        IAuditService auditService,
        IConfiguration configuration,
        ILogger<DocumentService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;

        var configuredPath = configuration["Storage:DocumentsDirectory"];
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            configuredPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "HospitalApp",
                "Documents");
        }

        _storageRoot = Path.GetFullPath(configuredPath);
        if (!Directory.Exists(_storageRoot))
        {
            Directory.CreateDirectory(_storageRoot);
        }
    }

    public async Task<DocumentDto> UploadDocumentAsync(
        Guid patientId,
        Guid? encounterId,
        DocumentCategory category,
        string fileName,
        string mimeType,
        Stream contentStream,
        Guid uploadedByUserId,
        CancellationToken cancellationToken = default)
    {
        if (contentStream == null || contentStream.Length == 0)
        {
            throw new ArgumentException("Uploaded document stream cannot be empty.", nameof(contentStream));
        }

        if (contentStream.Length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size exceeds the 25 MB limit (file size: {contentStream.Length / (1024 * 1024.0):F1} MB).", nameof(contentStream));
        }

        var patient = await _context.Patients.FirstOrDefaultAsync(p => p.Id == patientId, cancellationToken);
        if (patient == null)
        {
            throw new KeyNotFoundException($"Patient with ID '{patientId}' was not found.");
        }

        if (encounterId.HasValue)
        {
            var encExists = await _context.Encounters.AnyAsync(e => e.Id == encounterId.Value, cancellationToken);
            if (!encExists)
            {
                throw new KeyNotFoundException($"Clinical encounter with ID '{encounterId.Value}' was not found.");
            }
        }

        var sanitizedFileName = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(sanitizedFileName))
        {
            sanitizedFileName = $"document_{Guid.NewGuid():N}.bin";
        }

        // Subdirectory partition: {storageRoot}/{patientId}/{year-month}
        var yearMonth = DateTime.UtcNow.ToString("yyyy-MM");
        var targetDir = Path.Combine(_storageRoot, patientId.ToString(), yearMonth);
        Directory.CreateDirectory(targetDir);

        var uniquePrefix = Guid.NewGuid().ToString("N");
        var diskFileName = $"{uniquePrefix}_{sanitizedFileName}";
        var destinationPath = Path.Combine(targetDir, diskFileName);

        // Security: Path traversal prevention
        var canonicalDest = Path.GetFullPath(destinationPath);
        if (!canonicalDest.StartsWith(_storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Illegal file destination path detected. Path traversal rejected.");
        }

        // Stream to file and calculate SHA-256 hash simultaneously
        string sha256Hash;
        long totalBytesWritten;
        using (var sha256 = SHA256.Create())
        using (var fileStream = new FileStream(destinationPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            contentStream.Position = 0;
            var buffer = new byte[81920];
            int read;
            totalBytesWritten = 0;

            while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
            {
                await fileStream.WriteAsync(buffer, 0, read, cancellationToken);
                sha256.TransformBlock(buffer, 0, read, null, 0);
                totalBytesWritten += read;
            }

            sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
            sha256Hash = Convert.ToHexString(sha256.Hash ?? Array.Empty<byte>()).ToLowerInvariant();
        }

        // Relative storage path stored in DB for portability
        var relativePath = Path.GetRelativePath(_storageRoot, destinationPath);

        var doc = new DocumentMetadata
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            EncounterId = encounterId,
            UploadedByUserId = uploadedByUserId,
            FileName = sanitizedFileName,
            StoragePath = relativePath,
            MimeType = string.IsNullOrWhiteSpace(mimeType) ? "application/octet-stream" : mimeType,
            SizeBytes = totalBytesWritten,
            Sha256Hash = sha256Hash,
            Category = category,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Documents.Add(doc);
        await _context.SaveChangesAsync(cancellationToken);

        var uploader = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == uploadedByUserId, cancellationToken);
        var uploaderName = uploader?.Username ?? "system";

        await _auditService.LogAsync(
            uploadedByUserId,
            uploaderName,
            "DOCUMENT_UPLOADED",
            "DocumentMetadata",
            doc.Id.ToString(),
            $"Uploaded '{sanitizedFileName}' ({totalBytesWritten / 1024.0:F1} KB, SHA-256: {sha256Hash[..8]}...) for patient {patient.PatientNumber}.",
            "127.0.0.1");

        _logger.LogInformation("Stored document {DocumentId} ({FileName}) for patient {PatientId}", doc.Id, sanitizedFileName, patientId);

        return new DocumentDto
        {
            Id = doc.Id,
            PatientId = doc.PatientId,
            PatientNumber = patient.PatientNumber,
            PatientName = patient.FirstName + " " + patient.LastName,
            EncounterId = doc.EncounterId,
            UploadedByUserId = doc.UploadedByUserId,
            UploadedByUserName = uploader?.Username ?? "system",
            FileName = doc.FileName,
            MimeType = doc.MimeType,
            SizeBytes = doc.SizeBytes,
            Sha256Hash = doc.Sha256Hash,
            Category = (int)doc.Category,
            CategoryName = doc.Category.ToString(),
            CreatedAt = doc.CreatedAt,
            UpdatedAt = doc.UpdatedAt
        };
    }

    public async Task<PagedResult<DocumentDto>> GetDocumentsAsync(
        Guid? patientId = null,
        Guid? encounterId = null,
        DocumentCategory? category = null,
        string? query = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var q = _context.Documents
            .Include(d => d.Patient)
            .Include(d => d.UploadedByUser)
            .AsNoTracking()
            .AsQueryable();

        if (patientId.HasValue)
        {
            q = q.Where(d => d.PatientId == patientId.Value);
        }

        if (encounterId.HasValue)
        {
            q = q.Where(d => d.EncounterId == encounterId.Value);
        }

        if (category.HasValue)
        {
            q = q.Where(d => d.Category == category.Value);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim().ToLower();
            q = q.Where(d =>
                d.FileName.ToLower().Contains(term) ||
                d.Patient.PatientNumber.ToLower().Contains(term) ||
                d.Patient.FirstName.ToLower().Contains(term) ||
                d.Patient.LastName.ToLower().Contains(term));
        }

        var total = await q.CountAsync(cancellationToken);

        var items = await q
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new DocumentDto
            {
                Id = d.Id,
                PatientId = d.PatientId,
                PatientNumber = d.Patient.PatientNumber,
                PatientName = d.Patient.FirstName + " " + d.Patient.LastName,
                EncounterId = d.EncounterId,
                UploadedByUserId = d.UploadedByUserId,
                UploadedByUserName = d.UploadedByUser.Username,
                FileName = d.FileName,
                MimeType = d.MimeType,
                SizeBytes = d.SizeBytes,
                Sha256Hash = d.Sha256Hash,
                Category = (int)d.Category,
                CategoryName = d.Category.ToString(),
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<DocumentDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<DocumentDto?> GetDocumentByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var doc = await _context.Documents
            .Include(d => d.Patient)
            .Include(d => d.UploadedByUser)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

        if (doc == null) return null;

        return new DocumentDto
        {
            Id = doc.Id,
            PatientId = doc.PatientId,
            PatientNumber = doc.Patient.PatientNumber,
            PatientName = doc.Patient.FirstName + " " + doc.Patient.LastName,
            EncounterId = doc.EncounterId,
            UploadedByUserId = doc.UploadedByUserId,
            UploadedByUserName = doc.UploadedByUser.Username,
            FileName = doc.FileName,
            MimeType = doc.MimeType,
            SizeBytes = doc.SizeBytes,
            Sha256Hash = doc.Sha256Hash,
            Category = (int)doc.Category,
            CategoryName = doc.Category.ToString(),
            CreatedAt = doc.CreatedAt,
            UpdatedAt = doc.UpdatedAt
        };
    }

    public async Task<(Stream Stream, string MimeType, string FileName)> GetDocumentStreamAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var doc = await _context.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (doc == null)
        {
            throw new KeyNotFoundException($"Document with ID '{id}' was not found.");
        }

        var fullPath = Path.Combine(_storageRoot, doc.StoragePath);
        var canonical = Path.GetFullPath(fullPath);
        if (!canonical.StartsWith(_storageRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Illegal file path access attempt.");
        }

        if (!File.Exists(canonical))
        {
            throw new FileNotFoundException($"The requested physical file was not found on local storage disk.", doc.FileName);
        }

        var stream = new FileStream(canonical, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, doc.MimeType, doc.FileName);
    }

    public async Task<bool> DeleteDocumentAsync(Guid id, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var doc = await _context.Documents.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (doc == null)
        {
            return false;
        }

        var fullPath = Path.Combine(_storageRoot, doc.StoragePath);

        _context.Documents.Remove(doc);
        await _context.SaveChangesAsync(cancellationToken);

        // Delete physical file safely
        try
        {
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Physical file deletion failed for document {DocumentId} at {Path}", id, fullPath);
        }

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "DOCUMENT_DELETED",
            "DocumentMetadata",
            id.ToString(),
            $"Deleted document '{doc.FileName}' (ID: {id}).",
            "127.0.0.1");

        return true;
    }
}
