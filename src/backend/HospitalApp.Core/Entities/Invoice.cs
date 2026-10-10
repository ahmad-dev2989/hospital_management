using HospitalApp.Core.Enums;

namespace HospitalApp.Core.Entities;

public class Invoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid PatientId { get; set; }
    public Guid? EncounterId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public decimal Subtotal { get; set; } = 0m;
    public decimal Discount { get; set; } = 0m;
    public decimal Tax { get; set; } = 0m;
    public decimal Total { get; set; } = 0m;
    public decimal PaidAmount { get; set; } = 0m;
    public decimal Balance { get; set; } = 0m;
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Patient Patient { get; set; } = null!;
    public Encounter? Encounter { get; set; }
    public UserAccount CreatedByUser { get; set; } = null!;
    public ICollection<InvoiceLine> Lines { get; set; } = new List<InvoiceLine>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
