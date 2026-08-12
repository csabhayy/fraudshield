import React from 'react';
import type { FraudPattern } from '../types/dashboard';
import { safeText } from '../utils/format';

const toneMap: Record<string, string> = {
  High: 'text-[#f28b82]',
  Medium: 'text-[#f9a826]',
  Low: 'text-[#7dd3a2]',
};

interface Props {
  pattern: FraudPattern;
  onClick: () => void;
}

const FraudPatternCard: React.FC<Props> = ({ pattern, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-3xl border border-[#202227] bg-[#131417] p-4 text-left shadow-sm transition hover:border-[#8ab4f8] hover:bg-[#16181b]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#e3e3e3]">{safeText(pattern.title)}</h3>
          <p className="mt-2 text-sm text-[#9ca3af]">{safeText(pattern.subtitle)}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${toneMap[pattern.risk_level] || 'text-[#9ca3af]'}`}>
          {safeText(pattern.risk_level)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#c4c7c5]">
        <span>{pattern.count} cases</span>
        <span>{safeText(pattern.trend)}</span>
      </div>
    </button>
  );
};

export default FraudPatternCard;
