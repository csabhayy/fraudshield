import React from 'react';

interface RecentActivityProps {
  total: number;
  unusual: number;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ total, unusual }) => {
  return (
    <div className="border border-[#2f3032] rounded-lg overflow-hidden bg-[#1e1f20] h-full min-h-[280px] shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="font-sans text-xs font-semibold text-[#c4c7c5] uppercase tracking-wider px-4 py-3 border-b border-[#2f3032] bg-[#1e1f20]">
        Activity Baseline
      </div>
      <div className="p-4 flex flex-col h-full space-y-3">
        <div className="bg-gradient-to-br from-[#8ab4f8] to-[#1a73e8] text-white p-4 rounded-md flex-1 flex flex-col justify-center shadow-sm">
          <div className="text-[10px] uppercase tracking-wider opacity-90 font-medium">Total Transactions</div>
          <div className="text-4xl font-sans font-bold mt-1">
            {total.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#131314] p-4 rounded-md flex-1 flex flex-col justify-center border border-[#2f3032]">
          <div className="text-[10px] uppercase tracking-wider text-[#c4c7c5] font-medium">Unusual Transactions</div>
          <div className="text-2xl font-sans font-bold text-[#f28b82] mt-1">
            {unusual.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecentActivity;