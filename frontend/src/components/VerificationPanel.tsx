import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { VerificationActivityItem } from '../types/dashboard';
import { safeText } from '../utils/format';

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
    if (!activity || activity.length === 0) {
      return [];
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return activity.filter((item) => {
      const txDate = new Date(item.updated_at);
      if (Number.isNaN(txDate.getTime())) return false;

      if (preset === 'today') {
        return txDate >= dayStart;
      }
      if (preset === 'yesterday') {
        const yesterdayStart = new Date(dayStart);
        yesterdayStart.setDate(dayStart.getDate() - 1);
        return txDate >= yesterdayStart && txDate < dayStart;
      }
      if (preset === '7d') {
        const threshold = new Date(now);
        threshold.setDate(now.getDate() - 7);
        return txDate >= threshold;
      }
      if (preset === '30d') {
        const threshold = new Date(now);
        threshold.setDate(now.getDate() - 30);
        return txDate >= threshold;
      }
      if (preset === 'custom') {
        if (!customStart || !customEnd) return true;
        const start = new Date(`${customStart}T00:00:00`);
        const end = new Date(`${customEnd}T23:59:59`);
        return txDate >= start && txDate <= end;
      }
      return true;
    });
  }, [activity, preset, customStart, customEnd]);

  const derivedCounts = useMemo(() => {
    if (filteredActivity.length === 0) {
      return data;
    }
    let verified = 0;
    let fraudulent = 0;
    let unassigned = 0;
    filteredActivity.forEach((item) => {
      const score = item.risk_score || 0;
      if (score >= 70) fraudulent += 1;
      else if (score >= 30) unassigned += 1;
      else verified += 1;
    });
    return { verified, fraudulent, unassigned };
  }, [filteredActivity, data]);

  const activeFilterLabel =
    preset === 'today' ? 'Today' :
    preset === 'yesterday' ? 'Yesterday' :
    preset === '7d' ? 'Last 7 Days' :
    preset === '30d' ? 'Last 30 Days' :
    'Custom Range';

  const pieData = [
    { name: 'Verified', value: derivedCounts.verified, color: '#C62828' },
    { name: 'Fraudulent', value: derivedCounts.fraudulent, color: '#E53935' },
    { name: 'Unassigned', value: derivedCounts.unassigned, color: '#EF9A9A' },
  ];

  const renderTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const total = derivedCounts.verified + derivedCounts.fraudulent + derivedCounts.unassigned;
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
    <div className="border border-[#4A4A4A] rounded-md bg-white p-4 h-full flex flex-col min-h-[360px]">
      <div className="flex justify-center mb-3">
        <div className="bg-[#E94532] text-white px-6 py-1 rounded-full text-sm font-serif font-bold">
          Verification
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {[
          { id: 'today', label: 'Today' },
          { id: 'yesterday', label: 'Yesterday' },
          { id: '7d', label: 'Last 7 Days' },
          { id: '30d', label: 'Last 30 Days' },
          { id: 'custom', label: 'Custom Range' },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setPreset(option.id as FilterPreset)}
            className={`rounded-full px-2.5 py-1 text-[11px] border transition-colors ${
              preset === option.id
                ? 'bg-[#E94532] text-white border-[#E94532]'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#E94532]/40'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            aria-label="Custom start date"
          />
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
            aria-label="Custom end date"
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg font-bold text-[#242424]">{activeFilterLabel}</h3>
        <button
          type="button"
          onClick={() => {
            setPreset('today');
            setCustomStart('');
            setCustomEnd('');
          }}
          className="text-xs text-gray-500 hover:text-[#E94532]"
        >
          Reset filter
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-[210px]">
        <ResponsiveContainer width="100%" height={210}>
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
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 text-xs font-sans text-[#242424]">
        <div>
          <span className="inline-block w-3 h-3 bg-[#C62828] rounded-sm mr-1"></span>
          {derivedCounts.verified} Verified
        </div>
        <div>
          <span className="inline-block w-3 h-3 bg-[#E53935] rounded-sm mr-1"></span>
          {derivedCounts.fraudulent} Fraudulent
        </div>
        <div>
          <span className="inline-block w-3 h-3 bg-[#EF9A9A] rounded-sm mr-1"></span>
          {derivedCounts.unassigned} Unassigned
        </div>
      </div>

      <div className="mt-3 rounded-md border border-gray-200 p-2 text-xs text-gray-600">
        Active filter: <span className="font-medium text-[#242424]">{safeText(activeFilterLabel)}</span>
        {' · '}
        {filteredActivity.length > 0
          ? `${filteredActivity.length} records`
          : 'Using aggregate counts'}
      </div>
    </div>
  );
};

export default VerificationPanel;