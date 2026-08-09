import { create } from 'zustand';

export interface InvestigationResult {
  case_id: string;
  transaction_id: string;
  customer_id: string;
  amount: number;
  source_account?: string;
  beneficiary_account?: string;
  risk_score: number;
  risk_level: string;
  recommendation: string;
  reasons: Array<{ rule: string; points: number; evidence: string }>;
  graph: { cycles: string[][]; neighbors: string[]; evidence: string[]; edges: any[] };
  status: string;
  created_at: string;
  similar_cases?: any[];
}

interface InvestigationState {
  currentCase: InvestigationResult | null;
  isLoading: boolean;
  error: string | null;
  setCase: (caseData: InvestigationResult) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useInvestigationStore = create<InvestigationState>((set) => ({
  currentCase: null,
  isLoading: false,
  error: null,
  setCase: (caseData) => set({ currentCase: caseData, isLoading: false, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ currentCase: null, isLoading: false, error: null }),
}));