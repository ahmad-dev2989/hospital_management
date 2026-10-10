using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;

namespace HospitalApp.Infrastructure.Services;

public interface IClinicalService
{
    Task<PagedResult<EncounterDto>> GetEncountersAsync(
        DateTime? date = null,
        Guid? doctorId = null,
        Guid? patientId = null,
        EncounterStatus? status = null,
        string? query = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);

    Task<EncounterDto?> GetEncounterByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<EncounterDto> StartEncounterAsync(
        StartEncounterRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<ClinicalNoteDto> SaveClinicalNoteAsync(
        Guid encounterId,
        SaveClinicalNoteRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<ClinicalNoteDto> AddNoteAddendumAsync(
        Guid encounterId,
        AddNoteAddendumRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<VitalSignDto> RecordVitalSignsAsync(
        Guid encounterId,
        RecordVitalSignsRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<DiagnosisDto> AddDiagnosisAsync(
        Guid encounterId,
        AddDiagnosisRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<bool> RemoveDiagnosisAsync(
        Guid encounterId,
        Guid diagnosisId,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<PrescriptionDto> CreatePrescriptionAsync(
        Guid encounterId,
        CreatePrescriptionRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<EncounterDto> SignAndCloseEncounterAsync(
        Guid encounterId,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<List<Icd10CatalogItemDto>> GetStandardIcd10CatalogAsync(string? search = null);

    Task<List<Drug>> GetFormularyDrugsAsync(CancellationToken cancellationToken = default);
}
