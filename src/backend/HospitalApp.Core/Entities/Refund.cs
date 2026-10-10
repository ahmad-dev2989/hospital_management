namespace HospitalApp.Core.Entities;

public class Refund
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PaymentId { get; set; }
    public Guid AuthorizedByUserId { get; set; }
    public decimal Amount { get; set; } = 0m;
    public string Reason { get; set; } = string.Empty;
    public DateTime RefundedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Payment Payment { get; set; } = null!;
    public UserAccount AuthorizedByUser { get; set; } = null!;
}
