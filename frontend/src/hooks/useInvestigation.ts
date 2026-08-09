import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { InvestigationResult } from '../stores/investigationStore';

export const useInvestigate = () => {
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data } = await apiClient.post<InvestigationResult>('/investigate', {
        transaction_id: transactionId,
      });
      return data;
    },
  });
};