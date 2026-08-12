import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { LiveTransactionItem } from '../types/dashboard';

const normalizeTransaction = (tx: LiveTransactionItem): LiveTransactionItem => {
  const amount = typeof tx.amount === 'string' ? Number(tx.amount) : tx.amount ?? 0;
  const score = typeof tx.risk_score === 'string' ? Number(tx.risk_score) : tx.risk_score ?? 0;
  const decision = tx.decision || (score >= 70 ? 'BLOCK' : score >= 40 ? 'REVIEW' : 'ALLOW');
  const risk_level = tx.risk_level || (score >= 85 ? 'Critical' : score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low');

  return {
    ...tx,
    amount,
    risk_score: Number.isFinite(score) ? score : 0,
    risk_level,
    decision,
    customer_id: tx.customer_id || 'Unknown',
    source_account: tx.source_account || 'Unknown',
    beneficiary_account: tx.beneficiary_account || 'Unknown',
    device_id: tx.device_id || 'Unknown',
    location: tx.location || 'Unknown',
    channel: tx.channel || 'Unknown',
    timestamp: tx.timestamp || new Date().toISOString(),
  };
};

export const useLiveTransactions = () => {
  const [transactions, setTransactions] = useState<LiveTransactionItem[]>([]);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(null);

  const query = useQuery<LiveTransactionItem[]>({
    queryKey: ['recentTransactions'],
    queryFn: async () => {
      const { data } = await apiClient.get<LiveTransactionItem[]>('/recent-transactions?limit=24');
      return data.map(normalizeTransaction);
    },
    refetchInterval: 3000,
    staleTime: 1500,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    const incoming = query.data;
    const existingIds = new Set(transactions.map((tx) => tx.transaction_id));
    const newItems = incoming.filter((tx) => !existingIds.has(tx.transaction_id));

    if (transactions.length === 0) {
      setTransactions(incoming.slice(0, 24));
      if (incoming.length) {
        setLastReceivedAt(new Date());
      }
      return;
    }

    if (newItems.length > 0) {
      setTransactions((prev) => [...newItems, ...prev].slice(0, 24));
      setLastReceivedAt(new Date());
      setHighlightedIds(newItems.map((tx) => tx.transaction_id));
      return;
    }

    setTransactions(incoming.slice(0, 24));
  }, [query.data]);

  useEffect(() => {
    if (highlightedIds.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedIds([]);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [highlightedIds]);

  return {
    transactions,
    highlightedIds,
    lastReceivedAt,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
};
