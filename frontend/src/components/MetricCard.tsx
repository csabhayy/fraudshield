import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  trend?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red';
}

const accentClasses: Record<NonNullable<MetricCardProps['accent']>, string> = {
  blue: 'text-[#8ab4f8] border-[#8ab4f8]/20 bg-[#0f1724]',
  green: 'text-[#7dd3a2] border-[#7dd3a2]/20 bg-[#0f171b]',
  amber: 'text-[#f9a826] border-[#f9a826]/20 bg-[#1f1711]',
  red: 'text-[#f28b82] border-[#f28b82]/20 bg-[#221111]',
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle, trend, accent = 'blue' }) => {
  return (
    <div className={`rounded-3xl border px-4 py-4 text-sm shadow-sm ring-1 ring-white/5 ${accentClasses[accent]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.24em] text-[#9ca3af]">{label}</p>
        {trend ? <span className="text-xs text-[#c4c7c5]">{trend}</span> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold text-[#e3e3e3]">{value}</div>
      <p className="mt-2 text-xs text-[#9ca3af]">{subtitle}</p>
    </div>
  );
};

export default MetricCard;
