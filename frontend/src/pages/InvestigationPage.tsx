import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { animated, useSpring } from '@react-spring/web';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Circle,
  Copy,
  Download,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { streamInvestigation, type InvestigationStageUpdate } from '../hooks/useInvestigation';
import { useChat } from '../hooks/useChat';
import { apiClient } from '../api/client';
import type { InvestigationResult } from '../stores/investigationStore';
import {
  formatCurrencyINR,
  formatDateTime,
  formatRelativeTime,
  safeNumber,
  safeText,
} from '../utils/format';

type AgentStepId =
  | 'data_retriever'
  | 'graph_analyst'
  | 'rule_engine'
  | 'anomaly_detector'
  | 'rag_retriever'
  | 'report_generator';

type RuntimeStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'RETRIEVING_DATA'
  | 'ANALYZING'
  | 'WAITING_FOR_AGENT'
  | 'COMPLETED'
  | 'FAILED'
  | 'PARTIAL_RESULT';

type OrbState = 'idle' | 'investigating' | 'retrieving' | 'analyzing' | 'network' | 'complete' | 'failed';
type StepStatus = InvestigationStageUpdate['status'] | 'pending';
type VisualNodeKind = 'customer' | 'account' | 'transaction' | 'beneficiary' | 'device' | 'location';
type VisualTone = 'neutral' | 'accent' | 'risk' | 'support';

interface CustomerHistoryItem {
  transaction_id: string;
  amount: number;
  channel: string;
  location: string;
  timestamp: string;
  days_since_last_txn: number;
  previous_alerts: number;
  source_account?: string;
  beneficiary_account?: string;
  device_id?: string;
}

interface ReportGenerationState {
  running: boolean;
  completed: boolean;
  stageIndex: number;
  report: string;
}

interface StoryNode {
  id: string;
  kind: VisualNodeKind;
  title: string;
  line1: string;
  line2: string;
  badge: string;
  column: number;
  weight: 'primary' | 'secondary';
  tone: VisualTone;
  suspicious: boolean;
  activationOrder: number;
  metadata: Array<{ label: string; value: string }>;
}

interface StoryLink {
  id: string;
  source: string;
  target: string;
  relation: string;
  suspicious: boolean;
  order: number;
  metadata: Array<{ label: string; value: string }>;
}

interface PositionedNode extends StoryNode {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface PositionedLink extends StoryLink {
  path: string;
  labelX: number;
  labelY: number;
}

interface GraphModel {
  nodes: PositionedNode[];
  links: PositionedLink[];
  hoveredNode: PositionedNode | null;
  hoveredLink: PositionedLink | null;
  height: number;
}

const STAGE_DEFINITIONS: Array<{
  id: AgentStepId;
  agent: string;
  activeLabel: string;
  completeLabel: string;
  description: string;
  runtime: RuntimeStatus;
  orb: OrbState;
}> = [
  {
    id: 'data_retriever',
    agent: 'Transaction Agent',
    activeLabel: 'Retrieving transaction details',
    completeLabel: 'Transaction retrieved',
    description: 'Loads the transaction, account, and customer baseline.',
    runtime: 'RETRIEVING_DATA',
    orb: 'retrieving',
  },
  {
    id: 'graph_analyst',
    agent: 'Network Agent',
    activeLabel: 'Analyzing transaction network',
    completeLabel: 'Transaction network analyzed',
    description: 'Maps counterparties, related accounts, and suspicious connections.',
    runtime: 'ANALYZING',
    orb: 'network',
  },
  {
    id: 'rule_engine',
    agent: 'Pattern Agent',
    activeLabel: 'Checking known fraud patterns',
    completeLabel: 'Fraud patterns compared',
    description: 'Applies deterministic fraud rules to explain the risk score.',
    runtime: 'ANALYZING',
    orb: 'analyzing',
  },
  {
    id: 'anomaly_detector',
    agent: 'Risk Agent',
    activeLabel: 'Comparing historical behavior',
    completeLabel: 'Historical behavior compared',
    description: 'Measures how unusual the transaction is for this customer.',
    runtime: 'ANALYZING',
    orb: 'analyzing',
  },
  {
    id: 'rag_retriever',
    agent: 'Investigation Agent',
    activeLabel: 'Comparing precedent cases',
    completeLabel: 'Similar cases reviewed',
    description: 'Searches for related historical fraud cases and precedents.',
    runtime: 'WAITING_FOR_AGENT',
    orb: 'investigating',
  },
  {
    id: 'report_generator',
    agent: 'Report Agent',
    activeLabel: 'Generating investigation summary',
    completeLabel: 'Investigation summary generated',
    description: 'Produces analyst-ready findings and recommendation.',
    runtime: 'PARTIAL_RESULT',
    orb: 'investigating',
  },
];

const REPORT_STEPS = [
  'Collecting investigation evidence...',
  'Building transaction timeline...',
  'Summarizing risk signals...',
  'Analyzing network relationships...',
  'Generating investigation report...',
];

const kindToneClasses: Record<VisualTone, string> = {
  neutral: 'border-gray-200 bg-white text-[#242424]',
  accent: 'border-[#E94532]/30 bg-[#FFF7F5] text-[#242424]',
  risk: 'border-red-200 bg-red-50 text-[#242424]',
  support: 'border-blue-200 bg-blue-50 text-[#242424]',
};

const kindBadgeClasses: Record<VisualNodeKind, string> = {
  customer: 'bg-[#E8F3ED] text-[#1E5C45]',
  account: 'bg-[#EAF3FF] text-[#1F4E8C]',
  transaction: 'bg-[#FFF0EC] text-[#B3301F]',
  beneficiary: 'bg-[#F2ECFF] text-[#6F42C1]',
  device: 'bg-[#FFF7E7] text-[#9A6700]',
  location: 'bg-[#F2F4F7] text-[#475467]',
};

const edgeStroke = '#A4ACB9';
const suspiciousEdgeStroke = '#E94532';

const maskAccount = (value: string, fallback = 'Information unavailable'): string => {
  const text = safeText(value, '');
  if (!text) {
    return fallback;
  }
  const suffix = text.slice(-4);
  return suffix ? `•••• ${suffix}` : text;
};

const formatShortDate = (value: unknown): string => {
  if (!value) {
    return 'Information unavailable';
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return 'Information unavailable';
  }
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildStorySentence = (riskLevel: string, amountMultiplier: number, newBeneficiary: boolean): string => {
  if (riskLevel === 'Critical' || riskLevel === 'Very High' || riskLevel === 'High') {
    if (newBeneficiary && amountMultiplier >= 3) {
      return 'Transaction is significantly outside the customer\'s normal behavior and routes funds to a new beneficiary.';
    }
    if (amountMultiplier >= 3) {
      return 'Transaction amount is materially higher than the customer baseline and requires review.';
    }
    return 'Investigation detected multiple signals that increase fraud risk.';
  }
  return 'Transaction risk is elevated but does not yet indicate a critical fraud event.';
};

const InvestigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutateAsync: chat } = useChat();

  const [caseData, setCaseData] = useState<InvestigationResult | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistoryItem[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('IDLE');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [stageState, setStageState] = useState<Record<AgentStepId, StepStatus>>(
    Object.fromEntries(STAGE_DEFINITIONS.map((stage) => [stage.id, 'pending'])) as Record<AgentStepId, StepStatus>,
  );
  const [stageDurations, setStageDurations] = useState<Record<string, number>>({});
  const [activeStageId, setActiveStageId] = useState<AgentStepId | null>(null);
  const [focusSuspiciousPath, setFocusSuspiciousPath] = useState(true);
  const [animationStep, setAnimationStep] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [showDetailedReasoning, setShowDetailedReasoning] = useState(false);
  const [aiOrbExpanded, setAiOrbExpanded] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [reportState, setReportState] = useState<ReportGenerationState>({
    running: false,
    completed: false,
    stageIndex: -1,
    report: '',
  });
  const [graphWidth, setGraphWidth] = useState(960);

  useEffect(() => {
    const syncWidth = () => {
      const nextWidth = Math.max(320, Math.min(window.innerWidth - 48, 1100));
      setGraphWidth(nextWidth >= 1024 ? Math.min(960, nextWidth - 220) : nextWidth - 24);
    };
    syncWidth();
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, []);

  useEffect(() => {
    if (!id) return;

    setCaseData(null);
    setCustomerHistory([]);
    setInvestigationError(null);
    setRuntimeStatus('RUNNING');
    setOrbState('investigating');
    setIsStreaming(true);
    setAiResponse('');
    setAnimationStep(0);
    setActiveStageId(null);
    setStageState(Object.fromEntries(STAGE_DEFINITIONS.map((stage) => [stage.id, 'pending'])) as Record<AgentStepId, StepStatus>);
    setStageDurations({});

    const stopStream = streamInvestigation(id, {
      onStarted: () => {
        setRuntimeStatus('RUNNING');
        setOrbState('investigating');
      },
      onStageUpdate: (update) => {
        const stageId = update.stage as AgentStepId;
        const stageDefinition = STAGE_DEFINITIONS.find((stage) => stage.id === stageId);
        setStageState((prev) => ({ ...prev, [stageId]: update.status }));
        if (typeof update.duration_ms === 'number') {
          setStageDurations((prev) => ({ ...prev, [stageId]: update.duration_ms as number }));
        }
        if (update.status === 'started' && stageDefinition) {
          setRuntimeStatus(stageDefinition.runtime);
          setOrbState(stageDefinition.orb);
          setActiveStageId(stageId);
        }
        if (update.status === 'completed') {
          setActiveStageId(null);
        }
        if (update.status === 'failed') {
          setRuntimeStatus('FAILED');
          setOrbState('failed');
          setActiveStageId(null);
        }
      },
      onResult: (result) => {
        setCaseData(result);
        setRuntimeStatus('PARTIAL_RESULT');
      },
      onDone: () => {
        setIsStreaming(false);
        setRuntimeStatus('COMPLETED');
        setOrbState('complete');
        setActiveStageId(null);
      },
      onError: ({ message }) => {
        setInvestigationError(safeText(message, 'Investigation failed.'));
        setRuntimeStatus('FAILED');
        setOrbState('failed');
        setActiveStageId(null);
        setIsStreaming(false);
      },
    });

    return () => stopStream();
  }, [id]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!caseData?.customer_id) return;
      try {
        const { data } = await apiClient.get<CustomerHistoryItem[]>(
          `/customer/${encodeURIComponent(caseData.customer_id)}/history?limit=40`,
        );
        setCustomerHistory(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch customer history', error);
        setCustomerHistory([]);
      }
    };
    fetchHistory();
  }, [caseData?.customer_id]);

  const txTimestamp = useMemo(() => {
    const value = caseData?.timestamp ?? caseData?.created_at;
    const parsed = value ? new Date(String(value)) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }, [caseData?.created_at, caseData?.timestamp]);

  const historyAverage = useMemo(() => {
    if (!customerHistory.length) {
      return safeNumber(caseData?.customer_avg_amount, 0);
    }
    const total = customerHistory.reduce((sum, item) => sum + safeNumber(item.amount, 0), 0);
    return total / customerHistory.length;
  }, [caseData?.customer_avg_amount, customerHistory]);

  const amountMultiplier = useMemo(() => {
    const baseline = historyAverage || safeNumber(caseData?.customer_avg_amount, 0);
    return baseline > 0 ? safeNumber(caseData?.amount, 0) / baseline : 0;
  }, [caseData?.amount, caseData?.customer_avg_amount, historyAverage]);

  const newBeneficiary = useMemo(() => {
    const beneficiary = safeText(caseData?.beneficiary_account, '');
    if (!beneficiary || !customerHistory.length) {
      return false;
    }
    const priorMatches = customerHistory.filter(
      (item) => safeText(item.beneficiary_account, '') === beneficiary && item.transaction_id !== caseData?.transaction_id,
    );
    return priorMatches.length === 0;
  }, [caseData?.beneficiary_account, caseData?.transaction_id, customerHistory]);

  const velocityInsight = useMemo(() => {
    if (!txTimestamp || !customerHistory.length) {
      return { count: 0, minutes: 0 };
    }
    const windowItems = customerHistory.filter((item) => {
      const parsed = new Date(item.timestamp);
      if (Number.isNaN(parsed.getTime())) {
        return false;
      }
      const delta = Math.abs(parsed.getTime() - txTimestamp.getTime());
      return delta <= 12 * 60 * 1000;
    });
    if (windowItems.length <= 1) {
      return { count: windowItems.length, minutes: 0 };
    }
    const sorted = [...windowItems].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
    const first = new Date(sorted[0].timestamp).getTime();
    const last = new Date(sorted[sorted.length - 1].timestamp).getTime();
    return { count: sorted.length, minutes: Math.max(1, Math.round((last - first) / 60000)) };
  }, [customerHistory, txTimestamp]);

  const suspiciousReasons = useMemo(() => {
    if (!caseData?.reasons) {
      return [] as Array<{ rule: string; evidence: string; points: number }>;
    }
    return caseData.reasons.map((reason) => ({
      rule: safeText(reason.rule, 'Risk signal'),
      evidence: safeText(reason.evidence, 'No supporting evidence available.'),
      points: safeNumber(reason.points, 0),
    }));
  }, [caseData?.reasons]);

  const suspiciousPathExplanation = useMemo(() => {
    const chips: string[] = [];
    if (newBeneficiary) {
      chips.push('New beneficiary');
    }
    if (amountMultiplier >= 3) {
      chips.push(`${amountMultiplier.toFixed(1)}x normal amount`);
    }
    if (velocityInsight.count >= 4) {
      chips.push(`High velocity: ${velocityInsight.count} transactions`);
    }
    const networkRule = suspiciousReasons.find((reason) => reason.rule.startsWith('G'));
    if (networkRule) {
      chips.push('Connected account risk');
    }
    return chips;
  }, [amountMultiplier, newBeneficiary, suspiciousReasons, velocityInsight.count]);

  const transactionStory = useMemo(() => {
    if (!caseData) {
      return [] as string[];
    }
    const steps = [
      `${formatCurrencyINR(caseData.amount)} sent ${newBeneficiary ? 'to a new beneficiary' : 'to the beneficiary account'}`,
    ];
    if (amountMultiplier >= 3) {
      steps.push(`${amountMultiplier.toFixed(1)}x the customer's normal transaction amount`);
    }
    if (velocityInsight.count >= 4) {
      steps.push(`${velocityInsight.count} transactions within ${velocityInsight.minutes || 12} minutes`);
    }
    if (newBeneficiary) {
      steps.push('Beneficiary has not previously appeared in this customer history');
    }
    const networkRule = suspiciousReasons.find((reason) => reason.rule.startsWith('G'));
    if (networkRule) {
      steps.push(networkRule.evidence);
    }
    steps.push(`${safeText(caseData.risk_level)} fraud risk — ${safeNumber(caseData.risk_score, 0)}/100`);
    return steps;
  }, [amountMultiplier, caseData, newBeneficiary, suspiciousReasons, velocityInsight.count, velocityInsight.minutes]);

  const visualSummary = useMemo(() => {
    if (!caseData) {
      return {
        headline: 'Investigation unavailable',
        conclusion: 'No investigation data available.',
        recommendation: 'No recommendation available.',
      };
    }
    const riskLevel = safeText(caseData.risk_level, 'Unknown');
    return {
      headline: `${riskLevel.toUpperCase()} RISK · ${safeNumber(caseData.risk_score, 0)}/100`,
      conclusion: buildStorySentence(riskLevel, amountMultiplier, newBeneficiary),
      recommendation: safeText(caseData.recommendation, 'No recommendation available.'),
    };
  }, [amountMultiplier, caseData, newBeneficiary]);

  const graphModel = useMemo<GraphModel>(() => {
    if (!caseData) {
      return {
        nodes: [],
        links: [],
        hoveredNode: null,
        hoveredLink: null,
        height: 520,
      };
    }

    const sourceAccount = safeText(caseData.source_account, 'Information unavailable');
    const beneficiaryAccount = safeText(caseData.beneficiary_account, 'Information unavailable');
    const location = safeText(caseData.location, 'Information unavailable');
    const device = safeText(caseData.device_id, 'Information unavailable');
    const transactionId = safeText(caseData.transaction_id, 'Information unavailable');

    const nodes: StoryNode[] = [
      {
        id: `customer-${safeText(caseData.customer_id, 'customer')}`,
        kind: 'customer',
        title: 'Customer',
        line1: safeText(caseData.customer_id, 'Information unavailable'),
        line2: `${customerHistory.length} historical transactions reviewed`,
        badge: 'Primary',
        column: 0,
        weight: 'primary',
        tone: 'neutral',
        suspicious: true,
        activationOrder: 1,
        metadata: [
          { label: 'Customer ID', value: safeText(caseData.customer_id, 'Information unavailable') },
          { label: 'History size', value: `${customerHistory.length || 0} transactions` },
        ],
      },
      {
        id: `source-${sourceAccount}`,
        kind: 'account',
        title: 'Source Account',
        line1: maskAccount(sourceAccount),
        line2: safeText(caseData.channel, 'Account on record'),
        badge: 'Origin',
        column: 1,
        weight: 'primary',
        tone: 'support',
        suspicious: true,
        activationOrder: 2,
        metadata: [
          { label: 'Account', value: safeText(sourceAccount, 'Information unavailable') },
          { label: 'Channel', value: safeText(caseData.channel, 'Information unavailable') },
        ],
      },
      {
        id: `transaction-${transactionId}`,
        kind: 'transaction',
        title: 'Transaction',
        line1: transactionId,
        line2: `${formatCurrencyINR(caseData.amount)} · ${formatShortDate(caseData.timestamp ?? caseData.created_at)}`,
        badge: 'Investigated',
        column: 2,
        weight: 'primary',
        tone: 'accent',
        suspicious: true,
        activationOrder: 3,
        metadata: [
          { label: 'Transaction ID', value: transactionId },
          { label: 'Amount', value: formatCurrencyINR(caseData.amount) },
          { label: 'Timestamp', value: formatDateTime(caseData.timestamp ?? caseData.created_at) },
          { label: 'Risk score', value: `${safeNumber(caseData.risk_score, 0)}/100` },
        ],
      },
      {
        id: `beneficiary-${beneficiaryAccount}`,
        kind: 'beneficiary',
        title: 'Beneficiary',
        line1: maskAccount(beneficiaryAccount),
        line2: newBeneficiary ? 'First observed beneficiary' : 'Known beneficiary relationship',
        badge: newBeneficiary ? 'New' : 'Observed',
        column: 3,
        weight: 'primary',
        tone: newBeneficiary ? 'risk' : 'support',
        suspicious: true,
        activationOrder: 4,
        metadata: [
          { label: 'Beneficiary account', value: safeText(beneficiaryAccount, 'Information unavailable') },
          { label: 'Relationship', value: newBeneficiary ? 'New beneficiary' : 'Seen previously' },
        ],
      },
    ];

    if (device !== 'Information unavailable') {
      nodes.push({
        id: `device-${device}`,
        kind: 'device',
        title: 'Device',
        line1: device,
        line2: 'Device used for transaction',
        badge: 'Context',
        column: 1,
        weight: 'secondary',
        tone: 'support',
        suspicious: suspiciousReasons.some((reason) => reason.rule.includes('Device')),
        activationOrder: 2,
        metadata: [
          { label: 'Device', value: device },
          { label: 'Purpose', value: 'Authentication context' },
        ],
      });
    }

    if (location !== 'Information unavailable') {
      nodes.push({
        id: `location-${location}`,
        kind: 'location',
        title: 'Location',
        line1: location,
        line2: 'Transaction origin context',
        badge: 'Context',
        column: 3,
        weight: 'secondary',
        tone: 'neutral',
        suspicious: suspiciousReasons.some((reason) => reason.rule.includes('Location')),
        activationOrder: 4,
        metadata: [
          { label: 'Location', value: location },
          { label: 'Observed at', value: formatDateTime(caseData.timestamp ?? caseData.created_at) },
        ],
      });
    }

    const graphEdges = Array.isArray(caseData.graph?.edges) ? caseData.graph.edges : [];
    const relatedLinks: StoryLink[] = [];
    graphEdges.slice(0, 4).forEach((edge: any, index: number) => {
      const from = safeText(edge?.from, 'Information unavailable');
      const to = safeText(edge?.to, 'Information unavailable');
      const relatedAccount = from === beneficiaryAccount || from === sourceAccount ? to : from;
      const relatedNodeId = `related-${relatedAccount}-${index}`;
      nodes.push({
        id: relatedNodeId,
        kind: 'account',
        title: 'Related Account',
        line1: maskAccount(relatedAccount),
        line2: 'Linked through graph analysis',
        badge: 'Network',
        column: 4,
        weight: 'secondary',
        tone: 'risk',
        suspicious: true,
        activationOrder: 5,
        metadata: [
          { label: 'Account', value: relatedAccount },
          { label: 'Linked amount', value: formatCurrencyINR(edge?.amount ?? 0) },
        ],
      });
      relatedLinks.push({
        id: `link-related-${index}`,
        source: `beneficiary-${beneficiaryAccount}`,
        target: relatedNodeId,
        relation: 'linked to',
        suspicious: true,
        order: 5,
        metadata: [
          { label: 'Relationship', value: 'linked to' },
          { label: 'Amount', value: formatCurrencyINR(edge?.amount ?? 0) },
          { label: 'Transaction', value: transactionId },
          { label: 'Timestamp', value: formatDateTime(caseData.timestamp ?? caseData.created_at) },
        ],
      });
    });

    const links: StoryLink[] = [
      {
        id: 'link-customer-source',
        source: `customer-${safeText(caseData.customer_id, 'customer')}`,
        target: `source-${sourceAccount}`,
        relation: 'owns',
        suspicious: true,
        order: 1,
        metadata: [{ label: 'Relationship', value: 'owns' }],
      },
      {
        id: 'link-source-transaction',
        source: `source-${sourceAccount}`,
        target: `transaction-${transactionId}`,
        relation: 'initiated',
        suspicious: true,
        order: 2,
        metadata: [
          { label: 'Relationship', value: 'initiated' },
          { label: 'Transaction', value: transactionId },
          { label: 'Amount', value: formatCurrencyINR(caseData.amount) },
          { label: 'Timestamp', value: formatDateTime(caseData.timestamp ?? caseData.created_at) },
        ],
      },
      {
        id: 'link-transaction-beneficiary',
        source: `transaction-${transactionId}`,
        target: `beneficiary-${beneficiaryAccount}`,
        relation: 'sent to',
        suspicious: true,
        order: 3,
        metadata: [
          { label: 'Relationship', value: 'sent to' },
          { label: 'Transaction', value: transactionId },
          { label: 'Amount', value: formatCurrencyINR(caseData.amount) },
          { label: 'Timestamp', value: formatDateTime(caseData.timestamp ?? caseData.created_at) },
        ],
      },
      ...relatedLinks,
    ];

    if (device !== 'Information unavailable') {
      links.push({
        id: 'link-source-device',
        source: `source-${sourceAccount}`,
        target: `device-${device}`,
        relation: 'used device',
        suspicious: suspiciousReasons.some((reason) => reason.rule.includes('Device')),
        order: 2,
        metadata: [
          { label: 'Relationship', value: 'used device' },
          { label: 'Device', value: device },
        ],
      });
    }

    if (location !== 'Information unavailable') {
      links.push({
        id: 'link-transaction-location',
        source: `transaction-${transactionId}`,
        target: `location-${location}`,
        relation: 'originated in',
        suspicious: suspiciousReasons.some((reason) => reason.rule.includes('Location')),
        order: 4,
        metadata: [
          { label: 'Relationship', value: 'originated in' },
          { label: 'Location', value: location },
        ],
      });
    }

    const height = graphWidth < 720 ? 440 : 520;
    const cardWidth = graphWidth < 720 ? 148 : 176;
    const cardHeight = graphWidth < 720 ? 78 : 88;
    const columns = Array.from(new Set(nodes.map((node) => node.column))).sort((left, right) => left - right);
    const usableWidth = Math.max(cardWidth, graphWidth - cardWidth - 40);
    const xGap = columns.length > 1 ? usableWidth / (columns.length - 1) : usableWidth;
    const centerY = height / 2;
    const positionedNodes: PositionedNode[] = [];

    columns.forEach((column) => {
      const group = nodes.filter((node) => node.column === column);
      const primary = group.filter((node) => node.weight === 'primary');
      const secondary = group.filter((node) => node.weight === 'secondary');
      const x = 20 + column * xGap;

      if (primary.length) {
        primary.forEach((node, index) => {
          const offset = (index - (primary.length - 1) / 2) * (cardHeight + 24);
          const y = centerY - cardHeight / 2 + offset;
          positionedNodes.push({
            ...node,
            width: cardWidth,
            height: cardHeight,
            x,
            y,
            centerX: x + cardWidth / 2,
            centerY: y + cardHeight / 2,
          });
        });
      }

      if (secondary.length) {
        const slotGap = Math.max(94, Math.floor((height - 120) / Math.max(secondary.length, 2)));
        secondary.forEach((node, index) => {
          const offsetIndex = Math.floor(index / 2) + 1;
          const alternatingOffset = index % 2 === 0 ? -offsetIndex * slotGap : offsetIndex * slotGap;
          const y = Math.min(
            height - cardHeight - 20,
            Math.max(20, centerY - cardHeight / 2 + alternatingOffset),
          );
          positionedNodes.push({
            ...node,
            width: cardWidth,
            height: cardHeight,
            x,
            y,
            centerX: x + cardWidth / 2,
            centerY: y + cardHeight / 2,
          });
        });
      }
    });

    const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
    const positionedLinks: PositionedLink[] = links
      .map((link) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) {
          return null;
        }
        const startX = source.x + source.width;
        const startY = source.centerY;
        const endX = target.x;
        const endY = target.centerY;
        const curve = Math.max(24, Math.abs(endX - startX) / 2.4);
        const path = `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
        const labelX = startX + (endX - startX) / 2;
        const labelY = startY + (endY - startY) / 2 - (Math.abs(endY - startY) > 10 ? 18 : 24);
        return {
          ...link,
          path,
          labelX,
          labelY,
        };
      })
      .filter((link): link is PositionedLink => Boolean(link));

    return {
      nodes: positionedNodes,
      links: positionedLinks,
      hoveredNode: positionedNodes.find((node) => node.id === hoveredNodeId) || null,
      hoveredLink: positionedLinks.find((link) => link.id === hoveredLinkId) || null,
      height,
    };
  }, [
    caseData,
    customerHistory,
    graphWidth,
    hoveredLinkId,
    hoveredNodeId,
    newBeneficiary,
    suspiciousReasons,
  ]);

  useEffect(() => {
    if (!graphModel.nodes.length) {
      return;
    }
    const totalSteps = Math.max(1, graphModel.links.filter((link) => link.suspicious).length + 2);
    setAnimationStep(0);
    const timers = Array.from({ length: totalSteps }, (_, index) =>
      window.setTimeout(() => setAnimationStep(index + 1), index * 650),
    );
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [graphModel.links, graphModel.nodes.length, id]);

  const orbAnimation = useSpring({
    to:
      orbState === 'complete'
        ? { transform: 'translateY(-2px) scale(1.02)', boxShadow: '0 0 0 8px rgba(233,69,50,0.08)' }
        : orbState === 'network'
          ? { transform: 'translateY(-4px) scale(1.04)', boxShadow: '0 0 0 10px rgba(233,69,50,0.12)' }
          : orbState === 'retrieving' || orbState === 'analyzing' || orbState === 'investigating'
            ? { transform: 'translateY(-3px) scale(1.03)', boxShadow: '0 0 0 8px rgba(233,69,50,0.10)' }
            : orbState === 'failed'
              ? { transform: 'translateY(0px) scale(1)', boxShadow: '0 0 0 6px rgba(185,28,28,0.12)' }
              : { transform: 'translateY(0px) scale(1)', boxShadow: '0 0 0 4px rgba(233,69,50,0.06)' },
    config: { tension: 170, friction: 18 },
  });

  const activeStageLabel = useMemo(() => {
    if (runtimeStatus === 'FAILED') {
      return 'Investigation failed';
    }
    if (runtimeStatus === 'COMPLETED') {
      return 'Investigation complete';
    }
    const activeStage = STAGE_DEFINITIONS.find((stage) => stage.id === activeStageId);
    return activeStage?.activeLabel || 'Ready to investigate';
  }, [activeStageId, runtimeStatus]);

  const detailedReasoning = useMemo(() => {
    return suspiciousReasons.map((reason) => `${reason.rule}: ${reason.evidence}`);
  }, [suspiciousReasons]);

  const handleBack = () => navigate('/');

  const runAiChat = async (queryOverride?: string) => {
    const prompt = safeText(queryOverride ?? aiChatInput, '');
    if (!prompt || !caseData?.case_id || isAiTyping) {
      return;
    }
    setIsAiTyping(true);
    setRuntimeStatus('WAITING_FOR_AGENT');
    setOrbState('investigating');
    setAiResponse('');
    try {
      const response = await chat({ caseId: caseData.case_id, query: prompt });
      setAiResponse(safeText(response, 'No additional evidence available for this transaction.'));
      setOrbState('complete');
      setRuntimeStatus('COMPLETED');
    } catch (error) {
      console.error('AI chat failed', error);
      setAiResponse('No additional evidence available for this transaction.');
      setOrbState('failed');
      setRuntimeStatus('FAILED');
    } finally {
      setIsAiTyping(false);
    }
  };

  const startReportGeneration = () => {
    if (!caseData || reportState.running) {
      return;
    }
    setReportState({ running: true, completed: false, stageIndex: 0, report: '' });
    REPORT_STEPS.forEach((_, index) => {
      window.setTimeout(() => {
        setReportState((prev) => ({ ...prev, stageIndex: index }));
      }, index * 550);
    });

    window.setTimeout(() => {
      const reportText = [
        `Investigation Report: ${safeText(caseData.case_id)}`,
        `Generated At: ${new Date().toLocaleString()}`,
        '',
        'Investigation Overview',
        `- Transaction: ${safeText(caseData.transaction_id)}`,
        `- Customer: ${safeText(caseData.customer_id)}`,
        `- Risk Score: ${safeNumber(caseData.risk_score, 0)}/100`,
        `- Recommendation: ${safeText(caseData.recommendation)}`,
        '',
        'Transaction Story',
        ...transactionStory.map((line) => `- ${line}`),
        '',
        'Key Evidence',
        ...(suspiciousReasons.length > 0
          ? suspiciousReasons.map((reason) => `- ${reason.rule}: ${reason.evidence}`)
          : ['- No supporting evidence available.']),
      ].join('\n');
      setReportState({ running: false, completed: true, stageIndex: REPORT_STEPS.length - 1, report: reportText });
    }, REPORT_STEPS.length * 600);
  };

  const copyReport = async () => {
    if (!reportState.report) {
      return;
    }
    try {
      await navigator.clipboard.writeText(reportState.report);
    } catch (error) {
      console.error('Failed to copy report', error);
    }
  };

  const downloadReport = () => {
    if (!reportState.report || !caseData?.transaction_id) {
      return;
    }
    const blob = new Blob([reportState.report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fraudshield-report-${safeText(caseData.transaction_id)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (isStreaming && !caseData && !investigationError) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#E94532] border-t-transparent" />
          <p className="mt-4 text-gray-700 font-medium">{activeStageLabel}</p>
          <p className="text-sm text-gray-500 mt-1">Loading transaction, network, and historical evidence...</p>
        </div>
      </div>
    );
  }

  if (investigationError) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="bg-white border border-[#4A4A4A] rounded-md p-6 max-w-lg text-center shadow-sm">
          <h2 className="text-xl font-serif font-bold text-[#242424] mb-2">Investigation failed</h2>
          <p className="text-sm text-gray-600 mb-4">{safeText(investigationError, 'No supporting evidence available.')}</p>
          <button onClick={handleBack} className="bg-[#E94532] text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-center">
        <p className="text-sm text-gray-500">No investigation data available for this transaction.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F6] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
          <button onClick={handleBack} className="flex items-center space-x-2 text-[#242424] hover:text-[#E94532] transition-colors self-start">
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </button>
          <div className="text-sm text-gray-600">
            Transaction ID: <span className="font-mono font-semibold text-[#242424]">{safeText(caseData.transaction_id, 'Information unavailable')}</span>
          </div>
        </div>

        <div className="bg-white border border-[#4A4A4A] rounded-md p-4 sm:p-6 shadow-sm mb-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full bg-[#FFF2EE] px-3 py-1 text-xs font-semibold tracking-wide text-[#B3301F]">
                {visualSummary.headline}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#242424] mt-3">
                {visualSummary.conclusion}
              </h1>
              <p className="text-sm text-gray-600 mt-2 max-w-3xl">
                Recommendation: <span className="font-semibold text-[#242424]">{visualSummary.recommendation}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#FFF7F5] px-3 py-1 text-xs font-semibold text-[#B3301F]">
                  {formatCurrencyINR(caseData.amount)}
                </span>
                {amountMultiplier >= 1 && (
                  <span className="rounded-full bg-[#FFF7F5] px-3 py-1 text-xs font-semibold text-[#B3301F]">
                    {amountMultiplier.toFixed(1)}x normal amount
                  </span>
                )}
                {newBeneficiary && (
                  <span className="rounded-full bg-[#FFF7F5] px-3 py-1 text-xs font-semibold text-[#B3301F]">
                    New beneficiary
                  </span>
                )}
                {velocityInsight.count >= 4 && (
                  <span className="rounded-full bg-[#FFF7F5] px-3 py-1 text-xs font-semibold text-[#B3301F]">
                    {velocityInsight.count} transactions / {velocityInsight.minutes || 12} min
                  </span>
                )}
                {suspiciousPathExplanation.map((item) => (
                  <span key={item} className="rounded-full bg-[#F4F5F7] px-3 py-1 text-xs font-medium text-gray-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3 min-w-0 xl:w-[340px]">
              <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Amount</div>
                <div className="font-semibold text-[#242424] mt-1">{formatCurrencyINR(caseData.amount)}</div>
              </div>
              <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Risk</div>
                <div className="font-semibold text-[#242424] mt-1">{safeText(caseData.risk_level)} · {safeNumber(caseData.risk_score, 0)}/100</div>
              </div>
              <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Timestamp</div>
                <div className="font-semibold text-[#242424] mt-1">{formatShortDate(caseData.timestamp ?? caseData.created_at)}</div>
              </div>
              <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">AI Status</div>
                <div className="font-semibold text-[#242424] mt-1">{activeStageLabel}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#4A4A4A] rounded-md p-4 sm:p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-serif text-xl font-bold text-[#242424]">Transaction Story</h2>
              <p className="text-sm text-gray-600 mt-1">Understand the case in seconds before reading raw agent output.</p>
            </div>
            <div className="rounded-full border border-[#E94532]/20 bg-[#FFF7F5] px-3 py-1 text-xs font-semibold text-[#B3301F]">
              {safeText(caseData.risk_level).toUpperCase()} FRAUD RISK — {safeNumber(caseData.risk_score, 0)}/100
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {transactionStory.map((step, index) => (
              <div key={`${step}-${index}`} className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3 relative">
                <div className="text-xs uppercase tracking-wide text-gray-500">Step {index + 1}</div>
                <div className="font-medium text-[#242424] mt-1">{step}</div>
                {index < transactionStory.length - 1 && (
                  <div className="hidden xl:block absolute -right-3 top-1/2 -translate-y-1/2 text-[#E94532] text-lg">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-6 min-w-0">
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-serif font-bold text-[#242424] text-lg">Transaction Network</h3>
                  <p className="text-sm text-gray-600 mt-1">The graph is laid out left-to-right so analysts can follow who initiated the transaction, which account was used, where money went, and which linked accounts are suspicious.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusSuspiciousPath((prev) => !prev)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    focusSuspiciousPath ? 'border-[#E94532]/30 bg-[#FFF7F5] text-[#B3301F]' : 'border-gray-300 bg-white text-gray-600'
                  }`}
                >
                  {focusSuspiciousPath ? 'Suspicious path mode on' : 'Show all paths equally'}
                </button>
              </div>

              <div className="rounded-md border border-[#E94532]/20 bg-[#FFF7F5] p-3 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#B3301F] font-semibold">Suspicious path detected</div>
                  <div className="text-sm text-[#242424] mt-1">
                    {suspiciousPathExplanation.length > 0 ? suspiciousPathExplanation.join(' + ') : 'No supporting evidence available.'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suspiciousPathExplanation.map((item) => (
                    <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#B3301F] border border-[#E94532]/20">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="relative min-w-[760px]" style={{ width: `${Math.max(760, graphWidth)}px`, height: `${graphModel.height}px` }}>
                  <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${Math.max(760, graphWidth)} ${graphModel.height}`} preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill={suspiciousEdgeStroke} />
                      </marker>
                      <marker id="arrowhead-muted" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill={edgeStroke} />
                      </marker>
                    </defs>
                    {graphModel.links.map((link) => {
                      const active = animationStep >= link.order;
                      const deemphasized = focusSuspiciousPath && !link.suspicious;
                      const hovered = hoveredLinkId === link.id;
                      const stroke = deemphasized ? '#D7DCE3' : link.suspicious ? suspiciousEdgeStroke : edgeStroke;
                      return (
                        <g key={link.id}>
                          <path
                            d={link.path}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={hovered || active ? 3 : 2}
                            strokeOpacity={deemphasized ? 0.35 : 0.95}
                            markerEnd={deemphasized ? 'url(#arrowhead-muted)' : 'url(#arrowhead)'}
                            onMouseEnter={() => setHoveredLinkId(link.id)}
                            onMouseLeave={() => setHoveredLinkId(null)}
                          />
                          <rect
                            x={link.labelX - 38}
                            y={link.labelY - 12}
                            width="76"
                            height="20"
                            rx="10"
                            fill="white"
                            stroke={deemphasized ? '#E5E7EB' : '#F0C7BE'}
                            opacity={deemphasized ? 0.6 : 1}
                          />
                          <text
                            x={link.labelX}
                            y={link.labelY + 2}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="600"
                            fill={deemphasized ? '#98A2B3' : '#B3301F'}
                          >
                            {safeText(link.relation, 'linked to')}
                          </text>
                          {focusSuspiciousPath && link.suspicious && active && (
                            <circle r="4" fill="#E94532" opacity="0.85">
                              <animateMotion dur="1.4s" repeatCount={isStreaming ? 'indefinite' : '1'} path={link.path} />
                            </circle>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {graphModel.nodes.map((node) => {
                    const active = animationStep >= node.activationOrder;
                    const deemphasized = focusSuspiciousPath && !node.suspicious;
                    const hovered = hoveredNodeId === node.id;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => runAiChat(`Explain the ${node.title.toLowerCase()} in this investigation: ${node.line1}.`)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className={`absolute rounded-xl border p-3 text-left shadow-sm transition-all ${kindToneClasses[node.tone]} ${
                          hovered ? 'shadow-md -translate-y-0.5' : ''
                        } ${active ? 'ring-2 ring-[#E94532]/25' : ''}`}
                        style={{
                          left: node.x,
                          top: node.y,
                          width: node.width,
                          minHeight: node.height,
                          opacity: deemphasized ? 0.35 : 1,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kindBadgeClasses[node.kind]}`}>
                            {node.kind}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-500">{safeText(node.badge, '')}</span>
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-wide text-gray-500">{safeText(node.title, 'Entity')}</div>
                        <div className="font-semibold text-[#242424] mt-0.5 leading-tight">{safeText(node.line1, 'Information unavailable')}</div>
                        <div className="text-xs text-gray-600 mt-1 leading-tight">{safeText(node.line2, 'Information unavailable')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(graphModel.hoveredNode || graphModel.hoveredLink) && (
                <div className="mt-4 rounded-md border border-gray-200 bg-[#FCFCFB] p-3 text-sm text-gray-700">
                  {graphModel.hoveredNode && (
                    <div>
                      <div className="font-semibold text-[#242424]">{graphModel.hoveredNode.title}</div>
                      <div className="grid sm:grid-cols-2 gap-2 mt-2 text-xs">
                        {graphModel.hoveredNode.metadata.map((item) => (
                          <div key={`${graphModel.hoveredNode?.id}-${item.label}`}>
                            <span className="font-semibold">{item.label}:</span> {safeText(item.value, 'Information unavailable')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {graphModel.hoveredLink && (
                    <div className={graphModel.hoveredNode ? 'mt-4 pt-4 border-t border-gray-200' : ''}>
                      <div className="font-semibold text-[#242424]">Relationship: {safeText(graphModel.hoveredLink.relation, 'linked to')}</div>
                      <div className="grid sm:grid-cols-2 gap-2 mt-2 text-xs">
                        {graphModel.hoveredLink.metadata.map((item) => (
                          <div key={`${graphModel.hoveredLink?.id}-${item.label}`}>
                            <span className="font-semibold">{item.label}:</span> {safeText(item.value, 'Information unavailable')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 min-w-0">
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif font-bold text-[#242424] text-lg">AI Investigator</h3>
                  <p className="text-sm text-gray-600 mt-1">Transparent multi-agent progress with evidence-backed stages.</p>
                </div>
                <animated.div style={orbAnimation} className="relative h-16 w-16 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setAiOrbExpanded((prev) => !prev)}
                    className="relative h-16 w-16 rounded-full bg-[#E94532] text-white shadow-lg overflow-hidden"
                    aria-label="Toggle AI investigator"
                  >
                    <span className="absolute inset-[7px] rounded-full border border-white/25" />
                    {(orbState === 'investigating' || orbState === 'network' || orbState === 'retrieving' || orbState === 'analyzing') && (
                      <span className="absolute inset-0 ai-orb-ring" />
                    )}
                    {(orbState === 'investigating' || orbState === 'network') && (
                      <>
                        <span className="absolute top-2 left-3 h-1.5 w-1.5 rounded-full bg-white/80 ai-orb-orbit" />
                        <span className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-white/60 ai-orb-orbit ai-orb-orbit-delay" />
                      </>
                    )}
                    {orbState === 'retrieving' && (
                      <span className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/35 overflow-hidden">
                        <span className="block h-full w-1/2 bg-white ai-orb-stream" />
                      </span>
                    )}
                    {orbState === 'network' && (
                      <>
                        <span className="absolute left-1 top-1/2 h-px w-4 bg-white/70 ai-orb-connection" />
                        <span className="absolute right-1 top-1/2 h-px w-4 bg-white/70 ai-orb-connection ai-orb-connection-delay" />
                      </>
                    )}
                    <span className="relative z-10 flex h-full w-full items-center justify-center ai-orb-float">
                      <Sparkles size={24} />
                    </span>
                  </button>
                </animated.div>
              </div>

              <div className="mt-4 rounded-md border border-[#E94532]/20 bg-[#FFF7F5] p-3">
                <div className="text-xs uppercase tracking-wide text-[#B3301F] font-semibold">Current activity</div>
                <div className="font-medium text-[#242424] mt-1">{activeStageLabel}</div>
                <div className="text-xs text-gray-600 mt-1">Runtime status: {runtimeStatus.replaceAll('_', ' ')}</div>
              </div>

              <div className="mt-4 space-y-2">
                {STAGE_DEFINITIONS.map((stage) => {
                  const status = stageState[stage.id] || 'pending';
                  const isRunning = status === 'started';
                  const isCompleted = status === 'completed';
                  return (
                    <div key={stage.id} className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {isCompleted ? (
                            <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
                          ) : isRunning ? (
                            <Loader2 size={16} className="text-[#E94532] mt-0.5 animate-spin" />
                          ) : (
                            <Circle size={16} className="text-gray-300 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium text-sm text-[#242424]">{stage.agent}</div>
                            <div className="text-xs text-gray-700 mt-0.5">
                              {isCompleted ? stage.completeLabel : isRunning ? stage.activeLabel : stage.description}
                            </div>
                          </div>
                        </div>
                        {typeof stageDurations[stage.id] === 'number' && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">{stageDurations[stage.id]}ms</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] text-lg">Key Signals</h3>
              <div className="mt-3 space-y-2">
                {suspiciousReasons.length > 0 ? suspiciousReasons.map((reason) => (
                  <div key={reason.rule} className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-[#242424]">{reason.rule}</span>
                      <span className="text-xs font-semibold text-[#B3301F]">+{reason.points}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{reason.evidence}</div>
                  </div>
                )) : (
                  <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3 text-sm text-gray-600">
                    No supporting evidence available.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] text-lg">Report Generator Agent</h3>
              <div className="mt-3 space-y-2 text-xs text-gray-600">
                {REPORT_STEPS.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    {reportState.running && reportState.stageIndex >= index ? (
                      <Loader2 size={12} className="text-[#E94532] animate-spin" />
                    ) : reportState.completed && reportState.stageIndex >= index ? (
                      <CheckCircle2 size={12} className="text-green-600" />
                    ) : (
                      <Circle size={12} className="text-gray-300" />
                    )}
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startReportGeneration}
                  disabled={reportState.running}
                  className="bg-[#E94532] text-white px-3 py-2 rounded-md text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {reportState.running ? 'Generating...' : 'Generate report'}
                </button>
                <button
                  type="button"
                  onClick={copyReport}
                  disabled={!reportState.completed}
                  className="border border-gray-300 px-3 py-2 rounded-md text-sm text-[#242424] hover:border-[#E94532]/40 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <Copy size={14} /> Copy report
                  </span>
                </button>
                <button
                  type="button"
                  onClick={downloadReport}
                  disabled={!reportState.completed}
                  className="border border-gray-300 px-3 py-2 rounded-md text-sm text-[#242424] hover:border-[#E94532]/40 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <Download size={14} /> Download report
                  </span>
                </button>
              </div>

              {reportState.completed && reportState.report && (
                <pre className="mt-3 max-h-56 overflow-auto rounded-md border border-gray-200 bg-[#FCFCFB] p-2.5 text-[11px] text-gray-700 whitespace-pre-wrap">
                  {reportState.report}
                </pre>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border border-[#4A4A4A] rounded-md p-4 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif font-bold text-[#242424] text-lg">AI Investigation Summary</h3>
              <p className="text-sm text-gray-600 mt-1">Visual summary first, detailed reasoning only when you need it.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowDetailedReasoning((prev) => !prev)}
              className="inline-flex items-center gap-1 text-sm text-[#B3301F] font-medium"
            >
              {showDetailedReasoning ? 'Hide AI reasoning' : 'Show AI reasoning'}
              <ChevronDown size={16} className={`transition-transform ${showDetailedReasoning ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-[#E94532]/20 bg-[#FFF7F5] p-3 xl:col-span-2">
              <div className="text-xs uppercase tracking-wide text-[#B3301F] font-semibold">Headline</div>
              <div className="font-semibold text-[#242424] mt-1">{visualSummary.headline}</div>
              <div className="text-sm text-gray-700 mt-2">{visualSummary.conclusion}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Recommendation</div>
              <div className="font-semibold text-[#242424] mt-1">{visualSummary.recommendation}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-[#FCFCFB] p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">Supporting metrics</div>
              <div className="text-sm text-[#242424] mt-1">{customerHistory.length} historical transactions reviewed</div>
              <div className="text-sm text-[#242424] mt-1">Updated {formatRelativeTime(caseData.timestamp ?? caseData.created_at)}</div>
            </div>
          </div>

          {showDetailedReasoning && (
            <div className="mt-4 rounded-md border border-gray-200 bg-[#FCFCFB] p-4">
              <div className="text-sm font-semibold text-[#242424] mb-2">Detailed AI reasoning</div>
              <div className="space-y-2 text-sm text-gray-700">
                {detailedReasoning.length > 0 ? detailedReasoning.map((line) => (
                  <div key={line}>{line}</div>
                )) : (
                  <div>No supporting evidence available.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <animated.div style={orbAnimation} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <button
            type="button"
            onClick={() => setAiOrbExpanded((prev) => !prev)}
            className="relative h-16 w-16 rounded-full bg-[#E94532] text-white shadow-lg overflow-hidden"
            aria-label="Toggle AI investigator"
          >
            <span className="absolute inset-[8px] rounded-full border border-white/30" />
            {(orbState === 'investigating' || orbState === 'network' || orbState === 'retrieving' || orbState === 'analyzing') && (
              <span className="absolute inset-0 ai-orb-ring" />
            )}
            {(orbState === 'investigating' || orbState === 'network') && (
              <>
                <span className="absolute top-2 left-3 h-1.5 w-1.5 rounded-full bg-white/80 ai-orb-orbit" />
                <span className="absolute bottom-3 right-3 h-1.5 w-1.5 rounded-full bg-white/60 ai-orb-orbit ai-orb-orbit-delay" />
              </>
            )}
            {orbState === 'retrieving' && (
              <span className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/35 overflow-hidden">
                <span className="block h-full w-1/2 bg-white ai-orb-stream" />
              </span>
            )}
            {orbState === 'network' && (
              <>
                <span className="absolute left-1 top-1/2 h-px w-4 bg-white/70 ai-orb-connection" />
                <span className="absolute right-1 top-1/2 h-px w-4 bg-white/70 ai-orb-connection ai-orb-connection-delay" />
              </>
            )}
            <span className="relative z-10 flex h-full w-full items-center justify-center ai-orb-float">
              <Sparkles size={24} />
            </span>
          </button>
        </animated.div>

        {aiOrbExpanded && (
          <div className="fixed left-3 right-3 sm:left-auto sm:right-6 bottom-24 sm:w-[420px] bg-white border border-[#4A4A4A] rounded-lg shadow-xl z-50 flex flex-col max-h-[72vh]">
            <div className="flex justify-between items-center p-3 border-b border-[#4A4A4A]">
              <div>
                <h4 className="font-serif font-bold text-[#242424]">AI Investigator</h4>
                <div className="text-xs text-gray-600 mt-0.5">{activeStageLabel}</div>
              </div>
              <button onClick={() => setAiOrbExpanded(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close AI panel">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 border-b border-gray-100 space-y-2">
              {STAGE_DEFINITIONS.map((stage) => {
                const status = stageState[stage.id] || 'pending';
                return (
                  <div key={stage.id} className="flex items-start gap-2 text-xs text-gray-700">
                    {status === 'completed' ? (
                      <CheckCircle2 size={14} className="text-green-600 mt-0.5" />
                    ) : status === 'started' ? (
                      <Loader2 size={14} className="text-[#E94532] mt-0.5 animate-spin" />
                    ) : (
                      <Circle size={14} className="text-gray-300 mt-0.5" />
                    )}
                    <span>{status === 'completed' ? stage.completeLabel : status === 'started' ? stage.activeLabel : stage.agent}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {aiResponse ? (
                <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 whitespace-pre-wrap">{aiResponse}</div>
              ) : (
                <div className="text-sm text-gray-500">Ask about the suspicious path, a relationship, or why the risk score is elevated.</div>
              )}
            </div>

            <div className="p-3 border-t border-[#4A4A4A] flex gap-2">
              <input
                type="text"
                value={aiChatInput}
                onChange={(event) => setAiChatInput(event.target.value)}
                placeholder="Ask about this investigation..."
                className="flex-1 px-3 py-2 border border-[#4A4A4A] rounded-md focus:ring-1 focus:ring-[#E94532] text-sm"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    runAiChat();
                  }
                }}
              />
              <button
                onClick={() => runAiChat()}
                disabled={isAiTyping || !safeText(aiChatInput, '').trim()}
                className="bg-[#E94532] text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isAiTyping ? <Loader2 className="animate-spin h-4 w-4" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestigationPage;
