namespace HospitalApp.Core.Entities;

public class PatientCondition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public string ConditionName { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public DateTime? DiagnosedDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Patient Patient { get; set; } = null!;
}
