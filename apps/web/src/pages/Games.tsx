import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  StarIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { Card, Button, Input, Textarea, Modal, ModalFooter } from '../components/ui';
import { useGames, useCreateGame, useUpdateGame, useDeleteGame } from '../hooks/useGames';
import type { GameWithStats, CreateGameRequest, UpdateGameRequest } from '@lanpapp/shared';

export function Games() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameWithStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState<CreateGameRequest>({
    name: '',
    description: '',
    genre: '',
    min_players: undefined,
    max_players: undefined,
    cover_url: '',
  });

  const { data, isLoading } = useGames({ search: searchQuery || undefined });
  const createMutation = useCreateGame();
  const updateMutation = useUpdateGame();
  const deleteMutation = useDeleteGame();

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      genre: '',
      min_players: undefined,
      max_players: undefined,
      cover_url: '',
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        ...formData,
        description: formData.description || undefined,
        genre: formData.genre || undefined,
        cover_url: formData.cover_url || undefined,
        min_players: formData.min_players || undefined,
        max_players: formData.max_players || undefined,
      },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          resetFormData();
        },
      }
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame) return;

    // Build update data, only including fields with values
    // Use undefined to omit fields, use null to explicitly clear them
    const updateData: UpdateGameRequest = {
      name: formData.name,
    };

    // For optional fields, only include if changed from original
    // If empty string, send null to clear the field
    // If has value, send the value
    if (formData.description !== (selectedGame.description || '')) {
      updateData.description = formData.description || null;
    }
    if (formData.genre !== (selectedGame.genre || '')) {
      updateData.genre = formData.genre || null;
    }
    if (formData.cover_url !== (selectedGame.cover_url || '')) {
      updateData.cover_url = formData.cover_url || null;
    }
    if (formData.min_players !== (selectedGame.min_players || undefined)) {
      updateData.min_players = formData.min_players || null;
    }
    if (formData.max_players !== (selectedGame.max_players || undefined)) {
      updateData.max_players = formData.max_players || null;
    }

    updateMutation.mutate(
      {
        id: selectedGame.id,
        data: updateData,
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setSelectedGame(null);
          resetFormData();
        },
      }
    );
  };

  const handleEditClick = (game: GameWithStats, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGame(game);
    setFormData({
      name: game.name,
      description: game.description || '',
      genre: game.genre || '',
      min_players: game.min_players || undefined,
      max_players: game.max_players || undefined,
      cover_url: game.cover_url || '',
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (game: GameWithStats, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGame(game);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedGame) {
      deleteMutation.mutate(selectedGame.id, {
        onSuccess: () => {
          setIsDeleteModalOpen(false);
          setSelectedGame(null);
        },
      });
    }
  };

  const renderRating = (rating: number | null) => {
    if (!rating) return 'N/A';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <span key={i}>
            {i < fullStars ? (
              <StarSolidIcon className="h-4 w-4 text-yellow-400" />
            ) : i === fullStars && hasHalfStar ? (
              <StarIcon className="h-4 w-4 text-yellow-400" />
            ) : (
              <StarIcon className="h-4 w-4 text-gray-300" />
            )}
          </span>
        ))}
        <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const renderGameForm = (isEdit: boolean) => (
    <div className="space-y-4">
      <Input
        label={t('games.name')}
        value={formData.name}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, name: e.target.value }))
        }
        placeholder="Counter-Strike 2"
        required
      />

      <Textarea
        label={t('games.description')}
        value={formData.description || ''}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, description: e.target.value }))
        }
        placeholder="A tactical first-person shooter..."
        rows={3}
      />

      <Input
        label={t('games.genre')}
        value={formData.genre || ''}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, genre: e.target.value }))
        }
        placeholder="FPS"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t('games.minPlayers')}
          type="number"
          min={1}
          value={formData.min_players || ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              min_players: e.target.value ? parseInt(e.target.value) : undefined,
            }))
          }
          placeholder="2"
        />
        <Input
          label={t('games.maxPlayers')}
          type="number"
          min={1}
          value={formData.max_players || ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              max_players: e.target.value ? parseInt(e.target.value) : undefined,
            }))
          }
          placeholder="10"
        />
      </div>

      <Input
        label={t('games.coverUrl')}
        type="url"
        value={formData.cover_url || ''}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, cover_url: e.target.value }))
        }
        placeholder="https://example.com/cover.jpg"
      />

      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (isEdit) {
              setIsEditModalOpen(false);
              setSelectedGame(null);
            } else {
              setIsCreateModalOpen(false);
            }
            resetFormData();
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          isLoading={isEdit ? updateMutation.isPending : createMutation.isPending}
        >
          {isEdit ? t('common.save') : t('common.create')}
        </Button>
      </ModalFooter>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('games.title')}</h1>
          <p className="text-gray-500 mt-1">Browse and add games for your lanpas</p>
        </div>
        <Button
          leftIcon={<PlusIcon className="h-5 w-5" />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          {t('games.addNew')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('common.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Games Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.data.map((game: GameWithStats) => (
            <Card
              key={game.id}
              padding="none"
              hoverable
              className="overflow-hidden group relative cursor-pointer"
              onClick={() => navigate(`/games/${game.id}`)}
            >
              {game.cover_url ? (
                <img
                  src={game.cover_url}
                  alt={game.name}
                  className="w-full h-40 object-cover"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <PlayIcon className="h-16 w-16 text-primary-400" />
                </div>
              )}

              {/* Action buttons on hover */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleEditClick(game, e)}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                  title={t('common.edit')}
                >
                  <PencilIcon className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(game, e)}
                  className="p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors"
                  title={t('common.delete')}
                >
                  <TrashIcon className="h-4 w-4 text-red-500" />
                </button>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">
                  {game.name}
                </h3>
                {game.genre && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                    {game.genre}
                  </span>
                )}
                {game.description && (
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {game.description}
                  </p>
                )}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center text-sm text-gray-500">
                    <PlayIcon className="h-4 w-4 mr-1" />
                    {t('games.timesPlayed')}: {game.times_played || 0}
                  </div>
                  <div className="flex items-center text-sm">
                    {renderRating(game.average_rating)}
                  </div>
                  {(game.min_players || game.max_players) && (
                    <p className="text-sm text-gray-500">
                      {t('games.players')}:{' '}
                      {game.min_players && game.max_players
                        ? `${game.min_players}-${game.max_players}`
                        : game.min_players
                          ? `${game.min_players}+`
                          : `Up to ${game.max_players}`}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <PlayIcon className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {t('games.noGames')}
          </h3>
          <p className="mt-2 text-gray-500">Add your first game to get started</p>
          <Button
            className="mt-4"
            leftIcon={<PlusIcon className="h-5 w-5" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            {t('games.addNew')}
          </Button>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetFormData();
        }}
        title={t('games.addNew')}
        size="lg"
      >
        <form onSubmit={handleCreateSubmit}>
          {renderGameForm(false)}
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedGame(null);
          resetFormData();
        }}
        title={t('games.editGame')}
        size="lg"
      >
        <form onSubmit={handleEditSubmit}>
          {renderGameForm(true)}
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedGame(null);
        }}
        title={t('games.deleteGame')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {t('games.deleteConfirmation', { name: selectedGame?.name })}
          </p>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedGame(null);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={deleteMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
