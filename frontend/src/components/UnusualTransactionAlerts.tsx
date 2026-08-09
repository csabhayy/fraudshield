import React from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';

interface Alert {
  client: string;
  description: string;
  amount: number;
}

interface UnusualTransactionAlertsProps {
  alerts: Alert[];
}

const formatAmount = (amount: number) => {
  if (amount === 0) return '';
  return `$${amount.toLocaleString()}`;
};

const UnusualTransactionAlerts: React.FC<UnusualTransactionAlertsProps> = ({ alerts }) => {
  return (
    <div className="border border-[#4A4A4A] rounded-md bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="bg-[#E94532] text-white py-1.5 text-center font-serif font-bold text-sm">
        Unusual transaction alerts
      </div>
      <div className="p-4 space-y-3">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className="flex items-start space-x-3 text-sm font-sans text-[#242424] hover:bg-gray-50 p-2 rounded-md transition-colors duration-150 cursor-default"
          >
            <AlertCircle size={16} className="text-[#E94532] flex-shrink-0 mt-0.5" />
            <ChevronRight size={14} className="text-[#E94532] flex-shrink-0 mt-1" />
            <span>
              {alert.client && <span className="font-bold">{alert.client} </span>}
              {alert.description}
              {alert.amount > 0 && (
                <span className="text-[#E94532] font-bold ml-1">{formatAmount(alert.amount)}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnusualTransactionAlerts;