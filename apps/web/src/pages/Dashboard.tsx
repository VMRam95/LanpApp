import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  StarIcon,
  PuzzlePieceIcon,
  PlusIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, StatCard, Button } from '../components/ui';
import { useAuthStore } from '../store/auth.store';
import { api } from '../services/api';
import type { Lanpa, UserStats } from '@lanpapp/shared';

export function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const { data: upcomingLanpas, isLoading: lanpasLoading } = useQuery({
    queryKey: ['upcoming-lanpas'],
    queryFn: async () => {
      const response = await api.get<{ data: Lanpa[] }>('/lanpas', {
        params: { status: 'draft,voting_games,voting_active', limit: 5 },
      });
      return response.data.data;
    },
  });

  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      const response = await api.get<{ data: UserStats }>(`/stats/users/${user?.id}`);
      return response.data.data;
    },
    enabled: !!user?.id,
  });

  const isLoading = lanpasLoading || statsLoading;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t('dashboard.welcome', { name: user?.display_name || user?.username })}
        </h1>
        <p className="mt-1 text-gray-500">
          Here&apos;s what&apos;s happening with your LAN parties
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.stats.lanpasHosted')}
          value={isLoading ? '-' : userStats?.lanpas_hosted || 0}
          icon={<CalendarDaysIcon className="h-6 w-6" />}
        />
        <StatCard
          title={t('dashboard.stats.lanpasAttended')}
          value={isLoading ? '-' : userStats?.lanpas_attended || 0}
          icon={<UserGroupIcon className="h-6 w-6" />}
        />
        <StatCard
          title={t('dashboard.stats.avgRating')}
          value={
            isLoading
              ? '-'
              : userStats?.average_rating_as_member?.toFixed(1) || 'N/A'
          }
          icon={<StarIcon className="h-6 w-6" />}
        />
        <StatCard
          title={t('dashboard.stats.gamesPlayed')}
          value={isLoading ? '-' : userStats?.favorite_games?.length || 0}
          icon={<PuzzlePieceIcon className="h-6 w-6" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Lanpas */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-6 border-b border-gray-200">
              <CardHeader
                title={t('dashboard.upcomingLanpas')}
                action={
                  <Link to="/lanpas">
                    <Button variant="ghost" size="sm">
                      View all
                    </Button>
                  </Link>
                }
              />
            </div>
            <div className="divide-y divide-gray-200">
              {isLoading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                </div>
              ) : upcomingLanpas && upcomingLanpas.length > 0 ? (
                upcomingLanpas.map((lanpa) => (
                  <Link
                    key={lanpa.id}
                    to={`/lanpas/${lanpa.id}`}
                    className="block p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {lanpa.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {lanpa.scheduled_date
                            ? new Date(lanpa.scheduled_date).toLocaleDateString()
                            : 'Date TBD'}
                        </p>
                      </div>
                      <span
                        className={`
                          px-2.5 py-1 text-xs font-medium rounded-full
                          ${
                            lanpa.status === 'draft'
                              ? 'bg-gray-100 text-gray-700'
                              : lanpa.status === 'voting_games'
                                ? 'bg-yellow-100 text-yellow-700'
                                : lanpa.status === 'voting_active'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                          }
                        `}
                      >
                        {t(`lanpas.statuses.${lanpa.status}`)}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center text-gray-500">
                  {t('dashboard.noUpcoming')}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card>
            <CardHeader title={t('dashboard.quickActions')} />
            <div className="space-y-3">
              <Link to="/lanpas?action=create" className="block">
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<PlusIcon className="h-5 w-5" />}
                >
                  {t('dashboard.createLanpa')}
                </Button>
              </Link>
              <Link to="/lanpas?action=join" className="block">
                <Button
                  variant="secondary"
                  fullWidth
                  leftIcon={<LinkIcon className="h-5 w-5" />}
                >
                  {t('dashboard.joinLanpa')}
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
