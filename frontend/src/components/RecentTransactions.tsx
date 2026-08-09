import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { Activity } from 'lucide-react';

interface Tx {
  id: string;
  customer: string;
  amount: number;
  channel: string;
  location: string;
  timestamp: string;
  story: string;
}

const RecentTransactions: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['recentTx'],
    queryFn: async () => {
      const res = await apiClient.get<Tx[]>('/recent-transactions?limit=10');
      return res.data;
    },
    refetchInterval: 5000,
  });

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
      <div className="overflow-auto flex-1 max-h-60">
        <table className="w-full text-sm">
          <thead className="border-b border-[#4A4A4A]">
            <tr className="text-left text-[#666] font-sans text-xs uppercase tracking-wider">
              <th className="py-1 pr-2">Amount</th>
              <th className="py-1 pr-2">Channel</th>
              <th className="py-1 pr-2">Location</th>
              <th className="py-1 pr-2">Status</th>
              <th className="py-1">Time</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-1.5 pr-2 font-medium">₹{tx.amount.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-gray-700">{tx.channel}</td>
                <td className="py-1.5 pr-2 text-gray-700">{tx.location}</td>
                <td className="py-1.5 pr-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    tx.story === 'Normal' ? 'bg-green-100 text-green-800' :
                    tx.story.includes('Fraud') ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {tx.story}
                  </span>
                </td>
                <td className="py-1.5 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(tx.timestamp).toLocaleTimeString()}
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