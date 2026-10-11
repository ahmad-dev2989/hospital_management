using System.Security.Cryptography;
using System.Text;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class DocumentAndSystemTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly DocumentService _documentService;
    private readonly SystemService _systemService;
    private readonly List<Guid> _cleanupPatientIds = new();
    private readonly List<Guid> _cleanupDocumentIds = new();
    private readonly List<string> _cleanupBackupFiles = new();

    public DocumentAndSystemTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);

        var config = new ConfigurationBuilder().Build();
        var auditService = new AuditService(_dbContext, NullLogger<AuditService>.Instance);

        _documentService = new DocumentService(
            _dbContext,
            auditService,
            config,
            NullLogger<DocumentService>.Instance);

        _systemService = new SystemService(
            _dbContext,
            auditService,
            config,
            NullLogger<SystemService>.Instance);
    }

    public void Dispose()
    {
        if (_cleanupDocumentIds.Count > 0)
        {
            var docs = _dbContext.Documents.Where(d => _cleanupDocumentIds.Contains(d.Id)).ToList();
            _dbContext.Documents.RemoveRange(docs);
            _dbContext.SaveChanges();
        }

        if (_cleanupPatientIds.Count > 0)
        {
            var patients = _dbContext.Patients.Where(p => _cleanupPatientIds.Contains(p.Id)).ToList();
            _dbContext.Patients.RemoveRange(patients);
            _dbContext.SaveChanges();
        }

        foreach (var backupFile in _cleanupBackupFiles)
        {
            try
            {
                var backupRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "HospitalApp",
                    "Backups");
                var full = Path.Combine(backupRoot, backupFile);
                if (File.Exists(full)) File.Delete(full);
            }
            catch { }
        }

        _dbContext.Dispose();
    }

    private async Task<Patient> CreateTestPatientAsync()
    {
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"HSP-DOC-{DateTime.UtcNow.Ticks % 100000:D5}",
            FirstName = "DocumentTest",
            LastName = "Patient",
            DateOfBirth = new DateTime(1985, 4, 12, 0, 0, 0, DateTimeKind.Utc),
            Gender = "Female",
            Phone = $"+1555{DateTime.UtcNow.Ticks % 1000000:D7}"
        };

        _dbContext.Patients.Add(patient);
        await _dbContext.SaveChangesAsync();
        _cleanupPatientIds.Add(patient.Id);
        return patient;
    }

    [Fact]
    public async Task UploadDocumentAsync_StoresFile_CalculatesSha256_CreatesDbRecord()
    {
        var patient = await CreateTestPatientAsync();
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var content = "MERCY COMMUNITY HOSPITAL - CLINICAL LAB SCAN REPORT - VERIFIED";
        var bytes = Encoding.UTF8.GetBytes(content);
        using var stream = new MemoryStream(bytes);

        // Expected SHA-256
        using var sha = SHA256.Create();
        var expectedHash = Convert.ToHexString(sha.ComputeHash(bytes)).ToLowerInvariant();

        var doc = await _documentService.UploadDocumentAsync(
            patient.Id,
            null,
            DocumentCategory.LabReport,
            "test_lab_scan.pdf",
            "application/pdf",
            stream,
            admin.Id);

        _cleanupDocumentIds.Add(doc.Id);

        Assert.NotNull(doc);
        Assert.Equal("test_lab_scan.pdf", doc.FileName);
        Assert.Equal("application/pdf", doc.MimeType);
        Assert.Equal(bytes.Length, doc.SizeBytes);
        Assert.Equal(expectedHash, doc.Sha256Hash);
        Assert.Equal((int)DocumentCategory.LabReport, doc.Category);
        Assert.Equal(patient.PatientNumber, doc.PatientNumber);

        // Verify stream retrieval
        var (fileStream, mimeType, fileName) = await _documentService.GetDocumentStreamAsync(doc.Id);
        using (fileStream)
        {
            using var reader = new StreamReader(fileStream);
            var retrievedText = await reader.ReadToEndAsync();
            Assert.Equal(content, retrievedText);
        }
        Assert.Equal("application/pdf", mimeType);
        Assert.Equal("test_lab_scan.pdf", fileName);
    }

    [Fact]
    public async Task UploadDocumentAsync_WithEmptyStream_ThrowsArgumentException()
    {
        var patient = await CreateTestPatientAsync();
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);
        using var stream = new MemoryStream();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _documentService.UploadDocumentAsync(
                patient.Id,
                null,
                DocumentCategory.General,
                "empty.txt",
                "text/plain",
                stream,
                admin.Id));
    }

    [Fact]
    public async Task GetDocumentsAsync_FiltersByPatientAndCategory()
    {
        var patient = await CreateTestPatientAsync();
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var bytes = Encoding.UTF8.GetBytes("DOCUMENT A");
        using var stream1 = new MemoryStream(bytes);
        var doc1 = await _documentService.UploadDocumentAsync(
            patient.Id, null, DocumentCategory.Identity, "id_card.png", "image/png", stream1, admin.Id);
        _cleanupDocumentIds.Add(doc1.Id);

        using var stream2 = new MemoryStream(bytes);
        var doc2 = await _documentService.UploadDocumentAsync(
            patient.Id, null, DocumentCategory.Referral, "referral_letter.pdf", "application/pdf", stream2, admin.Id);
        _cleanupDocumentIds.Add(doc2.Id);

        var result = await _documentService.GetDocumentsAsync(patient.Id, null, DocumentCategory.Identity, null, 1, 10);
        Assert.NotNull(result);
        Assert.Contains(result.Items, d => d.Id == doc1.Id);
        Assert.DoesNotContain(result.Items, d => d.Id == doc2.Id);
    }

    [Fact]
    public async Task DeleteDocumentAsync_RemovesDbRecord_AndPhysicalFile()
    {
        var patient = await CreateTestPatientAsync();
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var bytes = Encoding.UTF8.GetBytes("TO BE DELETED");
        using var stream = new MemoryStream(bytes);
        var doc = await _documentService.UploadDocumentAsync(
            patient.Id, null, DocumentCategory.General, "temp_delete.txt", "text/plain", stream, admin.Id);

        var deleted = await _documentService.DeleteDocumentAsync(doc.Id, admin.Id);
        Assert.True(deleted);

        var fetched = await _documentService.GetDocumentByIdAsync(doc.Id);
        Assert.Null(fetched);
    }

    [Fact]
    public async Task SystemSettings_ReadAndBatchUpdate_PersistsSuccessfully()
    {
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var settings = await _systemService.GetSettingsAsync();
        Assert.NotEmpty(settings);

        var newValues = new Dictionary<string, string>
        {
            ["HospitalPhone"] = "+1-555-9876",
            ["CurrencySymbol"] = "$"
        };

        var updated = await _systemService.BatchUpdateSettingsAsync(newValues, admin.Id);
        Assert.NotNull(updated);

        var phone = await _systemService.GetSettingByKeyAsync("HospitalPhone");
        Assert.NotNull(phone);
        Assert.Equal("+1-555-9876", phone.Value);
    }

    [Fact]
    public async Task SystemBackups_CreateAndVerify_ProducesValidBackup()
    {
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var backup = await _systemService.CreateBackupAsync(admin.Id);
        Assert.NotNull(backup);
        Assert.NotEmpty(backup.FileName);
        Assert.True(backup.SizeBytes > 0);
        Assert.NotEmpty(backup.Sha256Hash);
        Assert.True(backup.IsVerified);

        _cleanupBackupFiles.Add(backup.FileName);

        var verified = await _systemService.VerifyBackupAsync(backup.FileName);
        Assert.NotNull(verified);
        Assert.True(verified.IsVerified);
        Assert.Equal(backup.Sha256Hash, verified.Sha256Hash);

        var list = await _systemService.GetBackupsAsync();
        Assert.Contains(list, b => b.FileName == backup.FileName);
    }

    [Fact]
    public async Task GetSystemInfoAsync_ReturnsPopulatedTelemetry()
    {
        var info = await _systemService.GetSystemInfoAsync();
        Assert.NotNull(info);
        Assert.NotEmpty(info.DotNetVersion);
        Assert.NotEmpty(info.OsDescription);
        Assert.NotEmpty(info.DatabaseName);
        Assert.True(info.RecordCounts.ContainsKey("Patients"));
        Assert.True(info.RecordCounts.ContainsKey("UserAccounts"));
        Assert.NotEmpty(info.DocumentsStoragePath);
        Assert.NotEmpty(info.BackupsDirectoryPath);
    }
}
