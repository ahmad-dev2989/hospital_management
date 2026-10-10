using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class InventoryBatch
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DrugId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime ExpiryDate { get; set; }
    public int QuantityReceived { get; set; }
    public int QuantityOnHand { get; set; }
    public decimal UnitCost { get; set; } = 0m;
    public decimal SellingPrice { get; set; } = 0m;
    public InventoryBatchStatus Status { get; set; } = InventoryBatchStatus.Available;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Drug Drug { get; set; } = null!;
    public ICollection<DispenseItem> DispenseItems { get; set; } = new List<DispenseItem>();
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
}
