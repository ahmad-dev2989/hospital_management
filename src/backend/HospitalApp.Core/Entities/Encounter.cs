using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class Encounter
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid? AppointmentId { get; set; }
    public Guid DoctorId { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public EncounterStatus Status { get; set; } = EncounterStatus.Open;
    public DateTime? SignedAt { get; set; }
    public Guid? SignedByDoctorId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Patient Patient { get; set; } = null!;
    public Appointment? Appointment { get; set; }
    public Doctor Doctor { get; set; } = null!;
    public Doctor? SignedByDoctor { get; set; }
    public ICollection<ClinicalNote> Notes { get; set; } = new List<ClinicalNote>();
    public ICollection<VitalSign> VitalSigns { get; set; } = new List<VitalSign>();
    public ICollection<Diagnosis> Diagnoses { get; set; } = new List<Diagnosis>();
    public ICollection<Prescription> Prescriptions { get; set; } = new List<Prescription>();
    public ICollection<LabOrder> LabOrders { get; set; } = new List<LabOrder>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<DocumentMetadata> Documents { get; set; } = new List<DocumentMetadata>();
}
