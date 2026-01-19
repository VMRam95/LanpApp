import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Game, GameWithStats, CreateGameRequest, UpdateGameRequest } from '@lanpapp/shared';
import { api } from '../services/api';

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

  return useMutation({
    mutationFn: async (data: CreateGameRequest) => {
      const response = await api.post<{ data: Game }>('/games', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gameKeys.genres() });
    },
  });
}

// Update game
export function useUpdateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGameRequest }) => {
      const response = await api.patch<{ data: Game }>(`/games/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gameKeys.genres() });
    },
  });
}

// Delete game
export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/games/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
      queryClient.invalidateQueries({ queryKey: gameKeys.genres() });
    },
  });
}

// Upload game cover
export function useUploadGameCover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, image, contentType }: { id: string; image: string; contentType: string }) => {
      const response = await api.post<{ data: Game }>(`/games/${id}/cover`, { image, contentType });
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
    },
  });
}
