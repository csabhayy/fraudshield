const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const safeText = (value: unknown, fallback = 'Not available'): string => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') {
    return fallback;
  }
  if (text === '[object Object]') {
    return fallback;
  }
  return text;
};

export const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

export const formatCurrencyINR = (value: unknown, fallback = 'Not available'): string => {
  const amount = safeNumber(value, Number.NaN);
  if (!Number.isFinite(amount)) {
    return fallback;
  }
  return INR_FORMATTER.format(amount);
};

export const formatDateTime = (value: unknown, fallback = 'Not available'): string => {
  if (!value) {
    return fallback;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleString();
};

export const formatTime = (value: unknown, fallback = '--:--'): string => {
  if (!value) {
    return fallback;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleTimeString();
};

export const formatRelativeTime = (value: unknown, fallback = 'Not available'): string => {
  if (!value) {
    return fallback;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const deltaMs = Date.now() - date.getTime();
  const deltaMins = Math.floor(deltaMs / 60000);
  if (deltaMins < 1) {
    return 'Just now';
  }
  if (deltaMins < 60) {
    return `${deltaMins}m ago`;
  }
  const deltaHours = Math.floor(deltaMins / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d ago`;
};

export const riskTone = (score: unknown): 'low' | 'medium' | 'high' => {
  const numeric = safeNumber(score, 0);
  if (numeric >= 70) {
    return 'high';
  }
  if (numeric >= 40) {
    return 'medium';
  }
  return 'low';
};