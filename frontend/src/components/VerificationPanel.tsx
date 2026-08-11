import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { VerificationActivityItem } from '../types/dashboard';

interface VerificationData {
  verified: number;
  fraudulent: number;
  unassigned: number;
}

interface VerificationPanelProps {
  data: VerificationData;
  activity: VerificationActivityItem[];
}

type FilterPreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

const VerificationPanel: React.FC<VerificationPanelProps> = ({ data, activity }) => {
  const [preset, setPreset] = useState<FilterPreset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const filteredActivity = useMemo(() => {
    if (!activity || activity.length === 0) return [];
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return activity.filter((item) => {
      const txDate = new Date(item.updated_at);
      if (Number.isNaN(txDate.getTime())) return false;
      if (preset === 'today') return txDate >= dayStart;
      if (preset === 'yesterday') {
        const prev = new Date(dayStart);
        prev.setDate(prev.getDate() - 1);
        return txDate >= prev && txDate < dayStart;
      }
      if (preset === '7d') {
        const prev = new Date(now);
        prev.setDate(now.getDate() - 7);
        return txDate >= prev;
      }
      if (preset === '30d') {
        const prev = new Date(now);
        prev.setDate(now.getDate() - 30);
        return txDate >= prev;
      }
      if (preset === 'custom' && customStart && customEnd) {
        const start = new Date(`${customStart}T00:00:00`);
        const end = new Date(`${customEnd}T23:59:59`);
        return txDate >= start && txDate <= end;
      }
      return true;
    });
  }, [activity, preset, customStart, customEnd]);

  const derivedCounts = useMemo(() => {
    if (!filteredActivity.length) return data;
    let verified = 0;
    let fraudulent = 0;
    let unassigned = 0;
    filteredActivity.forEach((item) => {
      const score = item.risk_score ?? 0;
      if (score >= 70) fraudulent += 1;
      else if (score >= 30) unassigned += 1;
      else verified += 1;
    });
    return { verified, fraudulent, unassigned };
  }, [filteredActivity, data]);

  const pieData = [
    { name: 'Verified', value: derivedCounts.verified, color: '#81c995' },
    { name: 'Fraudulent', value: derivedCounts.fraudulent, color: '#f28b82' },
    { name: 'Review', value: derivedCounts.unassigned, color: '#fdd663' },
  ];

  return (
    <div className="rounded-3xl bg-[#16171a] p-5 ring-1 ring-white/5 text-[#e3e3e3]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Verification</h3>
          <p className="text-sm text-[#9ca3af]">{filteredActivity.length ? `${filteredActivity.length} records` : 'No recent activity'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['today', 'yesterday', '7d', '30d', 'custom'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPreset(option as FilterPreset)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                preset === option ? 'bg-[#8ab4f8] text-[#131313]' : 'bg-[#131314] text-[#9ca3af] hover:bg-[#1f2124]'
              }`}
            >
              {option === '7d' ? '7D' : option === '30d' ? '30D' : option === 'custom' ? 'Custom' : option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="rounded-2xl border border-[#2f3032] bg-[#131314] px-3 py-2 text-sm text-[#e3e3e3]"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="rounded-2xl border border-[#2f3032] bg-[#131314] px-3 py-2 text-sm text-[#e3e3e3]"
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.9fr] items-center">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} innerRadius={40} outerRadius={72} dataKey="value" stroke="#14171a">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111318', border: '1px solid #2f3032' }} itemStyle={{ color: '#e3e3e3' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-3">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-[#141517] px-4 py-3 text-sm text-[#e3e3e3]">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}</span>
              </div>
              <span>{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VerificationPanel;
