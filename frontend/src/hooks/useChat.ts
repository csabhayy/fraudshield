import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export const useChat = () => {
  return useMutation({
    mutationFn: async ({ caseId, query }: { caseId: string; query: string }) => {
      const { data } = await apiClient.post<{ response: string }>('/chat', {
        case_id: caseId,
        query,
      });
      return data.response;
    },
  });
};