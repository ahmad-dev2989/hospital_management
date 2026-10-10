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
          errorData = { error: { code: 'HTTP_ERROR', message: response.statusText } };
        }

        const err: ApiError = errorData?.error || {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'Unknown network error',
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

  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async getDatabaseHealth(): Promise<DatabaseHealthStatus> {
    return this.request<DatabaseHealthStatus>('/health/db');
  }
}

export const api = new ApiClient();
