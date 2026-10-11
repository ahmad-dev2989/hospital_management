using HospitalApp.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace HospitalApp.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Doctor> Doctors => Set<Doctor>();
    public DbSet<DoctorSchedule> DoctorSchedules => Set<DoctorSchedule>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<PatientAllergy> PatientAllergies => Set<PatientAllergy>();
    public DbSet<PatientCondition> PatientConditions => Set<PatientCondition>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<Encounter> Encounters => Set<Encounter>();
    public DbSet<ClinicalNote> ClinicalNotes => Set<ClinicalNote>();
    public DbSet<VitalSign> VitalSigns => Set<VitalSign>();
    public DbSet<Diagnosis> Diagnoses => Set<Diagnosis>();
    public DbSet<LabTest> LabTests => Set<LabTest>();
    public DbSet<LabOrder> LabOrders => Set<LabOrder>();
    public DbSet<LabOrderItem> LabOrderItems => Set<LabOrderItem>();
    public DbSet<Drug> Drugs => Set<Drug>();
    public DbSet<InventoryBatch> InventoryBatches => Set<InventoryBatch>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>();
    public DbSet<PrescriptionItem> PrescriptionItem => PrescriptionItems;
    public DbSet<DispenseRecord> DispenseRecords => Set<DispenseRecord>();
    public DbSet<DispenseItem> DispenseItems => Set<DispenseItem>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<ServiceItem> ServiceItems => Set<ServiceItem>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Refund> Refunds => Set<Refund>();
    public DbSet<DocumentMetadata> Documents => Set<DocumentMetadata>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // DocumentMetadata maps to DocumentMetadatas table from migration
        modelBuilder.Entity<DocumentMetadata>()
            .ToTable("DocumentMetadatas");

        // SystemSettings has Key as PK
        modelBuilder.Entity<SystemSetting>()
            .HasKey(s => s.Key);

        // UserAccount
        modelBuilder.Entity<UserAccount>()
            .HasIndex(u => u.Username)
            .IsUnique();
        modelBuilder.Entity<UserAccount>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // Doctor
        modelBuilder.Entity<Doctor>()
            .HasIndex(d => d.UserId)
            .IsUnique();

        modelBuilder.Entity<Doctor>()
            .HasOne(d => d.User)
            .WithOne(u => u.DoctorProfile)
            .HasForeignKey<Doctor>(d => d.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Doctor>()
            .HasOne(d => d.Department)
            .WithMany(dept => dept.Doctors)
            .HasForeignKey(d => d.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Department
        modelBuilder.Entity<Department>()
            .HasIndex(d => d.Code);

        // Patient
        modelBuilder.Entity<Patient>()
            .HasIndex(p => p.PatientNumber)
            .IsUnique();
        modelBuilder.Entity<Patient>()
            .HasIndex(p => p.Phone);

        // Appointment
        modelBuilder.Entity<Appointment>()
            .HasIndex(a => a.AppointmentNumber)
            .IsUnique();

        // Encounter
        modelBuilder.Entity<Encounter>()
            .HasIndex(e => e.AppointmentId)
            .IsUnique();

        modelBuilder.Entity<Encounter>()
            .HasOne(e => e.Doctor)
            .WithMany(d => d.Encounters)
            .HasForeignKey(e => e.DoctorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Encounter>()
            .HasOne(e => e.SignedByDoctor)
            .WithMany()
            .HasForeignKey(e => e.SignedByDoctorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Encounter>()
            .HasOne(e => e.Patient)
            .WithMany(p => p.Encounters)
            .HasForeignKey(e => e.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        // ClinicalNote self-referencing
        modelBuilder.Entity<ClinicalNote>()
            .HasOne(c => c.SupersedesNote)
            .WithMany()
            .HasForeignKey(c => c.SupersedesNoteId)
            .OnDelete(DeleteBehavior.Restrict);

        // LabOrder
        modelBuilder.Entity<LabOrder>()
            .HasIndex(o => o.OrderNumber)
            .IsUnique();

        modelBuilder.Entity<LabOrder>()
            .HasOne(l => l.OrderedByDoctor)
            .WithMany()
            .HasForeignKey(l => l.OrderedByDoctorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LabOrder>()
            .HasOne(l => l.Patient)
            .WithMany()
            .HasForeignKey(l => l.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        // LabTest
        modelBuilder.Entity<LabTest>()
            .HasIndex(t => t.Code)
            .IsUnique();

        // LabOrderItem
        modelBuilder.Entity<LabOrderItem>()
            .HasIndex(i => i.SpecimenBarcode);

        // Drug
        modelBuilder.Entity<Drug>()
            .HasIndex(d => d.Code)
            .IsUnique();

        // InventoryBatch
        modelBuilder.Entity<InventoryBatch>()
            .HasIndex(b => new { b.DrugId, b.BatchNumber })
            .IsUnique();

        // Prescription
        modelBuilder.Entity<Prescription>()
            .HasOne(p => p.Doctor)
            .WithMany()
            .HasForeignKey(p => p.DoctorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Prescription>()
            .HasOne(p => p.Patient)
            .WithMany()
            .HasForeignKey(p => p.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        // PrescriptionItem
        modelBuilder.Entity<PrescriptionItem>()
            .ToTable("PrescriptionItems")
            .HasOne(pi => pi.Drug)
            .WithMany()
            .HasForeignKey(pi => pi.DrugId)
            .OnDelete(DeleteBehavior.Cascade);

        // VitalSign
        modelBuilder.Entity<VitalSign>()
            .HasOne(v => v.Patient)
            .WithMany()
            .HasForeignKey(v => v.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        // Diagnosis
        modelBuilder.Entity<Diagnosis>()
            .HasOne(d => d.Patient)
            .WithMany()
            .HasForeignKey(d => d.PatientId)
            .OnDelete(DeleteBehavior.Cascade);

        // Invoice
        modelBuilder.Entity<Invoice>()
            .HasIndex(i => i.InvoiceNumber)
            .IsUnique();

        // Payment
        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.ReceiptNumber)
            .IsUnique();

        // ServiceItem
        modelBuilder.Entity<ServiceItem>()
            .HasIndex(s => s.Code)
            .IsUnique();

        // Decimal configurations
        modelBuilder.Entity<Doctor>()
            .Property(d => d.ConsultationFee)
            .HasPrecision(18, 2);

        modelBuilder.Entity<LabTest>()
            .Property(t => t.Price)
            .HasPrecision(18, 2);

        modelBuilder.Entity<InventoryBatch>()
            .Property(b => b.UnitCost)
            .HasPrecision(18, 2);
        modelBuilder.Entity<InventoryBatch>()
            .Property(b => b.SellingPrice)
            .HasPrecision(18, 2);

        modelBuilder.Entity<DispenseItem>()
            .Property(d => d.UnitPriceSnapshot)
            .HasPrecision(18, 2);

        modelBuilder.Entity<ServiceItem>()
            .Property(s => s.DefaultPrice)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Invoice>()
            .Property(i => i.Subtotal)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>()
            .Property(i => i.Discount)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>()
            .Property(i => i.Tax)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>()
            .Property(i => i.Total)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>()
            .Property(i => i.PaidAmount)
            .HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>()
            .Property(i => i.Balance)
            .HasPrecision(18, 2);

        modelBuilder.Entity<InvoiceLine>()
            .Property(l => l.UnitPriceSnapshot)
            .HasPrecision(18, 2);
        modelBuilder.Entity<InvoiceLine>()
            .Property(l => l.TotalPrice)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Payment>()
            .Property(p => p.Amount)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Refund>()
            .Property(r => r.Amount)
            .HasPrecision(18, 2);
    }
}
