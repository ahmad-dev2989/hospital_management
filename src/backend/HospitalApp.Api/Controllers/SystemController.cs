using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/system")]
[Authorize]
public class SystemController : ControllerBase
{
    private readonly ISystemService _systemService;
    private readonly ILogger<SystemController> _logger;

    public SystemController(ISystemService systemService, ILogger<SystemController> logger)
    {
        _systemService = systemService;
        _logger = logger;
    }

    private (Guid UserId, string Username) GetCurrentUser()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
        var userId = Guid.TryParse(idStr, out var parsed) ? parsed : Guid.Empty;
        return (userId, username);
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await _systemService.GetSettingsAsync(cancellationToken);
        return Ok(settings);
    }

    [HttpGet("settings/{key}")]
    public async Task<IActionResult> GetSettingByKey(string key, CancellationToken cancellationToken)
    {
        var setting = await _systemService.GetSettingByKeyAsync(key, cancellationToken);
        if (setting == null)
        {
            return NotFound(new { error = new { code = "SETTING_NOT_FOUND", message = $"Setting with key '{key}' was not found." } });
        }
        return Ok(setting);
    }

    [HttpPut("settings/{key}")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> UpdateSetting(
        string key,
        [FromBody] UpdateSystemSettingRequest request,
        CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        var updated = await _systemService.UpdateSettingAsync(key, request.Value, request.Description, userId, cancellationToken);
        return Ok(updated);
    }

    [HttpPut("settings")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> BatchUpdateSettings(
        [FromBody] BatchUpdateSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        var updated = await _systemService.BatchUpdateSettingsAsync(request.Settings, userId, cancellationToken);
        return Ok(updated);
    }

    [HttpGet("backups")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> GetBackups(CancellationToken cancellationToken)
    {
        var backups = await _systemService.GetBackupsAsync(cancellationToken);
        return Ok(backups);
    }

    [HttpPost("backups")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> CreateBackup(CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        try
        {
            var backup = await _systemService.CreateBackupAsync(userId, cancellationToken);
            return Ok(backup);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create database backup.");
            return StatusCode(500, new { error = new { code = "BACKUP_FAILED", message = ex.Message } });
        }
    }

    [HttpPost("backups/{fileName}/verify")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> VerifyBackup(string fileName, CancellationToken cancellationToken)
    {
        try
        {
            var backup = await _systemService.VerifyBackupAsync(fileName, cancellationToken);
            return Ok(backup);
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = new { code = "BACKUP_FILE_NOT_FOUND", message = ex.Message } });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = new { code = "VERIFICATION_ERROR", message = ex.Message } });
        }
    }

    [HttpDelete("backups/{fileName}")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> DeleteBackup(string fileName, CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        var deleted = await _systemService.DeleteBackupAsync(fileName, userId, cancellationToken);
        if (!deleted)
        {
            return NotFound(new { error = new { code = "BACKUP_FILE_NOT_FOUND", message = $"Backup file '{fileName}' was not found." } });
        }
        return NoContent();
    }

    [HttpGet("backups/{fileName}/download")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> DownloadBackup(string fileName, CancellationToken cancellationToken)
    {
        try
        {
            var (stream, mimeType, name) = await _systemService.GetBackupStreamAsync(fileName, cancellationToken);
            return File(stream, mimeType, name);
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = new { code = "BACKUP_FILE_NOT_FOUND", message = ex.Message } });
        }
    }

    [HttpPost("backups/{fileName}/restore")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> RestoreBackup(string fileName, CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        try
        {
            var msg = await _systemService.RestoreBackupAsync(fileName, userId, cancellationToken);
            return Ok(new { message = msg });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = new { code = "BACKUP_FILE_NOT_FOUND", message = ex.Message } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to restore database from backup '{FileName}'.", fileName);
            return StatusCode(500, new { error = new { code = "RESTORE_FAILED", message = ex.Message } });
        }
    }

    [HttpGet("info")]
    public async Task<IActionResult> GetSystemInfo(CancellationToken cancellationToken)
    {
        var info = await _systemService.GetSystemInfoAsync(cancellationToken);
        return Ok(info);
    }

    [HttpPost("maintenance/vacuum")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> RunMaintenance(CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        try
        {
            var result = await _systemService.RunMaintenanceAsync(userId, cancellationToken);
            return Ok(new { message = result, executedAt = DateTime.UtcNow });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run PostgreSQL maintenance.");
            return StatusCode(500, new { error = new { code = "MAINTENANCE_ERROR", message = ex.Message } });
        }
    }

    [HttpPost("purge-clinical-data")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> PurgeClinicalData(CancellationToken cancellationToken)
    {
        var (userId, _) = GetCurrentUser();
        try
        {
            var message = await _systemService.PurgeClinicalDataAsync(userId, cancellationToken);
            return Ok(new { message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to purge clinical dummy data.");
            return StatusCode(500, new { error = new { code = "PURGE_ERROR", message = ex.Message } });
        }
    }
}
