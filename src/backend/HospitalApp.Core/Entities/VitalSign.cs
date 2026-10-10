namespace HospitalApp.Core.Entities;

public class VitalSign
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EncounterId { get; set; }
    public Guid PatientId { get; set; }
    public Guid RecordedByUserId { get; set; }
    public int? SystolicBp { get; set; }
    public int? DiastolicBp { get; set; }
    public int? HeartRateBpm { get; set; }
    public int? RespiratoryRateBpm { get; set; }
    public decimal? TemperatureCelsius { get; set; }
    public decimal? OxygenSaturationPct { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Encounter Encounter { get; set; } = null!;
    public Patient Patient { get; set; } = null!;
    public UserAccount RecordedByUser { get; set; } = null!;
}
