using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class PatientService : IPatientService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IPatientNumberGenerator _patientNumberGenerator;
    private readonly IAuditService _auditService;
    private readonly ILogger<PatientService> _logger;

    public PatientService(
        ApplicationDbContext dbContext,
        IPatientNumberGenerator patientNumberGenerator,
        IAuditService auditService,
        ILogger<PatientService> logger)
    {
        _dbContext = dbContext;
        _patientNumberGenerator = patientNumberGenerator;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<CheckDuplicateResponse> CheckDuplicatesAsync(CreatePatientRequest request, CancellationToken cancellationToken = default)
    {
        var matches = new List<DuplicateMatchDto>();
        var normFirst = request.FirstName?.Trim().ToLower() ?? "";
        var normLast = request.LastName?.Trim().ToLower() ?? "";
        var normPhone = request.Phone?.Trim() ?? "";

        var reqDobUtc = DateTime.SpecifyKind(request.DateOfBirth.Date, DateTimeKind.Utc);
        var candidates = await _dbContext.Patients
            .AsNoTracking()
            .Where(p => (normPhone != "" && p.Phone == normPhone) ||
                        (normFirst != "" && normLast != "" && p.FirstName.ToLower() == normFirst && p.LastName.ToLower() == normLast) ||
                        p.DateOfBirth == reqDobUtc)
            .ToListAsync(cancellationToken);

        foreach (var c in candidates)
        {
            bool exactPhone = !string.IsNullOrWhiteSpace(c.Phone) && c.Phone.Trim() == normPhone;
            bool exactName = c.FirstName.Equals(request.FirstName?.Trim(), StringComparison.OrdinalIgnoreCase) &&
                             c.LastName.Equals(request.LastName?.Trim(), StringComparison.OrdinalIgnoreCase);
            bool exactDob = c.DateOfBirth.Date == reqDobUtc.Date;

            if (exactPhone && exactName)
            {
                matches.Add(new DuplicateMatchDto(c.Id, c.PatientNumber, $"{c.FirstName} {c.LastName}", c.DateOfBirth, c.Phone, "Identical phone number & matching name", "High"));
            }
            else if (exactName && exactDob)
            {
                matches.Add(new DuplicateMatchDto(c.Id, c.PatientNumber, $"{c.FirstName} {c.LastName}", c.DateOfBirth, c.Phone, "Exact match on full name and date of birth", "High"));
            }
            else if (exactPhone)
            {
                matches.Add(new DuplicateMatchDto(c.Id, c.PatientNumber, $"{c.FirstName} {c.LastName}", c.DateOfBirth, c.Phone, "Identical contact phone number", "High"));
            }
            else if (exactName)
            {
                matches.Add(new DuplicateMatchDto(c.Id, c.PatientNumber, $"{c.FirstName} {c.LastName}", c.DateOfBirth, c.Phone, "Matching first and last name", "Medium"));
            }
        }

        return new CheckDuplicateResponse(matches.Count > 0, matches);
    }

    public async Task<PatientDto> CreatePatientAsync(CreatePatientRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        ValidateDemographics(request.FirstName, request.LastName, request.DateOfBirth, request.Gender, request.Phone);

        if (!request.BypassDuplicateWarning)
        {
            var dupCheck = await CheckDuplicatesAsync(request, cancellationToken);
            if (dupCheck.HasPotentialDuplicates && dupCheck.Matches.Any(m => m.ConfidenceScore == "High"))
            {
                var match = dupCheck.Matches.First(m => m.ConfidenceScore == "High");
                throw new InvalidOperationException($"Potential duplicate patient detected: '{match.FullName}' ({match.PatientNumber}) - {match.MatchReason}. Specify bypassDuplicateWarning=true to proceed.");
            }
        }

        var patientNumber = await _patientNumberGenerator.GenerateNextPatientNumberAsync(cancellationToken);

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = patientNumber,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth.Date, DateTimeKind.Utc),
            Gender = request.Gender.Trim(),
            BloodGroup = request.BloodGroup?.Trim().ToUpperInvariant(),
            Phone = request.Phone.Trim(),
            Email = request.Email?.Trim().ToLowerInvariant(),
            Address = request.Address?.Trim(),
            EmergencyContactName = request.EmergencyContactName?.Trim(),
            EmergencyContactPhone = request.EmergencyContactPhone?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Patients.Add(patient);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            "Patient.Created",
            "Patient",
            patient.Id.ToString(),
            $"Registered patient {patient.FirstName} {patient.LastName} ({patient.PatientNumber})",
            ipAddress
        );

        return MapToDto(patient, 0, false);
    }

    public async Task<PatientDto?> GetPatientByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var patient = await _dbContext.Patients
            .AsNoTracking()
            .Include(p => p.Allergies)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (patient == null) return null;

        int allergiesCount = patient.Allergies.Count;
        bool hasHighRisk = patient.Allergies.Any(a => a.Severity >= AllergySeverity.Severe);

        return MapToDto(patient, allergiesCount, hasHighRisk);
    }

    public async Task<PatientDto?> UpdatePatientAsync(Guid id, UpdatePatientRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        ValidateDemographics(request.FirstName, request.LastName, request.DateOfBirth, request.Gender, request.Phone);

        var patient = await _dbContext.Patients
            .Include(p => p.Allergies)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (patient == null) return null;

        patient.FirstName = request.FirstName.Trim();
        patient.LastName = request.LastName.Trim();
        patient.DateOfBirth = DateTime.SpecifyKind(request.DateOfBirth.Date, DateTimeKind.Utc);
        patient.Gender = request.Gender.Trim();
        patient.BloodGroup = request.BloodGroup?.Trim().ToUpperInvariant();
        patient.Phone = request.Phone.Trim();
        patient.Email = request.Email?.Trim().ToLowerInvariant();
        patient.Address = request.Address?.Trim();
        patient.EmergencyContactName = request.EmergencyContactName?.Trim();
        patient.EmergencyContactPhone = request.EmergencyContactPhone?.Trim();
        patient.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            "Patient.Updated",
            "Patient",
            patient.Id.ToString(),
            $"Updated demographics for {patient.PatientNumber}",
            ipAddress
        );

        return MapToDto(patient, patient.Allergies.Count, patient.Allergies.Any(a => a.Severity >= AllergySeverity.Severe));
    }

    public async Task<bool> TogglePatientStatusAsync(Guid id, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        var patient = await _dbContext.Patients.FindAsync(new object[] { id }, cancellationToken);
        if (patient == null) return false;

        patient.IsActive = !patient.IsActive;
        patient.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            patient.IsActive ? "Patient.Activated" : "Patient.Deactivated",
            "Patient",
            patient.Id.ToString(),
            $"Patient {patient.PatientNumber} status set to {(patient.IsActive ? "Active" : "Deactivated")}",
            ipAddress
        );

        return patient.IsActive;
    }

    public async Task<PagedResult<PatientDto>> SearchPatientsAsync(string? query, string? gender, bool? isActive, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        var q = _dbContext.Patients
            .AsNoTracking()
            .Include(p => p.Allergies)
            .AsQueryable();

        if (isActive.HasValue)
        {
            q = q.Where(p => p.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(gender))
        {
            var g = gender.Trim().ToLower();
            q = q.Where(p => p.Gender.ToLower() == g);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim().ToLower();
            q = q.Where(p => p.PatientNumber.ToLower().Contains(term) ||
                             p.FirstName.ToLower().Contains(term) ||
                             p.LastName.ToLower().Contains(term) ||
                             (p.FirstName + " " + p.LastName).ToLower().Contains(term) ||
                             p.Phone.Contains(term));
        }

        var total = await q.CountAsync(cancellationToken);

        var items = await q
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                Patient = p,
                AllergiesCount = p.Allergies.Count,
                HasHighRisk = p.Allergies.Any(a => a.Severity >= AllergySeverity.Severe)
            })
            .ToListAsync(cancellationToken);

        var dtos = items.Select(x => MapToDto(x.Patient, x.AllergiesCount, x.HasHighRisk)).ToList();

        return new PagedResult<PatientDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = dtos
        };
    }

    public async Task<PatientChartDto?> GetPatientChartAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var patient = await _dbContext.Patients
            .AsNoTracking()
            .Include(p => p.Allergies)
            .Include(p => p.Conditions)
            .Include(p => p.Encounters)
                .ThenInclude(e => e.Doctor)
                    .ThenInclude(d => d.Department)
            .Include(p => p.Encounters)
                .ThenInclude(e => e.Doctor)
                    .ThenInclude(d => d.User)
            .Include(p => p.Encounters)
                .ThenInclude(e => e.VitalSigns)
            .Include(p => p.Appointments)
            .Include(p => p.Invoices)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (patient == null) return null;

        var allergies = patient.Allergies
            .OrderByDescending(a => a.Severity)
            .Select(a => new PatientAllergyDto(
                a.Id,
                a.PatientId,
                a.Allergen,
                a.Reaction,
                a.Severity,
                a.Severity.ToString(),
                a.RecordedAt
            ))
            .ToList();

        var conditions = patient.Conditions
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new PatientConditionDto(
                c.Id,
                c.PatientId,
                c.ConditionName,
                c.Status,
                c.DiagnosedDate,
                c.CreatedAt
            ))
            .ToList();

        var recentEncounters = patient.Encounters
            .OrderByDescending(e => e.StartedAt)
            .Take(10)
            .Select(e => new PatientEncounterSummaryDto(
                e.Id,
                e.StartedAt,
                e.Status.ToString(),
                null,
                e.Doctor?.User?.FullName ?? "Unknown Doctor",
                e.Doctor?.Department?.Name ?? "General"
            ))
            .ToList();

        var recentVitals = patient.Encounters
            .SelectMany(e => e.VitalSigns)
            .OrderByDescending(v => v.RecordedAt)
            .Take(10)
            .Select(v => new PatientVitalSignSummaryDto(
                v.Id,
                v.RecordedAt,
                $"{v.SystolicBp?.ToString() ?? "—"}/{v.DiastolicBp?.ToString() ?? "—"} mmHg",
                v.HeartRateBpm,
                v.TemperatureCelsius,
                v.RespiratoryRateBpm,
                v.OxygenSaturationPct
            ))
            .ToList();

        var demographics = MapToDto(patient, allergies.Count, allergies.Any(a => a.Severity >= AllergySeverity.Severe));
        var totalAppointments = patient.Appointments.Count;
        var totalInvoices = patient.Invoices.Count;
        var outstandingBalance = patient.Invoices
            .Where(i => i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Voided)
            .Sum(i => i.Balance);

        return new PatientChartDto(
            demographics,
            allergies,
            conditions,
            recentEncounters,
            recentVitals,
            totalAppointments,
            totalInvoices,
            outstandingBalance
        );
    }

    public async Task<PatientAllergyDto> AddAllergyAsync(Guid patientId, AddAllergyRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Allergen))
        {
            throw new ArgumentException("Allergen name is required.");
        }

        var patient = await _dbContext.Patients.FindAsync(new object[] { patientId }, cancellationToken);
        if (patient == null) throw new KeyNotFoundException("Patient not found.");

        var allergy = new PatientAllergy
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            Allergen = request.Allergen.Trim(),
            Reaction = request.Reaction?.Trim() ?? "Unspecified reaction",
            Severity = request.Severity,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.PatientAllergies.Add(allergy);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            "Patient.AllergyAdded",
            "PatientAllergy",
            allergy.Id.ToString(),
            $"Recorded allergy '{allergy.Allergen}' ({allergy.Severity}) for patient {patient.PatientNumber}",
            ipAddress
        );

        return new PatientAllergyDto(
            allergy.Id,
            allergy.PatientId,
            allergy.Allergen,
            allergy.Reaction,
            allergy.Severity,
            allergy.Severity.ToString(),
            allergy.RecordedAt
        );
    }

    public async Task<bool> RemoveAllergyAsync(Guid patientId, Guid allergyId, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        var allergy = await _dbContext.PatientAllergies
            .FirstOrDefaultAsync(a => a.Id == allergyId && a.PatientId == patientId, cancellationToken);

        if (allergy == null) return false;

        _dbContext.PatientAllergies.Remove(allergy);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            "Patient.AllergyRemoved",
            "PatientAllergy",
            allergyId.ToString(),
            $"Removed allergy record for patient ID {patientId}",
            ipAddress
        );

        return true;
    }

    public async Task<PatientConditionDto> AddConditionAsync(Guid patientId, AddConditionRequest request, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.ConditionName))
        {
            throw new ArgumentException("Condition name is required.");
        }

        var patient = await _dbContext.Patients.FindAsync(new object[] { patientId }, cancellationToken);
        if (patient == null) throw new KeyNotFoundException("Patient not found.");

        var condition = new PatientCondition
        {
            Id = Guid.NewGuid(),
            PatientId = patientId,
            ConditionName = request.ConditionName.Trim(),
            Status = string.IsNullOrWhiteSpace(request.Status) ? "Active" : request.Status.Trim(),
            DiagnosedDate = request.DiagnosedDate.HasValue ? DateTime.SpecifyKind(request.DiagnosedDate.Value.Date, DateTimeKind.Utc) : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.PatientConditions.Add(condition);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            "Patient.ConditionAdded",
            "PatientCondition",
            condition.Id.ToString(),
            $"Recorded condition '{condition.ConditionName}' for patient {patient.PatientNumber}",
            ipAddress
        );

        return new PatientConditionDto(
            condition.Id,
            condition.PatientId,
            condition.ConditionName,
            condition.Status,
            condition.DiagnosedDate,
            condition.CreatedAt
        );
    }

    public async Task<bool> RemoveConditionAsync(Guid patientId, Guid conditionId, Guid? actorId, string actorUsername, string ipAddress, CancellationToken cancellationToken = default)
    {
        var condition = await _dbContext.PatientConditions
            .FirstOrDefaultAsync(c => c.Id == conditionId && c.PatientId == patientId, cancellationToken);

        if (condition == null) return false;

        _dbContext.PatientConditions.Remove(condition);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            actorId,
            actorUsername,
            "Patient.ConditionRemoved",
            "PatientCondition",
            conditionId.ToString(),
            $"Removed condition '{condition.ConditionName}' for patient ID {patientId}",
            ipAddress
        );

        return true;
    }

    private static void ValidateDemographics(string firstName, string lastName, DateTime dob, string gender, string phone)
    {
        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name is required.");
        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("Last name is required.");
        if (firstName.Trim().Length > 100)
            throw new ArgumentException("First name cannot exceed 100 characters.");
        if (lastName.Trim().Length > 100)
            throw new ArgumentException("Last name cannot exceed 100 characters.");

        if (dob.Date > DateTime.UtcNow.Date)
            throw new ArgumentException("Date of birth cannot be in the future.");
        if (dob.Date < DateTime.UtcNow.Date.AddYears(-130))
            throw new ArgumentException("Date of birth is outside valid historical range.");

        if (string.IsNullOrWhiteSpace(gender))
            throw new ArgumentException("Gender is required.");
        if (string.IsNullOrWhiteSpace(phone))
            throw new ArgumentException("Phone number is required.");
    }

    private static int CalculateAge(DateTime dob)
    {
        var today = DateTime.UtcNow.Date;
        var age = today.Year - dob.Year;
        if (dob.Date > today.AddYears(-age)) age--;
        return Math.Max(0, age);
    }

    private static PatientDto MapToDto(Patient p, int allergiesCount, bool hasHighRisk)
    {
        return new PatientDto(
            p.Id,
            p.PatientNumber,
            p.FirstName,
            p.LastName,
            $"{p.FirstName} {p.LastName}",
            p.DateOfBirth,
            CalculateAge(p.DateOfBirth),
            p.Gender,
            p.BloodGroup,
            p.Phone,
            p.Email,
            p.Address,
            p.EmergencyContactName,
            p.EmergencyContactPhone,
            p.IsActive,
            allergiesCount,
            hasHighRisk,
            p.CreatedAt,
            p.UpdatedAt
        );
    }
}
