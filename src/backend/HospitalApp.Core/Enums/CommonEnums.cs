namespace HospitalApp.Core.Enums;

public enum UserRole
{
    SystemAdministrator = 0,
    HospitalAdministrator = 1,
    Receptionist = 2,
    Doctor = 3,
    Nurse = 4,
    LabTechnician = 5,
    Pharmacist = 6,
    Cashier = 7,
    Auditor = 8
}

public enum AppointmentStatus
{
    Booked = 0,
    Confirmed = 1,
    Arrived = 2,
    Waiting = 3,
    InConsultation = 4,
    Completed = 5,
    Cancelled = 6,
    NoShow = 7,
    ReschedulePending = 8
}

public enum EncounterStatus
{
    Open = 0,
    InProgress = 1,
    Draft = 2,
    Signed = 3,
    Closed = 4,
    AmendedByAddendum = 5
}

public enum PrescriptionStatus
{
    Draft = 0,
    Signed = 1,
    PartiallyDispensed = 2,
    Dispensed = 3,
    Cancelled = 4,
    Expired = 5
}

public enum LabOrderStatus
{
    Ordered = 0,
    Collected = 1,
    Received = 2,
    Processing = 3,
    DraftResult = 4,
    Verified = 5,
    Released = 6,
    Corrected = 7,
    Cancelled = 8,
    Rejected = 9
}

public enum LabPriority
{
    Routine = 0,
    Urgent = 1,
    Stat = 2
}

public enum InventoryBatchStatus
{
    Available = 0,
    Quarantined = 1,
    Expired = 2,
    Recalled = 3,
    Depleted = 4
}

public enum StockMovementType
{
    Initial = 0,
    PurchaseReceived = 1,
    Dispensed = 2,
    ReturnToStock = 3,
    AdjustmentIncrease = 4,
    AdjustmentDecrease = 5,
    ExpiredWastage = 6,
    Damaged = 7
}

public enum InvoiceStatus
{
    Draft = 0,
    Issued = 1,
    PartiallyPaid = 2,
    Paid = 3,
    Voided = 4,
    RefundedPartially = 5,
    RefundedFully = 6
}

public enum PaymentMethod
{
    Cash = 0,
    CreditCard = 1,
    DebitCard = 2,
    BankTransfer = 3,
    MobilePayment = 4,
    InsuranceCoPay = 5
}

public enum DocumentCategory
{
    General = 0,
    LabReport = 1,
    Prescription = 2,
    Scan = 3,
    Referral = 4,
    Identity = 5
}

public enum AllergySeverity
{
    Mild = 0,
    Moderate = 1,
    Severe = 2,
    LifeThreatening = 3
}
