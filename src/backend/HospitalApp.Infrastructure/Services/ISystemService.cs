using HospitalApp.Core.DTOs;

namespace HospitalApp.Infrastructure.Services;

public interface ISystemService
{
    Task<List<SystemSettingDto>> GetSettingsAsync(CancellationToken cancellationToken = default);
    Task<SystemSettingDto?> GetSettingByKeyAsync(string key, CancellationToken cancellationToken = default);
    Task<SystemSettingDto> UpdateSettingAsync(string key, string value, string? description, Guid actorUserId, CancellationToken cancellationToken = default);
    Task<List<SystemSettingDto>> BatchUpdateSettingsAsync(Dictionary<string, string> settings, Guid actorUserId, CancellationToken cancellationToken = default);

    Task<List<DatabaseBackupDto>> GetBackupsAsync(CancellationToken cancellationToken = default);
    Task<DatabaseBackupDto> CreateBackupAsync(Guid actorUserId, CancellationToken cancellationToken = default);
    Task<DatabaseBackupDto> VerifyBackupAsync(string fileName, CancellationToken cancellationToken = default);
    Task<bool> DeleteBackupAsync(string fileName, Guid actorUserId, CancellationToken cancellationToken = default);

    Task<SystemInfoDto> GetSystemInfoAsync(CancellationToken cancellationToken = default);
    Task<string> RunMaintenanceAsync(Guid actorUserId, CancellationToken cancellationToken = default);
}
