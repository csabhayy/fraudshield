import React from 'react';
import { CheckCircle2, Circle, Clock3, Loader2 } from 'lucide-react';
import type { OngoingInvestigationItem } from '../types/dashboard';
import { formatRelativeTime, safeText } from '../utils/format';

interface OngoingInvestigationProps {
  investigations: OngoingInvestigationItem[];
}

const OngoingInvestigation: React.FC<OngoingInvestigationProps> = ({ investigations }) => {
  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white overflow-hidden h-full">
      <div className="bg-[#E94532] text-white py-1.5 text-center font-serif font-bold text-sm">
        Ongoing investigation
      </div>
      <div className="p-3 sm:p-4 space-y-3 max-h-[540px] overflow-y-auto">
        {investigations.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-md p-4 text-sm text-gray-500">
            No investigations currently in progress.
          </div>
        )}

        {investigations.map((inv) => {
          const completed = inv.completed_steps || [];
          const pending = inv.pending_steps || [];
          const activeStep = safeText(inv.active_step, 'Awaiting pipeline update');
          const isComplete = Math.round(inv.progress_pct || 0) >= 100 || activeStep === 'Completed';
          return (
            <div key={inv.investigation_id} className="border border-gray-200 rounded-md p-3 bg-[#FCFCFB]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Investigation</div>
                  <div className="font-semibold text-[#242424] text-sm">{safeText(inv.investigation_id)}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    TXN {safeText(inv.transaction_id)} · Customer {safeText(inv.customer_id)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Risk score</div>
                  <div className="font-bold text-[#E94532]">{inv.risk_score}/100</div>
                  <div className="text-[11px] text-gray-500 flex items-center justify-end gap-1 mt-0.5">
                    <Clock3 size={11} />
                    {formatRelativeTime(inv.last_updated)}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-[#E94532] transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, inv.progress_pct || 0))}%` }} />
                </div>
                <div className="mt-1 text-xs text-gray-600 flex items-center justify-between">
                  <span>{safeText(inv.current_stage)}</span>
                  <span>{Math.round(inv.progress_pct || 0)}%</span>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-[#242424]">
                {completed.map((step) => (
                  <div key={`${inv.investigation_id}-${step}-completed`} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{safeText(step)}</span>
                  </div>
                ))}
                {isComplete ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="font-medium">Completed</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Loader2 size={13} className="text-[#E94532] mt-0.5 flex-shrink-0 animate-spin" />
                    <span className="font-medium">{activeStep}</span>
                  </div>
                )}
                {pending.map((step) => (
                  <div key={`${inv.investigation_id}-${step}-pending`} className="flex items-start gap-2 text-gray-500">
                    <Circle size={13} className="mt-0.5 flex-shrink-0" />
                    <span>{safeText(step)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                Agent status: <span className="font-medium">{safeText(inv.agent_status)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OngoingInvestigation;