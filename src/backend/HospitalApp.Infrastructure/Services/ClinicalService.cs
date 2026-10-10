using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class ClinicalService : IClinicalService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<ClinicalService> _logger;
    private static readonly SemaphoreSlim _rxLock = new(1, 1);

    public ClinicalService(
        ApplicationDbContext context,
        IAuditService auditService,
        ILogger<ClinicalService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<PagedResult<EncounterDto>> GetEncountersAsync(
        DateTime? date = null,
        Guid? doctorId = null,
        Guid? patientId = null,
        EncounterStatus? status = null,
        string? query = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var q = _context.Encounters
            .AsNoTracking()
            .Include(e => e.Patient).ThenInclude(p => p.Allergies)
            .Include(e => e.Doctor).ThenInclude(d => d.User)
            .Include(e => e.Doctor).ThenInclude(d => d.Department)
            .Include(e => e.SignedByDoctor).ThenInclude(d => d.User)
            .Include(e => e.Appointment)
            .Include(e => e.Notes)
            .Include(e => e.VitalSigns)
            .Include(e => e.Diagnoses)
            .Include(e => e.Prescriptions).ThenInclude(p => p.Items).ThenInclude(i => i.Drug)
            .AsQueryable();

        if (date.HasValue)
        {
            var dayUtc = DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc);
            var nextDayUtc = dayUtc.AddDays(1);
            q = q.Where(e => e.StartedAt >= dayUtc && e.StartedAt < nextDayUtc);
        }

        if (doctorId.HasValue && doctorId.Value != Guid.Empty)
        {
            q = q.Where(e => e.DoctorId == doctorId.Value);
        }

        if (patientId.HasValue && patientId.Value != Guid.Empty)
        {
            q = q.Where(e => e.PatientId == patientId.Value);
        }

        if (status.HasValue)
        {
            q = q.Where(e => e.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(e =>
                e.Patient.PatientNumber.ToLower().Contains(search) ||
                e.Patient.FirstName.ToLower().Contains(search) ||
                e.Patient.LastName.ToLower().Contains(search) ||
                e.Doctor.User.FullName.ToLower().Contains(search) ||
                (e.Appointment != null && e.Appointment.AppointmentNumber.ToLower().Contains(search)));
        }

        var total = await q.CountAsync(cancellationToken);

        var items = await q
            .OrderByDescending(e => e.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => MapToEncounterDto(e))
            .ToListAsync(cancellationToken);

        return new PagedResult<EncounterDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<EncounterDto?> GetEncounterByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.Encounters
            .AsNoTracking()
            .Include(enc => enc.Patient).ThenInclude(p => p.Allergies)
            .Include(enc => enc.Doctor).ThenInclude(d => d.User)
            .Include(enc => enc.Doctor).ThenInclude(d => d.Department)
            .Include(enc => enc.SignedByDoctor).ThenInclude(d => d.User)
            .Include(enc => enc.Appointment)
            .Include(enc => enc.Notes)
            .Include(enc => enc.VitalSigns).ThenInclude(v => v.RecordedByUser)
            .Include(enc => enc.Diagnoses)
            .Include(enc => enc.Prescriptions).ThenInclude(p => p.Items).ThenInclude(i => i.Drug)
            .FirstOrDefaultAsync(enc => enc.Id == id, cancellationToken);

        return e == null ? null : MapToEncounterDto(e);
    }

    public async Task<EncounterDto> StartEncounterAsync(
        StartEncounterRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var patient = await _context.Patients
            .Include(p => p.Allergies)
            .FirstOrDefaultAsync(p => p.Id == request.PatientId, cancellationToken);
        if (patient == null)
            throw new KeyNotFoundException($"Patient {request.PatientId} not found.");

        if (!patient.IsActive)
            throw new InvalidOperationException($"Cannot start encounter for deactivated patient {patient.PatientNumber}.");

        var doctor = await _context.Doctors
            .Include(d => d.User)
            .Include(d => d.Department)
            .FirstOrDefaultAsync(d => d.Id == request.DoctorId, cancellationToken);
        if (doctor == null)
            throw new KeyNotFoundException($"Doctor {request.DoctorId} not found.");

        Appointment? appt = null;
        if (request.AppointmentId.HasValue && request.AppointmentId.Value != Guid.Empty)
        {
            appt = await _context.Appointments
                .FirstOrDefaultAsync(a => a.Id == request.AppointmentId.Value, cancellationToken);
            if (appt != null)
            {
                appt.Status = AppointmentStatus.InConsultation;
                appt.UpdatedAt = DateTime.UtcNow;
            }
        }

        var encounter = new Encounter
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            DoctorId = doctor.Id,
            AppointmentId = appt?.Id,
            StartedAt = DateTime.UtcNow,
            Status = EncounterStatus.InProgress,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (!string.IsNullOrWhiteSpace(request.ChiefComplaint))
        {
            encounter.Notes.Add(new ClinicalNote
            {
                Id = Guid.NewGuid(),
                EncounterId = encounter.Id,
                ChiefComplaint = request.ChiefComplaint.Trim(),
                Version = 1,
                IsFinalized = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        _context.Encounters.Add(encounter);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Encounter.Started",
            "Encounter",
            encounter.Id.ToString(),
            $"Started clinical encounter for patient {patient.PatientNumber} ({patient.FirstName} {patient.LastName}) with Dr. {doctor.User.FullName}",
            "127.0.0.1");

        encounter.Patient = patient;
        encounter.Doctor = doctor;
        encounter.Appointment = appt;

        return MapToEncounterDto(encounter);
    }

    public async Task<ClinicalNoteDto> SaveClinicalNoteAsync(
        Guid encounterId,
        SaveClinicalNoteRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Notes)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (encounter.Status == EncounterStatus.Signed || encounter.Status == EncounterStatus.Closed)
        {
            throw new InvalidOperationException("The clinical encounter is already signed and closed. You must create an addendum instead.");
        }

        var latestNote = encounter.Notes.OrderByDescending(n => n.Version).FirstOrDefault();

        if (latestNote != null && latestNote.IsFinalized)
        {
            throw new InvalidOperationException("This note version has been finalized. Finalized clinical records are immutable. Please create an addendum.");
        }

        if (latestNote == null)
        {
            latestNote = new ClinicalNote
            {
                Id = Guid.NewGuid(),
                EncounterId = encounterId,
                ChiefComplaint = request.ChiefComplaint.Trim(),
                HistoryOfPresentIllness = request.HistoryOfPresentIllness?.Trim(),
                ExaminationFindings = request.ExaminationFindings?.Trim(),
                Assessment = request.Assessment?.Trim(),
                TreatmentPlan = request.TreatmentPlan?.Trim(),
                Version = 1,
                IsFinalized = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.ClinicalNotes.Add(latestNote);
        }
        else
        {
            latestNote.ChiefComplaint = request.ChiefComplaint.Trim();
            latestNote.HistoryOfPresentIllness = request.HistoryOfPresentIllness?.Trim();
            latestNote.ExaminationFindings = request.ExaminationFindings?.Trim();
            latestNote.Assessment = request.Assessment?.Trim();
            latestNote.TreatmentPlan = request.TreatmentPlan?.Trim();
            latestNote.UpdatedAt = DateTime.UtcNow;
        }

        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "ClinicalNote.Saved",
            "ClinicalNote",
            latestNote.Id.ToString(),
            $"Updated draft clinical SOAP note (v{latestNote.Version}) for encounter {encounterId}",
            "127.0.0.1");

        return MapToNoteDto(latestNote);
    }

    public async Task<ClinicalNoteDto> AddNoteAddendumAsync(
        Guid encounterId,
        AddNoteAddendumRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Notes)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        var originalNote = encounter.Notes.FirstOrDefault(n => n.Id == request.SupersedesNoteId);
        if (originalNote == null)
            throw new KeyNotFoundException($"Original note {request.SupersedesNoteId} not found in encounter.");

        var maxVersion = encounter.Notes.Max(n => n.Version);

        var addendumNote = new ClinicalNote
        {
            Id = Guid.NewGuid(),
            EncounterId = encounterId,
            ChiefComplaint = request.ChiefComplaint.Trim(),
            HistoryOfPresentIllness = request.HistoryOfPresentIllness?.Trim(),
            ExaminationFindings = request.ExaminationFindings?.Trim(),
            Assessment = request.Assessment?.Trim(),
            TreatmentPlan = request.TreatmentPlan?.Trim(),
            Version = maxVersion + 1,
            IsFinalized = true, // Addenda are immediately finalized
            SupersedesNoteId = originalNote.Id,
            AmendmentReason = request.AmendmentReason.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ClinicalNotes.Add(addendumNote);
        encounter.Status = EncounterStatus.AmendedByAddendum;
        encounter.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "ClinicalNote.AddendumAdded",
            "ClinicalNote",
            addendumNote.Id.ToString(),
            $"Added note addendum (v{addendumNote.Version}) superseding note {originalNote.Id}. Reason: {request.AmendmentReason}",
            "127.0.0.1");

        return MapToNoteDto(addendumNote);
    }

    public async Task<VitalSignDto> RecordVitalSignsAsync(
        Guid encounterId,
        RecordVitalSignsRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        var vital = new VitalSign
        {
            Id = Guid.NewGuid(),
            EncounterId = encounterId,
            PatientId = encounter.PatientId,
            RecordedByUserId = currentUserId,
            SystolicBp = request.SystolicBp,
            DiastolicBp = request.DiastolicBp,
            HeartRateBpm = request.HeartRateBpm,
            RespiratoryRateBpm = request.RespiratoryRateBpm,
            TemperatureCelsius = request.TemperatureCelsius,
            OxygenSaturationPct = request.OxygenSaturationPct,
            WeightKg = request.WeightKg,
            HeightCm = request.HeightCm,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.VitalSigns.Add(vital);
        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var user = await _context.UserAccounts.FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken);
        vital.RecordedByUser = user!;

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "VitalSigns.Recorded",
            "VitalSign",
            vital.Id.ToString(),
            $"Recorded vitals for encounter {encounterId}: BP {vital.SystolicBp}/{vital.DiastolicBp}, HR {vital.HeartRateBpm}, SpO2 {vital.OxygenSaturationPct}%",
            "127.0.0.1");

        return MapToVitalDto(vital);
    }

    public async Task<DiagnosisDto> AddDiagnosisAsync(
        Guid encounterId,
        AddDiagnosisRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Diagnoses)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (request.IsPrimary)
        {
            foreach (var d in encounter.Diagnoses.Where(d => d.IsPrimary))
            {
                d.IsPrimary = false;
                d.UpdatedAt = DateTime.UtcNow;
            }
        }

        var diagnosis = new Diagnosis
        {
            Id = Guid.NewGuid(),
            EncounterId = encounterId,
            PatientId = encounter.PatientId,
            Icd10Code = request.Icd10Code?.Trim().ToUpper(),
            Description = request.Description.Trim(),
            IsPrimary = request.IsPrimary || !encounter.Diagnoses.Any(),
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Diagnoses.Add(diagnosis);
        encounter.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Diagnosis.Added",
            "Diagnosis",
            diagnosis.Id.ToString(),
            $"Added diagnosis '{diagnosis.Description}' (ICD-10: {diagnosis.Icd10Code ?? "N/A"}) - Primary: {diagnosis.IsPrimary}",
            "127.0.0.1");

        return MapToDiagnosisDto(diagnosis);
    }

    public async Task<bool> RemoveDiagnosisAsync(
        Guid encounterId,
        Guid diagnosisId,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var diag = await _context.Diagnoses
            .FirstOrDefaultAsync(d => d.Id == diagnosisId && d.EncounterId == encounterId, cancellationToken);

        if (diag == null) return false;

        _context.Diagnoses.Remove(diag);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Diagnosis.Removed",
            "Diagnosis",
            diagnosisId.ToString(),
            $"Removed diagnosis '{diag.Description}' from encounter {encounterId}",
            "127.0.0.1");

        return true;
    }

    public async Task<PrescriptionDto> CreatePrescriptionAsync(
        Guid encounterId,
        CreatePrescriptionRequest request,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Patient).ThenInclude(p => p.Allergies)
            .Include(e => e.Doctor).ThenInclude(d => d.User)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        await _rxLock.WaitAsync(cancellationToken);
        try
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"RX-{year}-";

            var existingRxNumbers = await _context.Prescriptions
                .AsNoTracking()
                .Where(p => p.PrescriptionNumber.StartsWith(prefix))
                .Select(p => p.PrescriptionNumber)
                .ToListAsync(cancellationToken);

            int highestSeq = 0;
            foreach (var num in existingRxNumbers)
            {
                var suffix = num.Substring(prefix.Length);
                if (int.TryParse(suffix, out int parsed) && parsed > highestSeq)
                    highestSeq = parsed;
            }

            var nextRxNumber = $"{prefix}{(highestSeq + 1):D5}";

            var prescription = new Prescription
            {
                Id = Guid.NewGuid(),
                PrescriptionNumber = nextRxNumber,
                EncounterId = encounterId,
                PatientId = encounter.PatientId,
                DoctorId = encounter.DoctorId,
                SignedAt = DateTime.UtcNow,
                Status = PrescriptionStatus.Signed,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Process Items and check against allergies
            var drugIds = request.Items.Select(i => i.DrugId).Distinct().ToList();
            var drugs = await _context.Drugs
                .Where(d => drugIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, cancellationToken);

            var allergyWarnings = new List<string>();

            foreach (var item in request.Items)
            {
                if (!drugs.TryGetValue(item.DrugId, out var drug))
                    throw new KeyNotFoundException($"Drug ID {item.DrugId} not found in hospital formulary.");

                // Allergy conflict cross-check
                foreach (var allergy in encounter.Patient.Allergies)
                {
                    if (drug.GenericName.Contains(allergy.Allergen, StringComparison.OrdinalIgnoreCase) ||
                        drug.BrandName.Contains(allergy.Allergen, StringComparison.OrdinalIgnoreCase) ||
                        allergy.Allergen.Contains(drug.GenericName, StringComparison.OrdinalIgnoreCase))
                    {
                        var warning = $"ALLERGY ALERT: Patient is documented allergic to '{allergy.Allergen}'. Prescribed: {drug.BrandName} ({drug.GenericName}).";
                        allergyWarnings.Add(warning);
                        _logger.LogWarning(warning);
                    }
                }

                prescription.Items.Add(new PrescriptionItem
                {
                    Id = Guid.NewGuid(),
                    PrescriptionId = prescription.Id,
                    DrugId = drug.Id,
                    Dosage = item.Dosage.Trim(),
                    Frequency = item.Frequency.Trim(),
                    Route = string.IsNullOrWhiteSpace(item.Route) ? "Oral" : item.Route.Trim(),
                    DurationDays = item.DurationDays > 0 ? item.DurationDays : 7,
                    QuantityPrescribed = item.QuantityPrescribed > 0 ? item.QuantityPrescribed : 1,
                    QuantityDispensed = 0,
                    Instructions = item.Instructions?.Trim(),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            _context.Prescriptions.Add(prescription);
            encounter.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            var auditDetail = $"Issued electronic prescription {prescription.PrescriptionNumber} with {prescription.Items.Count} item(s).";
            if (allergyWarnings.Any())
            {
                auditDetail += " " + string.Join(" ", allergyWarnings);
            }

            await _auditService.LogAsync(
                currentUserId,
                currentUserName,
                "Prescription.Created",
                "Prescription",
                prescription.Id.ToString(),
                auditDetail,
                "127.0.0.1");

            prescription.Doctor = encounter.Doctor;
            prescription.Patient = encounter.Patient;

            return MapToPrescriptionDto(prescription);
        }
        finally
        {
            _rxLock.Release();
        }
    }

    public async Task<EncounterDto> SignAndCloseEncounterAsync(
        Guid encounterId,
        Guid currentUserId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Patient).ThenInclude(p => p.Allergies)
            .Include(e => e.Doctor).ThenInclude(d => d.User)
            .Include(e => e.Doctor).ThenInclude(d => d.Department)
            .Include(e => e.Appointment)
            .Include(e => e.Notes)
            .Include(e => e.VitalSigns).ThenInclude(v => v.RecordedByUser)
            .Include(e => e.Diagnoses)
            .Include(e => e.Prescriptions).ThenInclude(p => p.Items).ThenInclude(i => i.Drug)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (encounter.Status == EncounterStatus.Signed || encounter.Status == EncounterStatus.Closed)
        {
            throw new InvalidOperationException("Encounter has already been signed and closed.");
        }

        // Finalize all draft notes
        foreach (var note in encounter.Notes.Where(n => !n.IsFinalized))
        {
            note.IsFinalized = true;
            note.UpdatedAt = DateTime.UtcNow;
        }

        encounter.Status = EncounterStatus.Signed;
        encounter.SignedAt = DateTime.UtcNow;
        encounter.SignedByDoctorId = encounter.DoctorId;
        encounter.EndedAt = DateTime.UtcNow;
        encounter.UpdatedAt = DateTime.UtcNow;

        if (encounter.Appointment != null)
        {
            encounter.Appointment.Status = AppointmentStatus.Completed;
            encounter.Appointment.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Encounter.SignedAndClosed",
            "Encounter",
            encounter.Id.ToString(),
            $"Doctor {currentUserName} signed and finalized encounter {encounterId}. All clinical notes sealed.",
            "127.0.0.1");

        return MapToEncounterDto(encounter);
    }

    public Task<List<Icd10CatalogItemDto>> GetStandardIcd10CatalogAsync(string? search = null)
    {
        var catalog = new List<Icd10CatalogItemDto>
        {
            new() { Code = "I10", Description = "Essential (primary) hypertension", Category = "Cardiovascular" },
            new() { Code = "E11.9", Description = "Type 2 diabetes mellitus without complications", Category = "Endocrine" },
            new() { Code = "J45.909", Description = "Unspecified asthma, uncomplicated", Category = "Respiratory" },
            new() { Code = "J06.9", Description = "Acute upper respiratory infection, unspecified", Category = "Infectious" },
            new() { Code = "J18.9", Description = "Pneumonia, unspecified organism", Category = "Respiratory" },
            new() { Code = "K21.9", Description = "Gastro-esophageal reflux disease without esophagitis", Category = "Gastrointestinal" },
            new() { Code = "M54.5", Description = "Low back pain", Category = "Musculoskeletal" },
            new() { Code = "N39.0", Description = "Urinary tract infection, site not specified", Category = "Genitourinary" },
            new() { Code = "G43.909", Description = "Migraine, unspecified, not intractable", Category = "Neurological" },
            new() { Code = "K52.9", Description = "Noninfective gastroenteritis and colitis, unspecified", Category = "Gastrointestinal" },
            new() { Code = "R50.9", Description = "Fever, unspecified", Category = "General" },
            new() { Code = "R05", Description = "Cough", Category = "Respiratory" },
            new() { Code = "R07.9", Description = "Chest pain, unspecified", Category = "Cardiovascular" },
            new() { Code = "R10.9", Description = "Abdominal pain, unspecified", Category = "Gastrointestinal" },
            new() { Code = "Z00.00", Description = "Encounter for general adult medical examination", Category = "Preventative" }
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            catalog = catalog.Where(c =>
                c.Code.ToLower().Contains(s) ||
                c.Description.ToLower().Contains(s) ||
                c.Category.ToLower().Contains(s)).ToList();
        }

        return Task.FromResult(catalog);
    }

    public async Task<List<Drug>> GetFormularyDrugsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Drugs
            .AsNoTracking()
            .OrderBy(d => d.BrandName)
            .ToListAsync(cancellationToken);
    }

    // Mapping Helpers
    private static EncounterDto MapToEncounterDto(Encounter e)
    {
        var patientAge = 0;
        if (e.Patient != null)
        {
            var today = DateTime.UtcNow.Date;
            patientAge = today.Year - e.Patient.DateOfBirth.Year;
            if (e.Patient.DateOfBirth.Date > today.AddYears(-patientAge)) patientAge--;
        }

        return new EncounterDto
        {
            Id = e.Id,
            PatientId = e.PatientId,
            PatientNumber = e.Patient?.PatientNumber ?? string.Empty,
            PatientName = e.Patient != null ? $"{e.Patient.FirstName} {e.Patient.LastName}" : string.Empty,
            PatientAge = patientAge,
            PatientGender = e.Patient?.Gender ?? string.Empty,
            PatientBloodGroup = e.Patient?.BloodGroup,
            PatientHasHighRiskAllergy = e.Patient?.Allergies.Any(a => a.Severity >= AllergySeverity.Severe) ?? false,
            PatientAllergies = e.Patient?.Allergies.Select(a => $"{a.Allergen} ({a.Severity})").ToList() ?? new(),
            AppointmentId = e.AppointmentId,
            AppointmentNumber = e.Appointment?.AppointmentNumber,
            DoctorId = e.DoctorId,
            DoctorName = e.Doctor?.User?.FullName ?? "Unknown Doctor",
            Specialization = e.Doctor?.Specialization ?? string.Empty,
            DepartmentName = e.Doctor?.Department?.Name ?? string.Empty,
            StartedAt = e.StartedAt,
            EndedAt = e.EndedAt,
            Status = e.Status,
            SignedAt = e.SignedAt,
            SignedByDoctorId = e.SignedByDoctorId,
            SignedByDoctorName = e.SignedByDoctor?.User?.FullName,
            Notes = e.Notes.OrderBy(n => n.Version).Select(n => MapToNoteDto(n)).ToList(),
            VitalSigns = e.VitalSigns.OrderByDescending(v => v.RecordedAt).Select(v => MapToVitalDto(v)).ToList(),
            Diagnoses = e.Diagnoses.OrderByDescending(d => d.IsPrimary).Select(d => MapToDiagnosisDto(d)).ToList(),
            Prescriptions = e.Prescriptions.OrderByDescending(p => p.CreatedAt).Select(p => MapToPrescriptionDto(p)).ToList(),
            CreatedAt = e.CreatedAt,
            UpdatedAt = e.UpdatedAt
        };
    }

    private static ClinicalNoteDto MapToNoteDto(ClinicalNote n)
    {
        return new ClinicalNoteDto
        {
            Id = n.Id,
            EncounterId = n.EncounterId,
            ChiefComplaint = n.ChiefComplaint,
            HistoryOfPresentIllness = n.HistoryOfPresentIllness,
            ExaminationFindings = n.ExaminationFindings,
            Assessment = n.Assessment,
            TreatmentPlan = n.TreatmentPlan,
            Version = n.Version,
            IsFinalized = n.IsFinalized,
            SupersedesNoteId = n.SupersedesNoteId,
            AmendmentReason = n.AmendmentReason,
            CreatedAt = n.CreatedAt,
            UpdatedAt = n.UpdatedAt
        };
    }

    private static VitalSignDto MapToVitalDto(VitalSign v)
    {
        var alerts = new List<string>();
        bool isAbnormal = false;

        // Blood pressure evaluation
        string? bpCat = null;
        if (v.SystolicBp.HasValue || v.DiastolicBp.HasValue)
        {
            int sys = v.SystolicBp ?? 0;
            int dia = v.DiastolicBp ?? 0;

            if (sys >= 180 || dia >= 120)
            {
                bpCat = "Hypertensive Crisis";
                isAbnormal = true;
                alerts.Add($"Hypertensive Crisis ({sys}/{dia} mmHg)");
            }
            else if (sys >= 140 || dia >= 90)
            {
                bpCat = "Stage 2 Hypertension";
                isAbnormal = true;
                alerts.Add($"Stage 2 HTN ({sys}/{dia} mmHg)");
            }
            else if (sys >= 130 || dia >= 80)
            {
                bpCat = "Stage 1 Hypertension";
                isAbnormal = true;
                alerts.Add($"Stage 1 HTN ({sys}/{dia} mmHg)");
            }
            else if (sys >= 120 && dia < 80)
            {
                bpCat = "Elevated";
            }
            else if ((sys < 90 || dia < 60) && (sys > 0 || dia > 0))
            {
                bpCat = "Hypotension";
                isAbnormal = true;
                alerts.Add($"Hypotension ({sys}/{dia} mmHg)");
            }
            else
            {
                bpCat = "Normal";
            }
        }

        // Heart rate evaluation
        if (v.HeartRateBpm.HasValue)
        {
            if (v.HeartRateBpm.Value > 100)
            {
                isAbnormal = true;
                alerts.Add($"Tachycardia ({v.HeartRateBpm.Value} bpm)");
            }
            else if (v.HeartRateBpm.Value < 60)
            {
                isAbnormal = true;
                alerts.Add($"Bradycardia ({v.HeartRateBpm.Value} bpm)");
            }
        }

        // Temperature evaluation
        if (v.TemperatureCelsius.HasValue)
        {
            if (v.TemperatureCelsius.Value >= 38.0m)
            {
                isAbnormal = true;
                alerts.Add($"Fever ({v.TemperatureCelsius.Value:F1}°C)");
            }
            else if (v.TemperatureCelsius.Value < 35.5m)
            {
                isAbnormal = true;
                alerts.Add($"Hypothermia ({v.TemperatureCelsius.Value:F1}°C)");
            }
        }

        // SpO2 evaluation
        if (v.OxygenSaturationPct.HasValue)
        {
            if (v.OxygenSaturationPct.Value < 90m)
            {
                isAbnormal = true;
                alerts.Add($"Critical Hypoxemia ({v.OxygenSaturationPct.Value:F0}%)");
            }
            else if (v.OxygenSaturationPct.Value < 95m)
            {
                isAbnormal = true;
                alerts.Add($"Hypoxemia ({v.OxygenSaturationPct.Value:F0}%)");
            }
        }

        // Respiratory rate
        if (v.RespiratoryRateBpm.HasValue)
        {
            if (v.RespiratoryRateBpm.Value > 20)
            {
                isAbnormal = true;
                alerts.Add($"Tachypnea ({v.RespiratoryRateBpm.Value}/min)");
            }
            else if (v.RespiratoryRateBpm.Value < 12)
            {
                isAbnormal = true;
                alerts.Add($"Bradypnea ({v.RespiratoryRateBpm.Value}/min)");
            }
        }

        // BMI Calculation
        decimal? bmi = null;
        string? bmiCat = null;
        if (v.WeightKg.HasValue && v.HeightCm.HasValue && v.HeightCm.Value > 0)
        {
            var hMeters = v.HeightCm.Value / 100m;
            bmi = Math.Round(v.WeightKg.Value / (hMeters * hMeters), 1);
            if (bmi < 18.5m) bmiCat = "Underweight";
            else if (bmi < 25.0m) bmiCat = "Normal";
            else if (bmi < 30.0m) bmiCat = "Overweight";
            else bmiCat = "Obese";
        }

        return new VitalSignDto
        {
            Id = v.Id,
            EncounterId = v.EncounterId,
            PatientId = v.PatientId,
            RecordedByUserId = v.RecordedByUserId,
            RecordedByUserName = v.RecordedByUser?.FullName ?? "Staff",
            SystolicBp = v.SystolicBp,
            DiastolicBp = v.DiastolicBp,
            HeartRateBpm = v.HeartRateBpm,
            RespiratoryRateBpm = v.RespiratoryRateBpm,
            TemperatureCelsius = v.TemperatureCelsius,
            OxygenSaturationPct = v.OxygenSaturationPct,
            WeightKg = v.WeightKg,
            HeightCm = v.HeightCm,
            BpCategory = bpCat,
            Bmi = bmi,
            BmiCategory = bmiCat,
            IsAbnormal = isAbnormal,
            AbnormalAlerts = alerts,
            RecordedAt = v.RecordedAt,
            CreatedAt = v.CreatedAt
        };
    }

    private static DiagnosisDto MapToDiagnosisDto(Diagnosis d)
    {
        return new DiagnosisDto
        {
            Id = d.Id,
            EncounterId = d.EncounterId,
            PatientId = d.PatientId,
            Icd10Code = d.Icd10Code,
            Description = d.Description,
            IsPrimary = d.IsPrimary,
            RecordedAt = d.RecordedAt
        };
    }

    private static PrescriptionDto MapToPrescriptionDto(Prescription p)
    {
        return new PrescriptionDto
        {
            Id = p.Id,
            PrescriptionNumber = p.PrescriptionNumber,
            EncounterId = p.EncounterId,
            PatientId = p.PatientId,
            PatientName = p.Patient != null ? $"{p.Patient.FirstName} {p.Patient.LastName}" : string.Empty,
            DoctorId = p.DoctorId,
            DoctorName = p.Doctor?.User?.FullName ?? "Physician",
            SignedAt = p.SignedAt,
            Status = p.Status,
            Items = p.Items.Select(i => new PrescriptionItemDto
            {
                Id = i.Id,
                PrescriptionId = i.PrescriptionId,
                DrugId = i.DrugId,
                DrugName = i.Drug?.BrandName ?? "Medication",
                DrugCode = i.Drug?.Code ?? string.Empty,
                Dosage = i.Dosage,
                Frequency = i.Frequency,
                Route = i.Route,
                DurationDays = i.DurationDays,
                QuantityPrescribed = i.QuantityPrescribed,
                QuantityDispensed = i.QuantityDispensed,
                Instructions = i.Instructions
            }).ToList(),
            CreatedAt = p.CreatedAt
        };
    }
}
