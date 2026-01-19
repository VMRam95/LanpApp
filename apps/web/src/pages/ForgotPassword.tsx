import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/ui';
import { api } from '../services/api';

interface ForgotPasswordResponse {
  message: string;
  resetUrl?: string;
}

export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setCopied(false);

    try {
      const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
      setIsSuccess(true);
      if (response.data.resetUrl) {
        setResetUrl(response.data.resetUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (resetUrl) {
      try {
        await navigator.clipboard.writeText(resetUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = resetUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
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

              {resetUrl ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {t('auth.devModeTitle', 'Development Mode')}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {t('auth.devModeDescription', 'Copy the link below to reset your password:')}
                  </p>

                  <div className="bg-gray-100 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-600 break-all font-mono">
                      {resetUrl}
                    </p>
                  </div>

                  <Button
                    onClick={handleCopy}
                    fullWidth
                    variant={copied ? 'secondary' : 'primary'}
                    className="mb-4"
                  >
                    {copied ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('common.copied', 'Copied!')}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t('common.copyLink', 'Copy Link')}
                      </span>
                    )}
                  </Button>

                  <a
                    href={resetUrl}
                    className="block w-full text-center py-2 px-4 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    {t('auth.openResetLink', 'Open Reset Link')}
                  </a>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {t('auth.checkEmail')}
                  </h2>
                  <p className="text-gray-600 mb-6">{t('auth.resetEmailSent')}</p>
                </>
              )}

              <div className="mt-6">
                <Link
                  to="/login"
                  className="font-medium text-primary-600 hover:text-primary-700"
                >
                  {t('auth.backToLogin')}
                </Link>
              </div>
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
            {t('auth.forgotPasswordTitle')}
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {t('auth.forgotPasswordDescription')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.email')}
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
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
              className="mt-6"
            >
              {t('auth.sendResetLink')}
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
