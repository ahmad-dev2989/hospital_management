using HospitalApp.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class HealthController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<HealthController> _logger;

    public HealthController(ApplicationDbContext dbContext, ILogger<HealthController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            status = "Healthy",
            service = "HospitalApp.Backend",
            version = "1.0.0",
            mode = "Offline-Desktop",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("db")]
    public async Task<IActionResult> GetDatabaseStatus()
    {
        try
        {
            var canConnect = await _dbContext.Database.CanConnectAsync();
            if (!canConnect)
            {
                return StatusCode(503, new
                {
                    status = "Unhealthy",
                    database = "PostgreSQL",
                    connected = false,
                    message = "Cannot connect to local PostgreSQL instance."
                });
            }

            var userCount = await _dbContext.UserAccounts.CountAsync();
            var departmentCount = await _dbContext.Departments.CountAsync();
            var patientCount = await _dbContext.Patients.CountAsync();

            return Ok(new
            {
                status = "Healthy",
                database = "PostgreSQL",
                connected = true,
                stats = new
                {
                    users = userCount,
                    departments = departmentCount,
                    patients = patientCount
                },
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database health check failed");
            return StatusCode(500, new
            {
                status = "Error",
                database = "PostgreSQL",
                connected = false,
                error = ex.Message
            });
        }
    }
}
