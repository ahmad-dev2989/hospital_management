using System.ComponentModel.DataAnnotations;
using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public class EncounterDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public int PatientAge { get; set; }
    public string PatientGender { get; set; } = string.Empty;
    public string? PatientBloodGroup { get; set; }
    public bool PatientHasHighRiskAllergy { get; set; }
    public List<string> PatientAllergies { get; set; } = new();

    public Guid? AppointmentId { get; set; }
    public string? AppointmentNumber { get; set; }

    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;

    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public EncounterStatus Status { get; set; }
    public string StatusName => Status.ToString();

    public DateTime? SignedAt { get; set; }
    public Guid? SignedByDoctorId { get; set; }
    public string? SignedByDoctorName { get; set; }

    public List<ClinicalNoteDto> Notes { get; set; } = new();
    public List<VitalSignDto> VitalSigns { get; set; } = new();
    public List<DiagnosisDto> Diagnoses { get; set; } = new();
    public List<PrescriptionDto> Prescriptions { get; set; } = new();

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class StartEncounterRequest
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid DoctorId { get; set; }

    public Guid? AppointmentId { get; set; }

    [StringLength(500)]
    public string? ChiefComplaint { get; set; }
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
    public string ChiefComplaint { get; set; } = string.Empty;

    public string? HistoryOfPresentIllness { get; set; }
    public string? ExaminationFindings { get; set; }
    public string? Assessment { get; set; }
    public string? TreatmentPlan { get; set; }
}

public class AddNoteAddendumRequest
{
    [Required]
    public Guid SupersedesNoteId { get; set; }

    [Required]
    [MinLength(5, ErrorMessage = "A descriptive amendment reason is mandatory.")]
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
    public string RecordedByUserName { get; set; } = string.Empty;

    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public int? HeartRateBpm { get; set; }
    public int? RespiratoryRateBpm { get; set; }
    public decimal? TemperatureCelsius { get; set; }
    public decimal? OxygenSaturationPct { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }

    // Evaluated Clinical Statuses
    public string? BpCategory { get; set; }
    public decimal? Bmi { get; set; }
    public string? BmiCategory { get; set; }
    public bool IsAbnormal { get; set; }
    public List<string> AbnormalAlerts { get; set; } = new();

    public DateTime RecordedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RecordVitalSignsRequest
{
    [Range(40, 300, ErrorMessage = "Systolic BP must be between 40 and 300 mmHg")]
    public int? SystolicBp { get; set; }

    [Range(20, 200, ErrorMessage = "Diastolic BP must be between 20 and 200 mmHg")]
    public int? DiastolicBp { get; set; }

    [Range(20, 250, ErrorMessage = "Heart rate must be between 20 and 250 bpm")]
    public int? HeartRateBpm { get; set; }

    [Range(4, 80, ErrorMessage = "Respiratory rate must be between 4 and 80 bpm")]
    public int? RespiratoryRateBpm { get; set; }

    [Range(30.0, 45.0, ErrorMessage = "Temperature must be between 30.0 and 45.0 °C")]
    public decimal? TemperatureCelsius { get; set; }

    [Range(50.0, 100.0, ErrorMessage = "Oxygen saturation must be between 50 and 100 %")]
    public decimal? OxygenSaturationPct { get; set; }

    [Range(0.5, 500.0, ErrorMessage = "Weight must be between 0.5 and 500 kg")]
    public decimal? WeightKg { get; set; }

    [Range(20.0, 300.0, ErrorMessage = "Height must be between 20 and 300 cm")]
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
    public string? Icd10Code { get; set; }

    [Required]
    [MinLength(2)]
    public string Description { get; set; } = string.Empty;

    public bool IsPrimary { get; set; } = false;
}

public class PrescriptionDto
{
    public Guid Id { get; set; }
    public string PrescriptionNumber { get; set; } = string.Empty;
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public DateTime SignedAt { get; set; }
    public PrescriptionStatus Status { get; set; }
    public string StatusName => Status.ToString();
    public List<PrescriptionItemDto> Items { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class PrescriptionItemDto
{
    public Guid Id { get; set; }
    public Guid PrescriptionId { get; set; }
    public Guid DrugId { get; set; }
    public string DrugName { get; set; } = string.Empty;
    public string DrugCode { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public string Route { get; set; } = "Oral";
    public int DurationDays { get; set; } = 1;
    public int QuantityPrescribed { get; set; }
    public int QuantityDispensed { get; set; }
    public string? Instructions { get; set; }
}

public class CreatePrescriptionRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "At least one medication item is required.")]
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

public class Icd10CatalogItemDto
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}
