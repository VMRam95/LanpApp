import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { showToast } from '../lib/toast';

export function useAuth() {
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    fieldErrors,
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
      } catch (error) {
        if (error instanceof Error) {
          showToast.error(error.message);
        }
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
      } catch (error) {
        if (error instanceof Error) {
          showToast.error(error.message);
        }
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
    fieldErrors,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };
}
