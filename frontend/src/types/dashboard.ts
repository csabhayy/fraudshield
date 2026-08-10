export interface ChartData {
  category: string;
  count: number;
}

export interface AlertSignal {
  signal: string;
  severity: 'Low' | 'Medium' | 'High';
  evidence: string;
  comparison?: Record<string, number | string | boolean>;
}

export interface AlertHistoricalComparison {
  customer_avg_amount: number;
  amount_multiplier: number;
  previous_alerts: number;
  days_since_last_transaction: number;
}

export interface DashboardAlert {
  transaction_id: string;
  customer_id: string;
  customer_name: string;
  source_account: string;
  beneficiary_account: string;
  amount: number;
  channel: string;
  location: string;
  timestamp: string;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  flagged_reason: string;
  risk_signals: AlertSignal[];
  historical_comparison: AlertHistoricalComparison;
  investigation_status: string;
  recommended_next_action: string;
}

export interface OngoingInvestigationItem {
  investigation_id: string;
  transaction_id: string;
  customer_id: string;
  risk_score: number;
  status: string;
  current_stage: string;
  progress_pct: number;
  completed_steps: string[];
  active_step: string;
  pending_steps: string[];
  last_updated: string;
  agent_status: string;
}

export interface VerificationActivityItem {
  case_id: string;
  transaction_id: string;
  updated_at: string;
  customer_id: string;
  customer_name: string;
  source_account: string;
  beneficiary_account: string;
  amount: number;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High';
  status: string;
  investigation_status: string;
}

export interface DashboardStats {
  totalTransactions: number;
  unusualTransactions: number;
  verification: { verified: number; fraudulent: number; unassigned: number };
  verificationActivity: VerificationActivityItem[];
  alerts: DashboardAlert[];
  investigations: OngoingInvestigationItem[];
  chartData: ChartData[];
}