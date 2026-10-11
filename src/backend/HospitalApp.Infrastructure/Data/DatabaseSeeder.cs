using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(ApplicationDbContext context, ILogger logger)
    {
        try
        {
            // 1. Ensure migrations are applied
            await context.Database.MigrateAsync();

            // 2. Seed Master Administrator Account (Admin is the primary master user)
            var adminUser = await context.UserAccounts.FirstOrDefaultAsync(u => u.Username.ToLower() == "admin");
            if (adminUser == null)
            {
                logger.LogInformation("Seeding master administrator account: admin");
                adminUser = new UserAccount
                {
                    Id = Guid.NewGuid(),
                    Username = "admin",
                    Email = "admin@hospital.local",
                    FullName = "System Administrator",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123", workFactor: 11),
                    Role = UserRole.SystemAdministrator,
                    IsActive = true,
                    FailedLoginAttempts = 0,
                    LockoutUntil = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.UserAccounts.Add(adminUser);
            }
            else
            {
                adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123", workFactor: 11);
                adminUser.IsActive = true;
                adminUser.Role = UserRole.SystemAdministrator;
                adminUser.FailedLoginAttempts = 0;
                adminUser.LockoutUntil = null;
                adminUser.UpdatedAt = DateTime.UtcNow;
            }
            await context.SaveChangesAsync();

            // 3. Seed Default Departments if empty
            if (!await context.Departments.AnyAsync())
            {
                logger.LogInformation("Seeding standard hospital departments...");
                var departments = new List<Department>
                {
                    new() { Code = "GEN", Name = "General Medicine", IsActive = true },
                    new() { Code = "PED", Name = "Pediatrics", IsActive = true },
                    new() { Code = "CARD", Name = "Cardiology", IsActive = true },
                    new() { Code = "ORTH", Name = "Orthopedics", IsActive = true },
                    new() { Code = "EMERG", Name = "Emergency & Triage", IsActive = true },
                    new() { Code = "LAB", Name = "Diagnostic Laboratory", IsActive = true },
                    new() { Code = "PHARM", Name = "Hospital Pharmacy", IsActive = true }
                };

                context.Departments.AddRange(departments);
                await context.SaveChangesAsync();
            }

            // 4. Seed Standard Service Catalog if empty
            if (!await context.ServiceItems.AnyAsync())
            {
                logger.LogInformation("Seeding baseline service catalog...");
                var services = new List<ServiceItem>
                {
                    new() { Code = "CONS-GEN", Name = "General Consultation", Category = "Consultation", DefaultPrice = 50.00m },
                    new() { Code = "CONS-SPEC", Name = "Specialist Consultation", Category = "Consultation", DefaultPrice = 100.00m },
                    new() { Code = "PROC-ECG", Name = "Electrocardiogram (ECG)", Category = "Procedure", DefaultPrice = 45.00m },
                    new() { Code = "PROC-WOUND", Name = "Wound Dressing & Suturing", Category = "Nursing", DefaultPrice = 30.00m },
                    new() { Code = "EMERG-TRI", Name = "Emergency Triage Assessment", Category = "Emergency", DefaultPrice = 75.00m }
                };

                context.ServiceItems.AddRange(services);
                await context.SaveChangesAsync();
            }

            // 5. Seed Standard Lab Tests if empty
            if (!await context.LabTests.AnyAsync())
            {
                logger.LogInformation("Seeding standard diagnostic lab tests...");
                var labTests = new List<LabTest>
                {
                    new() { Code = "CBC", Name = "Complete Blood Count", Category = "Hematology", SpecimenType = "Whole Blood (EDTA)", Price = 25.00m, UnitOfMeasure = "Various", ReferenceRange = "Standard Hematology Panel" },
                    new() { Code = "FBS", Name = "Fasting Blood Sugar", Category = "Biochemistry", SpecimenType = "Fluoride Oxalate Plasma", Price = 15.00m, UnitOfMeasure = "mg/dL", ReferenceRange = "70 - 99 mg/dL" },
                    new() { Code = "LIPID", Name = "Lipid Profile Panel", Category = "Biochemistry", SpecimenType = "Serum", Price = 40.00m, UnitOfMeasure = "mg/dL", ReferenceRange = "Cholesterol < 200, TG < 150" },
                    new() { Code = "LFT", Name = "Liver Function Tests", Category = "Biochemistry", SpecimenType = "Serum", Price = 35.00m, UnitOfMeasure = "U/L", ReferenceRange = "ALT 7-56, AST 10-40" },
                    new() { Code = "RFT", Name = "Renal Function Tests (BUN/Cr)", Category = "Biochemistry", SpecimenType = "Serum", Price = 30.00m, UnitOfMeasure = "mg/dL", ReferenceRange = "Creatinine 0.6 - 1.2 mg/dL" },
                    new() { Code = "UA", Name = "Urinalysis Routine & Microscopic", Category = "Microbiology", SpecimenType = "Clean Catch Urine", Price = 12.00m, UnitOfMeasure = "Routine", ReferenceRange = "Clear, Protein Neg, Gluc Neg" }
                };

                context.LabTests.AddRange(labTests);
                await context.SaveChangesAsync();
            }

            // 6. Seed Baseline Formulary if empty
            if (!await context.Drugs.AnyAsync())
            {
                logger.LogInformation("Seeding baseline essential drug catalog...");
                var drugs = new List<Drug>
                {
                    new() { Code = "MED-AMOX-500", BrandName = "Amoxil", GenericName = "Amoxicillin", DosageForm = "Capsule", Strength = "500mg", ReorderLevel = 50 },
                    new() { Code = "MED-PARA-500", BrandName = "Panadol", GenericName = "Paracetamol", DosageForm = "Tablet", Strength = "500mg", ReorderLevel = 100 },
                    new() { Code = "MED-IBU-400", BrandName = "Brufen", GenericName = "Ibuprofen", DosageForm = "Tablet", Strength = "400mg", ReorderLevel = 60 },
                    new() { Code = "MED-OMEP-20", BrandName = "Losec", GenericName = "Omeprazole", DosageForm = "Capsule", Strength = "20mg", ReorderLevel = 40 },
                    new() { Code = "MED-METF-500", BrandName = "Glucophage", GenericName = "Metformin HCl", DosageForm = "Tablet", Strength = "500mg", ReorderLevel = 80 },
                    new() { Code = "MED-ATRO-10", BrandName = "Lipitor", GenericName = "Atorvastatin", DosageForm = "Tablet", Strength = "10mg", ReorderLevel = 40 }
                };

                context.Drugs.AddRange(drugs);
                await context.SaveChangesAsync();
            }

            // 7. Seed System Settings if empty
            if (!await context.SystemSettings.AnyAsync())
            {
                logger.LogInformation("Seeding initial hospital configuration settings...");
                var settings = new List<SystemSetting>
                {
                    new() { Key = "HospitalName", Value = "Mercy Community Hospital", Description = "Registered hospital name displayed on reports and receipts", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "HospitalAddress", Value = "100 Healthcare Blvd, Medical District", Description = "Hospital street address and contact info", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "HospitalPhone", Value = "+1-555-0199", Description = "Main hospital contact phone", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "CurrencySymbol", Value = "$", Description = "Active financial currency symbol", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "DefaultSlotDurationMinutes", Value = "15", Description = "Standard appointment booking slot interval in minutes", UpdatedAt = DateTime.UtcNow },
                    new() { Key = "PatientIdPrefix", Value = "HSP", Description = "Prefix for human-readable unique patient identifiers", UpdatedAt = DateTime.UtcNow }
                };

                context.SystemSettings.AddRange(settings);
                await context.SaveChangesAsync();
            }

            // 8. Seed Baseline Clinical Patients if empty
            if (!await context.Patients.AnyAsync())
            {
                logger.LogInformation("Seeding baseline clinical patient records...");
                var p1 = new Patient
                {
                    Id = Guid.NewGuid(),
                    PatientNumber = "HSP-2026-00001",
                    FirstName = "Eleanor",
                    LastName = "Vance",
                    DateOfBirth = DateTime.SpecifyKind(new DateTime(1964, 5, 12), DateTimeKind.Utc),
                    Gender = "Female",
                    BloodGroup = "O+",
                    Phone = "+1-555-0142",
                    Email = "eleanor.vance@example.local",
                    Address = "742 Evergreen Terrace, Springfield",
                    EmergencyContactName = "Thomas Vance (Spouse)",
                    EmergencyContactPhone = "+1-555-0143",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var p2 = new Patient
                {
                    Id = Guid.NewGuid(),
                    PatientNumber = "HSP-2026-00002",
                    FirstName = "Arthur",
                    LastName = "Pendelton",
                    DateOfBirth = DateTime.SpecifyKind(new DateTime(1982, 11, 23), DateTimeKind.Utc),
                    Gender = "Male",
                    BloodGroup = "A+",
                    Phone = "+1-555-0188",
                    Email = "arthur.p@example.local",
                    Address = "1204 Oak Ridge Dr, Springfield",
                    EmergencyContactName = "Clara Pendelton (Sister)",
                    EmergencyContactPhone = "+1-555-0189",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var p3 = new Patient
                {
                    Id = Guid.NewGuid(),
                    PatientNumber = "HSP-2026-00003",
                    FirstName = "Maya",
                    LastName = "Lin",
                    DateOfBirth = DateTime.SpecifyKind(new DateTime(1995, 3, 8), DateTimeKind.Utc),
                    Gender = "Female",
                    BloodGroup = "B-",
                    Phone = "+1-555-0177",
                    Email = "maya.lin@example.local",
                    Address = "45 Elm Street, Apt 3B, Springfield",
                    EmergencyContactName = "David Lin (Father)",
                    EmergencyContactPhone = "+1-555-0178",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                context.Patients.AddRange(p1, p2, p3);
                await context.SaveChangesAsync();

                var allergies = new List<PatientAllergy>
                {
                    new()
                    {
                        Id = Guid.NewGuid(),
                        PatientId = p1.Id,
                        Allergen = "Penicillin",
                        Reaction = "Anaphylaxis, severe hives and bronchospasm",
                        Severity = AllergySeverity.LifeThreatening,
                        RecordedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        PatientId = p1.Id,
                        Allergen = "Aspirin",
                        Reaction = "Gastric distress, mild rash",
                        Severity = AllergySeverity.Moderate,
                        RecordedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        PatientId = p2.Id,
                        Allergen = "Sulfa Drugs",
                        Reaction = "Skin peeling, erythema",
                        Severity = AllergySeverity.Severe,
                        RecordedAt = DateTime.UtcNow
                    }
                };

                context.PatientAllergies.AddRange(allergies);

                var conditions = new List<PatientCondition>
                {
                    new()
                    {
                        Id = Guid.NewGuid(),
                        PatientId = p1.Id,
                        ConditionName = "Essential Hypertension",
                        Status = "Active",
                        DiagnosedDate = DateTime.SpecifyKind(new DateTime(2018, 4, 15), DateTimeKind.Utc)
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        PatientId = p1.Id,
                        ConditionName = "Type 2 Diabetes Mellitus",
                        Status = "Active",
                        DiagnosedDate = DateTime.SpecifyKind(new DateTime(2020, 9, 21), DateTimeKind.Utc)
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        PatientId = p2.Id,
                        ConditionName = "Asthma (Moderate Persistent)",
                        Status = "Active",
                        DiagnosedDate = DateTime.SpecifyKind(new DateTime(2015, 6, 10), DateTimeKind.Utc)
                    }
                };

                context.PatientConditions.AddRange(conditions);
                await context.SaveChangesAsync();
                logger.LogInformation("Seeded baseline patients, allergies, and chronic conditions.");
            }

            // 9. Ensure Chief Medical Administrator Doctor Profile & Schedules
            var genDept = await context.Departments.FirstOrDefaultAsync(d => d.Code == "GEN") 
                ?? await context.Departments.FirstAsync();

            var adminDoctor = await context.Doctors
                .Include(d => d.Schedules)
                .FirstOrDefaultAsync(d => d.UserId == adminUser.Id);

            if (adminDoctor == null)
            {
                logger.LogInformation("Creating Master Doctor profile for Administrator (Chief Medical Officer)...");
                adminDoctor = new Doctor
                {
                    Id = Guid.NewGuid(),
                    UserId = adminUser.Id,
                    DepartmentId = genDept.Id,
                    LicenseNumber = "MD-ADM-2026-001",
                    Specialization = "Chief Medical Officer & General Physician",
                    ConsultationFee = 50.00m,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.Doctors.Add(adminDoctor);
                await context.SaveChangesAsync();

                // Add Monday through Sunday schedule (0 through 6)
                for (int day = 0; day <= 6; day++)
                {
                    context.DoctorSchedules.Add(new DoctorSchedule
                    {
                        Id = Guid.NewGuid(),
                        DoctorId = adminDoctor.Id,
                        DayOfWeek = day,
                        StartTime = TimeSpan.FromHours(8),
                        EndTime = TimeSpan.FromHours(18),
                        SlotDurationMinutes = 15,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                await context.SaveChangesAsync();
            }

            // Re-assign any appointments or encounters pointing to legacy doctors to Admin
            var legacyDoctors = await context.Doctors
                .Where(d => d.Id != adminDoctor.Id)
                .ToListAsync();

            if (legacyDoctors.Any())
            {
                var legacyDoctorIds = legacyDoctors.Select(d => d.Id).ToList();

                var apptsToMigrate = await context.Appointments
                    .Where(a => legacyDoctorIds.Contains(a.DoctorId))
                    .ToListAsync();
                foreach (var a in apptsToMigrate)
                {
                    a.DoctorId = adminDoctor.Id;
                    a.DepartmentId = adminDoctor.DepartmentId;
                }

                var encsToMigrate = await context.Encounters
                    .Where(e => legacyDoctorIds.Contains(e.DoctorId) || (e.SignedByDoctorId.HasValue && legacyDoctorIds.Contains(e.SignedByDoctorId.Value)))
                    .ToListAsync();
                foreach (var e in encsToMigrate)
                {
                    if (legacyDoctorIds.Contains(e.DoctorId)) e.DoctorId = adminDoctor.Id;
                    if (e.SignedByDoctorId.HasValue && legacyDoctorIds.Contains(e.SignedByDoctorId.Value)) e.SignedByDoctorId = adminDoctor.Id;
                }

                var legacySchedules = await context.DoctorSchedules
                    .Where(s => legacyDoctorIds.Contains(s.DoctorId))
                    .ToListAsync();
                context.DoctorSchedules.RemoveRange(legacySchedules);
                context.Doctors.RemoveRange(legacyDoctors);
                await context.SaveChangesAsync();
            }

            // Remove legacy non-admin staff accounts (Only admin is the primary user)
            var nonAdminUsers = await context.UserAccounts
                .Where(u => u.Id != adminUser.Id && u.Username.ToLower() != "admin")
                .ToListAsync();

            if (nonAdminUsers.Any())
            {
                logger.LogInformation("Purging {Count} legacy non-admin accounts. Re-linking foreign keys to Admin...", nonAdminUsers.Count);
                var nonAdminIds = nonAdminUsers.Select(u => u.Id).ToList();

                // 1. AuditEvents
                var auditToMigrate = await context.AuditEvents
                    .Where(a => a.ActorUserId.HasValue && nonAdminIds.Contains(a.ActorUserId.Value))
                    .ToListAsync();
                foreach (var a in auditToMigrate) a.ActorUserId = adminUser.Id;

                // 2. VitalSigns
                var vitalsToMigrate = await context.VitalSigns
                    .Where(v => nonAdminIds.Contains(v.RecordedByUserId))
                    .ToListAsync();
                foreach (var v in vitalsToMigrate) v.RecordedByUserId = adminUser.Id;

                // 3. StockMovements
                var stocksToMigrate = await context.StockMovements
                    .Where(s => nonAdminIds.Contains(s.PerformedByUserId))
                    .ToListAsync();
                foreach (var s in stocksToMigrate) s.PerformedByUserId = adminUser.Id;

                // 4. Refunds
                var refundsToMigrate = await context.Refunds
                    .Where(r => nonAdminIds.Contains(r.AuthorizedByUserId))
                    .ToListAsync();
                foreach (var r in refundsToMigrate) r.AuthorizedByUserId = adminUser.Id;

                // 5. Payments
                var paymentsToMigrate = await context.Payments
                    .Where(p => nonAdminIds.Contains(p.CashierUserId))
                    .ToListAsync();
                foreach (var p in paymentsToMigrate) p.CashierUserId = adminUser.Id;

                // 6. Invoices
                var invoicesToMigrate = await context.Invoices
                    .Where(i => nonAdminIds.Contains(i.CreatedByUserId))
                    .ToListAsync();
                foreach (var i in invoicesToMigrate) i.CreatedByUserId = adminUser.Id;

                // 7. LabOrderItems
                var labEnteredToMigrate = await context.LabOrderItems
                    .Where(l => l.EnteredByUserId.HasValue && nonAdminIds.Contains(l.EnteredByUserId.Value))
                    .ToListAsync();
                foreach (var l in labEnteredToMigrate) l.EnteredByUserId = adminUser.Id;

                var labVerifiedToMigrate = await context.LabOrderItems
                    .Where(l => l.VerifiedByUserId.HasValue && nonAdminIds.Contains(l.VerifiedByUserId.Value))
                    .ToListAsync();
                foreach (var l in labVerifiedToMigrate) l.VerifiedByUserId = adminUser.Id;

                // 8. DocumentMetadatas
                var docsToMigrate = await context.Documents
                    .Where(d => nonAdminIds.Contains(d.UploadedByUserId))
                    .ToListAsync();
                foreach (var d in docsToMigrate) d.UploadedByUserId = adminUser.Id;

                // 9. DispenseRecords
                var dispToMigrate = await context.DispenseRecords
                    .Where(d => nonAdminIds.Contains(d.PharmacistUserId))
                    .ToListAsync();
                foreach (var d in dispToMigrate) d.PharmacistUserId = adminUser.Id;

                await context.SaveChangesAsync();

                context.UserAccounts.RemoveRange(nonAdminUsers);
                await context.SaveChangesAsync();
                logger.LogInformation("Successfully purged all legacy non-admin accounts. Admin is now the sole user.");
            }

            // 10. Seed Baseline Appointments if empty
            if (!await context.Appointments.AnyAsync())
            {
                logger.LogInformation("Seeding baseline clinical appointments for today's clinic...");
                var p1 = await context.Patients.FirstOrDefaultAsync(p => p.PatientNumber == "HSP-2026-00001");
                var p2 = await context.Patients.FirstOrDefaultAsync(p => p.PatientNumber == "HSP-2026-00002");
                var p3 = await context.Patients.FirstOrDefaultAsync(p => p.PatientNumber == "HSP-2026-00003");

                if (p1 != null && p2 != null && p3 != null)
                {
                    var today = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);

                    var appts = new List<Appointment>
                    {
                        new()
                        {
                            Id = Guid.NewGuid(),
                            AppointmentNumber = "APT-2026-00001",
                            PatientId = p1.Id,
                            DoctorId = adminDoctor.Id,
                            DepartmentId = adminDoctor.DepartmentId,
                            StartsAt = today.AddHours(9).AddMinutes(15),
                            EndsAt = today.AddHours(9).AddMinutes(30),
                            Status = AppointmentStatus.Waiting,
                            Reason = "Hypertension blood pressure check-up and medication review",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        },
                        new()
                        {
                            Id = Guid.NewGuid(),
                            AppointmentNumber = "APT-2026-00002",
                            PatientId = p2.Id,
                            DoctorId = adminDoctor.Id,
                            DepartmentId = adminDoctor.DepartmentId,
                            StartsAt = today.AddHours(10),
                            EndsAt = today.AddHours(10).AddMinutes(15),
                            Status = AppointmentStatus.InConsultation,
                            Reason = "Persistent wheezing and seasonal asthma exacerbation",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        },
                        new()
                        {
                            Id = Guid.NewGuid(),
                            AppointmentNumber = "APT-2026-00003",
                            PatientId = p3.Id,
                            DoctorId = adminDoctor.Id,
                            DepartmentId = adminDoctor.DepartmentId,
                            StartsAt = today.AddHours(11).AddMinutes(30),
                            EndsAt = today.AddHours(11).AddMinutes(45),
                            Status = AppointmentStatus.Booked,
                            Reason = "Annual preventative general wellness check-up",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        }
                    };

                    context.Appointments.AddRange(appts);
                    await context.SaveChangesAsync();
                    logger.LogInformation("Seeded baseline clinic queue appointments.");
                }
            }

            // Seed Standard Hospital Chargemaster (Fee Schedule)
            if (!await context.ServiceItems.AnyAsync())
            {
                var services = new List<ServiceItem>
                {
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-CONS-GEN",
                        Name = "General Practitioner Consultation",
                        Category = "Consultation",
                        DefaultPrice = 35.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-CONS-SPEC",
                        Name = "Specialist Physician Consultation",
                        Category = "Consultation",
                        DefaultPrice = 65.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-CONS-EMER",
                        Name = "Emergency Triage & Evaluation",
                        Category = "Emergency",
                        DefaultPrice = 80.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-NURS-INJ",
                        Name = "Intramuscular / Subcutaneous Injection",
                        Category = "Nursing",
                        DefaultPrice = 15.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-NURS-IV",
                        Name = "Intravenous Cannulation & Fluid Setup",
                        Category = "Nursing",
                        DefaultPrice = 25.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-NURS-WND",
                        Name = "Sterile Wound Dressing & Bandaging",
                        Category = "Nursing",
                        DefaultPrice = 30.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-DIAG-ECG",
                        Name = "12-Lead Electrocardiogram (ECG)",
                        Category = "Diagnostics",
                        DefaultPrice = 45.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new()
                    {
                        Id = Guid.NewGuid(),
                        Code = "SRV-DIAG-NEB",
                        Name = "Nebulization Respiratory Therapy",
                        Category = "Therapy",
                        DefaultPrice = 20.00m,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    }
                };

                context.ServiceItems.AddRange(services);
                await context.SaveChangesAsync();
                logger.LogInformation("Seeded standard hospital chargemaster fee schedule.");
            }

            logger.LogInformation("Database seed checks successfully completed.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error occurred during database initialization and seeding.");
            throw;
        }
    }
}
