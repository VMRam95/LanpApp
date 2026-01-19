import { Link } from 'react-router-dom';
import type { Game, GameWithStats } from '@lanpapp/shared';
import { RatingDisplay } from './Rating';

interface GameCardProps {
  game: Game | GameWithStats;
  onClick?: () => void;
  selected?: boolean;
  showStats?: boolean;
}

export function GameCard({ game, onClick, selected, showStats = true }: GameCardProps) {
  const gameWithStats = game as GameWithStats;
  const hasStats = 'times_played' in game;

  const content = (
    <div
      className={`
        bg-white rounded-lg shadow-sm border overflow-hidden
        transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-indigo-300' : ''}
        ${selected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200'}
      `}
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="aspect-video bg-gray-100 relative">
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt={game.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        )}
        {game.genre && (
          <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
            {game.genre}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate">{game.name}</h3>

        {game.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
            {game.description}
          </p>
        )}

        {/* Player count */}
        {(game.min_players || game.max_players) && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <svg
              className="w-4 h-4 mr-1"
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
            {game.min_players === game.max_players
              ? `${game.min_players} players`
              : `${game.min_players || '?'}-${game.max_players || '?'} players`}
          </div>
        )}

        {/* Stats */}
        {showStats && hasStats && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <RatingDisplay value={gameWithStats.average_rating} size="sm" />
            <span className="text-xs text-gray-400">
              {gameWithStats.times_played} plays
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return content;
  }

  return (
    <Link to={`/games/${game.id}`}>
      {content}
    </Link>
  );
}

interface GameCardCompactProps {
  game: Game;
  onSelect?: () => void;
  onRemove?: () => void;
  selected?: boolean;
}

export function GameCardCompact({ game, onSelect, onRemove, selected }: GameCardCompactProps) {
  return (
    <div
      className={`
        flex items-center gap-3 p-3 bg-white rounded-lg border
        ${selected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200'}
        ${onSelect ? 'cursor-pointer hover:border-indigo-300' : ''}
      `}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
        {game.cover_url ? (
          <img
            src={game.cover_url}
            alt={game.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 truncate">{game.name}</h4>
        <p className="text-xs text-gray-500">
          {game.genre || 'No genre'}
          {game.min_players && ` · ${game.min_players}-${game.max_players} players`}
        </p>
      </div>

      {/* Actions */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {selected && !onRemove && (
        <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  );
}
