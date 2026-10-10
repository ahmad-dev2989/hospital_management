using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;

namespace HospitalApp.Infrastructure.Services;

public interface IAppointmentService
{
    Task<PagedResult<AppointmentDto>> GetAppointmentsAsync(
        DateTime? date = null,
        Guid? doctorId = null,
        Guid? departmentId = null,
        AppointmentStatus? status = null,
        string? query = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);

    Task<AppointmentDto?> GetAppointmentByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<AppointmentDto> BookAppointmentAsync(
        BookAppointmentRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default);

    Task<AppointmentDto> CheckInAppointmentAsync(
        Guid id,
        string? currentUserName = null,
        CancellationToken cancellationToken = default);

    Task<AppointmentDto> UpdateStatusAsync(
        Guid id,
        UpdateAppointmentStatusRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default);

    Task<AppointmentDto> RescheduleAppointmentAsync(
        Guid id,
        RescheduleAppointmentRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default);

    Task<AppointmentDto> CancelAppointmentAsync(
        Guid id,
        CancelAppointmentRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default);

    Task<AppointmentQueueSummaryDto> GetQueueSummaryAsync(
        DateTime? date = null,
        Guid? doctorId = null,
        CancellationToken cancellationToken = default);

    Task<List<DoctorDto>> GetDoctorsAsync(
        Guid? departmentId = null,
        bool activeOnly = true,
        CancellationToken cancellationToken = default);

    Task<DoctorDto?> GetDoctorByIdAsync(Guid doctorId, CancellationToken cancellationToken = default);

    Task<List<TimeSlotDto>> GetDoctorSlotsAsync(
        Guid doctorId,
        DateTime date,
        CancellationToken cancellationToken = default);

    Task<DoctorScheduleDto> SaveDoctorScheduleAsync(
        Guid doctorId,
        SaveDoctorScheduleRequest request,
        string? currentUserName = null,
        CancellationToken cancellationToken = default);

    Task<List<Department>> GetDepartmentsAsync(CancellationToken cancellationToken = default);
}
