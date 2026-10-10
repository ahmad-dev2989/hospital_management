using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class Prescription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string PrescriptionNumber { get; set; } = string.Empty;
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public DateTime SignedAt { get; set; } = DateTime.UtcNow;
    public PrescriptionStatus Status { get; set; } = PrescriptionStatus.Signed;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Encounter Encounter { get; set; } = null!;
    public Patient Patient { get; set; } = null!;
    public Doctor Doctor { get; set; } = null!;
    public ICollection<PrescriptionItem> Items { get; set; } = new List<PrescriptionItem>();
    public ICollection<DispenseRecord> DispenseRecords { get; set; } = new List<DispenseRecord>();
}
