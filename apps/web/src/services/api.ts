import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Field-level error from API validation
export interface FieldError {
  field: string;
  message: string;
}

// API error response structure
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: FieldError[];
}

// Custom error class that preserves field-level errors
export class ApiError extends Error {
  public statusCode: number;
  public details?: FieldError[];

  constructor(response: ApiErrorResponse) {
    super(response.message);
    this.name = 'ApiError';
    this.statusCode = response.statusCode;
    this.details = response.details;
  }

  getFieldErrors(): Record<string, string> {
    if (!this.details) return {};
    return this.details.reduce(
      (acc, { field, message }) => {
        acc[field] = message;
        return acc;
      },
      {} as Record<string, string>
    );
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is set by auth store when logging in
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest) {
      // Try to refresh token
      const refreshToken = localStorage.getItem('lanpapp-auth')
        ? JSON.parse(localStorage.getItem('lanpapp-auth')!).state?.refreshToken
        : null;

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data.session;

          // Update stored tokens
          const authState = JSON.parse(
            localStorage.getItem('lanpapp-auth') || '{}'
          );
          authState.state.token = access_token;
          authState.state.refreshToken = refresh_token;
          localStorage.setItem('lanpapp-auth', JSON.stringify(authState));

          // Retry original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
          api.defaults.headers.common['Authorization'] =
            `Bearer ${access_token}`;

          return api(originalRequest);
        } catch {
          // Refresh failed, clear auth state
          localStorage.removeItem('lanpapp-auth');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    // Preserve field-level errors from API
    const apiError = error.response?.data;
    if (apiError && typeof apiError === 'object' && 'message' in apiError) {
      return Promise.reject(
        new ApiError({
          error: apiError.error || 'Error',
          message: apiError.message,
          statusCode: error.response?.status || 500,
          details: apiError.details,
        })
      );
    }

    return Promise.reject(new Error(error.message || 'An unexpected error occurred'));
  }
);

// Type-safe API methods
export const apiService = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    api.get<T>(url, { params }),

  post: <T>(url: string, data?: unknown) => api.post<T>(url, data),

  put: <T>(url: string, data?: unknown) => api.put<T>(url, data),

  patch: <T>(url: string, data?: unknown) => api.patch<T>(url, data),

  delete: <T>(url: string) => api.delete<T>(url),
};

export default api;
