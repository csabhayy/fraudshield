import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { DashboardAlert } from '../types/dashboard';
import { formatCurrencyINR, formatRelativeTime, riskTone, safeText } from '../utils/format';

interface Props {
  alerts: DashboardAlert[];
}

const AlertQueue: React.FC<Props> = ({ alerts }) => {
  const navigate = useNavigate();

  const prioritized = useMemo(() => {
    return [...alerts]
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 6);
  }, [alerts]);

  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">Alert Queue</p>
          <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">High-priority unresolved alerts</h2>
        </div>
        <span className="inline-flex items-center rounded-2xl bg-[#f28b82]/10 px-3 py-1 text-xs font-semibold text-[#f28b82]">Prioritized</span>
      </div>
      <div className="mt-4 space-y-3 overflow-y-auto">
        {prioritized.length === 0 ? (
          <div className="rounded-3xl bg-[#131417] p-4 text-sm text-[#9ca3af]">No unresolved alerts at the moment.</div>
        ) : (
          prioritized.map((alert) => {
            const tone = riskTone(alert.risk_score ?? 0);
            return (
              <button
                key={alert.transaction_id}
                type="button"
                onClick={() => navigate(`/investigation/${encodeURIComponent(alert.transaction_id)}`)}
                className="w-full rounded-3xl border border-[#202227] bg-[#131417] p-4 text-left transition hover:border-[#8ab4f8] hover:bg-[#1b1f24]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#e3e3e3]">
                      <AlertTriangle size={16} className="text-[#f28b82]" />
                      <span>{alert.transaction_id}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#9ca3af] truncate">{safeText(alert.flagged_reason)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#c4c7c5]">
                    <span>{formatCurrencyINR(alert.amount)}</span>
                    <span className={`rounded-full border px-2 py-1 ${tone === 'high' ? 'border-[#f28b82] text-[#f28b82]' : tone === 'medium' ? 'border-[#f9a826] text-[#f9a826]' : 'border-[#34d399] text-[#34d399]'}`}>
                      {alert.risk_level}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#9ca3af]">
                  <span>{safeText(alert.customer_name)}</span>
                  <span>{formatRelativeTime(alert.timestamp)}</span>
                  <span>{safeText(alert.investigation_status)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
      <div className="mt-4 text-right">
        <button
          type="button"
          onClick={() => navigate('/alerts')}
          className="rounded-2xl border border-[#2f3032] bg-[#131417] px-4 py-2 text-xs font-semibold text-[#8ab4f8] transition hover:bg-[#1f2124]"
        >
          View all alerts →
        </button>
      </div>
    </div>
  );
};

export default AlertQueue;
