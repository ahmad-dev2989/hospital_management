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

    private (Guid UserId, string Username) GetCurrentUser()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Staff";
        var userId = Guid.TryParse(idStr, out var parsed) ? parsed : Guid.Empty;
        return (userId, username);
    }

    [HttpGet("encounters")]
    public async Task<IActionResult> GetEncounters(
        [FromQuery] DateTime? date,
        [FromQuery] Guid? doctorId,
        [FromQuery] Guid? patientId,
        [FromQuery] EncounterStatus? status,
        [FromQuery] string? query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _clinicalService.GetEncountersAsync(
            date, doctorId, patientId, status, query, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("encounters/{id:guid}")]
    public async Task<IActionResult> GetEncounterById(Guid id, CancellationToken cancellationToken)
    {
        var encounter = await _clinicalService.GetEncounterByIdAsync(id, cancellationToken);
        if (encounter == null)
            return NotFound(new { message = $"Encounter {id} not found." });

        return Ok(encounter);
    }

    [HttpPost("encounters")]
    public async Task<IActionResult> StartEncounter(
        [FromBody] StartEncounterRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.StartEncounterAsync(request, userId, username, cancellationToken);
            return CreatedAtAction(nameof(GetEncounterById), new { id = result.Id }, result);
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

    [HttpPost("encounters/{id:guid}/notes")]
    public async Task<IActionResult> SaveClinicalNote(
        Guid id,
        [FromBody] SaveClinicalNoteRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.SaveClinicalNoteAsync(id, request, userId, username, cancellationToken);
            return Ok(result);
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

    [HttpPost("encounters/{id:guid}/notes/addendum")]
    public async Task<IActionResult> AddNoteAddendum(
        Guid id,
        [FromBody] AddNoteAddendumRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.AddNoteAddendumAsync(id, request, userId, username, cancellationToken);
            return Ok(result);
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

    [HttpPost("encounters/{id:guid}/vitals")]
    public async Task<IActionResult> RecordVitalSigns(
        Guid id,
        [FromBody] RecordVitalSignsRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.RecordVitalSignsAsync(id, request, userId, username, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
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

        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.AddDiagnosisAsync(id, request, userId, username, cancellationToken);
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
        var (userId, username) = GetCurrentUser();
        var removed = await _clinicalService.RemoveDiagnosisAsync(id, diagnosisId, userId, username, cancellationToken);
        if (!removed)
            return NotFound(new { message = $"Diagnosis {diagnosisId} not found." });

        return Ok(new { message = "Diagnosis removed." });
    }

    [HttpPost("encounters/{id:guid}/prescriptions")]
    public async Task<IActionResult> CreatePrescription(
        Guid id,
        [FromBody] CreatePrescriptionRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.CreatePrescriptionAsync(id, request, userId, username, cancellationToken);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("encounters/{id:guid}/sign")]
    public async Task<IActionResult> SignAndCloseEncounter(
        Guid id,
        CancellationToken cancellationToken)
    {
        var (userId, username) = GetCurrentUser();
        try
        {
            var result = await _clinicalService.SignAndCloseEncounterAsync(id, userId, username, cancellationToken);
            return Ok(result);
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

    [HttpGet("icd10-catalog")]
    public async Task<IActionResult> GetIcd10Catalog([FromQuery] string? search)
    {
        var catalog = await _clinicalService.GetStandardIcd10CatalogAsync(search);
        return Ok(catalog);
    }

    [HttpGet("drugs")]
    public async Task<IActionResult> GetFormularyDrugs(CancellationToken cancellationToken)
    {
        var drugs = await _clinicalService.GetFormularyDrugsAsync(cancellationToken);
        return Ok(drugs);
    }
}
