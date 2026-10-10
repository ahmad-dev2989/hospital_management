using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/clinical")]
[Authorize]
public class ClinicalController : ControllerBase
{
    private readonly IClinicalService _clinicalService;
    private readonly ILogger<ClinicalController> _logger;

    public ClinicalController(IClinicalService clinicalService, ILogger<ClinicalController> logger)
    {
        _clinicalService = clinicalService;
        _logger = logger;
    }

    [HttpGet("encounters")]
    public async Task<IActionResult> GetEncounters(
        [FromQuery] Guid? patientId,
        [FromQuery] Guid? doctorId,
        [FromQuery] EncounterStatus? status,
        [FromQuery] DateTime? date,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _clinicalService.GetEncountersAsync(
            patientId, doctorId, status, date, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("encounters/{id:guid}")]
    public async Task<IActionResult> GetEncounterById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _clinicalService.GetEncounterByIdAsync(id, cancellationToken);
        if (result == null)
            return NotFound(new { message = $"Encounter {id} was not found." });

        return Ok(result);
    }

    [HttpPost("encounters")]
    public async Task<IActionResult> StartEncounter(
        [FromBody] StartEncounterRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
            var result = await _clinicalService.StartEncounterAsync(request, username, cancellationToken);
            return CreatedAtAction(nameof(GetEncounterById), new { id = result.Id }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("encounters/{id:guid}/vitals")]
    public async Task<IActionResult> RecordVitalSigns(
        Guid id,
        [FromBody] RecordVitalSignsRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var userId = Guid.TryParse(userIdStr, out var parsedId) ? parsedId : Guid.Empty;

            var result = await _clinicalService.RecordVitalSignsAsync(id, request, userId, username, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("encounters/{id:guid}/notes")]
    public async Task<IActionResult> SaveNoteDraft(
        Guid id,
        [FromBody] SaveClinicalNoteRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
            var result = await _clinicalService.SaveClinicalNoteDraftAsync(id, request, username, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("encounters/{id:guid}/sign")]
    public async Task<IActionResult> SignEncounter(
        Guid id,
        CancellationToken cancellationToken)
    {
        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Doctor";
            
            // Look up encounter to get doctor ID
            var enc = await _clinicalService.GetEncounterByIdAsync(id, cancellationToken);
            if (enc == null)
                return NotFound(new { message = $"Encounter {id} was not found." });

            var result = await _clinicalService.SignEncounterAsync(id, enc.Doctor.Id, username, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("encounters/{id:guid}/addendum")]
    public async Task<IActionResult> AddAddendum(
        Guid id,
        [FromBody] AddAddendumRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Doctor";
            var enc = await _clinicalService.GetEncounterByIdAsync(id, cancellationToken);
            if (enc == null)
                return NotFound(new { message = $"Encounter {id} was not found." });

            var result = await _clinicalService.AddNoteAddendumAsync(id, request, enc.Doctor.Id, username, cancellationToken);
            return Ok(result);
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
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("encounters/{id:guid}/diagnoses")]
    public async Task<IActionResult> AddDiagnosis(
        Guid id,
        [FromBody] AddDiagnosisRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
            var result = await _clinicalService.AddDiagnosisAsync(id, request, username, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("encounters/{id:guid}/diagnoses/{diagnosisId:guid}")]
    public async Task<IActionResult> RemoveDiagnosis(
        Guid id,
        Guid diagnosisId,
        CancellationToken cancellationToken)
    {
        var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
        var success = await _clinicalService.RemoveDiagnosisAsync(id, diagnosisId, username, cancellationToken);
        if (!success)
            return NotFound(new { message = "Diagnosis was not found." });

        return Ok(new { message = "Diagnosis removed successfully." });
    }

    [HttpPost("encounters/{id:guid}/prescriptions")]
    public async Task<IActionResult> CreatePrescription(
        Guid id,
        [FromBody] CreatePrescriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Doctor";
            var enc = await _clinicalService.GetEncounterByIdAsync(id, cancellationToken);
            if (enc == null)
                return NotFound(new { message = $"Encounter {id} was not found." });

            var result = await _clinicalService.CreatePrescriptionAsync(id, request, enc.Doctor.Id, username, cancellationToken);
            return Ok(result);
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

    [HttpGet("icd10")]
    public async Task<IActionResult> GetIcd10Catalog([FromQuery] string? query, CancellationToken cancellationToken)
    {
        var list = await _clinicalService.GetIcd10CatalogAsync(query, cancellationToken);
        return Ok(list);
    }

    [HttpGet("drugs")]
    public async Task<IActionResult> GetDrugs([FromQuery] string? query, CancellationToken cancellationToken)
    {
        var list = await _clinicalService.GetEssentialDrugsAsync(query, cancellationToken);
        return Ok(list);
    }
}
