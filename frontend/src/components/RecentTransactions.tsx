import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyINR, formatTime, safeText } from '../utils/format';

interface Tx {
  id: string;
  customer: string;
  amount: number;
  channel: string;
  location: string;
  timestamp: string;
}

const RecentTransactions: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['recentTx'],
    queryFn: async () => {
      const res = await apiClient.get<Tx[]>('/recent-transactions?limit=10');
      return res.data;
    },
    refetchInterval: 5000,
  });

  const handleRowClick = (txId: string) => {
    navigate(`/investigation/${txId}`);
  };

  if (isLoading) return <div className="text-sm text-[#9ca3af]">Loading…</div>;
  if (error) return <div className="text-sm text-[#f28b82]">Unable to load transactions.</div>;
  if (!data || data.length === 0) return <div className="text-sm text-[#9ca3af]">No transactions available.</div>;

  return (
    <div className="rounded-3xl bg-[#16171a] p-4 text-[#e3e3e3]">
      <div className="flex items-center justify-between gap-4 border-b border-[#2f3032] pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#e3e3e3]">
          <Activity size={16} className="text-[#8ab4f8]" />
          Recent transactions
        </div>
        <span className="text-xs text-[#9ca3af]">Live</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#9ca3af] uppercase tracking-[0.16em]">
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Channel</th>
              <th className="pb-3 pr-4">Location</th>
              <th className="pb-3 pr-4">Time</th>
              <th className="pb-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2f3032]">
            {data.map((tx) => (
              <tr
                key={tx.id}
                className="cursor-pointer transition hover:bg-[#131314]"
                onClick={() => handleRowClick(tx.id)}
              >
                <td className="py-3 pr-4 font-semibold text-[#8ab4f8] whitespace-nowrap">{formatCurrencyINR(tx.amount)}</td>
                <td className="py-3 pr-4 text-[#e3e3e3] whitespace-nowrap">{safeText(tx.channel)}</td>
                <td className="py-3 pr-4 text-[#e3e3e3] min-w-[10rem]">{safeText(tx.location)}</td>
                <td className="py-3 pr-4 text-[#9ca3af] whitespace-nowrap">{formatTime(tx.timestamp)}</td>
                <td className="py-3 text-right">
                  <span className="inline-flex rounded-full bg-[#8ab4f8]/10 px-3 py-1 text-xs font-semibold text-[#8ab4f8]">Investigate</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransactions;
