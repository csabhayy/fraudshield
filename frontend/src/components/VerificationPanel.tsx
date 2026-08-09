import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface VerificationData {
  verified: number;
  fraudulent: number;
  unassigned: number;
}

interface VerificationPanelProps {
  data: VerificationData;
}

const VerificationPanel: React.FC<VerificationPanelProps> = ({ data }) => {
  const pieData = [
    { name: 'Verified', value: data.verified, color: '#C62828' },
    { name: 'Fraudulent', value: data.fraudulent, color: '#E53935' },
    { name: 'Unassigned', value: data.unassigned, color: '#EF9A9A' },
  ];

  const renderTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const total = data.verified + data.fraudulent + data.unassigned;
      const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white border border-[#4A4A4A] rounded-md p-2 text-sm text-[#242424] shadow-sm">
          <div className="font-semibold">{entry.name}</div>
          <div>{entry.value} transactions</div>
          <div className="text-xs text-[#666]">{percentage}% of total</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white p-4 h-full flex flex-col">
      <div className="flex justify-center mb-3">
        <div className="bg-[#E94532] text-white px-6 py-1 rounded-full text-sm font-serif font-bold">
          Verification
        </div>
      </div>
      <h3 className="font-serif text-lg font-bold text-center text-[#242424] mb-4">
        Today
      </h3>
      <div className="flex-1 flex items-center justify-center min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              label={({ percent }) => {
                const pct = percent ?? 0;
                return `${(pct * 100).toFixed(0)}%`;
              }}
              labelLine={false}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center space-x-4 mt-2 text-xs font-sans text-[#242424]">
        <div>
          <span className="inline-block w-3 h-3 bg-[#C62828] rounded-sm mr-1"></span>
          {data.verified} Verified
        </div>
        <div>
          <span className="inline-block w-3 h-3 bg-[#E53935] rounded-sm mr-1"></span>
          {data.fraudulent} Fraudulent
        </div>
        <div>
          <span className="inline-block w-3 h-3 bg-[#EF9A9A] rounded-sm mr-1"></span>
          {data.unassigned} Unassigned
        </div>
      </div>
    </div>
  );
};

export default VerificationPanel;