using HospitalApp.Core.Entities;

namespace HospitalApp.Infrastructure.Services;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) GenerateToken(UserAccount user);
}
