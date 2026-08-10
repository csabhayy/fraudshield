import React from 'react';

interface RecentActivityProps {
  total: number;
  unusual: number;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ total, unusual }) => {
  return (
    <div className="border border-[#4A4A4A] rounded-md overflow-hidden bg-white h-full min-h-[280px] shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="font-serif text-sm font-bold text-[#242424] px-4 py-2 border-b border-[#4A4A4A] bg-[#F8F8F6]">
        Activity
      </div>
      <div className="p-4 flex flex-col h-full space-y-3">
        <div className="bg-gradient-to-br from-[#E94532] to-[#C62828] text-white p-4 rounded-sm flex-1 flex flex-col justify-center shadow-sm">
          <div className="text-xs uppercase tracking-wider opacity-80">Total transactions</div>
          <div className="text-4xl font-serif font-bold">
            {total.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-sm flex-1 flex flex-col justify-center border border-gray-200">
          <div className="text-xs uppercase tracking-wider text-[#666]">Unusual transactions</div>
          <div className="text-2xl font-serif font-bold text-[#242424]">
            {unusual.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;