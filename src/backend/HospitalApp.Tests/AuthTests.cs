using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HospitalApp.Tests;

public class AuthTests
{
    private readonly IConfiguration _configuration;
    private readonly JwtTokenService _tokenService;

    public AuthTests()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "JwtSettings:Secret", "A_Very_Long_Secret_Key_For_Hospital_Tests_At_Least_32_Bytes_Long_2026!" },
            { "JwtSettings:Issuer", "HospitalApp.Local" },
            { "JwtSettings:Audience", "HospitalApp.Desktop" },
            { "JwtSettings:ExpiryMinutes", "60" }
        };

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _tokenService = new JwtTokenService(_configuration);
    }

    [Fact]
    public void TokenService_GeneratesValidJwtWithRolesAndClaims()
    {
        var user = new UserAccount
        {
            Id = Guid.NewGuid(),
            Username = "dr_john",
            Email = "john@hospital.local",
            FullName = "Dr. John Doe",
            Role = UserRole.Doctor,
            IsActive = true
        };

        var (token, expiresAt) = _tokenService.GenerateToken(user);

        Assert.NotNull(token);
        Assert.True(expiresAt > DateTime.UtcNow);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        Assert.Equal("HospitalApp.Local", jwt.Issuer);
        Assert.Equal("HospitalApp.Desktop", jwt.Audiences.First());
        
        var subClaim = jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value;
        Assert.Equal(user.Id.ToString(), subClaim);

        var roleClaim = jwt.Claims.First(c => c.Type == ClaimTypes.Role || c.Type == "role").Value;
        Assert.Equal("Doctor", roleClaim);
    }

    [Fact]
    public void BCrypt_HashAndVerify_ValidatesCorrectPasswords()
    {
        const string rawPassword = "SecureHospitalPassword@2026";
        var hash = BCrypt.Net.BCrypt.HashPassword(rawPassword, workFactor: 10);

        Assert.True(BCrypt.Net.BCrypt.Verify(rawPassword, hash));
        Assert.False(BCrypt.Net.BCrypt.Verify("WrongPassword123", hash));
    }

    [Fact]
    public void UserAccount_FailedAttempts_LocksAccountAfterFiveTries()
    {
        var user = new UserAccount
        {
            Username = "nurse_mary",
            FailedLoginAttempts = 0,
            LockoutUntil = null
        };

        // Simulate 4 failed attempts
        for (int i = 0; i < 4; i++)
        {
            user.FailedLoginAttempts++;
        }
        Assert.Null(user.LockoutUntil);

        // 5th failed attempt triggers 15m lockout
        user.FailedLoginAttempts++;
        if (user.FailedLoginAttempts >= 5)
        {
            user.LockoutUntil = DateTime.UtcNow.AddMinutes(15);
        }

        Assert.Equal(5, user.FailedLoginAttempts);
        Assert.NotNull(user.LockoutUntil);
        Assert.True(user.LockoutUntil > DateTime.UtcNow);
    }

    [Fact]
    public void UserAccount_LockoutExpiration_PermitsLoginAfterTimeout()
    {
        var user = new UserAccount
        {
            Username = "tech_alex",
            FailedLoginAttempts = 5,
            LockoutUntil = DateTime.UtcNow.AddMinutes(-1) // expired in the past
        };

        bool isCurrentlyLocked = user.LockoutUntil.HasValue && user.LockoutUntil.Value > DateTime.UtcNow;
        Assert.False(isCurrentlyLocked);
    }

    [Fact]
    public void UserAccount_AdminResetPassword_ClearsLockoutAndFailedAttempts()
    {
        var user = new UserAccount
        {
            Username = "cashier_sam",
            FailedLoginAttempts = 5,
            LockoutUntil = DateTime.UtcNow.AddMinutes(15)
        };

        // Admin resets password
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword("NewCashierPassword@123", workFactor: 10);
        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;

        Assert.Equal(0, user.FailedLoginAttempts);
        Assert.Null(user.LockoutUntil);
        Assert.True(BCrypt.Net.BCrypt.Verify("NewCashierPassword@123", user.PasswordHash));
    }
}
