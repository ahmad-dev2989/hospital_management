using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/billing")]
[Authorize]
public class BillingController : ControllerBase
{
    private readonly IBillingService _billingService;
    private readonly ILogger<BillingController> _logger;

    public BillingController(IBillingService billingService, ILogger<BillingController> logger)
    {
        _billingService = billingService;
        _logger = logger;
    }

    private (Guid UserId, string Username) GetCurrentUser()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
        var userId = Guid.TryParse(idStr, out var parsed) ? parsed : Guid.Empty;
        return (userId, username);
    }

    // ----------------------------------------------------
    // METRICS
    // ----------------------------------------------------

    [HttpGet("metrics")]
    public async Task<IActionResult> GetDashboardMetrics(CancellationToken cancellationToken)
    {
        var metrics = await _billingService.GetDashboardMetricsAsync(cancellationToken);
        return Ok(metrics);
    }

    // ----------------------------------------------------
    // CHARGEMASTER / SERVICE CATALOG
    // ----------------------------------------------------

    [HttpGet("services")]
    public async Task<IActionResult> GetServices(
        [FromQuery] string? query = null,
        [FromQuery] string? category = null,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var services = await _billingService.GetServicesAsync(query, category, activeOnly, cancellationToken);
        return Ok(services);
    }

    [HttpGet("services/{id:guid}")]
    public async Task<IActionResult> GetServiceById(Guid id, CancellationToken cancellationToken)
    {
        var service = await _billingService.GetServiceByIdAsync(id, cancellationToken);
        return Ok(service);
    }

    [HttpPost("services")]
    [Authorize(Roles = "Admin,Cashier")]
    public async Task<IActionResult> CreateService([FromBody] CreateServiceItemRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var service = await _billingService.CreateServiceAsync(request, userId, username, cancellationToken);
        return CreatedAtAction(nameof(GetServiceById), new { id = service.Id }, service);
    }

    [HttpPut("services/{id:guid}")]
    [Authorize(Roles = "Admin,Cashier")]
    public async Task<IActionResult> UpdateService(Guid id, [FromBody] UpdateServiceItemRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var service = await _billingService.UpdateServiceAsync(id, request, userId, username, cancellationToken);
        return Ok(service);
    }

    // ----------------------------------------------------
    // INVOICES
    // ----------------------------------------------------

    [HttpGet("invoices")]
    public async Task<IActionResult> GetInvoices(
        [FromQuery] Guid? patientId = null,
        [FromQuery] InvoiceStatus? status = null,
        [FromQuery] string? query = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _billingService.GetInvoicesAsync(patientId, status, query, fromDate, toDate, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("invoices/{id:guid}")]
    public async Task<IActionResult> GetInvoiceById(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await _billingService.GetInvoiceByIdAsync(id, cancellationToken);
        return Ok(invoice);
    }

    [HttpPost("invoices")]
    public async Task<IActionResult> CreateInvoice([FromBody] CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var invoice = await _billingService.CreateInvoiceAsync(request, userId, username, cancellationToken);
        return CreatedAtAction(nameof(GetInvoiceById), new { id = invoice.Id }, invoice);
    }

    [HttpPost("invoices/generate-from-encounter/{encounterId:guid}")]
    public async Task<IActionResult> GenerateInvoiceFromEncounter(Guid encounterId, [FromBody] GenerateEncounterInvoiceRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var invoice = await _billingService.GenerateInvoiceFromEncounterAsync(encounterId, request, userId, username, cancellationToken);
        return CreatedAtAction(nameof(GetInvoiceById), new { id = invoice.Id }, invoice);
    }

    [HttpPost("invoices/{id:guid}/issue")]
    [Authorize(Roles = "Admin,Cashier")]
    public async Task<IActionResult> IssueInvoice(Guid id, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var invoice = await _billingService.IssueInvoiceAsync(id, userId, username, cancellationToken);
        return Ok(invoice);
    }

    public class VoidInvoiceRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    [HttpPost("invoices/{id:guid}/void")]
    [Authorize(Roles = "Admin,Cashier")]
    public async Task<IActionResult> VoidInvoice(Guid id, [FromBody] VoidInvoiceRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var invoice = await _billingService.VoidInvoiceAsync(id, request.Reason, userId, username, cancellationToken);
        return Ok(invoice);
    }

    // ----------------------------------------------------
    // PAYMENTS & REFUNDS
    // ----------------------------------------------------

    [HttpPost("payments")]
    [Authorize(Roles = "Admin,Cashier")]
    public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var payment = await _billingService.RecordPaymentAsync(request, userId, username, cancellationToken);
        return CreatedAtAction(nameof(GetPaymentById), new { id = payment.Id }, payment);
    }

    [HttpGet("payments/{id:guid}")]
    public async Task<IActionResult> GetPaymentById(Guid id, CancellationToken cancellationToken)
    {
        var payment = await _billingService.GetPaymentByIdAsync(id, cancellationToken);
        return Ok(payment);
    }

    [HttpPost("payments/{id:guid}/refund")]
    [Authorize(Roles = "Admin,Cashier")]
    public async Task<IActionResult> ProcessRefund(Guid id, [FromBody] ProcessRefundRequest request, CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        var refund = await _billingService.ProcessRefundAsync(id, request, userId, username, cancellationToken);
        return Ok(refund);
    }

    // ----------------------------------------------------
    // CASHIER SHIFT SUMMARY
    // ----------------------------------------------------

    [HttpGet("cashier-shift/summary")]
    public async Task<IActionResult> GetCashierShiftSummary(
        [FromQuery] DateTime? date = null,
        [FromQuery] Guid? cashierUserId = null,
        CancellationToken cancellationToken = default)
    {
        var summary = await _billingService.GetCashierShiftSummaryAsync(date, cashierUserId, cancellationToken);
        return Ok(summary);
    }
}
