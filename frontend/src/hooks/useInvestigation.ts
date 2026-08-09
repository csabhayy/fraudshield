import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { InvestigationResult } from '../stores/investigationStore';

export interface InvestigationStageUpdate {
  stage: string;
  status: 'started' | 'completed' | 'failed';
  duration_ms?: number;
  output?: Record<string, unknown>;
  error?: string;
}

export interface InvestigationStreamHandlers {
  onStarted?: (payload: { transaction_id: string; case_id: string; created_at: string }) => void;
  onStageUpdate?: (update: InvestigationStageUpdate) => void;
  onResult?: (result: InvestigationResult) => void;
  onDone?: (payload: { transaction_id: string; case_id: string }) => void;
  onError?: (payload: { message: string; status_code?: number }) => void;
}

const parseEventData = <T>(data: string): T | null => {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
};

export const streamInvestigation = (
  transactionId: string,
  handlers: InvestigationStreamHandlers,
): (() => void) => {
  const source = new EventSource(`/api/investigate/stream/${encodeURIComponent(transactionId)}`);

  source.addEventListener('investigation_started', (event) => {
    const payload = parseEventData<{ transaction_id: string; case_id: string; created_at: string }>(
      (event as MessageEvent).data,
    );
    if (payload) {
      handlers.onStarted?.(payload);
    }
  });

  source.addEventListener('stage_update', (event) => {
    const payload = parseEventData<InvestigationStageUpdate>((event as MessageEvent).data);
    if (payload) {
      handlers.onStageUpdate?.(payload);
    }
  });

  source.addEventListener('investigation_result', (event) => {
    const payload = parseEventData<InvestigationResult>((event as MessageEvent).data);
    if (payload) {
      handlers.onResult?.(payload);
    }
  });

  source.addEventListener('investigation_done', (event) => {
    const payload = parseEventData<{ transaction_id: string; case_id: string }>((event as MessageEvent).data);
    if (payload) {
      handlers.onDone?.(payload);
    }
    source.close();
  });

  source.addEventListener('investigation_error', (event) => {
    const payload = parseEventData<{ message: string; status_code?: number }>((event as MessageEvent).data);
    if (payload) {
      handlers.onError?.(payload);
    }
    source.close();
  });

  source.onerror = () => {
    handlers.onError?.({
      message: 'Investigation stream disconnected unexpectedly.',
    });
    source.close();
  };

  return () => {
    source.close();
  };
};

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