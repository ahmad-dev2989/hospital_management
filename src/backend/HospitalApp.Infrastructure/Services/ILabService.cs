using HospitalApp.Core.DTOs;

namespace HospitalApp.Infrastructure.Services;

public interface ILabService
{
    // Test Catalog
    Task<List<LabTestDto>> GetLabTestsAsync(string? category = null, bool activeOnly = true, CancellationToken cancellationToken = default);
    Task<LabTestDto> GetLabTestByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<LabTestDto> CreateLabTestAsync(CreateLabTestRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<LabTestDto> UpdateLabTestAsync(Guid id, UpdateLabTestRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);

    // Orders
    Task<PagedResult<LabOrderDto>> GetLabOrdersAsync(LabOrderFilterDto filter, CancellationToken cancellationToken = default);
    Task<LabOrderDto> GetLabOrderByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<LabOrderDto>> GetLabOrdersByEncounterIdAsync(Guid encounterId, CancellationToken cancellationToken = default);
    Task<LabOrderDto> CreateLabOrderAsync(CreateLabOrderRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    
    // Workflow Steps
    Task<LabOrderDto> CollectSpecimenAsync(Guid orderId, CollectSpecimenRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<LabOrderDto> ReceiveSpecimenAsync(Guid orderId, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<LabOrderDto> RecordResultsAsync(Guid orderId, RecordLabResultsRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<LabOrderDto> VerifyAndReleaseOrderAsync(Guid orderId, VerifyLabResultsRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<bool> CancelOrderAsync(Guid orderId, CancelLabOrderRequest request, Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
}
