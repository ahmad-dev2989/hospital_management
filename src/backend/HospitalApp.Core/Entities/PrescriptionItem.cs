namespace HospitalApp.Core.Entities;

public class PrescriptionItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PrescriptionId { get; set; }
    public Guid DrugId { get; set; }
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public string Route { get; set; } = "Oral";
    public int DurationDays { get; set; } = 1;
    public int QuantityPrescribed { get; set; }
    public int QuantityDispensed { get; set; } = 0;
    public string? Instructions { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Prescription Prescription { get; set; } = null!;
    public Drug Drug { get; set; } = null!;
    public ICollection<DispenseItem> DispenseItems { get; set; } = new List<DispenseItem>();
}
