import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrophyIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal, ModalFooter } from '../ui';
import { LanpaStatus } from '@lanpapp/shared';
import type { LanpaWithRelations } from '@lanpapp/shared';

interface GameManagementProps {
  lanpa: LanpaWithRelations;
  onSelectGame: (gameId: string) => void;
  isSelecting: boolean;
}

export function GameManagement({ lanpa, onSelectGame, isSelecting }: GameManagementProps) {
  const { t } = useTranslation();
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const handleSelectGame = (gameId: string) => {
    if (lanpa.selected_game_id && lanpa.selected_game_id !== gameId) {
      setSelectedGameId(gameId);
      setShowOverrideConfirm(true);
    } else {
      onSelectGame(gameId);
    }
  };

  const handleConfirmOverride = () => {
    if (selectedGameId) {
      onSelectGame(selectedGameId);
      setShowOverrideConfirm(false);
      setSelectedGameId(null);
    }
  };

  // Get suggestions with vote counts
  const suggestionsWithVotes = lanpa.game_suggestions?.map((suggestion) => {
    const voteCount = lanpa.game_votes?.filter((v) => v.game_id === suggestion.game_id).length || 0;
    return { ...suggestion, voteCount };
  }).sort((a, b) => b.voteCount - a.voteCount) || [];

  return (
    <>
      <div className="space-y-6">
        {/* Current selected game */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {t('lanpas.gameManagement.currentGame')}
          </h4>
          {lanpa.selected_game ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <TrophyIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
              <div className="w-12 h-9 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                {lanpa.selected_game.cover_url ? (
                  <img
                    src={lanpa.selected_game.cover_url}
                    alt={lanpa.selected_game.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PuzzlePieceIcon className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {lanpa.selected_game.name}
                </p>
                <p className="text-xs text-gray-500">
                  {lanpa.selected_game.genre}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
              {t('lanpas.gameManagement.noGameSelected')}
            </div>
          )}
        </div>

        {/* Suggested games */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            {t('lanpas.gameManagement.suggestedGames')}
          </h4>
          {suggestionsWithVotes.length > 0 ? (
            <div className="space-y-2">
              {suggestionsWithVotes.map((suggestion) => {
                const isSelected = lanpa.selected_game_id === suggestion.game_id;
                return (
                  <div
                    key={suggestion.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border
                      ${isSelected ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}
                    `}
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-9 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      {suggestion.game?.cover_url ? (
                        <img
                          src={suggestion.game.cover_url}
                          alt={suggestion.game?.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PuzzlePieceIcon className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {suggestion.game?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {suggestion.voteCount} {suggestion.voteCount === 1 ? 'vote' : 'votes'}
                      </p>
                    </div>

                    {/* Select button */}
                    {lanpa.status === LanpaStatus.IN_PROGRESS && !isSelected && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSelectGame(suggestion.game_id)}
                        isLoading={isSelecting}
                      >
                        {t('lanpas.gameManagement.selectGame')}
                      </Button>
                    )}

                    {isSelected && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
              {t('lanpas.gameManagement.noSuggestedGames')}
            </div>
          )}
        </div>
      </div>

      {/* Override confirmation modal */}
      <Modal
        isOpen={showOverrideConfirm}
        onClose={() => {
          setShowOverrideConfirm(false);
          setSelectedGameId(null);
        }}
        title={t('lanpas.gameManagement.overrideGame')}
        size="sm"
      >
        <p className="text-gray-500">{t('lanpas.gameManagement.overrideConfirm')}</p>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowOverrideConfirm(false);
              setSelectedGameId(null);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirmOverride} isLoading={isSelecting}>
            {t('common.confirm')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
