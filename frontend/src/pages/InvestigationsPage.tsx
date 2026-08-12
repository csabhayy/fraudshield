import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { formatRelativeTime, safeText } from '../utils/format';

const InvestigationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();
  const investigations = stats?.investigations ?? [];

  return (
    <div className="flex h-screen bg-[#0f1114] text-[#e3e3e3] font-sans">
      <main className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#8ca5c0]">Investigations</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#e3e3e3]">All Investigations</h1>
            <p className="mt-1 text-sm text-[#9ca3af]">A list of investigations from the current system state.</p>
          </div>

          <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-4">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#6b7a92]">
                    <th className="w-1/6 p-3">Investigation ID</th>
                    <th className="w-1/6 p-3">Transaction ID</th>
                    <th className="w-1/6 p-3">Risk Score</th>
                    <th className="w-1/6 p-3">Trigger</th>
                    <th className="w-1/6 p-3">Agent</th>
                    <th className="w-1/6 p-3">Status</th>
                    <th className="p-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {investigations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-[#9ca3af]">No investigations available.</td>
                    </tr>
                  )}
                  {investigations.map((inv: any) => (
                    <tr key={inv.investigation_id} className="border-t border-[#202227] hover:bg-[#0f1418]">
                      <td className="p-3 font-semibold text-[#e3e3e3]">{safeText(inv.investigation_id)}</td>
                      <td className="p-3 text-[#c4c7c5] truncate" onClick={() => navigate(`/investigation/${encodeURIComponent(inv.transaction_id)}`)} style={{cursor: 'pointer'}}>
                        {safeText(inv.transaction_id)}
                      </td>
                      <td className="p-3">{inv.risk_score ?? '—'}</td>
                      <td className="p-3 text-[#c4c7c5] truncate">{safeText(inv.trigger)}</td>
                      <td className="p-3">{safeText(inv.agent)}</td>
                      <td className="p-3">{safeText(inv.investigation_status)}</td>
                      <td className="p-3 text-[#9ca3af]">{inv.updated_at ? formatRelativeTime(inv.updated_at) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvestigationsPage;
