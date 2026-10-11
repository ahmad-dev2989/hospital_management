using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class LabTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupOrderIds = new();
    private readonly List<Guid> _cleanupTestIds = new();
    private readonly List<Guid> _cleanupEncounterIds = new();
    private readonly List<Guid> _cleanupPatientIds = new();

    public LabTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        if (_cleanupOrderIds.Count > 0)
        {
            var items = _dbContext.LabOrderItems.Where(i => _cleanupOrderIds.Contains(i.LabOrderId)).ToList();
            _dbContext.LabOrderItems.RemoveRange(items);

            var orders = _dbContext.LabOrders.Where(o => _cleanupOrderIds.Contains(o.Id)).ToList();
            _dbContext.LabOrders.RemoveRange(orders);
        }

        if (_cleanupTestIds.Count > 0)
        {
            var tests = _dbContext.LabTests.Where(t => _cleanupTestIds.Contains(t.Id)).ToList();
            _dbContext.LabTests.RemoveRange(tests);
        }

        if (_cleanupEncounterIds.Count > 0)
        {
            var encounters = _dbContext.Encounters.Where(e => _cleanupEncounterIds.Contains(e.Id)).ToList();
            _dbContext.Encounters.RemoveRange(encounters);
        }

        if (_cleanupPatientIds.Count > 0)
        {
            var patients = _dbContext.Patients.Where(p => _cleanupPatientIds.Contains(p.Id)).ToList();
            _dbContext.Patients.RemoveRange(patients);
        }

        _dbContext.SaveChanges();
        _dbContext.Dispose();
    }

    private async Task<(Patient Patient, Doctor Doctor, Encounter Encounter, LabTest Test1, LabTest Test2, UserAccount LabTech, UserAccount Admin, UserAccount Nurse)> SeedFixtureAsync()
    {
        var doctor = await _dbContext.Doctors
            .Include(d => d.User)
            .Include(d => d.Department)
            .FirstAsync(d => d.IsActive);

        var labTech = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.LabTechnician);
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);
        var nurse = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Nurse);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"TEST-PAT-{Guid.NewGuid().ToString()[..8]}",
            FirstName = "LabTest",
            LastName = "Patient",
            DateOfBirth = DateTime.SpecifyKind(new DateTime(1985, 3, 15), DateTimeKind.Utc),
            Gender = "Female",
            Phone = "555-123-9999",
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

        var test1 = new LabTest
        {
            Id = Guid.NewGuid(),
            Code = $"TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            Name = "Serum Potassium",
            Category = "Biochemistry",
            SpecimenType = "Serum",
            UnitOfMeasure = "mmol/L",
            ReferenceRange = "3.5 - 5.1",
            Price = 20.00m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.LabTests.Add(test1);
        _cleanupTestIds.Add(test1.Id);

        var test2 = new LabTest
        {
            Id = Guid.NewGuid(),
            Code = $"TEST-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            Name = "Hemoglobin A1c",
            Category = "Hematology",
            SpecimenType = "Whole Blood (EDTA)",
            UnitOfMeasure = "%",
            ReferenceRange = "4.0 - 5.6",
            Price = 30.00m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.LabTests.Add(test2);
        _cleanupTestIds.Add(test2.Id);

        await _dbContext.SaveChangesAsync();
        return (patient, doctor, encounter, test1, test2, labTech, admin, nurse);
    }

    [Fact]
    public async Task CreateLabTest_EnforcesUniqueCode_AndSavesProperly()
    {
        var admin = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var labService = new LabService(_dbContext, audit, NullLogger<LabService>.Instance);

        var code = $"TST-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        var req = new CreateLabTestRequest
        {
            Code = code,
            Name = "Troponin-I High Sensitivity",
            Category = "Cardiology",
            SpecimenType = "Serum",
            UnitOfMeasure = "ng/L",
            ReferenceRange = "< 14 ng/L",
            Price = 65.00m
        };

        var created = await labService.CreateLabTestAsync(req, admin.Id, admin.Username);
        _cleanupTestIds.Add(created.Id);

        Assert.NotNull(created);
        Assert.Equal(code, created.Code);
        Assert.Equal("Troponin-I High Sensitivity", created.Name);
        Assert.Equal(65.00m, created.Price);
        Assert.True(created.IsActive);

        // Attempt duplicate code
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            labService.CreateLabTestAsync(req, admin.Id, admin.Username));
    }

    [Fact]
    public async Task CreateLabOrder_GeneratesSequentialNumber_AndItemBarcodes()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var labService = new LabService(_dbContext, audit, NullLogger<LabService>.Instance);

        var req = new CreateLabOrderRequest
        {
            EncounterId = fixture.Encounter.Id,
            Priority = LabPriority.Urgent,
            TestIds = new List<Guid> { fixture.Test1.Id, fixture.Test2.Id }
        };

        var order = await labService.CreateLabOrderAsync(req, fixture.Doctor.UserId, fixture.Doctor.User.Username);
        _cleanupOrderIds.Add(order.Id);

        Assert.NotNull(order);
        Assert.StartsWith($"LAB-{DateTime.UtcNow.Year}-", order.OrderNumber);
        Assert.Equal(LabOrderStatus.Ordered, order.Status);
        Assert.Equal(LabPriority.Urgent, order.Priority);
        Assert.Equal(2, order.Items.Count);
        Assert.Equal(50.00m, order.TotalPrice);

        // Verify specimen barcode format
        foreach (var item in order.Items)
        {
            Assert.NotNull(item.SpecimenBarcode);
            Assert.StartsWith($"SP-{DateTime.UtcNow.Year}-", item.SpecimenBarcode);
            Assert.Null(item.SpecimenCollectedAt);
        }
    }

    [Fact]
    public async Task SpecimenCollection_And_ReceivingWorkflow_AdvancesStatuses()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var labService = new LabService(_dbContext, audit, NullLogger<LabService>.Instance);

        var order = await labService.CreateLabOrderAsync(new CreateLabOrderRequest
        {
            EncounterId = fixture.Encounter.Id,
            Priority = LabPriority.Routine,
            TestIds = new List<Guid> { fixture.Test1.Id }
        }, fixture.Doctor.UserId, fixture.Doctor.User.Username);
        _cleanupOrderIds.Add(order.Id);

        // 1. Collect Specimen
        var collected = await labService.CollectSpecimenAsync(order.Id, new CollectSpecimenRequest(), fixture.Nurse.Id, fixture.Nurse.Username);
        Assert.Equal(LabOrderStatus.Collected, collected.Status);
        Assert.NotNull(collected.Items[0].SpecimenCollectedAt);

        // 2. Receive Specimen in Lab
        var received = await labService.ReceiveSpecimenAsync(order.Id, fixture.LabTech.Id, fixture.LabTech.Username);
        Assert.Equal(LabOrderStatus.Processing, received.Status);
    }

    [Fact]
    public async Task RecordResults_And_VerifyAndRelease_EnforcesImmutability()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var labService = new LabService(_dbContext, audit, NullLogger<LabService>.Instance);

        var order = await labService.CreateLabOrderAsync(new CreateLabOrderRequest
        {
            EncounterId = fixture.Encounter.Id,
            Priority = LabPriority.Routine,
            TestIds = new List<Guid> { fixture.Test1.Id }
        }, fixture.Doctor.UserId, fixture.Doctor.User.Username);
        _cleanupOrderIds.Add(order.Id);

        var itemId = order.Items[0].Id;

        // 1. Record Draft Results
        var withResults = await labService.RecordResultsAsync(order.Id, new RecordLabResultsRequest
        {
            Results = new List<RecordLabResultItemRequest>
            {
                new()
                {
                    LabOrderItemId = itemId,
                    ResultValue = "6.2",
                    ResultUnit = "mmol/L",
                    IsAbnormal = true,
                    Comments = "Critical hyperkalemia. Repeated and confirmed."
                }
            }
        }, fixture.LabTech.Id, fixture.LabTech.Username);

        Assert.Equal(LabOrderStatus.DraftResult, withResults.Status);
        Assert.Equal("6.2", withResults.Items[0].ResultValue);
        Assert.True(withResults.Items[0].IsAbnormal);

        // 2. Two-Step Verification & Release
        var released = await labService.VerifyAndReleaseOrderAsync(order.Id, new VerifyLabResultsRequest
        {
            ReleaseImmediately = true,
            VerificationNotes = "Verified by senior clinical pathologist"
        }, fixture.Doctor.UserId, fixture.Doctor.User.Username);

        Assert.Equal(LabOrderStatus.Released, released.Status);
        Assert.Equal(fixture.Doctor.UserId, released.Items[0].VerifiedByUserId);
        Assert.NotNull(released.Items[0].VerifiedAt);

        // 3. Immutability: Attempting to edit results on released order must throw InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            labService.RecordResultsAsync(order.Id, new RecordLabResultsRequest
            {
                Results = new List<RecordLabResultItemRequest>
                {
                    new()
                    {
                        LabOrderItemId = itemId,
                        ResultValue = "4.0",
                        IsAbnormal = false
                    }
                }
            }, fixture.LabTech.Id, fixture.LabTech.Username));

        // 4. Immutability: Attempting to cancel released order must throw InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            labService.CancelOrderAsync(order.Id, new CancelLabOrderRequest { Reason = "Mistake" }, fixture.Admin.Id, fixture.Admin.Username));
    }

    [Fact]
    public async Task Verification_RequiresAllResultsToBeEntered()
    {
        var fixture = await SeedFixtureAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var labService = new LabService(_dbContext, audit, NullLogger<LabService>.Instance);

        var order = await labService.CreateLabOrderAsync(new CreateLabOrderRequest
        {
            EncounterId = fixture.Encounter.Id,
            Priority = LabPriority.Routine,
            TestIds = new List<Guid> { fixture.Test1.Id, fixture.Test2.Id }
        }, fixture.Doctor.UserId, fixture.Doctor.User.Username);
        _cleanupOrderIds.Add(order.Id);

        // Only record result for Test 1, leaving Test 2 blank
        await labService.RecordResultsAsync(order.Id, new RecordLabResultsRequest
        {
            Results = new List<RecordLabResultItemRequest>
            {
                new()
                {
                    LabOrderItemId = order.Items[0].Id,
                    ResultValue = "4.2"
                }
            }
        }, fixture.LabTech.Id, fixture.LabTech.Username);

        // Attempting to verify incomplete order must throw InvalidOperationException
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            labService.VerifyAndReleaseOrderAsync(order.Id, new VerifyLabResultsRequest(), fixture.Doctor.UserId, fixture.Doctor.User.Username));

        Assert.Contains("missing result values", ex.Message);
    }
}
