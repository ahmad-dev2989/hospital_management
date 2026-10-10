using HospitalApp.Core.Entities;
using HospitalApp.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class AuditService : IAuditService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<AuditService> _logger;

    public AuditService(ApplicationDbContext dbContext, ILogger<AuditService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task LogAsync(
        Guid? actorUserId,
        string actorUsername,
        string action,
        string entityName,
        string entityId,
        string? details = null,
        string ipAddress = "127.0.0.1")
    {
        try
        {
            var auditEvent = new AuditEvent
            {
                Id = Guid.NewGuid(),
                ActorUserId = actorUserId,
                ActorUsername = string.IsNullOrWhiteSpace(actorUsername) ? "System" : actorUsername,
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                Details = details,
                IpAddress = ipAddress,
                Timestamp = DateTime.UtcNow
            };

            _dbContext.AuditEvents.Add(auditEvent);
            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Never crash the primary workflow if an audit log fails, but log with Critical priority
            _logger.LogCritical(ex, "Failed to persist audit event for Action: {Action}, Entity: {EntityName}", action, entityName);
        }
    }
}
