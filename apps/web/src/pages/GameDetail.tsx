import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  PlayIcon,
  UserGroupIcon,
  TagIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { StarIcon } from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, LoadingSpinner } from '../components/ui';
import { api } from '../services/api';
import type { GameWithStats } from '@lanpapp/shared';

interface GameDetailResponse extends GameWithStats {
  recent_lanpas?: Array<{
    id: string;
    name: string;
    actual_date: string | null;
    admin: {
      id: string;
      username: string;
      display_name: string;
    };
  }>;
}

export function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const response = await api.get<{ data: GameDetailResponse }>(`/games/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });

  const renderRating = (rating: number | null) => {
    if (!rating) return <span className="text-gray-500">N/A</span>;
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <span key={i}>
            {i < fullStars ? (
              <StarSolidIcon className="h-5 w-5 text-yellow-400" />
            ) : i === fullStars && hasHalfStar ? (
              <StarIcon className="h-5 w-5 text-yellow-400" />
            ) : (
              <StarIcon className="h-5 w-5 text-gray-300" />
            )}
          </span>
        ))}
        <span className="ml-2 text-lg font-semibold text-gray-900">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullPage />;
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{t('games.notFound')}</h2>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/games')}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/games')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{game.name}</h1>
          {game.genre && (
            <span className="inline-block mt-2 px-3 py-1 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">
              {game.genre}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Cover & Description */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cover Image */}
          <Card padding="none" className="overflow-hidden">
            {game.cover_url ? (
              <img
                src={game.cover_url}
                alt={game.name}
                className="w-full h-64 md:h-80 object-cover"
              />
            ) : (
              <div className="w-full h-64 md:h-80 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                <PlayIcon className="h-24 w-24 text-primary-400" />
              </div>
            )}
          </Card>

          {/* Description */}
          {game.description && (
            <Card>
              <CardHeader title={t('games.description')} />
              <p className="text-gray-600 whitespace-pre-wrap">{game.description}</p>
            </Card>
          )}

          {/* Recent Lanpas */}
          {game.recent_lanpas && game.recent_lanpas.length > 0 && (
            <Card>
              <CardHeader
                title={t('games.recentLanpas')}
                subtitle={t('games.recentLanpasSubtitle')}
              />
              <div className="divide-y divide-gray-200">
                {game.recent_lanpas.map((lanpa) => (
                  <div
                    key={lanpa.id}
                    className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors"
                    onClick={() => navigate(`/lanpas/${lanpa.id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{lanpa.name}</p>
                      <p className="text-sm text-gray-500">
                        {t('lanpas.hostedBy')} {lanpa.admin?.display_name || lanpa.admin?.username}
                      </p>
                    </div>
                    {lanpa.actual_date && (
                      <div className="flex items-center text-sm text-gray-500">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {new Date(lanpa.actual_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-4">
          {/* Stats Cards */}
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-50 rounded-xl">
                <PlayIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('games.timesPlayed')}</p>
                <p className="text-2xl font-bold text-gray-900">{game.times_played || 0}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-50 rounded-xl">
                <StarSolidIcon className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('games.averageRating')}</p>
                <div className="mt-1">{renderRating(game.average_rating)}</div>
              </div>
            </div>
          </Card>

          {(game.min_players || game.max_players) && (
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <UserGroupIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('games.players')}</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {game.min_players && game.max_players
                      ? `${game.min_players} - ${game.max_players}`
                      : game.min_players
                        ? `${game.min_players}+`
                        : `${t('games.upTo')} ${game.max_players}`}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {game.genre && (
            <Card>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-50 rounded-xl">
                  <TagIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t('games.genre')}</p>
                  <p className="text-xl font-semibold text-gray-900">{game.genre}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
