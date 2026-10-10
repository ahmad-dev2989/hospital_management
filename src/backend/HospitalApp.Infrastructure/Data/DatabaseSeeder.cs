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

            // 2. Seed Default Staff Accounts
            var initialUsers = new List<(string Username, string Email, string FullName, UserRole Role, string Password)>
            {
                ("admin", "admin@hospital.local", "System Administrator", UserRole.SystemAdministrator, "Admin@123"),
                ("dr.smith", "smith@hospital.local", "Dr. Marcus Smith, MD", UserRole.Doctor, "Doctor@123"),
                ("nurse.jane", "jane@hospital.local", "Jane Doe, RN", UserRole.Nurse, "Nurse@123"),
                ("reception", "reception@hospital.local", "Reception Desk", UserRole.Receptionist, "Reception@123"),
                ("labtech", "lab@hospital.local", "Lab Technician", UserRole.LabTechnician, "Lab@123"),
                ("pharmacist", "pharmacy@hospital.local", "Chief Pharmacist", UserRole.Pharmacist, "Pharmacy@123"),
                ("cashier", "cashier@hospital.local", "Cashier Shift A", UserRole.Cashier, "Cashier@123"),
                ("auditor", "auditor@hospital.local", "Clinical Compliance Auditor", UserRole.Auditor, "Auditor@123")
            };

            foreach (var (username, email, fullName, role, pwd) in initialUsers)
            {
                var existing = await context.UserAccounts.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (existing == null)
                {
                    logger.LogInformation("Seeding account: {Username} ({Role})", username, role);
                    context.UserAccounts.Add(new UserAccount
                    {
                        Id = Guid.NewGuid(),
                        Username = username,
                        Email = email,
                        FullName = fullName,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(pwd, workFactor: 11),
                        Role = role,
                        IsActive = true,
                        FailedLoginAttempts = 0,
                        LockoutUntil = null,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    existing.PasswordHash = BCrypt.Net.BCrypt.HashPassword(pwd, workFactor: 11);
                    existing.IsActive = true;
                    existing.FailedLoginAttempts = 0;
                    existing.LockoutUntil = null;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
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

            logger.LogInformation("Database seed checks successfully completed.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error occurred during database initialization and seeding.");
            throw;
        }
    }
}
