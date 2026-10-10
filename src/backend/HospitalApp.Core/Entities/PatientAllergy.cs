using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class PatientAllergy
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public string Allergen { get; set; } = string.Empty;
    public string Reaction { get; set; } = string.Empty;
    public AllergySeverity Severity { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Patient Patient { get; set; } = null!;
}
