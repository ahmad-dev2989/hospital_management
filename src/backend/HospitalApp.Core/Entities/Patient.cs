namespace HospitalApp.Core.Entities;

public class Patient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string PatientNumber { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? BloodGroup { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? EmergencyContactName { get; set; }
    public string? EmergencyContactPhone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Appointment> Appointments { get; set; } = new List<Appointment>();
    public ICollection<Encounter> Encounters { get; set; } = new List<Encounter>();
    public ICollection<PatientAllergy> Allergies { get; set; } = new List<PatientAllergy>();
    public ICollection<PatientCondition> Conditions { get; set; } = new List<PatientCondition>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<DocumentMetadata> Documents { get; set; } = new List<DocumentMetadata>();
}
