import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  CalendarIcon,
  UserGroupIcon,
  PuzzlePieceIcon,
  LinkIcon,
  CheckIcon,
  TrashIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { Card, CardHeader, Button, Modal, ModalFooter, Input, Textarea } from '../components/ui';
import { GameCard, GameCardCompact } from '../components/GameCard';
import { AdminPanel } from '../components/admin';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import {
  useLanpa,
  useUpdateLanpa,
  useUpdateLanpaStatus,
  useDeleteLanpa,
  useInviteUsers,
  useInviteByEmail,
  useSuggestGame,
  useVoteGame,
  useGameResults,
  useUpdateMemberStatus,
  useRemoveMember,
  useSelectGame,
} from '../hooks/useLanpas';
import { useGames } from '../hooks/useGames';
import { useLanpaGames } from '../hooks/useLanpaGames';
import { useLanpaPunishments } from '../hooks/useLanpaPunishments';
import type { Game, User } from '@lanpapp/shared';

export function LanpaDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', scheduled_date: '' });

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Email invite state
  const [emailInvites, setEmailInvites] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Game suggestion modal state
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState('');

  // Queries
  const { data: lanpa, isLoading } = useLanpa(id || '');

  // User search query
  const { data: searchResults } = useQuery({
    queryKey: ['users', 'search', userSearch],
    queryFn: async () => {
      const response = await api.get<{ data: User[] }>(`/users/search?q=${userSearch}`);
      return response.data.data;
    },
    enabled: userSearch.length >= 2,
  });

  // Games search for suggestions
  const { data: gamesData } = useGames({ search: gameSearch, limit: 20 });

  // Game results for voting
  const { data: gameResults } = useGameResults(id || '');

  // Lanpa games and punishments
  const { data: lanpaGames } = useLanpaGames(id || '');
  const { data: lanpaPunishments } = useLanpaPunishments(id || '');

  // Mutations
  const updateStatusMutation = useUpdateLanpaStatus();
  const deleteMutation = useDeleteLanpa();

  const updateLanpaMutation = useUpdateLanpa();
  const inviteUsersMutation = useInviteUsers();
  const inviteByEmailMutation = useInviteByEmail();
  const suggestGameMutation = useSuggestGame();
  const voteGameMutation = useVoteGame();
  const updateMemberStatusMutation = useUpdateMemberStatus();
  const removeMemberMutation = useRemoveMember();
  const selectGameMutation = useSelectGame();

  const isAdmin = lanpa?.admin_id === user?.id;
  const userVote = lanpa?.game_votes?.find((v) => v.user_id === user?.id)?.game_id;

  // Helper to convert UTC date to local datetime-local format
  const toLocalDatetimeString = (utcDateString: string): string => {
    const date = new Date(utcDateString);
    // Get local date/time components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Pre-populate edit form when opening modal
  useEffect(() => {
    if (isEditModalOpen && lanpa) {
      setEditForm({
        name: lanpa.name,
        description: lanpa.description || '',
        scheduled_date: lanpa.scheduled_date
          ? toLocalDatetimeString(lanpa.scheduled_date)
          : '',
      });
    }
  }, [isEditModalOpen, lanpa]);

  // Filter out existing members from search results
  const filteredSearchResults = searchResults?.filter(
    (u) => !lanpa?.members?.some((m) => m.user_id === u.id)
  );

  // Filter out already suggested games
  const filteredGames = gamesData?.data?.filter(
    (g: Game) => !lanpa?.game_suggestions?.some((s) => s.game_id === g.id)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'voting_games':
        return 'bg-yellow-100 text-yellow-700';
      case 'voting_active':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const copyInviteLink = async () => {
    try {
      const response = await api.post<{ data: { link: string } }>(
        `/lanpas/${id}/invite-link`
      );
      await navigator.clipboard.writeText(response.data.data.link);
    } catch {
      // Handle error
    }
  };

  const handleEditSubmit = () => {
    if (!id) return;
    // Keep local time - just add seconds for API validation
    // Don't convert to UTC to avoid timezone shift
    const scheduledDate = editForm.scheduled_date
      ? `${editForm.scheduled_date}:00`
      : undefined;
    updateLanpaMutation.mutate(
      {
        id,
        data: {
          name: editForm.name,
          description: editForm.description || undefined,
          scheduled_date: scheduledDate,
        },
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
        },
      }
    );
  };

  const handleInviteSubmit = () => {
    if (!id || selectedUserIds.length === 0) return;
    inviteUsersMutation.mutate(
      { id, userIds: selectedUserIds },
      {
        onSuccess: () => {
          setIsInviteModalOpen(false);
          setSelectedUserIds([]);
          setUserSearch('');
        },
      }
    );
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddEmail = () => {
    const email = currentEmail.trim().toLowerCase();
    if (!email) return;

    if (!isValidEmail(email)) {
      setEmailError(t('lanpas.invalidEmail'));
      return;
    }

    if (emailInvites.includes(email)) {
      setEmailError('Email already added');
      return;
    }

    setEmailInvites([...emailInvites, email]);
    setCurrentEmail('');
    setEmailError('');
  };

  const handleRemoveEmail = (email: string) => {
    setEmailInvites(emailInvites.filter((e) => e !== email));
  };

  const handleEmailInviteSubmit = () => {
    if (!id || emailInvites.length === 0) return;
    inviteByEmailMutation.mutate(
      { id, emails: emailInvites },
      {
        onSuccess: () => {
          setEmailInvites([]);
          setCurrentEmail('');
          setEmailError('');
        },
      }
    );
  };

  const handleSuggestGame = (gameId: string) => {
    if (!id) return;
    suggestGameMutation.mutate(
      { lanpaId: id, gameId },
      {
        onSuccess: () => {
          setIsSuggestModalOpen(false);
          setGameSearch('');
        },
      }
    );
  };

  const handleVoteGame = (gameId: string) => {
    if (!id) return;
    voteGameMutation.mutate({ lanpaId: id, gameId });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const getSelectedUsers = () => {
    return searchResults?.filter((u) => selectedUserIds.includes(u.id)) || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!lanpa) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Lanpa not found</h2>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/lanpas')}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/lanpas')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{lanpa.name}</h1>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(lanpa.status)}`}
              >
                {t(`lanpas.statuses.${lanpa.status}`)}
              </span>
            </div>
            {lanpa.description && (
              <p className="text-gray-500 mt-2">{lanpa.description}</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leftIcon={<LinkIcon className="h-4 w-4" />}
              onClick={copyInviteLink}
            >
              {t('lanpas.actions.copyLink')}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<PencilIcon className="h-4 w-4" />}
              onClick={() => setIsEditModalOpen(true)}
            >
              {t('common.edit')}
            </Button>
            <Button
              variant="danger"
              leftIcon={<TrashIcon className="h-4 w-4" />}
              onClick={() => setIsDeleteModalOpen(true)}
            >
              {t('common.delete')}
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-50 rounded-xl">
              <CalendarIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('lanpas.scheduledDate')}</p>
              <p className="font-semibold text-gray-900">
                {lanpa.scheduled_date
                  ? new Date(lanpa.scheduled_date).toLocaleString()
                  : 'TBD'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-50 rounded-xl">
              <UserGroupIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('lanpas.members')}</p>
              <p className="font-semibold text-gray-900">
                {lanpa.members?.length || 0} members
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-50 rounded-xl">
              <PuzzlePieceIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Selected Game</p>
              <p className="font-semibold text-gray-900">
                {lanpa.selected_game?.name || 'Not selected'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <AdminPanel
          lanpa={lanpa}
          currentUserId={user?.id || ''}
          onStatusChange={(status) => updateStatusMutation.mutate({ id: id!, status })}
          onUpdateMemberStatus={(memberId, status) =>
            updateMemberStatusMutation.mutate({ lanpaId: id!, memberId, status })
          }
          onRemoveMember={(memberId) =>
            removeMemberMutation.mutate({ lanpaId: id!, memberId })
          }
          onSelectGame={(gameId) =>
            selectGameMutation.mutate({ lanpaId: id!, gameId })
          }
          onEditClick={() => setIsEditModalOpen(true)}
          onDeleteClick={() => deleteMutation.mutate(id!, { onSuccess: () => navigate('/lanpas') })}
          onCopyInviteLink={copyInviteLink}
          isStatusLoading={updateStatusMutation.isPending}
          isMemberUpdating={updateMemberStatusMutation.isPending}
          isMemberRemoving={removeMemberMutation.isPending}
          isGameSelecting={selectGameMutation.isPending}
        />
      )}

      {/* Game Suggestions Section - Shows during voting_games status */}
      {lanpa.status === 'voting_games' && (
        <Card>
          <CardHeader
            title={t('lanpas.gameSuggestions')}
            subtitle={t('lanpas.gameSuggestionsSubtitle')}
            action={
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<PuzzlePieceIcon className="h-4 w-4" />}
                onClick={() => setIsSuggestModalOpen(true)}
              >
                {t('lanpas.actions.suggestGame')}
              </Button>
            }
          />
          {lanpa.game_suggestions && lanpa.game_suggestions.length > 0 ? (
            <div className="space-y-2">
              {lanpa.game_suggestions.map((suggestion) => (
                <GameCardCompact
                  key={suggestion.id}
                  game={suggestion.game!}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">{t('lanpas.noSuggestions')}</p>
          )}
        </Card>
      )}

      {/* Game Voting Section - Shows during voting_active status */}
      {lanpa.status === 'voting_active' && (
        <Card>
          <CardHeader
            title={t('lanpas.gameVoting')}
            subtitle={t('lanpas.gameVotingSubtitle')}
          />
          {lanpa.game_suggestions && lanpa.game_suggestions.length > 0 ? (
            <div className="space-y-3">
              {lanpa.game_suggestions.map((suggestion) => {
                const voteCount = gameResults?.results?.find(
                  (r: { game_id: string; votes: number }) => r.game_id === suggestion.game_id
                )?.votes || 0;
                const isVoted = userVote === suggestion.game_id;

                return (
                  <div
                    key={suggestion.id}
                    className={`
                      flex items-center gap-3 p-3 bg-white rounded-lg border
                      ${isVoted ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200'}
                    `}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      {suggestion.game?.cover_url ? (
                        <img
                          src={suggestion.game.cover_url}
                          alt={suggestion.game.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PuzzlePieceIcon className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {suggestion.game?.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {suggestion.game?.genre || 'No genre'}
                      </p>
                    </div>

                    {/* Vote count badge */}
                    <span className="px-2 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
                      {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                    </span>

                    {/* Vote button */}
                    <Button
                      variant={isVoted ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleVoteGame(suggestion.game_id)}
                      isLoading={voteGameMutation.isPending}
                    >
                      {isVoted ? t('lanpas.voted') : t('lanpas.vote')}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">{t('lanpas.noSuggestions')}</p>
          )}
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader
          title={t('lanpas.members')}
          action={
            isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
              >
                {t('lanpas.actions.invite')}
              </Button>
            )
          }
        />
        {lanpa.members && lanpa.members.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {lanpa.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3">
                  {member.user?.avatar_url ? (
                    <img
                      src={member.user.avatar_url}
                      alt={member.user.display_name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {member.user?.display_name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.user?.display_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      @{member.user?.username}
                    </p>
                  </div>
                </div>
                <span
                  className={`
                    px-2.5 py-1 text-xs font-medium rounded-full
                    ${
                      member.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : member.status === 'declined'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }
                  `}
                >
                  {member.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No members yet</p>
        )}
      </Card>

      {/* Lanpa Statistics - Show for completed lanpas */}
      {lanpa.status === 'completed' && (
        <Card>
          <CardHeader
            title={t('lanpas.statsSection', 'Statistics')}
            subtitle={t('lanpas.statsSubtitle', 'Summary of this lanpa')}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="p-2 bg-primary-100 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
                <UserGroupIcon className="h-6 w-6 text-primary-600" />
              </div>
              <p className="text-2xl font-bold text-primary-700">
                {lanpa.members?.filter((m) => m.status === 'confirmed').length || 0}
              </p>
              <p className="text-sm text-gray-500">{t('lanpas.attendance', 'Attendance')}</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
                <PuzzlePieceIcon className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-700">
                {lanpaGames?.total_games_suggested || 0}
              </p>
              <p className="text-sm text-gray-500">{t('lanpas.gamesSuggested', 'Games Suggested')}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
                <ChartBarIcon className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-700">
                {lanpa.game_votes?.length || 0}
              </p>
              <p className="text-sm text-gray-500">{t('lanpas.votesCast', 'Votes Cast')}</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="p-2 bg-red-100 rounded-full w-12 h-12 mx-auto flex items-center justify-center mb-2">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-700">
                {lanpaPunishments?.total_punishments || 0}
              </p>
              <p className="text-sm text-gray-500">{t('lanpas.punishments', 'Punishments')}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Games Section - Show for in_progress or completed */}
      {(lanpa.status === 'in_progress' || lanpa.status === 'completed') && lanpaGames && (
        <Card>
          <CardHeader
            title={t('lanpas.gamesSection', 'Games')}
            subtitle={t('lanpas.gamesSectionSubtitle', 'Games suggested and voted in this lanpa')}
          />
          {lanpaGames.games && lanpaGames.games.length > 0 ? (
            <div className="space-y-3">
              {lanpaGames.games.map((entry) => (
                <div
                  key={entry.game.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border
                    ${entry.is_winner ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}
                  `}
                >
                  {/* Winner badge */}
                  {entry.is_winner && (
                    <div className="flex-shrink-0">
                      <TrophyIcon className="h-6 w-6 text-yellow-500" />
                    </div>
                  )}
                  {/* Thumbnail */}
                  <div className="w-16 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {entry.game.cover_url ? (
                      <img
                        src={entry.game.cover_url}
                        alt={entry.game.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <PuzzlePieceIcon className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 truncate">
                        {entry.game.name}
                      </h4>
                      {entry.is_winner && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                          {t('lanpas.gameWinner', 'Winner')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {t('lanpas.suggestedBy', 'Suggested by')} {entry.suggested_by.display_name}
                    </p>
                  </div>
                  {/* Vote count */}
                  <span className="px-2 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
                    {t('lanpas.votesReceived', '{{count}} votes', { count: entry.votes_count })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              {t('lanpas.noGamesYet', 'No games suggested yet')}
            </p>
          )}
        </Card>
      )}

      {/* Punishments Section - Always show to members */}
      {lanpaPunishments && (
        <Card className={lanpaPunishments.punishments.length > 0 ? 'border-red-200' : ''}>
          <CardHeader
            title={t('lanpas.punishmentsSection', 'Punishments')}
            subtitle={t('lanpas.punishmentsSectionSubtitle', 'Punishments applied during this lanpa')}
          />
          {lanpaPunishments.punishments.length > 0 ? (
            <>
              <div className="space-y-3">
                {lanpaPunishments.punishments.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100"
                  >
                    {/* User avatar */}
                    {entry.user.avatar_url ? (
                      <img
                        src={entry.user.avatar_url}
                        alt={entry.user.display_name}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-red-700">
                          {entry.user.display_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{entry.user.display_name}</p>
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          {entry.punishment.severity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{entry.punishment.name}</p>
                      <p className="text-xs text-gray-500">{entry.reason}</p>
                    </div>
                    {/* Point impact */}
                    {entry.punishment.point_impact && (
                      <span className="text-sm font-semibold text-red-700">
                        -{entry.punishment.point_impact} pts
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-red-200 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {t('lanpas.totalPunishments', 'Total punishments')}: {lanpaPunishments.total_punishments}
                </span>
                <span className="text-sm font-semibold text-red-700">
                  {t('lanpas.totalPointImpact', 'Total impact')}: -{lanpaPunishments.total_point_impact} pts
                </span>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-4">
              {t('lanpas.noPunishmentsYet', 'No punishments applied')}
            </p>
          )}
        </Card>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Lanpa"
        size="sm"
      >
        <p className="text-gray-500">
          Are you sure you want to delete this lanpa? This action cannot be
          undone.
        </p>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteMutation.mutate(id!, { onSuccess: () => navigate('/lanpas') })}
            isLoading={deleteMutation.isPending}
          >
            {t('common.delete')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={t('lanpas.editLanpa')}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label={t('lanpas.name')}
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            placeholder={t('lanpas.namePlaceholder')}
          />
          <Textarea
            label={t('lanpas.description')}
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder={t('lanpas.descriptionPlaceholder')}
            rows={3}
          />
          <Input
            label={t('lanpas.scheduledDate')}
            type="datetime-local"
            value={editForm.scheduled_date}
            onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleEditSubmit}
            isLoading={updateLanpaMutation.isPending}
            disabled={!editForm.name.trim()}
          >
            {t('common.save')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Invite Members Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setSelectedUserIds([]);
          setUserSearch('');
          setEmailInvites([]);
          setCurrentEmail('');
          setEmailError('');
        }}
        title={t('lanpas.inviteMembers')}
        size="md"
      >
        <div className="space-y-4">
          {/* Selected users chips */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {getSelectedUsers().map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                >
                  {u.display_name || u.username}
                  <button
                    onClick={() => toggleUserSelection(u.id)}
                    className="hover:text-indigo-900"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder={t('lanpas.searchUsers')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Search results */}
          {userSearch.length >= 2 && (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y">
              {filteredSearchResults && filteredSearchResults.length > 0 ? (
                filteredSearchResults.map((u) => (
                  <div
                    key={u.id}
                    className={`
                      flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50
                      ${selectedUserIds.includes(u.id) ? 'bg-indigo-50' : ''}
                    `}
                    onClick={() => toggleUserSelection(u.id)}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.display_name} className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {(u.display_name || u.username)?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{u.display_name}</p>
                      <p className="text-sm text-gray-500">@{u.username}</p>
                    </div>
                    {selectedUserIds.includes(u.id) && (
                      <CheckIcon className="h-5 w-5 text-indigo-600" />
                    )}
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-gray-500">{t('lanpas.noUsersFound')}</p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">{t('lanpas.inviteByEmail')}</span>
            </div>
          </div>

          {/* Email invite section */}
          <div className="space-y-3">
            {/* Email chips */}
            {emailInvites.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {emailInvites.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="hover:text-green-900"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Email input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="email"
                  value={currentEmail}
                  onChange={(e) => {
                    setCurrentEmail(e.target.value);
                    setEmailError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  placeholder={t('lanpas.emailPlaceholder')}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    emailError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-500">{emailError}</p>
                )}
              </div>
              <Button
                variant="secondary"
                onClick={handleAddEmail}
                disabled={!currentEmail.trim()}
              >
                {t('lanpas.addEmail')}
              </Button>
            </div>

            {emailInvites.length === 0 && (
              <p className="text-sm text-gray-500 text-center">{t('lanpas.noEmailsAdded')}</p>
            )}

            {/* Send email invites button */}
            {emailInvites.length > 0 && (
              <Button
                onClick={handleEmailInviteSubmit}
                isLoading={inviteByEmailMutation.isPending}
                className="w-full"
              >
                {t('lanpas.sendInvitations')} ({emailInvites.length})
              </Button>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsInviteModalOpen(false);
              setSelectedUserIds([]);
              setUserSearch('');
              setEmailInvites([]);
              setCurrentEmail('');
              setEmailError('');
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleInviteSubmit}
            isLoading={inviteUsersMutation.isPending}
            disabled={selectedUserIds.length === 0}
          >
            {t('lanpas.actions.invite')} ({selectedUserIds.length})
          </Button>
        </ModalFooter>
      </Modal>

      {/* Suggest Game Modal */}
      <Modal
        isOpen={isSuggestModalOpen}
        onClose={() => {
          setIsSuggestModalOpen(false);
          setGameSearch('');
        }}
        title={t('lanpas.suggestGame')}
        size="lg"
      >
        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={gameSearch}
              onChange={(e) => setGameSearch(e.target.value)}
              placeholder={t('games.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Games grid */}
          <div className="max-h-96 overflow-y-auto">
            {filteredGames && filteredGames.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredGames.map((game: Game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onClick={() => handleSuggestGame(game.id)}
                    showStats={false}
                  />
                ))}
              </div>
            ) : gameSearch ? (
              <p className="text-center text-gray-500 py-8">{t('games.noGamesFound')}</p>
            ) : (
              <p className="text-center text-gray-500 py-8">{t('games.searchToSuggest')}</p>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setIsSuggestModalOpen(false);
              setGameSearch('');
            }}
          >
            {t('common.cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
