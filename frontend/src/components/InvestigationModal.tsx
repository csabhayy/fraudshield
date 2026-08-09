import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InvestigationModal: React.FC<InvestigationModalProps> = ({ isOpen, onClose }) => {
  const [txnId, setTxnId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (txnId.trim()) {
        onClose();
        navigate(`/investigation/${txnId}`);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [txnId, onClose, navigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
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
          onChange={(e) => setTxnId(e.target.value)}
          className="w-full px-4 py-2 border border-[#4A4A4A] rounded-md focus:ring-1 focus:ring-[#E94532] text-[#242424]"
        />
        <p className="text-xs text-gray-400 mt-2">Investigation will start automatically</p>
      </div>
    </div>
  );
};

export default InvestigationModal;