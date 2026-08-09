import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { DashboardStats } from '../types/dashboard';

export const useDashboardStats = () => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardStats>('/dashboard/stats');
      return data;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 2000,
  });
};