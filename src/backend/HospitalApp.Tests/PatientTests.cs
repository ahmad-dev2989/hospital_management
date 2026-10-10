using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HospitalApp.Tests;

public class PatientTests : IDisposable
{
    private readonly ApplicationDbContext _dbContext;
    private readonly List<Guid> _cleanupPatientIds = new();

    public PatientTests()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres")
            .Options;

        _dbContext = new ApplicationDbContext(options);
    }

    public void Dispose()
    {
        if (_cleanupPatientIds.Count > 0)
        {
            var testPatients = _dbContext.Patients
                .Include(p => p.Allergies)
                .Include(p => p.Conditions)
                .Where(p => _cleanupPatientIds.Contains(p.Id))
                .ToList();

            _dbContext.Patients.RemoveRange(testPatients);
            _dbContext.SaveChanges();
        }

        _dbContext.Dispose();
    }

    [Fact]
    public async Task PatientNumberGenerator_GeneratesFormattedSequentialNumbers()
    {
        var generator = new PatientNumberGenerator(_dbContext, NullLogger<PatientNumberGenerator>.Instance);

        var nextNumber = await generator.GenerateNextPatientNumberAsync();
        var currentYear = DateTime.UtcNow.Year;
        
        Assert.StartsWith($"HSP-{currentYear}-", nextNumber);
        Assert.Matches(@"^HSP-\d{4}-\d{5}$", nextNumber);
    }

    [Fact]
    public async Task DuplicateDetection_IdentifiesIdenticalPhoneAndNameMatches()
    {
        var generator = new PatientNumberGenerator(_dbContext, NullLogger<PatientNumberGenerator>.Instance);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var patientService = new PatientService(_dbContext, generator, audit, NullLogger<PatientService>.Instance);

        var uniqueSuffix = Guid.NewGuid().ToString().Substring(0, 6);
        var phone = $"+1-555-{uniqueSuffix}";
        var existingDob = new DateTime(1990, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        var p = await patientService.CreatePatientAsync(
            new CreatePatientRequest("John" + uniqueSuffix, "Doe" + uniqueSuffix, existingDob, "Male", "O+", phone, null, null, null, null),
            null, "Admin", "127.0.0.1"
        );
        _cleanupPatientIds.Add(p.Id);

        // 1. Same phone match
        var dupPhoneReq = new CreatePatientRequest("Johnny", "Smith", new DateTime(1985, 3, 1, 0, 0, 0, DateTimeKind.Utc), "Male", null, phone, null, null, null, null);
        var res1 = await patientService.CheckDuplicatesAsync(dupPhoneReq);
        Assert.True(res1.HasPotentialDuplicates);
        Assert.Contains(res1.Matches, m => m.ConfidenceScore == "High");

        // 2. Same Name and DOB match
        var dupNameDobReq = new CreatePatientRequest("John" + uniqueSuffix, "Doe" + uniqueSuffix, existingDob, "Male", null, "+1-555-0000", null, null, null, null);
        var res2 = await patientService.CheckDuplicatesAsync(dupNameDobReq);
        Assert.True(res2.HasPotentialDuplicates);
        Assert.Contains(res2.Matches, m => m.MatchReason.Contains("Exact match on full name and date of birth"));
    }

    [Fact]
    public async Task CreatePatient_RejectsFutureDateOfBirth()
    {
        var generator = new PatientNumberGenerator(_dbContext, NullLogger<PatientNumberGenerator>.Instance);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var patientService = new PatientService(_dbContext, generator, audit, NullLogger<PatientService>.Instance);

        var futureReq = new CreatePatientRequest("Baby", "Future", DateTime.UtcNow.AddDays(5), "Female", null, "+1-555-0000", null, null, null, null);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            patientService.CreatePatientAsync(futureReq, null, "Test", "127.0.0.1")
        );

        Assert.Contains("future", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AllergyManagement_FlagsHighRiskWhenLifeThreateningOrSevere()
    {
        var generator = new PatientNumberGenerator(_dbContext, NullLogger<PatientNumberGenerator>.Instance);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var patientService = new PatientService(_dbContext, generator, audit, NullLogger<PatientService>.Instance);

        var uniqueSuffix = Guid.NewGuid().ToString().Substring(0, 6);
        var p = await patientService.CreatePatientAsync(
            new CreatePatientRequest("James" + uniqueSuffix, "Kirk", new DateTime(1975, 3, 22, 0, 0, 0, DateTimeKind.Utc), "Male", "B+", $"+1-555-{uniqueSuffix}", null, null, null, null),
            null, "Admin", "127.0.0.1"
        );
        _cleanupPatientIds.Add(p.Id);

        // Add mild allergy
        await patientService.AddAllergyAsync(p.Id, new AddAllergyRequest("Strawberries", "Mild rash", AllergySeverity.Mild), null, "Admin", "127.0.0.1");
        var chart1 = await patientService.GetPatientChartAsync(p.Id);
        Assert.False(chart1!.Demographics.HasHighRiskAllergy);

        // Add severe/life-threatening allergy
        await patientService.AddAllergyAsync(p.Id, new AddAllergyRequest("Peanuts", "Anaphylaxis", AllergySeverity.LifeThreatening), null, "Admin", "127.0.0.1");
        var chart2 = await patientService.GetPatientChartAsync(p.Id);
        Assert.True(chart2!.Demographics.HasHighRiskAllergy);
        Assert.Equal(2, chart2.Allergies.Count);
    }

    [Fact]
    public async Task ToggleStatus_PerformsSoftDeactivationWithoutDataLoss()
    {
        var generator = new PatientNumberGenerator(_dbContext, NullLogger<PatientNumberGenerator>.Instance);
        var audit = new AuditService(_dbContext, NullLogger<AuditService>.Instance);
        var patientService = new PatientService(_dbContext, generator, audit, NullLogger<PatientService>.Instance);

        var uniqueSuffix = Guid.NewGuid().ToString().Substring(0, 6);
        var p = await patientService.CreatePatientAsync(
            new CreatePatientRequest("Luke" + uniqueSuffix, "Skywalker", new DateTime(1980, 5, 25, 0, 0, 0, DateTimeKind.Utc), "Male", "AB+", $"+1-555-{uniqueSuffix}", null, null, null, null),
            null, "Admin", "127.0.0.1"
        );
        _cleanupPatientIds.Add(p.Id);

        Assert.True(p.IsActive);

        // Soft deactivation
        var statusAfterToggle = await patientService.TogglePatientStatusAsync(p.Id, null, "Admin", "127.0.0.1");
        Assert.False(statusAfterToggle);

        var refreshed = await patientService.GetPatientByIdAsync(p.Id);
        Assert.NotNull(refreshed);
        Assert.False(refreshed.IsActive);
    }
}
