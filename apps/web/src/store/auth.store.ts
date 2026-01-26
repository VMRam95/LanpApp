import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthResponse } from '@lanpapp/shared';
import { api, ApiError } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    username: string;
    display_name?: string;
  }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: User) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      fieldErrors: {},

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null, fieldErrors: {} });
          const response = await api.post<{ data: AuthResponse }>('/auth/login', {
            email,
            password,
          });
          const { user, session } = response.data.data;

          set({
            user,
            token: session.access_token,
            refreshToken: session.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });

          api.defaults.headers.common['Authorization'] =
            `Bearer ${session.access_token}`;
        } catch (error) {
          if (error instanceof ApiError) {
            set({
              error: error.message,
              fieldErrors: error.getFieldErrors(),
              isLoading: false,
            });
          } else {
            set({
              error: 'Invalid email or password',
              fieldErrors: {},
              isLoading: false,
            });
          }
          throw error;
        }
      },

      register: async (data) => {
        try {
          set({ isLoading: true, error: null, fieldErrors: {} });
          const response = await api.post<{ data: AuthResponse }>('/auth/register', data);
          const { user, session } = response.data.data;

          set({
            user,
            token: session.access_token,
            refreshToken: session.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });

          api.defaults.headers.common['Authorization'] =
            `Bearer ${session.access_token}`;
        } catch (error) {
          if (error instanceof ApiError) {
            set({
              error: error.message,
              fieldErrors: error.getFieldErrors(),
              isLoading: false,
            });
          } else {
            set({
              error: 'Failed to create account',
              fieldErrors: {},
              isLoading: false,
            });
          }
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        delete api.defaults.headers.common['Authorization'];
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await api.get<{ data: User }>('/users/me');
          set({
            user: response.data.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
          delete api.defaults.headers.common['Authorization'];
        }
      },

      updateUser: (user: User) => {
        set({ user });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null, fieldErrors: {} });
      },
    }),
    {
      name: 'lanpapp-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
