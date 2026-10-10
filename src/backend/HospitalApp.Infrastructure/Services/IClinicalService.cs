using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;

namespace HospitalApp.Infrastructure.Services;

public interface IClinicalService
{
    Task<PagedResult<EncounterSummaryDto>> GetEncountersAsync(
        Guid? patientId = null,
        Guid? doctorId = null,
        EncounterStatus? status = null,
        DateTime? date = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);

    Task<EncounterDetailDto?> GetEncounterByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<EncounterDetailDto> StartEncounterAsync(
        StartEncounterRequest request,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<VitalSignDto> RecordVitalSignsAsync(
        Guid encounterId,
        RecordVitalSignsRequest request,
        Guid recordedByUserId,
        string recordedByName,
        CancellationToken cancellationToken = default);

    Task<ClinicalNoteDto> SaveClinicalNoteDraftAsync(
        Guid encounterId,
        SaveClinicalNoteRequest request,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<EncounterDetailDto> SignEncounterAsync(
        Guid encounterId,
        Guid signingDoctorId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<ClinicalNoteDto> AddNoteAddendumAsync(
        Guid encounterId,
        AddAddendumRequest request,
        Guid doctorId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<DiagnosisDto> AddDiagnosisAsync(
        Guid encounterId,
        AddDiagnosisRequest request,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<bool> RemoveDiagnosisAsync(
        Guid encounterId,
        Guid diagnosisId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<PrescriptionDto> CreatePrescriptionAsync(
        Guid encounterId,
        CreatePrescriptionRequest request,
        Guid doctorId,
        string currentUserName,
        CancellationToken cancellationToken = default);

    Task<List<Icd10LookupDto>> GetIcd10CatalogAsync(
        string? query = null,
        CancellationToken cancellationToken = default);

    Task<List<Drug>> GetEssentialDrugsAsync(
        string? query = null,
        CancellationToken cancellationToken = default);
}
