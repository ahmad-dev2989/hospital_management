namespace HospitalApp.Infrastructure.Services;

public interface IPatientNumberGenerator
{
    Task<string> GenerateNextPatientNumberAsync(CancellationToken cancellationToken = default);
}
