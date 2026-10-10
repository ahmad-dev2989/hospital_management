using System.ComponentModel.DataAnnotations;
using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public class EncounterSummaryDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public int PatientAge { get; set; }
    public string PatientGender { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public bool HasHighRiskAllergy { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public Guid? AppointmentId { get; set; }
    public string? AppointmentNumber { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public EncounterStatus Status { get; set; }
    public string StatusName => Status.ToString();
    public DateTime? SignedAt { get; set; }
    public string? SignedByDoctorName { get; set; }
    public string? ChiefComplaint { get; set; }
    public string? PrimaryDiagnosis { get; set; }
}

public class EncounterDetailDto
{
    public Guid Id { get; set; }
    public PatientDto Patient { get; set; } = null!;
    public DoctorDto Doctor { get; set; } = null!;
    public AppointmentDto? Appointment { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public EncounterStatus Status { get; set; }
    public string StatusName => Status.ToString();
    public DateTime? SignedAt { get; set; }
    public string? SignedByDoctorName { get; set; }
    public List<ClinicalNoteDto> Notes { get; set; } = new();
    public List<VitalSignDto> VitalSigns { get; set; } = new();
    public List<DiagnosisDto> Diagnoses { get; set; } = new();
    public List<PrescriptionDto> Prescriptions { get; set; } = new();
    public List<PatientAllergyDto> Allergies { get; set; } = new();
    public List<PatientConditionDto> ChronicConditions { get; set; } = new();
}

public class StartEncounterRequest
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid DoctorId { get; set; }

    public Guid? AppointmentId { get; set; }
}

public class ClinicalNoteDto
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public string ChiefComplaint { get; set; } = string.Empty;
    public string? HistoryOfPresentIllness { get; set; }
    public string? ExaminationFindings { get; set; }
    public string? Assessment { get; set; }
    public string? TreatmentPlan { get; set; }
    public int Version { get; set; } = 1;
    public bool IsFinalized { get; set; }
    public Guid? SupersedesNoteId { get; set; }
    public string? AmendmentReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SaveClinicalNoteRequest
{
    [Required]
    [StringLength(1000)]
    public string ChiefComplaint { get; set; } = string.Empty;

    public string? HistoryOfPresentIllness { get; set; }
    public string? ExaminationFindings { get; set; }
    public string? Assessment { get; set; }
    public string? TreatmentPlan { get; set; }
}

public class AddAddendumRequest
{
    [Required]
    public Guid OriginalNoteId { get; set; }

    [Required]
    [MinLength(5, ErrorMessage = "A detailed amendment reason is mandatory.")]
    public string AmendmentReason { get; set; } = string.Empty;

    [Required]
    public string ChiefComplaint { get; set; } = string.Empty;

    public string? HistoryOfPresentIllness { get; set; }
    public string? ExaminationFindings { get; set; }
    public string? Assessment { get; set; }
    public string? TreatmentPlan { get; set; }
}

public class VitalSignDto
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public Guid RecordedByUserId { get; set; }
    public string RecordedByName { get; set; } = string.Empty;
    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public int? HeartRateBpm { get; set; }
    public int? RespiratoryRateBpm { get; set; }
    public decimal? TemperatureCelsius { get; set; }
    public decimal? OxygenSaturationPct { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal? Bmi { get; set; }
    public List<string> AbnormalAlerts { get; set; } = new();
    public DateTime RecordedAt { get; set; }
}

public class RecordVitalSignsRequest
{
    [Range(40, 300, ErrorMessage = "Systolic BP must be between 40 and 300 mmHg")]
    public int? SystolicBp { get; set; }

    [Range(20, 200, ErrorMessage = "Diastolic BP must be between 20 and 200 mmHg")]
    public int? DiastolicBp { get; set; }

    [Range(20, 250, ErrorMessage = "Heart Rate must be between 20 and 250 bpm")]
    public int? HeartRateBpm { get; set; }

    [Range(4, 60, ErrorMessage = "Respiratory Rate must be between 4 and 60 breaths/min")]
    public int? RespiratoryRateBpm { get; set; }

    [Range(30.0, 45.0, ErrorMessage = "Temperature must be between 30.0 and 45.0 °C")]
    public decimal? TemperatureCelsius { get; set; }

    [Range(50.0, 100.0, ErrorMessage = "Oxygen Saturation must be between 50 and 100%")]
    public decimal? OxygenSaturationPct { get; set; }

    [Range(1.0, 500.0, ErrorMessage = "Weight must be between 1.0 and 500.0 kg")]
    public decimal? WeightKg { get; set; }

    [Range(30.0, 250.0, ErrorMessage = "Height must be between 30.0 and 250.0 cm")]
    public decimal? HeightCm { get; set; }
}

public class DiagnosisDto
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public string? Icd10Code { get; set; }
    public string Description { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public DateTime RecordedAt { get; set; }
}

public class AddDiagnosisRequest
{
    [StringLength(20)]
    public string? Icd10Code { get; set; }

    [Required]
    [StringLength(500)]
    public string Description { get; set; } = string.Empty;

    public bool IsPrimary { get; set; }
}

public class PrescriptionDto
{
    public Guid Id { get; set; }
    public string PrescriptionNumber { get; set; } = string.Empty;
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public DateTime SignedAt { get; set; }
    public PrescriptionStatus Status { get; set; }
    public string StatusName => Status.ToString();
    public List<PrescriptionItemDto> Items { get; set; } = new();
}

public class PrescriptionItemDto
{
    public Guid Id { get; set; }
    public Guid DrugId { get; set; }
    public string DrugName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public string Route { get; set; } = "Oral";
    public int DurationDays { get; set; }
    public int QuantityPrescribed { get; set; }
    public string? Instructions { get; set; }
}

public class CreatePrescriptionRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "Prescription must contain at least one medication.")]
    public List<CreatePrescriptionItemRequest> Items { get; set; } = new();
}

public class CreatePrescriptionItemRequest
{
    [Required]
    public Guid DrugId { get; set; }

    [Required]
    public string Dosage { get; set; } = string.Empty;

    [Required]
    public string Frequency { get; set; } = string.Empty;

    public string Route { get; set; } = "Oral";

    [Range(1, 365)]
    public int DurationDays { get; set; } = 7;

    [Range(1, 1000)]
    public int QuantityPrescribed { get; set; } = 1;

    public string? Instructions { get; set; }
}

public class Icd10LookupDto
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}
