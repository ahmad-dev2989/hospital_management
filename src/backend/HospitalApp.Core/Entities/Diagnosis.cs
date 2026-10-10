namespace HospitalApp.Core.Entities;

public class Diagnosis
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public string? Icd10Code { get; set; }
    public string Description { get; set; } = string.Empty;
    public bool IsPrimary { get; set; } = false;
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Encounter Encounter { get; set; } = null!;
    public Patient Patient { get; set; } = null!;
}
