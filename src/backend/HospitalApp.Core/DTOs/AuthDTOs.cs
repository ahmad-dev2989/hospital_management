using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public record LoginRequest(string Username, string Password);

public record LoginResponse(
    string Token,
    DateTime ExpiresAt,
    UserDto User
);

public record UserDto(
    Guid Id,
    string Username,
    string Email,
    string FullName,
    UserRole Role,
    string RoleName,
    bool IsActive,
    DateTime? LastLoginAt,
    DateTime CreatedAt
);

public record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword
);

public record AdminResetPasswordRequest(
    string NewPassword
);

public record CreateUserRequest(
    string Username,
    string Email,
    string FullName,
    string Password,
    UserRole Role
);

public record UpdateUserRequest(
    string Email,
    string FullName,
    UserRole Role,
    bool IsActive
);

public record AuditEventDto(
    Guid Id,
    Guid? ActorUserId,
    string ActorUsername,
    string Action,
    string EntityName,
    string EntityId,
    string? Details,
    string IpAddress,
    DateTime Timestamp
);
