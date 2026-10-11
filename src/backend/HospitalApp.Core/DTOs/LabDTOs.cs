using HospitalApp.Core.Enums;

namespace HospitalApp.Core.DTOs;

public class LabTestDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string SpecimenType { get; set; } = string.Empty;
    public string? UnitOfMeasure { get; set; }
    public string? ReferenceRange { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateLabTestRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string SpecimenType { get; set; } = string.Empty;
    public string? UnitOfMeasure { get; set; }
    public string? ReferenceRange { get; set; }
    public decimal Price { get; set; } = 0m;
}

public class UpdateLabTestRequest
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string SpecimenType { get; set; } = string.Empty;
    public string? UnitOfMeasure { get; set; }
    public string? ReferenceRange { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
}

public class LabOrderItemDto
{
    public Guid Id { get; set; }
    public Guid LabOrderId { get; set; }
    public Guid LabTestId { get; set; }
    public string LabTestCode { get; set; } = string.Empty;
    public string LabTestName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string SpecimenType { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? SpecimenBarcode { get; set; }
    public DateTime? SpecimenCollectedAt { get; set; }
    public string? ResultValue { get; set; }
    public string? ResultUnit { get; set; }
    public string? ReferenceRangeSnapshot { get; set; }
    public bool IsAbnormal { get; set; }
    public string? Comments { get; set; }
    public Guid? EnteredByUserId { get; set; }
    public string? EnteredByUserName { get; set; }
    public Guid? VerifiedByUserId { get; set; }
    public string? VerifiedByUserName { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class LabOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public string PatientNumber { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public DateTime PatientDateOfBirth { get; set; }
    public string PatientGender { get; set; } = string.Empty;
    public Guid OrderedByDoctorId { get; set; }
    public string DoctorName { get; set; } = string.Empty;
    public string DoctorDepartment { get; set; } = string.Empty;
    public LabPriority Priority { get; set; }
    public LabOrderStatus Status { get; set; }
    public decimal TotalPrice { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<LabOrderItemDto> Items { get; set; } = new();
}

public class CreateLabOrderRequest
{
    public Guid EncounterId { get; set; }
    public LabPriority Priority { get; set; } = LabPriority.Routine;
    public List<Guid> TestIds { get; set; } = new();
}

public class CollectSpecimenRequest
{
    public List<CollectSpecimenItemRequest> Items { get; set; } = new();
}

public class CollectSpecimenItemRequest
{
    public Guid LabOrderItemId { get; set; }
    public string? CustomBarcode { get; set; }
}

public class RecordLabResultsRequest
{
    public List<RecordLabResultItemRequest> Results { get; set; } = new();
}

public class RecordLabResultItemRequest
{
    public Guid LabOrderItemId { get; set; }
    public string ResultValue { get; set; } = string.Empty;
    public string? ResultUnit { get; set; }
    public bool IsAbnormal { get; set; }
    public string? Comments { get; set; }
}

public class VerifyLabResultsRequest
{
    public bool ReleaseImmediately { get; set; } = true;
    public string? VerificationNotes { get; set; }
}

public class CancelLabOrderRequest
{
    public string Reason { get; set; } = string.Empty;
}

public class LabOrderFilterDto
{
    public Guid? EncounterId { get; set; }
    public Guid? PatientId { get; set; }
    public LabOrderStatus? Status { get; set; }
    public LabPriority? Priority { get; set; }
    public DateTime? Date { get; set; }
    public string? Query { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}
