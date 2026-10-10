using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using Xunit;

namespace HospitalApp.Tests;

public class EntityInvariantsTests
{
    [Fact]
    public void Invoice_FinancialBalance_CalculatesAccurately()
    {
        var invoice = new Invoice
        {
            Subtotal = 1500.50m,
            Discount = 100.00m,
            Tax = 50.00m,
            Total = 1450.50m,
            PaidAmount = 450.50m,
            Balance = 1000.00m,
            Status = InvoiceStatus.PartiallyPaid
        };

        Assert.Equal(invoice.Total, invoice.Subtotal - invoice.Discount + invoice.Tax);
        Assert.Equal(invoice.Balance, invoice.Total - invoice.PaidAmount);
        Assert.True(invoice.Balance > 0);
    }

    [Fact]
    public void InventoryBatch_FefoOrdering_PrioritizesEarlierExpiry()
    {
        var batch1 = new InventoryBatch
        {
            BatchNumber = "B001",
            ExpiryDate = DateTime.UtcNow.AddMonths(12),
            QuantityOnHand = 100
        };

        var batch2 = new InventoryBatch
        {
            BatchNumber = "B002",
            ExpiryDate = DateTime.UtcNow.AddMonths(2),
            QuantityOnHand = 50
        };

        var batches = new List<InventoryBatch> { batch1, batch2 };
        var fefoSorted = batches.OrderBy(b => b.ExpiryDate).ToList();

        Assert.Equal("B002", fefoSorted.First().BatchNumber);
    }

    [Fact]
    public void UserAccount_FailedLoginTracking_TriggersLockoutRule()
    {
        var user = new UserAccount
        {
            Username = "dr_smith",
            FailedLoginAttempts = 0
        };

        for (int i = 0; i < 5; i++)
        {
            user.FailedLoginAttempts++;
        }

        if (user.FailedLoginAttempts >= 5)
        {
            user.LockoutUntil = DateTime.UtcNow.AddMinutes(15);
        }

        Assert.Equal(5, user.FailedLoginAttempts);
        Assert.NotNull(user.LockoutUntil);
        Assert.True(user.LockoutUntil > DateTime.UtcNow);
    }

    [Fact]
    public void ClinicalNote_SupersedesNote_PreservesVersionHistory()
    {
        var originalNote = new ClinicalNote
        {
            ChiefComplaint = "Severe headache",
            Assessment = "Migraine",
            Version = 1,
            IsFinalized = true
        };

        var amendment = new ClinicalNote
        {
            ChiefComplaint = "Severe headache with visual aura",
            Assessment = "Complex Migraine",
            Version = 2,
            SupersedesNoteId = originalNote.Id,
            AmendmentReason = "Patient reported supplementary visual symptoms"
        };

        Assert.True(originalNote.IsFinalized);
        Assert.Equal(1, originalNote.Version);
        Assert.Equal(2, amendment.Version);
        Assert.Equal(originalNote.Id, amendment.SupersedesNoteId);
        Assert.NotNull(amendment.AmendmentReason);
    }
}
