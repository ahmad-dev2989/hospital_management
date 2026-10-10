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
}

export const api = new ApiClient();
