using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/pharmacy")]
[Authorize]
public class PharmacyController : ControllerBase
{
    private readonly IPharmacyService _pharmacyService;
    private readonly ILogger<PharmacyController> _logger;

    public PharmacyController(IPharmacyService pharmacyService, ILogger<PharmacyController> logger)
    {
        _pharmacyService = pharmacyService;
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
    // METRICS & ALERTS
    // ----------------------------------------------------

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics(CancellationToken cancellationToken)
    {
        var metrics = await _pharmacyService.GetMetricsAsync(cancellationToken);
        return Ok(metrics);
    }

    [HttpGet("alerts/expiring")]
    public async Task<IActionResult> GetExpiringBatches(
        [FromQuery] int daysThreshold = 30,
        CancellationToken cancellationToken = default)
    {
        var batches = await _pharmacyService.GetExpiringBatchesAsync(daysThreshold, cancellationToken);
        return Ok(batches);
    }

    [HttpGet("alerts/low-stock")]
    public async Task<IActionResult> GetLowStockDrugs(CancellationToken cancellationToken)
    {
        var drugs = await _pharmacyService.GetLowStockDrugsAsync(cancellationToken);
        return Ok(drugs);
    }

    // ----------------------------------------------------
    // DRUG FORMULARY CATALOG
    // ----------------------------------------------------

    [HttpGet("drugs")]
    public async Task<IActionResult> GetDrugs(
        [FromQuery] string? query,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var drugs = await _pharmacyService.GetDrugsAsync(query, activeOnly, cancellationToken);
        return Ok(drugs);
    }

    [HttpGet("drugs/{id:guid}")]
    public async Task<IActionResult> GetDrugById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var drug = await _pharmacyService.GetDrugByIdAsync(id, cancellationToken);
            return Ok(drug);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("drugs")]
    [Authorize(Roles = "Pharmacist,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> CreateDrug(
        [FromBody] CreateDrugRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var drug = await _pharmacyService.CreateDrugAsync(request, userId, username, cancellationToken);
            return CreatedAtAction(nameof(GetDrugById), new { id = drug.Id }, drug);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPut("drugs/{id:guid}")]
    [Authorize(Roles = "Pharmacist,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> UpdateDrug(
        Guid id,
        [FromBody] UpdateDrugRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var drug = await _pharmacyService.UpdateDrugAsync(id, request, userId, username, cancellationToken);
            return Ok(drug);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ----------------------------------------------------
    // INVENTORY BATCHES & ADJUSTMENTS
    // ----------------------------------------------------

    [HttpGet("batches")]
    public async Task<IActionResult> GetBatches(
        [FromQuery] Guid? drugId,
        [FromQuery] bool availableOnly = false,
        CancellationToken cancellationToken = default)
    {
        var batches = await _pharmacyService.GetBatchesAsync(drugId, availableOnly, cancellationToken);
        return Ok(batches);
    }

    [HttpPost("batches/receive")]
    [Authorize(Roles = "Pharmacist,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> ReceiveBatch(
        [FromBody] ReceiveBatchRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var batch = await _pharmacyService.ReceiveBatchAsync(request, userId, username, cancellationToken);
            return Ok(batch);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("batches/adjust")]
    [Authorize(Roles = "Pharmacist,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> AdjustStock(
        [FromBody] AdjustStockRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var batch = await _pharmacyService.AdjustStockAsync(request, userId, username, cancellationToken);
            return Ok(batch);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpGet("stock-movements")]
    public async Task<IActionResult> GetStockMovements(
        [FromQuery] Guid? batchId,
        [FromQuery] Guid? drugId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _pharmacyService.GetStockMovementsAsync(batchId, drugId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    // ----------------------------------------------------
    // PRESCRIPTION DISPENSING
    // ----------------------------------------------------

    [HttpGet("prescriptions/queue")]
    public async Task<IActionResult> GetPrescriptionQueue(
        [FromQuery] PrescriptionStatus? status,
        [FromQuery] string? query,
        CancellationToken cancellationToken = default)
    {
        var queue = await _pharmacyService.GetPrescriptionQueueAsync(status, query, cancellationToken);
        return Ok(queue);
    }

    [HttpGet("prescriptions/{id:guid}/dispense-details")]
    public async Task<IActionResult> GetPrescriptionDispenseDetails(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var details = await _pharmacyService.GetPrescriptionDispenseDetailsAsync(id, cancellationToken);
            return Ok(details);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("prescriptions/{id:guid}/dispense")]
    [Authorize(Roles = "Pharmacist,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> DispensePrescription(
        Guid id,
        [FromBody] DispensePrescriptionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var record = await _pharmacyService.DispensePrescriptionAsync(id, request, userId, username, cancellationToken);
            return Ok(record);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}
