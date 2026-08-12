import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { OngoingInvestigationItem } from '../types/dashboard';
import { formatRelativeTime, safeText, riskTone } from '../utils/format';

interface Props {
  investigations: OngoingInvestigationItem[];
}

const riskStyles: Record<string, string> = {
  low: 'bg-emerald-600/10 text-emerald-300 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
  high: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
};

const InvestigationTable: React.FC<Props> = ({ investigations }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">Recent Investigations</p>
          <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">Active cases and latest outcomes</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/investigations')}
          className="rounded-2xl border border-[#2f3032] bg-[#131417] px-4 py-2 text-xs font-semibold text-[#8ab4f8] transition hover:bg-[#1f2124]"
        >
          View all investigations →
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.22em] text-[#6b7a92]">
              <th className="pb-3 pr-4">Investigation</th>
              <th className="pb-3 pr-4">Transaction</th>
              <th className="pb-3 pr-4">Risk</th>
              <th className="pb-3 pr-4">Trigger</th>
              <th className="pb-3 pr-4">Agent</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#202227]">
            {investigations.slice(0, 10).map((inv) => {
              const tone = riskTone(inv.risk_score);
              return (
                <tr
                  key={inv.investigation_id}
                  onClick={() => navigate(`/investigation/${encodeURIComponent(inv.transaction_id)}`)}
                  className="cursor-pointer transition hover:bg-[#16181b]"
                >
                  <td className="py-3 pr-4 font-semibold text-[#e3e3e3]">{safeText(inv.investigation_id)}</td>
                  <td className="py-3 pr-4 text-[#c4c7c5]">{safeText(inv.transaction_id)}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${riskStyles[tone]}`}>
                      {inv.risk_score}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[#c4c7c5]">{safeText(inv.current_stage)}</td>
                  <td className="py-3 pr-4 text-[#c4c7c5]">{safeText(inv.agent_status)}</td>
                  <td className="py-3 pr-4 text-[#9ca3af]">{safeText(inv.status)}</td>
                  <td className="py-3 text-[#9ca3af]">{formatRelativeTime(inv.last_updated)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestigationTable;
