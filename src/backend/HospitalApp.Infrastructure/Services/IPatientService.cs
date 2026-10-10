using HospitalApp.Core.DTOs;

namespace HospitalApp.Infrastructure.Services;

public interface IPatientService
{
    Task<CheckDuplicateResponse> CheckDuplicatesAsync(CreatePatientRequest request, CancellationToken cancellationToken = default);
    
    Task<PatientDto> CreatePatientAsync(CreatePatientRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
    
    Task<PatientDto?> GetPatientByIdAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<PatientDto?> UpdatePatientAsync(Guid id, UpdatePatientRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
    
    Task<bool> TogglePatientStatusAsync(Guid id, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
    
    Task<PagedResult<PatientDto>> SearchPatientsAsync(string? query, string? gender, bool? isActive, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    
    Task<PatientChartDto?> GetPatientChartAsync(Guid id, CancellationToken cancellationToken = default);
    
    Task<PatientAllergyDto> AddAllergyAsync(Guid patientId, AddAllergyRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
    
    Task<bool> RemoveAllergyAsync(Guid patientId, Guid allergyId, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
    
    Task<PatientConditionDto> AddConditionAsync(Guid patientId, AddConditionRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
    
    Task<bool> RemoveConditionAsync(Guid patientId, Guid conditionId, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default);
}
