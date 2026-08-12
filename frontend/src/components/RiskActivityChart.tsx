import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { RiskActivityPoint } from '../types/dashboard';

interface Props {
  data: RiskActivityPoint[];
}

const RiskActivityChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">Risk Activity</p>
          <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">Volume · High risk · Alerts · Blocks</h2>
        </div>
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f242a" vertical={false} />
            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#111318', borderColor: '#2f3032', borderRadius: 10 }} itemStyle={{ color: '#e3e3e3' }} labelStyle={{ color: '#e3e3e3' }} />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Area type="monotone" dataKey="volume" stroke="#5c78ff" fill="#5c78ff33" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="highRisk" stroke="#f28b82" fill="#f28b8233" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="alerts" stroke="#fdd663" fill="#fdd66333" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="blocks" stroke="#81c995" fill="#81c99533" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskActivityChart;
