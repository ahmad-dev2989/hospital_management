using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;

namespace HospitalApp.Infrastructure.Services;

public interface IDocumentService
{
    Task<DocumentDto> UploadDocumentAsync(
        Guid patientId,
        Guid? encounterId,
        DocumentCategory category,
        string fileName,
        string mimeType,
        Stream contentStream,
        Guid uploadedByUserId,
        CancellationToken cancellationToken = default);

    Task<PagedResult<DocumentDto>> GetDocumentsAsync(
        Guid? patientId = null,
        Guid? encounterId = null,
        DocumentCategory? category = null,
        string? query = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    Task<DocumentDto?> GetDocumentByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(Stream Stream, string MimeType, string FileName)> GetDocumentStreamAsync(Guid id, CancellationToken cancellationToken = default);

    Task<bool> DeleteDocumentAsync(Guid id, Guid actorUserId, CancellationToken cancellationToken = default);
}
