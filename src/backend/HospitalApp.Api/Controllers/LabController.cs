using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/lab")]
[Authorize]
public class LabController : ControllerBase
{
    private readonly ILabService _labService;
    private readonly ILogger<LabController> _logger;

    public LabController(ILabService labService, ILogger<LabController> logger)
    {
        _labService = labService;
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
    // TEST CATALOG ENDPOINTS
    // ----------------------------------------------------

    [HttpGet("tests")]
    public async Task<IActionResult> GetLabTests(
        [FromQuery] string? category,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var tests = await _labService.GetLabTestsAsync(category, activeOnly, cancellationToken);
        return Ok(tests);
    }

    [HttpGet("tests/{id:guid}")]
    public async Task<IActionResult> GetLabTestById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var test = await _labService.GetLabTestByIdAsync(id, cancellationToken);
            return Ok(test);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("tests")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator,LabTechnician")]
    public async Task<IActionResult> CreateLabTest(
        [FromBody] CreateLabTestRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var test = await _labService.CreateLabTestAsync(request, userId, username, cancellationToken);
            return CreatedAtAction(nameof(GetLabTestById), new { id = test.Id }, test);
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

    [HttpPut("tests/{id:guid}")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator,LabTechnician")]
    public async Task<IActionResult> UpdateLabTest(
        Guid id,
        [FromBody] UpdateLabTestRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var test = await _labService.UpdateLabTestAsync(id, request, userId, username, cancellationToken);
            return Ok(test);
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
    // ORDERS & WORKLIST ENDPOINTS
    // ----------------------------------------------------

    [HttpGet("orders")]
    public async Task<IActionResult> GetLabOrders(
        [FromQuery] Guid? encounterId,
        [FromQuery] Guid? patientId,
        [FromQuery] LabOrderStatus? status,
        [FromQuery] LabPriority? priority,
        [FromQuery] DateTime? date,
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var filter = new LabOrderFilterDto
        {
            EncounterId = encounterId,
            PatientId = patientId,
            Status = status,
            Priority = priority,
            Date = date,
            Query = query,
            Page = page,
            PageSize = pageSize
        };

        var result = await _labService.GetLabOrdersAsync(filter, cancellationToken);
        return Ok(result);
    }

    [HttpGet("orders/{id:guid}")]
    public async Task<IActionResult> GetLabOrderById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var order = await _labService.GetLabOrderByIdAsync(id, cancellationToken);
            return Ok(order);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("orders/encounter/{encounterId:guid}")]
    public async Task<IActionResult> GetLabOrdersByEncounterId(Guid encounterId, CancellationToken cancellationToken)
    {
        var orders = await _labService.GetLabOrdersByEncounterIdAsync(encounterId, cancellationToken);
        return Ok(orders);
    }

    [HttpPost("orders")]
    [Authorize(Roles = "Doctor,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> CreateLabOrder(
        [FromBody] CreateLabOrderRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var order = await _labService.CreateLabOrderAsync(request, userId, username, cancellationToken);
            return CreatedAtAction(nameof(GetLabOrderById), new { id = order.Id }, order);
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

    // ----------------------------------------------------
    // WORKFLOW TRANSITIONS
    // ----------------------------------------------------

    [HttpPost("orders/{id:guid}/collect")]
    [Authorize(Roles = "Nurse,LabTechnician,Doctor,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> CollectSpecimen(
        Guid id,
        [FromBody] CollectSpecimenRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var order = await _labService.CollectSpecimenAsync(id, request, userId, username, cancellationToken);
            return Ok(order);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("orders/{id:guid}/receive")]
    [Authorize(Roles = "LabTechnician,Doctor,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> ReceiveSpecimen(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var order = await _labService.ReceiveSpecimenAsync(id, userId, username, cancellationToken);
            return Ok(order);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("orders/{id:guid}/results")]
    [Authorize(Roles = "LabTechnician,Doctor,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> RecordResults(
        Guid id,
        [FromBody] RecordLabResultsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var order = await _labService.RecordResultsAsync(id, request, userId, username, cancellationToken);
            return Ok(order);
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

    [HttpPost("orders/{id:guid}/verify")]
    [Authorize(Roles = "LabTechnician,Doctor,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> VerifyAndReleaseOrder(
        Guid id,
        [FromBody] VerifyLabResultsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var order = await _labService.VerifyAndReleaseOrderAsync(id, request, userId, username, cancellationToken);
            return Ok(order);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("orders/{id:guid}/cancel")]
    [Authorize(Roles = "Doctor,LabTechnician,SystemAdministrator,HospitalAdministrator")]
    public async Task<IActionResult> CancelOrder(
        Guid id,
        [FromBody] CancelLabOrderRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var (userId, username) = GetCurrentUser();
            var success = await _labService.CancelOrderAsync(id, request, userId, username, cancellationToken);
            if (!success)
                return NotFound(new { message = $"Lab order {id} not found." });

            return Ok(new { message = "Lab order cancelled successfully." });
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
