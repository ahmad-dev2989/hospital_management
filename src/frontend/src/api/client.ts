export const API_BASE_URL = 'http://127.0.0.1:5000/api/v1';

export interface ApiError {
  code: string;
  message: string;
  field_errors?: string[];
  request_id?: string;
  timestamp?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  status: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  mode: string;
  timestamp: string;
}

export interface DatabaseHealthStatus {
  status: string;
  database: string;
  connected: boolean;
  stats?: {
    users: number;
    departments: number;
    patients: number;
  };
  error?: string;
  timestamp: string;
}

export type UserRole =
  | 'SystemAdministrator'
  | 'HospitalAdministrator'
  | 'Receptionist'
  | 'Doctor'
  | 'Nurse'
  | 'LabTechnician'
  | 'Pharmacist'
  | 'Cashier'
  | 'Auditor';

export interface UserDto {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: number;
  roleName: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface AuditEventDto {
  id: string;
  actorUserId: string | null;
  actorUsername: string;
  action: string;
  entityName: string;
  entityId: string;
  details: string | null;
  ipAddress: string;
  timestamp: string;
}

export interface PagedResult<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface CreateUserRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: number;
}

export interface UpdateUserRequest {
  email: string;
  fullName: string;
  role: number;
  isActive: boolean;
}

// Patient Management Interfaces
export type AllergySeverity = 0 | 1 | 2 | 3; // 0=Mild, 1=Moderate, 2=Severe, 3=LifeThreatening

export interface PatientDto {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  bloodGroup: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  isActive: boolean;
  allergiesCount: number;
  hasHighRiskAllergy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bypassDuplicateWarning?: boolean;
}

export interface UpdatePatientRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface DuplicateMatchDto {
  patientId: string;
  patientNumber: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  matchReason: string;
  confidenceScore: 'High' | 'Medium';
}

export interface CheckDuplicateResponse {
  hasPotentialDuplicates: boolean;
  matches: DuplicateMatchDto[];
}

export interface PatientAllergyDto {
  id: string;
  patientId: string;
  allergen: string;
  reaction: string;
  severity: AllergySeverity;
  severityName: string;
  recordedAt: string;
}

export interface AddAllergyRequest {
  allergen: string;
  reaction: string;
  severity: AllergySeverity;
}

export interface PatientConditionDto {
  id: string;
  patientId: string;
  conditionName: string;
  status: string;
  diagnosedDate: string | null;
  createdAt: string;
}

export interface AddConditionRequest {
  conditionName: string;
  status?: string;
  diagnosedDate?: string | null;
}

export interface PatientEncounterSummaryDto {
  id: string;
  encounterDate: string;
  status: string;
  chiefComplaint: string | null;
  doctorName: string;
  departmentName: string;
}

export interface PatientVitalSignSummaryDto {
  id: string;
  recordedAt: string;
  bloodPressure: string;
  heartRate: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
}

export interface PatientChartDto {
  demographics: PatientDto;
  allergies: PatientAllergyDto[];
  conditions: PatientConditionDto[];
  recentEncounters: PatientEncounterSummaryDto[];
  recentVitals: PatientVitalSignSummaryDto[];
  totalAppointments: number;
  totalInvoices: number;
  outstandingBalance: number;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('hms_auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('hms_auth_token', token);
    } else {
      localStorage.removeItem('hms_auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any = null;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: { code: `HTTP_${response.status}`, message: response.statusText } };
        }

        const err: ApiError = errorData?.error || {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'Unknown request error',
        };
        throw err;
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error: any) {
      if (error?.code) {
        throw error;
      }
      throw {
        code: 'NETWORK_DISCONNECTED',
        message: 'Could not connect to the local hospital backend service (127.0.0.1:5000). Ensure the service is running.',
      } as ApiError;
    }
  }

  // Diagnostics
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getDatabaseHealth(): Promise<DatabaseHealthStatus> {
    return this.request<DatabaseHealthStatus>('/health/db');
  }

  // Authentication
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async getCurrentUser(): Promise<UserDto> {
    return this.request<UserDto>('/auth/me');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignored if token expired or disconnected
    } finally {
      this.setToken(null);
    }
  }

  // User Administration
  async getUsers(params: { search?: string; role?: number; isActive?: boolean; page?: number; pageSize?: number } = {}): Promise<PagedResult<UserDto>> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.role !== undefined) query.append('role', params.role.toString());
    if (params.isActive !== undefined) query.append('isActive', params.isActive.toString());
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<PagedResult<UserDto>>(`/users${qs}`);
  }

  async createUser(data: CreateUserRequest): Promise<UserDto> {
    return this.request<UserDto>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<UserDto> {
    return this.request<UserDto>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async resetPassword(id: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async toggleUserActive(id: string): Promise<{ isActive: boolean; message: string }> {
    return this.request<{ isActive: boolean; message: string }>(`/users/${id}/toggle-active`, {
      method: 'POST',
    });
  }

  // Audit Logs
  async getAuditEvents(params: {
    action?: string;
    entityName?: string;
    actorUsername?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<PagedResult<AuditEventDto>> {
    const query = new URLSearchParams();
    if (params.action) query.append('action', params.action);
    if (params.entityName) query.append('entityName', params.entityName);
    if (params.actorUsername) query.append('actorUsername', params.actorUsername);
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<PagedResult<AuditEventDto>>(`/audit${qs}`);
  }

  // Patient Management (Module B)
  async getPatients(params: { query?: string; gender?: string; isActive?: boolean; page?: number; pageSize?: number } = {}): Promise<PagedResult<PatientDto>> {
    const query = new URLSearchParams();
    if (params.query) query.append('search', params.query);
    if (params.gender) query.append('gender', params.gender);
    if (params.isActive !== undefined) query.append('isActive', params.isActive.toString());
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<PagedResult<PatientDto>>(`/patients${qs}`);
  }

  async getPatientById(id: string): Promise<PatientDto> {
    return this.request<PatientDto>(`/patients/${id}`);
  }

  async checkDuplicates(data: CreatePatientRequest): Promise<CheckDuplicateResponse> {
    return this.request<CheckDuplicateResponse>('/patients/check-duplicates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPatient(data: CreatePatientRequest): Promise<PatientDto> {
    return this.request<PatientDto>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePatient(id: string, data: UpdatePatientRequest): Promise<PatientDto> {
    return this.request<PatientDto>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async togglePatientActive(id: string): Promise<{ isActive: boolean; message: string }> {
    return this.request<{ isActive: boolean; message: string }>(`/patients/${id}/toggle-active`, {
      method: 'POST',
    });
  }

  async getPatientChart(id: string): Promise<PatientChartDto> {
    return this.request<PatientChartDto>(`/patients/${id}/chart`);
  }

  async addAllergy(patientId: string, data: AddAllergyRequest): Promise<PatientAllergyDto> {
    return this.request<PatientAllergyDto>(`/patients/${patientId}/allergies`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeAllergy(patientId: string, allergyId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/patients/${patientId}/allergies/${allergyId}`, {
      method: 'DELETE',
    });
  }

  async addCondition(patientId: string, data: AddConditionRequest): Promise<PatientConditionDto> {
    return this.request<PatientConditionDto>(`/patients/${patientId}/conditions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeCondition(patientId: string, conditionId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/patients/${patientId}/conditions/${conditionId}`, {
      method: 'DELETE',
    });
  }

  // Doctor & Department methods
  async getDoctors(departmentId?: string, activeOnly: boolean = true): Promise<DoctorDto[]> {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);
    params.append('activeOnly', activeOnly.toString());
    return this.request<DoctorDto[]>(`/doctors?${params.toString()}`);
  }

  async getDoctorById(id: string): Promise<DoctorDto> {
    return this.request<DoctorDto>(`/doctors/${id}`);
  }

  async getDoctorSlots(doctorId: string, date: string): Promise<TimeSlotDto[]> {
    return this.request<TimeSlotDto[]>(`/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`);
  }

  async getDepartments(): Promise<DepartmentDto[]> {
    return this.request<DepartmentDto[]>('/doctors/departments');
  }

  // Appointment methods
  async getAppointments(params?: {
    date?: string;
    doctorId?: string;
    departmentId?: string;
    status?: AppointmentStatus;
    query?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<AppointmentDto>> {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.append('date', params.date);
    if (params?.doctorId) searchParams.append('doctorId', params.doctorId);
    if (params?.departmentId) searchParams.append('departmentId', params.departmentId);
    if (params?.status !== undefined) searchParams.append('status', params.status.toString());
    if (params?.query) searchParams.append('query', params.query);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const qs = searchParams.toString();
    return this.request<PagedResult<AppointmentDto>>(`/appointments${qs ? `?${qs}` : ''}`);
  }

  async getAppointmentById(id: string): Promise<AppointmentDto> {
    return this.request<AppointmentDto>(`/appointments/${id}`);
  }

  async bookAppointment(data: BookAppointmentRequest): Promise<AppointmentDto> {
    return this.request<AppointmentDto>('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkInAppointment(id: string): Promise<AppointmentDto> {
    return this.request<AppointmentDto>(`/appointments/${id}/check-in`, {
      method: 'POST',
    });
  }

  async updateAppointmentStatus(id: string, status: AppointmentStatus, note?: string): Promise<AppointmentDto> {
    return this.request<AppointmentDto>(`/appointments/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
  }

  async rescheduleAppointment(id: string, data: RescheduleAppointmentRequest): Promise<AppointmentDto> {
    return this.request<AppointmentDto>(`/appointments/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelAppointment(id: string, reason: string): Promise<AppointmentDto> {
    return this.request<AppointmentDto>(`/appointments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getQueueSummary(date?: string, doctorId?: string): Promise<AppointmentQueueSummaryDto> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (doctorId) params.append('doctorId', doctorId);
    const qs = params.toString();
    return this.request<AppointmentQueueSummaryDto>(`/appointments/queue-summary${qs ? `?${qs}` : ''}`);
  }

  // Clinical Encounters & Notes methods
  async getEncounters(params?: {
    date?: string;
    doctorId?: string;
    patientId?: string;
    status?: EncounterStatus;
    query?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<EncounterDto>> {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.append('date', params.date);
    if (params?.doctorId) searchParams.append('doctorId', params.doctorId);
    if (params?.patientId) searchParams.append('patientId', params.patientId);
    if (params?.status !== undefined) searchParams.append('status', params.status.toString());
    if (params?.query) searchParams.append('query', params.query);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());
    const qs = searchParams.toString();
    return this.request<PagedResult<EncounterDto>>(`/clinical/encounters${qs ? `?${qs}` : ''}`);
  }

  async getEncounterById(id: string): Promise<EncounterDto> {
    return this.request<EncounterDto>(`/clinical/encounters/${id}`);
  }

  async startEncounter(data: StartEncounterRequest): Promise<EncounterDto> {
    return this.request<EncounterDto>('/clinical/encounters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveClinicalNote(encounterId: string, data: SaveClinicalNoteRequest): Promise<ClinicalNoteDto> {
    return this.request<ClinicalNoteDto>(`/clinical/encounters/${encounterId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addNoteAddendum(encounterId: string, data: AddNoteAddendumRequest): Promise<ClinicalNoteDto> {
    return this.request<ClinicalNoteDto>(`/clinical/encounters/${encounterId}/notes/addendum`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordVitalSigns(encounterId: string, data: RecordVitalSignsRequest): Promise<VitalSignDto> {
    return this.request<VitalSignDto>(`/clinical/encounters/${encounterId}/vitals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addDiagnosis(encounterId: string, data: AddDiagnosisRequest): Promise<DiagnosisDto> {
    return this.request<DiagnosisDto>(`/clinical/encounters/${encounterId}/diagnoses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeDiagnosis(encounterId: string, diagnosisId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/clinical/encounters/${encounterId}/diagnoses/${diagnosisId}`, {
      method: 'DELETE',
    });
  }

  async createPrescription(encounterId: string, data: CreatePrescriptionRequest): Promise<PrescriptionDto> {
    return this.request<PrescriptionDto>(`/clinical/encounters/${encounterId}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async signAndCloseEncounter(encounterId: string): Promise<EncounterDto> {
    return this.request<EncounterDto>(`/clinical/encounters/${encounterId}/sign`, {
      method: 'POST',
    });
  }

  async getIcd10Catalog(search?: string): Promise<Icd10CatalogItemDto[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const qs = params.toString();
    return this.request<Icd10CatalogItemDto[]>(`/clinical/icd10-catalog${qs ? `?${qs}` : ''}`);
  }

  async getFormularyDrugs(): Promise<DrugDto[]> {
    return this.request<DrugDto[]>('/clinical/drugs');
  }

  // Laboratory Management (Module E)
  async getLabTests(category?: string, activeOnly = true): Promise<LabTestDto[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    params.append('activeOnly', activeOnly.toString());
    const qs = params.toString();
    return this.request<LabTestDto[]>(`/lab/tests${qs ? `?${qs}` : ''}`);
  }

  async getLabTestById(id: string): Promise<LabTestDto> {
    return this.request<LabTestDto>(`/lab/tests/${id}`);
  }

  async createLabTest(data: CreateLabTestRequest): Promise<LabTestDto> {
    return this.request<LabTestDto>('/lab/tests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLabTest(id: string, data: UpdateLabTestRequest): Promise<LabTestDto> {
    return this.request<LabTestDto>(`/lab/tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getLabOrders(params?: {
    encounterId?: string;
    patientId?: string;
    status?: LabOrderStatus;
    priority?: LabPriority;
    date?: string;
    query?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<LabOrderDto>> {
    const searchParams = new URLSearchParams();
    if (params?.encounterId) searchParams.append('encounterId', params.encounterId);
    if (params?.patientId) searchParams.append('patientId', params.patientId);
    if (params?.status !== undefined) searchParams.append('status', params.status.toString());
    if (params?.priority !== undefined) searchParams.append('priority', params.priority.toString());
    if (params?.date) searchParams.append('date', params.date);
    if (params?.query) searchParams.append('query', params.query);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const qs = searchParams.toString();
    return this.request<PagedResult<LabOrderDto>>(`/lab/orders${qs ? `?${qs}` : ''}`);
  }

  async getLabOrderById(id: string): Promise<LabOrderDto> {
    return this.request<LabOrderDto>(`/lab/orders/${id}`);
  }

  async getLabOrdersByEncounter(encounterId: string): Promise<LabOrderDto[]> {
    return this.request<LabOrderDto[]>(`/lab/orders/encounter/${encounterId}`);
  }

  async createLabOrder(data: CreateLabOrderRequest): Promise<LabOrderDto> {
    return this.request<LabOrderDto>('/lab/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async collectSpecimen(id: string, data?: CollectSpecimenRequest): Promise<LabOrderDto> {
    return this.request<LabOrderDto>(`/lab/orders/${id}/collect`, {
      method: 'POST',
      body: JSON.stringify(data || { items: [] }),
    });
  }

  async receiveSpecimen(id: string): Promise<LabOrderDto> {
    return this.request<LabOrderDto>(`/lab/orders/${id}/receive`, {
      method: 'POST',
    });
  }

  async recordLabResults(id: string, data: RecordLabResultsRequest): Promise<LabOrderDto> {
    return this.request<LabOrderDto>(`/lab/orders/${id}/results`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyAndReleaseOrder(id: string, data?: VerifyLabResultsRequest): Promise<LabOrderDto> {
    return this.request<LabOrderDto>(`/lab/orders/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(data || { releaseImmediately: true }),
    });
  }

  async cancelLabOrder(id: string, reason: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/lab/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Pharmacy & Inventory Management (Module F)
  async getPharmacyMetrics(): Promise<PharmacyDashboardMetricsDto> {
    return this.request<PharmacyDashboardMetricsDto>('/pharmacy/metrics');
  }

  async getExpiringBatches(daysThreshold = 30): Promise<InventoryBatchDto[]> {
    return this.request<InventoryBatchDto[]>(`/pharmacy/alerts/expiring?daysThreshold=${daysThreshold}`);
  }

  async getLowStockDrugs(): Promise<PharmacyDrugDto[]> {
    return this.request<PharmacyDrugDto[]>('/pharmacy/alerts/low-stock');
  }

  async getPharmacyDrugs(query?: string, activeOnly = true): Promise<PharmacyDrugDto[]> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    params.append('activeOnly', activeOnly.toString());
    const qs = params.toString();
    return this.request<PharmacyDrugDto[]>(`/pharmacy/drugs${qs ? `?${qs}` : ''}`);
  }

  async getPharmacyDrugById(id: string): Promise<PharmacyDrugDto> {
    return this.request<PharmacyDrugDto>(`/pharmacy/drugs/${id}`);
  }

  async createPharmacyDrug(data: CreateDrugRequest): Promise<PharmacyDrugDto> {
    return this.request<PharmacyDrugDto>('/pharmacy/drugs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePharmacyDrug(id: string, data: UpdateDrugRequest): Promise<PharmacyDrugDto> {
    return this.request<PharmacyDrugDto>(`/pharmacy/drugs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getBatches(drugId?: string, availableOnly = false): Promise<InventoryBatchDto[]> {
    const params = new URLSearchParams();
    if (drugId) params.append('drugId', drugId);
    if (availableOnly) params.append('availableOnly', 'true');
    const qs = params.toString();
    return this.request<InventoryBatchDto[]>(`/pharmacy/batches${qs ? `?${qs}` : ''}`);
  }

  async receiveBatch(data: ReceiveBatchRequest): Promise<InventoryBatchDto> {
    return this.request<InventoryBatchDto>('/pharmacy/batches/receive', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async adjustStock(data: AdjustStockRequest): Promise<InventoryBatchDto> {
    return this.request<InventoryBatchDto>('/pharmacy/batches/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStockMovements(params?: {
    batchId?: string;
    drugId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<StockMovementDto>> {
    const searchParams = new URLSearchParams();
    if (params?.batchId) searchParams.append('batchId', params.batchId);
    if (params?.drugId) searchParams.append('drugId', params.drugId);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.pageSize) searchParams.append('pageSize', params.pageSize.toString());

    const qs = searchParams.toString();
    return this.request<PagedResult<StockMovementDto>>(`/pharmacy/stock-movements${qs ? `?${qs}` : ''}`);
  }

  async getPrescriptionQueue(params?: {
    status?: PrescriptionStatus;
    query?: string;
  }): Promise<PrescriptionQueueItemDto[]> {
    const searchParams = new URLSearchParams();
    if (params?.status !== undefined) searchParams.append('status', params.status.toString());
    if (params?.query) searchParams.append('query', params.query);

    const qs = searchParams.toString();
    return this.request<PrescriptionQueueItemDto[]>(`/pharmacy/prescriptions/queue${qs ? `?${qs}` : ''}`);
  }

  async getPrescriptionDispenseDetails(id: string): Promise<PrescriptionQueueItemDto> {
    return this.request<PrescriptionQueueItemDto>(`/pharmacy/prescriptions/${id}/dispense-details`);
  }

  async dispensePrescription(id: string, data: DispensePrescriptionRequest): Promise<DispenseRecordDto> {
    return this.request<DispenseRecordDto>(`/pharmacy/prescriptions/${id}/dispense`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// Module C (Appointments & Scheduling) Interfaces
export type AppointmentStatus =
  | 0 // Booked
  | 1 // Confirmed
  | 2 // Arrived
  | 3 // Waiting
  | 4 // InConsultation
  | 5 // Completed
  | 6 // Cancelled
  | 7 // NoShow
  | 8; // ReschedulePending

export const APPOINTMENT_STATUS_NAMES: Record<AppointmentStatus, string> = {
  0: 'Booked',
  1: 'Confirmed',
  2: 'Arrived',
  3: 'Waiting',
  4: 'In Consultation',
  5: 'Completed',
  6: 'Cancelled',
  7: 'No-Show',
  8: 'Reschedule Pending',
};

export interface DoctorScheduleDto {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
}

export interface DoctorDto {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  licenseNumber: string;
  specialization: string;
  consultationFee: number;
  isActive: boolean;
  schedules: DoctorScheduleDto[];
}

export interface TimeSlotDto {
  startsAt: string;
  endsAt: string;
  timeDisplay: string;
  isAvailable: boolean;
  appointmentId?: string | null;
  appointmentNumber?: string | null;
  patientName?: string | null;
  status?: AppointmentStatus | null;
}

export interface AppointmentDto {
  id: string;
  appointmentNumber: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  specialization: string;
  departmentId: string;
  departmentName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  statusName: string;
  reason?: string | null;
  cancellationReason?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface BookAppointmentRequest {
  patientId: string;
  doctorId: string;
  departmentId?: string;
  startsAt: string;
  endsAt?: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface RescheduleAppointmentRequest {
  newStartsAt: string;
  newEndsAt?: string;
  reason?: string;
}

export interface CancelAppointmentRequest {
  reason: string;
}

export interface AppointmentQueueSummaryDto {
  totalToday: number;
  booked: number;
  waiting: number;
  inConsultation: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface DepartmentDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

// Module D (Clinical Management) Interfaces
export type EncounterStatus =
  | 0 // Open
  | 1 // InProgress
  | 2 // Draft
  | 3 // Signed
  | 4 // Closed
  | 5; // AmendedByAddendum

export const ENCOUNTER_STATUS_NAMES: Record<EncounterStatus, string> = {
  0: 'Open',
  1: 'In Progress',
  2: 'Draft',
  3: 'Signed & Sealed',
  4: 'Closed',
  5: 'Amended by Addendum',
};

export interface ClinicalNoteDto {
  id: string;
  encounterId: string;
  chiefComplaint: string;
  historyOfPresentIllness?: string | null;
  examinationFindings?: string | null;
  assessment?: string | null;
  treatmentPlan?: string | null;
  version: number;
  isFinalized: boolean;
  supersedesNoteId?: string | null;
  amendmentReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveClinicalNoteRequest {
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  examinationFindings?: string;
  assessment?: string;
  treatmentPlan?: string;
}

export interface AddNoteAddendumRequest {
  supersedesNoteId: string;
  amendmentReason: string;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  examinationFindings?: string;
  assessment?: string;
  treatmentPlan?: string;
}

export interface VitalSignDto {
  id: string;
  encounterId: string;
  patientId: string;
  recordedByUserId: string;
  recordedByUserName: string;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRateBpm?: number | null;
  respiratoryRateBpm?: number | null;
  temperatureCelsius?: number | null;
  oxygenSaturationPct?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  bpCategory?: string | null;
  bmi?: number | null;
  bmiCategory?: string | null;
  isAbnormal: boolean;
  abnormalAlerts: string[];
  recordedAt: string;
  createdAt: string;
}

export interface RecordVitalSignsRequest {
  systolicBp?: number;
  diastolicBp?: number;
  heartRateBpm?: number;
  respiratoryRateBpm?: number;
  temperatureCelsius?: number;
  oxygenSaturationPct?: number;
  weightKg?: number;
  heightCm?: number;
}

export interface DiagnosisDto {
  id: string;
  encounterId: string;
  patientId: string;
  icd10Code?: string | null;
  description: string;
  isPrimary: boolean;
  recordedAt: string;
}

export interface AddDiagnosisRequest {
  icd10Code?: string;
  description: string;
  isPrimary: boolean;
}

export interface PrescriptionItemDto {
  id: string;
  prescriptionId: string;
  drugId: string;
  drugName: string;
  drugCode: string;
  dosage: string;
  frequency: string;
  route: string;
  durationDays: number;
  quantityPrescribed: number;
  quantityDispensed: number;
  instructions?: string | null;
}

export interface PrescriptionDto {
  id: string;
  prescriptionNumber: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  signedAt: string;
  status: number;
  statusName: string;
  items: PrescriptionItemDto[];
  createdAt: string;
}

export interface CreatePrescriptionItemRequest {
  drugId: string;
  dosage: string;
  frequency: string;
  route: string;
  durationDays: number;
  quantityPrescribed: number;
  instructions?: string;
}

export interface CreatePrescriptionRequest {
  items: CreatePrescriptionItemRequest[];
}

export interface EncounterDto {
  id: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  patientBloodGroup?: string | null;
  patientHasHighRiskAllergy: boolean;
  patientAllergies: string[];
  appointmentId?: string | null;
  appointmentNumber?: string | null;
  doctorId: string;
  doctorName: string;
  specialization: string;
  departmentName: string;
  startedAt: string;
  endedAt?: string | null;
  status: EncounterStatus;
  statusName: string;
  signedAt?: string | null;
  signedByDoctorId?: string | null;
  signedByDoctorName?: string | null;
  notes: ClinicalNoteDto[];
  vitalSigns: VitalSignDto[];
  diagnoses: DiagnosisDto[];
  prescriptions: PrescriptionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface StartEncounterRequest {
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  chiefComplaint?: string;
}

export interface Icd10CatalogItemDto {
  code: string;
  description: string;
  category: string;
}

export interface DrugDto {
  id: string;
  code: string;
  brandName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  reorderLevel: number;
  isActive: boolean;
}

// Module E (Laboratory Management) Interfaces
export type LabOrderStatus =
  | 0 // Ordered
  | 1 // Collected
  | 2 // Received
  | 3 // Processing
  | 4 // DraftResult
  | 5 // Verified
  | 6 // Released
  | 7 // Corrected
  | 8 // Cancelled
  | 9; // Rejected

export const LAB_ORDER_STATUS_NAMES: Record<LabOrderStatus, string> = {
  0: 'Ordered',
  1: 'Collected',
  2: 'Received',
  3: 'Processing',
  4: 'Draft Result',
  5: 'Verified',
  6: 'Released',
  7: 'Corrected',
  8: 'Cancelled',
  9: 'Rejected',
};

export type LabPriority =
  | 0 // Routine
  | 1 // Urgent
  | 2; // Stat

export const LAB_PRIORITY_NAMES: Record<LabPriority, string> = {
  0: 'Routine',
  1: 'Urgent',
  2: 'Stat',
};

export interface LabTestDto {
  id: string;
  code: string;
  name: string;
  category: string;
  specimenType: string;
  unitOfMeasure?: string | null;
  referenceRange?: string | null;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabTestRequest {
  code: string;
  name: string;
  category: string;
  specimenType: string;
  unitOfMeasure?: string;
  referenceRange?: string;
  price: number;
}

export interface UpdateLabTestRequest {
  name: string;
  category: string;
  specimenType: string;
  unitOfMeasure?: string;
  referenceRange?: string;
  price: number;
  isActive: boolean;
}

export interface LabOrderItemDto {
  id: string;
  labOrderId: string;
  labTestId: string;
  labTestCode: string;
  labTestName: string;
  category: string;
  specimenType: string;
  price: number;
  specimenBarcode?: string | null;
  specimenCollectedAt?: string | null;
  resultValue?: string | null;
  resultUnit?: string | null;
  referenceRangeSnapshot?: string | null;
  isAbnormal: boolean;
  comments?: string | null;
  enteredByUserId?: string | null;
  enteredByUserName?: string | null;
  verifiedByUserId?: string | null;
  verifiedByUserName?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabOrderDto {
  id: string;
  orderNumber: string;
  encounterId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  patientDateOfBirth: string;
  patientGender: string;
  orderedByDoctorId: string;
  doctorName: string;
  doctorDepartment: string;
  priority: LabPriority;
  status: LabOrderStatus;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  items: LabOrderItemDto[];
}

export interface CreateLabOrderRequest {
  encounterId: string;
  priority: LabPriority;
  testIds: string[];
}

export interface CollectSpecimenItemRequest {
  labOrderItemId: string;
  customBarcode?: string;
}

export interface CollectSpecimenRequest {
  items: CollectSpecimenItemRequest[];
}

export interface RecordLabResultItemRequest {
  labOrderItemId: string;
  resultValue: string;
  resultUnit?: string;
  isAbnormal: boolean;
  comments?: string;
}

export interface RecordLabResultsRequest {
  results: RecordLabResultItemRequest[];
}

export interface VerifyLabResultsRequest {
  releaseImmediately: boolean;
  verificationNotes?: string;
}

// Module F (Pharmacy & Inventory) Interfaces
export type PrescriptionStatus =
  | 0 // Draft
  | 1 // Signed
  | 2 // PartiallyDispensed
  | 3 // Dispensed
  | 4 // Cancelled
  | 5; // Expired

export const PRESCRIPTION_STATUS_NAMES: Record<PrescriptionStatus, string> = {
  0: 'Draft',
  1: 'Signed',
  2: 'Partially Dispensed',
  3: 'Dispensed',
  4: 'Cancelled',
  5: 'Expired',
};

export type InventoryBatchStatus =
  | 0 // Available
  | 1 // Quarantined
  | 2 // Expired
  | 3 // Recalled
  | 4; // Depleted

export const INVENTORY_BATCH_STATUS_NAMES: Record<InventoryBatchStatus, string> = {
  0: 'Available',
  1: 'Quarantined',
  2: 'Expired',
  3: 'Recalled',
  4: 'Depleted',
};

export type StockMovementType =
  | 0 // Initial
  | 1 // PurchaseReceived
  | 2 // Dispensed
  | 3 // ReturnToStock
  | 4 // AdjustmentIncrease
  | 5 // AdjustmentDecrease
  | 6 // ExpiredWastage
  | 7; // Damaged

export const STOCK_MOVEMENT_TYPE_NAMES: Record<StockMovementType, string> = {
  0: 'Initial Stock',
  1: 'Purchase Received',
  2: 'Dispensed to Patient',
  3: 'Return to Stock',
  4: 'Adjustment (+)',
  5: 'Adjustment (-)',
  6: 'Expired Wastage',
  7: 'Damaged Wastage',
};

export interface PharmacyDrugDto {
  id: string;
  code: string;
  brandName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  reorderLevel: number;
  totalStockOnHand: number;
  isLowStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  batches: InventoryBatchDto[];
}

export interface CreateDrugRequest {
  code: string;
  brandName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  reorderLevel: number;
}

export interface UpdateDrugRequest {
  brandName: string;
  genericName: string;
  dosageForm: string;
  strength: string;
  reorderLevel: number;
  isActive: boolean;
}

export interface InventoryBatchDto {
  id: string;
  drugId: string;
  drugCode: string;
  drugName: string;
  batchNumber: string;
  expiryDate: string;
  quantityReceived: number;
  quantityOnHand: number;
  unitCost: number;
  sellingPrice: number;
  status: InventoryBatchStatus;
  isExpired: boolean;
  daysUntilExpiry: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiveBatchRequest {
  drugId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
}

export interface AdjustStockRequest {
  batchId: string;
  movementType: StockMovementType;
  quantityDelta: number;
  reason: string;
}

export interface StockMovementDto {
  id: string;
  inventoryBatchId: string;
  batchNumber: string;
  drugName: string;
  movementType: StockMovementType;
  quantityDelta: number;
  balanceAfter: number;
  referenceId: string;
  reason: string;
  performedByUserId: string;
  performedByUserName: string;
  createdAt: string;
}

export interface PrescriptionQueueItemDrugDto {
  prescriptionItemId: string;
  drugId: string;
  drugCode: string;
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;
  durationDays: number;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  instructions?: string | null;
  availableStockOnHand: number;
  suggestedFefoBatches: InventoryBatchDto[];
}

export interface PrescriptionQueueItemDto {
  id: string;
  prescriptionNumber: string;
  encounterId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  patientGender: string;
  patientDateOfBirth: string;
  patientAllergies: string[];
  doctorId: string;
  doctorName: string;
  signedAt: string;
  status: PrescriptionStatus;
  items: PrescriptionQueueItemDrugDto[];
}

export interface DispenseLineRequest {
  prescriptionItemId: string;
  inventoryBatchId?: string;
  quantityToDispense: number;
}

export interface DispensePrescriptionRequest {
  idempotencyKey: string;
  lines: DispenseLineRequest[];
}

export interface DispenseItemDto {
  id: string;
  prescriptionItemId: string;
  drugName: string;
  inventoryBatchId: string;
  batchNumber: string;
  quantity: number;
  unitPriceSnapshot: number;
  totalPrice: number;
}

export interface DispenseRecordDto {
  id: string;
  prescriptionId: string;
  prescriptionNumber: string;
  patientName: string;
  patientNumber: string;
  pharmacistUserId: string;
  pharmacistUserName: string;
  dispensedAt: string;
  idempotencyKey: string;
  totalDispensedPrice: number;
  items: DispenseItemDto[];
}

export interface PharmacyDashboardMetricsDto {
  totalDrugsCount: number;
  lowStockAlertsCount: number;
  expiringBatches30DaysCount: number;
  expiredBatchesCount: number;
  pendingPrescriptionsCount: number;
  dispensedTodayCount: number;
}

export const api = new ApiClient();

