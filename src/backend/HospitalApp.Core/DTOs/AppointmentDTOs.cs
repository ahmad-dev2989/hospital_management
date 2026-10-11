using System.ComponentModel.DataAnnotations;
using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public class DoctorDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string DepartmentCode { get; set; } = string.Empty;
    public string LicenseNumber { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public bool IsActive { get; set; }
    public List<DoctorScheduleDto> Schedules { get; set; } = new();
}

public class DoctorScheduleDto
{
    public Guid Id { get; set; }
    public Guid DoctorId { get; set; }
    public int DayOfWeek { get; set; }
    public string DayName { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty; // "HH:mm"
    public string EndTime { get; set; } = string.Empty;   // "HH:mm"
    public int SlotDurationMinutes { get; set; } = 15;
    public bool IsActive { get; set; }
}

public class SaveDoctorScheduleRequest
{
    [Range(0, 6)]
    public int DayOfWeek { get; set; }

    [Required]
    [RegularExpression(@"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "StartTime must be HH:mm format")]
    public string StartTime { get; set; } = "09:00";

    [Required]
    [RegularExpression(@"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$", ErrorMessage = "EndTime must be HH:mm format")]
    public string EndTime { get; set; } = "17:00";

    [Range(5, 120)]
    public int SlotDurationMinutes { get; set; } = 15;

    public bool IsActive { get; set; } = true;
}

public class BulkSaveDoctorScheduleRequest
{
    public bool ApplyToAllDays { get; set; } = false;
    public List<DayScheduleConfig> Days { get; set; } = new();
}

public class DayScheduleConfig
{
    [Range(0, 6)]
    public int DayOfWeek { get; set; }
    public List<ScheduleShiftConfig> Shifts { get; set; } = new();
}

public class ScheduleShiftConfig
{
    [Required]
    public string StartTime { get; set; } = "09:00";
    [Required]
    public string EndTime { get; set; } = "17:00";
    public int SlotDurationMinutes { get; set; } = 15;
    public bool IsActive { get; set; } = true;
}

public class TimeSlotDto
{
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string TimeDisplay { get; set; } = string.Empty;
    public bool IsAvailable { get; set; }
    public Guid? AppointmentId { get; set; }
    public string? AppointmentNumber { get; set; }
    public string? PatientName { get; set; }
    public AppointmentStatus? Status { get; set; }
}

public class AppointmentDto
{
    public Guid Id { get; set; }
    public string AppointmentNumber { get; set; } = string.Empty;
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public Guid DoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string Specialization { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public AppointmentStatus Status { get; set; }
    public string StatusName => Status.ToString();
    public string? Reason { get; set; }
    public string? CancellationReason { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BookAppointmentRequest
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid DoctorId { get; set; }

    public Guid? DepartmentId { get; set; }

    [Required]
    public DateTime StartsAt { get; set; }

    public DateTime? EndsAt { get; set; }

    [StringLength(500)]
    public string? Reason { get; set; }

    public string? IdempotencyKey { get; set; }
}

public class RescheduleAppointmentRequest
{
    [Required]
    public DateTime NewStartsAt { get; set; }

    public DateTime? NewEndsAt { get; set; }

    [StringLength(500)]
    public string? Reason { get; set; }
}

public class CancelAppointmentRequest
{
    [Required]
    [MinLength(3, ErrorMessage = "A cancellation reason of at least 3 characters is mandatory.")]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public class UpdateAppointmentStatusRequest
{
    [Required]
    public AppointmentStatus Status { get; set; }

    public string? Note { get; set; }
}

public class AppointmentQueueSummaryDto
{
    public int TotalToday { get; set; }
    public int Booked { get; set; }
    public int Waiting { get; set; }
    public int InConsultation { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
}
