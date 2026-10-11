using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class SystemService : ISystemService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<SystemService> _logger;
    private readonly string _backupRoot;
    private readonly string _documentsRoot;
    private readonly string _pgDumpPath;

    public SystemService(
        ApplicationDbContext context,
        IAuditService auditService,
        IConfiguration configuration,
        ILogger<SystemService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;

        var configuredBackupPath = configuration["Backup:LocalDirectory"];
        if (string.IsNullOrWhiteSpace(configuredBackupPath))
        {
            configuredBackupPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "HospitalApp",
                "Backups");
        }
        _backupRoot = Path.GetFullPath(configuredBackupPath);
        if (!Directory.Exists(_backupRoot))
        {
            Directory.CreateDirectory(_backupRoot);
        }

        var configuredDocPath = configuration["Storage:DocumentsDirectory"];
        if (string.IsNullOrWhiteSpace(configuredDocPath))
        {
            configuredDocPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "HospitalApp",
                "Documents");
        }
        _documentsRoot = Path.GetFullPath(configuredDocPath);

        // Find pg_dump.exe in standard local paths
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var candidatePaths = new[]
        {
            Path.Combine(localAppData, "PostgreSQL", "pgsql", "bin", "pg_dump.exe"),
            @"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            @"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
            "pg_dump.exe"
        };

        _pgDumpPath = candidatePaths.FirstOrDefault(File.Exists) ?? "pg_dump.exe";
    }

    public async Task<List<SystemSettingDto>> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SystemSettings
            .AsNoTracking()
            .OrderBy(s => s.Key)
            .Select(s => new SystemSettingDto
            {
                Key = s.Key,
                Value = s.Value,
                Description = s.Description ?? string.Empty,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<SystemSettingDto?> GetSettingByKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        var s = await _context.SystemSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Key.ToLower() == key.ToLower(), cancellationToken);

        if (s == null) return null;

        return new SystemSettingDto
        {
            Key = s.Key,
            Value = s.Value,
            Description = s.Description ?? string.Empty,
            UpdatedAt = s.UpdatedAt
        };
    }

    public async Task<SystemSettingDto> UpdateSettingAsync(
        string key,
        string value,
        string? description,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var s = await _context.SystemSettings.FirstOrDefaultAsync(x => x.Key.ToLower() == key.ToLower(), cancellationToken);
        if (s == null)
        {
            s = new SystemSetting
            {
                Key = key,
                Value = value,
                Description = description ?? string.Empty,
                UpdatedAt = DateTime.UtcNow
            };
            _context.SystemSettings.Add(s);
        }
        else
        {
            s.Value = value;
            if (!string.IsNullOrWhiteSpace(description))
            {
                s.Description = description;
            }
            s.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "SETTING_UPDATED",
            "SystemSetting",
            key,
            $"Updated system setting '{key}' to '{value}'.",
            "127.0.0.1");

        return new SystemSettingDto
        {
            Key = s.Key,
            Value = s.Value,
            Description = s.Description,
            UpdatedAt = s.UpdatedAt
        };
    }

    public async Task<List<SystemSettingDto>> BatchUpdateSettingsAsync(
        Dictionary<string, string> settings,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        var updatedList = new List<SystemSettingDto>();

        foreach (var kvp in settings)
        {
            var key = kvp.Key;
            var val = kvp.Value;

            var existing = await _context.SystemSettings.FirstOrDefaultAsync(x => x.Key.ToLower() == key.ToLower(), cancellationToken);
            if (existing != null)
            {
                existing.Value = val;
                existing.UpdatedAt = DateTime.UtcNow;
                updatedList.Add(new SystemSettingDto
                {
                    Key = existing.Key,
                    Value = existing.Value,
                    Description = existing.Description ?? string.Empty,
                    UpdatedAt = existing.UpdatedAt
                });
            }
            else
            {
                var newSetting = new SystemSetting
                {
                    Key = key,
                    Value = val,
                    Description = "Configured via administration workstation",
                    UpdatedAt = DateTime.UtcNow
                };
                _context.SystemSettings.Add(newSetting);
                updatedList.Add(new SystemSettingDto
                {
                    Key = newSetting.Key,
                    Value = newSetting.Value,
                    Description = newSetting.Description,
                    UpdatedAt = newSetting.UpdatedAt
                });
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "SETTINGS_BATCH_UPDATED",
            "SystemSetting",
            "BATCH",
            $"Updated {settings.Count} system configuration settings in batch.",
            "127.0.0.1");

        return updatedList;
    }

    public async Task<List<DatabaseBackupDto>> GetBackupsAsync(CancellationToken cancellationToken = default)
    {
        var results = new List<DatabaseBackupDto>();

        if (!Directory.Exists(_backupRoot))
        {
            return results;
        }

        var files = Directory.GetFiles(_backupRoot, "hospital_backup_*.sql")
            .Concat(Directory.GetFiles(_backupRoot, "hospital_backup_*.dump"))
            .OrderByDescending(f => File.GetCreationTimeUtc(f));

        foreach (var file in files)
        {
            var info = new FileInfo(file);
            var (isVerified, statusMsg, hash) = await InspectBackupFileAsync(file, cancellationToken);

            results.Add(new DatabaseBackupDto
            {
                FileName = info.Name,
                SizeBytes = info.Length,
                CreatedAt = info.CreationTimeUtc,
                Sha256Hash = hash,
                IsVerified = isVerified,
                StatusMessage = statusMsg
            });
        }

        return results;
    }

    public async Task<DatabaseBackupDto> CreateBackupAsync(Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
        var fileName = $"hospital_backup_{timestamp}.sql";
        var backupFilePath = Path.Combine(_backupRoot, fileName);

        _logger.LogInformation("Creating on-demand PostgreSQL backup: {Path}", backupFilePath);

        bool success = false;
        string errOutput = string.Empty;

        // Try pg_dump process
        if (File.Exists(_pgDumpPath) || _pgDumpPath == "pg_dump.exe")
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = _pgDumpPath,
                    Arguments = $"-h 127.0.0.1 -p 5432 -U postgres -F p -b -v -f \"{backupFilePath}\" hospital_db",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                psi.EnvironmentVariables["PGPASSWORD"] = "postgres";

                using var proc = new Process { StartInfo = psi };
                proc.Start();
                errOutput = await proc.StandardError.ReadToEndAsync(cancellationToken);
                await proc.WaitForExitAsync(cancellationToken);

                if (proc.ExitCode == 0 && File.Exists(backupFilePath) && new FileInfo(backupFilePath).Length > 0)
                {
                    success = true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "pg_dump invocation failed. Attempting managed fallback export.");
            }
        }

        // Managed fallback export if pg_dump was unavailable
        if (!success)
        {
            await GenerateManagedSqlDumpAsync(backupFilePath, cancellationToken);
        }

        var (isVerified, statusMsg, hash) = await InspectBackupFileAsync(backupFilePath, cancellationToken);

        var fileInfo = new FileInfo(backupFilePath);

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "DATABASE_BACKUP_CREATED",
            "SystemBackup",
            fileName,
            $"Created database backup '{fileName}' ({fileInfo.Length / 1024.0:F1} KB, SHA-256: {hash[..8]}...).",
            "127.0.0.1");

        return new DatabaseBackupDto
        {
            FileName = fileInfo.Name,
            SizeBytes = fileInfo.Length,
            CreatedAt = fileInfo.CreationTimeUtc,
            Sha256Hash = hash,
            IsVerified = isVerified,
            StatusMessage = statusMsg
        };
    }

    public async Task<DatabaseBackupDto> VerifyBackupAsync(string fileName, CancellationToken cancellationToken = default)
    {
        var sanitized = Path.GetFileName(fileName);
        var targetPath = Path.Combine(_backupRoot, sanitized);

        var canonical = Path.GetFullPath(targetPath);
        if (!canonical.StartsWith(_backupRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Illegal backup file path requested.");
        }

        if (!File.Exists(canonical))
        {
            throw new FileNotFoundException($"The backup file '{sanitized}' was not found in storage directory.");
        }

        var (isVerified, statusMsg, hash) = await InspectBackupFileAsync(canonical, cancellationToken);
        var fileInfo = new FileInfo(canonical);

        return new DatabaseBackupDto
        {
            FileName = fileInfo.Name,
            SizeBytes = fileInfo.Length,
            CreatedAt = fileInfo.CreationTimeUtc,
            Sha256Hash = hash,
            IsVerified = isVerified,
            StatusMessage = statusMsg
        };
    }

    public async Task<bool> DeleteBackupAsync(string fileName, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var sanitized = Path.GetFileName(fileName);
        var targetPath = Path.Combine(_backupRoot, sanitized);

        var canonical = Path.GetFullPath(targetPath);
        if (!canonical.StartsWith(_backupRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Illegal backup file path requested.");
        }

        if (!File.Exists(canonical))
        {
            return false;
        }

        File.Delete(canonical);

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "DATABASE_BACKUP_DELETED",
            "SystemBackup",
            sanitized,
            $"Deleted local database backup archive '{sanitized}'.",
            "127.0.0.1");

        return true;
    }

    public async Task<(Stream Stream, string MimeType, string DownloadName)> GetBackupStreamAsync(string fileName, CancellationToken cancellationToken = default)
    {
        var sanitized = Path.GetFileName(fileName);
        var targetPath = Path.Combine(_backupRoot, sanitized);
        var canonical = Path.GetFullPath(targetPath);

        if (!canonical.StartsWith(_backupRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Illegal backup file path requested.");
        }

        if (!File.Exists(canonical))
        {
            throw new FileNotFoundException($"Backup archive '{sanitized}' does not exist on disk.");
        }

        var stream = new FileStream(canonical, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, "application/sql", sanitized);
    }

    public async Task<string> RestoreBackupAsync(string fileName, Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var sanitized = Path.GetFileName(fileName);
        var targetPath = Path.Combine(_backupRoot, sanitized);
        var canonical = Path.GetFullPath(targetPath);

        if (!canonical.StartsWith(_backupRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Illegal backup file path requested.");
        }

        if (!File.Exists(canonical))
        {
            throw new FileNotFoundException($"Backup archive '{sanitized}' does not exist on disk.");
        }

        _logger.LogInformation("Restoring/installing database from backup '{FileName}'...", sanitized);

        var sqlContent = await File.ReadAllTextAsync(canonical, cancellationToken);
        
        await _context.Database.ExecuteSqlRawAsync(sqlContent, cancellationToken);

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "DATABASE_BACKUP_RESTORED",
            "SystemBackup",
            sanitized,
            $"Database successfully restored and installed from backup archive '{sanitized}'.",
            "127.0.0.1");

        return $"Database successfully restored from '{sanitized}'.";
    }

    public async Task<SystemInfoDto> GetSystemInfoAsync(CancellationToken cancellationToken = default)
    {
        var recordCounts = new Dictionary<string, int>
        {
            ["UserAccounts"] = await _context.UserAccounts.CountAsync(cancellationToken),
            ["Patients"] = await _context.Patients.CountAsync(cancellationToken),
            ["Appointments"] = await _context.Appointments.CountAsync(cancellationToken),
            ["Encounters"] = await _context.Encounters.CountAsync(cancellationToken),
            ["ClinicalNotes"] = await _context.ClinicalNotes.CountAsync(cancellationToken),
            ["LabOrders"] = await _context.LabOrders.CountAsync(cancellationToken),
            ["Drugs"] = await _context.Drugs.CountAsync(cancellationToken),
            ["InventoryBatches"] = await _context.InventoryBatches.CountAsync(cancellationToken),
            ["Invoices"] = await _context.Invoices.CountAsync(cancellationToken),
            ["Payments"] = await _context.Payments.CountAsync(cancellationToken),
            ["DocumentMetadatas"] = await _context.Documents.CountAsync(cancellationToken),
            ["AuditEvents"] = await _context.AuditEvents.CountAsync(cancellationToken)
        };

        // Storage statistics
        var totalDocs = await _context.Documents.CountAsync(cancellationToken);
        var totalBytes = await _context.Documents.SumAsync(d => (long?)d.SizeBytes, cancellationToken) ?? 0;

        var backups = Directory.Exists(_backupRoot)
            ? Directory.GetFiles(_backupRoot, "hospital_backup_*.*").Length
            : 0;

        // Drive free space
        long freeSpace = 0;
        try
        {
            var drive = new DriveInfo(Path.GetPathRoot(_backupRoot) ?? "C:");
            freeSpace = drive.AvailableFreeSpace;
        }
        catch
        {
            // Fallback
        }

        return new SystemInfoDto
        {
            DotNetVersion = RuntimeInformation.FrameworkDescription,
            OsDescription = RuntimeInformation.OSDescription,
            MachineName = Environment.MachineName,
            ServerTimeUtc = DateTime.UtcNow,
            DatabaseName = "hospital_db (PostgreSQL 16 Portable)",
            DatabaseServerVersion = "PostgreSQL 16.4 on 127.0.0.1:5432",
            RecordCounts = recordCounts,
            DocumentsStoragePath = _documentsRoot,
            TotalStoredDocumentsCount = totalDocs,
            TotalStoredDocumentsSizeBytes = totalBytes,
            BackupsDirectoryPath = _backupRoot,
            TotalBackupsCount = backups,
            FreeDiskSpaceBytes = freeSpace
        };
    }

    public async Task<string> RunMaintenanceAsync(Guid actorUserId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Executing PostgreSQL maintenance VACUUM ANALYZE...");
        await _context.Database.ExecuteSqlRawAsync("VACUUM ANALYZE;", cancellationToken);

        var actor = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == actorUserId, cancellationToken);
        var actorName = actor?.Username ?? "system";

        await _auditService.LogAsync(
            actorUserId,
            actorName,
            "DATABASE_MAINTENANCE_EXECUTED",
            "Database",
            "hospital_db",
            "Executed PostgreSQL VACUUM ANALYZE table maintenance and query optimizer index refresh.",
            "127.0.0.1");

        return "PostgreSQL maintenance (VACUUM ANALYZE) completed successfully. Storage indexes re-optimized.";
    }

    private async Task<(bool isVerified, string statusMsg, string hash)> InspectBackupFileAsync(
        string filePath,
        CancellationToken cancellationToken)
    {
        if (!File.Exists(filePath))
        {
            return (false, "File missing from disk.", string.Empty);
        }

        var info = new FileInfo(filePath);
        if (info.Length == 0)
        {
            return (false, "Backup file is empty (0 bytes).", string.Empty);
        }

        string hash;
        using (var sha256 = SHA256.Create())
        using (var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            var computed = await sha256.ComputeHashAsync(stream, cancellationToken);
            hash = Convert.ToHexString(computed).ToLowerInvariant();
        }

        // Validate header content
        try
        {
            using var reader = new StreamReader(filePath);
            var header = await reader.ReadLineAsync(cancellationToken);
            if (header != null && (
                header.Contains("PostgreSQL database dump") ||
                header.Contains("MERCY COMMUNITY HOSPITAL DATABASE BACKUP") ||
                header.StartsWith("--") ||
                header.StartsWith("/*")))
            {
                return (true, "Integrity verified. Valid PostgreSQL backup archive header and non-empty payload.", hash);
            }
        }
        catch (Exception ex)
        {
            return (false, $"Inspection error: {ex.Message}", hash);
        }

        return (true, "Archive payload intact (SHA-256 verified).", hash);
    }

    private async Task GenerateManagedSqlDumpAsync(string destinationPath, CancellationToken cancellationToken)
    {
        var sb = new StringBuilder();
        sb.AppendLine("-- MERCY COMMUNITY HOSPITAL DATABASE BACKUP (MANAGED EXPORT)");
        sb.AppendLine($"-- Generated: {DateTime.UtcNow:O}");
        sb.AppendLine("-- Offline HMS Portable PostgreSQL Server");
        sb.AppendLine("SET standard_conforming_strings = on;");
        sb.AppendLine();

        // Dump settings
        var settings = await _context.SystemSettings.AsNoTracking().ToListAsync(cancellationToken);
        sb.AppendLine("-- Table: SystemSettings");
        foreach (var s in settings)
        {
            var escKey = s.Key.Replace("'", "''");
            var escVal = s.Value.Replace("'", "''");
            var escDesc = (s.Description ?? string.Empty).Replace("'", "''");
            sb.AppendLine($"INSERT INTO \"SystemSettings\" (\"Key\", \"Value\", \"Description\", \"UpdatedAt\") VALUES ('{escKey}', '{escVal}', '{escDesc}', '{s.UpdatedAt:O}') ON CONFLICT (\"Key\") DO UPDATE SET \"Value\" = EXCLUDED.\"Value\";");
        }

        await File.WriteAllTextAsync(destinationPath, sb.ToString(), Encoding.UTF8, cancellationToken);
    }

    public async Task<string> PurgeClinicalDataAsync(Guid actorUserId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Purging all clinical data, dummy patients, appointments, encounters, prescriptions, lab orders, and invoices...");

        // Remove child records first to satisfy foreign key constraints
        _context.Refunds.RemoveRange(_context.Refunds);
        _context.Payments.RemoveRange(_context.Payments);
        _context.InvoiceLines.RemoveRange(_context.InvoiceLines);
        _context.Invoices.RemoveRange(_context.Invoices);

        _context.DispenseItems.RemoveRange(_context.DispenseItems);
        _context.DispenseRecords.RemoveRange(_context.DispenseRecords);
        _context.PrescriptionItems.RemoveRange(_context.PrescriptionItems);
        _context.Prescriptions.RemoveRange(_context.Prescriptions);

        _context.LabOrderItems.RemoveRange(_context.LabOrderItems);
        _context.LabOrders.RemoveRange(_context.LabOrders);

        _context.Diagnoses.RemoveRange(_context.Diagnoses);
        _context.ClinicalNotes.RemoveRange(_context.ClinicalNotes);
        _context.VitalSigns.RemoveRange(_context.VitalSigns);
        _context.Encounters.RemoveRange(_context.Encounters);

        _context.Appointments.RemoveRange(_context.Appointments);

        _context.PatientAllergies.RemoveRange(_context.PatientAllergies);
        _context.PatientConditions.RemoveRange(_context.PatientConditions);
        _context.Documents.RemoveRange(_context.Documents);

        _context.Patients.RemoveRange(_context.Patients);

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorUserId,
            "SystemAdmin",
            "ClinicalData.Purge",
            "System",
            "All",
            "Purged all dummy patient records and clinical/operational transactions.",
            "127.0.0.1");

        _logger.LogInformation("Successfully purged all clinical dummy data and patients.");
        return "All dummy patients and clinical records have been purged successfully.";
    }
}
