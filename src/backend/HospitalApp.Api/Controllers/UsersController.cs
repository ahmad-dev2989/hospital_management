using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize(Roles = "SystemAdministrator,HospitalAdministrator")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IAuditService _auditService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        ApplicationDbContext dbContext,
        IAuditService auditService,
        ILogger<UsersController> logger)
    {
        _dbContext = dbContext;
        _auditService = auditService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] UserRole? role,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _dbContext.UserAccounts.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u => u.Username.ToLower().Contains(s) || 
                                     u.FullName.ToLower().Contains(s) || 
                                     u.Email.ToLower().Contains(s));
        }

        if (role.HasValue)
        {
            query = query.Where(u => u.Role == role.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto(
                u.Id,
                u.Username,
                u.Email,
                u.FullName,
                u.Role,
                u.Role.ToString(),
                u.IsActive,
                u.LastLoginAt,
                u.CreatedAt
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

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetUserById(Guid id)
    {
        var user = await _dbContext.UserAccounts.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        if (user == null)
        {
            return NotFound(new { error = new { code = "USER_NOT_FOUND", message = "Staff user not found." } });
        }

        return Ok(new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            user.Role.ToString(),
            user.IsActive,
            user.LastLoginAt,
            user.CreatedAt
        ));
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || 
            string.IsNullOrWhiteSpace(request.Email) || 
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = new { code = "INVALID_FIELDS", message = "Username, email, and password are required." } });
        }

        var normalizedUsername = request.Username.Trim().ToLower();
        if (await _dbContext.UserAccounts.AnyAsync(u => u.Username.ToLower() == normalizedUsername))
        {
            return Conflict(new { error = new { code = "USERNAME_EXISTS", message = "A user account with this username already exists." } });
        }

        var normalizedEmail = request.Email.Trim().ToLower();
        if (await _dbContext.UserAccounts.AnyAsync(u => u.Email.ToLower() == normalizedEmail))
        {
            return Conflict(new { error = new { code = "EMAIL_EXISTS", message = "A user account with this email already exists." } });
        }

        var user = new UserAccount
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = request.Email.Trim(),
            FullName = request.FullName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 11),
            Role = request.Role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.UserAccounts.Add(user);
        await _dbContext.SaveChangesAsync();

        if (user.Role == UserRole.Doctor)
        {
            var defaultDept = await _dbContext.Departments.FirstOrDefaultAsync() 
                ?? new Department { Id = Guid.NewGuid(), Code = "GEN", Name = "General Medicine", IsActive = true };

            var doc = new Doctor
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                DepartmentId = defaultDept.Id,
                LicenseNumber = $"DOC-{user.Username.ToUpper()}",
                Specialization = "General Physician",
                ConsultationFee = 50.00m,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.Doctors.Add(doc);

            for (int day = 0; day <= 6; day++)
            {
                _dbContext.DoctorSchedules.Add(new DoctorSchedule
                {
                    Id = Guid.NewGuid(),
                    DoctorId = doc.Id,
                    DayOfWeek = day,
                    StartTime = TimeSpan.FromHours(9),
                    EndTime = TimeSpan.FromHours(17),
                    SlotDurationMinutes = 15,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            await _dbContext.SaveChangesAsync();
        }

        var actorId = GetCurrentUserId();
        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        await _auditService.LogAsync(
            actorId,
            actorName,
            "User.Created",
            "UserAccount",
            user.Id.ToString(),
            $"Created staff user {user.Username} with role {user.Role}",
            ip
        );

        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            user.Role.ToString(),
            user.IsActive,
            user.LastLoginAt,
            user.CreatedAt
        ));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await _dbContext.UserAccounts.FindAsync(id);
        if (user == null)
        {
            return NotFound();
        }

        var oldRole = user.Role;
        var oldActive = user.IsActive;

        user.Email = request.Email.Trim();
        user.FullName = request.FullName.Trim();
        user.Role = request.Role;
        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        var actorId = GetCurrentUserId();
        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        await _auditService.LogAsync(
            actorId,
            actorName,
            "User.Updated",
            "UserAccount",
            user.Id.ToString(),
            $"Updated user {user.Username}. Role: {oldRole}->{user.Role}, Active: {oldActive}->{user.IsActive}",
            ip
        );

        return Ok(new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            user.Role.ToString(),
            user.IsActive,
            user.LastLoginAt,
            user.CreatedAt
        ));
    }

    [HttpPost("{id:guid}/reset-password")]
    [Authorize(Roles = "SystemAdministrator")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] AdminResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { error = new { code = "WEAK_PASSWORD", message = "Password must be at least 6 characters long." } });
        }

        var user = await _dbContext.UserAccounts.FindAsync(id);
        if (user == null)
        {
            return NotFound();
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 11);
        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        var actorId = GetCurrentUserId();
        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        await _auditService.LogAsync(
            actorId,
            actorName,
            "User.PasswordResetByAdmin",
            "UserAccount",
            user.Id.ToString(),
            $"Administrator reset password for user {user.Username}",
            ip
        );

        return Ok(new { message = $"Password for {user.Username} has been reset successfully." });
    }

    [HttpPost("{id:guid}/toggle-active")]
    [Authorize(Roles = "SystemAdministrator")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId.HasValue && currentUserId.Value == id)
        {
            return BadRequest(new { error = new { code = "SELF_DEACTIVATION_PROHIBITED", message = "You cannot deactivate your own active account." } });
        }

        var user = await _dbContext.UserAccounts.FindAsync(id);
        if (user == null)
        {
            return NotFound();
        }

        user.IsActive = !user.IsActive;
        user.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        await _auditService.LogAsync(
            currentUserId,
            actorName,
            user.IsActive ? "User.Activated" : "User.Deactivated",
            "UserAccount",
            user.Id.ToString(),
            $"Status changed to {(user.IsActive ? "Active" : "Inactive")}",
            ip
        );

        return Ok(new { isActive = user.IsActive, message = $"User {user.Username} is now {(user.IsActive ? "Active" : "Deactivated")}." });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "SystemAdministrator")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId.HasValue && currentUserId.Value == id)
        {
            return BadRequest(new { error = new { code = "SELF_DELETION_PROHIBITED", message = "You cannot delete your own active administrator account." } });
        }

        var user = await _dbContext.UserAccounts.FindAsync(id);
        if (user == null)
        {
            return NotFound();
        }

        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Admin";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        _dbContext.UserAccounts.Remove(user);
        await _dbContext.SaveChangesAsync();

        await _auditService.LogAsync(
            currentUserId,
            actorName,
            "User.Deleted",
            "UserAccount",
            id.ToString(),
            $"Permanently deleted user {user.Username} ({user.FullName})",
            ip
        );

        return NoContent();
    }

    private Guid? GetCurrentUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}
