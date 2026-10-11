using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class BillingTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupServiceIds = new();
    private readonly List<Guid> _cleanupInvoiceIds = new();
    private readonly List<Guid> _cleanupPatientIds = new();
    private readonly List<Guid> _cleanupDoctorIds = new();
    private readonly List<Guid> _cleanupEncounterIds = new();

    public BillingTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        if (_cleanupInvoiceIds.Count > 0)
        {
            var payments = _dbContext.Payments.Where(p => _cleanupInvoiceIds.Contains(p.InvoiceId)).ToList();
            var paymentIds = payments.Select(p => p.Id).ToList();

            var refunds = _dbContext.Refunds.Where(r => paymentIds.Contains(r.PaymentId)).ToList();
            _dbContext.Refunds.RemoveRange(refunds);
            _dbContext.Payments.RemoveRange(payments);

            var lines = _dbContext.InvoiceLines.Where(l => _cleanupInvoiceIds.Contains(l.InvoiceId)).ToList();
            _dbContext.InvoiceLines.RemoveRange(lines);

            var invoices = _dbContext.Invoices.Where(i => _cleanupInvoiceIds.Contains(i.Id)).ToList();
            _dbContext.Invoices.RemoveRange(invoices);
        }

        if (_cleanupEncounterIds.Count > 0)
        {
            var encounters = _dbContext.Encounters.Where(e => _cleanupEncounterIds.Contains(e.Id)).ToList();
            _dbContext.Encounters.RemoveRange(encounters);
        }

        if (_cleanupDoctorIds.Count > 0)
        {
            var doctors = _dbContext.Doctors.Where(d => _cleanupDoctorIds.Contains(d.Id)).ToList();
            _dbContext.Doctors.RemoveRange(doctors);
        }

        if (_cleanupPatientIds.Count > 0)
        {
            var patients = _dbContext.Patients.Where(p => _cleanupPatientIds.Contains(p.Id)).ToList();
            _dbContext.Patients.RemoveRange(patients);
        }

        if (_cleanupServiceIds.Count > 0)
        {
            var services = _dbContext.ServiceItems.Where(s => _cleanupServiceIds.Contains(s.Id)).ToList();
            _dbContext.ServiceItems.RemoveRange(services);
        }

        _dbContext.SaveChanges();
        _dbContext.Dispose();
    }

    private async Task<(UserAccount staff, Patient patient)> SetupSeedDataAsync()
    {
        var staff = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"TST-PAT-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            FirstName = "Billing",
            LastName = "TestPatient",
            Gender = "Female",
            DateOfBirth = new DateTime(1992, 4, 12, 0, 0, 0, DateTimeKind.Utc),
            Phone = "+15550009999",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Patients.Add(patient);
        await _dbContext.SaveChangesAsync();
        _cleanupPatientIds.Add(patient.Id);

        return (staff, patient);
    }

    [Fact]
    public async Task CreateService_ShouldPersist_AndEnforceUniqueCode()
    {
        var (staff, _) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var code = $"SRV-TST-{Guid.NewGuid().ToString()[..4].ToUpper()}";
        var req = new CreateServiceItemRequest
        {
            Code = code,
            Name = "Diagnostic Ultrasound Scan",
            Category = "Imaging",
            DefaultPrice = 85.50m
        };

        var created = await service.CreateServiceAsync(req, staff.Id, staff.Username);
        _cleanupServiceIds.Add(created.Id);

        Assert.Equal(code, created.Code);
        Assert.Equal(85.50m, created.DefaultPrice);
        Assert.True(created.IsActive);

        // Duplicate code must fail
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateServiceAsync(req, staff.Id, staff.Username));
    }

    [Fact]
    public async Task CreateInvoice_ShouldCalculateSubtotalTaxDiscountAndTotal_WithExactDecimalArithmetic()
    {
        var (staff, patient) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var req = new CreateInvoiceRequest
        {
            PatientId = patient.Id,
            Discount = 15.00m,
            TaxPercentage = 10.00m, // 10% tax
            Lines = new List<CreateInvoiceLineRequest>
            {
                new()
                {
                    SourceType = "Service",
                    ItemDescription = "General Practitioner Consultation",
                    Quantity = 2,
                    UnitPrice = 35.00m // $70.00
                },
                new()
                {
                    SourceType = "Diagnostics",
                    ItemDescription = "ECG Diagnostic Test",
                    Quantity = 1,
                    UnitPrice = 45.00m // $45.00
                }
            }
        };

        var invoice = await service.CreateInvoiceAsync(req, staff.Id, staff.Username);
        _cleanupInvoiceIds.Add(invoice.Id);

        // Subtotal = 70 + 45 = 115.00
        Assert.Equal(115.00m, invoice.Subtotal);
        Assert.Equal(15.00m, invoice.Discount);
        // Taxable = 115 - 15 = 100.00 -> 10% tax = 10.00
        Assert.Equal(10.00m, invoice.Tax);
        // Total = 100 + 10 = 110.00
        Assert.Equal(110.00m, invoice.Total);
        Assert.Equal(0.00m, invoice.PaidAmount);
        Assert.Equal(110.00m, invoice.Balance);
        Assert.Equal(InvoiceStatus.Issued, invoice.Status);
        Assert.StartsWith("INV-", invoice.InvoiceNumber);
        Assert.Equal(2, invoice.Lines.Count);
    }

    [Fact]
    public async Task GenerateInvoiceFromEncounter_ShouldAggregateConsultationFee()
    {
        var (staff, patient) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var doctorUser = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Doctor);
        var dept = await _dbContext.Departments.FirstAsync();

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            UserId = doctorUser.Id,
            DepartmentId = dept.Id,
            LicenseNumber = $"DOC-LIC-{Guid.NewGuid().ToString()[..6]}",
            Specialization = "Cardiology",
            ConsultationFee = 60.00m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Doctors.Add(doctor);
        await _dbContext.SaveChangesAsync();
        _cleanupDoctorIds.Add(doctor.Id);

        var encounter = new Encounter
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            DoctorId = doctor.Id,
            Status = EncounterStatus.Draft,
            StartedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Encounters.Add(encounter);
        await _dbContext.SaveChangesAsync();
        _cleanupEncounterIds.Add(encounter.Id);

        var genReq = new GenerateEncounterInvoiceRequest
        {
            Discount = 0m,
            TaxPercentage = 0m
        };

        var invoice = await service.GenerateInvoiceFromEncounterAsync(encounter.Id, genReq, staff.Id, staff.Username);
        _cleanupInvoiceIds.Add(invoice.Id);

        Assert.Equal(encounter.Id, invoice.EncounterId);
        Assert.Equal(60.00m, invoice.Subtotal);
        Assert.Equal(60.00m, invoice.Total);
        Assert.Single(invoice.Lines);
        Assert.Contains("Cardiology", invoice.Lines[0].ItemDescription);
    }

    [Fact]
    public async Task RecordPayment_ShouldDeductBalance_AndGenerateSequentialReceiptNumber()
    {
        var (staff, patient) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var invoiceReq = new CreateInvoiceRequest
        {
            PatientId = patient.Id,
            Lines = new List<CreateInvoiceLineRequest>
            {
                new()
                {
                    ItemDescription = "Hospital Treatment Service",
                    Quantity = 1,
                    UnitPrice = 100.00m
                }
            }
        };

        var invoice = await service.CreateInvoiceAsync(invoiceReq, staff.Id, staff.Username);
        _cleanupInvoiceIds.Add(invoice.Id);

        // 1. Partial Payment of $40.00
        var payReq1 = new RecordPaymentRequest
        {
            InvoiceId = invoice.Id,
            Amount = 40.00m,
            Method = PaymentMethod.Cash,
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var payment1 = await service.RecordPaymentAsync(payReq1, staff.Id, staff.Username);
        Assert.StartsWith("REC-", payment1.ReceiptNumber);
        Assert.Equal(40.00m, payment1.Amount);

        var invAfterPay1 = await service.GetInvoiceByIdAsync(invoice.Id);
        Assert.Equal(40.00m, invAfterPay1.PaidAmount);
        Assert.Equal(60.00m, invAfterPay1.Balance);
        Assert.Equal(InvoiceStatus.PartiallyPaid, invAfterPay1.Status);

        // 2. Final Payment of $60.00
        var payReq2 = new RecordPaymentRequest
        {
            InvoiceId = invoice.Id,
            Amount = 60.00m,
            Method = PaymentMethod.CreditCard,
            ProviderReference = "AUTH-987654",
            IdempotencyKey = Guid.NewGuid().ToString()
        };

        var payment2 = await service.RecordPaymentAsync(payReq2, staff.Id, staff.Username);
        Assert.StartsWith("REC-", payment2.ReceiptNumber);
        Assert.NotEqual(payment1.ReceiptNumber, payment2.ReceiptNumber);

        var invAfterPay2 = await service.GetInvoiceByIdAsync(invoice.Id);
        Assert.Equal(100.00m, invAfterPay2.PaidAmount);
        Assert.Equal(0.00m, invAfterPay2.Balance);
        Assert.Equal(InvoiceStatus.Paid, invAfterPay2.Status);
    }

    [Fact]
    public async Task RecordPayment_ShouldBeIdempotent_WhenSameKeyIsReplayed()
    {
        var (staff, patient) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var invoice = await service.CreateInvoiceAsync(new CreateInvoiceRequest
        {
            PatientId = patient.Id,
            Lines = new List<CreateInvoiceLineRequest>
            {
                new() { ItemDescription = "Standard Dressing", Quantity = 1, UnitPrice = 50.00m }
            }
        }, staff.Id, staff.Username);
        _cleanupInvoiceIds.Add(invoice.Id);

        var key = $"IDEM-PAY-{Guid.NewGuid()}";
        var payReq = new RecordPaymentRequest
        {
            InvoiceId = invoice.Id,
            Amount = 25.00m,
            Method = PaymentMethod.Cash,
            IdempotencyKey = key
        };

        var firstResult = await service.RecordPaymentAsync(payReq, staff.Id, staff.Username);
        var secondResult = await service.RecordPaymentAsync(payReq, staff.Id, staff.Username);

        Assert.Equal(firstResult.Id, secondResult.Id);
        Assert.Equal(firstResult.ReceiptNumber, secondResult.ReceiptNumber);

        var updatedInvoice = await service.GetInvoiceByIdAsync(invoice.Id);
        Assert.Equal(25.00m, updatedInvoice.PaidAmount); // Deducted only once!
        Assert.Equal(25.00m, updatedInvoice.Balance);
    }

    [Fact]
    public async Task ProcessRefund_ShouldRestoreBalance_AndTrackAuditLedger()
    {
        var (staff, patient) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var invoice = await service.CreateInvoiceAsync(new CreateInvoiceRequest
        {
            PatientId = patient.Id,
            Lines = new List<CreateInvoiceLineRequest>
            {
                new() { ItemDescription = "Specialist Therapy", Quantity = 1, UnitPrice = 80.00m }
            }
        }, staff.Id, staff.Username);
        _cleanupInvoiceIds.Add(invoice.Id);

        var payment = await service.RecordPaymentAsync(new RecordPaymentRequest
        {
            InvoiceId = invoice.Id,
            Amount = 80.00m,
            Method = PaymentMethod.Cash,
            IdempotencyKey = Guid.NewGuid().ToString()
        }, staff.Id, staff.Username);

        // Process partial refund of $30.00
        var refundReq = new ProcessRefundRequest
        {
            Amount = 30.00m,
            Reason = "Patient requested partial refund due to appointment reschedule"
        };

        var refund = await service.ProcessRefundAsync(payment.Id, refundReq, staff.Id, staff.Username);
        Assert.Equal(30.00m, refund.Amount);
        Assert.Equal(payment.Id, refund.PaymentId);

        var invoiceAfterRefund = await service.GetInvoiceByIdAsync(invoice.Id);
        Assert.Equal(50.00m, invoiceAfterRefund.PaidAmount);
        Assert.Equal(30.00m, invoiceAfterRefund.Balance);
        Assert.Equal(InvoiceStatus.RefundedPartially, invoiceAfterRefund.Status);
    }

    [Fact]
    public async Task GetCashierShiftSummary_ShouldAggregatePaymentTotals()
    {
        var (staff, patient) = await SetupSeedDataAsync();
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new BillingService(_dbContext, audit, NullLogger<BillingService>.Instance);

        var inv = await service.CreateInvoiceAsync(new CreateInvoiceRequest
        {
            PatientId = patient.Id,
            Lines = new List<CreateInvoiceLineRequest>
            {
                new() { ItemDescription = "Outpatient Service", Quantity = 1, UnitPrice = 200.00m }
            }
        }, staff.Id, staff.Username);
        _cleanupInvoiceIds.Add(inv.Id);

        await service.RecordPaymentAsync(new RecordPaymentRequest
        {
            InvoiceId = inv.Id,
            Amount = 50.00m,
            Method = PaymentMethod.Cash,
            IdempotencyKey = Guid.NewGuid().ToString()
        }, staff.Id, staff.Username);

        await service.RecordPaymentAsync(new RecordPaymentRequest
        {
            InvoiceId = inv.Id,
            Amount = 50.00m,
            Method = PaymentMethod.CreditCard,
            IdempotencyKey = Guid.NewGuid().ToString()
        }, staff.Id, staff.Username);

        var summary = await service.GetCashierShiftSummaryAsync(DateTime.UtcNow, staff.Id);

        Assert.True(summary.TotalCollected >= 100.00m);
        Assert.True(summary.CashTotal >= 50.00m);
        Assert.True(summary.CreditCardTotal >= 50.00m);
        Assert.True(summary.TotalReceiptsCount >= 2);
    }
}
