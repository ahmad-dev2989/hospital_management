using System.ComponentModel.DataAnnotations;
using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public class ServiceItemDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal DefaultPrice { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateServiceItemRequest
{
    [Required]
    [StringLength(32, MinimumLength = 2)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(128, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(64)]
    public string Category { get; set; } = "General";

    [Range(0, 1000000)]
    public decimal DefaultPrice { get; set; } = 0m;
}

public class UpdateServiceItemRequest
{
    [Required]
    [StringLength(128, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(64)]
    public string Category { get; set; } = "General";

    [Range(0, 1000000)]
    public decimal DefaultPrice { get; set; } = 0m;

    public bool IsActive { get; set; } = true;
}

public class InvoiceLineDto
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public string SourceId { get; set; } = string.Empty;
    public string ItemDescription { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPriceSnapshot { get; set; }
    public decimal TotalPrice { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateInvoiceLineRequest
{
    public string SourceType { get; set; } = "Service"; // Consultation, LabTest, Medication, Service, Other
    public string SourceId { get; set; } = string.Empty;

    [Required]
    [StringLength(256, MinimumLength = 2)]
    public string ItemDescription { get; set; } = string.Empty;

    [Range(1, 10000)]
    public int Quantity { get; set; } = 1;

    [Range(0, 1000000)]
    public decimal UnitPrice { get; set; } = 0m;
}

public class InvoiceDto
{
    public Guid Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public Guid? EncounterId { get; set; }
    public string? EncounterNumber { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string CreatedByUserName { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal Balance { get; set; }
    public InvoiceStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<InvoiceLineDto> Lines { get; set; } = new();
    public List<PaymentDto> Payments { get; set; } = new();
}

public class CreateInvoiceRequest
{
    [Required]
    public Guid PatientId { get; set; }

    public Guid? EncounterId { get; set; }

    [Range(0, 1000000)]
    public decimal Discount { get; set; } = 0m;

    [Range(0, 100)]
    public decimal TaxPercentage { get; set; } = 0m;

    [MinLength(1, ErrorMessage = "An invoice must contain at least one line item.")]
    public List<CreateInvoiceLineRequest> Lines { get; set; } = new();
}

public class GenerateEncounterInvoiceRequest
{
    [Range(0, 1000000)]
    public decimal Discount { get; set; } = 0m;

    [Range(0, 100)]
    public decimal TaxPercentage { get; set; } = 0m;
}

public class PaymentDto
{
    public Guid Id { get; set; }
    public string ReceiptNumber { get; set; } = string.Empty;
    public Guid InvoiceId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid CashierUserId { get; set; }
    public string CashierUserName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? ProviderReference { get; set; }
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTime ReceivedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<RefundDto> Refunds { get; set; } = new();
}

public class RecordPaymentRequest
{
    [Required]
    public Guid InvoiceId { get; set; }

    [Required]
    [Range(0.01, 1000000, ErrorMessage = "Payment amount must be greater than zero.")]
    public decimal Amount { get; set; }

    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;

    public string? ProviderReference { get; set; }

    [Required]
    [StringLength(128, MinimumLength = 5)]
    public string IdempotencyKey { get; set; } = string.Empty;
}

public class RefundDto
{
    public Guid Id { get; set; }
    public Guid PaymentId { get; set; }
    public Guid AuthorizedByUserId { get; set; }
    public string AuthorizedByUserName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime RefundedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ProcessRefundRequest
{
    [Required]
    [Range(0.01, 1000000, ErrorMessage = "Refund amount must be greater than zero.")]
    public decimal Amount { get; set; }

    [Required]
    [StringLength(256, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}

public class CashierShiftSummaryDto
{
    public DateTime ShiftDate { get; set; }
    public Guid? CashierUserId { get; set; }
    public string? CashierUserName { get; set; }
    public decimal TotalCollected { get; set; }
    public decimal TotalRefunded { get; set; }
    public decimal NetCollected { get; set; }
    public int TotalReceiptsCount { get; set; }
    public decimal CashTotal { get; set; }
    public decimal CreditCardTotal { get; set; }
    public decimal DebitCardTotal { get; set; }
    public decimal BankTransferTotal { get; set; }
    public decimal MobilePaymentTotal { get; set; }
    public decimal InsuranceCoPayTotal { get; set; }
    public List<PaymentDto> RecentPayments { get; set; } = new();
}

public class BillingDashboardMetricsDto
{
    public decimal TodayRevenue { get; set; }
    public decimal TotalOutstandingBalance { get; set; }
    public int PendingInvoicesCount { get; set; }
    public int TotalPaidInvoicesCount { get; set; }
    public int ActiveServicesCount { get; set; }
}
