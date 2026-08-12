import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { NetworkSummary } from '../types/dashboard';

interface Props {
  summary: NetworkSummary;
}

const FraudNetworkSummary: React.FC<Props> = ({ summary }) => {
  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">Fraud Network</p>
          <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">Connected entities and cluster risk</h2>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-[#2f3032] bg-[#131417] px-3 py-2 text-xs font-semibold text-[#8ab4f8] hover:bg-[#1f2124]">
          Open Network Analysis <ArrowRight size={14} />
        </button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-[#131417] p-4">
          <div className="text-xs text-[#9ca3af]">Accounts</div>
          <div className="mt-2 text-2xl font-semibold text-[#e3e3e3]">{summary.accounts}</div>
        </div>
        <div className="rounded-3xl bg-[#131417] p-4">
          <div className="text-xs text-[#9ca3af]">Devices</div>
          <div className="mt-2 text-2xl font-semibold text-[#e3e3e3]">{summary.devices}</div>
        </div>
        <div className="rounded-3xl bg-[#131417] p-4">
          <div className="text-xs text-[#9ca3af]">Beneficiaries</div>
          <div className="mt-2 text-2xl font-semibold text-[#e3e3e3]">{summary.beneficiaries}</div>
        </div>
        <div className="rounded-3xl bg-[#131417] p-4">
          <div className="text-xs text-[#9ca3af]">Merchants</div>
          <div className="mt-2 text-2xl font-semibold text-[#e3e3e3]">{summary.merchants}</div>
        </div>
      </div>
      <div className="mt-4 rounded-3xl border border-[#202227] bg-[#131417] p-4 text-sm text-[#9ca3af]">
        <div className="font-semibold text-[#e3e3e3]">Highest risk cluster</div>
        <div className="mt-2">{summary.highlight}</div>
      </div>
    </div>
  );
};

export default FraudNetworkSummary;
