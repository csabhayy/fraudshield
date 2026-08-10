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

  if (isLoading) return <div className="text-gray-500 text-sm">Loading live feed...</div>;
  if (error) return <div className="text-red-500 text-sm">Failed to load feed.</div>;
  if (!data || data.length === 0) return <div className="text-gray-500 text-sm">No transactions yet.</div>;

  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200 p-4 h-full flex flex-col">
      <div className="flex items-center space-x-2 mb-3">
        <Activity size={18} className="text-[#E94532]" />
        <h3 className="font-serif font-bold text-[#242424]">Live Transactions</h3>
        <span className="ml-auto text-xs text-green-600 font-medium">● Live</span>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        Raw stream only. Run investigation to get AI fraud verdict.
      </p>
      <div className="overflow-auto flex-1 max-h-60">
        <table className="w-full text-sm">
          <thead className="border-b border-[#4A4A4A]">
            <tr className="text-left text-[#666] font-sans text-xs uppercase tracking-wider">
              <th className="py-1 pr-2">Amount</th>
              <th className="py-1 pr-2">Channel</th>
              <th className="py-1 pr-2">Location</th>
              <th className="py-1">Time</th>
              <th className="py-1 pl-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => handleRowClick(tx.id)}
              >
                <td className="py-1.5 pr-2 font-medium">{formatCurrencyINR(tx.amount)}</td>
                <td className="py-1.5 pr-2 text-gray-700">{safeText(tx.channel)}</td>
                <td className="py-1.5 pr-2 text-gray-700">{safeText(tx.location)}</td>
                <td className="py-1.5 text-gray-500 text-xs whitespace-nowrap">
                  {formatTime(tx.timestamp)}
                </td>
                <td className="py-1.5 pl-2 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E94532]/30 bg-[#FFF4F1] px-2.5 py-1 text-[11px] font-semibold text-[#B3301F] hover:bg-[#FFE7E2] transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(tx.id);
                    }}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E94532] animate-pulse" />
                    Investigate
                  </button>
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