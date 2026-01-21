import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Game, GameWithStats, CreateGameRequest, UpdateGameRequest } from '@lanpapp/shared';
import { api } from '../services/api';
import { showToast, toastMessages } from '../lib/toast';
import { useLoadingOverlay } from '../components/ui';

// Query keys
export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...gameKeys.lists(), filters] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: string) => [...gameKeys.details(), id] as const,
  genres: () => [...gameKeys.all, 'genres'] as const,
  random: (filters: Record<string, unknown>) => [...gameKeys.all, 'random', filters] as const,
};

interface GamesFilters {
  page?: number;
  limit?: number;
  genre?: string;
  min_players?: number;
  max_players?: number;
  search?: string;
  [key: string]: unknown;
}

// Fetch all games
export function useGames(filters?: GamesFilters) {
  return useQuery({
    queryKey: gameKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.genre) params.set('genre', filters.genre);
      if (filters?.min_players) params.set('min_players', String(filters.min_players));
      if (filters?.max_players) params.set('max_players', String(filters.max_players));
      if (filters?.search) params.set('search', filters.search);

      const response = await api.get(`/games?${params.toString()}`);
      return response.data;
    },
  });
}

// Fetch single game
export function useGame(id: string) {
  return useQuery({
    queryKey: gameKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: GameWithStats }>(`/games/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

// Fetch genres
export function useGameGenres() {
  return useQuery({
    queryKey: gameKeys.genres(),
    queryFn: async () => {
      const response = await api.get<{ data: string[] }>('/games/genres');
      return response.data.data;
    },
  });
}

// Get random game
export function useRandomGame(filters?: { genre?: string; min_players?: number; max_players?: number }) {
  return useQuery({
    queryKey: gameKeys.random(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.genre) params.set('genre', filters.genre);
      if (filters?.min_players) params.set('min_players', String(filters.min_players));
      if (filters?.max_players) params.set('max_players', String(filters.max_players));

      const response = await api.get<{ data: Game }>(`/games/random?${params.toString()}`);
      return response.data.data;
    },
    enabled: false, // Only fetch on demand
  });
}

// Create game
export function useCreateGame() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (data: CreateGameRequest) => {
      showLoading('Creating game...');
      const response = await api.post<{ data: Game }>('/games', data);
      return response.data.data;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gameKeys.genres() });
      showToast.success(toastMessages.created('Game'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('create game'));
    },
  });
}

// Update game
export function useUpdateGame() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGameRequest }) => {
      showLoading('Updating game...');
      const response = await api.patch<{ data: Game }>(`/games/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gameKeys.genres() });
      showToast.success(toastMessages.updated('Game'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('update game'));
    },
  });
}

// Delete game
export function useDeleteGame() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (id: string) => {
      showLoading('Deleting game...');
      await api.delete(`/games/${id}`);
      return id;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gameKeys.genres() });
      showToast.success(toastMessages.deleted('Game'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('delete game'));
    },
  });
}

// Upload game cover
export function useUploadGameCover() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, image, contentType }: { id: string; image: string; contentType: string }) => {
      showLoading('Uploading cover...');
      const response = await api.post<{ data: Game }>(`/games/${id}/cover`, { image, contentType });
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      showToast.success('Game cover uploaded successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('upload game cover'));
    },
  });
}
