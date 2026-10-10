using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class AppointmentTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupAppointmentIds = new();
    private readonly List<Guid> _cleanupPatientIds = new();
    private readonly List<Guid> _cleanupDoctorIds = new();

    public AppointmentTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        if (_cleanupAppointmentIds.Count > 0)
        {
            var appts = _dbContext.Appointments
                .Where(a => _cleanupAppointmentIds.Contains(a.Id))
                .ToList();
            _dbContext.Appointments.RemoveRange(appts);
        }

        if (_cleanupPatientIds.Count > 0)
        {
            var patients = _dbContext.Patients
                .Include(p => p.Allergies)
                .Include(p => p.Conditions)
                .Where(p => _cleanupPatientIds.Contains(p.Id))
                .ToList();
            _dbContext.Patients.RemoveRange(patients);
        }

        if (_cleanupDoctorIds.Count > 0)
        {
            var docs = _dbContext.Doctors
                .Include(d => d.Schedules)
                .Where(d => _cleanupDoctorIds.Contains(d.Id))
                .ToList();
            _dbContext.Doctors.RemoveRange(docs);
        }

        _dbContext.SaveChanges();
        _dbContext.Dispose();
    }

    private (AppointmentService Service, AppointmentNumberGenerator Generator) CreateServices()
    {
        var numGen = new AppointmentNumberGenerator(_dbContext, NullLogger<AppointmentNumberGenerator>.Instance);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var service = new AppointmentService(_dbContext, numGen, audit, NullLogger<AppointmentService>.Instance);
        return (service, numGen);
    }

    private async Task<Doctor> GetOrCreateTestDoctorAsync()
    {
        var existingDoc = await _dbContext.Doctors
            .Include(d => d.User)
            .Include(d => d.Department)
            .Include(d => d.Schedules)
            .FirstOrDefaultAsync(d => d.IsActive);

        if (existingDoc != null && existingDoc.Schedules.Any())
            return existingDoc;

        var user = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Doctor);
        var dept = await _dbContext.Departments.FirstAsync();

        var doc = new Doctor
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            DepartmentId = dept.Id,
            LicenseNumber = $"TEST-MD-{Guid.NewGuid().ToString()[..6]}",
            Specialization = "General Internal Medicine",
            ConsultationFee = 50.00m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Doctors.Add(doc);

        for (int day = 0; day <= 6; day++)
        {
            doc.Schedules.Add(new DoctorSchedule
            {
                Id = Guid.NewGuid(),
                DoctorId = doc.Id,
                DayOfWeek = day,
                StartTime = TimeSpan.FromHours(9),
                EndTime = TimeSpan.FromHours(17),
                SlotDurationMinutes = 15,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync();
        _cleanupDoctorIds.Add(doc.Id);
        return doc;
    }

    private async Task<Patient> CreateTestPatientAsync()
    {
        var pat = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"TEST-{Guid.NewGuid().ToString()[..8]}",
            FirstName = "TestFirst",
            LastName = "TestLast",
            DateOfBirth = DateTime.SpecifyKind(new DateTime(1990, 1, 1), DateTimeKind.Utc),
            Gender = "Male",
            BloodGroup = "O+",
            Phone = $"+1-555-{new Random().Next(1000, 9999)}",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Patients.Add(pat);
        await _dbContext.SaveChangesAsync();
        _cleanupPatientIds.Add(pat.Id);
        return pat;
    }

    [Fact]
    public async Task AppointmentNumberGenerator_ProducesSequentialFormat()
    {
        var (_, numGen) = CreateServices();
        var num = await numGen.GenerateNextAppointmentNumberAsync();
        var year = DateTime.UtcNow.Year;

        Assert.StartsWith($"APT-{year}-", num);
        Assert.Matches(@"^APT-\d{4}-\d{5}$", num);
    }

    [Fact]
    public async Task DoctorSlots_GeneratesAvailableSlots_FromWeeklySchedule()
    {
        var (service, _) = CreateServices();
        var doctor = await GetOrCreateTestDoctorAsync();

        // Target next Monday
        var today = DateTime.UtcNow.Date;
        int daysUntilMonday = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        if (daysUntilMonday == 0) daysUntilMonday = 7;
        var monday = today.AddDays(daysUntilMonday);

        var slots = await service.GetDoctorSlotsAsync(doctor.Id, monday);

        Assert.NotEmpty(slots);
        Assert.All(slots, slot =>
        {
            Assert.True(slot.EndsAt > slot.StartsAt);
            Assert.False(string.IsNullOrEmpty(slot.TimeDisplay));
        });
    }

    [Fact]
    public async Task BookAppointment_SuccessfullyCreatesAppointment_WithStatusBooked()
    {
        var (service, _) = CreateServices();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var startTime = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(30).AddHours(10), DateTimeKind.Utc);
        var endTime = startTime.AddMinutes(15);

        var result = await service.BookAppointmentAsync(new BookAppointmentRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            StartsAt = startTime,
            EndsAt = endTime,
            Reason = "Automated test routine consultation"
        });

        _cleanupAppointmentIds.Add(result.Id);

        Assert.NotNull(result);
        Assert.Equal(AppointmentStatus.Booked, result.Status);
        Assert.StartsWith("APT-", result.AppointmentNumber);
        Assert.Equal(doctor.Id, result.DoctorId);
        Assert.Equal(patient.Id, result.PatientId);
    }

    [Fact]
    public async Task DoubleBooking_PreventsConcurrentSlotCollision_ForSameDoctor()
    {
        var (service, _) = CreateServices();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient1 = await CreateTestPatientAsync();
        var patient2 = await CreateTestPatientAsync();

        var startTime = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(31).AddHours(14), DateTimeKind.Utc);
        var endTime = startTime.AddMinutes(15);

        // Book for patient1
        var appt1 = await service.BookAppointmentAsync(new BookAppointmentRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient1.Id,
            StartsAt = startTime,
            EndsAt = endTime,
            Reason = "Initial booking"
        });
        _cleanupAppointmentIds.Add(appt1.Id);

        // Attempt overlapping booking for patient2 with the same doctor
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.BookAppointmentAsync(new BookAppointmentRequest
            {
                DoctorId = doctor.Id,
                PatientId = patient2.Id,
                StartsAt = startTime,
                EndsAt = endTime,
                Reason = "Conflicting booking"
            }));

        Assert.Contains("already has an active appointment overlapping", ex.Message);
    }

    [Fact]
    public async Task CheckIn_TransitionsAppointmentToWaitingQueue()
    {
        var (service, _) = CreateServices();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var startTime = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(32).AddHours(11), DateTimeKind.Utc);

        var appt = await service.BookAppointmentAsync(new BookAppointmentRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            StartsAt = startTime,
            Reason = "Check-in test"
        });
        _cleanupAppointmentIds.Add(appt.Id);

        var updated = await service.CheckInAppointmentAsync(appt.Id);

        Assert.Equal(AppointmentStatus.Waiting, updated.Status);
    }

    [Fact]
    public async Task CancelAppointment_RequiresMandatoryReason_AndSetsCancelled()
    {
        var (service, _) = CreateServices();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var startTime = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(33).AddHours(9), DateTimeKind.Utc);

        var appt = await service.BookAppointmentAsync(new BookAppointmentRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            StartsAt = startTime,
            Reason = "Pre-cancellation"
        });
        _cleanupAppointmentIds.Add(appt.Id);

        // Cancel with empty reason should fail
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CancelAppointmentAsync(appt.Id, new CancelAppointmentRequest { Reason = "" }));

        // Cancel with valid reason
        var cancelled = await service.CancelAppointmentAsync(appt.Id, new CancelAppointmentRequest
        {
            Reason = "Patient requested cancellation due to scheduling conflict"
        });

        Assert.Equal(AppointmentStatus.Cancelled, cancelled.Status);
        Assert.Equal("Patient requested cancellation due to scheduling conflict", cancelled.CancellationReason);
    }

    [Fact]
    public async Task RescheduleAppointment_FreesOldSlot_AndSecuresNewSlot()
    {
        var (service, _) = CreateServices();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var oldSlot = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(34).AddHours(10), DateTimeKind.Utc);
        var newSlot = DateTime.SpecifyKind(DateTime.UtcNow.Date.AddDays(34).AddHours(14), DateTimeKind.Utc);

        var appt = await service.BookAppointmentAsync(new BookAppointmentRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            StartsAt = oldSlot,
            Reason = "Initial consultation"
        });
        _cleanupAppointmentIds.Add(appt.Id);

        var rescheduled = await service.RescheduleAppointmentAsync(appt.Id, new RescheduleAppointmentRequest
        {
            NewStartsAt = newSlot,
            Reason = "Moved to afternoon slot"
        });

        Assert.Equal(newSlot, rescheduled.StartsAt);
        Assert.Equal(AppointmentStatus.Booked, rescheduled.Status);

        // Verify old slot can now be booked by another patient
        var otherPatient = await CreateTestPatientAsync();
        var reuseOldSlot = await service.BookAppointmentAsync(new BookAppointmentRequest
        {
            DoctorId = doctor.Id,
            PatientId = otherPatient.Id,
            StartsAt = oldSlot,
            Reason = "Booked the freed old slot"
        });
        _cleanupAppointmentIds.Add(reuseOldSlot.Id);

        Assert.Equal(oldSlot, reuseOldSlot.StartsAt);
    }
}
