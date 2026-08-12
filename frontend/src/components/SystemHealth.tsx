import React from 'react';
import { CircleDot } from 'lucide-react';
import type { SystemHealthStatus } from '../types/dashboard';

interface Props {
  statusItems: SystemHealthStatus[];
  lastEvent: string;
}

const SystemHealth: React.FC<Props> = ({ statusItems, lastEvent }) => {
  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">System Health</p>
        <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">Pipeline status and latency</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {statusItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 rounded-3xl border border-[#202227] bg-[#131417] px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-[#e3e3e3]">{item.label}</p>
              <p className="mt-1 text-xs text-[#9ca3af]">{item.detail}</p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold ${item.healthy ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
              <CircleDot size={10} /> {item.status}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-3xl border border-[#202227] bg-[#131417] px-4 py-3 text-sm text-[#9ca3af]">
        <p className="font-semibold text-[#e3e3e3]">Last event</p>
        <p className="mt-2">{lastEvent}</p>
      </div>
    </div>
  );
};

export default SystemHealth;
