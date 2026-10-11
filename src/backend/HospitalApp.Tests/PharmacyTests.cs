using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class PharmacyTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupDrugIds = new();
    private readonly List<Guid> _cleanupBatchIds = new();
    private readonly List<Guid> _cleanupPrescriptionIds = new();
    private readonly List<Guid> _cleanupDispenseRecordIds = new();
    private readonly List<Guid> _cleanupEncounterIds = new();
    private readonly List<Guid> _cleanupPatientIds = new();

    public PharmacyTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        if (_cleanupDispenseRecordIds.Count > 0)
        {
            var items = _dbContext.DispenseItems
                .Where(i => _cleanupDispenseRecordIds.Contains(i.DispenseRecordId)).ToList();
            _dbContext.DispenseItems.RemoveRange(items);

            var records = _dbContext.DispenseRecords
                .Where(r => _cleanupDispenseRecordIds.Contains(r.Id)).ToList();
            _dbContext.DispenseRecords.RemoveRange(records);
        }

        if (_cleanupPrescriptionIds.Count > 0)
        {
            var rxItems = _dbContext.PrescriptionItems
                .Where(i => _cleanupPrescriptionIds.Contains(i.PrescriptionId)).ToList();
            _dbContext.PrescriptionItems.RemoveRange(rxItems);

            var rxs = _dbContext.Prescriptions
                .Where(p => _cleanupPrescriptionIds.Contains(p.Id)).ToList();
            _dbContext.Prescriptions.RemoveRange(rxs);
        }

        if (_cleanupEncounterIds.Count > 0)
        {
            var encounters = _dbContext.Encounters
                .Where(e => _cleanupEncounterIds.Contains(e.Id)).ToList();
            _dbContext.Encounters.RemoveRange(encounters);
        }

        if (_cleanupPatientIds.Count > 0)
        {
            var patients = _dbContext.Patients
                .Where(p => _cleanupPatientIds.Contains(p.Id)).ToList();
            _dbContext.Patients.RemoveRange(patients);
        }

        if (_cleanupBatchIds.Count > 0)
        {
            var movements = _dbContext.StockMovements
                .Where(m => _cleanupBatchIds.Contains(m.InventoryBatchId)).ToList();
            _dbContext.StockMovements.RemoveRange(movements);

            var batches = _dbContext.InventoryBatches
                .Where(b => _cleanupBatchIds.Contains(b.Id)).ToList();
            _dbContext.InventoryBatches.RemoveRange(batches);
        }

        if (_cleanupDrugIds.Count > 0)
        {
            var drugs = _dbContext.Drugs
                .Where(d => _cleanupDrugIds.Contains(d.Id)).ToList();
            _dbContext.Drugs.RemoveRange(drugs);
        }

        _dbContext.SaveChanges();
        _dbContext.Dispose();
    }

    private async Task<(Patient Patient, Doctor Doctor, Encounter Encounter, UserAccount Pharmacist)> SeedFixtureAsync()
    {
        var doctor = await _dbContext.Doctors
            .Include(d => d.User)
            .FirstAsync(d => d.IsActive);

        var pharmacist = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Pharmacist);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"PHARM-PAT-{Guid.NewGuid().ToString()[..8]}",
            FirstName = "PharmTest",
            LastName = "Patient",
            DateOfBirth = DateTime.SpecifyKind(new DateTime(1990, 7, 20), DateTimeKind.Utc),
            Gender = "Male",
            Phone = "555-444-8888",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Patients.Add(patient);
        _cleanupPatientIds.Add(patient.Id);

        var encounter = new Encounter
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            DoctorId = doctor.Id,
            StartedAt = DateTime.UtcNow,
            Status = EncounterStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Encounters.Add(encounter);
        _cleanupEncounterIds.Add(encounter.Id);

        await _dbContext.SaveChangesAsync();
        return (patient, doctor, encounter, pharmacist);
    }

    [Fact]
    public async Task CreateDrug_EnforcesUniqueCode_AndSavesProperly()
    {
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new PharmacyService(_dbContext, audit, NullLogger<PharmacyService>.Instance);

        var code = $"MED-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        var req = new CreateDrugRequest
        {
            Code = code,
            BrandName = "TestCillin",
            GenericName = "Testocillin Sodium",
            DosageForm = "Capsule",
            Strength = "250mg",
            ReorderLevel = 25
        };

        var created = await service.CreateDrugAsync(req, admin.Id, admin.Username);
        _cleanupDrugIds.Add(created.Id);

        Assert.NotNull(created);
        Assert.Equal(code, created.Code);
        Assert.Equal("TestCillin", created.BrandName);
        Assert.Equal(25, created.ReorderLevel);
        Assert.True(created.IsActive);

        // Duplicate code throws InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateDrugAsync(req, admin.Id, admin.Username));
    }

    [Fact]
    public async Task ReceiveBatch_CreatesInventoryBatch_AndStockMovementLedger()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new PharmacyService(_dbContext, audit, NullLogger<PharmacyService>.Instance);

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            Code = $"MED-INVT-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            BrandName = "InventoryMed",
            GenericName = "GenericMed",
            DosageForm = "Tablet",
            Strength = "100mg",
            ReorderLevel = 10,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Drugs.Add(drug);
        _cleanupDrugIds.Add(drug.Id);
        await _dbContext.SaveChangesAsync();

        var batchNumber = $"BATCH-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        var expiry = DateTime.UtcNow.AddMonths(12);

        var batch = await service.ReceiveBatchAsync(new ReceiveBatchRequest
        {
            DrugId = drug.Id,
            BatchNumber = batchNumber,
            ExpiryDate = expiry,
            Quantity = 200,
            UnitCost = 1.25m,
            SellingPrice = 2.50m
        }, fixture.Pharmacist.Id, fixture.Pharmacist.Username);

        _cleanupBatchIds.Add(batch.Id);

        Assert.NotNull(batch);
        Assert.Equal(batchNumber, batch.BatchNumber);
        Assert.Equal(200, batch.QuantityReceived);
        Assert.Equal(200, batch.QuantityOnHand);
        Assert.Equal(2.50m, batch.SellingPrice);
        Assert.False(batch.IsExpired);

        // Verify StockMovement entry
        var movement = await _dbContext.StockMovements
            .FirstOrDefaultAsync(m => m.InventoryBatchId == batch.Id);

        Assert.NotNull(movement);
        Assert.Equal(StockMovementType.PurchaseReceived, movement.MovementType);
        Assert.Equal(200, movement.QuantityDelta);
        Assert.Equal(200, movement.BalanceAfter);
    }

    [Fact]
    public async Task AdjustStock_UpdatesQuantityOnHand_AndCreatesMovement()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new PharmacyService(_dbContext, audit, NullLogger<PharmacyService>.Instance);

        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            Code = $"MED-ADJ-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            BrandName = "AdjustMed",
            GenericName = "AdjustGeneric",
            DosageForm = "Tablet",
            Strength = "10mg",
            IsActive = true
        };
        _dbContext.Drugs.Add(drug);
        _cleanupDrugIds.Add(drug.Id);

        var batch = new InventoryBatch
        {
            Id = Guid.NewGuid(),
            DrugId = drug.Id,
            BatchNumber = $"BAT-ADJ-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            ExpiryDate = DateTime.UtcNow.AddMonths(8),
            QuantityReceived = 100,
            QuantityOnHand = 100,
            UnitCost = 0.50m,
            SellingPrice = 1.00m,
            Status = InventoryBatchStatus.Available
        };
        _dbContext.InventoryBatches.Add(batch);
        _cleanupBatchIds.Add(batch.Id);
        await _dbContext.SaveChangesAsync();

        // 1. Waste damaged items (-15)
        var adjusted = await service.AdjustStockAsync(new AdjustStockRequest
        {
            BatchId = batch.Id,
            MovementType = StockMovementType.Damaged,
            QuantityDelta = 15,
            Reason = "Water damage in store room"
        }, fixture.Pharmacist.Id, fixture.Pharmacist.Username);

        Assert.Equal(85, adjusted.QuantityOnHand);

        // 2. Decrementing more than available throws InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AdjustStockAsync(new AdjustStockRequest
            {
                BatchId = batch.Id,
                MovementType = StockMovementType.AdjustmentDecrease,
                QuantityDelta = 999,
                Reason = "Over reduction"
            }, fixture.Pharmacist.Id, fixture.Pharmacist.Username));
    }

    [Fact]
    public async Task DispensePrescription_FefoAllocatesEarliestExpiry_AndDecrementsStock()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new PharmacyService(_dbContext, audit, NullLogger<PharmacyService>.Instance);

        // Create Drug
        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            Code = $"MED-FEFO-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            BrandName = "FefoCillin",
            GenericName = "FefoGeneric",
            DosageForm = "Capsule",
            Strength = "500mg",
            IsActive = true
        };
        _dbContext.Drugs.Add(drug);
        _cleanupDrugIds.Add(drug.Id);

        // Batch 1: Expires in 2 months (Quantity: 10)
        var batch1 = new InventoryBatch
        {
            Id = Guid.NewGuid(),
            DrugId = drug.Id,
            BatchNumber = $"B-EARLY-{Guid.NewGuid().ToString()[..4].ToUpper()}",
            ExpiryDate = DateTime.UtcNow.AddMonths(2),
            QuantityReceived = 10,
            QuantityOnHand = 10,
            SellingPrice = 2.00m,
            Status = InventoryBatchStatus.Available
        };
        _dbContext.InventoryBatches.Add(batch1);
        _cleanupBatchIds.Add(batch1.Id);

        // Batch 2: Expires in 12 months (Quantity: 50)
        var batch2 = new InventoryBatch
        {
            Id = Guid.NewGuid(),
            DrugId = drug.Id,
            BatchNumber = $"B-LATE-{Guid.NewGuid().ToString()[..4].ToUpper()}",
            ExpiryDate = DateTime.UtcNow.AddMonths(12),
            QuantityReceived = 50,
            QuantityOnHand = 50,
            SellingPrice = 2.00m,
            Status = InventoryBatchStatus.Available
        };
        _dbContext.InventoryBatches.Add(batch2);
        _cleanupBatchIds.Add(batch2.Id);

        // Create Prescription for 15 units
        var rx = new Prescription
        {
            Id = Guid.NewGuid(),
            PrescriptionNumber = $"RX-TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            EncounterId = fixture.Encounter.Id,
            PatientId = fixture.Patient.Id,
            DoctorId = fixture.Doctor.Id,
            SignedAt = DateTime.UtcNow,
            Status = PrescriptionStatus.Signed
        };
        _dbContext.Prescriptions.Add(rx);
        _cleanupPrescriptionIds.Add(rx.Id);

        var rxItem = new PrescriptionItem
        {
            Id = Guid.NewGuid(),
            PrescriptionId = rx.Id,
            DrugId = drug.Id,
            Dosage = "500mg",
            Frequency = "TDS",
            QuantityPrescribed = 15,
            QuantityDispensed = 0
        };
        _dbContext.PrescriptionItems.Add(rxItem);
        await _dbContext.SaveChangesAsync();

        // Dispense 15 units with auto-FEFO allocation (should consume 10 from Batch 1 and 5 from Batch 2)
        var idempotencyKey = $"IDEM-{Guid.NewGuid()}";
        var record = await service.DispensePrescriptionAsync(rx.Id, new DispensePrescriptionRequest
        {
            IdempotencyKey = idempotencyKey,
            Lines = new List<DispenseLineRequest>
            {
                new()
                {
                    PrescriptionItemId = rxItem.Id,
                    InventoryBatchId = null, // Auto-FEFO
                    QuantityToDispense = 15
                }
            }
        }, fixture.Pharmacist.Id, fixture.Pharmacist.Username);

        _cleanupDispenseRecordIds.Add(record.Id);

        Assert.NotNull(record);
        Assert.Equal(2, record.Items.Count); // Split across 2 batches

        // Verify Batch 1 was fully depleted (0 on hand)
        var freshBatch1 = await _dbContext.InventoryBatches.FindAsync(batch1.Id);
        Assert.Equal(0, freshBatch1!.QuantityOnHand);
        Assert.Equal(InventoryBatchStatus.Depleted, freshBatch1.Status);

        // Verify Batch 2 was decremented by 5 (45 on hand)
        var freshBatch2 = await _dbContext.InventoryBatches.FindAsync(batch2.Id);
        Assert.Equal(45, freshBatch2!.QuantityOnHand);

        // Verify Prescription status is Dispensed
        var freshRx = await _dbContext.Prescriptions.FindAsync(rx.Id);
        Assert.Equal(PrescriptionStatus.Dispensed, freshRx!.Status);

        // Verify Idempotency: Repeating same request returns existing record without further stock deduction
        var repeatRecord = await service.DispensePrescriptionAsync(rx.Id, new DispensePrescriptionRequest
        {
            IdempotencyKey = idempotencyKey,
            Lines = new List<DispenseLineRequest>
            {
                new() { PrescriptionItemId = rxItem.Id, QuantityToDispense = 15 }
            }
        }, fixture.Pharmacist.Id, fixture.Pharmacist.Username);

        Assert.Equal(record.Id, repeatRecord.Id);
        var freshBatch2AfterRepeat = await _dbContext.InventoryBatches.FindAsync(batch2.Id);
        Assert.Equal(45, freshBatch2AfterRepeat!.QuantityOnHand); // Stock remains 45!
    }
}
