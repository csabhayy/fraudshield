import { useMemo, useState } from 'react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';
import { formatCurrencyINR, formatRelativeTime } from '../utils/format';
import { useLiveTransactions } from '../hooks/useLiveTransactions';
import MetricCard from '../components/MetricCard';
import LiveTransactionTable from '../components/LiveTransactionTable';
import AlertQueue from '../components/AlertQueue';
import InvestigationTable from '../components/InvestigationTable';
import InvestigationModal from '../components/InvestigationModal';
import { Settings, Compass, Bell, User } from 'lucide-react';

const ProductLogoIcon = () => (
  <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fraudshieldGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8ab4f8" />
        <stop offset="100%" stopColor="#5c78ff" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="14" fill="#14171a" />
    <path d="M24 10L13 18v12c0 8 7 14 11 16 4-2 11-8 11-16V18L24 10Z" fill="#1f2532" stroke="#0f1720" strokeWidth="2" />
    <path d="M32 22h6a1.5 1.5 0 1 1 0 3h-6v4h6a1.5 1.5 0 1 1 0 3h-6v2" stroke="url(#fraudshieldGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 18h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Dashboard = () => {
  const [selectedSection, setSelectedSection] = useState<'overview'>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: stats, dataUpdatedAt } = useDashboardStats();
  const { data: businessMetrics } = useBusinessMetrics();

  const live = useLiveTransactions();
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'highRisk' | 'blocked' | 'review'>('all');

  const displayStats = stats || {
    totalTransactions: 0,
    unusualTransactions: 0,
    verification: { verified: 0, fraudulent: 0, unassigned: 0 },
    verificationActivity: [],
    alerts: [],
    investigations: [],
    chartData: [
      { category: 'Valid', count: 0 },
      { category: 'Fraud', count: 0 },
      { category: 'Unassigned', count: 0 },
    ],
  };

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';

  // Format Money at Risk
  const moneyAtRiskDisplay = useMemo(() => {
    if (!businessMetrics?.moneyAtRisk.available) {
      return 'Unavailable';
    }
    const value = businessMetrics.moneyAtRisk.value || 0;
    const count = businessMetrics.moneyAtRisk.transactionCount || 0;
    return `₹${(value / 100000).toFixed(2)}L (${count} txns)`;
  }, [businessMetrics?.moneyAtRisk]);

  // Format Fraud Prevented
  const fraudPreventedDisplay = useMemo(() => {
    if (!businessMetrics?.fraudPrevented.available) {
      return 'Unavailable';
    }
    const value = businessMetrics.fraudPrevented.value || 0;
    return formatCurrencyINR(value, 'Unavailable');
  }, [businessMetrics?.fraudPrevented]);

  const fraudPreventedSubtitle = useMemo(() => {
    if (!businessMetrics?.fraudPrevented.available) {
      return businessMetrics?.fraudPrevented.reason || 'Insufficient outcome data';
    }
    return `${businessMetrics.fraudPrevented.transactionCount || 0} confirmed fraud blocked`;
  }, [businessMetrics?.fraudPrevented]);

  // Format Fraud Loss
  const fraudLossDisplay = useMemo(() => {
    if (!businessMetrics?.fraudLoss.available) {
      return 'Unavailable';
    }
    const value = businessMetrics.fraudLoss.value || 0;
    return formatCurrencyINR(value, 'Unavailable');
  }, [businessMetrics?.fraudLoss]);

  const fraudLossSubtitle = useMemo(() => {
    if (!businessMetrics?.fraudLoss.available) {
      return businessMetrics?.fraudLoss.reason || 'Confirmed loss data unavailable';
    }
    return `Net loss on ${businessMetrics.fraudLoss.transactionCount || 0} cases`;
  }, [businessMetrics?.fraudLoss]);

  // Format Detection Rate
  const detectionRateDisplay = useMemo(() => {
    if (!businessMetrics?.detectionRate.available) {
      return 'Unavailable';
    }
    const rate = businessMetrics.detectionRate.ratePercentage || 0;
    return `${rate.toFixed(1)}%`;
  }, [businessMetrics?.detectionRate]);

  const detectionRateSubtitle = useMemo(() => {
    if (!businessMetrics?.detectionRate.available) {
      return businessMetrics?.detectionRate.reason || 'No defensible metric available';
    }
    return `${businessMetrics.detectionRate.detectedFraudCount}/${businessMetrics.detectionRate.confirmedFraudCount} detected`;
  }, [businessMetrics?.detectionRate]);

  // Format Review Queue
  const reviewQueueDisplay = useMemo(() => {
    return businessMetrics?.reviewQueue?.count ?? 0;
  }, [businessMetrics?.reviewQueue]);

  const transactionsScreened = displayStats.totalTransactions ?? 0;
  const alertsGenerated = (displayStats.alerts || []).length;
  const blockedCount = live.transactions.filter((tx) => tx.decision === 'BLOCK').length;
  const challengedCount = live.transactions.filter((tx) => tx.decision === 'REVIEW').length;

  const systemStatus = useMemo(() => {
    if (!live.lastReceivedAt) return 'OFFLINE';
    const ageMs = Date.now() - live.lastReceivedAt.getTime();
    if (ageMs < 15000) return 'LIVE';
    if (ageMs < 5 * 60 * 1000) return 'STALE';
    return 'OFFLINE';
  }, [live.lastReceivedAt]);

  const sections = [{ id: 'overview', label: 'Overview', icon: Compass }];

  const renderSectionPanel = () => {
    return (
      <section className="space-y-6">
        <div className="rounded-3xl border border-[#2f3032] bg-[#141517] p-5 shadow-sm ring-1 ring-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#8ca5c0]">Overview</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#e3e3e3]">Fraud Operations Dashboard</h2>
              <p className="mt-2 text-sm text-[#9ca3af]">Live monitoring · Updated {lastUpdated}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                  systemStatus === 'LIVE'
                    ? 'border-[#2f6b3e] bg-[#0b1f12] text-[#7dd3a2]'
                    : systemStatus === 'STALE'
                    ? 'border-[#6b4f1a] bg-[#1a1208] text-[#f9a826]'
                    : 'border-[#3a3d40] bg-[#0f0f10] text-[#9ca3af]'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${systemStatus === 'LIVE' ? 'bg-[#7dd3a2]' : systemStatus === 'STALE' ? 'bg-[#f9a826]' : 'bg-[#6b7280]'}`} />
                {systemStatus}
              </span>
              <span className="text-xs text-[#9ca3af]">{live.lastReceivedAt ? formatRelativeTime(live.lastReceivedAt) : 'No data'}</span>
              <button type="button" className="rounded-2xl border border-[#2f3032] bg-[#131417] px-3 py-2 text-xs font-semibold text-[#8ab4f8] hover:bg-[#1f2124]">
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Money at risk" value={moneyAtRiskDisplay} subtitle="Current unresolved exposure" accent="red" />
            <MetricCard label="Fraud prevented" value={fraudPreventedDisplay} subtitle={fraudPreventedSubtitle} accent="green" />
            <MetricCard label="Fraud loss" value={fraudLossDisplay} subtitle={fraudLossSubtitle} accent="amber" />
            <MetricCard label="Review queue" value={`${reviewQueueDisplay}`} subtitle="Awaiting human decision" accent="amber" />
            <MetricCard label="Detection rate" value={detectionRateDisplay} subtitle={detectionRateSubtitle} accent="blue" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#9ca3af]">
            <div className="rounded-2xl bg-[#111417] px-3 py-2">Transactions screened: <span className="font-semibold text-[#e3e3e3]">{transactionsScreened}</span></div>
            <div className="rounded-2xl bg-[#111417] px-3 py-2">Alerts generated: <span className="font-semibold text-[#e3e3e3]">{alertsGenerated}</span></div>
            <div className="rounded-2xl bg-[#111417] px-3 py-2">Blocked: <span className="font-semibold text-[#e3e3e3]">{blockedCount}</span></div>
            <div className="rounded-2xl bg-[#111417] px-3 py-2">Challenged: <span className="font-semibold text-[#e3e3e3]">{challengedCount}</span></div>
            <div className="rounded-2xl bg-[#111417] px-3 py-2">Cases awaiting review: <span className="font-semibold text-[#e3e3e3]">{reviewQueueDisplay}</span></div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr] items-stretch min-h-0">
          <LiveTransactionTable
            transactions={live.transactions}
            highlightedIds={live.highlightedIds}
            currentFilter={transactionFilter}
            onFilterChange={setTransactionFilter}
          />
          <AlertQueue alerts={displayStats.alerts} />
        </div>

        <div className="grid gap-6">
          <InvestigationTable investigations={displayStats.investigations} />
        </div>
      </section>
    );
  };

  return (
    <div className="flex h-screen bg-[#0f1114] text-[#e3e3e3] font-sans">
      <aside className="flex w-72 flex-col border-r border-[#242629] bg-[#16171a] px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-3xl border border-[#2f3032] bg-[#191b1f]">
            <ProductLogoIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e3e3e3]">FraudShield</p>
            <p className="text-xs text-[#9ca3af]">AI Workspace</p>
          </div>
        </div>

        <div className="mt-8 space-y-1">
          {sections.map((item) => {
            const active = selectedSection === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedSection(item.id as any)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm text-left transition-all ${
                  active ? 'bg-[#202328] text-[#e3e3e3]' : 'text-[#9ca3af] hover:bg-[#202328] hover:text-[#e3e3e3]'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto rounded-3xl bg-[#141517] p-4 text-sm text-[#c4c7c5]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[#e3e3e3]">Workspace</p>
              <p className="mt-1 text-xs text-[#9ca3af]">Analyst · Fraud unit</p>
            </div>
            <User size={18} className="text-[#8ab4f8]" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-[#242629] bg-[#141517] px-6">
          <h1 className="text-2xl font-semibold text-[#e3e3e3]">
            {selectedSection === 'overview' ? 'Overview' : itemLabel(selectedSection)}
          </h1>
          <div className="flex items-center gap-3">
            <button className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#2f3032] bg-[#16171a] px-4 text-sm text-[#e3e3e3] hover:bg-[#1f2124] transition-colors">
              <Bell size={16} /> Alerts
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#2f3032] bg-[#16171a] px-4 text-sm text-[#e3e3e3] hover:bg-[#1f2124] transition-colors">
              <Settings size={16} /> Workspace
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">{renderSectionPanel()}</div>
        </div>
      </main>

      <InvestigationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

const itemLabel = (id: string) => {
  const map: Record<string, string> = {
    overview: 'Overview',
    investigations: 'Investigations',
    transactions: 'Transactions',
    network: 'Network',
    patterns: 'Patterns',
    ai: 'AI',
    verification: 'Verification',
    alerts: 'Alerts',
    settings: 'Settings',
  };
  return map[id] ?? 'Overview';
};

export default Dashboard;
