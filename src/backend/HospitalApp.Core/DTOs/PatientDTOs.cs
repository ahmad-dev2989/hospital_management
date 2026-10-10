using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public record CreatePatientRequest(
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string Gender,
    string? BloodGroup,
    string Phone,
    string? Email,
    string? Address,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool BypassDuplicateWarning = false
);

public record UpdatePatientRequest(
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string Gender,
    string? BloodGroup,
    string Phone,
    string? Email,
    string? Address,
    string? EmergencyContactName,
    string? EmergencyContactPhone
);

public record PatientDto(
    Guid Id,
    string PatientNumber,
    string FirstName,
    string LastName,
    string FullName,
    DateTime DateOfBirth,
    int Age,
    string Gender,
    string? BloodGroup,
    string Phone,
    string? Email,
    string? Address,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool IsActive,
    int AllergiesCount,
    bool HasHighRiskAllergy,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record DuplicateMatchDto(
    Guid PatientId,
    string PatientNumber,
    string FullName,
    DateTime DateOfBirth,
    string Phone,
    string MatchReason,
    string ConfidenceScore // "High" or "Medium"
);

public record CheckDuplicateResponse(
    bool HasPotentialDuplicates,
    List<DuplicateMatchDto> Matches
);

public record AddAllergyRequest(
    string Allergen,
    string Reaction,
    AllergySeverity Severity
);

public record PatientAllergyDto(
    Guid Id,
    Guid PatientId,
    string Allergen,
    string Reaction,
    AllergySeverity Severity,
    string SeverityName,
    DateTime RecordedAt
);

public record AddConditionRequest(
    string ConditionName,
    string Status = "Active",
    DateTime? DiagnosedDate = null
);

public record PatientConditionDto(
    Guid Id,
    Guid PatientId,
    string ConditionName,
    string Status,
    DateTime? DiagnosedDate,
    DateTime CreatedAt
);

public record PatientEncounterSummaryDto(
    Guid Id,
    DateTime EncounterDate,
    string Status,
    string? ChiefComplaint,
    string DoctorName,
    string DepartmentName
);

public record PatientVitalSignSummaryDto(
    Guid Id,
    DateTime RecordedAt,
    string BloodPressure,
    int? HeartRate,
    decimal? Temperature,
    int? RespiratoryRate,
    decimal? OxygenSaturation
);

public record PatientChartDto(
    PatientDto Demographics,
    List<PatientAllergyDto> Allergies,
    List<PatientConditionDto> Conditions,
    List<PatientEncounterSummaryDto> RecentEncounters,
    List<PatientVitalSignSummaryDto> RecentVitals,
    int TotalAppointments,
    int TotalInvoices,
    decimal TotalOutstandingBalance
);

public record PagedResult<T>
{
    public int Total { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public List<T> Items { get; init; } = new();
}

