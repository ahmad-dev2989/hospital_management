using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class PharmacyService : IPharmacyService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<PharmacyService> _logger;
    private static readonly SemaphoreSlim _dispenseLock = new(1, 1);

    public PharmacyService(
        ApplicationDbContext context,
        IAuditService auditService,
        ILogger<PharmacyService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    // ----------------------------------------------------
    // DRUG FORMULARY CATALOG
    // ----------------------------------------------------

    public async Task<List<PharmacyDrugDto>> GetDrugsAsync(string? query = null, bool activeOnly = true, CancellationToken cancellationToken = default)
    {
        var q = _context.Drugs
            .AsNoTracking()
            .Include(d => d.Batches)
            .AsQueryable();

        if (activeOnly)
        {
            q = q.Where(d => d.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(d =>
                d.Code.ToLower().Contains(search) ||
                d.BrandName.ToLower().Contains(search) ||
                d.GenericName.ToLower().Contains(search) ||
                d.DosageForm.ToLower().Contains(search));
        }

        var drugs = await q.OrderBy(d => d.GenericName).ThenBy(d => d.BrandName).ToListAsync(cancellationToken);
        return drugs.Select(MapToPharmacyDrugDto).ToList();
    }

    public async Task<PharmacyDrugDto> GetDrugByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var drug = await _context.Drugs
            .AsNoTracking()
            .Include(d => d.Batches)
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

        if (drug == null)
            throw new KeyNotFoundException($"Medication with ID {id} not found.");

        return MapToPharmacyDrugDto(drug);
    }

    public async Task<PharmacyDrugDto> CreateDrugAsync(CreateDrugRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("Drug Code is required.");
        if (string.IsNullOrWhiteSpace(request.BrandName))
            throw new ArgumentException("Brand Name is required.");
        if (string.IsNullOrWhiteSpace(request.GenericName))
            throw new ArgumentException("Generic Name is required.");

        var codeUpper = request.Code.Trim().ToUpper();
        var exists = await _context.Drugs.AnyAsync(d => d.Code == codeUpper, cancellationToken);
        if (exists)
            throw new InvalidOperationException($"Medication with code '{codeUpper}' already exists.");

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            Code = codeUpper,
            BrandName = request.BrandName.Trim(),
            GenericName = request.GenericName.Trim(),
            DosageForm = string.IsNullOrWhiteSpace(request.DosageForm) ? "Tablet" : request.DosageForm.Trim(),
            Strength = request.Strength?.Trim() ?? string.Empty,
            ReorderLevel = Math.Max(0, request.ReorderLevel),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Drugs.Add(drug);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Pharmacy.DrugCreated",
            "Drug",
            drug.Id.ToString(),
            $"Created formulary drug '{drug.BrandName}' ({drug.GenericName} {drug.Strength}) with code {drug.Code}",
            "127.0.0.1");

        return MapToPharmacyDrugDto(drug);
    }

    public async Task<PharmacyDrugDto> UpdateDrugAsync(Guid id, UpdateDrugRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var drug = await _context.Drugs
            .Include(d => d.Batches)
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

        if (drug == null)
            throw new KeyNotFoundException($"Medication with ID {id} not found.");

        if (string.IsNullOrWhiteSpace(request.BrandName))
            throw new ArgumentException("Brand Name is required.");
        if (string.IsNullOrWhiteSpace(request.GenericName))
            throw new ArgumentException("Generic Name is required.");

        drug.BrandName = request.BrandName.Trim();
        drug.GenericName = request.GenericName.Trim();
        drug.DosageForm = string.IsNullOrWhiteSpace(request.DosageForm) ? "Tablet" : request.DosageForm.Trim();
        drug.Strength = request.Strength?.Trim() ?? string.Empty;
        drug.ReorderLevel = Math.Max(0, request.ReorderLevel);
        drug.IsActive = request.IsActive;
        drug.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Pharmacy.DrugUpdated",
            "Drug",
            drug.Id.ToString(),
            $"Updated formulary drug '{drug.BrandName}' ({drug.Code})",
            "127.0.0.1");

        return MapToPharmacyDrugDto(drug);
    }

    // ----------------------------------------------------
    // INVENTORY BATCHES & STOCK
    // ----------------------------------------------------

    public async Task<List<InventoryBatchDto>> GetBatchesAsync(Guid? drugId = null, bool availableOnly = false, CancellationToken cancellationToken = default)
    {
        var q = _context.InventoryBatches
            .AsNoTracking()
            .Include(b => b.Drug)
            .AsQueryable();

        if (drugId.HasValue && drugId.Value != Guid.Empty)
        {
            q = q.Where(b => b.DrugId == drugId.Value);
        }

        if (availableOnly)
        {
            var now = DateTime.UtcNow;
            q = q.Where(b => b.Status == InventoryBatchStatus.Available && b.QuantityOnHand > 0 && b.ExpiryDate > now);
        }

        // FEFO order: earliest expiry date first
        var batches = await q.OrderBy(b => b.ExpiryDate).ToListAsync(cancellationToken);
        return batches.Select(MapToInventoryBatchDto).ToList();
    }

    public async Task<InventoryBatchDto> ReceiveBatchAsync(ReceiveBatchRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.DrugId == Guid.Empty)
            throw new ArgumentException("Drug ID is required.");
        if (string.IsNullOrWhiteSpace(request.BatchNumber))
            throw new ArgumentException("Batch Number is required.");
        if (request.Quantity <= 0)
            throw new ArgumentException("Quantity received must be greater than zero.");
        if (request.ExpiryDate <= DateTime.UtcNow)
            throw new ArgumentException("Expiry date must be in the future.");

        var drug = await _context.Drugs.FirstOrDefaultAsync(d => d.Id == request.DrugId, cancellationToken);
        if (drug == null)
            throw new KeyNotFoundException($"Drug ID {request.DrugId} not found.");

        var batchNumberClean = request.BatchNumber.Trim().ToUpper();
        var exists = await _context.InventoryBatches.AnyAsync(
            b => b.DrugId == request.DrugId && b.BatchNumber == batchNumberClean, cancellationToken);

        if (exists)
            throw new InvalidOperationException($"Batch '{batchNumberClean}' already exists for medication {drug.BrandName}.");

        var batch = new InventoryBatch
        {
            Id = Guid.NewGuid(),
            DrugId = request.DrugId,
            BatchNumber = batchNumberClean,
            ExpiryDate = DateTime.SpecifyKind(request.ExpiryDate.Date, DateTimeKind.Utc),
            QuantityReceived = request.Quantity,
            QuantityOnHand = request.Quantity,
            UnitCost = Math.Max(0m, request.UnitCost),
            SellingPrice = Math.Max(0m, request.SellingPrice),
            Status = InventoryBatchStatus.Available,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.InventoryBatches.Add(batch);

        // Record initial StockMovement
        var movement = new StockMovement
        {
            Id = Guid.NewGuid(),
            InventoryBatchId = batch.Id,
            MovementType = StockMovementType.PurchaseReceived,
            QuantityDelta = request.Quantity,
            BalanceAfter = request.Quantity,
            ReferenceId = batch.BatchNumber,
            Reason = "Initial purchase shipment received",
            PerformedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Pharmacy.BatchReceived",
            "InventoryBatch",
            batch.Id.ToString(),
            $"Received batch {batch.BatchNumber} for {drug.BrandName} with {request.Quantity} units. Expiry: {batch.ExpiryDate:yyyy-MM-dd}",
            "127.0.0.1");

        return await GetBatchDtoByIdAsync(batch.Id, cancellationToken);
    }

    public async Task<InventoryBatchDto> AdjustStockAsync(AdjustStockRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.BatchId == Guid.Empty)
            throw new ArgumentException("Batch ID is required.");
        if (request.QuantityDelta == 0)
            throw new ArgumentException("Quantity delta cannot be zero.");
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("A reason for stock adjustment is required.");

        var batch = await _context.InventoryBatches
            .Include(b => b.Drug)
            .FirstOrDefaultAsync(b => b.Id == request.BatchId, cancellationToken);

        if (batch == null)
            throw new KeyNotFoundException($"Inventory batch {request.BatchId} not found.");

        int delta = request.QuantityDelta;
        // For reduction movements, ensure delta is negative
        if ((request.MovementType == StockMovementType.AdjustmentDecrease ||
             request.MovementType == StockMovementType.Damaged ||
             request.MovementType == StockMovementType.ExpiredWastage) && delta > 0)
        {
            delta = -delta;
        }

        int newBalance = batch.QuantityOnHand + delta;
        if (newBalance < 0)
            throw new InvalidOperationException($"Cannot reduce stock by {Math.Abs(delta)} units. Available on hand: {batch.QuantityOnHand}.");

        batch.QuantityOnHand = newBalance;
        if (batch.QuantityOnHand == 0)
        {
            batch.Status = request.MovementType == StockMovementType.ExpiredWastage 
                ? InventoryBatchStatus.Expired 
                : InventoryBatchStatus.Depleted;
        }
        else if (request.MovementType == StockMovementType.ExpiredWastage)
        {
            batch.Status = InventoryBatchStatus.Expired;
        }
        batch.UpdatedAt = DateTime.UtcNow;

        var movement = new StockMovement
        {
            Id = Guid.NewGuid(),
            InventoryBatchId = batch.Id,
            MovementType = request.MovementType,
            QuantityDelta = delta,
            BalanceAfter = newBalance,
            ReferenceId = $"ADJ-{DateTime.UtcNow:yyyyMMddHHmmss}",
            Reason = request.Reason.Trim(),
            PerformedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Pharmacy.StockAdjusted",
            "InventoryBatch",
            batch.Id.ToString(),
            $"Adjusted batch {batch.BatchNumber} ({batch.Drug.BrandName}) by {delta:+#;-#;0} units. New balance: {newBalance}. Reason: {request.Reason}",
            "127.0.0.1");

        return MapToInventoryBatchDto(batch);
    }

    public async Task<PagedResult<StockMovementDto>> GetStockMovementsAsync(Guid? batchId = null, Guid? drugId = null, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = _context.StockMovements
            .AsNoTracking()
            .Include(m => m.InventoryBatch).ThenInclude(b => b.Drug)
            .Include(m => m.PerformedByUser)
            .AsQueryable();

        if (batchId.HasValue && batchId.Value != Guid.Empty)
        {
            q = q.Where(m => m.InventoryBatchId == batchId.Value);
        }

        if (drugId.HasValue && drugId.Value != Guid.Empty)
        {
            q = q.Where(m => m.InventoryBatch.DrugId == drugId.Value);
        }

        var total = await q.CountAsync(cancellationToken);
        var items = await q
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new StockMovementDto
            {
                Id = m.Id,
                InventoryBatchId = m.InventoryBatchId,
                BatchNumber = m.InventoryBatch.BatchNumber,
                DrugName = m.InventoryBatch.Drug.BrandName,
                MovementType = m.MovementType,
                QuantityDelta = m.QuantityDelta,
                BalanceAfter = m.BalanceAfter,
                ReferenceId = m.ReferenceId,
                Reason = m.Reason,
                PerformedByUserId = m.PerformedByUserId,
                PerformedByUserName = m.PerformedByUser.FullName,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<StockMovementDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<List<InventoryBatchDto>> GetExpiringBatchesAsync(int daysThreshold = 30, CancellationToken cancellationToken = default)
    {
        var thresholdDate = DateTime.UtcNow.AddDays(daysThreshold);
        var batches = await _context.InventoryBatches
            .AsNoTracking()
            .Include(b => b.Drug)
            .Where(b => b.QuantityOnHand > 0 && b.ExpiryDate <= thresholdDate)
            .OrderBy(b => b.ExpiryDate)
            .ToListAsync(cancellationToken);

        return batches.Select(MapToInventoryBatchDto).ToList();
    }

    public async Task<List<PharmacyDrugDto>> GetLowStockDrugsAsync(CancellationToken cancellationToken = default)
    {
        var drugs = await _context.Drugs
            .AsNoTracking()
            .Include(d => d.Batches)
            .Where(d => d.IsActive)
            .ToListAsync(cancellationToken);

        var lowStock = drugs
            .Where(d => d.Batches.Where(b => b.Status == InventoryBatchStatus.Available && b.ExpiryDate > DateTime.UtcNow).Sum(b => b.QuantityOnHand) <= d.ReorderLevel)
            .Select(MapToPharmacyDrugDto)
            .OrderBy(d => d.TotalStockOnHand)
            .ToList();

        return lowStock;
    }

    public async Task<PharmacyDashboardMetricsDto> GetMetricsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var in30Days = now.AddDays(30);
        var todayStart = DateTime.SpecifyKind(now.Date, DateTimeKind.Utc);

        var totalDrugs = await _context.Drugs.CountAsync(d => d.IsActive, cancellationToken);
        var expiring30 = await _context.InventoryBatches
            .CountAsync(b => b.QuantityOnHand > 0 && b.ExpiryDate > now && b.ExpiryDate <= in30Days, cancellationToken);
        var expired = await _context.InventoryBatches
            .CountAsync(b => b.QuantityOnHand > 0 && b.ExpiryDate <= now, cancellationToken);
        var pendingPrescriptions = await _context.Prescriptions
            .CountAsync(p => p.Status == PrescriptionStatus.Signed || p.Status == PrescriptionStatus.PartiallyDispensed, cancellationToken);
        var dispensedToday = await _context.DispenseRecords
            .CountAsync(d => d.DispensedAt >= todayStart, cancellationToken);

        // Low stock count
        var allDrugs = await _context.Drugs
            .AsNoTracking()
            .Include(d => d.Batches)
            .Where(d => d.IsActive)
            .ToListAsync(cancellationToken);

        var lowStockCount = allDrugs.Count(d =>
            d.Batches.Where(b => b.Status == InventoryBatchStatus.Available && b.ExpiryDate > now).Sum(b => b.QuantityOnHand) <= d.ReorderLevel);

        return new PharmacyDashboardMetricsDto
        {
            TotalDrugsCount = totalDrugs,
            LowStockAlertsCount = lowStockCount,
            ExpiringBatches30DaysCount = expiring30,
            ExpiredBatchesCount = expired,
            PendingPrescriptionsCount = pendingPrescriptions,
            DispensedTodayCount = dispensedToday
        };
    }

    // ----------------------------------------------------
    // PRESCRIPTION QUEUE & ATOMIC DISPENSING
    // ----------------------------------------------------

    public async Task<List<PrescriptionQueueItemDto>> GetPrescriptionQueueAsync(PrescriptionStatus? status = null, string? query = null, CancellationToken cancellationToken = default)
    {
        var q = _context.Prescriptions
            .AsNoTracking()
            .Include(p => p.Patient).ThenInclude(pat => pat.Allergies)
            .Include(p => p.Doctor).ThenInclude(doc => doc.User)
            .Include(p => p.Items).ThenInclude(i => i.Drug).ThenInclude(d => d.Batches)
            .AsQueryable();

        if (status.HasValue)
        {
            q = q.Where(p => p.Status == status.Value);
        }
        else
        {
            // By default return active prescriptions waiting for dispensing
            q = q.Where(p => p.Status == PrescriptionStatus.Signed || p.Status == PrescriptionStatus.PartiallyDispensed);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(p =>
                p.PrescriptionNumber.ToLower().Contains(search) ||
                p.Patient.PatientNumber.ToLower().Contains(search) ||
                p.Patient.FirstName.ToLower().Contains(search) ||
                p.Patient.LastName.ToLower().Contains(search));
        }

        var prescriptions = await q.OrderByDescending(p => p.SignedAt).ToListAsync(cancellationToken);
        return prescriptions.Select(MapToPrescriptionQueueItemDto).ToList();
    }

    public async Task<PrescriptionQueueItemDto> GetPrescriptionDispenseDetailsAsync(Guid prescriptionId, CancellationToken cancellationToken = default)
    {
        var prescription = await _context.Prescriptions
            .AsNoTracking()
            .Include(p => p.Patient).ThenInclude(pat => pat.Allergies)
            .Include(p => p.Doctor).ThenInclude(doc => doc.User)
            .Include(p => p.Items).ThenInclude(i => i.Drug).ThenInclude(d => d.Batches)
            .FirstOrDefaultAsync(p => p.Id == prescriptionId, cancellationToken);

        if (prescription == null)
            throw new KeyNotFoundException($"Prescription {prescriptionId} not found.");

        return MapToPrescriptionQueueItemDto(prescription);
    }

    public async Task<DispenseRecordDto> DispensePrescriptionAsync(
        Guid prescriptionId,
        DispensePrescriptionRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            throw new ArgumentException("An IdempotencyKey is required for dispensing operations.");

        if (request.Lines == null || request.Lines.Count == 0)
            throw new ArgumentException("At least one prescription item must be selected for dispensing.");

        await _dispenseLock.WaitAsync(cancellationToken);
        try
        {
            // 1. Idempotency Check: if key already processed, return existing record
            var existingRecord = await _context.DispenseRecords
                .Include(r => r.Prescription).ThenInclude(p => p.Patient)
                .Include(r => r.PharmacistUser)
                .Include(r => r.Items).ThenInclude(i => i.PrescriptionItem).ThenInclude(pi => pi.Drug)
                .Include(r => r.Items).ThenInclude(i => i.InventoryBatch)
                .FirstOrDefaultAsync(r => r.IdempotencyKey == request.IdempotencyKey, cancellationToken);

            if (existingRecord != null)
            {
                _logger.LogInformation("Idempotent dispense request detected for key {Key}. Returning existing record.", request.IdempotencyKey);
                return MapToDispenseRecordDto(existingRecord);
            }

            // 2. Fetch Prescription with full tracking
            var prescription = await _context.Prescriptions
                .Include(p => p.Patient)
                .Include(p => p.Items).ThenInclude(i => i.Drug).ThenInclude(d => d.Batches)
                .FirstOrDefaultAsync(p => p.Id == prescriptionId, cancellationToken);

            if (prescription == null)
                throw new KeyNotFoundException($"Prescription {prescriptionId} not found.");

            if (prescription.Status != PrescriptionStatus.Signed && prescription.Status != PrescriptionStatus.PartiallyDispensed)
                throw new InvalidOperationException($"Cannot dispense medication for a prescription with status '{prescription.Status}'.");

            var now = DateTime.UtcNow;
            var dispenseRecord = new DispenseRecord
            {
                Id = Guid.NewGuid(),
                PrescriptionId = prescription.Id,
                PharmacistUserId = currentUserId,
                DispensedAt = now,
                IdempotencyKey = request.IdempotencyKey.Trim(),
                CreatedAt = now,
                UpdatedAt = now
            };

            foreach (var line in request.Lines)
            {
                if (line.QuantityToDispense <= 0) continue;

                var rxItem = prescription.Items.FirstOrDefault(i => i.Id == line.PrescriptionItemId);
                if (rxItem == null)
                    throw new KeyNotFoundException($"Prescription item {line.PrescriptionItemId} not found.");

                int remainingNeeded = rxItem.QuantityPrescribed - rxItem.QuantityDispensed;
                if (remainingNeeded <= 0)
                    throw new InvalidOperationException($"Item '{rxItem.Drug.BrandName}' has already been fully dispensed.");

                int toDispense = Math.Min(line.QuantityToDispense, remainingNeeded);

                // Option A: Specific Batch requested
                if (line.InventoryBatchId.HasValue && line.InventoryBatchId.Value != Guid.Empty)
                {
                    var batch = await _context.InventoryBatches
                        .FirstOrDefaultAsync(b => b.Id == line.InventoryBatchId.Value, cancellationToken);

                    if (batch == null || batch.DrugId != rxItem.DrugId)
                        throw new KeyNotFoundException($"Batch {line.InventoryBatchId.Value} is not valid for drug {rxItem.Drug.BrandName}.");

                    if (batch.ExpiryDate <= now)
                        throw new InvalidOperationException($"Batch {batch.BatchNumber} has expired on {batch.ExpiryDate:yyyy-MM-dd}. Cannot dispense expired stock.");

                    if (batch.QuantityOnHand < toDispense)
                        throw new InvalidOperationException($"Batch {batch.BatchNumber} only has {batch.QuantityOnHand} units available. Requested: {toDispense}.");

                    batch.QuantityOnHand -= toDispense;
                    if (batch.QuantityOnHand == 0)
                        batch.Status = InventoryBatchStatus.Depleted;
                    batch.UpdatedAt = now;

                    dispenseRecord.Items.Add(new DispenseItem
                    {
                        Id = Guid.NewGuid(),
                        DispenseRecordId = dispenseRecord.Id,
                        PrescriptionItemId = rxItem.Id,
                        InventoryBatchId = batch.Id,
                        Quantity = toDispense,
                        UnitPriceSnapshot = batch.SellingPrice,
                        CreatedAt = now,
                        UpdatedAt = now
                    });

                    _context.StockMovements.Add(new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        InventoryBatchId = batch.Id,
                        MovementType = StockMovementType.Dispensed,
                        QuantityDelta = -toDispense,
                        BalanceAfter = batch.QuantityOnHand,
                        ReferenceId = prescription.PrescriptionNumber,
                        Reason = $"Dispensed {toDispense} units for RX {prescription.PrescriptionNumber}",
                        PerformedByUserId = currentUserId,
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                }
                else
                {
                    // Option B: Auto-FEFO Allocation (earliest non-expired expiry date first)
                    var availableBatches = await _context.InventoryBatches
                        .Where(b => b.DrugId == rxItem.DrugId &&
                                    b.Status == InventoryBatchStatus.Available &&
                                    b.QuantityOnHand > 0 &&
                                    b.ExpiryDate > now)
                        .OrderBy(b => b.ExpiryDate)
                        .ToListAsync(cancellationToken);

                    int totalAvail = availableBatches.Sum(b => b.QuantityOnHand);
                    if (totalAvail < toDispense)
                        throw new InvalidOperationException($"Insufficient non-expired stock for {rxItem.Drug.BrandName}. Requested: {toDispense}, Available: {totalAvail}.");

                    int qtyLeftToFill = toDispense;
                    foreach (var batch in availableBatches)
                    {
                        if (qtyLeftToFill <= 0) break;

                        int take = Math.Min(qtyLeftToFill, batch.QuantityOnHand);
                        batch.QuantityOnHand -= take;
                        if (batch.QuantityOnHand == 0)
                            batch.Status = InventoryBatchStatus.Depleted;
                        batch.UpdatedAt = now;

                        dispenseRecord.Items.Add(new DispenseItem
                        {
                            Id = Guid.NewGuid(),
                            DispenseRecordId = dispenseRecord.Id,
                            PrescriptionItemId = rxItem.Id,
                            InventoryBatchId = batch.Id,
                            Quantity = take,
                            UnitPriceSnapshot = batch.SellingPrice,
                            CreatedAt = now,
                            UpdatedAt = now
                        });

                        _context.StockMovements.Add(new StockMovement
                        {
                            Id = Guid.NewGuid(),
                            InventoryBatchId = batch.Id,
                            MovementType = StockMovementType.Dispensed,
                            QuantityDelta = -take,
                            BalanceAfter = batch.QuantityOnHand,
                            ReferenceId = prescription.PrescriptionNumber,
                            Reason = $"FEFO Dispensed {take} units from batch {batch.BatchNumber} for RX {prescription.PrescriptionNumber}",
                            PerformedByUserId = currentUserId,
                            CreatedAt = now,
                            UpdatedAt = now
                        });

                        qtyLeftToFill -= take;
                    }
                }

                rxItem.QuantityDispensed += toDispense;
                rxItem.UpdatedAt = now;
            }

            // 3. Update Overall Prescription Status
            bool allFullyDispensed = prescription.Items.All(i => i.QuantityDispensed >= i.QuantityPrescribed);
            prescription.Status = allFullyDispensed ? PrescriptionStatus.Dispensed : PrescriptionStatus.PartiallyDispensed;
            prescription.UpdatedAt = now;

            _context.DispenseRecords.Add(dispenseRecord);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                currentUserId,
                currentUserName,
                "Pharmacy.Dispensed",
                "DispenseRecord",
                dispenseRecord.Id.ToString(),
                $"Dispensed medication for RX {prescription.PrescriptionNumber} ({dispenseRecord.Items.Count} line items, Status: {prescription.Status})",
                "127.0.0.1");

            // Fetch created record with all navigations loaded
            var createdRecord = await _context.DispenseRecords
                .AsNoTracking()
                .Include(r => r.Prescription).ThenInclude(p => p.Patient)
                .Include(r => r.PharmacistUser)
                .Include(r => r.Items).ThenInclude(i => i.PrescriptionItem).ThenInclude(pi => pi.Drug)
                .Include(r => r.Items).ThenInclude(i => i.InventoryBatch)
                .FirstAsync(r => r.Id == dispenseRecord.Id, cancellationToken);

            return MapToDispenseRecordDto(createdRecord);
        }
        finally
        {
            _dispenseLock.Release();
        }
    }

    // ----------------------------------------------------
    // PRIVATE MAPPERS & HELPERS
    // ----------------------------------------------------

    private async Task<InventoryBatchDto> GetBatchDtoByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var b = await _context.InventoryBatches
            .AsNoTracking()
            .Include(batch => batch.Drug)
            .FirstAsync(batch => batch.Id == id, cancellationToken);

        return MapToInventoryBatchDto(b);
    }

    private static PharmacyDrugDto MapToPharmacyDrugDto(Drug d)
    {
        var now = DateTime.UtcNow;
        var availableBatches = d.Batches
            .Where(b => b.Status == InventoryBatchStatus.Available && b.ExpiryDate > now)
            .OrderBy(b => b.ExpiryDate)
            .ToList();

        int totalStock = availableBatches.Sum(b => b.QuantityOnHand);

        return new PharmacyDrugDto
        {
            Id = d.Id,
            Code = d.Code,
            BrandName = d.BrandName,
            GenericName = d.GenericName,
            DosageForm = d.DosageForm,
            Strength = d.Strength,
            ReorderLevel = d.ReorderLevel,
            TotalStockOnHand = totalStock,
            IsLowStock = totalStock <= d.ReorderLevel,
            IsActive = d.IsActive,
            CreatedAt = d.CreatedAt,
            UpdatedAt = d.UpdatedAt,
            Batches = d.Batches.Select(MapToInventoryBatchDto).OrderBy(b => b.ExpiryDate).ToList()
        };
    }

    private static InventoryBatchDto MapToInventoryBatchDto(InventoryBatch b)
    {
        var now = DateTime.UtcNow;
        var isExpired = b.ExpiryDate <= now;
        var daysUntilExpiry = (int)(b.ExpiryDate.Date - now.Date).TotalDays;

        return new InventoryBatchDto
        {
            Id = b.Id,
            DrugId = b.DrugId,
            DrugCode = b.Drug?.Code ?? string.Empty,
            DrugName = b.Drug?.BrandName ?? string.Empty,
            BatchNumber = b.BatchNumber,
            ExpiryDate = b.ExpiryDate,
            QuantityReceived = b.QuantityReceived,
            QuantityOnHand = b.QuantityOnHand,
            UnitCost = b.UnitCost,
            SellingPrice = b.SellingPrice,
            Status = b.Status,
            IsExpired = isExpired,
            DaysUntilExpiry = daysUntilExpiry,
            CreatedAt = b.CreatedAt,
            UpdatedAt = b.UpdatedAt
        };
    }

    private static PrescriptionQueueItemDto MapToPrescriptionQueueItemDto(Prescription p)
    {
        var now = DateTime.UtcNow;
        var items = p.Items.Select(item =>
        {
            var availBatches = item.Drug.Batches
                .Where(b => b.Status == InventoryBatchStatus.Available && b.QuantityOnHand > 0 && b.ExpiryDate > now)
                .OrderBy(b => b.ExpiryDate)
                .ToList();

            int availStock = availBatches.Sum(b => b.QuantityOnHand);

            return new PrescriptionQueueItemDrugDto
            {
                PrescriptionItemId = item.Id,
                DrugId = item.DrugId,
                DrugCode = item.Drug.Code,
                DrugName = item.Drug.BrandName,
                Dosage = item.Dosage,
                Frequency = item.Frequency,
                Route = item.Route,
                DurationDays = item.DurationDays,
                QuantityPrescribed = item.QuantityPrescribed,
                QuantityDispensed = item.QuantityDispensed,
                QuantityRemaining = Math.Max(0, item.QuantityPrescribed - item.QuantityDispensed),
                Instructions = item.Instructions,
                AvailableStockOnHand = availStock,
                SuggestedFefoBatches = availBatches.Select(MapToInventoryBatchDto).ToList()
            };
        }).ToList();

        return new PrescriptionQueueItemDto
        {
            Id = p.Id,
            PrescriptionNumber = p.PrescriptionNumber,
            EncounterId = p.EncounterId,
            PatientId = p.PatientId,
            PatientNumber = p.Patient?.PatientNumber ?? string.Empty,
            PatientName = p.Patient != null ? $"{p.Patient.FirstName} {p.Patient.LastName}".Trim() : string.Empty,
            PatientGender = p.Patient?.Gender ?? string.Empty,
            PatientDateOfBirth = p.Patient?.DateOfBirth ?? DateTime.MinValue,
            PatientAllergies = p.Patient?.Allergies.Select(a => $"{a.Allergen} ({a.Severity})").ToList() ?? new List<string>(),
            DoctorId = p.DoctorId,
            DoctorName = p.Doctor?.User?.FullName ?? string.Empty,
            SignedAt = p.SignedAt,
            Status = p.Status,
            Items = items
        };
    }

    private static DispenseRecordDto MapToDispenseRecordDto(DispenseRecord r)
    {
        var items = r.Items.Select(i => new DispenseItemDto
        {
            Id = i.Id,
            PrescriptionItemId = i.PrescriptionItemId,
            DrugName = i.PrescriptionItem?.Drug?.BrandName ?? "Medication",
            InventoryBatchId = i.InventoryBatchId,
            BatchNumber = i.InventoryBatch?.BatchNumber ?? string.Empty,
            Quantity = i.Quantity,
            UnitPriceSnapshot = i.UnitPriceSnapshot
        }).ToList();

        return new DispenseRecordDto
        {
            Id = r.Id,
            PrescriptionId = r.PrescriptionId,
            PrescriptionNumber = r.Prescription?.PrescriptionNumber ?? string.Empty,
            PatientName = r.Prescription?.Patient != null ? $"{r.Prescription.Patient.FirstName} {r.Prescription.Patient.LastName}".Trim() : string.Empty,
            PatientNumber = r.Prescription?.Patient?.PatientNumber ?? string.Empty,
            PharmacistUserId = r.PharmacistUserId,
            PharmacistUserName = r.PharmacistUser?.FullName ?? "Pharmacist",
            DispensedAt = r.DispensedAt,
            IdempotencyKey = r.IdempotencyKey,
            TotalDispensedPrice = items.Sum(i => i.TotalPrice),
            Items = items
        };
    }
}
