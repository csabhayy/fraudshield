import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ChartData } from '../types/dashboard';

interface TransactionActivityChartProps {
  data: ChartData[];
}

const TransactionActivityChart: React.FC<TransactionActivityChartProps> = ({ data }) => {
  const hasData = data.some(d => d.count > 0);

  const barColors: Record<string, string> = {
    Valid: '#10B981',
    Fraud: '#E94532',
    Unassigned: '#F59E0B',
  };

  const chartData = data.map(item => ({
    name: item.category,
    count: item.count,
  }));

  const tooltipFormatter = (value: number) => {
    if (value === undefined) return ['0', 'Count'];
    return [`${value} transactions`, 'Transactions'];
  };

  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white p-4 h-full min-h-[280px] shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="relative h-full min-h-[240px]">
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            No transaction data available
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 11 }} />
            <Tooltip
              wrapperStyle={{ fontSize: 12, fontFamily: 'sans-serif' }}
              formatter={tooltipFormatter as any}
            />
            <Bar
              dataKey="count"
              radius={[4,4,0,0]}
              barSize={36}
              animationDuration={800}
              animationEasing="ease-in-out"
              label={{ position: 'top', fill: '#666', fontSize: 11 }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColors[entry.name] || '#E94532'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TransactionActivityChart;