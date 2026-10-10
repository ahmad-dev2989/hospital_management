using HospitalApp.Core.DTOs;
using HospitalApp.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Route("api/v1/audit-events")]
[Authorize(Roles = "SystemAdministrator,Auditor")]
public class AuditController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;

    public AuditController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? action,
        [FromQuery] string? entityName,
        [FromQuery] string? actorUsername,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _dbContext.AuditEvents.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(action))
        {
            var a = action.Trim().ToLower();
            query = query.Where(x => x.Action.ToLower().Contains(a));
        }

        if (!string.IsNullOrWhiteSpace(entityName))
        {
            var e = entityName.Trim().ToLower();
            query = query.Where(x => x.EntityName.ToLower().Contains(e));
        }

        if (!string.IsNullOrWhiteSpace(actorUsername))
        {
            var u = actorUsername.Trim().ToLower();
            query = query.Where(x => x.ActorUsername.ToLower().Contains(u));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(x => x.Timestamp >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(x => x.Timestamp <= toDate.Value);
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(x => x.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new AuditEventDto(
                x.Id,
                x.ActorUserId,
                x.ActorUsername,
                x.Action,
                x.EntityName,
                x.EntityId,
                x.Details,
                x.IpAddress,
                x.Timestamp
            ))
            .ToListAsync();

        return Ok(new
        {
            total,
            page,
            pageSize,
            items
        });
    }
}
