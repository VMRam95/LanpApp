import { useQuery } from '@tanstack/react-query';
import type { LanpaGamesResponse } from '@lanpapp/shared';
import { api } from '../services/api';

// Query keys
export const lanpaGamesKeys = {
  all: ['lanpa-games'] as const,
  byLanpa: (lanpaId: string) => [...lanpaGamesKeys.all, lanpaId] as const,
};

// Fetch games for a specific lanpa
export function useLanpaGames(lanpaId: string) {
  return useQuery({
    queryKey: lanpaGamesKeys.byLanpa(lanpaId),
    queryFn: async () => {
      const response = await api.get<{ data: LanpaGamesResponse }>(`/lanpas/${lanpaId}/games`);
      return response.data.data;
    },
    enabled: !!lanpaId,
  });
}
