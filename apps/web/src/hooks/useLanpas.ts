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
import { showToast, toastMessages } from '../lib/toast';
import { useLoadingOverlay } from '../components/ui';

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
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (data: CreateLanpaRequest) => {
      showLoading('Creating lanpa...');
      const response = await api.post<{ data: Lanpa }>('/lanpas', data);
      return response.data.data;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
      showToast.success(toastMessages.created('Lanpa'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('create lanpa'));
    },
  });
}

// Update lanpa
export function useUpdateLanpa() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateLanpaRequest }) => {
      showLoading('Updating lanpa...');
      const response = await api.patch<{ data: Lanpa }>(`/lanpas/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
      showToast.success(toastMessages.updated('Lanpa'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('update lanpa'));
    },
  });
}

// Delete lanpa
export function useDeleteLanpa() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (id: string) => {
      showLoading('Deleting lanpa...');
      await api.delete(`/lanpas/${id}`);
      return id;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
      showToast.success(toastMessages.deleted('Lanpa'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('delete lanpa'));
    },
  });
}

// Update lanpa status
export function useUpdateLanpaStatus() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LanpaStatus }) => {
      showLoading('Updating status...');
      const response = await api.patch<{ data: Lanpa }>(`/lanpas/${id}/status`, { status });
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaPunishmentsKeys.byLanpa(data.id) });
      showToast.success('Status updated successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('update status'));
    },
  });
}

// Create invite link
export function useCreateInviteLink() {
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, expiresInHours, maxUses }: { id: string; expiresInHours?: number; maxUses?: number }) => {
      showLoading('Creating invite link...');
      const response = await api.post(`/lanpas/${id}/invite-link`, {
        expires_in_hours: expiresInHours,
        max_uses: maxUses,
      });
      return response.data.data;
    },
    onSuccess: () => {
      hideLoading();
      showToast.success('Invite link created successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('create invite link'));
    },
  });
}

// Invite users directly
export function useInviteUsers() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, userIds }: { id: string; userIds: string[] }) => {
      showLoading('Sending invitations...');
      const response = await api.post(`/lanpas/${id}/invite-users`, { user_ids: userIds });
      return response.data.data;
    },
    onSuccess: (_, { id }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(id) });
      showToast.success('Invitations sent successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('send invitations'));
    },
  });
}

// Invite by email
export function useInviteByEmail() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, emails }: { id: string; emails: string[] }) => {
      showLoading('Sending email invitations...');
      const response = await api.post<{
        data: { email: string; status: 'sent' | 'invited_existing' | 'failed'; error?: string }[];
      }>(`/lanpas/${id}/invite-by-email`, { emails });
      return response.data.data;
    },
    onSuccess: (_, { id }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(id) });
      showToast.success('Email invitations sent');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('send email invitations'));
    },
  });
}

// Join via token
export function useJoinLanpa() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (token: string) => {
      showLoading('Joining lanpa...');
      const response = await api.post<{ data: Lanpa }>(`/lanpas/join/${token}`);
      return response.data.data;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.lists() });
      showToast.success('Successfully joined the lanpa!');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('join lanpa'));
    },
  });
}

// Suggest game
export function useSuggestGame() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ lanpaId, gameId }: { lanpaId: string; gameId: string }) => {
      showLoading('Suggesting game...');
      const response = await api.post(`/lanpas/${lanpaId}/suggest-game`, { game_id: gameId });
      return response.data.data;
    },
    onSuccess: (_, { lanpaId }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(lanpaId) });
      showToast.success('Game suggested successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('suggest game'));
    },
  });
}

// Vote for game
export function useVoteGame() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ lanpaId, gameId }: { lanpaId: string; gameId: string }) => {
      showLoading('Registering vote...');
      const response = await api.post(`/lanpas/${lanpaId}/vote-game`, { game_id: gameId });
      return response.data.data;
    },
    onSuccess: (_, { lanpaId }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(lanpaId) });
      showToast.success('Vote registered');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('vote for game'));
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
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ lanpaId, ratings, lanpaRating }: {
      lanpaId: string;
      ratings: { to_user_id: string; score: number; comment?: string }[];
      lanpaRating?: { score: number; comment?: string };
    }) => {
      showLoading('Submitting ratings...');
      const response = await api.post(`/lanpas/${lanpaId}/rate`, {
        ratings,
        lanpa_rating: lanpaRating,
      });
      return response.data;
    },
    onSuccess: (_, { lanpaId }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      showToast.success('Ratings submitted successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('submit ratings'));
    },
  });
}

// Update member status
export function useUpdateMemberStatus() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ lanpaId, memberId, status }: { lanpaId: string; memberId: string; status: string }) => {
      showLoading('Updating member status...');
      const response = await api.patch(`/lanpas/${lanpaId}/members/${memberId}/status`, { status });
      return response.data.data;
    },
    onSuccess: (_, { lanpaId }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      showToast.success('Member status updated');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('update member status'));
    },
  });
}

// Remove member from lanpa
export function useRemoveMember() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ lanpaId, memberId }: { lanpaId: string; memberId: string }) => {
      showLoading('Removing member...');
      await api.delete(`/lanpas/${lanpaId}/members/${memberId}`);
      return memberId;
    },
    onSuccess: (_, { lanpaId }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(lanpaId) });
      showToast.success('Member removed successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('remove member'));
    },
  });
}

// Select game manually (admin override)
export function useSelectGame() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ lanpaId, gameId }: { lanpaId: string; gameId: string }) => {
      showLoading('Selecting game...');
      const response = await api.patch(`/lanpas/${lanpaId}/select-game`, { game_id: gameId });
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: lanpaKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: lanpaGamesKeys.byLanpa(data.id) });
      showToast.success('Game selected successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('select game'));
    },
  });
}
