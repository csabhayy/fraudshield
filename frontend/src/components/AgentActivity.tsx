import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { AgentActivityItem } from '../types/dashboard';
import { formatTime, safeText } from '../utils/format';

interface Props {
  agents: { name: string; description: string; status: 'ACTIVE' | 'IDLE' }[];
  activity: AgentActivityItem[];
}

const statusClasses = {
  ACTIVE: 'bg-[#0f1724] text-[#8ab4f8] border-[#8ab4f8]/20',
  IDLE: 'bg-[#11151a] text-[#9ca3af] border-[#2f3032]/70',
};

const AgentActivity: React.FC<Props> = ({ agents, activity }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4 shadow-sm ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">AI Agent Activity</p>
          <h2 className="mt-2 text-lg font-semibold text-[#e3e3e3]">What the system is doing now</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/ai')}
          className="rounded-2xl border border-[#2f3032] bg-[#131417] px-3 py-2 text-xs font-semibold text-[#8ab4f8] hover:bg-[#1f2124]"
        >
          Open AI Investigator →
        </button>
      </div>
      <div className="mt-5 grid gap-3">
        {agents.map((agent) => (
          <div key={agent.name} className="rounded-3xl border border-[#202227] bg-[#131417] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#e3e3e3]">{agent.name}</h3>
                <p className="mt-1 text-xs text-[#9ca3af]">{agent.description}</p>
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClasses[agent.status]}`}>
                {agent.status}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {activity.slice(0, 5).map((item) => (
          <button
            type="button"
            key={`${item.agent}-${item.time}-${item.message}`}
            onClick={() => navigate(`/investigation/${encodeURIComponent(item.transaction_id ?? '')}`)}
            className="w-full rounded-3xl border border-[#202227] bg-[#131417] px-4 py-3 text-left transition hover:border-[#8ab4f8] hover:bg-[#16181b]"
          >
            <div className="flex items-center justify-between gap-3 text-sm text-[#c4c7c5]">
              <span>{formatTime(item.time)}</span>
              <span className="rounded-full border border-[#2f3032] bg-[#11151a] px-2 py-1 text-[11px] font-semibold text-[#9ca3af]">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-[#e3e3e3]">{safeText(item.agent)}</p>
            <p className="mt-1 text-sm text-[#9ca3af]">{safeText(item.message)}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default AgentActivity;
