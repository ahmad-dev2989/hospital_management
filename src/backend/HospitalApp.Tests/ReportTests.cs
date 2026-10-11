using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class ReportTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupPatientIds = new();
    private readonly List<Guid> _cleanupInvoiceIds = new();

    public ReportTests()
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

        if (_cleanupPatientIds.Count > 0)
        {
            var patients = _dbContext.Patients.Where(p => _cleanupPatientIds.Contains(p.Id)).ToList();
            _dbContext.Patients.RemoveRange(patients);
        }

        _dbContext.SaveChanges();
        _dbContext.Dispose();
    }

    [Fact]
    public async Task GetOperationalDashboard_ShouldReturnPopulatedMetrics()
    {
        var service = new ReportService(_dbContext, NullLogger<ReportService>.Instance);
        var dashboard = await service.GetOperationalDashboardAsync();

        Assert.NotNull(dashboard);
        Assert.True(dashboard.TotalPatientsCount >= 0);
        Assert.NotNull(dashboard.DepartmentWorkloads);
        Assert.True(dashboard.DepartmentWorkloads.Count > 0);
    }

    [Fact]
    public async Task GetFinancialReport_ShouldAggregateTotalsAndDailyTrends()
    {
        var staff = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.SystemAdministrator);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"REP-PAT-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            FirstName = "Report",
            LastName = "FinPatient",
            Gender = "Male",
            DateOfBirth = new DateTime(1985, 3, 20, 0, 0, 0, DateTimeKind.Utc),
            Phone = "+15551234567",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Patients.Add(patient);
        await _dbContext.SaveChangesAsync();
        _cleanupPatientIds.Add(patient.Id);

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = $"INV-REP-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            PatientId = patient.Id,
            CreatedByUserId = staff.Id,
            IssuedAt = DateTime.UtcNow,
            Subtotal = 150.00m,
            Discount = 10.00m,
            Tax = 14.00m,
            Total = 154.00m,
            PaidAmount = 100.00m,
            Balance = 54.00m,
            Status = InvoiceStatus.PartiallyPaid,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Invoices.Add(invoice);

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            ReceiptNumber = $"REC-REP-{Guid.NewGuid().ToString()[..6].ToUpper()}",
            InvoiceId = invoice.Id,
            CashierUserId = staff.Id,
            Amount = 100.00m,
            Method = PaymentMethod.CreditCard,
            IdempotencyKey = Guid.NewGuid().ToString(),
            ReceivedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();
        _cleanupInvoiceIds.Add(invoice.Id);

        var service = new ReportService(_dbContext, NullLogger<ReportService>.Instance);
        var report = await service.GetFinancialReportAsync(DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1));

        Assert.NotNull(report);
        Assert.True(report.TotalInvoiced >= 154.00m);
        Assert.True(report.TotalCollected >= 100.00m);
        Assert.True(report.NetCollected >= 100.00m);
        Assert.True(report.TotalOutstandingReceivables >= 54.00m);
        Assert.NotEmpty(report.RevenueByPaymentMethod);
        Assert.NotEmpty(report.DailyTrend);

        var ccMethod = report.RevenueByPaymentMethod.FirstOrDefault(m => m.MethodName == "Credit Card");
        Assert.NotNull(ccMethod);
        Assert.True(ccMethod.Amount >= 100.00m);
    }

    [Fact]
    public async Task GetLaboratoryReport_ShouldReturnCategoryBreakdown()
    {
        var service = new ReportService(_dbContext, NullLogger<ReportService>.Instance);
        var report = await service.GetLaboratoryReportAsync(DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(1));

        Assert.NotNull(report);
        Assert.True(report.TotalOrdersCount >= 0);
        Assert.True(report.TotalTestsCount >= 0);
        Assert.NotNull(report.CategoryBreakdown);
    }

    [Fact]
    public async Task GetPharmacyValuationReport_ShouldCalculateInventoryValuation()
    {
        var service = new ReportService(_dbContext, NullLogger<ReportService>.Instance);
        var report = await service.GetPharmacyValuationReportAsync();

        Assert.NotNull(report);
        Assert.True(report.TotalFormularyDrugsCount >= 0);
        Assert.True(report.TotalInventoryCostValue >= 0);
        Assert.True(report.TotalInventoryRetailValue >= report.TotalInventoryCostValue);
        Assert.NotNull(report.ExpiryAgingSchedule);
        Assert.Equal(5, report.ExpiryAgingSchedule.Count);
    }

    [Fact]
    public async Task ExportFinancialReportCsv_ShouldGenerateValidHeadersAndLines()
    {
        var service = new ReportService(_dbContext, NullLogger<ReportService>.Instance);
        var csv = await service.ExportFinancialReportCsvAsync(DateTime.UtcNow.AddDays(-7), DateTime.UtcNow);

        Assert.NotNull(csv);
        Assert.Contains("Date,Invoiced Amount,Collected Amount,Refunded Amount,Net Collected Amount,Invoices Count,Payments Count", csv);
        Assert.Contains("TOTAL,", csv);
    }

    [Fact]
    public async Task ExportPharmacyValuationCsv_ShouldGenerateValidHeaders()
    {
        var service = new ReportService(_dbContext, NullLogger<ReportService>.Instance);
        var csv = await service.ExportPharmacyValuationCsvAsync();

        Assert.NotNull(csv);
        Assert.Contains("Drug Code,Brand Name,Generic Name,Batch Number,Expiry Date,Quantity On Hand,Unit Cost,Selling Price,Total Cost Value,Total Retail Value,Projected Margin", csv);
    }
}
