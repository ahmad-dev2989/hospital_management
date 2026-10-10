using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class LabOrder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OrderNumber { get; set; } = string.Empty;
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public Guid OrderedByDoctorId { get; set; }
    public LabPriority Priority { get; set; } = LabPriority.Routine;
    public LabOrderStatus Status { get; set; } = LabOrderStatus.Ordered;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Encounter Encounter { get; set; } = null!;
    public Patient Patient { get; set; } = null!;
    public Doctor OrderedByDoctor { get; set; } = null!;
    public ICollection<LabOrderItem> Items { get; set; } = new List<LabOrderItem>();
}
