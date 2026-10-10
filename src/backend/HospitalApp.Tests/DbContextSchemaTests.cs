using HospitalApp.Core.Entities;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HospitalApp.Tests;

public class DbContextSchemaTests
{
    [Fact]
    public void ApplicationDbContext_ModelCreation_HasAllRegisteredEntities()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=hospital_schema_test")
            .Options;

        using var context = new ApplicationDbContext(options);
        var model = context.Model;

        Assert.NotNull(model.FindEntityType(typeof(UserAccount)));
        Assert.NotNull(model.FindEntityType(typeof(AuditEvent)));
        Assert.NotNull(model.FindEntityType(typeof(Department)));
        Assert.NotNull(model.FindEntityType(typeof(Doctor)));
        Assert.NotNull(model.FindEntityType(typeof(DoctorSchedule)));
        Assert.NotNull(model.FindEntityType(typeof(Patient)));
        Assert.NotNull(model.FindEntityType(typeof(PatientAllergy)));
        Assert.NotNull(model.FindEntityType(typeof(PatientCondition)));
        Assert.NotNull(model.FindEntityType(typeof(Appointment)));
        Assert.NotNull(model.FindEntityType(typeof(Encounter)));
        Assert.NotNull(model.FindEntityType(typeof(ClinicalNote)));
        Assert.NotNull(model.FindEntityType(typeof(VitalSign)));
        Assert.NotNull(model.FindEntityType(typeof(Diagnosis)));
        Assert.NotNull(model.FindEntityType(typeof(LabTest)));
        Assert.NotNull(model.FindEntityType(typeof(LabOrder)));
        Assert.NotNull(model.FindEntityType(typeof(LabOrderItem)));
        Assert.NotNull(model.FindEntityType(typeof(Drug)));
        Assert.NotNull(model.FindEntityType(typeof(InventoryBatch)));
        Assert.NotNull(model.FindEntityType(typeof(Prescription)));
        Assert.NotNull(model.FindEntityType(typeof(PrescriptionItem)));
        Assert.NotNull(model.FindEntityType(typeof(DispenseRecord)));
        Assert.NotNull(model.FindEntityType(typeof(DispenseItem)));
        Assert.NotNull(model.FindEntityType(typeof(StockMovement)));
        Assert.NotNull(model.FindEntityType(typeof(ServiceItem)));
        Assert.NotNull(model.FindEntityType(typeof(Invoice)));
        Assert.NotNull(model.FindEntityType(typeof(InvoiceLine)));
        Assert.NotNull(model.FindEntityType(typeof(Payment)));
        Assert.NotNull(model.FindEntityType(typeof(Refund)));
        Assert.NotNull(model.FindEntityType(typeof(DocumentMetadata)));
        Assert.NotNull(model.FindEntityType(typeof(SystemSetting)));
    }

    [Fact]
    public void ApplicationDbContext_SystemSetting_PrimaryKeyIsKeyString()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=hospital_schema_test")
            .Options;

        using var context = new ApplicationDbContext(options);
        var entityType = context.Model.FindEntityType(typeof(SystemSetting));
        
        Assert.NotNull(entityType);
        var pk = entityType.FindPrimaryKey();
        Assert.NotNull(pk);
        Assert.Equal("Key", pk.Properties.Single().Name);
    }
}
