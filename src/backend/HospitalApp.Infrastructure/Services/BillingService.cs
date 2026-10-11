using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class BillingService : IBillingService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<BillingService> _logger;
    private static readonly SemaphoreSlim _invoiceLock = new(1, 1);
    private static readonly SemaphoreSlim _paymentLock = new(1, 1);

    public BillingService(
        ApplicationDbContext context,
        IAuditService auditService,
        ILogger<BillingService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    // ----------------------------------------------------
    // 1. SERVICE CHARGEMASTER (FEE SCHEDULE)
    // ----------------------------------------------------

    public async Task<List<ServiceItemDto>> GetServicesAsync(string? query = null, string? category = null, bool activeOnly = true, CancellationToken cancellationToken = default)
    {
        var q = _context.ServiceItems.AsNoTracking().AsQueryable();

        if (activeOnly)
        {
            q = q.Where(s => s.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            q = q.Where(s => s.Category.ToLower() == category.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim().ToLower();
            q = q.Where(s => s.Code.ToLower().Contains(search) || s.Name.ToLower().Contains(search) || s.Category.ToLower().Contains(search));
        }

        var list = await q.OrderBy(s => s.Category).ThenBy(s => s.Name).ToListAsync(cancellationToken);
        return list.Select(MapToServiceItemDto).ToList();
    }

    public async Task<ServiceItemDto> GetServiceByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await _context.ServiceItems.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (item == null)
            throw new KeyNotFoundException($"Service item with ID {id} not found.");

        return MapToServiceItemDto(item);
    }

    public async Task<ServiceItemDto> CreateServiceAsync(CreateServiceItemRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("Service code is required.");
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Service name is required.");

        var cleanCode = request.Code.Trim().ToUpper();
        var existing = await _context.ServiceItems.AnyAsync(s => s.Code == cleanCode, cancellationToken);
        if (existing)
            throw new InvalidOperationException($"A service with code '{cleanCode}' already exists in the chargemaster.");

        var service = new ServiceItem
        {
            Id = Guid.NewGuid(),
            Code = cleanCode,
            Name = request.Name.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "General" : request.Category.Trim(),
            DefaultPrice = Math.Max(0m, request.DefaultPrice),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.ServiceItems.Add(service);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "ServiceItem.Created",
            "ServiceItem",
            service.Id.ToString(),
            $"Created hospital service '{service.Name}' ({service.Code}) in category '{service.Category}' with price {service.DefaultPrice:C}",
            "127.0.0.1");

        return MapToServiceItemDto(service);
    }

    public async Task<ServiceItemDto> UpdateServiceAsync(Guid id, UpdateServiceItemRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var item = await _context.ServiceItems.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (item == null)
            throw new KeyNotFoundException($"Service item with ID {id} not found.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Service name is required.");

        item.Name = request.Name.Trim();
        item.Category = string.IsNullOrWhiteSpace(request.Category) ? "General" : request.Category.Trim();
        item.DefaultPrice = Math.Max(0m, request.DefaultPrice);
        item.IsActive = request.IsActive;
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "ServiceItem.Updated",
            "ServiceItem",
            item.Id.ToString(),
            $"Updated hospital service '{item.Name}' ({item.Code}): Price={item.DefaultPrice:C}, Active={item.IsActive}",
            "127.0.0.1");

        return MapToServiceItemDto(item);
    }

    // ----------------------------------------------------
    // 2. INVOICE MANAGEMENT
    // ----------------------------------------------------

    public async Task<PagedResult<InvoiceDto>> GetInvoicesAsync(
        Guid? patientId = null,
        InvoiceStatus? status = null,
        string? query = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var q = _context.Invoices
            .AsNoTracking()
            .Include(i => i.Patient)
            .Include(i => i.Encounter)
            .Include(i => i.CreatedByUser)
            .Include(i => i.Lines)
            .Include(i => i.Payments).ThenInclude(p => p.CashierUser)
            .Include(i => i.Payments).ThenInclude(p => p.Refunds).ThenInclude(r => r.AuthorizedByUser)
            .AsQueryable();

        if (patientId.HasValue && patientId.Value != Guid.Empty)
        {
            q = q.Where(i => i.PatientId == patientId.Value);
        }

        if (status.HasValue)
        {
            q = q.Where(i => i.Status == status.Value);
        }

        if (fromDate.HasValue)
        {
            var start = fromDate.Value.Date;
            q = q.Where(i => i.IssuedAt >= start);
        }

        if (toDate.HasValue)
        {
            var end = toDate.Value.Date.AddDays(1).AddTicks(-1);
            q = q.Where(i => i.IssuedAt <= end);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var s = query.Trim().ToLower();
            q = q.Where(i =>
                i.InvoiceNumber.ToLower().Contains(s) ||
                i.Patient.FirstName.ToLower().Contains(s) ||
                i.Patient.LastName.ToLower().Contains(s) ||
                i.Patient.PatientNumber.ToLower().Contains(s));
        }

        var total = await q.CountAsync(cancellationToken);
        var invoices = await q
            .OrderByDescending(i => i.IssuedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<InvoiceDto>
        {
            Total = total,
            Page = page,
            PageSize = pageSize,
            Items = invoices.Select(MapToInvoiceDto).ToList()
        };
    }

    public async Task<InvoiceDto> GetInvoiceByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .AsNoTracking()
            .Include(i => i.Patient)
            .Include(i => i.Encounter)
            .Include(i => i.CreatedByUser)
            .Include(i => i.Lines)
            .Include(i => i.Payments).ThenInclude(p => p.CashierUser)
            .Include(i => i.Payments).ThenInclude(p => p.Refunds).ThenInclude(r => r.AuthorizedByUser)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null)
            throw new KeyNotFoundException($"Invoice {id} not found.");

        return MapToInvoiceDto(invoice);
    }

    public async Task<InvoiceDto> CreateInvoiceAsync(CreateInvoiceRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.PatientId == Guid.Empty)
            throw new ArgumentException("Patient ID is required.");
        if (request.Lines == null || request.Lines.Count == 0)
            throw new ArgumentException("An invoice must contain at least one line item.");

        var patient = await _context.Patients.FirstOrDefaultAsync(p => p.Id == request.PatientId, cancellationToken);
        if (patient == null)
            throw new KeyNotFoundException($"Patient {request.PatientId} not found.");

        await _invoiceLock.WaitAsync(cancellationToken);
        try
        {
            var invoiceNumber = await GenerateInvoiceNumberAsync(cancellationToken);

            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                InvoiceNumber = invoiceNumber,
                PatientId = request.PatientId,
                EncounterId = request.EncounterId,
                CreatedByUserId = currentUserId,
                IssuedAt = DateTime.UtcNow,
                Status = InvoiceStatus.Issued,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            decimal subtotal = 0m;
            foreach (var lineReq in request.Lines)
            {
                var qty = Math.Max(1, lineReq.Quantity);
                var unitPrice = Math.Max(0m, lineReq.UnitPrice);
                var lineTotal = qty * unitPrice;
                subtotal += lineTotal;

                invoice.Lines.Add(new InvoiceLine
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    SourceType = string.IsNullOrWhiteSpace(lineReq.SourceType) ? "Service" : lineReq.SourceType.Trim(),
                    SourceId = lineReq.SourceId ?? string.Empty,
                    ItemDescription = lineReq.ItemDescription.Trim(),
                    Quantity = qty,
                    UnitPriceSnapshot = unitPrice,
                    TotalPrice = lineTotal,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }

            var discount = Math.Min(subtotal, Math.Max(0m, request.Discount));
            var taxableAmount = Math.Max(0m, subtotal - discount);
            var taxRate = Math.Max(0m, request.TaxPercentage) / 100m;
            var tax = Math.Round(taxableAmount * taxRate, 2);
            var total = taxableAmount + tax;

            invoice.Subtotal = subtotal;
            invoice.Discount = discount;
            invoice.Tax = tax;
            invoice.Total = total;
            invoice.PaidAmount = 0m;
            invoice.Balance = total;

            _context.Invoices.Add(invoice);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                currentUserId,
                currentUserName,
                "Invoice.Created",
                "Invoice",
                invoice.Id.ToString(),
                $"Created invoice {invoice.InvoiceNumber} for patient {patient.FirstName} {patient.LastName} ({patient.PatientNumber}): Total {invoice.Total:C} ({invoice.Lines.Count} line items)",
                "127.0.0.1");

            return await GetInvoiceByIdAsync(invoice.Id, cancellationToken);
        }
        finally
        {
            _invoiceLock.Release();
        }
    }

    public async Task<InvoiceDto> GenerateInvoiceFromEncounterAsync(Guid encounterId, GenerateEncounterInvoiceRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var encounter = await _context.Encounters
            .Include(e => e.Patient)
            .Include(e => e.Doctor).ThenInclude(d => d.User)
            .FirstOrDefaultAsync(e => e.Id == encounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Clinical encounter {encounterId} not found.");

        // Check if an invoice for this encounter already exists
        var existingInvoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.EncounterId == encounterId && i.Status != InvoiceStatus.Voided, cancellationToken);
        if (existingInvoice != null)
        {
            throw new InvalidOperationException($"An active invoice ({existingInvoice.InvoiceNumber}) already exists for this clinical encounter.");
        }

        var lines = new List<CreateInvoiceLineRequest>();

        // 1. Doctor Consultation Fee
        if (encounter.Doctor != null && encounter.Doctor.ConsultationFee > 0m)
        {
            lines.Add(new CreateInvoiceLineRequest
            {
                SourceType = "Consultation",
                SourceId = encounter.DoctorId.ToString(),
                ItemDescription = $"Physician Consultation - Dr. {encounter.Doctor.User.FullName} ({encounter.Doctor.Specialization})",
                Quantity = 1,
                UnitPrice = encounter.Doctor.ConsultationFee
            });
        }

        // 2. Diagnostic Laboratory Tests
        var labOrders = await _context.LabOrders
            .Where(o => o.EncounterId == encounterId && o.Status != LabOrderStatus.Cancelled && o.Status != LabOrderStatus.Rejected)
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .ToListAsync(cancellationToken);

        foreach (var order in labOrders)
        {
            foreach (var item in order.Items)
            {
                lines.Add(new CreateInvoiceLineRequest
                {
                    SourceType = "LabTest",
                    SourceId = item.Id.ToString(),
                    ItemDescription = $"Diagnostic Test: {item.LabTest.Name} ({item.LabTest.Code})",
                    Quantity = 1,
                    UnitPrice = item.LabTest.Price
                });
            }
        }

        // 3. Dispensed Pharmacy Medications
        var dispenseRecords = await _context.DispenseRecords
            .Where(d => d.Prescription.EncounterId == encounterId)
            .Include(d => d.Items).ThenInclude(i => i.InventoryBatch).ThenInclude(b => b.Drug)
            .ToListAsync(cancellationToken);

        if (dispenseRecords.Any())
        {
            foreach (var record in dispenseRecords)
            {
                foreach (var item in record.Items)
                {
                    lines.Add(new CreateInvoiceLineRequest
                    {
                        SourceType = "Medication",
                        SourceId = item.Id.ToString(),
                        ItemDescription = $"Medication: {item.InventoryBatch.Drug.BrandName} ({item.InventoryBatch.Drug.Strength}) [Batch {item.InventoryBatch.BatchNumber}]",
                        Quantity = item.Quantity,
                        UnitPrice = item.UnitPriceSnapshot
                    });
                }
            }
        }
        else
        {
            // If not yet dispensed, check signed prescriptions
            var prescriptions = await _context.Prescriptions
                .Where(p => p.EncounterId == encounterId && p.Status != PrescriptionStatus.Cancelled)
                .Include(p => p.Items).ThenInclude(i => i.Drug).ThenInclude(d => d.Batches)
                .ToListAsync(cancellationToken);

            foreach (var p in prescriptions)
            {
                foreach (var pi in p.Items)
                {
                    var activeBatch = pi.Drug.Batches.Where(b => b.Status == InventoryBatchStatus.Available && b.QuantityOnHand > 0).OrderBy(b => b.ExpiryDate).FirstOrDefault();
                    var price = activeBatch != null ? activeBatch.SellingPrice : 5.00m;

                    lines.Add(new CreateInvoiceLineRequest
                    {
                        SourceType = "Medication",
                        SourceId = pi.Id.ToString(),
                        ItemDescription = $"Medication (Prescription): {pi.Drug.BrandName} ({pi.Drug.Strength}) - Qty: {pi.QuantityPrescribed}",
                        Quantity = pi.QuantityPrescribed,
                        UnitPrice = price
                    });
                }
            }
        }

        // Fallback default service line if encounter had zero billable items
        if (lines.Count == 0)
        {
            lines.Add(new CreateInvoiceLineRequest
            {
                SourceType = "Consultation",
                SourceId = encounter.Id.ToString(),
                ItemDescription = $"Outpatient Clinical Consultation (Encounter started {encounter.StartedAt:g})",
                Quantity = 1,
                UnitPrice = 25.00m
            });
        }

        var createReq = new CreateInvoiceRequest
        {
            PatientId = encounter.PatientId,
            EncounterId = encounter.Id,
            Discount = request.Discount,
            TaxPercentage = request.TaxPercentage,
            Lines = lines
        };

        return await CreateInvoiceAsync(createReq, currentUserId, currentUserName, cancellationToken);
    }

    public async Task<InvoiceDto> IssueInvoiceAsync(Guid id, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var invoice = await _context.Invoices
            .Include(i => i.Patient)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null)
            throw new KeyNotFoundException($"Invoice {id} not found.");

        if (invoice.Status != InvoiceStatus.Draft)
            throw new InvalidOperationException($"Only draft invoices can be issued. Current status: {invoice.Status}");

        invoice.Status = InvoiceStatus.Issued;
        invoice.IssuedAt = DateTime.UtcNow;
        invoice.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Invoice.Issued",
            "Invoice",
            invoice.Id.ToString(),
            $"Issued invoice {invoice.InvoiceNumber} to patient {invoice.Patient.FirstName} {invoice.Patient.LastName} for amount {invoice.Total:C}",
            "127.0.0.1");

        return await GetInvoiceByIdAsync(invoice.Id, cancellationToken);
    }

    public async Task<InvoiceDto> VoidInvoiceAsync(Guid id, string reason, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("A reason is required to void an invoice.");

        var invoice = await _context.Invoices
            .Include(i => i.Payments)
            .Include(i => i.Patient)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (invoice == null)
            throw new KeyNotFoundException($"Invoice {id} not found.");

        if (invoice.PaidAmount > 0)
            throw new InvalidOperationException($"Cannot void invoice {invoice.InvoiceNumber} because it has payments recorded ({invoice.PaidAmount:C}). Please process refunds first.");

        invoice.Status = InvoiceStatus.Voided;
        invoice.Balance = 0m;
        invoice.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "Invoice.Voided",
            "Invoice",
            invoice.Id.ToString(),
            $"Voided invoice {invoice.InvoiceNumber} for patient {invoice.Patient.FirstName} {invoice.Patient.LastName}. Reason: {reason}",
            "127.0.0.1");

        return await GetInvoiceByIdAsync(invoice.Id, cancellationToken);
    }

    // ----------------------------------------------------
    // 3. PAYMENTS & REFUNDS
    // ----------------------------------------------------

    public async Task<PaymentDto> RecordPaymentAsync(RecordPaymentRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.InvoiceId == Guid.Empty)
            throw new ArgumentException("Invoice ID is required.");
        if (request.Amount <= 0m)
            throw new ArgumentException("Payment amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
            throw new ArgumentException("Idempotency key is required.");

        // Idempotency check: if already processed, return existing payment without double recording
        var cleanKey = request.IdempotencyKey.Trim();
        var existingPayment = await _context.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
            .Include(p => p.CashierUser)
            .Include(p => p.Refunds).ThenInclude(r => r.AuthorizedByUser)
            .FirstOrDefaultAsync(p => p.IdempotencyKey == cleanKey, cancellationToken);

        if (existingPayment != null)
        {
            _logger.LogInformation("Idempotent payment capture hit for key {Key}, returning existing receipt {Receipt}", cleanKey, existingPayment.ReceiptNumber);
            return MapToPaymentDto(existingPayment);
        }

        await _paymentLock.WaitAsync(cancellationToken);
        try
        {
            // Re-check after acquiring lock
            existingPayment = await _context.Payments
                .AsNoTracking()
                .Include(p => p.Invoice)
                .Include(p => p.CashierUser)
                .Include(p => p.Refunds).ThenInclude(r => r.AuthorizedByUser)
                .FirstOrDefaultAsync(p => p.IdempotencyKey == cleanKey, cancellationToken);

            if (existingPayment != null)
            {
                return MapToPaymentDto(existingPayment);
            }

            var invoice = await _context.Invoices
                .Include(i => i.Patient)
                .FirstOrDefaultAsync(i => i.Id == request.InvoiceId, cancellationToken);

            if (invoice == null)
                throw new KeyNotFoundException($"Invoice {request.InvoiceId} not found.");

            if (invoice.Status == InvoiceStatus.Voided)
                throw new InvalidOperationException($"Cannot record payment against voided invoice {invoice.InvoiceNumber}.");

            if (invoice.Status == InvoiceStatus.Draft)
            {
                // Auto-issue draft on first payment
                invoice.Status = InvoiceStatus.Issued;
            }

            if (request.Amount > invoice.Balance)
            {
                throw new InvalidOperationException($"Payment amount ({request.Amount:C}) exceeds outstanding invoice balance ({invoice.Balance:C}).");
            }

            var receiptNumber = await GenerateReceiptNumberAsync(cancellationToken);

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                ReceiptNumber = receiptNumber,
                InvoiceId = invoice.Id,
                CashierUserId = currentUserId,
                Amount = request.Amount,
                Method = request.Method,
                ProviderReference = request.ProviderReference?.Trim(),
                IdempotencyKey = cleanKey,
                ReceivedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            invoice.PaidAmount += request.Amount;
            invoice.Balance = Math.Max(0m, invoice.Total - invoice.PaidAmount);

            if (invoice.Balance <= 0m)
            {
                invoice.Status = InvoiceStatus.Paid;
            }
            else
            {
                invoice.Status = InvoiceStatus.PartiallyPaid;
            }

            invoice.UpdatedAt = DateTime.UtcNow;

            _context.Payments.Add(payment);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                currentUserId,
                currentUserName,
                "Payment.Recorded",
                "Payment",
                payment.Id.ToString(),
                $"Recorded payment of {payment.Amount:C} via {payment.Method} (Receipt: {payment.ReceiptNumber}) for invoice {invoice.InvoiceNumber} (Remaining: {invoice.Balance:C})",
                "127.0.0.1");

            return await GetPaymentByIdAsync(payment.Id, cancellationToken);
        }
        finally
        {
            _paymentLock.Release();
        }
    }

    public async Task<RefundDto> ProcessRefundAsync(Guid paymentId, ProcessRefundRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.Amount <= 0m)
            throw new ArgumentException("Refund amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("A clinical / financial reason is required to process a refund.");

        await _paymentLock.WaitAsync(cancellationToken);
        try
        {
            var payment = await _context.Payments
                .Include(p => p.Invoice)
                .Include(p => p.Refunds)
                .FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken);

            if (payment == null)
                throw new KeyNotFoundException($"Payment receipt {paymentId} not found.");

            var previouslyRefunded = payment.Refunds.Sum(r => r.Amount);
            var maxRefundable = payment.Amount - previouslyRefunded;

            if (request.Amount > maxRefundable)
            {
                throw new InvalidOperationException($"Refund amount ({request.Amount:C}) exceeds maximum refundable balance on this receipt ({maxRefundable:C}).");
            }

            var refund = new Refund
            {
                Id = Guid.NewGuid(),
                PaymentId = payment.Id,
                AuthorizedByUserId = currentUserId,
                Amount = request.Amount,
                Reason = request.Reason.Trim(),
                RefundedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var invoice = payment.Invoice;
            invoice.PaidAmount = Math.Max(0m, invoice.PaidAmount - request.Amount);
            invoice.Balance = Math.Max(0m, invoice.Total - invoice.PaidAmount);

            if (invoice.PaidAmount <= 0m)
            {
                invoice.Status = InvoiceStatus.RefundedFully;
            }
            else
            {
                invoice.Status = InvoiceStatus.RefundedPartially;
            }

            invoice.UpdatedAt = DateTime.UtcNow;

            _context.Refunds.Add(refund);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                currentUserId,
                currentUserName,
                "Payment.Refunded",
                "Refund",
                refund.Id.ToString(),
                $"Processed refund of {refund.Amount:C} on receipt {payment.ReceiptNumber} for invoice {invoice.InvoiceNumber}. Reason: {refund.Reason}",
                "127.0.0.1");

            var loaded = await _context.Refunds
                .AsNoTracking()
                .Include(r => r.AuthorizedByUser)
                .FirstAsync(r => r.Id == refund.Id, cancellationToken);

            return MapToRefundDto(loaded);
        }
        finally
        {
            _paymentLock.Release();
        }
    }

    public async Task<PaymentDto> GetPaymentByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var payment = await _context.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
            .Include(p => p.CashierUser)
            .Include(p => p.Refunds).ThenInclude(r => r.AuthorizedByUser)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (payment == null)
            throw new KeyNotFoundException($"Payment {id} not found.");

        return MapToPaymentDto(payment);
    }

    // ----------------------------------------------------
    // 4. CASHIER SHIFT RECONCILIATION & METRICS
    // ----------------------------------------------------

    public async Task<CashierShiftSummaryDto> GetCashierShiftSummaryAsync(DateTime? date = null, Guid? cashierUserId = null, CancellationToken cancellationToken = default)
    {
        var targetDate = (date ?? DateTime.UtcNow).Date;
        var nextDate = targetDate.AddDays(1);

        var q = _context.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
            .Include(p => p.CashierUser)
            .Include(p => p.Refunds).ThenInclude(r => r.AuthorizedByUser)
            .Where(p => p.ReceivedAt >= targetDate && p.ReceivedAt < nextDate);

        if (cashierUserId.HasValue && cashierUserId.Value != Guid.Empty)
        {
            q = q.Where(p => p.CashierUserId == cashierUserId.Value);
        }

        var payments = await q.OrderByDescending(p => p.ReceivedAt).ToListAsync(cancellationToken);

        decimal totalCollected = payments.Sum(p => p.Amount);
        decimal totalRefunded = payments.SelectMany(p => p.Refunds).Sum(r => r.Amount);
        decimal netCollected = totalCollected - totalRefunded;

        var cashierName = cashierUserId.HasValue
            ? await _context.UserAccounts.Where(u => u.Id == cashierUserId.Value).Select(u => u.FullName).FirstOrDefaultAsync(cancellationToken)
            : "All Cashiers";

        return new CashierShiftSummaryDto
        {
            ShiftDate = targetDate,
            CashierUserId = cashierUserId,
            CashierUserName = cashierName,
            TotalCollected = totalCollected,
            TotalRefunded = totalRefunded,
            NetCollected = netCollected,
            TotalReceiptsCount = payments.Count,
            CashTotal = payments.Where(p => p.Method == PaymentMethod.Cash).Sum(p => p.Amount),
            CreditCardTotal = payments.Where(p => p.Method == PaymentMethod.CreditCard).Sum(p => p.Amount),
            DebitCardTotal = payments.Where(p => p.Method == PaymentMethod.DebitCard).Sum(p => p.Amount),
            BankTransferTotal = payments.Where(p => p.Method == PaymentMethod.BankTransfer).Sum(p => p.Amount),
            MobilePaymentTotal = payments.Where(p => p.Method == PaymentMethod.MobilePayment).Sum(p => p.Amount),
            InsuranceCoPayTotal = payments.Where(p => p.Method == PaymentMethod.InsuranceCoPay).Sum(p => p.Amount),
            RecentPayments = payments.Select(MapToPaymentDto).ToList()
        };
    }

    public async Task<BillingDashboardMetricsDto> GetDashboardMetricsAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var todayPayments = await _context.Payments
            .Where(p => p.ReceivedAt >= today && p.ReceivedAt < tomorrow)
            .SumAsync(p => p.Amount, cancellationToken);

        var todayRefunds = await _context.Refunds
            .Where(r => r.RefundedAt >= today && r.RefundedAt < tomorrow)
            .SumAsync(r => r.Amount, cancellationToken);

        var totalOutstanding = await _context.Invoices
            .Where(i => i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid)
            .SumAsync(i => i.Balance, cancellationToken);

        var pendingCount = await _context.Invoices
            .Where(i => (i.Status == InvoiceStatus.Issued || i.Status == InvoiceStatus.PartiallyPaid) && i.Balance > 0)
            .CountAsync(cancellationToken);

        var paidCount = await _context.Invoices
            .Where(i => i.Status == InvoiceStatus.Paid)
            .CountAsync(cancellationToken);

        var activeServices = await _context.ServiceItems
            .Where(s => s.IsActive)
            .CountAsync(cancellationToken);

        return new BillingDashboardMetricsDto
        {
            TodayRevenue = Math.Max(0m, todayPayments - todayRefunds),
            TotalOutstandingBalance = totalOutstanding,
            PendingInvoicesCount = pendingCount,
            TotalPaidInvoicesCount = paidCount,
            ActiveServicesCount = activeServices
        };
    }

    // ----------------------------------------------------
    // HELPER NUMBER GENERATORS & MAPPERS
    // ----------------------------------------------------

    private async Task<string> GenerateInvoiceNumberAsync(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"INV-{year}-";

        var existingNumbers = await _context.Invoices
            .AsNoTracking()
            .Where(i => i.InvoiceNumber.StartsWith(prefix))
            .Select(i => i.InvoiceNumber)
            .ToListAsync(cancellationToken);

        int highestSeq = 0;
        foreach (var num in existingNumbers)
        {
            var parts = num.Split('-');
            if (parts.Length == 3 && int.TryParse(parts[2], out var seq))
            {
                if (seq > highestSeq) highestSeq = seq;
            }
        }

        return $"{prefix}{(highestSeq + 1):D5}";
    }

    private async Task<string> GenerateReceiptNumberAsync(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"REC-{year}-";

        var existingNumbers = await _context.Payments
            .AsNoTracking()
            .Where(p => p.ReceiptNumber.StartsWith(prefix))
            .Select(p => p.ReceiptNumber)
            .ToListAsync(cancellationToken);

        int highestSeq = 0;
        foreach (var num in existingNumbers)
        {
            var parts = num.Split('-');
            if (parts.Length == 3 && int.TryParse(parts[2], out var seq))
            {
                if (seq > highestSeq) highestSeq = seq;
            }
        }

        return $"{prefix}{(highestSeq + 1):D5}";
    }

    private static ServiceItemDto MapToServiceItemDto(ServiceItem s) => new()
    {
        Id = s.Id,
        Code = s.Code,
        Name = s.Name,
        Category = s.Category,
        DefaultPrice = s.DefaultPrice,
        IsActive = s.IsActive,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt
    };

    private static InvoiceLineDto MapToInvoiceLineDto(InvoiceLine l) => new()
    {
        Id = l.Id,
        InvoiceId = l.InvoiceId,
        SourceType = l.SourceType,
        SourceId = l.SourceId,
        ItemDescription = l.ItemDescription,
        Quantity = l.Quantity,
        UnitPriceSnapshot = l.UnitPriceSnapshot,
        TotalPrice = l.TotalPrice,
        CreatedAt = l.CreatedAt
    };

    private static InvoiceDto MapToInvoiceDto(Invoice i) => new()
    {
        Id = i.Id,
        InvoiceNumber = i.InvoiceNumber,
        PatientId = i.PatientId,
        PatientNumber = i.Patient?.PatientNumber ?? string.Empty,
        PatientName = i.Patient != null ? $"{i.Patient.FirstName} {i.Patient.LastName}".Trim() : string.Empty,
        EncounterId = i.EncounterId,
        EncounterNumber = i.Encounter != null ? $"ENC-{i.Encounter.StartedAt.Year}-{i.Encounter.Id.ToString()[..6].ToUpper()}" : null,
        CreatedByUserId = i.CreatedByUserId,
        CreatedByUserName = i.CreatedByUser?.FullName ?? "Staff",
        IssuedAt = i.IssuedAt,
        Subtotal = i.Subtotal,
        Discount = i.Discount,
        Tax = i.Tax,
        Total = i.Total,
        PaidAmount = i.PaidAmount,
        Balance = i.Balance,
        Status = i.Status,
        CreatedAt = i.CreatedAt,
        UpdatedAt = i.UpdatedAt,
        Lines = i.Lines.OrderBy(l => l.CreatedAt).Select(MapToInvoiceLineDto).ToList(),
        Payments = i.Payments.OrderByDescending(p => p.ReceivedAt).Select(MapToPaymentDto).ToList()
    };

    private static PaymentDto MapToPaymentDto(Payment p) => new()
    {
        Id = p.Id,
        ReceiptNumber = p.ReceiptNumber,
        InvoiceId = p.InvoiceId,
        InvoiceNumber = p.Invoice?.InvoiceNumber ?? string.Empty,
        CashierUserId = p.CashierUserId,
        CashierUserName = p.CashierUser?.FullName ?? "Cashier",
        Amount = p.Amount,
        Method = p.Method,
        ProviderReference = p.ProviderReference,
        IdempotencyKey = p.IdempotencyKey,
        ReceivedAt = p.ReceivedAt,
        CreatedAt = p.CreatedAt,
        Refunds = p.Refunds.OrderByDescending(r => r.RefundedAt).Select(MapToRefundDto).ToList()
    };

    private static RefundDto MapToRefundDto(Refund r) => new()
    {
        Id = r.Id,
        PaymentId = r.PaymentId,
        AuthorizedByUserId = r.AuthorizedByUserId,
        AuthorizedByUserName = r.AuthorizedByUser?.FullName ?? "Supervisor",
        Amount = r.Amount,
        Reason = r.Reason,
        RefundedAt = r.RefundedAt,
        CreatedAt = r.CreatedAt
    };
}
