import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { LiveTransactionItem, TransactionFilter } from '../types/dashboard';
import { formatCurrencyINR, formatTime, safeText, riskTone } from '../utils/format';

const riskStyles = {
  low: 'bg-emerald-600/10 text-emerald-300 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-400/20',
  high: 'bg-rose-500/10 text-rose-300 border-rose-400/20',
  critical: 'bg-red-600/15 text-red-300 border-red-500/20',
};

const decisionStyles = {
  ALLOW: 'text-sky-300 bg-sky-500/10 border-sky-400/20',
  REVIEW: 'text-amber-200 bg-amber-500/10 border-amber-400/20',
  BLOCK: 'text-red-200 bg-red-500/10 border-red-400/20',
};

const filters: { label: string; value: TransactionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'High risk', value: 'highRisk' },
  { label: 'Blocked', value: 'blocked' },
  { label: 'Review', value: 'review' },
];

interface Props {
  transactions: LiveTransactionItem[];
  highlightedIds: string[];
  currentFilter: TransactionFilter;
  onFilterChange: (value: TransactionFilter) => void;
}

const LiveTransactionTable: React.FC<Props> = ({ transactions, highlightedIds, currentFilter, onFilterChange }) => {
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (currentFilter === 'all') return transactions;
    if (currentFilter === 'highRisk') return transactions.filter((tx) => tx.risk_score != null && tx.risk_score >= 70);
    if (currentFilter === 'blocked') return transactions.filter((tx) => tx.decision === 'BLOCK');
    if (currentFilter === 'review') return transactions.filter((tx) => tx.decision === 'REVIEW');
    return transactions;
  }, [transactions, currentFilter]);

  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5 h-full flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">Live Transactions</p>
          <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">Streaming transactions · updated automatically</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
                currentFilter === option.value ? 'border-[#8ab4f8] bg-[#8ab4f8]/10 text-[#8ab4f8]' : 'border-[#2f3032] bg-[#131314] text-[#c4c7c5] hover:border-[#8ab4f8] hover:text-[#e3e3e3]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-[#202227] bg-[#131417] flex-1 min-h-0 flex flex-col">
        <div className="grid grid-cols-[1.5fr_1fr_0.95fr_0.95fr_0.8fr_0.75fr_0.5fr] gap-2 border-b border-[#202227] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[#6b7a92]">
          <span>Transaction</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Location</span>
          <span>Risk</span>
          <span>Decision</span>
          <span />
        </div>
        <div className="overflow-y-auto min-h-0">
          {filtered.map((tx) => {
            const tone = riskTone(tx.risk_score ?? 0);
            const isHighlighted = highlightedIds.includes(tx.transaction_id);
            return (
              <button
                type="button"
                key={tx.transaction_id}
                onClick={() => navigate(`/investigation/${encodeURIComponent(tx.transaction_id)}`)}
                className={`group grid w-full grid-cols-[1.5fr_1fr_0.95fr_0.95fr_0.8fr_0.75fr_0.5fr] items-center gap-2 border-b border-[#202227] px-4 py-3 text-left transition ${
                  isHighlighted ? 'bg-[#1c2a44]' : 'hover:bg-[#16181b]'
                }`}
              >
                <div className="truncate text-sm font-semibold text-[#e3e3e3]">
                  {safeText(tx.transaction_id)}
                  <span className="ml-2 text-xs text-[#76839d]">{formatTime(tx.timestamp)}</span>
                </div>
                <div className="truncate text-sm text-[#c4c7c5]">{safeText(tx.customer_id)}</div>
                <div className="text-sm font-semibold text-[#8ab4f8]">{formatCurrencyINR(tx.amount)}</div>
                <div className="truncate text-sm text-[#c4c7c5]">{safeText(tx.location)}</div>
                <div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${riskStyles[tone]}`}> 
                    {safeText(tx.risk_level)} {tx.risk_score != null ? `· ${tx.risk_score}` : ''}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${decisionStyles[tx.decision ?? 'ALLOW']}`}>
                    {safeText(tx.decision)}
                  </span>
                </div>
                <ChevronRight size={18} className="text-[#6b7a92] transition group-hover:text-[#8ab4f8]" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#9ca3af]">No transactions match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTransactionTable;
