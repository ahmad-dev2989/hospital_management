using HospitalApp.Core.DTOs;

namespace HospitalApp.Infrastructure.Services;

public interface IReportService
{
    Task<OperationalDashboardDto> GetOperationalDashboardAsync(CancellationToken cancellationToken = default);
    Task<FinancialReportDto> GetFinancialReportAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default);
    Task<LaboratoryReportDto> GetLaboratoryReportAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default);
    Task<PharmacyValuationReportDto> GetPharmacyValuationReportAsync(CancellationToken cancellationToken = default);
    
    // CSV Export Streams / Strings
    Task<string> ExportFinancialReportCsvAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default);
    Task<string> ExportPharmacyValuationCsvAsync(CancellationToken cancellationToken = default);
    Task<string> ExportLaboratoryReportCsvAsync(DateTime fromDate, DateTime toDate, CancellationToken cancellationToken = default);
}
