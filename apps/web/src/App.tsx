import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { Lanpas } from './pages/Lanpas';
import { LanpaDetail } from './pages/LanpaDetail';
import { JoinLanpa } from './pages/JoinLanpa';
import { Games } from './pages/Games';
import { GameDetail } from './pages/GameDetail';
import { Punishments } from './pages/Punishments';
import { Stats } from './pages/Stats';
import { NotFound } from './pages/NotFound';
import { useAuthStore } from './store/auth.store';

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="lanpas" element={<Lanpas />} />
        <Route path="lanpas/join/:token" element={<JoinLanpa />} />
        <Route path="lanpas/:id" element={<LanpaDetail />} />
        <Route path="games" element={<Games />} />
        <Route path="games/:id" element={<GameDetail />} />
        <Route path="punishments" element={<Punishments />} />
        <Route path="stats" element={<Stats />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
