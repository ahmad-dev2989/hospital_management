namespace HospitalApp.Infrastructure.Services;

public interface IAppointmentNumberGenerator
{
    Task<string> GenerateNextAppointmentNumberAsync(CancellationToken cancellationToken = default);
}
