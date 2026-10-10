using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ReceiptNumber { get; set; } = string.Empty;
    public Guid InvoiceId { get; set; }
    public Guid CashierUserId { get; set; }
    public decimal Amount { get; set; } = 0m;
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public string? ProviderReference { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Invoice Invoice { get; set; } = null!;
    public UserAccount CashierUser { get; set; } = null!;
    public ICollection<Refund> Refunds { get; set; } = new List<Refund>();
}
