import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  PuzzlePieceIcon,
  TrophyIcon,
  StarIcon,
  PlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, StatCard } from '../components/ui';
import { api } from '../services/api';
import type { GlobalStats, RankingsResponse, GameWithStats, PersonalStats } from '@lanpapp/shared';

export function Stats() {
  const { t } = useTranslation();

  // Personal stats query
  const { data: personalStats, isLoading: personalLoading } = useQuery({
    queryKey: ['personal-stats'],
    queryFn: async () => {
      const response = await api.get<{ data: PersonalStats }>('/stats/personal');
      return response.data.data;
    },
  });

  const { data: globalStats, isLoading: statsLoading } = useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      const response = await api.get<{ data: GlobalStats }>('/stats/global');
      return response.data.data;
    },
  });

  const { data: rankings, isLoading: rankingsLoading } = useQuery({
    queryKey: ['rankings'],
    queryFn: async () => {
      const response = await api.get<{ data: RankingsResponse }>('/stats/rankings');
      return response.data.data;
    },
  });

  const isLoading = statsLoading || rankingsLoading || personalLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('stats.title')}</h1>
        <p className="text-gray-500 mt-1">
          {t('stats.subtitle', 'View your personal and global statistics')}
        </p>
      </div>

      {/* Personal Stats Section */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('stats.myStats', 'My Statistics')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard
            title={t('stats.lanpasCreated', 'Lanpas Created')}
            value={personalLoading ? '-' : personalStats?.lanpas_created || 0}
            icon={<CalendarDaysIcon className="h-6 w-6" />}
          />
          <StatCard
            title={t('stats.lanpasAttended', 'Lanpas Attended')}
            value={personalLoading ? '-' : personalStats?.lanpas_attended || 0}
            icon={<UserGroupIcon className="h-6 w-6" />}
          />
          <StatCard
            title={t('stats.gamesPlayed', 'Games Played')}
            value={personalLoading ? '-' : personalStats?.games_played || 0}
            icon={<PuzzlePieceIcon className="h-6 w-6" />}
          />
          <StatCard
            title={t('stats.myRating', 'My Rating')}
            value={
              personalLoading
                ? '-'
                : personalStats?.average_rating
                  ? `${personalStats.average_rating}/5`
                  : '-'
            }
            icon={<StarIcon className="h-6 w-6" />}
          />
        </div>

        {/* CTA if no activity */}
        {!personalLoading && !personalStats?.has_activity && (
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-200 rounded-lg">
                  <CalendarDaysIcon className="h-6 w-6 text-primary-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-primary-900">
                    {t('stats.noActivityTitle', 'Start your LAN party journey!')}
                  </h3>
                  <p className="text-sm text-primary-700">
                    {t(
                      'stats.noActivityDescription',
                      'Create your first lanpa or join one to start building your stats'
                    )}
                  </p>
                </div>
              </div>
              <Link
                to="/lanpas/create"
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5" />
                <span>{t('lanpas.create', 'Create Lanpa')}</span>
              </Link>
            </div>
          </Card>
        )}

        {/* Punishments warning if any */}
        {!personalLoading && (personalStats?.total_punishments || 0) > 0 && (
          <Card className="bg-red-50 border-red-200 mt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-200 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-700" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">
                  {t('stats.punishmentsTitle', 'Punishments Received')}
                </h3>
                <p className="text-sm text-red-700">
                  {t('stats.punishmentsCount', 'You have {{count}} punishment(s)', {
                    count: personalStats?.total_punishments || 0,
                  })}
                </p>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Global Stats Section */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {t('stats.globalStats', 'Global Statistics')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title={t('stats.totalLanpas')}
            value={isLoading ? '-' : globalStats?.total_lanpas || 0}
            icon={<CalendarDaysIcon className="h-6 w-6" />}
          />
          <StatCard
            title={t('stats.totalUsers')}
            value={isLoading ? '-' : globalStats?.total_users || 0}
            icon={<UserGroupIcon className="h-6 w-6" />}
          />
          <StatCard
            title={t('stats.totalGamesPlayed')}
            value={isLoading ? '-' : globalStats?.total_games_played || 0}
            icon={<PuzzlePieceIcon className="h-6 w-6" />}
          />
        </div>
      </section>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {globalStats?.most_frequent_admin && (
          <Card>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary-50 rounded-lg">
                <TrophyIcon className="h-5 w-5 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {t('stats.mostFrequentAdmin')}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {globalStats.most_frequent_admin.user.avatar_url ? (
                <img
                  src={globalStats.most_frequent_admin.user.avatar_url}
                  alt={globalStats.most_frequent_admin.user.display_name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-primary-700">
                    {globalStats.most_frequent_admin.user.display_name
                      ?.charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {globalStats.most_frequent_admin.user.display_name}
                </p>
                <p className="text-sm text-gray-500">
                  {globalStats.most_frequent_admin.lanpas_hosted} lanpas hosted
                </p>
              </div>
            </div>
          </Card>
        )}

        {globalStats?.most_attended_member && (
          <Card>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <UserGroupIcon className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {t('stats.mostAttendedMember')}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {globalStats.most_attended_member.user.avatar_url ? (
                <img
                  src={globalStats.most_attended_member.user.avatar_url}
                  alt={globalStats.most_attended_member.user.display_name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-green-700">
                    {globalStats.most_attended_member.user.display_name
                      ?.charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {globalStats.most_attended_member.user.display_name}
                </p>
                <p className="text-sm text-gray-500">
                  {globalStats.most_attended_member.lanpas_attended} lanpas
                  attended
                </p>
              </div>
            </div>
          </Card>
        )}

        {globalStats?.best_rated_admin && (
          <Card>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <StarIcon className="h-5 w-5 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {t('stats.bestRatedAdmin')}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              {globalStats.best_rated_admin.user.avatar_url ? (
                <img
                  src={globalStats.best_rated_admin.user.avatar_url}
                  alt={globalStats.best_rated_admin.user.display_name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-yellow-700">
                    {globalStats.best_rated_admin.user.display_name
                      ?.charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {globalStats.best_rated_admin.user.display_name}
                </p>
                <p className="text-sm text-gray-500">
                  {globalStats.best_rated_admin.average_rating.toFixed(1)} avg
                  rating
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Hall of Shame */}
      {globalStats?.hall_of_shame && globalStats.hall_of_shame.length > 0 && (
        <section>
          <Card className="bg-red-50 border-red-200">
            <CardHeader
              title={t('stats.hallOfShame', 'Hall of Shame')}
              subtitle={t('stats.hallOfShameSubtitle', 'Users with the most punishments')}
            />
            <div className="space-y-3">
              {globalStats.hall_of_shame.slice(0, 5).map((entry, index) => (
                <div
                  key={entry.user.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white border border-red-100"
                >
                  <span
                    className={`
                      w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
                      ${
                        index === 0
                          ? 'bg-red-200 text-red-800'
                          : index === 1
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }
                    `}
                  >
                    {index + 1}
                  </span>
                  {entry.user.avatar_url ? (
                    <img
                      src={entry.user.avatar_url}
                      alt={entry.user.display_name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-lg font-medium text-red-700">
                        {entry.user.display_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {entry.user.display_name}
                    </p>
                    <p className="text-sm text-red-600">
                      {t('stats.punishmentsCount', 'You have {{count}} punishment(s)', {
                        count: entry.total_punishments,
                      }).replace('You have', '')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-700">
                      -{entry.total_point_impact} pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rankings */}
        <Card>
          <CardHeader
            title={t('stats.rankings')}
            subtitle="Based on attendance and ratings"
          />

          {/* Tabs */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t('stats.cleanRanking')}
              </h4>
              {rankings?.clean_ranking && rankings.clean_ranking.length > 0 ? (
                <div className="space-y-2">
                  {rankings.clean_ranking.slice(0, 5).map((entry) => (
                    <div
                      key={entry.user.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-gray-50"
                    >
                      <span
                        className={`
                          w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                          ${
                            entry.rank === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : entry.rank === 2
                                ? 'bg-gray-200 text-gray-700'
                                : entry.rank === 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-500'
                          }
                        `}
                      >
                        {entry.rank}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                        {entry.user.display_name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {entry.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>

            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t('stats.adjustedRanking')}
              </h4>
              {rankings?.adjusted_ranking &&
              rankings.adjusted_ranking.length > 0 ? (
                <div className="space-y-2">
                  {rankings.adjusted_ranking.slice(0, 5).map((entry) => (
                    <div
                      key={entry.user.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-gray-50"
                    >
                      <span
                        className={`
                          w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                          ${
                            entry.rank === 1
                              ? 'bg-yellow-100 text-yellow-700'
                              : entry.rank === 2
                                ? 'bg-gray-200 text-gray-700'
                                : entry.rank === 3
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-500'
                          }
                        `}
                      >
                        {entry.rank}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                        {entry.user.display_name}
                      </span>
                      <span className="text-sm text-gray-500">
                        {entry.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No data available</p>
              )}
            </div>
          </div>
        </Card>

        {/* Most Played Games */}
        <Card>
          <CardHeader title={t('stats.mostPlayedGames')} />
          {globalStats?.most_played_games &&
          globalStats.most_played_games.length > 0 ? (
            <div className="space-y-3">
              {globalStats.most_played_games
                .slice(0, 5)
                .map((game: GameWithStats, index: number) => (
                  <div key={game.id} className="flex items-center gap-3">
                    <span
                      className={`
                        w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold
                        ${
                          index === 0
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-600'
                        }
                      `}
                    >
                      {index + 1}
                    </span>
                    {game.cover_url ? (
                      <img
                        src={game.cover_url}
                        alt={game.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                        <PuzzlePieceIcon className="h-5 w-5 text-primary-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {game.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {game.times_played} times played
                      </p>
                    </div>
                    {game.average_rating && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <StarIcon className="h-4 w-4 text-yellow-400" />
                        {game.average_rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No games played yet
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
