namespace HospitalApp.Core.Entities;

public class DispenseItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DispenseRecordId { get; set; }
    public Guid PrescriptionItemId { get; set; }
    public Guid InventoryBatchId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPriceSnapshot { get; set; } = 0m;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DispenseRecord DispenseRecord { get; set; } = null!;
    public PrescriptionItem PrescriptionItem { get; set; } = null!;
    public InventoryBatch InventoryBatch { get; set; } = null!;
}
