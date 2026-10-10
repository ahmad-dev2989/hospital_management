using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class DocumentMetadata
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid? EncounterId { get; set; }
    public Guid UploadedByUserId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StoragePath { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
    public DocumentCategory Category { get; set; } = DocumentCategory.General;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Patient Patient { get; set; } = null!;
    public Encounter? Encounter { get; set; }
    public UserAccount UploadedByUser { get; set; } = null!;
}
