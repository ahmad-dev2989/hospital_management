using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class StockMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InventoryBatchId { get; set; }
    public StockMovementType MovementType { get; set; }
    public int QuantityDelta { get; set; }
    public int BalanceAfter { get; set; }
    public string ReferenceId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public Guid PerformedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public InventoryBatch InventoryBatch { get; set; } = null!;
    public UserAccount PerformedByUser { get; set; } = null!;
}
