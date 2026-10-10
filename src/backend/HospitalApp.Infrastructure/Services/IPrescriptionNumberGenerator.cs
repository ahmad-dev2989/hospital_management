namespace HospitalApp.Infrastructure.Services;

public interface IPrescriptionNumberGenerator
{
    Task<string> GenerateNextPrescriptionNumberAsync(CancellationToken cancellationToken = default);
}
