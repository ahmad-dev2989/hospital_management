using System.Security.Claims;
using HospitalApp.Core.DTOs;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HospitalApp.Api.Controllers;

[ApiController]
[Route("api/v1/doctors")]
[Authorize]
public class DoctorsController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;
    private readonly ILogger<DoctorsController> _logger;

    public DoctorsController(IAppointmentService appointmentService, ILogger<DoctorsController> logger)
    {
        _appointmentService = appointmentService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetDoctors(
        [FromQuery] Guid? departmentId,
        [FromQuery] bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var doctors = await _appointmentService.GetDoctorsAsync(departmentId, activeOnly, cancellationToken);
        return Ok(doctors);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDoctorById(Guid id, CancellationToken cancellationToken)
    {
        var doc = await _appointmentService.GetDoctorByIdAsync(id, cancellationToken);
        if (doc == null)
            return NotFound(new { message = $"Doctor {id} was not found." });

        return Ok(doc);
    }

    [HttpGet("{id:guid}/slots")]
    public async Task<IActionResult> GetDoctorSlots(
        Guid id,
        [FromQuery] DateTime? date,
        CancellationToken cancellationToken)
    {
        var targetDate = date ?? DateTime.UtcNow;
        var slots = await _appointmentService.GetDoctorSlotsAsync(id, targetDate, cancellationToken);
        return Ok(slots);
    }

    [HttpPost("{id:guid}/schedules")]
    public async Task<IActionResult> SaveSchedule(
        Guid id,
        [FromBody] SaveDoctorScheduleRequest request,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var username = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "Admin";
            var result = await _appointmentService.SaveDoctorScheduleAsync(id, request, username, cancellationToken);
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

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments(CancellationToken cancellationToken)
    {
        var depts = await _appointmentService.GetDepartmentsAsync(cancellationToken);
        return Ok(depts);
    }
}
