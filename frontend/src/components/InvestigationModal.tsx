import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InvestigationModal: React.FC<InvestigationModalProps> = ({ isOpen, onClose }) => {
  const [txnId, setTxnId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const runInvestigation = () => {
    const normalized = txnId.trim();
    if (!normalized) {
      setError('Enter a transaction ID to continue.');
      return;
    }
    setError('');
    onClose();
    navigate(`/investigation/${normalized}`);
    setTxnId('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-3">
      <div className="bg-white rounded-md border border-[#4A4A4A] w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl font-bold text-[#242424]">Investigate Transaction</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>
        <input
          type="text"
          placeholder="Enter Transaction ID (e.g., TXN-CRIT-001)"
          value={txnId}
          onChange={(e) => {
            setTxnId(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              runInvestigation();
            }
          }}
          className="w-full px-4 py-2 border border-[#4A4A4A] rounded-md focus:ring-1 focus:ring-[#E94532] text-[#242424]"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={runInvestigation}
            className="px-3 py-2 rounded-md bg-[#E94532] text-white text-sm hover:bg-red-700"
          >
            Start Investigation
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvestigationModal;