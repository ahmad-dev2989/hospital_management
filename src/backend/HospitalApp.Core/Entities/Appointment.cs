using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string AppointmentNumber { get; set; } = string.Empty;
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public Guid DepartmentId { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Booked;
    public string? Reason { get; set; }
    public string? CancellationReason { get; set; }
    public string? IdempotencyKey { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Patient Patient { get; set; } = null!;
    public Doctor Doctor { get; set; } = null!;
    public Department Department { get; set; } = null!;
}
