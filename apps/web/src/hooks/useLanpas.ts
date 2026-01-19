import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Lanpa,
  LanpaWithRelations,
  CreateLanpaRequest,
  UpdateLanpaRequest,
  LanpaStatus,
} from '@lanpapp/shared';
import { api } from '../services/api';
import { lanpaGamesKeys } from './useLanpaGames';
import { lanpaPunishmentsKeys } from './useLanpaPunishments';

// Query keys
export const lanpaKeys = {
  all: ['lanpas'] as const,
  lists: () => [...lanpaKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...lanpaKeys.lists(), filters] as const,
  details: () => [...lanpaKeys.all, 'detail'] as const,
  detail: (id: string) => [...lanpaKeys.details(), id] as const,
};

// Fetch all lanpas
export function useLanpas(filters?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: lanpaKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));

      const response = await api.get(`/lanpas?${params.toString()}`);
      return response.data;
    },
  });
}

// Fetch single lanpa
export function useLanpa(id: string) {
  return useQuery({
    queryKey: lanpaKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: LanpaWithRelations }>(`/lanpas/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

// Create lanpa
export function useCreateLanpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLanpaRequest) => {
      const response = await api.post<{ data: Lanpa }>('/lanpas', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
    },
  });
}

// Update lanpa
export function useUpdateLanpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateLanpaRequest }) => {
      const response = await api.patch<{ data: Lanpa }>(`/lanpas/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
    },
  });
}

// Delete lanpa
export function useDeleteLanpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/lanpas/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
    },
  });
}

// Update lanpa status
export function useUpdateLanpaStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LanpaStatus }) => {
      const response = await api.patch<{ data: Lanpa }>(`/lanpas/${id}/status`, { status });
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaPunishmentsKeys.byLanpa(data.id) });
    },
  });
}

// Create invite link
export function useCreateInviteLink() {
  return useMutation({
    mutationFn: async ({ id, expiresInHours, maxUses }: { id: string; expiresInHours?: number; maxUses?: number }) => {
      const response = await api.post(`/lanpas/${id}/invite-link`, {
        expires_in_hours: expiresInHours,
        max_uses: maxUses,
      });
      return response.data.data;
    },
  });
}

// Invite users directly
export function useInviteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userIds }: { id: string; userIds: string[] }) => {
      const response = await api.post(`/lanpas/${id}/invite-users`, { user_ids: userIds });
      return response.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(id) });
    },
  });
}

// Invite by email
export function useInviteByEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, emails }: { id: string; emails: string[] }) => {
      const response = await api.post<{
        data: { email: string; status: 'sent' | 'invited_existing' | 'failed'; error?: string }[];
      }>(`/lanpas/${id}/invite-by-email`, { emails });
      return response.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(id) });
    },
  });
}

// Join via token
export function useJoinLanpa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await api.post<{ data: Lanpa }>(`/lanpas/join/${token}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
    },
  });
}

// Suggest game
export function useSuggestGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lanpaId, gameId }: { lanpaId: string; gameId: string }) => {
      const response = await api.post(`/lanpas/${lanpaId}/suggest-game`, { game_id: gameId });
      return response.data.data;
    },
    onSuccess: (_, { lanpaId }) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(lanpaId) });
    },
  });
}

// Vote for game
export function useVoteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lanpaId, gameId }: { lanpaId: string; gameId: string }) => {
      const response = await api.post(`/lanpas/${lanpaId}/vote-game`, { game_id: gameId });
      return response.data.data;
    },
    onSuccess: (_, { lanpaId }) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(lanpaId) });
    },
  });
}

// Get game results
export function useGameResults(lanpaId: string) {
  return useQuery({
    queryKey: [...lanpaKeys.detail(lanpaId), 'game-results'],
    queryFn: async () => {
      const response = await api.get(`/lanpas/${lanpaId}/game-results`);
      return response.data.data;
    },
    enabled: !!lanpaId,
  });
}

// Submit ratings
export function useSubmitRatings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lanpaId, ratings, lanpaRating }: {
      lanpaId: string;
      ratings: { to_user_id: string; score: number; comment?: string }[];
      lanpaRating?: { score: number; comment?: string };
    }) => {
      const response = await api.post(`/lanpas/${lanpaId}/rate`, {
        ratings,
        lanpa_rating: lanpaRating,
      });
      return response.data;
    },
    onSuccess: (_, { lanpaId }) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
    },
  });
}

// Update member status
export function useUpdateMemberStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lanpaId, memberId, status }: { lanpaId: string; memberId: string; status: string }) => {
      const response = await api.patch(`/lanpas/${lanpaId}/members/${memberId}/status`, { status });
      return response.data.data;
    },
    onSuccess: (_, { lanpaId }) => {
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
    },
  });
}
