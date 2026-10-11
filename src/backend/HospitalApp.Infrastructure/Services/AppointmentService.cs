using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class AppointmentService : IAppointmentService
{
    private readonly ApplicationDbContext _context;
    private readonly IAppointmentNumberGenerator _numberGenerator;
    private readonly IAuditService _auditService;
    private readonly ILogger<AppointmentService> _logger;
    private static readonly SemaphoreSlim _bookingLock = new(1, 1);

    public AppointmentService(
        ApplicationDbContext context,
        IAppointmentNumberGenerator numberGenerator,
        IAuditService auditService,
        ILogger<AppointmentService> logger)
    {
        _context = context;
        _numberGenerator = numberGenerator;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<PagedResult<AppointmentDto>> GetAppointmentsAsync(
        DateTime? date = null,
        Guid? doctorId = null,
        Guid? departmentId = null,
        AppointmentStatus? status = null,
        string? query = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = _context.Appointments
            .AsNoTracking()
            .Include(a => a.Patient)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.Department)
            .AsQueryable();

        if (date.HasValue)
        {
            var dayUtc = DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc);
            var nextDayUtc = dayUtc.AddDays(1);
            q = q.Where(a => a.StartsAt >= dayUtc && a.StartsAt < nextDayUtc);
        }

        if (doctorId.HasValue && doctorId.Value != Guid.Empty)
        {
            q = q.Where(a => a.DoctorId == doctorId.Value);
        }

        if (departmentId.HasValue && departmentId.Value != Guid.Empty)
        {
            q = q.Where(a => a.DepartmentId == departmentId.Value);
        }

        if (status.HasValue)
        {
            q = q.Where(a => a.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(a =>
                a.AppointmentNumber.ToLower().Contains(search) ||
                a.Patient.PatientNumber.ToLower().Contains(search) ||
                a.Patient.FirstName.ToLower().Contains(search) ||
                a.Patient.LastName.ToLower().Contains(search) ||
                a.Patient.Phone.ToLower().Contains(search) ||
                a.Doctor.User.FullName.ToLower().Contains(search));
        }

        var total = await q.CountAsync(cancellationToken);

        var items = await q
            .OrderBy(a => a.StartsAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => MapToDto(a))
            .ToListAsync(cancellationToken);

        return new PagedResult<AppointmentDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<AppointmentDto?> GetAppointmentByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var appt = await _context.Appointments
            .AsNoTracking()
            .Include(a => a.Patient)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.Department)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        return appt == null ? null : MapToDto(appt);
    }

    public async Task<AppointmentDto> BookAppointmentAsync(
        BookAppointmentRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        // Check idempotency
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingWithKey = await _context.Appointments
                .AsNoTracking()
                .Include(a => a.Patient)
                .Include(a => a.Doctor).ThenInclude(d => d.User)
                .Include(a => a.Department)
                .FirstOrDefaultAsync(a => a.IdempotencyKey == request.IdempotencyKey, cancellationToken);

            if (existingWithKey != null)
            {
                _logger.LogInformation("Returning existing appointment {ApptNum} for idempotency key {Key}",
                    existingWithKey.AppointmentNumber, request.IdempotencyKey);
                return MapToDto(existingWithKey);
            }
        }

        // Validate patient
        var patient = await _context.Patients
            .FirstOrDefaultAsync(p => p.Id == request.PatientId, cancellationToken);
        if (patient == null)
            throw new KeyNotFoundException($"Patient with ID {request.PatientId} not found.");
        if (!patient.IsActive)
            throw new InvalidOperationException($"Patient {patient.PatientNumber} is deactivated. Reactivate before booking.");

        // Validate doctor
        var doctor = await _context.Doctors
            .Include(d => d.User)
            .Include(d => d.Department)
            .Include(d => d.Schedules)
            .FirstOrDefaultAsync(d => d.Id == request.DoctorId, cancellationToken);
        if (doctor == null)
            throw new KeyNotFoundException($"Doctor with ID {request.DoctorId} not found.");
        if (!doctor.IsActive)
            throw new InvalidOperationException($"Doctor {doctor.User.FullName} is inactive.");

        var departmentId = request.DepartmentId ?? doctor.DepartmentId;

        // Normalize UTC timestamps
        var startsAtUtc = DateTime.SpecifyKind(request.StartsAt, DateTimeKind.Utc);
        int slotDuration = 15;

        // Check doctor's schedule duration
        var scheduleForDay = doctor.Schedules.FirstOrDefault(s => s.DayOfWeek == (int)startsAtUtc.DayOfWeek && s.IsActive);
        if (scheduleForDay != null && scheduleForDay.SlotDurationMinutes > 0)
        {
            slotDuration = scheduleForDay.SlotDurationMinutes;
        }

        var endsAtUtc = request.EndsAt.HasValue
            ? DateTime.SpecifyKind(request.EndsAt.Value, DateTimeKind.Utc)
            : startsAtUtc.AddMinutes(slotDuration);

        if (endsAtUtc <= startsAtUtc)
            throw new ArgumentException("Appointment end time must be after start time.");

        // Prevent double-booking concurrency lock
        await _bookingLock.WaitAsync(cancellationToken);
        try
        {
            // Check doctor slot conflict
            var doctorConflict = await _context.Appointments
                .AnyAsync(a =>
                    a.DoctorId == doctor.Id &&
                    a.Status != AppointmentStatus.Cancelled &&
                    a.StartsAt < endsAtUtc &&
                    a.EndsAt > startsAtUtc, cancellationToken);

            if (doctorConflict)
            {
                throw new InvalidOperationException(
                    $"Doctor {doctor.User.FullName} already has an active appointment overlapping {startsAtUtc:HH:mm} - {endsAtUtc:HH:mm}.");
            }

            // Check patient overlapping appointment
            var patientConflict = await _context.Appointments
                .AnyAsync(a =>
                    a.PatientId == patient.Id &&
                    a.Status != AppointmentStatus.Cancelled &&
                    a.StartsAt < endsAtUtc &&
                    a.EndsAt > startsAtUtc, cancellationToken);

            if (patientConflict)
            {
                throw new InvalidOperationException(
                    $"Patient {patient.FirstName} {patient.LastName} already has another active appointment overlapping {startsAtUtc:HH:mm} - {endsAtUtc:HH:mm}.");
            }

            var apptNumber = await _numberGenerator.GenerateNextAppointmentNumberAsync(cancellationToken);

            var appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                AppointmentNumber = apptNumber,
                PatientId = patient.Id,
                DoctorId = doctor.Id,
                DepartmentId = departmentId,
                StartsAt = startsAtUtc,
                EndsAt = endsAtUtc,
                Status = AppointmentStatus.Booked,
                Reason = request.Reason?.Trim(),
                IdempotencyKey = request.IdempotencyKey?.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Appointments.Add(appointment);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                null,
                currentUserName ?? "System",
                "Appointment.Booked",
                "Appointment",
                appointment.Id.ToString(),
                $"Booked appointment {apptNumber} for patient {patient.PatientNumber} with doctor {doctor.User.FullName} at {startsAtUtc:u}",
                "127.0.0.1");

            appointment.Patient = patient;
            appointment.Doctor = doctor;
            appointment.Department = doctor.Department;

            return MapToDto(appointment);
        }
        finally
        {
            _bookingLock.Release();
        }
    }

    public async Task<AppointmentDto> CheckInAppointmentAsync(
        Guid id,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.Department)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (appt == null)
            throw new KeyNotFoundException($"Appointment with ID {id} not found.");

        if (appt.Status == AppointmentStatus.Cancelled)
            throw new InvalidOperationException("Cannot check in a cancelled appointment.");

        appt.Status = AppointmentStatus.Waiting;
        appt.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName ?? "Reception",
            "Appointment.CheckedIn",
            "Appointment",
            appt.Id.ToString(),
            $"Patient checked in: {appt.AppointmentNumber} ({appt.Patient.FirstName} {appt.Patient.LastName}) moved to waiting queue.",
            "127.0.0.1");

        return MapToDto(appt);
    }

    public async Task<AppointmentDto> UpdateStatusAsync(
        Guid id,
        UpdateAppointmentStatusRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.Department)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (appt == null)
            throw new KeyNotFoundException($"Appointment with ID {id} not found.");

        var oldStatus = appt.Status;
        appt.Status = request.Status;
        appt.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName ?? "System",
            "Appointment.StatusChanged",
            "Appointment",
            appt.Id.ToString(),
            $"Appointment {appt.AppointmentNumber} status changed from {oldStatus} to {request.Status}. {request.Note}",
            "127.0.0.1");

        return MapToDto(appt);
    }

    public async Task<AppointmentDto> RescheduleAppointmentAsync(
        Guid id,
        RescheduleAppointmentRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.Department)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (appt == null)
            throw new KeyNotFoundException($"Appointment with ID {id} not found.");

        if (appt.Status == AppointmentStatus.Cancelled)
            throw new InvalidOperationException("Cannot reschedule a cancelled appointment.");

        if (appt.Status == AppointmentStatus.Completed)
            throw new InvalidOperationException("Cannot reschedule an already completed appointment.");

        var newStartsAtUtc = DateTime.SpecifyKind(request.NewStartsAt, DateTimeKind.Utc);
        var duration = appt.EndsAt - appt.StartsAt;
        if (duration <= TimeSpan.Zero) duration = TimeSpan.FromMinutes(15);

        var newEndsAtUtc = request.NewEndsAt.HasValue
            ? DateTime.SpecifyKind(request.NewEndsAt.Value, DateTimeKind.Utc)
            : newStartsAtUtc.Add(duration);

        if (newEndsAtUtc <= newStartsAtUtc)
            throw new ArgumentException("New end time must be after start time.");

        await _bookingLock.WaitAsync(cancellationToken);
        try
        {
            var conflict = await _context.Appointments
                .AnyAsync(a =>
                    a.DoctorId == appt.DoctorId &&
                    a.Id != appt.Id &&
                    a.Status != AppointmentStatus.Cancelled &&
                    a.StartsAt < newEndsAtUtc &&
                    a.EndsAt > newStartsAtUtc, cancellationToken);

            if (conflict)
            {
                throw new InvalidOperationException(
                    $"Doctor already has an appointment booked overlapping {newStartsAtUtc:HH:mm} - {newEndsAtUtc:HH:mm}.");
            }

            var oldStart = appt.StartsAt;
            appt.StartsAt = newStartsAtUtc;
            appt.EndsAt = newEndsAtUtc;
            appt.Status = AppointmentStatus.Booked;
            appt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                null,
                currentUserName ?? "System",
                "Appointment.Rescheduled",
                "Appointment",
                appt.Id.ToString(),
                $"Appointment {appt.AppointmentNumber} rescheduled from {oldStart:u} to {newStartsAtUtc:u}. Reason: {request.Reason}",
                "127.0.0.1");

            return MapToDto(appt);
        }
        finally
        {
            _bookingLock.Release();
        }
    }

    public async Task<AppointmentDto> CancelAppointmentAsync(
        Guid id,
        CancelAppointmentRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("A cancellation reason is required.");

        var appt = await _context.Appointments
            .Include(a => a.Patient)
            .Include(a => a.Doctor).ThenInclude(d => d.User)
            .Include(a => a.Department)
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

        if (appt == null)
            throw new KeyNotFoundException($"Appointment with ID {id} not found.");

        if (appt.Status == AppointmentStatus.Cancelled)
            throw new InvalidOperationException("Appointment is already cancelled.");

        if (appt.Status == AppointmentStatus.Completed)
            throw new InvalidOperationException("Cannot cancel an already completed appointment.");

        appt.Status = AppointmentStatus.Cancelled;
        appt.CancellationReason = request.Reason.Trim();
        appt.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName ?? "System",
            "Appointment.Cancelled",
            "Appointment",
            appt.Id.ToString(),
            $"Appointment {appt.AppointmentNumber} cancelled. Reason: {request.Reason}",
            "127.0.0.1");

        return MapToDto(appt);
    }

    public async Task<AppointmentQueueSummaryDto> GetQueueSummaryAsync(
        DateTime? date = null,
        Guid? doctorId = null,
        CancellationToken cancellationToken = default)
    {
        var targetDate = date ?? DateTime.UtcNow;
        var dayUtc = DateTime.SpecifyKind(targetDate.Date, DateTimeKind.Utc);
        var nextDayUtc = dayUtc.AddDays(1);

        var q = _context.Appointments
            .AsNoTracking()
            .Where(a => a.StartsAt >= dayUtc && a.StartsAt < nextDayUtc);

        if (doctorId.HasValue && doctorId.Value != Guid.Empty)
        {
            q = q.Where(a => a.DoctorId == doctorId.Value);
        }

        var list = await q.Select(a => a.Status).ToListAsync(cancellationToken);

        return new AppointmentQueueSummaryDto
        {
            TotalToday = list.Count,
            Booked = list.Count(s => s == AppointmentStatus.Booked || s == AppointmentStatus.Confirmed),
            Waiting = list.Count(s => s == AppointmentStatus.Waiting || s == AppointmentStatus.Arrived),
            InConsultation = list.Count(s => s == AppointmentStatus.InConsultation),
            Completed = list.Count(s => s == AppointmentStatus.Completed),
            Cancelled = list.Count(s => s == AppointmentStatus.Cancelled),
            NoShow = list.Count(s => s == AppointmentStatus.NoShow)
        };
    }

    public async Task<List<DoctorDto>> GetDoctorsAsync(
        Guid? departmentId = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        var q = _context.Doctors
            .AsNoTracking()
            .Include(d => d.User)
            .Include(d => d.Department)
            .Include(d => d.Schedules)
            .AsQueryable();

        if (activeOnly)
        {
            q = q.Where(d => d.IsActive && d.User.IsActive);
        }

        if (departmentId.HasValue && departmentId.Value != Guid.Empty)
        {
            q = q.Where(d => d.DepartmentId == departmentId.Value);
        }

        var docs = await q.OrderBy(d => d.User.FullName).ToListAsync(cancellationToken);

        return docs.Select(d => MapDoctorToDto(d)).ToList();
    }

    public async Task<DoctorDto?> GetDoctorByIdAsync(Guid doctorId, CancellationToken cancellationToken = default)
    {
        var doc = await _context.Doctors
            .AsNoTracking()
            .Include(d => d.User)
            .Include(d => d.Department)
            .Include(d => d.Schedules)
            .FirstOrDefaultAsync(d => d.Id == doctorId, cancellationToken);

        return doc == null ? null : MapDoctorToDto(doc);
    }

    public async Task<List<TimeSlotDto>> GetDoctorSlotsAsync(
        Guid doctorId,
        DateTime date,
        CancellationToken cancellationToken = default)
    {
        var dateUtc = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        int dayOfWeek = (int)dateUtc.DayOfWeek;

        var schedules = await _context.DoctorSchedules
            .AsNoTracking()
            .Where(s => s.DoctorId == doctorId && s.DayOfWeek == dayOfWeek && s.IsActive)
            .OrderBy(s => s.StartTime)
            .ToListAsync(cancellationToken);

        if (!schedules.Any())
        {
            return new List<TimeSlotDto>();
        }

        var nextDayUtc = dateUtc.AddDays(1);
        var bookedAppointments = await _context.Appointments
            .AsNoTracking()
            .Include(a => a.Patient)
            .Where(a =>
                a.DoctorId == doctorId &&
                a.Status != AppointmentStatus.Cancelled &&
                a.StartsAt >= dateUtc &&
                a.StartsAt < nextDayUtc)
            .ToListAsync(cancellationToken);

        var slots = new List<TimeSlotDto>();

        foreach (var schedule in schedules)
        {
            var dayStart = dateUtc.Add(schedule.StartTime);
            var dayEnd = dateUtc.Add(schedule.EndTime);
            var slotMinutes = schedule.SlotDurationMinutes > 0 ? schedule.SlotDurationMinutes : 15;
            var duration = TimeSpan.FromMinutes(slotMinutes);
            var shiftWindow = $"{DateTime.Today.Add(schedule.StartTime):h:mm tt} – {DateTime.Today.Add(schedule.EndTime):h:mm tt}";

            var current = dayStart;
            while (current + duration <= dayEnd)
            {
                var slotEnd = current + duration;
                var appt = bookedAppointments.FirstOrDefault(a => a.StartsAt < slotEnd && a.EndsAt > current);

                slots.Add(new TimeSlotDto
                {
                    StartsAt = current,
                    EndsAt = slotEnd,
                    TimeDisplay = $"{current:HH:mm} - {slotEnd:HH:mm}",
                    IsAvailable = appt == null,
                    AppointmentId = appt?.Id,
                    AppointmentNumber = appt?.AppointmentNumber,
                    PatientName = appt == null ? null : $"{appt.Patient.FirstName} {appt.Patient.LastName}",
                    Status = appt?.Status,
                    ShiftWindow = shiftWindow
                });

                current += duration;
            }
        }

        return slots;
    }

    public async Task<DoctorScheduleDto> SaveDoctorScheduleAsync(
        Guid doctorId,
        SaveDoctorScheduleRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        var doc = await _context.Doctors.FirstOrDefaultAsync(d => d.Id == doctorId, cancellationToken);
        if (doc == null)
            throw new KeyNotFoundException($"Doctor with ID {doctorId} not found.");

        if (!TimeSpan.TryParse(request.StartTime, out var startTime) ||
            !TimeSpan.TryParse(request.EndTime, out var endTime) ||
            endTime <= startTime)
        {
            throw new ArgumentException("Invalid schedule time range. EndTime must be later than StartTime.");
        }

        var existing = await _context.DoctorSchedules
            .FirstOrDefaultAsync(s => s.DoctorId == doctorId && s.DayOfWeek == request.DayOfWeek, cancellationToken);

        if (existing == null)
        {
            existing = new DoctorSchedule
            {
                Id = Guid.NewGuid(),
                DoctorId = doctorId,
                DayOfWeek = request.DayOfWeek,
                StartTime = startTime,
                EndTime = endTime,
                SlotDurationMinutes = request.SlotDurationMinutes,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.DoctorSchedules.Add(existing);
        }
        else
        {
            existing.StartTime = startTime;
            existing.EndTime = endTime;
            existing.SlotDurationMinutes = request.SlotDurationMinutes;
            existing.IsActive = request.IsActive;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName ?? "System",
            "DoctorSchedule.Saved",
            "DoctorSchedule",
            existing.Id.ToString(),
            $"Configured schedule for doctor {doctorId}: Day {request.DayOfWeek}, {request.StartTime}-{request.EndTime}, {request.SlotDurationMinutes}m intervals",
            "127.0.0.1");

        return new DoctorScheduleDto
        {
            Id = existing.Id,
            DoctorId = existing.DoctorId,
            DayOfWeek = existing.DayOfWeek,
            DayName = ((DayOfWeek)existing.DayOfWeek).ToString(),
            StartTime = existing.StartTime.ToString(@"hh\:mm"),
            EndTime = existing.EndTime.ToString(@"hh\:mm"),
            SlotDurationMinutes = existing.SlotDurationMinutes,
            IsActive = existing.IsActive
        };
    }

    public async Task<List<DoctorScheduleDto>> SaveDoctorSchedulesBulkAsync(
        Guid doctorId,
        BulkSaveDoctorScheduleRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default)
    {
        var doc = await _context.Doctors.FirstOrDefaultAsync(d => d.Id == doctorId, cancellationToken);
        if (doc == null)
            throw new KeyNotFoundException($"Doctor with ID {doctorId} not found.");

        if (request.ApplyToAllDays)
        {
            var shiftsToApply = request.Days.FirstOrDefault()?.Shifts ?? new List<ScheduleShiftConfig>();

            var existingAll = await _context.DoctorSchedules
                .Where(s => s.DoctorId == doctorId)
                .ToListAsync(cancellationToken);
            _context.DoctorSchedules.RemoveRange(existingAll);

            foreach (var shift in shiftsToApply.Where(s => s.IsActive))
            {
                if (TimeSpan.TryParse(shift.StartTime, out var st) && TimeSpan.TryParse(shift.EndTime, out var et) && et > st)
                {
                    for (int day = 0; day <= 6; day++)
                    {
                        _context.DoctorSchedules.Add(new DoctorSchedule
                        {
                            Id = Guid.NewGuid(),
                            DoctorId = doctorId,
                            DayOfWeek = day,
                            StartTime = st,
                            EndTime = et,
                            SlotDurationMinutes = shift.SlotDurationMinutes > 0 ? shift.SlotDurationMinutes : 15,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                }
            }
        }
        else
        {
            foreach (var dayConfig in request.Days)
            {
                var existingDaySchedules = await _context.DoctorSchedules
                    .Where(s => s.DoctorId == doctorId && s.DayOfWeek == dayConfig.DayOfWeek)
                    .ToListAsync(cancellationToken);
                _context.DoctorSchedules.RemoveRange(existingDaySchedules);

                foreach (var shift in dayConfig.Shifts.Where(s => s.IsActive))
                {
                    if (TimeSpan.TryParse(shift.StartTime, out var st) && TimeSpan.TryParse(shift.EndTime, out var et) && et > st)
                    {
                        _context.DoctorSchedules.Add(new DoctorSchedule
                        {
                            Id = Guid.NewGuid(),
                            DoctorId = doctorId,
                            DayOfWeek = dayConfig.DayOfWeek,
                            StartTime = st,
                            EndTime = et,
                            SlotDurationMinutes = shift.SlotDurationMinutes > 0 ? shift.SlotDurationMinutes : 15,
                            IsActive = true,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName ?? "System",
            "DoctorSchedule.BulkSaved",
            "DoctorSchedule",
            doctorId.ToString(),
            $"Updated doctor availability schedule (ApplyToAllDays: {request.ApplyToAllDays})",
            "127.0.0.1");

        var updated = await _context.DoctorSchedules
            .Where(s => s.DoctorId == doctorId)
            .OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
            .ToListAsync(cancellationToken);

        return updated.Select(s => new DoctorScheduleDto
        {
            Id = s.Id,
            DoctorId = s.DoctorId,
            DayOfWeek = s.DayOfWeek,
            DayName = ((DayOfWeek)s.DayOfWeek).ToString(),
            StartTime = s.StartTime.ToString(@"hh\:mm"),
            EndTime = s.EndTime.ToString(@"hh\:mm"),
            SlotDurationMinutes = s.SlotDurationMinutes,
            IsActive = s.IsActive
        }).ToList();
    }

    public async Task<List<Department>> GetDepartmentsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Departments
            .AsNoTracking()
            .Where(d => d.IsActive)
            .OrderBy(d => d.Name)
            .ToListAsync(cancellationToken);
    }

    private static AppointmentDto MapToDto(Appointment a)
    {
        return new AppointmentDto
        {
            Id = a.Id,
            AppointmentNumber = a.AppointmentNumber,
            PatientId = a.PatientId,
            PatientNumber = a.Patient?.PatientNumber ?? string.Empty,
            PatientName = a.Patient != null ? $"{a.Patient.FirstName} {a.Patient.LastName}" : string.Empty,
            PatientPhone = a.Patient?.Phone ?? string.Empty,
            DoctorId = a.DoctorId,
            DoctorName = a.Doctor?.User?.FullName ?? "Unknown Doctor",
            Specialization = a.Doctor?.Specialization ?? string.Empty,
            DepartmentId = a.DepartmentId,
            DepartmentName = a.Department?.Name ?? string.Empty,
            StartsAt = a.StartsAt,
            EndsAt = a.EndsAt,
            Status = a.Status,
            Reason = a.Reason,
            CancellationReason = a.CancellationReason,
            IdempotencyKey = a.IdempotencyKey,
            CreatedAt = a.CreatedAt
        };
    }

    private static DoctorDto MapDoctorToDto(Doctor d)
    {
        return new DoctorDto
        {
            Id = d.Id,
            UserId = d.UserId,
            FullName = d.User?.FullName ?? "Unknown Doctor",
            Email = d.User?.Email ?? string.Empty,
            DepartmentId = d.DepartmentId,
            DepartmentName = d.Department?.Name ?? string.Empty,
            DepartmentCode = d.Department?.Code ?? string.Empty,
            LicenseNumber = d.LicenseNumber,
            Specialization = d.Specialization,
            ConsultationFee = d.ConsultationFee,
            IsActive = d.IsActive,
            Schedules = d.Schedules.Select(s => new DoctorScheduleDto
            {
                Id = s.Id,
                DoctorId = s.DoctorId,
                DayOfWeek = s.DayOfWeek,
                DayName = ((DayOfWeek)s.DayOfWeek).ToString(),
                StartTime = s.StartTime.ToString(@"hh\:mm"),
                EndTime = s.EndTime.ToString(@"hh\:mm"),
                SlotDurationMinutes = s.SlotDurationMinutes,
                IsActive = s.IsActive
            }).OrderBy(s => s.DayOfWeek).ToList()
        };
    }
}
