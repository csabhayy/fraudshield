import { useState } from 'react';
import { useDashboardStats } from './hooks/useDashboardStats';
import DashboardHeader from './components/DashboardHeader';
import RecentActivity from './components/RecentActivity';
import TransactionActivityChart from './components/TransactionActivityChart';
import VerificationPanel from './components/VerificationPanel';
import UnusualTransactionAlerts from './components/UnusualTransactionAlerts';
import OngoingInvestigation from './components/OngoingInvestigation';
import RecentTransactions from './components/RecentTransactions';
import DashboardFooter from './components/DashboardFooter';
import InvestigationModal from './components/InvestigationModal';
import { Search } from 'lucide-react';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data, isLoading, error, dataUpdatedAt } = useDashboardStats();

  const stats = data || {
    totalTransactions: 0,
    unusualTransactions: 0,
    verification: { verified: 0, fraudulent: 0, unassigned: 0 },
    alerts: [],
    investigations: [],
    chartData: [
      { category: 'Valid', count: 0 },
      { category: 'Fraud', count: 0 },
      { category: 'Unassigned', count: 0 },
    ],
  };

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '--:--:--';

  return (
    <div className="min-h-screen bg-[#F8F8F6] p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-4">
          <DashboardHeader />
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-[#E94532] text-white px-5 py-2.5 rounded-md hover:bg-red-700 transition-colors shadow-sm z-10"
          >
            <Search size={18} />
            <span className="font-medium">Investigate</span>
          </button>
        </div>

        <div className="text-right text-xs text-gray-400 mb-2">
          Last updated: {lastUpdated}
        </div>

        {isLoading && <div className="text-center text-gray-600 mt-10">Loading dashboard data...</div>}
        {error && <div className="text-center text-red-600 mt-10">Error loading data. Using fallback.</div>}

        <div className="grid grid-cols-12 gap-4 mt-6">
          <div className="col-span-3">
            <RecentActivity total={stats.totalTransactions} unusual={stats.unusualTransactions} />
          </div>
          <div className="col-span-6">
            <TransactionActivityChart data={stats.chartData} />
          </div>
          <div className="col-span-3">
            <VerificationPanel data={stats.verification} />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 mt-6">
          <div className="col-span-5">
            <UnusualTransactionAlerts alerts={stats.alerts} />
          </div>
          <div className="col-span-7">
            <OngoingInvestigation investigations={stats.investigations} />
          </div>
        </div>

        {/* Live Transaction Feed */}
        <div className="mt-6">
          <RecentTransactions />
        </div>

        <DashboardFooter />
        <InvestigationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </div>
  );
}

export default App;