import { useMemo, useState } from 'react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useChat } from '../hooks/useChat';
import TransactionActivityChart from '../components/TransactionActivityChart';
import VerificationPanel from '../components/VerificationPanel';
import UnusualTransactionAlerts from '../components/UnusualTransactionAlerts';
import OngoingInvestigation from '../components/OngoingInvestigation';
import RecentTransactions from '../components/RecentTransactions';
import InvestigationModal from '../components/InvestigationModal';
import {
  Settings,
  Key,
  Library,
  Compass,
  MessageSquare,
  Activity,
  FileText,
  Terminal,
  ShieldAlert as ShieldIcon,
  Bell,
  User,
} from 'lucide-react';

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
  const [selectedSection, setSelectedSection] = useState<'overview' | 'investigations' | 'transactions' | 'network' | 'patterns' | 'ai' | 'verification' | 'alerts' | 'settings'>('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
    { role: 'model', content: 'Welcome to FraudShield.' },
  ]);

  const { mutateAsync: sendMessage, isPending: isAiTyping } = useChat();
  const { data: stats, dataUpdatedAt } = useDashboardStats();

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

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const sections = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'investigations', label: 'Investigations', icon: Activity },
    { id: 'transactions', label: 'Transactions', icon: FileText },
    { id: 'network', label: 'Network', icon: Library },
    { id: 'patterns', label: 'Patterns', icon: ShieldIcon },
    { id: 'ai', label: 'AI', icon: Terminal },
    { id: 'verification', label: 'Verification', icon: Key },
    { id: 'alerts', label: 'Alerts', icon: MessageSquare },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const patterns = useMemo(
    () => [
      { title: 'High-value', active: displayStats.alerts.some((alert) => alert.historical_comparison?.amount_multiplier > 3) },
      { title: 'New beneficiary', active: displayStats.alerts.some((alert) => /new beneficiary/i.test(alert.flagged_reason)) },
      { title: 'Velocity', active: displayStats.alerts.some((alert) => /velocity|rapid/i.test(alert.flagged_reason)) },
    ],
    [displayStats.alerts],
  );

  const handleSendPrompt = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);

    try {
      const match = text.match(/(?:txn|tx)[\w-]*/i);
      const matchedCaseId = match ? match[0] : 'general_query';
      const response = await sendMessage({ caseId: matchedCaseId, query: text });
      setChatMessages((prev) => [...prev, { role: 'model', content: String(response ?? 'No response') }]);
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error && (error as any).response?.data?.detail
          ? String((error as any).response.data.detail)
          : 'Unable to contact the investigator.';
      setChatMessages((prev) => [...prev, { role: 'model', content: errorMessage }]);
    }
  };

  const renderSectionPanel = () => {
    switch (selectedSection) {
      case 'investigations':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">Investigations</h2>
              <span className="text-sm text-[#8ab4f8]">{lastUpdated}</span>
            </div>
            <OngoingInvestigation investigations={displayStats.investigations} />
          </section>
        );
      case 'transactions':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">Transactions</h2>
              <span className="text-sm text-[#8ab4f8]">Live</span>
            </div>
            <RecentTransactions />
          </section>
        );
      case 'network':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">Transaction network</h2>
              <span className="text-sm text-[#8ab4f8]">Signals</span>
            </div>
            <div className="rounded-3xl bg-[#16171a] p-5">
              <TransactionActivityChart data={displayStats.chartData} />
            </div>
          </section>
        );
      case 'patterns':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">Patterns</h2>
              <span className="text-sm text-[#8ab4f8]">Active</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {patterns.map((pattern) => (
                <div key={pattern.title} className={`rounded-2xl border px-4 py-3 ${pattern.active ? 'border-[#8ab4f8] bg-[#161b20]' : 'border-[#242629] bg-[#141517]'}`}>
                  <div className="text-sm font-semibold text-[#e3e3e3]">{pattern.title}</div>
                  <div className="mt-2 text-xs text-[#9ca3af]">{pattern.active ? 'Active' : 'Idle'}</div>
                </div>
              ))}
            </div>
          </section>
        );
      case 'ai':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">AI investigator</h2>
              <span className="text-sm text-[#8ab4f8]">Assistant</span>
            </div>
            <div className="rounded-3xl bg-[#16171a] p-5">
              <div className="space-y-3">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl border px-4 py-3 ${msg.role === 'user' ? 'border-[#8ab4f8] bg-[#14171c]' : 'border-[#2f3032] bg-[#131417]'}`}
                  >
                    <p className="text-xs text-[#8ab4f8] mb-2">{msg.role === 'user' ? 'You' : 'AI'}</p>
                    <p className="text-sm text-[#e3e3e3] whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about a transaction..."
                  className="flex-1 rounded-2xl border border-[#2f3032] bg-[#141517] px-4 py-3 text-sm text-[#e3e3e3] focus:outline-none focus:ring-1 focus:ring-[#8ab4f8]"
                />
                <button
                  onClick={handleSendPrompt}
                  disabled={!chatInput.trim() || isAiTyping}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#8ab4f8] px-5 text-sm font-semibold text-[#131313] hover:bg-[#a4c8ff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAiTyping ? 'Thinking…' : 'Send'}
                </button>
              </div>
            </div>
          </section>
        );
      case 'verification':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">Verification</h2>
              <span className="text-sm text-[#8ab4f8]">{displayStats.verification.unassigned} review</span>
            </div>
            <VerificationPanel data={displayStats.verification} activity={displayStats.verificationActivity} />
          </section>
        );
      case 'alerts':
        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-[#e3e3e3]">Alerts</h2>
              <span className="text-sm text-[#f28b82]">{displayStats.unusualTransactions} active</span>
            </div>
            <UnusualTransactionAlerts alerts={displayStats.alerts} />
          </section>
        );
      case 'settings':
        return (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold text-[#e3e3e3]">Settings</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Agent notifications', value: 'Enabled' },
                { label: 'Theme', value: 'Dark' },
                { label: 'Alert sound', value: 'Muted' },
                { label: 'API', value: 'Connected' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#141517] p-4 text-sm text-[#e3e3e3]">
                  <div className="font-medium text-[#c4c7c5]">{item.label}</div>
                  <div className="mt-2 text-sm text-[#e3e3e3]">{item.value}</div>
                </div>
              ))}
            </div>
          </section>
        );
      default:
        return (
          <section className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-3xl bg-[#16171a] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-[#9ca3af]">Overview</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#e3e3e3]">Workspace</h2>
                  </div>
                  <span className="text-sm text-[#8ab4f8]">Updated {lastUpdated}</span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#141517] p-4">
                    <div className="text-2xl font-semibold text-[#e3e3e3]">{displayStats.totalTransactions.toLocaleString()}</div>
                    <div className="mt-1 text-xs text-[#9ca3af]">Transactions</div>
                  </div>
                  <div className="rounded-2xl bg-[#141517] p-4">
                    <div className="text-2xl font-semibold text-[#f28b82]">{displayStats.unusualTransactions.toLocaleString()}</div>
                    <div className="mt-1 text-xs text-[#9ca3af]">Alerts</div>
                  </div>
                  <div className="rounded-2xl bg-[#141517] p-4">
                    <div className="text-2xl font-semibold text-[#fdd663]">{displayStats.verification.unassigned.toLocaleString()}</div>
                    <div className="mt-1 text-xs text-[#9ca3af]">Review</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-[#16171a] p-5 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#9ca3af]">Workspace</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#e3e3e3]">Agent Ready</h3>
                  </div>
                  <div className="rounded-2xl bg-[#8ab4f8]/10 px-3 py-1 text-sm font-semibold text-[#8ab4f8]">Live</div>
                </div>
                <div className="grid gap-3">
                  {patterns.map((pattern) => (
                    <div key={pattern.title} className="flex items-center justify-between rounded-2xl bg-[#141517] px-4 py-3 text-sm text-[#e3e3e3]">
                      <span>{pattern.title}</span>
                      <span className={pattern.active ? 'text-[#8ab4f8]' : 'text-[#9ca3af]'}>{pattern.active ? 'Active' : 'Idle'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#e3e3e3]">Recent investigations</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSection('investigations')}
                    className="rounded-full border border-[#2f3032] bg-[#141517] px-3 py-2 text-sm text-[#8ab4f8] hover:bg-[#1f2124] transition-colors"
                  >
                    Investigations
                  </button>
                </div>
                <div className="mt-4">
                  <OngoingInvestigation investigations={displayStats.investigations} />
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setSelectedSection('ai')}
                  className="w-full rounded-2xl bg-[#8ab4f8] px-4 py-3 text-sm font-semibold text-[#131313] hover:bg-[#a4c8ff] transition-colors"
                >
                  Open AI investigator
                </button>
                <button
                  onClick={() => setSelectedSection('alerts')}
                  className="w-full rounded-2xl border border-[#2f3032] bg-[#141517] px-4 py-3 text-sm text-[#e3e3e3] hover:bg-[#1f2124] transition-colors"
                >
                  Review alerts
                </button>
              </div>
            </div>
          </section>
        );
    }
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
