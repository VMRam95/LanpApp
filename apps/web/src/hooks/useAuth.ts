import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export function useAuth() {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    register: storeRegister,
    logout: storeLogout,
    updateUser,
    clearError,
  } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        await storeLogin(email, password);
        navigate('/dashboard');
      } catch {
        // Error is handled in store
      }
    },
    [storeLogin, navigate]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      username: string;
      display_name?: string;
    }) => {
      try {
        await storeRegister(data);
        navigate('/dashboard');
      } catch {
        // Error is handled in store
      }
    },
    [storeRegister, navigate]
  );

  const logout = useCallback(() => {
    storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };
}
