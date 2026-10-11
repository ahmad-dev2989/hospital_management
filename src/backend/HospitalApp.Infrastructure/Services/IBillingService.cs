using HospitalApp.Core.DTOs;
using HospitalApp.Core.Enums;

namespace HospitalApp.Infrastructure.Services;

public interface IBillingService
{
    // Chargemaster / Services
    Task<List<ServiceItemDto>> GetServicesAsync(string? query = null, string? category = null, bool activeOnly = true, CancellationToken cancellationToken = default);
    Task<ServiceItemDto> GetServiceByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ServiceItemDto> CreateServiceAsync(CreateServiceItemRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<ServiceItemDto> UpdateServiceAsync(Guid id, UpdateServiceItemRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);

    // Invoices
    Task<PagedResult<InvoiceDto>> GetInvoicesAsync(Guid? patientId = null, InvoiceStatus? status = null, string? query = null, DateTime? fromDate = null, DateTime? toDate = null, int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<InvoiceDto> GetInvoiceByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<InvoiceDto> GenerateInvoiceFromEncounterAsync(Guid encounterId, GenerateEncounterInvoiceRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<InvoiceDto> IssueInvoiceAsync(Guid id, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<InvoiceDto> VoidInvoiceAsync(Guid id, string reason, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);

    // Payments & Refunds
    Task<PaymentDto> RecordPaymentAsync(RecordPaymentRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<RefundDto> ProcessRefundAsync(Guid paymentId, ProcessRefundRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<PaymentDto> GetPaymentByIdAsync(Guid id, CancellationToken cancellationToken = default);

    // Shift Closure & Reconciliation
    Task<CashierShiftSummaryDto> GetCashierShiftSummaryAsync(DateTime? date = null, Guid? cashierUserId = null, CancellationToken cancellationToken = default);
    Task<BillingDashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken cancellationToken = default);
}
