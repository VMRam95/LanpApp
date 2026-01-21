import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '../components/ui';
import { useJoinLanpa } from '../hooks/useLanpas';

export function JoinLanpa() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const joinMutation = useJoinLanpa();
  const hasAttemptedRef = useRef(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (token && !hasAttemptedRef.current) {
      hasAttemptedRef.current = true;
      joinMutation.mutate(token, {
        onSuccess: (lanpa) => {
          // Redirect to the lanpa after a short delay to show success message
          setTimeout(() => {
            navigate(`/lanpas/${lanpa.id}`);
          }, 2000);
        },
      });
    }
  }, [token, retryCount]);

  // Loading state
  if (joinMutation.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4 text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            {t('lanpas.joiningLanpa')}
          </h2>
          <p className="mt-2 text-gray-500">
            {t('lanpas.pleaseWait')}
          </p>
        </Card>
      </div>
    );
  }

  // Success state
  if (joinMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4 text-center py-12">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            {t('lanpas.joinSuccess')}
          </h2>
          <p className="mt-2 text-gray-500">
            {t('lanpas.joinSuccessMessage', { name: joinMutation.data?.name })}
          </p>
          <p className="mt-4 text-sm text-gray-400">
            {t('lanpas.redirecting')}
          </p>
        </Card>
      </div>
    );
  }

  // Error state
  if (joinMutation.isError) {
    const errorMessage = (joinMutation.error as any)?.response?.data?.error?.message
      || (joinMutation.error as any)?.message
      || t('lanpas.joinErrorMessage');

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4 text-center py-12">
          <XCircleIcon className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            {t('lanpas.joinError')}
          </h2>
          <p className="mt-2 text-gray-500">
            {errorMessage}
          </p>
          <div className="mt-6 space-x-3">
            <Button variant="secondary" onClick={() => navigate('/lanpas')}>
              {t('lanpas.goToLanpas')}
            </Button>
            <Button onClick={() => {
              hasAttemptedRef.current = false;
              joinMutation.reset();
              setRetryCount((c) => c + 1);
            }}>
              {t('common.retry')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // No token state
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4 text-center py-12">
          <XCircleIcon className="h-16 w-16 text-yellow-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            {t('lanpas.invalidLink')}
          </h2>
          <p className="mt-2 text-gray-500">
            {t('lanpas.invalidLinkMessage')}
          </p>
          <Link to="/lanpas" className="mt-6 inline-block">
            <Button>{t('lanpas.goToLanpas')}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return null;
}
