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
}

export const api = new ApiClient();
