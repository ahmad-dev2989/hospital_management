namespace HospitalApp.Core.Entities;

public class LabTest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string SpecimenType { get; set; } = string.Empty;
    public string? UnitOfMeasure { get; set; }
    public string? ReferenceRange { get; set; }
    public decimal Price { get; set; } = 0m;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<LabOrderItem> LabOrderItems { get; set; } = new List<LabOrderItem>();
}
