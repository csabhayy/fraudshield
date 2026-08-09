import React from 'react';
import { User } from 'lucide-react';

interface Investigation {
  bank: string;
  client: string;
  assigned: string;
  progress: number; // 1–5
  status: string;
}

interface OngoingInvestigationProps {
  investigations: Investigation[];
}

const ProgressCircles: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full border border-[#4A4A4A] ${
            i <= progress ? 'bg-[#E94532] border-[#E94532]' : 'bg-white'
          }`}
        />
      ))}
    </div>
  );
};

const OngoingInvestigation: React.FC<OngoingInvestigationProps> = ({ investigations }) => {
  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white overflow-hidden">
      <div className="bg-[#E94532] text-white py-1.5 text-center font-serif font-bold text-sm">
        Ongoing investigation
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="bg-gray-100 border-b border-[#4A4A4A]">
              <th className="text-left px-4 py-2 font-serif font-bold text-[#242424]">Bank</th>
              <th className="text-left px-4 py-2 font-serif font-bold text-[#242424]">Client</th>
              <th className="text-left px-4 py-2 font-serif font-bold text-[#242424]">Assigned to</th>
              <th className="text-left px-4 py-2 font-serif font-bold text-[#242424]">Progress</th>
            </tr>
          </thead>
          <tbody>
            {investigations.map((inv, idx) => (
              <tr key={idx} className="border-b border-[#4A4A4A] hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-4 py-2 text-[#242424]">{inv.bank}</td>
                <td className="px-4 py-2 text-[#242424]">{inv.client}</td>
                <td className="px-4 py-2 flex items-center space-x-2 text-[#242424]">
                  <User size={16} className="text-[#E94532]" />
                  <span>{inv.assigned}</span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center space-x-3">
                    <ProgressCircles progress={inv.progress} />
                    <span className="text-xs text-[#666]">{inv.status}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OngoingInvestigation;