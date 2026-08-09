import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useInvestigationStore } from '../stores/investigationStore';
import { useInvestigate } from '../hooks/useInvestigation';

interface InvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InvestigationModal: React.FC<InvestigationModalProps> = ({ isOpen, onClose }) => {
  const [txnId, setTxnId] = useState('');
  const { currentCase, isLoading, setCase, setLoading, setError } = useInvestigationStore();
  const { mutateAsync: investigate } = useInvestigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (txnId.trim()) {
        setLoading(true);
        investigate(txnId)
          .then(setCase)
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [txnId, investigate, setCase, setLoading, setError]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md border border-[#4A4A4A] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
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
        {isLoading && <div className="mt-4 text-[#666]">Investigating...</div>}
        {currentCase && (
          <div className="mt-4 border-t border-[#4A4A4A] pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-[#666]">Risk Score</div>
                <div className="text-3xl font-bold text-[#E94532]">{currentCase.risk_score}</div>
                <div className="text-sm font-medium text-[#242424]">{currentCase.risk_level}</div>
              </div>
              <div>
                <div className="text-sm text-[#666]">Recommendation</div>
                <div className="text-lg font-semibold text-[#242424]">{currentCase.recommendation}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm font-semibold text-[#242424]">Reasons</div>
              <ul className="list-disc list-inside text-sm text-[#242424]">
                {currentCase.reasons.map((r, i) => (
                  <li key={i}>{r.rule}: {r.evidence}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestigationModal;