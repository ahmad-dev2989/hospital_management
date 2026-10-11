namespace HospitalApp.Core.DTOs;

public class DocumentDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public Guid? EncounterId { get; set; }
    public Guid UploadedByUserId { get; set; }
    public string UploadedByUserName { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
    public int Category { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SystemSettingDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class UpdateSystemSettingRequest
{
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class BatchUpdateSettingsRequest
{
    public Dictionary<string, string> Settings { get; set; } = new();
}

public class DatabaseBackupDto
{
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Sha256Hash { get; set; } = string.Empty;
    public bool IsVerified { get; set; }
    public string StatusMessage { get; set; } = string.Empty;
}

public class SystemInfoDto
{
    public string DotNetVersion { get; set; } = string.Empty;
    public string OsDescription { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public DateTime ServerTimeUtc { get; set; }
    public string DatabaseName { get; set; } = string.Empty;
    public string DatabaseServerVersion { get; set; } = string.Empty;
    public Dictionary<string, int> RecordCounts { get; set; } = new();
    public string DocumentsStoragePath { get; set; } = string.Empty;
    public int TotalStoredDocumentsCount { get; set; }
    public long TotalStoredDocumentsSizeBytes { get; set; }
    public string BackupsDirectoryPath { get; set; } = string.Empty;
    public int TotalBackupsCount { get; set; }
    public long FreeDiskSpaceBytes { get; set; }
}
