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
    private readonly IPrescriptionNumberGenerator _prescriptionNumberGenerator;
    private readonly IAuditService _auditService;
    private readonly ILogger<ClinicalService> _logger;

    private static readonly List<Icd10LookupDto> StandardIcd10Catalog = new()
    {
        new() { Code = "I10", Description = "Essential (primary) hypertension", Category = "Cardiovascular" },
        new() { Code = "I25.10", Description = "Atherosclerotic heart disease of native coronary artery", Category = "Cardiovascular" },
        new() { Code = "I50.9", Description = "Heart failure, unspecified", Category = "Cardiovascular" },
        new() { Code = "E11.9", Description = "Type 2 diabetes mellitus without complications", Category = "Endocrine & Metabolic" },
        new() { Code = "E11.65", Description = "Type 2 diabetes mellitus with hyperglycemia", Category = "Endocrine & Metabolic" },
        new() { Code = "E03.9", Description = "Hypothyroidism, unspecified", Category = "Endocrine & Metabolic" },
        new() { Code = "E78.5", Description = "Hyperlipidemia, unspecified", Category = "Endocrine & Metabolic" },
        new() { Code = "J06.9", Description = "Acute upper respiratory infection, unspecified", Category = "Respiratory" },
        new() { Code = "J45.909", Description = "Unspecified asthma, uncomplicated", Category = "Respiratory" },
        new() { Code = "J44.9", Description = "Chronic obstructive pulmonary disease, unspecified", Category = "Respiratory" },
        new() { Code = "J18.9", Description = "Pneumonia, unspecified organism", Category = "Respiratory" },
        new() { Code = "J02.9", Description = "Acute pharyngitis, unspecified", Category = "Respiratory" },
        new() { Code = "K21.9", Description = "Gastro-esophageal reflux disease without esophagitis", Category = "Gastrointestinal" },
        new() { Code = "K29.70", Description = "Gastritis, unspecified, without bleeding", Category = "Gastrointestinal" },
        new() { Code = "A09", Description = "Infectious gastroenteritis and colitis, unspecified", Category = "Gastrointestinal" },
        new() { Code = "M54.5", Description = "Low back pain", Category = "Musculoskeletal" },
        new() { Code = "M25.50", Description = "Pain in unspecified joint", Category = "Musculoskeletal" },
        new() { Code = "N39.0", Description = "Urinary tract infection, site not specified", Category = "Genitourinary" },
        new() { Code = "R51", Description = "Headache", Category = "Symptoms & Signs" },
        new() { Code = "R05", Description = "Cough", Category = "Symptoms & Signs" },
        new() { Code = "R50.9", Description = "Fever, unspecified", Category = "Symptoms & Signs" },
        new() { Code = "R10.9", Description = "Unspecified abdominal pain", Category = "Symptoms & Signs" },
        new() { Code = "R42", Description = "Dizziness and giddiness", Category = "Symptoms & Signs" },
        new() { Code = "L03.90", Description = "Cellulitis, unspecified", Category = "Dermatological" },
        new() { Code = "Z00.00", Description = "Encounter for general adult medical examination without abnormal findings", Category = "Preventative & General" }
    };

    public ClinicalService(
        ApplicationDbContext context,
        IPrescriptionNumberGenerator prescriptionNumberGenerator,
        IAuditService auditService,
        ILogger<ClinicalService> logger)
    {
        _context = context;
        _prescriptionNumberGenerator = prescriptionNumberGenerator;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<PagedResult<EncounterSummaryDto>> GetEncountersAsync(
        Guid? patientId = null,
        Guid? doctorId = null,
        EncounterStatus? status = null,
        DateTime? date = null,
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
            .Include(e => e.SignedByDoctor).ThenInclude(d => d!.User)
            .Include(e => e.Appointment)
            .Include(e => e.Notes)
            .Include(e => e.Diagnoses)
            .AsQueryable();

        if (patientId.HasValue && patientId.Value != Guid.Empty)
            q = q.Where(e => e.PatientId == patientId.Value);

        if (doctorId.HasValue && doctorId.Value != Guid.Empty)
            q = q.Where(e => e.DoctorId == doctorId.Value);

        if (status.HasValue)
            q = q.Where(e => e.Status == status.Value);

        if (date.HasValue)
        {
            var dayUtc = DateTime.SpecifyKind(date.Value.Date, DateTimeKind.Utc);
            var nextDayUtc = dayUtc.AddDays(1);
            q = q.Where(e => e.StartedAt >= dayUtc && e.StartedAt < nextDayUtc);
        }

        var total = await q.CountAsync(cancellationToken);

        var list = await q
            .OrderByDescending(e => e.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = list.Select(e =>
        {
            var latestNote = e.Notes.OrderByDescending(n => n.Version).FirstOrDefault();
            var primaryDiag = e.Diagnoses.FirstOrDefault(d => d.IsPrimary) ?? e.Diagnoses.FirstOrDefault();
            int age = DateTime.UtcNow.Year - e.Patient.DateOfBirth.Year;
            if (e.Patient.DateOfBirth.Date > DateTime.UtcNow.AddYears(-age)) age--;

            return new EncounterSummaryDto
            {
                Id = e.Id,
                PatientId = e.PatientId,
                PatientNumber = e.Patient.PatientNumber,
                PatientName = $"{e.Patient.FirstName} {e.Patient.LastName}",
                PatientAge = age,
                PatientGender = e.Patient.Gender,
                PatientPhone = e.Patient.Phone,
                HasHighRiskAllergy = e.Patient.Allergies.Any(a => a.Severity >= 2),
                DoctorId = e.DoctorId,
                DoctorName = e.Doctor.User.FullName,
                DepartmentName = e.Doctor.Department.Name,
                AppointmentId = e.AppointmentId,
                AppointmentNumber = e.Appointment?.AppointmentNumber,
                StartedAt = e.StartedAt,
                EndedAt = e.EndedAt,
                Status = e.Status,
                SignedAt = e.SignedAt,
                SignedByDoctorName = e.SignedByDoctor?.User.FullName,
                ChiefComplaint = latestNote?.ChiefComplaint,
                PrimaryDiagnosis = primaryDiag != null ? $"{primaryDiag.Icd10Code} - {primaryDiag.Description}" : null
            };
        }).ToList();

        return new PagedResult<EncounterSummaryDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = items
        };
    }

    public async Task<EncounterDetailDto?> GetEncounterByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var e = await _context.Encounters
            .AsNoTracking()
            .Include(enc => enc.Patient).ThenInclude(p => p.Allergies)
            .Include(enc => enc.Patient).ThenInclude(p => p.Conditions)
            .Include(enc => enc.Doctor).ThenInclude(d => d.User)
            .Include(enc => enc.Doctor).ThenInclude(d => d.Department)
            .Include(enc => enc.SignedByDoctor).ThenInclude(d => d!.User)
            .Include(enc => enc.Appointment)
            .Include(enc => enc.Notes)
            .Include(enc => enc.VitalSigns).ThenInclude(v => v.RecordedByUser)
            .Include(enc => enc.Diagnoses)
            .Include(enc => enc.Prescriptions).ThenInclude(p => p.Doctor).ThenInclude(d => d.User)
            .Include(enc => enc.Prescriptions).ThenInclude(p => p.Items).ThenInclude(i => i.Drug)
            .FirstOrDefaultAsync(enc => enc.Id == id, cancellationToken);

        if (e == null) return null;

        return MapToDetailDto(e);
    }

    public async Task<EncounterDetailDto> StartEncounterAsync(
        StartEncounterRequest request,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var patient = await _context.Patients
            .Include(p => p.Allergies)
            .Include(p => p.Conditions)
            .FirstOrDefaultAsync(p => p.Id == request.PatientId, cancellationToken);
        if (patient == null)
            throw new KeyNotFoundException($"Patient {request.PatientId} not found.");
        if (!patient.IsActive)
            throw new InvalidOperationException($"Patient {patient.PatientNumber} is deactivated.");

        var doctor = await _context.Doctors
            .Include(d => d.User)
            .Include(d => d.Department)
            .FirstOrDefaultAsync(d => d.Id == request.DoctorId, cancellationToken);
        if (doctor == null)
            throw new KeyNotFoundException($"Doctor {request.DoctorId} not found.");
        if (!doctor.IsActive)
            throw new InvalidOperationException($"Doctor {doctor.User.FullName} is inactive.");

        Appointment? appt = null;
        if (request.AppointmentId.HasValue && request.AppointmentId.Value != Guid.Empty)
        {
            appt = await _context.Appointments
                .FirstOrDefaultAsync(a => a.Id == request.AppointmentId.Value, cancellationToken);

            if (appt != null)
            {
                if (appt.Status == AppointmentStatus.Cancelled)
                    throw new InvalidOperationException("Cannot start an encounter for a cancelled appointment.");

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

        _context.Encounters.Add(encounter);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName,
            "Encounter.Started",
            "Encounter",
            encounter.Id.ToString(),
            $"Started clinical encounter for patient {patient.PatientNumber} with doctor {doctor.User.FullName}",
            "127.0.0.1");

        encounter.Patient = patient;
        encounter.Doctor = doctor;
        encounter.Appointment = appt;

        return MapToDetailDto(encounter);
    }

    public async Task<VitalSignDto> RecordVitalSignsAsync(
        Guid encounterId,
        RecordVitalSignsRequest request,
        Guid recordedByUserId,
        string recordedByName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Patient)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (encounter.Status == EncounterStatus.Closed)
            throw new InvalidOperationException("Cannot record vitals for a closed encounter.");

        var vs = new VitalSign
        {
            Id = Guid.NewGuid(),
            EncounterId = encounter.Id,
            PatientId = encounter.PatientId,
            RecordedByUserId = recordedByUserId,
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

        _context.VitalSigns.Add(vs);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            recordedByUserId,
            recordedByName,
            "VitalSigns.Recorded",
            "VitalSign",
            vs.Id.ToString(),
            $"Recorded vitals for patient {encounter.Patient.PatientNumber} in encounter {encounter.Id}",
            "127.0.0.1");

        return MapVitalSignDto(vs, recordedByName);
    }

    public async Task<ClinicalNoteDto> SaveClinicalNoteDraftAsync(
        Guid encounterId,
        SaveClinicalNoteRequest request,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Notes)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (encounter.Status == EncounterStatus.Signed || encounter.Status == EncounterStatus.Closed)
            throw new InvalidOperationException("Encounter is already signed and immutable. Use AddNoteAddendum to record amendments.");

        var activeDraft = encounter.Notes.FirstOrDefault(n => !n.IsFinalized);

        if (activeDraft != null)
        {
            activeDraft.ChiefComplaint = request.ChiefComplaint.Trim();
            activeDraft.HistoryOfPresentIllness = request.HistoryOfPresentIllness?.Trim();
            activeDraft.ExaminationFindings = request.ExaminationFindings?.Trim();
            activeDraft.Assessment = request.Assessment?.Trim();
            activeDraft.TreatmentPlan = request.TreatmentPlan?.Trim();
            activeDraft.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            activeDraft = new ClinicalNote
            {
                Id = Guid.NewGuid(),
                EncounterId = encounter.Id,
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
            _context.ClinicalNotes.Add(activeDraft);
        }

        encounter.Status = EncounterStatus.Draft;
        encounter.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName,
            "ClinicalNote.DraftSaved",
            "ClinicalNote",
            activeDraft.Id.ToString(),
            $"Saved clinical note draft v{activeDraft.Version} for encounter {encounter.Id}",
            "127.0.0.1");

        return MapClinicalNoteDto(activeDraft);
    }

    public async Task<EncounterDetailDto> SignEncounterAsync(
        Guid encounterId,
        Guid signingDoctorId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Patient).ThenInclude(p => p.Allergies)
            .Include(e => e.Patient).ThenInclude(p => p.Conditions)
            .Include(e => e.Doctor).ThenInclude(d => d.User)
            .Include(e => e.Doctor).ThenInclude(d => d.Department)
            .Include(e => e.Appointment)
            .Include(e => e.Notes)
            .Include(e => e.VitalSigns).ThenInclude(v => v.RecordedByUser)
            .Include(e => e.Diagnoses)
            .Include(e => e.Prescriptions).ThenInclude(p => p.Doctor).ThenInclude(d => d.User)
            .Include(e => e.Prescriptions).ThenInclude(p => p.Items).ThenInclude(i => i.Drug)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (encounter.Status == EncounterStatus.Signed || encounter.Status == EncounterStatus.Closed)
            throw new InvalidOperationException("Encounter is already signed.");

        var activeNote = encounter.Notes.OrderByDescending(n => n.Version).FirstOrDefault();
        if (activeNote == null)
            throw new InvalidOperationException("Cannot sign an encounter without a clinical note.");

        var doctor = await _context.Doctors
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == signingDoctorId, cancellationToken);

        if (doctor == null)
            throw new KeyNotFoundException($"Signing doctor {signingDoctorId} not found.");

        activeNote.IsFinalized = true;
        activeNote.UpdatedAt = DateTime.UtcNow;

        var now = DateTime.UtcNow;
        encounter.SignedAt = now;
        encounter.SignedByDoctorId = doctor.Id;
        encounter.EndedAt = now;
        encounter.Status = EncounterStatus.Signed;
        encounter.UpdatedAt = now;

        if (encounter.Appointment != null)
        {
            encounter.Appointment.Status = AppointmentStatus.Completed;
            encounter.Appointment.UpdatedAt = now;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            doctor.UserId,
            currentUserName,
            "Encounter.Signed",
            "Encounter",
            encounter.Id.ToString(),
            $"Doctor {doctor.User.FullName} signed and finalized clinical encounter {encounter.Id}. Note is now immutable.",
            "127.0.0.1");

        encounter.SignedByDoctor = doctor;
        return MapToDetailDto(encounter);
    }

    public async Task<ClinicalNoteDto> AddNoteAddendumAsync(
        Guid encounterId,
        AddAddendumRequest request,
        Guid doctorId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.AmendmentReason))
            throw new ArgumentException("A mandatory amendment reason must be provided.");

        var encounter = await _context.Encounters
            .Include(e => e.Notes)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        if (encounter.Status != EncounterStatus.Signed && encounter.Status != EncounterStatus.AmendedByAddendum)
            throw new InvalidOperationException("Addenda can only be appended to signed clinical encounters.");

        var originalNote = encounter.Notes.FirstOrDefault(n => n.Id == request.OriginalNoteId);
        if (originalNote == null)
            throw new KeyNotFoundException($"Original note {request.OriginalNoteId} was not found.");

        int nextVersion = encounter.Notes.Max(n => n.Version) + 1;

        var addendumNote = new ClinicalNote
        {
            Id = Guid.NewGuid(),
            EncounterId = encounter.Id,
            ChiefComplaint = request.ChiefComplaint.Trim(),
            HistoryOfPresentIllness = request.HistoryOfPresentIllness?.Trim(),
            ExaminationFindings = request.ExaminationFindings?.Trim(),
            Assessment = request.Assessment?.Trim(),
            TreatmentPlan = request.TreatmentPlan?.Trim(),
            Version = nextVersion,
            IsFinalized = true,
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
            null,
            currentUserName,
            "ClinicalNote.AddendumAdded",
            "ClinicalNote",
            addendumNote.Id.ToString(),
            $"Added note addendum v{addendumNote.Version} to encounter {encounter.Id}. Reason: {request.AmendmentReason}",
            "127.0.0.1");

        return MapClinicalNoteDto(addendumNote);
    }

    public async Task<DiagnosisDto> AddDiagnosisAsync(
        Guid encounterId,
        AddDiagnosisRequest request,
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
            foreach (var d in encounter.Diagnoses)
            {
                d.IsPrimary = false;
            }
        }

        var diagnosis = new Diagnosis
        {
            Id = Guid.NewGuid(),
            EncounterId = encounter.Id,
            PatientId = encounter.PatientId,
            Icd10Code = request.Icd10Code?.Trim().ToUpperInvariant(),
            Description = request.Description.Trim(),
            IsPrimary = request.IsPrimary,
            RecordedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Diagnoses.Add(diagnosis);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName,
            "Diagnosis.Added",
            "Diagnosis",
            diagnosis.Id.ToString(),
            $"Recorded diagnosis '{diagnosis.Description}' ({diagnosis.Icd10Code}) for encounter {encounter.Id}",
            "127.0.0.1");

        return new DiagnosisDto
        {
            Id = diagnosis.Id,
            EncounterId = diagnosis.EncounterId,
            PatientId = diagnosis.PatientId,
            Icd10Code = diagnosis.Icd10Code,
            Description = diagnosis.Description,
            IsPrimary = diagnosis.IsPrimary,
            RecordedAt = diagnosis.RecordedAt
        };
    }

    public async Task<bool> RemoveDiagnosisAsync(
        Guid encounterId,
        Guid diagnosisId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var diagnosis = await _context.Diagnoses
            .FirstOrDefaultAsync(d => d.Id == diagnosisId && d.EncounterId == encounterId, cancellationToken);

        if (diagnosis == null) return false;

        _context.Diagnoses.Remove(diagnosis);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            null,
            currentUserName,
            "Diagnosis.Removed",
            "Diagnosis",
            diagnosis.Id.ToString(),
            $"Removed diagnosis '{diagnosis.Description}' from encounter {encounterId}",
            "127.0.0.1");

        return true;
    }

    public async Task<PrescriptionDto> CreatePrescriptionAsync(
        Guid encounterId,
        CreatePrescriptionRequest request,
        Guid doctorId,
        string currentUserName,
        CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Patient)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {encounterId} not found.");

        var doctor = await _context.Doctors
            .Include(d => d.User)
            .FirstOrDefaultAsync(d => d.Id == doctorId, cancellationToken);

        if (doctor == null)
            throw new KeyNotFoundException($"Doctor {doctorId} not found.");

        var rxNumber = await _prescriptionNumberGenerator.GenerateNextPrescriptionNumberAsync(cancellationToken);

        var prescription = new Prescription
        {
            Id = Guid.NewGuid(),
            PrescriptionNumber = rxNumber,
            EncounterId = encounter.Id,
            PatientId = encounter.PatientId,
            DoctorId = doctor.Id,
            SignedAt = DateTime.UtcNow,
            Status = PrescriptionStatus.Signed,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        foreach (var itemReq in request.Items)
        {
            var drug = await _context.Drugs.FirstOrDefaultAsync(d => d.Id == itemReq.DrugId, cancellationToken);
            if (drug == null)
                throw new KeyNotFoundException($"Drug {itemReq.DrugId} not found in catalog.");

            var item = new PrescriptionItem
            {
                Id = Guid.NewGuid(),
                PrescriptionId = prescription.Id,
                DrugId = drug.Id,
                Dosage = itemReq.Dosage.Trim(),
                Frequency = itemReq.Frequency.Trim(),
                Route = itemReq.Route.Trim(),
                DurationDays = itemReq.DurationDays,
                QuantityPrescribed = itemReq.QuantityPrescribed,
                Instructions = itemReq.Instructions?.Trim(),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            prescription.Items.Add(item);
        }

        _context.Prescriptions.Add(prescription);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            doctor.UserId,
            currentUserName,
            "Prescription.Created",
            "Prescription",
            prescription.Id.ToString(),
            $"Issued prescription {rxNumber} with {prescription.Items.Count} item(s) for patient {encounter.Patient.PatientNumber}",
            "127.0.0.1");

        prescription.Doctor = doctor;
        return MapPrescriptionDto(prescription);
    }

    public Task<List<Icd10LookupDto>> GetIcd10CatalogAsync(
        string? query = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Task.FromResult(StandardIcd10Catalog);
        }

        var search = query.Trim().ToLowerInvariant();
        var matches = StandardIcd10Catalog
            .Where(c => c.Code.ToLowerInvariant().Contains(search) || c.Description.ToLowerInvariant().Contains(search) || c.Category.ToLowerInvariant().Contains(search))
            .ToList();

        return Task.FromResult(matches);
    }

    public async Task<List<Drug>> GetEssentialDrugsAsync(
        string? query = null,
        CancellationToken cancellationToken = default)
    {
        var q = _context.Drugs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(d => d.GenericName.ToLower().Contains(search) || d.BrandName.ToLower().Contains(search) || d.Code.ToLower().Contains(search));
        }

        return await q.OrderBy(d => d.GenericName).ToListAsync(cancellationToken);
    }

    private static EncounterDetailDto MapToDetailDto(Encounter e)
    {
        int age = DateTime.UtcNow.Year - e.Patient.DateOfBirth.Year;
        if (e.Patient.DateOfBirth.Date > DateTime.UtcNow.AddYears(-age)) age--;

        var patDto = new PatientDto(
            e.Patient.Id,
            e.Patient.PatientNumber,
            e.Patient.FirstName,
            e.Patient.LastName,
            $"{e.Patient.FirstName} {e.Patient.LastName}",
            e.Patient.DateOfBirth,
            age,
            e.Patient.Gender,
            e.Patient.BloodGroup,
            e.Patient.Phone,
            e.Patient.Email,
            e.Patient.Address,
            e.Patient.EmergencyContactName,
            e.Patient.EmergencyContactPhone,
            e.Patient.IsActive,
            e.Patient.Allergies?.Count ?? 0,
            e.Patient.Allergies?.Any(a => a.Severity >= 2) ?? false,
            e.Patient.CreatedAt,
            e.Patient.UpdatedAt
        );

        var docDto = new DoctorDto
        {
            Id = e.Doctor.Id,
            UserId = e.Doctor.UserId,
            FullName = e.Doctor.User?.FullName ?? "Unknown Doctor",
            Email = e.Doctor.User?.Email ?? string.Empty,
            DepartmentId = e.Doctor.DepartmentId,
            DepartmentName = e.Doctor.Department?.Name ?? string.Empty,
            DepartmentCode = e.Doctor.Department?.Code ?? string.Empty,
            LicenseNumber = e.Doctor.LicenseNumber,
            Specialization = e.Doctor.Specialization,
            ConsultationFee = e.Doctor.ConsultationFee,
            IsActive = e.Doctor.IsActive
        };

        AppointmentDto? apptDto = null;
        if (e.Appointment != null)
        {
            apptDto = new AppointmentDto
            {
                Id = e.Appointment.Id,
                AppointmentNumber = e.Appointment.AppointmentNumber,
                PatientId = e.Appointment.PatientId,
                PatientNumber = e.Patient.PatientNumber,
                PatientName = $"{e.Patient.FirstName} {e.Patient.LastName}",
                PatientPhone = e.Patient.Phone,
                DoctorId = e.Appointment.DoctorId,
                DoctorName = docDto.FullName,
                Specialization = docDto.Specialization,
                DepartmentId = e.Appointment.DepartmentId,
                DepartmentName = docDto.DepartmentName,
                StartsAt = e.Appointment.StartsAt,
                EndsAt = e.Appointment.EndsAt,
                Status = e.Appointment.Status,
                Reason = e.Appointment.Reason,
                CreatedAt = e.Appointment.CreatedAt
            };
        }

        return new EncounterDetailDto
        {
            Id = e.Id,
            Patient = patDto,
            Doctor = docDto,
            Appointment = apptDto,
            StartedAt = e.StartedAt,
            EndedAt = e.EndedAt,
            Status = e.Status,
            SignedAt = e.SignedAt,
            SignedByDoctorName = e.SignedByDoctor?.User?.FullName,
            Notes = e.Notes.OrderBy(n => n.Version).Select(n => MapClinicalNoteDto(n)).ToList(),
            VitalSigns = e.VitalSigns.OrderByDescending(v => v.RecordedAt).Select(v => MapVitalSignDto(v, v.RecordedByUser?.FullName ?? "Staff")).ToList(),
            Diagnoses = e.Diagnoses.OrderByDescending(d => d.IsPrimary).ThenBy(d => d.RecordedAt).Select(d => new DiagnosisDto
            {
                Id = d.Id,
                EncounterId = d.EncounterId,
                PatientId = d.PatientId,
                Icd10Code = d.Icd10Code,
                Description = d.Description,
                IsPrimary = d.IsPrimary,
                RecordedAt = d.RecordedAt
            }).ToList(),
            Prescriptions = e.Prescriptions.OrderByDescending(p => p.CreatedAt).Select(p => MapPrescriptionDto(p)).ToList(),
            Allergies = e.Patient.Allergies?.Select(a => new PatientAllergyDto(
                a.Id,
                a.PatientId,
                a.Allergen,
                a.Reaction,
                a.Severity,
                a.RecordedAt,
                a.CreatedAt
            )).ToList() ?? new(),
            ChronicConditions = e.Patient.Conditions?.Select(c => new PatientConditionDto(
                c.Id,
                c.PatientId,
                c.ConditionName,
                c.Status,
                c.DiagnosedDate,
                c.CreatedAt
            )).ToList() ?? new()
        };
    }

    private static ClinicalNoteDto MapClinicalNoteDto(ClinicalNote n)
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

    private static VitalSignDto MapVitalSignDto(VitalSign v, string recordedByName)
    {
        var alerts = new List<string>();

        if (v.SystolicBp.HasValue && v.DiastolicBp.HasValue)
        {
            if (v.SystolicBp.Value >= 140 || v.DiastolicBp.Value >= 90)
                alerts.Add($"Elevated Blood Pressure ({v.SystolicBp}/{v.DiastolicBp} mmHg)");
            else if (v.SystolicBp.Value < 90 || v.DiastolicBp.Value < 60)
                alerts.Add($"Low Blood Pressure ({v.SystolicBp}/{v.DiastolicBp} mmHg)");
        }

        if (v.HeartRateBpm.HasValue)
        {
            if (v.HeartRateBpm.Value > 100)
                alerts.Add($"Tachycardia ({v.HeartRateBpm} bpm)");
            else if (v.HeartRateBpm.Value < 60)
                alerts.Add($"Bradycardia ({v.HeartRateBpm} bpm)");
        }

        if (v.RespiratoryRateBpm.HasValue)
        {
            if (v.RespiratoryRateBpm.Value > 20)
                alerts.Add($"Tachypnea ({v.RespiratoryRateBpm} breaths/min)");
            else if (v.RespiratoryRateBpm.Value < 12)
                alerts.Add($"Bradypnea ({v.RespiratoryRateBpm} breaths/min)");
        }

        if (v.TemperatureCelsius.HasValue)
        {
            if (v.TemperatureCelsius.Value >= 38.0m)
                alerts.Add($"Fever ({v.TemperatureCelsius.Value:F1} °C)");
            else if (v.TemperatureCelsius.Value < 36.0m)
                alerts.Add($"Hypothermia ({v.TemperatureCelsius.Value:F1} °C)");
        }

        if (v.OxygenSaturationPct.HasValue && v.OxygenSaturationPct.Value < 95.0m)
        {
            alerts.Add($"Hypoxia Alert ({v.OxygenSaturationPct.Value:F1}%)");
        }

        decimal? bmi = null;
        if (v.WeightKg.HasValue && v.HeightCm.HasValue && v.HeightCm.Value > 0)
        {
            var heightM = v.HeightCm.Value / 100.0m;
            bmi = Math.Round(v.WeightKg.Value / (heightM * heightM), 1);
        }

        return new VitalSignDto
        {
            Id = v.Id,
            EncounterId = v.EncounterId,
            PatientId = v.PatientId,
            RecordedByUserId = v.RecordedByUserId,
            RecordedByName = recordedByName,
            SystolicBp = v.SystolicBp,
            DiastolicBp = v.DiastolicBp,
            HeartRateBpm = v.HeartRateBpm,
            RespiratoryRateBpm = v.RespiratoryRateBpm,
            TemperatureCelsius = v.TemperatureCelsius,
            OxygenSaturationPct = v.OxygenSaturationPct,
            WeightKg = v.WeightKg,
            HeightCm = v.HeightCm,
            Bmi = bmi,
            AbnormalAlerts = alerts,
            RecordedAt = v.RecordedAt
        };
    }

    private static PrescriptionDto MapPrescriptionDto(Prescription p)
    {
        return new PrescriptionDto
        {
            Id = p.Id,
            PrescriptionNumber = p.PrescriptionNumber,
            EncounterId = p.EncounterId,
            PatientId = p.PatientId,
            DoctorId = p.DoctorId,
            DoctorName = p.Doctor?.User?.FullName ?? "Unknown Physician",
            SignedAt = p.SignedAt,
            Status = p.Status,
            Items = p.Items.Select(i => new PrescriptionItemDto
            {
                Id = i.Id,
                DrugId = i.DrugId,
                DrugName = i.Drug != null ? $"{i.Drug.GenericName} ({i.Drug.BrandName})" : "Medication",
                Dosage = i.Dosage,
                Frequency = i.Frequency,
                Route = i.Route,
                DurationDays = i.DurationDays,
                QuantityPrescribed = i.QuantityPrescribed,
                Instructions = i.Instructions
            }).ToList()
        };
    }
}
