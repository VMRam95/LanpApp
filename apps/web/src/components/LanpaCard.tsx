import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanpaStatus, type Lanpa, type LanpaWithRelations } from '@lanpapp/shared';
import { formatDate } from '@lanpapp/shared';

interface LanpaCardProps {
  lanpa: Lanpa | LanpaWithRelations;
  showAdmin?: boolean;
}

const statusConfig: Record<LanpaStatus, { label: string; color: string; bgColor: string }> = {
  [LanpaStatus.DRAFT]: {
    label: 'Draft',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  [LanpaStatus.VOTING_GAMES]: {
    label: 'Suggesting Games',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  [LanpaStatus.VOTING_ACTIVE]: {
    label: 'Voting',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  [LanpaStatus.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  [LanpaStatus.COMPLETED]: {
    label: 'Completed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
};

export function LanpaCard({ lanpa, showAdmin = true }: LanpaCardProps) {
  const { i18n } = useTranslation();
  const status = statusConfig[lanpa.status as LanpaStatus];
  const lanpaWithRelations = lanpa as LanpaWithRelations;
  const hasRelations = 'admin' in lanpa;

  return (
    <Link to={`/lanpas/${lanpa.id}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-indigo-300 transition-all duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-lg">
              {lanpa.name}
            </h3>
            {lanpa.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {lanpa.description}
              </p>
            )}
          </div>
          <span
            className={`
              px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0
              ${status.bgColor} ${status.color}
            `}
          >
            {status.label}
          </span>
        </div>

        {/* Meta info */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {/* Date */}
          {(lanpa.scheduled_date || lanpa.actual_date) && (
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>
                {formatDate(
                  lanpa.actual_date || lanpa.scheduled_date!,
                  i18n.language
                )}
              </span>
            </div>
          )}

          {/* Members count */}
          {hasRelations && lanpaWithRelations.members && (
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
              <span>{lanpaWithRelations.members.length} members</span>
            </div>
          )}

          {/* Historical badge */}
          {lanpa.is_historical && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
              Historical
            </span>
          )}
        </div>

        {/* Admin */}
        {showAdmin && hasRelations && lanpaWithRelations.admin && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
            {lanpaWithRelations.admin.avatar_url ? (
              <img
                src={lanpaWithRelations.admin.avatar_url}
                alt={lanpaWithRelations.admin.display_name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-xs font-medium text-indigo-600">
                  {lanpaWithRelations.admin.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-600">
              Hosted by{' '}
              <span className="font-medium">
                {lanpaWithRelations.admin.display_name}
              </span>
            </span>
          </div>
        )}

        {/* Selected game */}
        {hasRelations && lanpaWithRelations.selected_game && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Playing:</span>
            <span className="font-medium text-indigo-600">
              {lanpaWithRelations.selected_game.name}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

interface LanpaCardSkeletonProps {
  count?: number;
}

export function LanpaCardSkeleton({ count = 1 }: LanpaCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 animate-pulse"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="mt-2 h-4 bg-gray-200 rounded w-full" />
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
          </div>
          <div className="mt-4 flex gap-4">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded-full" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
