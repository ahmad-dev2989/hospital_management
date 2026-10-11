using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HospitalApp.Infrastructure.Services;

public class JwtTokenService : ITokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string Token, DateTime ExpiresAt) GenerateToken(UserAccount user)
    {
        var secretKey = _configuration["JwtSettings:Secret"] 
            ?? "HospitalManagementSystemSecureSecretKey2026!#$LocalOffline789456123";
        var issuer = _configuration["JwtSettings:Issuer"] ?? "HospitalApp.Local";
        var audience = _configuration["JwtSettings:Audience"] ?? "HospitalApp.Desktop";
        var expiryMinutes = int.TryParse(_configuration["JwtSettings:ExpiryMinutes"], out var exp) ? exp : 480;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Name, user.Username),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("FullName", user.FullName),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("RoleInt", ((int)user.Role).ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        // If user is administrator, grant full universal privileges across all hospital workstations
        if (user.Role == UserRole.SystemAdministrator || user.Role == UserRole.HospitalAdministrator)
        {
            claims.Add(new Claim(ClaimTypes.Role, "Admin"));
            claims.Add(new Claim(ClaimTypes.Role, "Doctor"));
            claims.Add(new Claim(ClaimTypes.Role, "Nurse"));
            claims.Add(new Claim(ClaimTypes.Role, "Receptionist"));
            claims.Add(new Claim(ClaimTypes.Role, "LabTechnician"));
            claims.Add(new Claim(ClaimTypes.Role, "Pharmacist"));
            claims.Add(new Claim(ClaimTypes.Role, "Cashier"));
            claims.Add(new Claim(ClaimTypes.Role, "Auditor"));
        }

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = credentials
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var securityToken = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(securityToken);

        return (tokenString, expiresAt);
    }
}
