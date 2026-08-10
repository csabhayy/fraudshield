import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Clock3, ShieldAlert } from 'lucide-react';
import type { DashboardAlert } from '../types/dashboard';
import { formatCurrencyINR, formatDateTime, safeText } from '../utils/format';

interface UnusualTransactionAlertsProps {
  alerts: DashboardAlert[];
}

const UnusualTransactionAlerts: React.FC<UnusualTransactionAlertsProps> = ({ alerts }) => {
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const prioritizedAlerts = useMemo(() => {
    return [...alerts]
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 8);
  }, [alerts]);

  const toggleAlert = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

  const riskToneClasses = (level: string) => {
    if (level === 'High') return 'bg-red-100 text-red-700 border-red-200';
    if (level === 'Medium') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="bg-[#E94532] text-white py-1.5 text-center font-serif font-bold text-sm">
        Unusual transaction alerts
      </div>
      <div className="p-3 sm:p-4 space-y-2">
        {prioritizedAlerts.length === 0 && (
          <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            No unusual alerts detected in the current stream.
          </div>
        )}

        {prioritizedAlerts.map((alert) => {
          const isExpanded = expandedTxId === alert.transaction_id;
          return (
            <div key={alert.transaction_id} className="border border-gray-200 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAlert(alert.transaction_id)}
                className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-[#E94532] mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-[#242424]">Unusual Transaction</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskToneClasses(alert.risk_level)}`}>
                        {safeText(alert.risk_level, 'Unknown')} Risk
                      </span>
                    </div>
                    <p className="text-sm text-[#242424] mt-1">
                      {formatCurrencyINR(alert.amount)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {safeText(alert.flagged_reason, 'No reason provided')}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-[#E94532] mt-1 flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-[#E94532] mt-1 flex-shrink-0" />
                  )}
                </div>
              </button>

              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-3 pb-3 pt-1 text-sm text-[#242424] bg-[#FCFCFB] border-t border-gray-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div><span className="font-semibold">Transaction ID:</span> {safeText(alert.transaction_id)}</div>
                      <div><span className="font-semibold">Risk score:</span> {alert.risk_score}/100</div>
                      <div><span className="font-semibold">Customer:</span> {safeText(alert.customer_name)} ({safeText(alert.customer_id)})</div>
                      <div><span className="font-semibold">Amount:</span> {formatCurrencyINR(alert.amount)}</div>
                      <div className="flex items-center gap-1"><Clock3 size={12} className="text-gray-500" /><span>{formatDateTime(alert.timestamp)}</span></div>
                      <div><span className="font-semibold">Investigation:</span> {safeText(alert.investigation_status)}</div>
                    </div>

                    <div className="rounded-md border border-gray-200 p-2 bg-white text-xs">
                      <div className="font-semibold mb-1">Why this was flagged</div>
                      <p className="text-gray-700">{safeText(alert.flagged_reason, 'No flag reason available.')}</p>
                      <p className="text-gray-600 mt-1">
                        Amount is {alert.historical_comparison?.amount_multiplier ?? 0}x the customer average of {formatCurrencyINR(alert.historical_comparison?.customer_avg_amount ?? 0)}.
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-xs mb-1 flex items-center gap-1">
                        <ShieldAlert size={12} className="text-[#E94532]" />
                        Detected risk signals
                      </div>
                      <div className="space-y-1">
                        {(alert.risk_signals || []).map((signal) => (
                          <div key={`${alert.transaction_id}-${signal.signal}`} className="rounded-md border border-gray-200 p-2 bg-white text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{safeText(signal.signal)}</span>
                              <span className="text-[10px] uppercase tracking-wide text-gray-500">{safeText(signal.severity)}</span>
                            </div>
                            <p className="text-gray-700 mt-1">{safeText(signal.evidence)}</p>
                          </div>
                        ))}
                        {(!alert.risk_signals || alert.risk_signals.length === 0) && (
                          <p className="text-xs text-gray-500">No additional risk signals available.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-md border border-[#E94532]/20 bg-[#FFF7F5] p-2 text-xs">
                      <span className="font-semibold">Recommended next action:</span>{' '}
                      {safeText(alert.recommended_next_action, 'Open the investigation for detailed analysis.')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UnusualTransactionAlerts;