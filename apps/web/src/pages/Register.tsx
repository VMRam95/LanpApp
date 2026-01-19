import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/auth.store';

export function Register() {
  const { t } = useTranslation();
  const { register, error, clearError } = useAuth();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    display_name: '',
    password: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    clearError();

    if (formData.password !== formData.confirmPassword) {
      setValidationError(t('auth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        email: formData.email,
        username: formData.username,
        display_name: formData.display_name || undefined,
        password: formData.password,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient">LanpApp</h1>
          <p className="mt-2 text-gray-600">
            Organize your LAN parties with ease
          </p>
        </div>

        <Card padding="lg">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
            {t('auth.register')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <Input
              label={t('auth.username')}
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="johndoe"
              required
              autoComplete="username"
            />

            <Input
              label={t('auth.displayName')}
              type="text"
              name="display_name"
              value={formData.display_name}
              onChange={handleChange}
              placeholder="John Doe"
              autoComplete="name"
            />

            <Input
              label={t('auth.password')}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="********"
              required
              autoComplete="new-password"
            />

            <Input
              label={t('auth.confirmPassword')}
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="********"
              required
              autoComplete="new-password"
            />

            {(error || validationError) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">
                  {validationError || t('auth.registerError')}
                </p>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
              className="mt-6"
            >
              {t('auth.register')}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              {t('auth.hasAccount')}{' '}
              <Link
                to="/login"
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                {t('auth.login')}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
