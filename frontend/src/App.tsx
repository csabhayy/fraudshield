import { useState } from 'react';
import { useDashboardStats } from './hooks/useDashboardStats';
import DashboardHeader from './components/DashboardHeader';
import RecentActivity from './components/RecentActivity';
import TransactionActivityChart from './components/TransactionActivityChart';
import VerificationPanel from './components/VerificationPanel';
import UnusualTransactionAlerts from './components/UnusualTransactionAlerts';
import OngoingInvestigation from './components/OngoingInvestigation';
import DashboardFooter from './components/DashboardFooter';
import InvestigationModal from './components/InvestigationModal';
import { Search } from 'lucide-react';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: stats, isLoading, error } = useDashboardStats();

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

        {isLoading && <div className="text-center text-gray-600 mt-10">Loading dashboard data...</div>}
        {error && <div className="text-center text-red-600 mt-10">Error loading data.</div>}

        {stats && (
          <>
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
          </>
        )}

        <DashboardFooter />
        <InvestigationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </div>
  );
}

export default App;