export interface ChartData {
  category: string;
  count: number;
}

export interface DashboardStats {
  totalTransactions: number;
  unusualTransactions: number;
  verification: { verified: number; fraudulent: number; unassigned: number };
  alerts: Array<{ client: string; description: string; amount: number }>;
  investigations: Array<{ bank: string; client: string; assigned: string; progress: number; status: string }>;
  chartData: ChartData[];
}