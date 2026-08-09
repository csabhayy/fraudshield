export const recentActivity = {
  totalTransactions: 36421,
  unusualTransactions: 250,
};

export const verificationData = {
  verified: 130,
  fraudulent: 80,
  unassigned: 40,
};

export const alerts = [
  { client: 'Johnson', description: 'did more than 10 transactions at same time a day totaling', amount: 550000 },
  { client: 'Martha', description: 'did more than 25 transactions in same month totaling', amount: 2550000 },
  { client: '', description: 'Add text here', amount: 0 },
  { client: '', description: 'Add text here', amount: 0 },
];

export const investigations = [
  { bank: 'Federal bank USA', client: 'Johnson', assigned: 'Agent smith', progress: 2, status: 'Investigation opened' },
  { bank: 'Add text here', client: 'Martha', assigned: 'Agent smith', progress: 3, status: 'In peer review' },
  { bank: 'Add text here', client: 'Add text here', assigned: 'Agent smith', progress: 5, status: 'Complete' },
  { bank: 'Add text here', client: 'Add text here', assigned: 'Agent smith', progress: 1, status: 'Confirmed as unusual' },
];

export const chartData = [
  { time: '8:00', valid: 12, fraud: 3, unassigned: 1 },
  { time: '9:00', valid: 18, fraud: 5, unassigned: 2 },
  { time: '10:00', valid: 22, fraud: 8, unassigned: 4 },
  { time: '11:00', valid: 20, fraud: 6, unassigned: 3 },
  { time: '12:00', valid: 15, fraud: 4, unassigned: 2 },
  { time: '13:00', valid: 10, fraud: 2, unassigned: 1 },
  { time: '14:00', valid: 8, fraud: 1, unassigned: 0 },
  { time: '15:00', valid: 5, fraud: 0, unassigned: 0 },
];