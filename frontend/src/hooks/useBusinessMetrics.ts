import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface MetricValue {
  available: boolean;
  value?: number;
  currency?: string;
  transactionCount?: number;
  definition?: string;
  dataSource?: string;
  calculationWindow?: string;
  lastUpdated?: string;
  underlyingRecords?: any[];
  reason?: string;
}

export interface DetectionRateMetric {
  available: boolean;
  rate?: number;
  ratePercentage?: number;
  detectedFraudCount?: number;
  confirmedFraudCount?: number;
  definition?: string;
  dataSource?: string;
  calculationWindow?: string;
  lastUpdated?: string;
  reason?: string;
}

export interface ReviewQueueMetric {
  available: boolean;
  count?: number;
  definition?: string;
  dataSource?: string;
  calculationWindow?: string;
  lastUpdated?: string;
}

export interface AllMetrics {
  timestamp: string;
  moneyAtRisk: MetricValue;
  fraudPrevented: MetricValue;
  fraudLoss: MetricValue;
  detectionRate: DetectionRateMetric;
  reviewQueue: ReviewQueueMetric;
}

export const useBusinessMetrics = () => {
  return useQuery<AllMetrics>({
    queryKey: ['businessMetrics'],
    queryFn: async () => {
      const { data } = await apiClient.get<AllMetrics>('/metrics/all');
      return data;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 2000,
  });
};

export const useMoneyAtRisk = () => {
  return useQuery<MetricValue>({
    queryKey: ['metric.moneyAtRisk'],
    queryFn: async () => {
      const { data } = await apiClient.get<MetricValue>('/metrics/money-at-risk');
      return data;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};

export const useFraudPrevented = () => {
  return useQuery<MetricValue>({
    queryKey: ['metric.fraudPrevented'],
    queryFn: async () => {
      const { data } = await apiClient.get<MetricValue>('/metrics/fraud-prevented');
      return data;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};

export const useFraudLoss = () => {
  return useQuery<MetricValue>({
    queryKey: ['metric.fraudLoss'],
    queryFn: async () => {
      const { data } = await apiClient.get<MetricValue>('/metrics/fraud-loss');
      return data;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};

export const useDetectionRate = () => {
  return useQuery<DetectionRateMetric>({
    queryKey: ['metric.detectionRate'],
    queryFn: async () => {
      const { data } = await apiClient.get<DetectionRateMetric>('/metrics/detection-rate');
      return data;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};

export const useReviewQueue = () => {
  return useQuery<ReviewQueueMetric>({
    queryKey: ['metric.reviewQueue'],
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewQueueMetric>('/metrics/review-queue');
      return data;
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });
};
