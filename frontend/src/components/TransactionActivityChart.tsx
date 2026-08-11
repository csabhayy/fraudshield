import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ChartData } from '../types/dashboard';

interface TransactionActivityChartProps {
  data: ChartData[];
}

const TransactionActivityChart: React.FC<TransactionActivityChartProps> = ({ data }) => {
  const hasData = data.some(d => d.count > 0);

  const barColors: Record<string, string> = {
    Valid: '#81c995', // Soft Google Green
    Fraud: '#f28b82', // Soft Google Red
    Unassigned: '#fdd663', // Soft Google Yellow
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
    <div className="border border-[#2f3032] rounded-lg bg-[#1e1f20] p-4 h-full min-h-[280px] shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="font-sans text-xs font-semibold text-[#c4c7c5] uppercase tracking-wider mb-4">
        Transaction Categories
      </div>
      <div className="relative h-full min-h-[200px]">
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            No transaction data available
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d2f31" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#c4c7c5', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#c4c7c5', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#131314', borderColor: '#2f3032', borderRadius: '6px' }}
              labelStyle={{ color: '#e3e3e3', fontWeight: 'bold' }}
              itemStyle={{ color: '#c4c7c5' }}
              wrapperStyle={{ fontSize: 11, fontFamily: 'sans-serif' }}
              formatter={tooltipFormatter as any}
            />
            <Bar
              dataKey="count"
              radius={[4,4,0,0]}
              barSize={32}
              animationDuration={800}
              animationEasing="ease-in-out"
              label={{ position: 'top', fill: '#e3e3e3', fontSize: 10 }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColors[entry.name] || '#8ab4f8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TransactionActivityChart;