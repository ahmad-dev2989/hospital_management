namespace HospitalApp.Core.DTOs;

public class OperationalDashboardDto
{
    public int TotalPatientsCount { get; set; }
    public int NewPatientsTodayCount { get; set; }
    public int TotalEncountersTodayCount { get; set; }
    public int ActiveEncountersCount { get; set; }
    
    // Today's Appointment Queue Status Breakdown
    public int AppointmentsTodayTotal { get; set; }
    public int AppointmentsWaitingCount { get; set; }
    public int AppointmentsInConsultationCount { get; set; }
    public int AppointmentsCompletedCount { get; set; }
    public int AppointmentsNoShowCount { get; set; }

    // Department Workloads
    public List<DepartmentWorkloadDto> DepartmentWorkloads { get; set; } = new();

    // Critical Alerts
    public int PendingLabOrdersCount { get; set; }
    public int CriticalLabResultsCount { get; set; }
    public int PendingPrescriptionsCount { get; set; }
    public int LowStockDrugsCount { get; set; }
    public int ExpiringBatchesCount { get; set; }
}

public class DepartmentWorkloadDto
{
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public int ActiveDoctorsCount { get; set; }
    public int TodayAppointmentsCount { get; set; }
    public int TodayEncountersCount { get; set; }
}

public class DailyRevenuePointDto
{
    public string Date { get; set; } = string.Empty;
    public decimal InvoicedAmount { get; set; }
    public decimal CollectedAmount { get; set; }
    public decimal RefundedAmount { get; set; }
    public decimal NetCollectedAmount { get; set; }
    public int InvoicesCount { get; set; }
    public int PaymentsCount { get; set; }
}

public class PaymentMethodRevenueDto
{
    public string MethodName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public int TransactionsCount { get; set; }
    public decimal PercentageOfTotal { get; set; }
}

public class FinancialReportDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public decimal TotalInvoiced { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal TotalRefunded { get; set; }
    public decimal NetCollected { get; set; }
    public decimal TotalOutstandingReceivables { get; set; }
    public decimal TotalDiscountsGranted { get; set; }
    public decimal TotalTaxCollected { get; set; }
    public int TotalInvoicesIssued { get; set; }
    public int TotalPaymentsCaptured { get; set; }
    public int TotalRefundsProcessed { get; set; }
    public List<PaymentMethodRevenueDto> RevenueByPaymentMethod { get; set; } = new();
    public List<DailyRevenuePointDto> DailyTrend { get; set; } = new();
}

public class LabCategoryStatDto
{
    public string Category { get; set; } = string.Empty;
    public int OrdersCount { get; set; }
    public int TestsCount { get; set; }
    public int AbnormalTestsCount { get; set; }
    public decimal TotalRevenue { get; set; }
}

public class LaboratoryReportDto
{
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public int TotalOrdersCount { get; set; }
    public int TotalTestsCount { get; set; }
    public int CompletedOrdersCount { get; set; }
    public int PendingOrdersCount { get; set; }
    public int AbnormalResultsCount { get; set; }
    public double AverageTurnaroundTimeHours { get; set; }
    public List<LabCategoryStatDto> CategoryBreakdown { get; set; } = new();
}

public class ExpiryHorizonDto
{
    public string HorizonLabel { get; set; } = string.Empty;
    public int BatchesCount { get; set; }
    public int TotalUnits { get; set; }
    public decimal CostValue { get; set; }
    public decimal RetailValue { get; set; }
}

public class PharmacyValuationReportDto
{
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
    public int TotalFormularyDrugsCount { get; set; }
    public int TotalActiveBatchesCount { get; set; }
    public int TotalUnitsOnHand { get; set; }
    public decimal TotalInventoryCostValue { get; set; }
    public decimal TotalInventoryRetailValue { get; set; }
    public decimal ProjectedGrossMarginValue { get; set; }
    public decimal ProjectedGrossMarginPercentage { get; set; }
    public int LowStockAlertsCount { get; set; }
    
    // Wastage figures
    public int ExpiredWastageUnits { get; set; }
    public decimal ExpiredWastageCostValue { get; set; }
    public int DamagedWastageUnits { get; set; }
    public decimal DamagedWastageCostValue { get; set; }

    // Expiry Aging Schedule
    public List<ExpiryHorizonDto> ExpiryAgingSchedule { get; set; } = new();
}
