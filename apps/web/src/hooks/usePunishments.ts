import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Punishment,
  PunishmentNomination,
  CreatePunishmentRequest,
  PunishmentSeverity,
} from '@lanpapp/shared';
import { api } from '../services/api';
import { lanpaPunishmentsKeys } from './useLanpaPunishments';
import { showToast, toastMessages } from '../lib/toast';
import { useLoadingOverlay } from '../components/ui';

// Query keys
export const punishmentKeys = {
  all: ['punishments'] as const,
  lists: () => [...punishmentKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...punishmentKeys.lists(), filters] as const,
  details: () => [...punishmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...punishmentKeys.details(), id] as const,
  userPunishments: (userId: string) => [...punishmentKeys.all, 'user', userId] as const,
};

export const nominationKeys = {
  all: ['nominations'] as const,
  detail: (id: string) => [...nominationKeys.all, 'detail', id] as const,
  byLanpa: (lanpaId: string) => [...nominationKeys.all, 'lanpa', lanpaId] as const,
};

// Fetch all punishments
export function usePunishments(filters?: { severity?: PunishmentSeverity; page?: number; limit?: number }) {
  return useQuery({
    queryKey: punishmentKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.severity) params.set('severity', filters.severity);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));

      const response = await api.get(`/punishments?${params.toString()}`);
      return response.data;
    },
  });
}

// Fetch single punishment
export function usePunishment(id: string) {
  return useQuery({
    queryKey: punishmentKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: Punishment }>(`/punishments/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

// Create punishment
export function useCreatePunishment() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (data: CreatePunishmentRequest) => {
      showLoading('Creating punishment...');
      const response = await api.post<{ data: Punishment }>('/punishments', data);
      return response.data.data;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: punishmentKeys.lists() });
      showToast.success(toastMessages.created('Punishment'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('create punishment'));
    },
  });
}

// Update punishment
export function useUpdatePunishment() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePunishmentRequest> }) => {
      showLoading('Updating punishment...');
      const response = await api.patch<{ data: Punishment }>(`/punishments/${id}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: punishmentKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: punishmentKeys.lists() });
      showToast.success(toastMessages.updated('Punishment'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('update punishment'));
    },
  });
}

// Delete punishment
export function useDeletePunishment() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (id: string) => {
      showLoading('Deleting punishment...');
      await api.delete(`/punishments/${id}`);
      return id;
    },
    onSuccess: () => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: punishmentKeys.lists() });
      showToast.success(toastMessages.deleted('Punishment'));
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('delete punishment'));
    },
  });
}

// Get user punishments
export function useUserPunishments(userId: string) {
  return useQuery({
    queryKey: punishmentKeys.userPunishments(userId),
    queryFn: async () => {
      const response = await api.get(`/punishments/users/${userId}`);
      return response.data.data;
    },
    enabled: !!userId,
  });
}

// Fetch nomination
export function useNomination(id: string) {
  return useQuery({
    queryKey: nominationKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<{ data: PunishmentNomination }>(`/nominations/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

// Fetch nominations by lanpa
export function useLanpaNominations(lanpaId: string, status?: string) {
  return useQuery({
    queryKey: [...nominationKeys.byLanpa(lanpaId), status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const response = await api.get(`/nominations/lanpa/${lanpaId}${params}`);
      return response.data.data;
    },
    enabled: !!lanpaId,
  });
}

// Create nomination
export function useCreateNomination() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (data: {
      lanpa_id: string;
      punishment_id: string;
      nominated_user_id: string;
      reason: string;
      voting_hours?: number;
    }) => {
      showLoading('Creating nomination...');
      const response = await api.post<{ data: PunishmentNomination }>('/nominations', data);
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: nominationKeys.byLanpa(data.lanpa_id) });
      showToast.success('Nomination created successfully');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('create nomination'));
    },
  });
}

// Vote on nomination
export function useVoteNomination() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async ({ id, vote }: { id: string; vote: boolean }) => {
      showLoading('Registering vote...');
      const response = await api.post(`/nominations/${id}/vote`, { vote });
      return response.data.data;
    },
    onSuccess: (_, { id }) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: nominationKeys.detail(id) });
      showToast.success('Vote registered');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('vote on nomination'));
    },
  });
}

// Finalize nomination
export function useFinalizeNomination() {
  const queryClient = useQueryClient();
  const { showLoading, hideLoading } = useLoadingOverlay();

  return useMutation({
    mutationFn: async (id: string) => {
      showLoading('Finalizing nomination...');
      const response = await api.post(`/nominations/${id}/finalize`);
      return response.data.data;
    },
    onSuccess: (data) => {
      hideLoading();
      queryClient.invalidateQueries({ queryKey: nominationKeys.detail(data.nomination_id) });
      queryClient.invalidateQueries({ queryKey: nominationKeys.all });
      queryClient.invalidateQueries({ queryKey: lanpaPunishmentsKeys.all });
      showToast.success('Nomination finalized');
    },
    onError: () => {
      hideLoading();
      showToast.error(toastMessages.error('finalize nomination'));
    },
  });
}
