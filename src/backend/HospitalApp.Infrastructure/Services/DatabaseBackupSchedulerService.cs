using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class DatabaseBackupSchedulerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DatabaseBackupSchedulerService> _logger;

    public DatabaseBackupSchedulerService(
        IServiceScopeFactory scopeFactory,
        ILogger<DatabaseBackupSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Automated 24-Hour Database Backup Worker started.");

        // Wait a few seconds after application startup to ensure migrations and seed checks finish
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            await CheckAndRunBackupAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Initial 24-hour startup backup check encountered an error.");
        }

        // Periodic check every 1 hour
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                await CheckAndRunBackupAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Periodic 24-hour backup scheduler encountered an error.");
            }
        }
    }

    private async Task CheckAndRunBackupAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var backups = await systemService.GetBackupsAsync(cancellationToken);
        var latest = backups.OrderByDescending(b => b.CreatedAt).FirstOrDefault();

        bool isOver24Hours = latest == null || (DateTime.UtcNow - latest.CreatedAt >= TimeSpan.FromHours(24));

        if (isOver24Hours)
        {
            _logger.LogInformation(
                "Triggering automated 24-hour database backup. Last backup: {LastBackupTime}",
                latest?.CreatedAt.ToString("u") ?? "None");

            var adminUser = await dbContext.UserAccounts
                .FirstOrDefaultAsync(u => u.Role == UserRole.SystemAdministrator, cancellationToken);
            var actorId = adminUser?.Id ?? Guid.Empty;

            var newBackup = await systemService.CreateBackupAsync(actorId, cancellationToken);
            _logger.LogInformation(
                "Automated 24-hour database backup '{FileName}' created successfully ({Size} bytes).",
                newBackup.FileName, newBackup.SizeBytes);
        }
    }
}
