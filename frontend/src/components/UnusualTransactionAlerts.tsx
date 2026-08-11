import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import type { DashboardAlert } from '../types/dashboard';
import { formatCurrencyINR, safeText } from '../utils/format';

interface UnusualTransactionAlertsProps {
  alerts: DashboardAlert[];
}

const UnusualTransactionAlerts: React.FC<UnusualTransactionAlertsProps> = ({ alerts }) => {
  const prioritizedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 8);
  }, [alerts]);

  return (
    <div className="rounded-3xl bg-[#16171a] p-4 text-[#e3e3e3]">
      <div className="flex items-center justify-between gap-4 border-b border-[#2f3032] pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#e3e3e3]">
          <AlertCircle size={16} className="text-[#f28b82]" />
          Alerts
        </div>
        <span className="text-xs text-[#f28b82]">{prioritizedAlerts.length} shown</span>
      </div>
      <div className="mt-4 space-y-2">
        {prioritizedAlerts.length === 0 ? (
          <div className="rounded-2xl bg-[#141517] p-4 text-sm text-[#9ca3af]">No alerts found.</div>
        ) : (
          prioritizedAlerts.map((alert) => (
            <button
              key={alert.transaction_id}
              type="button"
              className="w-full rounded-2xl bg-[#141517] p-4 text-left transition hover:bg-[#1b1f24]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#e3e3e3]">{alert.transaction_id}</div>
                  <div className="mt-1 text-xs text-[#9ca3af] truncate">{safeText(alert.flagged_reason)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#c4c7c5]">
                  <span>{formatCurrencyINR(alert.amount)}</span>
                  <span className="rounded-full bg-[#f28b82]/10 px-2 py-1 text-[#f28b82]">{alert.risk_level}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default UnusualTransactionAlerts;
