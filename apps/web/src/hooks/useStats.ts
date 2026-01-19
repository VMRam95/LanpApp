import { useQuery } from '@tanstack/react-query';
import type { GlobalStats, LanpaStats, UserStats, RankingsResponse, PersonalStats } from '@lanpapp/shared';
import { api } from '../services/api';

// Query keys
export const statsKeys = {
  all: ['stats'] as const,
  personal: () => [...statsKeys.all, 'personal'] as const,
  global: () => [...statsKeys.all, 'global'] as const,
  lanpa: (id: string) => [...statsKeys.all, 'lanpa', id] as const,
  user: (id: string) => [...statsKeys.all, 'user', id] as const,
  rankings: () => [...statsKeys.all, 'rankings'] as const,
};

// Fetch personal stats for authenticated user
export function usePersonalStats() {
  return useQuery({
    queryKey: statsKeys.personal(),
    queryFn: async () => {
      const response = await api.get<{ data: PersonalStats }>('/stats/personal');
      return response.data.data;
    },
  });
}

// Fetch global stats
export function useGlobalStats() {
  return useQuery({
    queryKey: statsKeys.global(),
    queryFn: async () => {
      const response = await api.get<{ data: GlobalStats }>('/stats/global');
      return response.data.data;
    },
  });
}

// Fetch lanpa stats
export function useLanpaStats(lanpaId: string) {
  return useQuery({
    queryKey: statsKeys.lanpa(lanpaId),
    queryFn: async () => {
      const response = await api.get<{ data: LanpaStats }>(`/stats/lanpas/${lanpaId}`);
      return response.data.data;
    },
    enabled: !!lanpaId,
  });
}

// Fetch user stats
export function useUserStats(userId: string) {
  return useQuery({
    queryKey: statsKeys.user(userId),
    queryFn: async () => {
      const response = await api.get<{ data: UserStats }>(`/stats/users/${userId}`);
      return response.data.data;
    },
    enabled: !!userId,
  });
}

// Fetch rankings
export function useRankings() {
  return useQuery({
    queryKey: statsKeys.rankings(),
    queryFn: async () => {
      const response = await api.get<{ data: RankingsResponse }>('/stats/rankings');
      return response.data.data;
    },
  });
}
