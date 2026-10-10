namespace HospitalApp.Core.Entities;

public class ClinicalNote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EncounterId { get; set; }
    public string ChiefComplaint { get; set; } = string.Empty;
    public string? HistoryOfPresentIllness { get; set; }
    public string? ExaminationFindings { get; set; }
    public string? Assessment { get; set; }
    public string? TreatmentPlan { get; set; }
    public int Version { get; set; } = 1;
    public bool IsFinalized { get; set; } = false;
    public Guid? SupersedesNoteId { get; set; }
    public string? AmendmentReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Encounter Encounter { get; set; } = null!;
    public ClinicalNote? SupersedesNote { get; set; }
}
