import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/ui';

export function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-9xl font-bold text-primary-600">404</p>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          {t('errors.notFound')}
        </h1>
        <p className="mt-2 text-lg text-gray-500 max-w-md mx-auto">
          {t('errors.notFoundMessage')}
        </p>
        <Link to="/dashboard" className="inline-block mt-8">
          <Button leftIcon={<HomeIcon className="h-5 w-5" />}>
            {t('errors.goHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
