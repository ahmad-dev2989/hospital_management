using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;

namespace HospitalApp.Infrastructure.Services;

public interface IPharmacyService
{
    // Drug Formulary
    Task<List<PharmacyDrugDto>> GetDrugsAsync(string? query = null, bool activeOnly = true, CancellationToken cancellationToken = default);
    Task<PharmacyDrugDto> GetDrugByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PharmacyDrugDto> CreateDrugAsync(CreateDrugRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<PharmacyDrugDto> UpdateDrugAsync(Guid id, UpdateDrugRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);

    // Batches & Stock
    Task<List<InventoryBatchDto>> GetBatchesAsync(Guid? drugId = null, bool availableOnly = false, CancellationToken cancellationToken = default);
    Task<InventoryBatchDto> ReceiveBatchAsync(ReceiveBatchRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<InventoryBatchDto> AdjustStockAsync(AdjustStockRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<PagedResult<StockMovementDto>> GetStockMovementsAsync(Guid? batchId = null, Guid? drugId = null, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<List<InventoryBatchDto>> GetExpiringBatchesAsync(int daysThreshold = 30, CancellationToken cancellationToken = default);
    Task<List<PharmacyDrugDto>> GetLowStockDrugsAsync(CancellationToken cancellationToken = default);
    Task<PharmacyDashboardMetricsDto> GetMetricsAsync(CancellationToken cancellationToken = default);

    // Prescriptions & Dispensing
    Task<List<PrescriptionQueueItemDto>> GetPrescriptionQueueAsync(PrescriptionStatus? status = null, string? query = null, CancellationToken cancellationToken = default);
    Task<PrescriptionQueueItemDto> GetPrescriptionDispenseDetailsAsync(Guid prescriptionId, CancellationToken cancellationToken = default);
    Task<DispenseRecordDto> DispensePrescriptionAsync(Guid prescriptionId, DispensePrescriptionRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
}
