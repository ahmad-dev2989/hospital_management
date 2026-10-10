using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ITokenService _tokenService;
    private readonly IAuditService _auditService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ApplicationDbContext dbContext,
        ITokenService tokenService,
        IAuditService auditService,
        ILogger<AuthController> logger)
    {
        _dbContext = dbContext;
        _tokenService = tokenService;
        _auditService = auditService;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = new { code = "INVALID_REQUEST", message = "Username and password are required." } });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var user = await _dbContext.UserAccounts
            .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.Trim().ToLower());

        // Generic error on missing user to prevent enumeration
        if (user == null)
        {
            await _auditService.LogAsync(null, request.Username, "Auth.LoginFailed", "UserAccount", "Unknown", "User not found", ip);
            return Unauthorized(new { error = new { code = "INVALID_CREDENTIALS", message = "Invalid username or password." } });
        }

        // Check account activation
        if (!user.IsActive)
        {
            await _auditService.LogAsync(user.Id, user.Username, "Auth.LoginDeactivated", "UserAccount", user.Id.ToString(), "Deactivated account login attempt", ip);
            return StatusCode(403, new { error = new { code = "ACCOUNT_DEACTIVATED", message = "This staff account has been deactivated. Contact the administrator." } });
        }

        // Check failed attempts lockout
        if (user.LockoutUntil.HasValue && user.LockoutUntil.Value > DateTime.UtcNow)
        {
            var remaining = Math.Ceiling((user.LockoutUntil.Value - DateTime.UtcNow).TotalMinutes);
            await _auditService.LogAsync(user.Id, user.Username, "Auth.LoginLocked", "UserAccount", user.Id.ToString(), $"Account locked. Remaining: {remaining}m", ip);
            return StatusCode(423, new { error = new { code = "ACCOUNT_LOCKED", message = $"Account is temporarily locked due to excessive failed attempts. Try again in {remaining} minutes." } });
        }

        // Verify password with BCrypt
        bool passwordMatches = false;
        try
        {
            passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying password hash for user {Username}", user.Username);
        }

        if (!passwordMatches)
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockoutUntil = DateTime.UtcNow.AddMinutes(15);
                await _auditService.LogAsync(user.Id, user.Username, "Auth.AccountLocked", "UserAccount", user.Id.ToString(), "Account locked for 15 minutes after 5 failed attempts", ip);
            }
            else
            {
                await _auditService.LogAsync(user.Id, user.Username, "Auth.LoginFailed", "UserAccount", user.Id.ToString(), $"Incorrect password attempt ({user.FailedLoginAttempts}/5)", ip);
            }

            user.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();

            return Unauthorized(new { error = new { code = "INVALID_CREDENTIALS", message = "Invalid username or password." } });
        }

        // Success: Reset lockout & record login
        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;
        user.LastLoginAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        await _auditService.LogAsync(user.Id, user.Username, "Auth.LoginSuccess", "UserAccount", user.Id.ToString(), "Successful authentication", ip);

        var (token, expiresAt) = _tokenService.GenerateToken(user);

        var userDto = new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            user.Role.ToString(),
            user.IsActive,
            user.LastLoginAt,
            user.CreatedAt
        );

        return Ok(new LoginResponse(token, expiresAt, userDto));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var user = await _dbContext.UserAccounts.FindAsync(userId);
        if (user == null || !user.IsActive)
        {
            return Unauthorized();
        }

        var userDto = new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.Role,
            user.Role.ToString(),
            user.IsActive,
            user.LastLoginAt,
            user.CreatedAt
        );

        return Ok(userDto);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized();
        }

        var user = await _dbContext.UserAccounts.FindAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { error = new { code = "INVALID_PASSWORD", message = "Current password does not match." } });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { error = new { code = "WEAK_PASSWORD", message = "New password must be at least 6 characters long." } });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 11);
        user.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        await _auditService.LogAsync(user.Id, user.Username, "Auth.PasswordChanged", "UserAccount", user.Id.ToString(), "User changed own password", ip);

        return Ok(new { message = "Password changed successfully." });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var username = User.FindFirstValue(ClaimTypes.Name) ?? "User";
        Guid.TryParse(userIdStr, out var userId);

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        await _auditService.LogAsync(userId, username, "Auth.Logout", "UserAccount", userIdStr ?? "", "User signed out", ip);

        return Ok(new { message = "Logged out successfully." });
    }
}
