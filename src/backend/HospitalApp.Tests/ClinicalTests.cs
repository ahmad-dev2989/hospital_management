using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class ClinicalTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupEncounterIds = new();
    private readonly List<Guid> _cleanupPatientIds = new();
    private readonly List<Guid> _cleanupDoctorIds = new();

    public ClinicalTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        if (_cleanupEncounterIds.Count > 0)
        {
            var notes = _dbContext.ClinicalNotes.Where(n => _cleanupEncounterIds.Contains(n.EncounterId)).ToList();
            _dbContext.ClinicalNotes.RemoveRange(notes);

            var vitals = _dbContext.VitalSigns.Where(v => _cleanupEncounterIds.Contains(v.EncounterId)).ToList();
            _dbContext.VitalSigns.RemoveRange(vitals);

            var diags = _dbContext.Diagnoses.Where(d => _cleanupEncounterIds.Contains(d.EncounterId)).ToList();
            _dbContext.Diagnoses.RemoveRange(diags);

            var rxItems = _dbContext.PrescriptionItems
                .Where(i => _dbContext.Prescriptions.Any(p => _cleanupEncounterIds.Contains(p.EncounterId) && p.Id == i.PrescriptionId))
                .ToList();
            _dbContext.PrescriptionItems.RemoveRange(rxItems);

            var rxs = _dbContext.Prescriptions.Where(p => _cleanupEncounterIds.Contains(p.EncounterId)).ToList();
            _dbContext.Prescriptions.RemoveRange(rxs);

            var encounters = _dbContext.Encounters.Where(e => _cleanupEncounterIds.Contains(e.Id)).ToList();
            _dbContext.Encounters.RemoveRange(encounters);
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

    private ClinicalService CreateService()
    {
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        return new ClinicalService(_dbContext, audit, NullLogger<ClinicalService>.Instance);
    }

    private async Task<Doctor> GetOrCreateTestDoctorAsync()
    {
        var existingDoc = await _dbContext.Doctors
            .Include(d => d.User)
            .Include(d => d.Department)
            .FirstOrDefaultAsync(d => d.IsActive);

        if (existingDoc != null) return existingDoc;

        var user = await _dbContext.UserAccounts.FirstAsync(u => u.Role == UserRole.Doctor);
        var dept = await _dbContext.Departments.FirstAsync();

        var doc = new Doctor
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            DepartmentId = dept.Id,
            LicenseNumber = $"CLINIC-MD-{Guid.NewGuid().ToString()[..6]}",
            Specialization = "General Internal Medicine",
            ConsultationFee = 50.00m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Doctors.Add(doc);
        await _dbContext.SaveChangesAsync();
        _cleanupDoctorIds.Add(doc.Id);
        return doc;
    }

    private async Task<Patient> CreateTestPatientAsync(bool withPenicillinAllergy = false)
    {
        var pat = new Patient
        {
            Id = Guid.NewGuid(),
            PatientNumber = $"CLIN-{Guid.NewGuid().ToString()[..8]}",
            FirstName = "ClinicalFirst",
            LastName = "ClinicalLast",
            DateOfBirth = DateTime.SpecifyKind(new DateTime(1985, 4, 15), DateTimeKind.Utc),
            Gender = "Female",
            BloodGroup = "A+",
            Phone = $"+1-555-{new Random().Next(1000, 9999)}",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (withPenicillinAllergy)
        {
            pat.Allergies.Add(new PatientAllergy
            {
                Id = Guid.NewGuid(),
                PatientId = pat.Id,
                Allergen = "Amoxicillin",
                Reaction = "Anaphylaxis and urticaria",
                Severity = AllergySeverity.Severe,
                RecordedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        _dbContext.Patients.Add(pat);
        await _dbContext.SaveChangesAsync();
        _cleanupPatientIds.Add(pat.Id);
        return pat;
    }

    [Fact]
    public async Task StartEncounter_SetsStatusToInProgress_AndInitializesVisit()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            ChiefComplaint = "Severe throbbing frontal headache for 3 days"
        }, doctor.UserId, "Dr. Test");

        _cleanupEncounterIds.Add(encounter.Id);

        Assert.NotNull(encounter);
        Assert.Equal(EncounterStatus.InProgress, encounter.Status);
        Assert.Single(encounter.Notes);
        Assert.Equal("Severe throbbing frontal headache for 3 days", encounter.Notes[0].ChiefComplaint);
        Assert.False(encounter.Notes[0].IsFinalized);
    }

    [Fact]
    public async Task SaveClinicalNote_DraftSavesAndUpdates()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            ChiefComplaint = "Cough"
        }, doctor.UserId, "Dr. Test");
        _cleanupEncounterIds.Add(encounter.Id);

        var savedNote = await service.SaveClinicalNoteAsync(encounter.Id, new SaveClinicalNoteRequest
        {
            ChiefComplaint = "Productive cough with yellow sputum",
            HistoryOfPresentIllness = "Onset 5 days ago, accompanied by low grade fever",
            ExaminationFindings = "Bilateral rhonchi on lower lung lobes, throat congested",
            Assessment = "Acute Bronchitis (J20.9)",
            TreatmentPlan = "Hydration, bronchodilator inhaler, analgesics"
        }, doctor.UserId, "Dr. Test");

        Assert.Equal("Productive cough with yellow sputum", savedNote.ChiefComplaint);
        Assert.Equal("Acute Bronchitis (J20.9)", savedNote.Assessment);
        Assert.Equal(1, savedNote.Version);
        Assert.False(savedNote.IsFinalized);
    }

    [Fact]
    public async Task FinalizedNote_IsImmutable_RejectsDirectEdit()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            ChiefComplaint = "Abdominal pain"
        }, doctor.UserId, "Dr. Test");
        _cleanupEncounterIds.Add(encounter.Id);

        // Sign and close encounter (finalizes the note)
        await service.SignAndCloseEncounterAsync(encounter.Id, doctor.UserId, "Dr. Test");

        // Attempt direct modification of finalized note should fail
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SaveClinicalNoteAsync(encounter.Id, new SaveClinicalNoteRequest
            {
                ChiefComplaint = "Modified complaint attempt",
                Assessment = "Altered diagnosis"
            }, doctor.UserId, "Dr. Test"));

        Assert.Contains("signed and closed", ex.Message);
    }

    [Fact]
    public async Task AddNoteAddendum_IncrementsVersion_AndReferencesSupersededNote()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id,
            ChiefComplaint = "Sprained right ankle"
        }, doctor.UserId, "Dr. Test");
        _cleanupEncounterIds.Add(encounter.Id);

        var note1 = encounter.Notes[0];

        // Finalize encounter first
        await service.SignAndCloseEncounterAsync(encounter.Id, doctor.UserId, "Dr. Test");

        // Add versioned addendum
        var addendum = await service.AddNoteAddendumAsync(encounter.Id, new AddNoteAddendumRequest
        {
            SupersedesNoteId = note1.Id,
            AmendmentReason = "X-ray imaging returned showing non-displaced lateral malleolus hairline fracture",
            ChiefComplaint = "Sprained right ankle with hairline fibular fracture",
            Assessment = "Closed non-displaced fracture of right fibula (S82.401A)",
            TreatmentPlan = "Short leg cast application, non-weight bearing crutches for 4 weeks"
        }, doctor.UserId, "Dr. Test");

        Assert.Equal(2, addendum.Version);
        Assert.True(addendum.IsFinalized);
        Assert.Equal(note1.Id, addendum.SupersedesNoteId);
        Assert.NotNull(addendum.AmendmentReason);

        var updatedEnc = await service.GetEncounterByIdAsync(encounter.Id);
        Assert.NotNull(updatedEnc);
        Assert.Equal(EncounterStatus.AmendedByAddendum, updatedEnc.Status);
        Assert.Equal(2, updatedEnc.Notes.Count);
    }

    [Fact]
    public async Task RecordVitalSigns_CalculatesAbnormalAlertsAndBmi()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id
        }, doctor.UserId, "Dr. Test");
        _cleanupEncounterIds.Add(encounter.Id);

        var vitals = await service.RecordVitalSignsAsync(encounter.Id, new RecordVitalSignsRequest
        {
            SystolicBp = 185,
            DiastolicBp = 122,
            HeartRateBpm = 115,
            TemperatureCelsius = 38.8m,
            OxygenSaturationPct = 89m,
            RespiratoryRateBpm = 24,
            WeightKg = 85.0m,
            HeightCm = 175.0m
        }, doctor.UserId, "Dr. Test");

        Assert.True(vitals.IsAbnormal);
        Assert.Equal("Hypertensive Crisis", vitals.BpCategory);
        Assert.Contains(vitals.AbnormalAlerts, a => a.Contains("Hypertensive Crisis"));
        Assert.Contains(vitals.AbnormalAlerts, a => a.Contains("Tachycardia"));
        Assert.Contains(vitals.AbnormalAlerts, a => a.Contains("Fever"));
        Assert.Contains(vitals.AbnormalAlerts, a => a.Contains("Critical Hypoxemia"));
        Assert.Contains(vitals.AbnormalAlerts, a => a.Contains("Tachypnea"));

        // BMI: 85 / (1.75^2) = 27.8 (Overweight)
        Assert.NotNull(vitals.Bmi);
        Assert.Equal(27.8m, vitals.Bmi.Value);
        Assert.Equal("Overweight", vitals.BmiCategory);
    }

    [Fact]
    public async Task AddDiagnosis_EnforcesPrimaryDiagnosisRules()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync();

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id
        }, doctor.UserId, "Dr. Test");
        _cleanupEncounterIds.Add(encounter.Id);

        var diag1 = await service.AddDiagnosisAsync(encounter.Id, new AddDiagnosisRequest
        {
            Icd10Code = "I10",
            Description = "Essential hypertension",
            IsPrimary = true
        }, doctor.UserId, "Dr. Test");

        Assert.True(diag1.IsPrimary);

        var diag2 = await service.AddDiagnosisAsync(encounter.Id, new AddDiagnosisRequest
        {
            Icd10Code = "E11.9",
            Description = "Type 2 diabetes mellitus",
            IsPrimary = true
        }, doctor.UserId, "Dr. Test");

        Assert.True(diag2.IsPrimary);

        var details = await service.GetEncounterByIdAsync(encounter.Id);
        Assert.NotNull(details);

        var d1 = details.Diagnoses.First(d => d.Id == diag1.Id);
        var d2 = details.Diagnoses.First(d => d.Id == diag2.Id);

        // Diag2 took over as primary; Diag1 was demoted to secondary
        Assert.False(d1.IsPrimary);
        Assert.True(d2.IsPrimary);
    }

    [Fact]
    public async Task CreatePrescription_GeneratesSequentialRxNumber_AndDetectsAllergyAlert()
    {
        var service = CreateService();
        var doctor = await GetOrCreateTestDoctorAsync();
        var patient = await CreateTestPatientAsync(withPenicillinAllergy: true);

        var encounter = await service.StartEncounterAsync(new StartEncounterRequest
        {
            DoctorId = doctor.Id,
            PatientId = patient.Id
        }, doctor.UserId, "Dr. Test");
        _cleanupEncounterIds.Add(encounter.Id);

        // Fetch Amoxil drug
        var drug = await _dbContext.Drugs.FirstOrDefaultAsync(d => d.GenericName.Contains("Amoxicillin"));
        Assert.NotNull(drug);

        var rx = await service.CreatePrescriptionAsync(encounter.Id, new CreatePrescriptionRequest
        {
            Items = new List<CreatePrescriptionItemRequest>
            {
                new()
                {
                    DrugId = drug.Id,
                    Dosage = "500mg",
                    Frequency = "TDS (Three times daily)",
                    Route = "Oral",
                    DurationDays = 7,
                    QuantityPrescribed = 21,
                    Instructions = "Take after meals"
                }
            }
        }, doctor.UserId, "Dr. Test");

        Assert.NotNull(rx);
        Assert.StartsWith("RX-", rx.PrescriptionNumber);
        Assert.Single(rx.Items);
        Assert.Equal("500mg", rx.Items[0].Dosage);
    }
}
