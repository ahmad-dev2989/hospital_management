using System.Text;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(IReportService reportService, ILogger<ReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetOperationalDashboard(CancellationToken cancellationToken)
    {
        var result = await _reportService.GetOperationalDashboardAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("financial")]
    public async Task<IActionResult> GetFinancialReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var start = fromDate ?? DateTime.UtcNow.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;
        var result = await _reportService.GetFinancialReportAsync(start, end, cancellationToken);
        return Ok(result);
    }

    [HttpGet("financial/export-csv")]
    public async Task<IActionResult> ExportFinancialCsv(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var start = fromDate ?? DateTime.UtcNow.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;
        var csv = await _reportService.ExportFinancialReportCsvAsync(start, end, cancellationToken);
        var bytes = Encoding.UTF8.GetBytes(csv);
        return File(bytes, "text/csv", $"Financial_Report_{start:yyyyMMdd}_{end:yyyyMMdd}.csv");
    }

    [HttpGet("laboratory")]
    public async Task<IActionResult> GetLaboratoryReport(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var start = fromDate ?? DateTime.UtcNow.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;
        var result = await _reportService.GetLaboratoryReportAsync(start, end, cancellationToken);
        return Ok(result);
    }

    [HttpGet("laboratory/export-csv")]
    public async Task<IActionResult> ExportLaboratoryCsv(
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken cancellationToken = default)
    {
        var start = fromDate ?? DateTime.UtcNow.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;
        var csv = await _reportService.ExportLaboratoryReportCsvAsync(start, end, cancellationToken);
        var bytes = Encoding.UTF8.GetBytes(csv);
        return File(bytes, "text/csv", $"Laboratory_Workload_Report_{start:yyyyMMdd}_{end:yyyyMMdd}.csv");
    }

    [HttpGet("pharmacy")]
    public async Task<IActionResult> GetPharmacyValuationReport(CancellationToken cancellationToken)
    {
        var result = await _reportService.GetPharmacyValuationReportAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("pharmacy/export-csv")]
    public async Task<IActionResult> ExportPharmacyValuationCsv(CancellationToken cancellationToken)
    {
        var csv = await _reportService.ExportPharmacyValuationCsvAsync(cancellationToken);
        var bytes = Encoding.UTF8.GetBytes(csv);
        return File(bytes, "text/csv", $"Pharmacy_Stock_Valuation_{DateTime.UtcNow:yyyyMMdd}.csv");
    }
}
