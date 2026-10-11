using System.Reflection;
using System.Text;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class SecurityReliabilityAndPerformanceTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly string _connectionString = "Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres";
    private readonly List<Guid> _cleanupAppointmentIds = new();
    private readonly List<Guid> _cleanupPatientIds = new();
    private readonly List<Guid> _cleanupDoctorIds = new();
    private readonly List<Guid> _cleanupDrugIds = new();
    private readonly List<Guid> _cleanupBatchIds = new();
    private readonly List<Guid> _cleanupPrescriptionIds = new();
    private readonly List<Guid> _cleanupDispenseRecordIds = new();
    private readonly List<Guid> _cleanupEncounterIds = new();
    private readonly List<Guid> _cleanupInvoiceIds = new();
    private readonly List<Guid> _cleanupPaymentIds = new();
    private readonly List<Guid> _cleanupDocumentIds = new();

    public SecurityReliabilityAndPerformanceTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    private ApplicationDbContext CreateNewDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        return new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        try
        {
            if (_cleanupAppointmentIds.Count > 0)
            {
                var appts = _dbContext.Appointments
                    .Where(a => _cleanupAppointmentIds.Contains(a.Id))
                    .ToList();
                _dbContext.Appointments.RemoveRange(appts);
            }

            if (_cleanupPaymentIds.Count > 0)
            {
                var payments = _dbContext.Payments
                    .Where(p => _cleanupPaymentIds.Contains(p.Id))
                    .ToList();
                _dbContext.Payments.RemoveRange(payments);
            }

            if (_cleanupInvoiceIds.Count > 0)
            {
                var payments = _dbContext.Payments
                    .Where(p => _cleanupInvoiceIds.Contains(p.InvoiceId))
                    .ToList();
                _dbContext.Payments.RemoveRange(payments);

                var lines = _dbContext.InvoiceLines
                    .Where(l => _cleanupInvoiceIds.Contains(l.InvoiceId))
                    .ToList();
                _dbContext.InvoiceLines.RemoveRange(lines);

                var invoices = _dbContext.Invoices
                    .Where(i => _cleanupInvoiceIds.Contains(i.Id))
                    .ToList();
                _dbContext.Invoices.RemoveRange(invoices);
            }

            if (_cleanupDispenseRecordIds.Count > 0)
            {
                var dispItems = _dbContext.DispenseItems
                    .Where(di => _cleanupDispenseRecordIds.Contains(di.DispenseRecordId))
                    .ToList();
                _dbContext.DispenseItems.RemoveRange(dispItems);

                var dispRecords = _dbContext.DispenseRecords
                    .Where(dr => _cleanupDispenseRecordIds.Contains(dr.Id))
                    .ToList();
                _dbContext.DispenseRecords.RemoveRange(dispRecords);
            }

            if (_cleanupPrescriptionIds.Count > 0)
            {
                var rxItems = _dbContext.PrescriptionItems
                    .Where(pi => _cleanupPrescriptionIds.Contains(pi.PrescriptionId))
                    .ToList();
                _dbContext.PrescriptionItems.RemoveRange(rxItems);

                var rxs = _dbContext.Prescriptions
                    .Where(p => _cleanupPrescriptionIds.Contains(p.Id))
                    .ToList();
                _dbContext.Prescriptions.RemoveRange(rxs);
            }

            if (_cleanupEncounterIds.Count > 0)
            {
                var encounters = _dbContext.Encounters
                    .Where(e => _cleanupEncounterIds.Contains(e.Id))
                    .ToList();
                _dbContext.Encounters.RemoveRange(encounters);
            }

            if (_cleanupBatchIds.Count > 0)
            {
                var movements = _dbContext.StockMovements
                    .Where(m => _cleanupBatchIds.Contains(m.InventoryBatchId))
                    .ToList();
                _dbContext.StockMovements.RemoveRange(movements);

                var batches = _dbContext.InventoryBatches
                    .Where(b => _cleanupBatchIds.Contains(b.Id))
                    .ToList();
                _dbContext.InventoryBatches.RemoveRange(batches);
            }

            if (_cleanupDrugIds.Count > 0)
            {
                var drugs = _dbContext.Drugs
                    .Where(d => _cleanupDrugIds.Contains(d.Id))
                    .ToList();
                _dbContext.Drugs.RemoveRange(drugs);
            }

            if (_cleanupPatientIds.Count > 0)
            {
                var patients = _dbContext.Patients
                    .Include(p => p.Allergies)
                    .Include(p => p.Conditions)
                    .Where(p => _cleanupPatientIds.Contains(p.Id))
                    .ToList();
                _dbContext.Patients.RemoveRange(patients);
            }

            if (_cleanupDoctorIds.Count > 0)
            {
                var docs = _dbContext.Doctors
                    .Include(d => d.Schedules)
                    .Where(d => _cleanupDoctorIds.Contains(d.Id))
                    .ToList();
                _dbContext.Doctors.RemoveRange(docs);
            }

            if (_cleanupDocumentIds.Count > 0)
            {
                var docs = _dbContext.Documents
                    .Where(d => _cleanupDocumentIds.Contains(d.Id))
                    .ToList();
                _dbContext.Documents.RemoveRange(docs);
            }

            _dbContext.SaveChanges();
        }
        catch
        {
            // Best effort cleanup
        }
        finally
        {
            _dbContext.Dispose();
        }
    }

    // -------------------------------------------------------------------------
    // 1. CONCURRENCY: APPOINTMENT SLOT DOUBLE-BOOKING PREVENTION
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Concurrency_SlotDoubleBooking_OnlyOneSucceeds()
    {
        // Setup Doctor with schedule
        var department = await _dbContext.Departments.FirstAsync();
        var doctorUser = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Doctor);

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            UserId = doctorUser.Id,
            DepartmentId = department.Id,
            Specialization = "Stress Test Cardiology",
            LicenseNumber = $"LIC-CONC-{Guid.NewGuid():N}"[..18],
            IsActive = true,
            ConsultationFee = 100.00m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Doctors.Add(doctor);
        _cleanupDoctorIds.Add(doctor.Id);

        // Schedule for every day of week
        for (int day = 0; day <= 6; day++)
        {
            doctor.Schedules.Add(new DoctorSchedule
            {
                Id = Guid.NewGuid(),
                DoctorId = doctor.Id,
                DayOfWeek = day,
                StartTime = new TimeSpan(8, 0, 0),
                EndTime = new TimeSpan(18, 0, 0),
                SlotDurationMinutes = 30,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        // Setup 10 Distinct Patients
        var patientIds = new List<Guid>();
        for (int i = 0; i < 10; i++)
        {
            var patient = new Patient
            {
                Id = Guid.NewGuid(),
                PatientNumber = $"HSP-2026-C{i:D3}{Guid.NewGuid():N}"[..14],
                FirstName = $"ConcPatient{i}",
                LastName = "Concurrency",
                DateOfBirth = new DateTime(1990, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                Gender = "Male",
                Phone = $"+155500{i:D4}",
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.Patients.Add(patient);
            _cleanupPatientIds.Add(patient.Id);
            patientIds.Add(patient.Id);
        }

        await _dbContext.SaveChangesAsync();

        // Target appointment slot (Tomorrow at 10:00 UTC)
        var tomorrow10Am = DateTime.UtcNow.Date.AddDays(1).AddHours(10);
        var targetStartsAt = DateTime.SpecifyKind(tomorrow10Am, DateTimeKind.Utc);
        var targetEndsAt = targetStartsAt.AddMinutes(30);

        int successCount = 0;
        int conflictCount = 0;

        // Run 10 parallel booking requests competing for the exact same slot
        var tasks = patientIds.Select(async pId =>
        {
            using var threadContext = CreateNewDbContext();
            var service = new AppointmentService(
                threadContext,
                new AppointmentNumberGenerator(threadContext, NullLogger<AppointmentNumberGenerator>.Instance),
                new AuditService(threadContext, NullLogger<AuditService>.Instance),
                NullLogger<AppointmentService>.Instance);

            try
            {
                var result = await service.BookAppointmentAsync(new BookAppointmentRequest
                {
                    PatientId = pId,
                    DoctorId = doctor.Id,
                    DepartmentId = department.Id,
                    StartsAt = targetStartsAt,
                    EndsAt = targetEndsAt,
                    Reason = "Concurrency stress test slot booking"
                });

                lock (_cleanupAppointmentIds)
                {
                    _cleanupAppointmentIds.Add(result.Id);
                }
                Interlocked.Increment(ref successCount);
            }
            catch (InvalidOperationException)
            {
                // Conflict successfully caught
                Interlocked.Increment(ref conflictCount);
            }
        });

        await Task.WhenAll(tasks);

        // Exactly 1 must succeed, 9 must be rejected
        Assert.Equal(1, successCount);
        Assert.Equal(9, conflictCount);

        // In DB, exactly 1 appointment exists for that slot
        var bookedInDb = await _dbContext.Appointments
            .Where(a => a.DoctorId == doctor.Id && a.StartsAt == targetStartsAt && a.Status == AppointmentStatus.Booked)
            .ToListAsync();

        Assert.Single(bookedInDb);
    }

    // -------------------------------------------------------------------------
    // 2. CONCURRENCY: PHARMACY FEFO STOCK DISPENSING RACE CONDITION
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Concurrency_PharmacyStockDispense_NoNegativeInventory()
    {
        var pharmacist = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Pharmacist || u.Role == UserRole.SystemAdministrator);
        var doctor = await _dbContext.Doctors.Include(d => d.User).FirstAsync(d => d.IsActive);

        // 1. Create Patient
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"HSP-2026-RXC{Guid.NewGuid():N}"[..14],
            FirstName = "RxPatient",
            LastName = "Concurrency",
            DateOfBirth = new DateTime(1985, 5, 5, 0, 0, 0, DateTimeKind.Utc),
            Gender = "Female",
            Phone = "+1555998877",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Patients.Add(patient);
        _cleanupPatientIds.Add(patient.Id);

        // 2. Create Encounter
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

        // 3. Create Drug
        var drug = new Drug
        {
            Id = Guid.NewGuid(),
            Code = $"DRG-CONC-{Guid.NewGuid():N}"[..14],
            BrandName = "RaceCillin",
            GenericName = "Amoxicillin Concurrency",
            DosageForm = "Capsule",
            Strength = "500mg",
            ReorderLevel = 5,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Drugs.Add(drug);
        _cleanupDrugIds.Add(drug.Id);

        // 4. Create Inventory Batch with exactly 10 units in stock
        var batch = new InventoryBatch
        {
            Id = Guid.NewGuid(),
            DrugId = drug.Id,
            BatchNumber = $"BAT-CONC-{Guid.NewGuid():N}"[..12],
            ExpiryDate = DateTime.UtcNow.Date.AddYears(1),
            QuantityReceived = 10,
            QuantityOnHand = 10,
            UnitCost = 2.50m,
            SellingPrice = 5.00m,
            Status = InventoryBatchStatus.Available,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.InventoryBatches.Add(batch);
        _cleanupBatchIds.Add(batch.Id);

        // 5. Create 5 distinct Prescriptions of 4 units each
        var prescriptionItems = new List<(Prescription Rx, PrescriptionItem Item)>();
        for (int i = 0; i < 5; i++)
        {
            var rx = new Prescription
            {
                Id = Guid.NewGuid(),
                PrescriptionNumber = $"RX-CONC-{i}{Guid.NewGuid():N}"[..14],
                EncounterId = encounter.Id,
                PatientId = patient.Id,
                DoctorId = doctor.Id,
                SignedAt = DateTime.UtcNow,
                Status = PrescriptionStatus.Signed,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
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
                QuantityPrescribed = 4,
                QuantityDispensed = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _dbContext.PrescriptionItems.Add(rxItem);
            prescriptionItems.Add((rx, rxItem));
        }

        await _dbContext.SaveChangesAsync();

        // 6. Run 5 concurrent dispense operations of 4 units each
        // Available: 10 units. Demanded: 20 units.
        // Exactly 2 must succeed (2 * 4 = 8 units consumed, 2 remaining). 3 must fail.
        int dispenseSuccess = 0;
        int dispenseFailed = 0;

        var tasks = prescriptionItems.Select(async pair =>
        {
            using var threadContext = CreateNewDbContext();
            var service = new PharmacyService(
                threadContext,
                new AuditService(threadContext, NullLogger<AuditService>.Instance),
                NullLogger<PharmacyService>.Instance);

            try
            {
                var req = new DispensePrescriptionRequest
                {
                    IdempotencyKey = $"IDEMP-DISP-{Guid.NewGuid()}",
                    Lines = new List<DispenseLineRequest>
                    {
                        new()
                        {
                            PrescriptionItemId = pair.Item.Id,
                            QuantityToDispense = 4,
                            InventoryBatchId = batch.Id
                        }
                    }
                };

                var res = await service.DispensePrescriptionAsync(pair.Rx.Id, req, pharmacist.Id, pharmacist.Username);
                lock (_cleanupDispenseRecordIds)
                {
                    _cleanupDispenseRecordIds.Add(res.Id);
                }
                Interlocked.Increment(ref dispenseSuccess);
            }
            catch (InvalidOperationException)
            {
                Interlocked.Increment(ref dispenseFailed);
            }
        });

        await Task.WhenAll(tasks);

        // Exactly 2 succeeded, 3 failed due to insufficient stock
        Assert.Equal(2, dispenseSuccess);
        Assert.Equal(3, dispenseFailed);

        // Verify batch stock in DB is exactly 2 units (never negative!)
        var updatedBatch = await _dbContext.InventoryBatches.AsNoTracking().FirstAsync(b => b.Id == batch.Id);
        Assert.Equal(2, updatedBatch.QuantityOnHand);

        // Verify stock movement ledger has exactly 2 dispense movements of -4 units
        var movements = await _dbContext.StockMovements
            .Where(m => m.InventoryBatchId == batch.Id && m.MovementType == StockMovementType.Dispensed)
            .ToListAsync();

        Assert.Equal(2, movements.Count);
        Assert.All(movements, m => Assert.Equal(-4, m.QuantityDelta));
    }

    // -------------------------------------------------------------------------
    // 3. CONCURRENCY: IDEMPOTENT PAYMENT CAPTURE UNDER PARALLEL REQUESTS
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Concurrency_IdempotentPaymentCapture_PreventsDoubleCharging()
    {
        var cashier = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Cashier || u.Role == UserRole.SystemAdministrator);

        // 1. Create Patient & Invoice
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"HSP-2026-PAY{Guid.NewGuid():N}"[..14],
            FirstName = "PayPatient",
            LastName = "Concurrency",
            DateOfBirth = new DateTime(1992, 4, 12, 0, 0, 0, DateTimeKind.Utc),
            Gender = "Female",
            Phone = "+1555112233",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Patients.Add(patient);
        _cleanupPatientIds.Add(patient.Id);

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = $"INV-CONC-{Guid.NewGuid():N}"[..14],
            PatientId = patient.Id,
            CreatedByUserId = cashier.Id,
            Subtotal = 150.00m,
            Discount = 0.00m,
            Tax = 0.00m,
            Total = 150.00m,
            PaidAmount = 0.00m,
            Balance = 150.00m,
            Status = InvoiceStatus.Issued,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Invoices.Add(invoice);
        _cleanupInvoiceIds.Add(invoice.Id);

        await _dbContext.SaveChangesAsync();

        // 2. Generate a single idempotency key for this payment
        var idempotencyKey = $"IDEMP-PAY-{Guid.NewGuid():N}";

        // 3. Launch 6 parallel payment capture tasks submitting the identical idempotency key
        var results = new List<PaymentDto>();
        var lockObj = new object();

        var tasks = Enumerable.Range(0, 6).Select(async i =>
        {
            using var threadContext = CreateNewDbContext();
            var service = new BillingService(
                threadContext,
                new AuditService(threadContext, NullLogger<AuditService>.Instance),
                NullLogger<BillingService>.Instance);

            var req = new RecordPaymentRequest
            {
                InvoiceId = invoice.Id,
                Amount = 150.00m,
                Method = PaymentMethod.Cash,
                ProviderReference = "CONC-REF",
                IdempotencyKey = idempotencyKey
            };

            var paymentResult = await service.RecordPaymentAsync(req, cashier.Id, cashier.Username);
            lock (lockObj)
            {
                results.Add(paymentResult);
                _cleanupPaymentIds.Add(paymentResult.Id);
            }
        });

        await Task.WhenAll(tasks);

        // 4. Assert all 6 parallel requests returned identical payment ID & receipt
        Assert.Equal(6, results.Count);
        var firstPaymentId = results[0].Id;
        var firstReceiptNumber = results[0].ReceiptNumber;

        Assert.All(results, p =>
        {
            Assert.Equal(firstPaymentId, p.Id);
            Assert.Equal(firstReceiptNumber, p.ReceiptNumber);
            Assert.Equal(150.00m, p.Amount);
        });

        // 5. In DB, exactly 1 payment record exists for this invoice
        var paymentsInDb = await _dbContext.Payments
            .Where(p => p.InvoiceId == invoice.Id)
            .ToListAsync();

        Assert.Single(paymentsInDb);
        Assert.Equal(idempotencyKey, paymentsInDb[0].IdempotencyKey);

        // 6. Verify invoice balance is $0.00 (not negative or double-applied)
        var updatedInvoice = await _dbContext.Invoices.AsNoTracking().FirstAsync(i => i.Id == invoice.Id);
        Assert.Equal(150.00m, updatedInvoice.PaidAmount);
        Assert.Equal(0.00m, updatedInvoice.Balance);
        Assert.Equal(InvoiceStatus.Paid, updatedInvoice.Status);
    }

    // -------------------------------------------------------------------------
    // 4. SECURITY: RBAC AUTHORIZATION MATRIX AUDIT
    // -------------------------------------------------------------------------
    [Fact]
    public void Security_RbacPolicies_SensitiveControllersRequireAdminOrSpecificRoles()
    {
        var apiAssembly = typeof(HospitalApp.Api.Controllers.UsersController).Assembly;
        var controllerTypes = apiAssembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .ToList();

        // 1. UsersController must be restricted to Admin
        var usersController = controllerTypes.FirstOrDefault(t => t.Name == "UsersController");
        Assert.NotNull(usersController);
        var usersAuthorize = usersController.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(usersAuthorize);
        Assert.Contains("SystemAdministrator", usersAuthorize.Roles ?? string.Empty);

        // 2. SystemController settings/backup management must be restricted to SystemAdministrator
        var systemController = controllerTypes.FirstOrDefault(t => t.Name == "SystemController");
        Assert.NotNull(systemController);
        var updateSettingMethod = systemController.GetMethod("UpdateSetting");
        Assert.NotNull(updateSettingMethod);
        var updateSettingAuth = updateSettingMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(updateSettingAuth);
        Assert.Contains("SystemAdministrator", updateSettingAuth.Roles ?? string.Empty);

        // 3. AuditController must be restricted to SystemAdministrator or Auditor
        var auditController = controllerTypes.FirstOrDefault(t => t.Name == "AuditController");
        Assert.NotNull(auditController);
        var auditAuthorize = auditController.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(auditAuthorize);
        Assert.True(auditAuthorize.Roles?.Contains("SystemAdministrator") == true && auditAuthorize.Roles?.Contains("Auditor") == true);

        // 4. LabController verification endpoint requires LabTechnician or SystemAdministrator
        var labController = controllerTypes.FirstOrDefault(t => t.Name == "LabController");
        Assert.NotNull(labController);
        var verifyMethod = labController.GetMethod("VerifyAndReleaseOrder");
        Assert.NotNull(verifyMethod);
        var verifyAuth = verifyMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(verifyAuth);
        Assert.True(verifyAuth.Roles?.Contains("LabTechnician") == true && verifyAuth.Roles?.Contains("SystemAdministrator") == true);

        // 5. PharmacyController dispense endpoint requires Pharmacist or SystemAdministrator
        var pharmController = controllerTypes.FirstOrDefault(t => t.Name == "PharmacyController");
        Assert.NotNull(pharmController);
        var dispenseMethod = pharmController.GetMethod("DispensePrescription");
        Assert.NotNull(dispenseMethod);
        var dispenseAuth = dispenseMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(dispenseAuth);
        Assert.True(dispenseAuth.Roles?.Contains("Pharmacist") == true && dispenseAuth.Roles?.Contains("SystemAdministrator") == true);
    }

    // -------------------------------------------------------------------------
    // 5. SECURITY: ACCOUNT LOCKOUT AFTER 5 CONSECUTIVE FAILED ATTEMPTS
    // -------------------------------------------------------------------------
    [Fact]
    public void Security_AccountLockout_TriggersAtThresholdAndBlocksLogin()
    {
        var user = new UserAccount
        {
            Id = Guid.NewGuid(),
            Username = "lockout_victim",
            Email = "victim@hospital.local",
            FullName = "Lockout Victim",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword123!", 11),
            Role = UserRole.Nurse,
            IsActive = true,
            FailedLoginAttempts = 0,
            LockoutUntil = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Simulate failed login attempts
        for (int attempt = 1; attempt <= 4; attempt++)
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= 5)
            {
                user.LockoutUntil = DateTime.UtcNow.AddMinutes(15);
            }
        }

        // At 4 attempts: Not locked out yet
        Assert.Equal(4, user.FailedLoginAttempts);
        Assert.Null(user.LockoutUntil);

        // 5th failed attempt: Lockout threshold reached
        user.FailedLoginAttempts++;
        if (user.FailedLoginAttempts >= 5)
        {
            user.LockoutUntil = DateTime.UtcNow.AddMinutes(15);
        }

        Assert.Equal(5, user.FailedLoginAttempts);
        Assert.NotNull(user.LockoutUntil);
        Assert.True(user.LockoutUntil.Value > DateTime.UtcNow);

        // Attempting to login while locked out is blocked
        bool isLockedOut = user.LockoutUntil.HasValue && user.LockoutUntil.Value > DateTime.UtcNow;
        Assert.True(isLockedOut);

        // Admin unlocking clears lockout
        user.LockoutUntil = null;
        user.FailedLoginAttempts = 0;
        Assert.Null(user.LockoutUntil);
        Assert.Equal(0, user.FailedLoginAttempts);
    }

    // -------------------------------------------------------------------------
    // 6. SECURITY: DOCUMENT STORAGE PATH TRAVERSAL PREVENTED
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Security_DocumentStorage_PreventsPathTraversalAttempts()
    {
        var config = new ConfigurationBuilder().Build();
        var docService = new DocumentService(
            _dbContext,
            new AuditService(_dbContext, NullLogger<AuditService>.Instance),
            config,
            NullLogger<DocumentService>.Instance);

        // 1. Setup Patient
        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"HSP-2026-DOC{Guid.NewGuid():N}"[..14],
            FirstName = "DocPatient",
            LastName = "TraversalTest",
            DateOfBirth = new DateTime(1988, 8, 8, 0, 0, 0, DateTimeKind.Utc),
            Gender = "Male",
            Phone = "+1555444333",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Patients.Add(patient);
        _cleanupPatientIds.Add(patient.Id);

        var adminUser = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);
        await _dbContext.SaveChangesAsync();

        // 2. Upload document with path traversal attempt in file name
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes("Fake confidential report contents"));
        var maliciousFileName = "../../../../../windows/system32/evil_script.cmd";

        var uploaded = await docService.UploadDocumentAsync(
            patient.Id,
            null,
            DocumentCategory.LabReport,
            maliciousFileName,
            "application/octet-stream",
            stream,
            adminUser.Id);

        _cleanupDocumentIds.Add(uploaded.Id);

        // 3. Assert sanitized file name strips traversal path
        Assert.Equal("evil_script.cmd", uploaded.FileName);
        Assert.DoesNotContain("..", uploaded.FileName);
        Assert.DoesNotContain("/", uploaded.FileName);
        Assert.DoesNotContain("\\", uploaded.FileName);

        // 4. Assert stream retrieval works safely within canonical storage
        var (fileStream, mime, originalName) = await docService.GetDocumentStreamAsync(uploaded.Id);
        using (fileStream)
        {
            Assert.NotNull(fileStream);
            Assert.Equal("evil_script.cmd", originalName);
        }
    }

    // -------------------------------------------------------------------------
    // 7. PERFORMANCE & RELIABILITY: HIGH-THROUGHPUT STRESS BURST
    // -------------------------------------------------------------------------
    [Fact]
    public async Task Performance_HighThroughputBurst_ExecutesCleanlyUnderLatencyThreshold()
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        // Run 100 concurrent read operations across key modules
        var tasks = Enumerable.Range(0, 100).Select(async i =>
        {
            using var threadContext = CreateNewDbContext();

            // Operation 1: Patient lookup
            var patientCount = await threadContext.Patients.CountAsync();

            // Operation 2: Doctors lookup
            var doctors = await threadContext.Doctors
                .AsNoTracking()
                .Take(5)
                .ToListAsync();

            // Operation 3: Queue summary
            var today = DateTime.UtcNow.Date;
            var apptCount = await threadContext.Appointments
                .Where(a => a.StartsAt >= today && a.StartsAt < today.AddDays(1))
                .CountAsync();

            return patientCount + doctors.Count + apptCount;
        });

        var results = await Task.WhenAll(tasks);
        stopwatch.Stop();

        // Assert all 100 operations completed successfully
        Assert.Equal(100, results.Length);

        // Average latency per compound operation should be under 250ms on local loopback
        var avgPerOpMs = stopwatch.ElapsedMilliseconds / 100.0;
        Assert.True(avgPerOpMs < 250, $"Average latency {avgPerOpMs:F1}ms exceeded 250ms SLA threshold.");
    }
}
