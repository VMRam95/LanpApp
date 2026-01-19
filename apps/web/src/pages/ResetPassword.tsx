import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { api } from '../services/api';

export function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Extract access_token from URL hash (Supabase redirects with #access_token=xxx)
    const hash = location.hash.substring(1); // Remove the #
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');

    if (token) {
      setAccessToken(token);
    } else {
      // Also check query params as fallback
      const searchParams = new URLSearchParams(location.search);
      const queryToken = searchParams.get('access_token');
      if (queryToken) {
        setAccessToken(queryToken);
      } else {
        setError(t('auth.invalidResetLink'));
      }
    }
  }, [location, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (!accessToken) {
      setError(t('auth.invalidResetLink'));
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/auth/reset-password', {
        access_token: accessToken,
        password: formData.password,
      });
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
        <div className="w-full max-w-md">
          <Card padding="lg">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {t('auth.passwordResetSuccess')}
              </h2>
              <p className="text-gray-600 mb-6">
                {t('auth.passwordResetSuccessDescription')}
              </p>
              <Button onClick={() => navigate('/login')} fullWidth>
                {t('auth.login')}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient">LanpApp</h1>
        </div>

        <Card padding="lg">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            {t('auth.resetPasswordTitle')}
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {t('auth.resetPasswordDescription')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.newPassword')}
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

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
              disabled={!accessToken}
              className="mt-6"
            >
              {t('auth.resetPassword')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {t('auth.backToLogin')}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
