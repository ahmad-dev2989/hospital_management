using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class PatientsController : ControllerBase
{
    private readonly IPatientService _patientService;
    private readonly ILogger<PatientsController> _logger;

    public PatientsController(IPatientService patientService, ILogger<PatientsController> logger)
    {
        _patientService = patientService;
        _logger = logger;
    }

    [HttpPost("check-duplicates")]
    public async Task<IActionResult> CheckDuplicates([FromBody] CreatePatientRequest request)
    {
        var response = await _patientService.CheckDuplicatesAsync(request, HttpContext.RequestAborted);
        return Ok(response);
    }

    [HttpPost]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator,Receptionist,Doctor,Nurse")]
    public async Task<IActionResult> RegisterPatient([FromBody] CreatePatientRequest request)
    {
        try
        {
            var actorId = GetCurrentUserId();
            var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Staff";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

            var patient = await _patientService.CreatePatientAsync(request, actorId, actorName, ip, HttpContext.RequestAborted);
            return CreatedAtAction(nameof(GetPatientById), new { id = patient.Id }, patient);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = new { code = "POTENTIAL_DUPLICATE", message = ex.Message } });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = new { code = "VALIDATION_FAILED", message = ex.Message } });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetPatients(
        [FromQuery] string? search,
        [FromQuery] string? gender,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await _patientService.SearchPatientsAsync(search, gender, isActive, page, pageSize, HttpContext.RequestAborted);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPatientById(Guid id)
    {
        var patient = await _patientService.GetPatientByIdAsync(id, HttpContext.RequestAborted);
        if (patient == null)
        {
            return NotFound(new { error = new { code = "PATIENT_NOT_FOUND", message = "Patient record not found." } });
        }

        return Ok(patient);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator,Receptionist,Doctor,Nurse")]
    public async Task<IActionResult> UpdatePatient(Guid id, [FromBody] UpdatePatientRequest request)
    {
        try
        {
            var actorId = GetCurrentUserId();
            var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Staff";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

            var updated = await _patientService.UpdatePatientAsync(id, request, actorId, actorName, ip, HttpContext.RequestAborted);
            if (updated == null)
            {
                return NotFound(new { error = new { code = "PATIENT_NOT_FOUND", message = "Patient record not found." } });
            }

            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = new { code = "VALIDATION_FAILED", message = ex.Message } });
        }
    }

    [HttpPost("{id:guid}/toggle-active")]
    [Authorize(Roles = "SystemAdministrator,HospitalAdministrator,Receptionist")]
    public async Task<IActionResult> ToggleActive(Guid id)
    {
        var actorId = GetCurrentUserId();
        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "Staff";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var isActive = await _patientService.TogglePatientStatusAsync(id, actorId, actorName, ip, HttpContext.RequestAborted);
        return Ok(new { isActive, message = $"Patient status changed to {(isActive ? "Active" : "Deactivated")}." });
    }

    [HttpGet("{id:guid}/chart")]
    public async Task<IActionResult> GetPatientChart(Guid id)
    {
        var chart = await _patientService.GetPatientChartAsync(id, HttpContext.RequestAborted);
        if (chart == null)
        {
            return NotFound(new { error = new { code = "PATIENT_NOT_FOUND", message = "Patient record not found." } });
        }

        return Ok(chart);
    }

    [HttpPost("{id:guid}/allergies")]
    [Authorize(Roles = "SystemAdministrator,Doctor,Nurse")]
    public async Task<IActionResult> AddAllergy(Guid id, [FromBody] AddAllergyRequest request)
    {
        try
        {
            var actorId = GetCurrentUserId();
            var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "ClinicalStaff";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

            var allergy = await _patientService.AddAllergyAsync(id, request, actorId, actorName, ip, HttpContext.RequestAborted);
            return Ok(allergy);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = new { code = "PATIENT_NOT_FOUND", message = "Patient not found." } });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = new { code = "VALIDATION_FAILED", message = ex.Message } });
        }
    }

    [HttpDelete("{id:guid}/allergies/{allergyId:guid}")]
    [Authorize(Roles = "SystemAdministrator,Doctor,Nurse")]
    public async Task<IActionResult> RemoveAllergy(Guid id, Guid allergyId)
    {
        var actorId = GetCurrentUserId();
        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "ClinicalStaff";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var removed = await _patientService.RemoveAllergyAsync(id, allergyId, actorId, actorName, ip, HttpContext.RequestAborted);
        if (!removed)
        {
            return NotFound(new { error = new { code = "ALLERGY_NOT_FOUND", message = "Allergy entry not found for this patient." } });
        }

        return Ok(new { message = "Allergy record removed successfully." });
    }

    [HttpPost("{id:guid}/conditions")]
    [Authorize(Roles = "SystemAdministrator,Doctor,Nurse")]
    public async Task<IActionResult> AddCondition(Guid id, [FromBody] AddConditionRequest request)
    {
        try
        {
            var actorId = GetCurrentUserId();
            var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "ClinicalStaff";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

            var condition = await _patientService.AddConditionAsync(id, request, actorId, actorName, ip, HttpContext.RequestAborted);
            return Ok(condition);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = new { code = "PATIENT_NOT_FOUND", message = "Patient not found." } });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = new { code = "VALIDATION_FAILED", message = ex.Message } });
        }
    }

    [HttpDelete("{id:guid}/conditions/{conditionId:guid}")]
    [Authorize(Roles = "SystemAdministrator,Doctor,Nurse")]
    public async Task<IActionResult> RemoveCondition(Guid id, Guid conditionId)
    {
        var actorId = GetCurrentUserId();
        var actorName = User.FindFirstValue(ClaimTypes.Name) ?? "ClinicalStaff";
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        var removed = await _patientService.RemoveConditionAsync(id, conditionId, actorId, actorName, ip, HttpContext.RequestAborted);
        if (!removed)
        {
            return NotFound(new { error = new { code = "CONDITION_NOT_FOUND", message = "Condition entry not found for this patient." } });
        }

        return Ok(new { message = "Condition record removed successfully." });
    }

    private Guid? GetCurrentUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}
