namespace HospitalApp.Infrastructure.Services;

public interface IAuditService
{
    Task LogAsync(
        Guid? actorUserId,
        string actorUsername,
        string action,
        string entityName,
        string entityId,
        string? details = null,
        string ipAddress = "127.0.0.1"
    );
}
