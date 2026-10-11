using HospitalApp.Core.DTOs;
using HospitalApp.Core.Entities;
using HospitalApp.Core.Enums;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HospitalApp.Infrastructure.Services;

public class LabService : ILabService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _auditService;
    private readonly ILogger<LabService> _logger;
    private static readonly SemaphoreSlim _orderLock = new(1, 1);

    public LabService(
        ApplicationDbContext context,
        IAuditService auditService,
        ILogger<LabService> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    // ----------------------------------------------------
    // TEST CATALOG
    // ----------------------------------------------------

    public async Task<List<LabTestDto>> GetLabTestsAsync(string? category = null, bool activeOnly = true, CancellationToken cancellationToken = default)
    {
        var q = _context.LabTests.AsNoTracking().AsQueryable();

        if (activeOnly)
        {
            q = q.Where(t => t.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var cat = category.Trim().ToLower();
            q = q.Where(t => t.Category.ToLower() == cat);
        }

        var tests = await q.OrderBy(t => t.Category).ThenBy(t => t.Name).ToListAsync(cancellationToken);
        return tests.Select(MapToLabTestDto).ToList();
    }

    public async Task<LabTestDto> GetLabTestByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var test = await _context.LabTests.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (test == null)
            throw new KeyNotFoundException($"Lab test with ID {id} not found.");

        return MapToLabTestDto(test);
    }

    public async Task<LabTestDto> CreateLabTestAsync(CreateLabTestRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("Test Code is required.");
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Test Name is required.");
        if (string.IsNullOrWhiteSpace(request.Category))
            throw new ArgumentException("Category is required.");
        if (string.IsNullOrWhiteSpace(request.SpecimenType))
            throw new ArgumentException("Specimen type is required.");

        var codeUpper = request.Code.Trim().ToUpper();
        var exists = await _context.LabTests.AnyAsync(t => t.Code == codeUpper, cancellationToken);
        if (exists)
            throw new InvalidOperationException($"Lab test with code '{codeUpper}' already exists.");

        var test = new LabTest
        {
            Id = Guid.NewGuid(),
            Code = codeUpper,
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            SpecimenType = request.SpecimenType.Trim(),
            UnitOfMeasure = request.UnitOfMeasure?.Trim(),
            ReferenceRange = request.ReferenceRange?.Trim(),
            Price = Math.Max(0m, request.Price),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.LabTests.Add(test);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "LabTest.Created",
            "LabTest",
            test.Id.ToString(),
            $"Created diagnostic lab test '{test.Name}' ({test.Code}) in category '{test.Category}' with price {test.Price:C}",
            "127.0.0.1");

        return MapToLabTestDto(test);
    }

    public async Task<LabTestDto> UpdateLabTestAsync(Guid id, UpdateLabTestRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var test = await _context.LabTests.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (test == null)
            throw new KeyNotFoundException($"Lab test with ID {id} not found.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Test Name is required.");
        if (string.IsNullOrWhiteSpace(request.Category))
            throw new ArgumentException("Category is required.");
        if (string.IsNullOrWhiteSpace(request.SpecimenType))
            throw new ArgumentException("Specimen type is required.");

        test.Name = request.Name.Trim();
        test.Category = request.Category.Trim();
        test.SpecimenType = request.SpecimenType.Trim();
        test.UnitOfMeasure = request.UnitOfMeasure?.Trim();
        test.ReferenceRange = request.ReferenceRange?.Trim();
        test.Price = Math.Max(0m, request.Price);
        test.IsActive = request.IsActive;
        test.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "LabTest.Updated",
            "LabTest",
            test.Id.ToString(),
            $"Updated diagnostic lab test '{test.Name}' ({test.Code})",
            "127.0.0.1");

        return MapToLabTestDto(test);
    }

    // ----------------------------------------------------
    // ORDERS & WORKLIST
    // ----------------------------------------------------

    public async Task<PagedResult<LabOrderDto>> GetLabOrdersAsync(LabOrderFilterDto filter, CancellationToken cancellationToken = default)
    {
        filter.Page = Math.Max(1, filter.Page);
        filter.PageSize = Math.Clamp(filter.PageSize, 1, 200);

        var q = _context.LabOrders
            .AsNoTracking()
            .Include(o => o.Patient)
            .Include(o => o.OrderedByDoctor).ThenInclude(d => d.User)
            .Include(o => o.OrderedByDoctor).ThenInclude(d => d.Department)
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .Include(o => o.Items).ThenInclude(i => i.EnteredByUser)
            .Include(o => o.Items).ThenInclude(i => i.VerifiedByUser)
            .AsQueryable();

        if (filter.EncounterId.HasValue && filter.EncounterId.Value != Guid.Empty)
        {
            q = q.Where(o => o.EncounterId == filter.EncounterId.Value);
        }

        if (filter.PatientId.HasValue && filter.PatientId.Value != Guid.Empty)
        {
            q = q.Where(o => o.PatientId == filter.PatientId.Value);
        }

        if (filter.Status.HasValue)
        {
            q = q.Where(o => o.Status == filter.Status.Value);
        }

        if (filter.Priority.HasValue)
        {
            q = q.Where(o => o.Priority == filter.Priority.Value);
        }

        if (filter.Date.HasValue)
        {
            var dayUtc = DateTime.SpecifyKind(filter.Date.Value.Date, DateTimeKind.Utc);
            var nextDayUtc = dayUtc.AddDays(1);
            q = q.Where(o => o.CreatedAt >= dayUtc && o.CreatedAt < nextDayUtc);
        }

        if (!string.IsNullOrWhiteSpace(filter.Query))
        {
            var search = filter.Query.Trim().ToLower();
            q = q.Where(o =>
                o.OrderNumber.ToLower().Contains(search) ||
                o.Patient.PatientNumber.ToLower().Contains(search) ||
                o.Patient.FirstName.ToLower().Contains(search) ||
                o.Patient.LastName.ToLower().Contains(search) ||
                o.OrderedByDoctor.User.FullName.ToLower().Contains(search) ||
                o.Items.Any(i => i.SpecimenBarcode != null && i.SpecimenBarcode.ToLower().Contains(search)));
        }

        var total = await q.CountAsync(cancellationToken);

        var items = await q
            .OrderByDescending(o => o.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<LabOrderDto>
        {
            Total = total,
            Page = filter.Page,
            PageSize = filter.PageSize,
            Items = items.Select(MapToLabOrderDto).ToList()
        };
    }

    public async Task<LabOrderDto> GetLabOrderByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var order = await _context.LabOrders
            .AsNoTracking()
            .Include(o => o.Patient)
            .Include(o => o.OrderedByDoctor).ThenInclude(d => d.User)
            .Include(o => o.OrderedByDoctor).ThenInclude(d => d.Department)
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .Include(o => o.Items).ThenInclude(i => i.EnteredByUser)
            .Include(o => o.Items).ThenInclude(i => i.VerifiedByUser)
            .FirstOrDefaultAsync(o => o.Id == id, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException($"Lab order {id} not found.");

        return MapToLabOrderDto(order);
    }

    public async Task<List<LabOrderDto>> GetLabOrdersByEncounterIdAsync(Guid encounterId, CancellationToken cancellationToken = default)
    {
        var orders = await _context.LabOrders
            .AsNoTracking()
            .Include(o => o.Patient)
            .Include(o => o.OrderedByDoctor).ThenInclude(d => d.User)
            .Include(o => o.OrderedByDoctor).ThenInclude(d => d.Department)
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .Include(o => o.Items).ThenInclude(i => i.EnteredByUser)
            .Include(o => o.Items).ThenInclude(i => i.VerifiedByUser)
            .Where(o => o.EncounterId == encounterId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);

        return orders.Select(MapToLabOrderDto).ToList();
    }

    public async Task<LabOrderDto> CreateLabOrderAsync(CreateLabOrderRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.EncounterId == Guid.Empty)
            throw new ArgumentException("Encounter ID is required.");
        if (request.TestIds == null || request.TestIds.Count == 0)
            throw new ArgumentException("At least one diagnostic test must be selected.");

        var encounter = await _context.Encounters
            .Include(e => e.Patient)
            .Include(e => e.Doctor).ThenInclude(d => d.User)
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId, cancellationToken);

        if (encounter == null)
            throw new KeyNotFoundException($"Encounter {request.EncounterId} not found.");

        if (encounter.Status == EncounterStatus.Closed)
            throw new InvalidOperationException("Cannot order laboratory tests for a closed encounter.");

        var distinctTestIds = request.TestIds.Distinct().ToList();
        var tests = await _context.LabTests
            .Where(t => distinctTestIds.Contains(t.Id) && t.IsActive)
            .ToListAsync(cancellationToken);

        if (tests.Count != distinctTestIds.Count)
            throw new ArgumentException("One or more selected lab tests are invalid or inactive.");

        await _orderLock.WaitAsync(cancellationToken);
        try
        {
            var year = DateTime.UtcNow.Year;
            var prefix = $"LAB-{year}-";

            var existingOrderNumbers = await _context.LabOrders
                .AsNoTracking()
                .Where(o => o.OrderNumber.StartsWith(prefix))
                .Select(o => o.OrderNumber)
                .ToListAsync(cancellationToken);

            int highestSeq = 0;
            foreach (var num in existingOrderNumbers)
            {
                var suffix = num.Substring(prefix.Length);
                if (int.TryParse(suffix, out int parsed) && parsed > highestSeq)
                    highestSeq = parsed;
            }

            var nextOrderNumber = $"{prefix}{(highestSeq + 1):D5}";

            var order = new LabOrder
            {
                Id = Guid.NewGuid(),
                OrderNumber = nextOrderNumber,
                EncounterId = encounter.Id,
                PatientId = encounter.PatientId,
                OrderedByDoctorId = encounter.DoctorId,
                Priority = request.Priority,
                Status = LabOrderStatus.Ordered,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            int itemIndex = 1;
            foreach (var test in tests)
            {
                var barcode = $"SP-{year}-{(highestSeq + 1):D5}-{itemIndex:D2}";
                order.Items.Add(new LabOrderItem
                {
                    Id = Guid.NewGuid(),
                    LabOrderId = order.Id,
                    LabTestId = test.Id,
                    SpecimenBarcode = barcode,
                    SpecimenCollectedAt = null,
                    ResultValue = null,
                    ResultUnit = test.UnitOfMeasure,
                    ReferenceRangeSnapshot = test.ReferenceRange,
                    IsAbnormal = false,
                    Comments = null,
                    EnteredByUserId = null,
                    VerifiedByUserId = null,
                    VerifiedAt = null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
                itemIndex++;
            }

            _context.LabOrders.Add(order);
            await _context.SaveChangesAsync(cancellationToken);

            await _auditService.LogAsync(
                currentUserId,
                currentUserName,
                "LabOrder.Created",
                "LabOrder",
                order.Id.ToString(),
                $"Created lab order {order.OrderNumber} with {order.Items.Count} tests (Priority: {order.Priority}) for patient {encounter.Patient.PatientNumber}",
                "127.0.0.1");

            return await GetLabOrderByIdAsync(order.Id, cancellationToken);
        }
        finally
        {
            _orderLock.Release();
        }
    }

    // ----------------------------------------------------
    // WORKFLOW STEPS
    // ----------------------------------------------------

    public async Task<LabOrderDto> CollectSpecimenAsync(Guid orderId, CollectSpecimenRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var order = await _context.LabOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException($"Lab order {orderId} not found.");

        if (order.Status == LabOrderStatus.Cancelled || order.Status == LabOrderStatus.Rejected)
            throw new InvalidOperationException($"Cannot collect specimens for a {order.Status} lab order.");

        if (order.Status == LabOrderStatus.Released || order.Status == LabOrderStatus.Verified)
            throw new InvalidOperationException("Cannot modify specimen status for an already verified/released lab order.");

        var now = DateTime.UtcNow;

        if (request.Items != null && request.Items.Count > 0)
        {
            foreach (var reqItem in request.Items)
            {
                var item = order.Items.FirstOrDefault(i => i.Id == reqItem.LabOrderItemId);
                if (item != null)
                {
                    item.SpecimenCollectedAt = now;
                    if (!string.IsNullOrWhiteSpace(reqItem.CustomBarcode))
                    {
                        item.SpecimenBarcode = reqItem.CustomBarcode.Trim().ToUpper();
                    }
                    item.UpdatedAt = now;
                }
            }
        }
        else
        {
            // Collect all items in order
            foreach (var item in order.Items)
            {
                item.SpecimenCollectedAt = now;
                item.UpdatedAt = now;
            }
        }

        order.Status = LabOrderStatus.Collected;
        order.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "LabSpecimen.Collected",
            "LabOrder",
            order.Id.ToString(),
            $"Recorded specimen collection for lab order {order.OrderNumber}",
            "127.0.0.1");

        return await GetLabOrderByIdAsync(order.Id, cancellationToken);
    }

    public async Task<LabOrderDto> ReceiveSpecimenAsync(Guid orderId, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var order = await _context.LabOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException($"Lab order {orderId} not found.");

        if (order.Status == LabOrderStatus.Cancelled || order.Status == LabOrderStatus.Rejected)
            throw new InvalidOperationException($"Cannot receive specimens for a {order.Status} lab order.");

        var now = DateTime.UtcNow;

        // If items weren't marked as collected yet, mark them as collected upon arrival at lab
        foreach (var item in order.Items)
        {
            if (item.SpecimenCollectedAt == null)
            {
                item.SpecimenCollectedAt = now;
            }
            item.UpdatedAt = now;
        }

        order.Status = LabOrderStatus.Processing;
        order.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "LabSpecimen.ReceivedInLab",
            "LabOrder",
            order.Id.ToString(),
            $"Marked lab order {order.OrderNumber} as received and processing in laboratory",
            "127.0.0.1");

        return await GetLabOrderByIdAsync(order.Id, cancellationToken);
    }

    public async Task<LabOrderDto> RecordResultsAsync(Guid orderId, RecordLabResultsRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (request.Results == null || request.Results.Count == 0)
            throw new ArgumentException("At least one test result must be provided.");

        var order = await _context.LabOrders
            .Include(o => o.Items).ThenInclude(i => i.LabTest)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException($"Lab order {orderId} not found.");

        if (order.Status == LabOrderStatus.Released || order.Status == LabOrderStatus.Verified)
            throw new InvalidOperationException("Cannot alter results of an already verified or released lab order.");

        if (order.Status == LabOrderStatus.Cancelled)
            throw new InvalidOperationException("Cannot record results for a cancelled lab order.");

        var now = DateTime.UtcNow;

        foreach (var res in request.Results)
        {
            var item = order.Items.FirstOrDefault(i => i.Id == res.LabOrderItemId);
            if (item == null)
                throw new KeyNotFoundException($"Order item {res.LabOrderItemId} not found in lab order {orderId}.");

            item.ResultValue = res.ResultValue?.Trim();
            if (!string.IsNullOrWhiteSpace(res.ResultUnit))
                item.ResultUnit = res.ResultUnit.Trim();
            item.IsAbnormal = res.IsAbnormal;
            item.Comments = res.Comments?.Trim();
            item.EnteredByUserId = currentUserId;
            item.UpdatedAt = now;
        }

        order.Status = LabOrderStatus.DraftResult;
        order.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "LabResult.Recorded",
            "LabOrder",
            order.Id.ToString(),
            $"Recorded draft results for {request.Results.Count} test(s) on lab order {order.OrderNumber}",
            "127.0.0.1");

        return await GetLabOrderByIdAsync(order.Id, cancellationToken);
    }

    public async Task<LabOrderDto> VerifyAndReleaseOrderAsync(Guid orderId, VerifyLabResultsRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var order = await _context.LabOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

        if (order == null)
            throw new KeyNotFoundException($"Lab order {orderId} not found.");

        if (order.Status == LabOrderStatus.Released)
            throw new InvalidOperationException("Lab order results have already been verified and released.");

        if (order.Status == LabOrderStatus.Cancelled)
            throw new InvalidOperationException("Cannot verify a cancelled lab order.");

        // Verification validation: Every item in the order must have a result value
        var missingResults = order.Items.Where(i => string.IsNullOrWhiteSpace(i.ResultValue)).ToList();
        if (missingResults.Any())
            throw new InvalidOperationException($"Cannot verify lab order: {missingResults.Count} test(s) are missing result values.");

        var now = DateTime.UtcNow;

        foreach (var item in order.Items)
        {
            item.VerifiedByUserId = currentUserId;
            item.VerifiedAt = now;
            item.UpdatedAt = now;
        }

        order.Status = request.ReleaseImmediately ? LabOrderStatus.Released : LabOrderStatus.Verified;
        order.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            request.ReleaseImmediately ? "LabOrder.Released" : "LabOrder.Verified",
            "LabOrder",
            order.Id.ToString(),
            $"Sealed and verified results for lab order {order.OrderNumber} (Status: {order.Status})",
            "127.0.0.1");

        return await GetLabOrderByIdAsync(order.Id, cancellationToken);
    }

    public async Task<bool> CancelOrderAsync(Guid orderId, CancelLabOrderRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("A cancellation reason is required.");

        var order = await _context.LabOrders.FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);
        if (order == null) return false;

        if (order.Status == LabOrderStatus.Released || order.Status == LabOrderStatus.Verified)
            throw new InvalidOperationException("Cannot cancel an already verified or released lab order.");

        order.Status = LabOrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            currentUserId,
            currentUserName,
            "LabOrder.Cancelled",
            "LabOrder",
            order.Id.ToString(),
            $"Cancelled lab order {order.OrderNumber}. Reason: {request.Reason}",
            "127.0.0.1");

        return true;
    }

    // ----------------------------------------------------
    // PRIVATE MAPPERS
    // ----------------------------------------------------

    private static LabTestDto MapToLabTestDto(LabTest t)
    {
        return new LabTestDto
        {
            Id = t.Id,
            Code = t.Code,
            Name = t.Name,
            Category = t.Category,
            SpecimenType = t.SpecimenType,
            UnitOfMeasure = t.UnitOfMeasure,
            ReferenceRange = t.ReferenceRange,
            Price = t.Price,
            IsActive = t.IsActive,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        };
    }

    private static LabOrderDto MapToLabOrderDto(LabOrder o)
    {
        var items = o.Items.Select(i => new LabOrderItemDto
        {
            Id = i.Id,
            LabOrderId = i.LabOrderId,
            LabTestId = i.LabTestId,
            LabTestCode = i.LabTest?.Code ?? string.Empty,
            LabTestName = i.LabTest?.Name ?? string.Empty,
            Category = i.LabTest?.Category ?? string.Empty,
            SpecimenType = i.LabTest?.SpecimenType ?? string.Empty,
            Price = i.LabTest?.Price ?? 0m,
            SpecimenBarcode = i.SpecimenBarcode,
            SpecimenCollectedAt = i.SpecimenCollectedAt,
            ResultValue = i.ResultValue,
            ResultUnit = i.ResultUnit,
            ReferenceRangeSnapshot = i.ReferenceRangeSnapshot,
            IsAbnormal = i.IsAbnormal,
            Comments = i.Comments,
            EnteredByUserId = i.EnteredByUserId,
            EnteredByUserName = i.EnteredByUser?.FullName,
            VerifiedByUserId = i.VerifiedByUserId,
            VerifiedByUserName = i.VerifiedByUser?.FullName,
            VerifiedAt = i.VerifiedAt,
            CreatedAt = i.CreatedAt,
            UpdatedAt = i.UpdatedAt
        }).ToList();

        return new LabOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            EncounterId = o.EncounterId,
            PatientId = o.PatientId,
            PatientNumber = o.Patient?.PatientNumber ?? string.Empty,
            PatientName = o.Patient != null ? $"{o.Patient.FirstName} {o.Patient.LastName}".Trim() : string.Empty,
            PatientDateOfBirth = o.Patient?.DateOfBirth ?? DateTime.MinValue,
            PatientGender = o.Patient?.Gender ?? string.Empty,
            OrderedByDoctorId = o.OrderedByDoctorId,
            DoctorName = o.OrderedByDoctor?.User?.FullName ?? string.Empty,
            DoctorDepartment = o.OrderedByDoctor?.Department?.Name ?? string.Empty,
            Priority = o.Priority,
            Status = o.Status,
            TotalPrice = items.Sum(i => i.Price),
            CreatedAt = o.CreatedAt,
            UpdatedAt = o.UpdatedAt,
            Items = items
        };
    }
}
