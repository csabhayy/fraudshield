import React from 'react';
import type { OngoingInvestigationItem } from '../types/dashboard';
import { formatRelativeTime, safeText } from '../utils/format';

interface OngoingInvestigationProps {
  investigations: OngoingInvestigationItem[];
}

const OngoingInvestigation: React.FC<OngoingInvestigationProps> = ({ investigations }) => {
  return (
    <div className="rounded-3xl bg-[#16171a] p-4 text-[#e3e3e3]">
      <div className="flex items-center justify-between gap-4 border-b border-[#2f3032] pb-3">
        <div>
          <h3 className="text-lg font-semibold">Recent investigations</h3>
          <p className="text-sm text-[#9ca3af]">{investigations.length} active</p>
        </div>
        <span className="rounded-full bg-[#8ab4f8]/10 px-3 py-1 text-xs font-semibold text-[#8ab4f8]">Live</span>
      </div>
      <div className="mt-4 space-y-3">
        {investigations.length === 0 ? (
          <div className="rounded-2xl bg-[#141517] p-4 text-sm text-[#9ca3af]">No active investigations.</div>
        ) : (
          investigations.map((inv) => (
            <button
              type="button"
              key={inv.investigation_id}
              className="w-full rounded-2xl bg-[#141517] p-4 text-left transition hover:bg-[#1b1f24]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#e3e3e3]">{safeText(inv.investigation_id)}</span>
                <span className="text-xs text-[#9ca3af]">{formatRelativeTime(inv.last_updated)}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-[#c4c7c5]">
                <span>TXN {safeText(inv.transaction_id)}</span>
                <span>{safeText(inv.current_stage)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-[#f28b82]/10 px-2 py-1 text-[#f28b82]">Risk {inv.risk_score}</span>
                <span className="rounded-full bg-[#8ab4f8]/10 px-2 py-1 text-[#8ab4f8]">{safeText(inv.agent_status)}</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[#2f3032] overflow-hidden">
                <div className="h-full bg-[#8ab4f8]" style={{ width: `${Math.max(0, Math.min(100, inv.progress_pct || 0))}%` }} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default OngoingInvestigation;
