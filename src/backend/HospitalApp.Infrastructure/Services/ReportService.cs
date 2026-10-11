using System.Globalization;
using System.Text;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class ReportService : IReportService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ReportService> _logger;

    public ReportService(ApplicationDbContext context, ILogger<ReportService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ----------------------------------------------------
    // 1. OPERATIONAL DASHBOARD
    // ----------------------------------------------------

    public async Task<OperationalDashboardDto> GetOperationalDashboardAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var totalPatients = await _context.Patients.CountAsync(p => p.IsActive, cancellationToken);
        var newPatientsToday = await _context.Patients.CountAsync(p => p.CreatedAt >= today && p.CreatedAt < tomorrow, cancellationToken);

        var todayEncounters = await _context.Encounters.CountAsync(e => e.StartedAt >= today && e.StartedAt < tomorrow, cancellationToken);
        var activeEncounters = await _context.Encounters.CountAsync(e =>
            e.Status == EncounterStatus.Open ||
            e.Status == EncounterStatus.InProgress ||
            e.Status == EncounterStatus.Draft, cancellationToken);

        var todayAppts = await _context.Appointments
            .Where(a => a.StartsAt >= today && a.StartsAt < tomorrow)
            .ToListAsync(cancellationToken);

        // Department workloads
        var departments = await _context.Departments
            .Include(d => d.Doctors)
            .ToListAsync(cancellationToken);

        var deptWorkloads = new List<DepartmentWorkloadDto>();
        foreach (var dept in departments)
        {
            var doctorIds = dept.Doctors.Select(d => d.Id).ToList();
            var apptCount = todayAppts.Count(a => a.DepartmentId == dept.Id || doctorIds.Contains(a.DoctorId));
            var encCount = await _context.Encounters.CountAsync(e =>
                doctorIds.Contains(e.DoctorId) && e.StartedAt >= today && e.StartedAt < tomorrow, cancellationToken);

            deptWorkloads.Add(new DepartmentWorkloadDto
            {
                DepartmentId = dept.Id,
                DepartmentName = dept.Name,
                ActiveDoctorsCount = dept.Doctors.Count(d => d.IsActive),
                TodayAppointmentsCount = apptCount,
                TodayEncountersCount = encCount
            });
        }

        // Critical clinical & operational alerts
        var pendingLabs = await _context.LabOrders.CountAsync(o =>
            o.Status == LabOrderStatus.Ordered ||
            o.Status == LabOrderStatus.Collected ||
            o.Status == LabOrderStatus.Received ||
            o.Status == LabOrderStatus.Processing, cancellationToken);

        var criticalLabs = await _context.LabOrderItems.CountAsync(i => i.IsAbnormal, cancellationToken);

        var pendingPrescriptions = await _context.Prescriptions.CountAsync(p =>
            p.Status == PrescriptionStatus.Signed ||
            p.Status == PrescriptionStatus.PartiallyDispensed, cancellationToken);

        var drugs = await _context.Drugs
            .Include(d => d.Batches)
            .Where(d => d.IsActive)
            .ToListAsync(cancellationToken);

        var lowStockCount = drugs.Count(d =>
            d.Batches.Where(b => b.Status == InventoryBatchStatus.Available).Sum(b => b.QuantityOnHand) <= d.ReorderLevel);

        var expiringBatchesCount = await _context.InventoryBatches.CountAsync(b =>
            b.Status == InventoryBatchStatus.Available &&
            b.QuantityOnHand > 0 &&
            b.ExpiryDate <= DateTime.UtcNow.AddDays(30), cancellationToken);

        return new OperationalDashboardDto
        {
            TotalPatientsCount = totalPatients,
            NewPatientsTodayCount = newPatientsToday,
            TotalEncountersTodayCount = todayEncounters,
            ActiveEncountersCount = activeEncounters,
            AppointmentsTodayTotal = todayAppts.Count,
            AppointmentsWaitingCount = todayAppts.Count(a => a.Status == AppointmentStatus.Waiting),
            AppointmentsInConsultationCount = todayAppts.Count(a => a.Status == AppointmentStatus.InConsultation),
            AppointmentsCompletedCount = todayAppts.Count(a => a.Status == AppointmentStatus.Completed),
            AppointmentsNoShowCount = todayAppts.Count(a => a.Status == AppointmentStatus.NoShow),
            DepartmentWorkloads = deptWorkloads,
            PendingLabOrdersCount = pendingLabs,
            CriticalLabResultsCount = criticalLabs,
            PendingPrescriptionsCount = pendingPrescriptions,
            LowStockDrugsCount = lowStockCount,
            ExpiringBatchesCount = expiringBatchesCount
        };
    }

    // ----------------------------------------------------
    // 2. FINANCIAL REVENUE REPORT
    // ----------------------------------------------------

    public async Task<FinancialReportDto> GetFinancialReportAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default)
    {
        var start = fromDate.Date;
        var end = toDate.Date.AddDays(1).AddTicks(-1);

        var invoices = await _context.Invoices
            .AsNoTracking()
            .Where(i => i.IssuedAt >= start && i.IssuedAt <= end)
            .ToListAsync(cancellationToken);

        var payments = await _context.Payments
            .AsNoTracking()
            .Include(p => p.Refunds)
            .Where(p => p.ReceivedAt >= start && p.ReceivedAt <= end)
            .ToListAsync(cancellationToken);

        var refunds = await _context.Refunds
            .AsNoTracking()
            .Where(r => r.RefundedAt >= start && r.RefundedAt <= end)
            .ToListAsync(cancellationToken);

        decimal totalInvoiced = invoices.Where(i => i.Status != InvoiceStatus.Voided).Sum(i => i.Total);
        decimal totalCollected = payments.Sum(p => p.Amount);
        decimal totalRefunded = refunds.Sum(r => r.Amount);
        decimal netCollected = totalCollected - totalRefunded;
        decimal totalReceivables = invoices.Where(i => i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid).Sum(i => i.Balance);
        decimal totalDiscounts = invoices.Where(i => i.Status != InvoiceStatus.Voided).Sum(i => i.Discount);
        decimal totalTax = invoices.Where(i => i.Status != InvoiceStatus.Voided).Sum(i => i.Tax);

        // Revenue by Payment Method
        var methodNames = new Dictionary<PaymentMethod, string>
        {
            [PaymentMethod.Cash] = "Cash",
            [PaymentMethod.CreditCard] = "Credit Card",
            [PaymentMethod.DebitCard] = "Debit Card",
            [PaymentMethod.BankTransfer] = "Bank Transfer",
            [PaymentMethod.MobilePayment] = "Mobile Payment",
            [PaymentMethod.InsuranceCoPay] = "Insurance / Co-Pay"
        };

        var methodRevenueList = new List<PaymentMethodRevenueDto>();
        foreach (var kvp in methodNames)
        {
            var methodPayments = payments.Where(p => p.Method == kvp.Key).ToList();
            var amt = methodPayments.Sum(p => p.Amount);
            var pct = totalCollected > 0 ? Math.Round((amt / totalCollected) * 100m, 2) : 0m;

            methodRevenueList.Add(new PaymentMethodRevenueDto
            {
                MethodName = kvp.Value,
                Amount = amt,
                TransactionsCount = methodPayments.Count,
                PercentageOfTotal = pct
            });
        }

        // Daily Trend
        var dailyTrend = new List<DailyRevenuePointDto>();
        var curr = start;
        while (curr <= toDate.Date)
        {
            var next = curr.AddDays(1);
            var dayInvoices = invoices.Where(i => i.IssuedAt >= curr && i.IssuedAt < next && i.Status != InvoiceStatus.Voided).ToList();
            var dayPayments = payments.Where(p => p.ReceivedAt >= curr && p.ReceivedAt < next).ToList();
            var dayRefunds = refunds.Where(r => r.RefundedAt >= curr && r.RefundedAt < next).ToList();

            var invAmt = dayInvoices.Sum(i => i.Total);
            var colAmt = dayPayments.Sum(p => p.Amount);
            var refAmt = dayRefunds.Sum(r => r.Amount);

            dailyTrend.Add(new DailyRevenuePointDto
            {
                Date = curr.ToString("yyyy-MM-dd"),
                InvoicedAmount = invAmt,
                CollectedAmount = colAmt,
                RefundedAmount = refAmt,
                NetCollectedAmount = colAmt - refAmt,
                InvoicesCount = dayInvoices.Count,
                PaymentsCount = dayPayments.Count
            });

            curr = curr.AddDays(1);
        }

        return new FinancialReportDto
        {
            FromDate = start,
            ToDate = end,
            TotalInvoiced = totalInvoiced,
            TotalCollected = totalCollected,
            TotalRefunded = totalRefunded,
            NetCollected = netCollected,
            TotalOutstandingReceivables = totalReceivables,
            TotalDiscountsGranted = totalDiscounts,
            TotalTaxCollected = totalTax,
            TotalInvoicesIssued = invoices.Count(i => i.Status != InvoiceStatus.Voided),
            TotalPaymentsCaptured = payments.Count,
            TotalRefundsProcessed = refunds.Count,
            RevenueByPaymentMethod = methodRevenueList,
            DailyTrend = dailyTrend
        };
    }

    // ----------------------------------------------------
    // 3. LABORATORY WORKLOAD & TAT REPORT
    // ----------------------------------------------------

    public async Task<LaboratoryReportDto> GetLaboratoryReportAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default)
    {
        var start = fromDate.Date;
        var end = toDate.Date.AddDays(1).AddTicks(-1);

        var orders = await _context.LabOrders
            .AsNoTracking()
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .Where(o => o.CreatedAt >= start && o.CreatedAt <= end)
            .ToListAsync(cancellationToken);

        var allItems = orders.SelectMany(o => o.Items).ToList();
        var totalOrders = orders.Count;
        var totalTests = allItems.Count;
        var completed = orders.Count(o => o.Status == LabOrderStatus.Released || o.Status == LabOrderStatus.Verified);
        var pending = orders.Count(o =>
            o.Status != LabOrderStatus.Cancelled &&
            o.Status != LabOrderStatus.Rejected &&
            o.Status != LabOrderStatus.Released &&
            o.Status != LabOrderStatus.Verified);

        var abnormalCount = allItems.Count(i => i.IsAbnormal);

        // Turnaround Time
        var verifiedItems = allItems.Where(i => i.VerifiedAt.HasValue).ToList();
        double avgTatHours = 0;
        if (verifiedItems.Any())
        {
            avgTatHours = Math.Round(verifiedItems.Average(i => (i.VerifiedAt!.Value - i.CreatedAt).TotalHours), 2);
        }

        // Category breakdown
        var categories = allItems
            .GroupBy(i => string.IsNullOrWhiteSpace(i.LabTest.Category) ? "General" : i.LabTest.Category)
            .Select(g => new LabCategoryStatDto
            {
                Category = g.Key,
                OrdersCount = g.Select(i => i.LabOrderId).Distinct().Count(),
                TestsCount = g.Count(),
                AbnormalTestsCount = g.Count(i => i.IsAbnormal),
                TotalRevenue = g.Sum(i => i.LabTest.Price)
            })
            .OrderByDescending(c => c.TestsCount)
            .ToList();

        return new LaboratoryReportDto
        {
            FromDate = start,
            ToDate = end,
            TotalOrdersCount = totalOrders,
            TotalTestsCount = totalTests,
            CompletedOrdersCount = completed,
            PendingOrdersCount = pending,
            AbnormalResultsCount = abnormalCount,
            AverageTurnaroundTimeHours = avgTatHours,
            CategoryBreakdown = categories
        };
    }

    // ----------------------------------------------------
    // 4. PHARMACY INVENTORY VALUATION REPORT
    // ----------------------------------------------------

    public async Task<PharmacyValuationReportDto> GetPharmacyValuationReportAsync(CancellationToken cancellationToken = default)
    {
        var drugs = await _context.Drugs
            .AsNoTracking()
            .Include(d => d.Batches)
            .Where(d => d.IsActive)
            .ToListAsync(cancellationToken);

        var allBatches = await _context.InventoryBatches
            .AsNoTracking()
            .Include(b => b.Drug)
            .ToListAsync(cancellationToken);

        var availableBatches = allBatches
            .Where(b => b.Status == InventoryBatchStatus.Available && b.QuantityOnHand > 0)
            .ToList();

        int totalUnits = availableBatches.Sum(b => b.QuantityOnHand);
        decimal totalCost = availableBatches.Sum(b => b.QuantityOnHand * b.UnitCost);
        decimal totalRetail = availableBatches.Sum(b => b.QuantityOnHand * b.SellingPrice);
        decimal margin = totalRetail - totalCost;
        decimal marginPct = totalRetail > 0 ? Math.Round((margin / totalRetail) * 100m, 2) : 0m;

        // Low stock count
        int lowStockCount = drugs.Count(d =>
            d.Batches.Where(b => b.Status == InventoryBatchStatus.Available).Sum(b => b.QuantityOnHand) <= d.ReorderLevel);

        // Wastage from ledger
        var expiredMovements = await _context.StockMovements
            .AsNoTracking()
            .Include(m => m.InventoryBatch)
            .Where(m => m.MovementType == StockMovementType.ExpiredWastage)
            .ToListAsync(cancellationToken);

        var damagedMovements = await _context.StockMovements
            .AsNoTracking()
            .Include(m => m.InventoryBatch)
            .Where(m => m.MovementType == StockMovementType.Damaged)
            .ToListAsync(cancellationToken);

        int expiredUnits = expiredMovements.Sum(m => Math.Abs(m.QuantityDelta));
        decimal expiredCost = expiredMovements.Sum(m => Math.Abs(m.QuantityDelta) * m.InventoryBatch.UnitCost);

        int damagedUnits = damagedMovements.Sum(m => Math.Abs(m.QuantityDelta));
        decimal damagedCost = damagedMovements.Sum(m => Math.Abs(m.QuantityDelta) * m.InventoryBatch.UnitCost);

        // Aging schedule
        var now = DateTime.UtcNow;
        var d30 = now.AddDays(30);
        var d60 = now.AddDays(60);
        var d90 = now.AddDays(90);

        var expiredBatches = availableBatches.Where(b => b.ExpiryDate <= now).ToList();
        var next30 = availableBatches.Where(b => b.ExpiryDate > now && b.ExpiryDate <= d30).ToList();
        var next60 = availableBatches.Where(b => b.ExpiryDate > d30 && b.ExpiryDate <= d60).ToList();
        var next90 = availableBatches.Where(b => b.ExpiryDate > d60 && b.ExpiryDate <= d90).ToList();
        var beyond90 = availableBatches.Where(b => b.ExpiryDate > d90).ToList();

        var aging = new List<ExpiryHorizonDto>
        {
            CreateHorizonDto("Expired / Overdue", expiredBatches),
            CreateHorizonDto("Expires in < 30 Days", next30),
            CreateHorizonDto("Expires in 31 - 60 Days", next60),
            CreateHorizonDto("Expires in 61 - 90 Days", next90),
            CreateHorizonDto("Optimal (> 90 Days)", beyond90)
        };

        return new PharmacyValuationReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalFormularyDrugsCount = drugs.Count,
            TotalActiveBatchesCount = availableBatches.Count,
            TotalUnitsOnHand = totalUnits,
            TotalInventoryCostValue = totalCost,
            TotalInventoryRetailValue = totalRetail,
            ProjectedGrossMarginValue = margin,
            ProjectedGrossMarginPercentage = marginPct,
            LowStockAlertsCount = lowStockCount,
            ExpiredWastageUnits = expiredUnits,
            ExpiredWastageCostValue = expiredCost,
            DamagedWastageUnits = damagedUnits,
            DamagedWastageCostValue = damagedCost,
            ExpiryAgingSchedule = aging
        };
    }

    private static ExpiryHorizonDto CreateHorizonDto(string label, List<InventoryBatch> batches)
    {
        return new ExpiryHorizonDto
        {
            HorizonLabel = label,
            BatchesCount = batches.Count,
            TotalUnits = batches.Sum(b => b.QuantityOnHand),
            CostValue = batches.Sum(b => b.QuantityOnHand * b.UnitCost),
            RetailValue = batches.Sum(b => b.QuantityOnHand * b.SellingPrice)
        };
    }

    // ----------------------------------------------------
    // 5. CSV EXPORT ENGINES
    // ----------------------------------------------------

    public async Task<string> ExportFinancialReportCsvAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default)
    {
        var report = await GetFinancialReportAsync(fromDate, toDate, cancellationToken);
        var sb = new StringBuilder();

        sb.AppendLine("Date,Invoiced Amount,Collected Amount,Refunded Amount,Net Collected Amount,Invoices Count,Payments Count");
        foreach (var p in report.DailyTrend)
        {
            sb.AppendLine(string.Format(CultureInfo.InvariantCulture,
                "{0},{1:F2},{2:F2},{3:F2},{4:F2},{5},{6}",
                p.Date, p.InvoicedAmount, p.CollectedAmount, p.RefundedAmount, p.NetCollectedAmount, p.InvoicesCount, p.PaymentsCount));
        }

        sb.AppendLine();
        sb.AppendLine(string.Format(CultureInfo.InvariantCulture,
            "TOTAL,{0:F2},{1:F2},{2:F2},{3:F2},{4},{5}",
            report.TotalInvoiced, report.TotalCollected, report.TotalRefunded, report.NetCollected, report.TotalInvoicesIssued, report.TotalPaymentsCaptured));

        return sb.ToString();
    }

    public async Task<string> ExportPharmacyValuationCsvAsync(CancellationToken cancellationToken = default)
    {
        var batches = await _context.InventoryBatches
            .AsNoTracking()
            .Include(b => b.Drug)
            .Where(b => b.QuantityOnHand > 0)
            .OrderBy(b => b.Drug.BrandName)
            .ThenBy(b => b.ExpiryDate)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Drug Code,Brand Name,Generic Name,Batch Number,Expiry Date,Quantity On Hand,Unit Cost,Selling Price,Total Cost Value,Total Retail Value,Projected Margin");

        foreach (var b in batches)
        {
            var cost = b.QuantityOnHand * b.UnitCost;
            var retail = b.QuantityOnHand * b.SellingPrice;
            var margin = retail - cost;

            sb.AppendLine(string.Format(CultureInfo.InvariantCulture,
                "\"{0}\",\"{1}\",\"{2}\",\"{3}\",{4:yyyy-MM-dd},{5},{6:F2},{7:F2},{8:F2},{9:F2},{10:F2}",
                EscapeCsv(b.Drug.Code),
                EscapeCsv(b.Drug.BrandName),
                EscapeCsv(b.Drug.GenericName),
                EscapeCsv(b.BatchNumber),
                b.ExpiryDate,
                b.QuantityOnHand,
                b.UnitCost,
                b.SellingPrice,
                cost,
                retail,
                margin));
        }

        return sb.ToString();
    }

    public async Task<string> ExportLaboratoryReportCsvAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default)
    {
        var start = fromDate.Date;
        var end = toDate.Date.AddDays(1).AddTicks(-1);

        var orders = await _context.LabOrders
            .AsNoTracking()
            .Include(o => o.Patient)
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .Where(o => o.CreatedAt >= start && o.CreatedAt <= end)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Order Number,Created Date,Patient Name,Patient Number,Test Code,Test Name,Category,Price,Status,Is Abnormal,Verified At,Turnaround Hours");

        foreach (var o in orders)
        {
            var pName = $"{o.Patient.FirstName} {o.Patient.LastName}".Trim();
            foreach (var item in o.Items)
            {
                double tat = item.VerifiedAt.HasValue ? Math.Round((item.VerifiedAt.Value - item.CreatedAt).TotalHours, 2) : 0;
                sb.AppendLine(string.Format(CultureInfo.InvariantCulture,
                    "\"{0}\",{1:yyyy-MM-dd HH:mm},\"{2}\",\"{3}\",\"{4}\",\"{5}\",\"{6}\",{7:F2},\"{8}\",{9},{10},{11}",
                    EscapeCsv(o.OrderNumber),
                    o.CreatedAt,
                    EscapeCsv(pName),
                    EscapeCsv(o.Patient.PatientNumber),
                    EscapeCsv(item.LabTest.Code),
                    EscapeCsv(item.LabTest.Name),
                    EscapeCsv(item.LabTest.Category),
                    item.LabTest.Price,
                    o.Status,
                    item.IsAbnormal ? "YES" : "NO",
                    item.VerifiedAt.HasValue ? item.VerifiedAt.Value.ToString("yyyy-MM-dd HH:mm") : "Pending",
                    tat));
            }
        }

        return sb.ToString();
    }

    private static string EscapeCsv(string str) => str.Replace("\"", "\"\"");
}
