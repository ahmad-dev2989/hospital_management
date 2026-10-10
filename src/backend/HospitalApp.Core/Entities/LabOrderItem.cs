namespace HospitalApp.Core.Entities;

public class LabOrderItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LabOrderId { get; set; }
    public Guid LabTestId { get; set; }
    public string? SpecimenBarcode { get; set; }
    public DateTime? SpecimenCollectedAt { get; set; }
    public string? ResultValue { get; set; }
    public string? ResultUnit { get; set; }
    public string? ReferenceRangeSnapshot { get; set; }
    public bool IsAbnormal { get; set; } = false;
    public string? Comments { get; set; }
    public Guid? EnteredByUserId { get; set; }
    public Guid? VerifiedByUserId { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public LabOrder LabOrder { get; set; } = null!;
    public LabTest LabTest { get; set; } = null!;
    public UserAccount? EnteredByUser { get; set; }
    public UserAccount? VerifiedByUser { get; set; }
}
