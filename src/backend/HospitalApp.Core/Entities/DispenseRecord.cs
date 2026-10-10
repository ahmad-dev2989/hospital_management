namespace HospitalApp.Core.Entities;

public class DispenseRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PrescriptionId { get; set; }
    public Guid PharmacistUserId { get; set; }
    public DateTime DispensedAt { get; set; } = DateTime.UtcNow;
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Prescription Prescription { get; set; } = null!;
    public UserAccount PharmacistUser { get; set; } = null!;
    public ICollection<DispenseItem> Items { get; set; } = new List<DispenseItem>();
}
