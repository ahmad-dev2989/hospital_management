using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public class PharmacyDrugDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string BrandName { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string DosageForm { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty;
    public int ReorderLevel { get; set; }
    public int TotalStockOnHand { get; set; }
    public bool IsLowStock { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<InventoryBatchDto> Batches { get; set; } = new();
}

public class CreateDrugRequest
{
    public string Code { get; set; } = string.Empty;
    public string BrandName { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string DosageForm { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty;
    public int ReorderLevel { get; set; } = 10;
}

public class UpdateDrugRequest
{
    public string BrandName { get; set; } = string.Empty;
    public string GenericName { get; set; } = string.Empty;
    public string DosageForm { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty;
    public int ReorderLevel { get; set; }
    public bool IsActive { get; set; } = true;
}

public class InventoryBatchDto
{
    public Guid Id { get; set; }
    public Guid DrugId { get; set; }
    public string DrugCode { get; set; } = string.Empty;
    public string DrugName { get; set; } = string.Empty;
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime ExpiryDate { get; set; }
    public int QuantityReceived { get; set; }
    public int QuantityOnHand { get; set; }
    public decimal UnitCost { get; set; }
    public decimal SellingPrice { get; set; }
    public InventoryBatchStatus Status { get; set; }
    public bool IsExpired { get; set; }
    public int DaysUntilExpiry { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ReceiveBatchRequest
{
    public Guid DrugId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime ExpiryDate { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal SellingPrice { get; set; }
}

public class AdjustStockRequest
{
    public Guid BatchId { get; set; }
    public StockMovementType MovementType { get; set; }
    public int QuantityDelta { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class StockMovementDto
{
    public Guid Id { get; set; }
    public Guid InventoryBatchId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public string DrugName { get; set; } = string.Empty;
    public StockMovementType MovementType { get; set; }
    public int QuantityDelta { get; set; }
    public int BalanceAfter { get; set; }
    public string ReferenceId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public Guid PerformedByUserId { get; set; }
    public string PerformedByUserName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class PrescriptionQueueItemDrugDto
{
    public Guid PrescriptionItemId { get; set; }
    public Guid DrugId { get; set; }
    public string DrugCode { get; set; } = string.Empty;
    public string DrugName { get; set; } = string.Empty;
    public string Dosage { get; set; } = string.Empty;
    public string Frequency { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public int QuantityPrescribed { get; set; }
    public int QuantityDispensed { get; set; }
    public int QuantityRemaining { get; set; }
    public string? Instructions { get; set; }
    public int AvailableStockOnHand { get; set; }
    public List<InventoryBatchDto> SuggestedFefoBatches { get; set; } = new();
}

public class PrescriptionQueueItemDto
{
    public Guid Id { get; set; }
    public string PrescriptionNumber { get; set; } = string.Empty;
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string PatientGender { get; set; } = string.Empty;
    public DateTime PatientDateOfBirth { get; set; }
    public List<string> PatientAllergies { get; set; } = new();
    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public DateTime SignedAt { get; set; }
    public PrescriptionStatus Status { get; set; }
    public List<PrescriptionQueueItemDrugDto> Items { get; set; } = new();
}

public class DispenseLineRequest
{
    public Guid PrescriptionItemId { get; set; }
    public Guid? InventoryBatchId { get; set; } // If null, auto-FEFO allocates
    public int QuantityToDispense { get; set; }
}

public class DispensePrescriptionRequest
{
    public string IdempotencyKey { get; set; } = string.Empty;
    public List<DispenseLineRequest> Lines { get; set; } = new();
}

public class DispenseItemDto
{
    public Guid Id { get; set; }
    public Guid PrescriptionItemId { get; set; }
    public string DrugName { get; set; } = string.Empty;
    public Guid InventoryBatchId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPriceSnapshot { get; set; }
    public decimal TotalPrice => Quantity * UnitPriceSnapshot;
}

public class DispenseRecordDto
{
    public Guid Id { get; set; }
    public Guid PrescriptionId { get; set; }
    public string PrescriptionNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string PatientNumber { get; set; } = string.Empty;
    public Guid PharmacistUserId { get; set; }
    public string PharmacistUserName { get; set; } = string.Empty;
    public DateTime DispensedAt { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public decimal TotalDispensedPrice { get; set; }
    public List<DispenseItemDto> Items { get; set; } = new();
}

public class PharmacyDashboardMetricsDto
{
    public int TotalDrugsCount { get; set; }
    public int LowStockAlertsCount { get; set; }
    public int ExpiringBatches30DaysCount { get; set; }
    public int ExpiredBatchesCount { get; set; }
    public int PendingPrescriptionsCount { get; set; }
    public int DispensedTodayCount { get; set; }
}
