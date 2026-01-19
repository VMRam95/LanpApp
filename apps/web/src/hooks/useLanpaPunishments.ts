import { useQuery } from '@tanstack/react-query';
import type { LanpaPunishmentsResponse } from '@lanpapp/shared';
import { api } from '../services/api';

// Query keys
export const lanpaPunishmentsKeys = {
  all: ['lanpa-punishments'] as const,
  byLanpa: (lanpaId: string) => [...lanpaPunishmentsKeys.all, lanpaId] as const,
};

// Fetch punishments for a specific lanpa
export function useLanpaPunishments(lanpaId: string) {
  return useQuery({
    queryKey: lanpaPunishmentsKeys.byLanpa(lanpaId),
    queryFn: async () => {
      const response = await api.get<{ data: LanpaPunishmentsResponse }>(`/lanpas/${lanpaId}/punishments`);
      return response.data.data;
    },
    enabled: !!lanpaId,
  });
}
