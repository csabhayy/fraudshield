import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { streamInvestigation, type InvestigationStageUpdate } from '../hooks/useInvestigation';
import { useChat } from '../hooks/useChat';
import type { InvestigationResult } from '../stores/investigationStore';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Loader2,
  X,
  Sparkles,
  AlertTriangle,
  Circle,
} from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import { animated, useSpring } from '@react-spring/web';

// ---------- Types ----------
interface GraphNode {
  id: string;
  label: string;
  val?: number;
  color?: string;
  name?: string;
}

interface GraphLink {
  source: string;
  target: string;
  amount?: number;
}

interface GraphErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface GraphErrorBoundaryState {
  hasError: boolean;
}

class GraphErrorBoundary extends React.Component<GraphErrorBoundaryProps, GraphErrorBoundaryState> {
  constructor(props: GraphErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): GraphErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Transaction graph rendering failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// ---------- Agent Steps (full) ----------
const AGENT_STEPS = [
  {
    id: 'data_retriever',
    label: 'Data Retriever',
    description: 'Retrieves the transaction and customer\'s historical activity.',
    details:
      'Purpose: Provides the investigation with the baseline transaction context required by downstream agents.\nInput: Transaction ID + Customer ID\nOutput: Transaction history, account activity and behavioral context.',
    useCase: 'Fetches all relevant data for the investigation.',
  },
  {
    id: 'graph_analyst',
    label: 'Graph Analyst',
    description: 'Queries Neo4j for cycles and connections.',
    details:
      'Purpose: Discovers relationships between accounts, detects circular flows and shared devices.\nInput: Source account\nOutput: Cycles, neighbors, shared devices, edge weights.',
    useCase: 'Reveals hidden network structures and mule patterns.',
  },
  {
    id: 'rule_engine',
    label: 'Rule Engine',
    description: 'Applies deterministic fraud rules.',
    details:
      'Purpose: Evaluates the transaction against a set of expert-defined rules (R, M, S, A, G).\nInput: Transaction + customer profile + graph results\nOutput: Risk score (0–100), list of triggered rules with evidence.',
    useCase: 'Provides explainable, consistent risk assessment.',
  },
  {
    id: 'anomaly_detector',
    label: 'Anomaly Detector',
    description: 'Runs Isolation Forest for outliers.',
    details:
      'Purpose: Unsupervised detection of unusual transaction patterns.\nInput: Transaction features (amount, frequency, location, etc.)\nOutput: Anomaly score (0–100).',
    useCase: 'Catches novel fraud patterns not covered by rules.',
  },
  {
    id: 'rag_retriever',
    label: 'RAG Retriever',
    description: 'Searches similar past cases.',
    details:
      'Purpose: Retrieves similar historical cases to assist the reviewer and ensure consistency.\nInput: Current case embedding\nOutput: List of similar cases (if any) with similarity score.',
    useCase: 'Provides precedent and helps decision-making.',
  },
  {
    id: 'report_generator',
    label: 'Report Generator',
    description: 'Generates AI narrative.',
    details:
      'Purpose: Synthesizes findings into a human‑readable investigation summary.\nInput: All previous outputs\nOutput: Natural‑language narrative and final recommendation.',
    useCase: 'Explains the investigation in plain English.',
  },
];

// ---------- Main Component ----------
const InvestigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutateAsync: chat } = useChat();

  const [caseData, setCaseData] = useState<InvestigationResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);

  // ---- Local error state ----
  const [localError, setLocalError] = useState<string | null>(null);

  // ---- Graph & UI state ----
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [aiOrbExpanded, setAiOrbExpanded] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const graphRef = useRef<any>(null);
  const [stageState, setStageState] = useState<Record<string, InvestigationStageUpdate['status'] | 'pending'>>(
    () => Object.fromEntries(AGENT_STEPS.map((step) => [step.id, 'pending'])),
  );
  const [stageDurations, setStageDurations] = useState<Record<string, number>>({});

  // Keep hook order stable across loading/error/success renders.
  const orbSpring = useSpring({
    from: { transform: 'translateY(0px) scale(1)' },
    to: async (next) => {
      while (true) {
        await next({ transform: 'translateY(-8px) scale(1.05)' });
        await next({ transform: 'translateY(0px) scale(1)' });
      }
    },
    config: { duration: 2000 },
  });

  // ---- Auto‑investigate (streaming stages) ----
  useEffect(() => {
    if (!id) return;

    setCaseData(null);
    setLocalError(null);
    setInvestigationError(null);
    setIsStreaming(true);
    setStageState(Object.fromEntries(AGENT_STEPS.map((step) => [step.id, 'pending'])));
    setStageDurations({});

    const stopStream = streamInvestigation(id, {
      onStageUpdate: (update) => {
        setStageState((prev) => ({
          ...prev,
          [update.stage]: update.status,
        }));

        const durationMs = update.duration_ms;
        if (typeof durationMs === 'number') {
          setStageDurations((prev) => ({
            ...prev,
            [update.stage]: durationMs,
          }));
        }

        if (update.status === 'failed' && update.error) {
          setInvestigationError(update.error);
          setIsStreaming(false);
        }
      },
      onResult: (result) => {
        setCaseData(result);
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: ({ message }) => {
        setInvestigationError(message || 'Investigation failed. Please try again.');
        setIsStreaming(false);
      },
    });

    return () => {
      stopStream();
    };
  }, [id]);

  // ---- Build graph data ----
  useEffect(() => {
    if (caseData && caseData.graph) {
      try {
        const graph = caseData.graph;
        const accountSet = new Set<string>();
        const links: GraphLink[] = [];

        (graph.edges || []).forEach((e: any) => {
          accountSet.add(e.from);
          accountSet.add(e.to);
          links.push({ source: e.from, target: e.to, amount: e.amount });
        });

        (graph.cycles || []).forEach((cycle: string[]) => {
          cycle.forEach(acc => accountSet.add(acc));
        });

        const nameMap: Record<string, string> = {
          'ACC-1004': 'John Smith',
          'ACC-1022': 'Jane Doe',
          'ACC-1014': 'Mark Lee',
          'ACC-1010': 'Sarah Kim',
          'ACC-1027': 'David Park',
        };

        const nodes: GraphNode[] = Array.from(accountSet).map(acc => ({
          id: acc,
          label: acc,
          val: 5,
          color: acc === caseData.source_account ? '#E94532' : '#3B82F6',
          name: nameMap[acc] || 'Unknown',
        }));

        setGraphData({ nodes, links });

        if (graph.cycles && graph.cycles.length > 0) {
          setHighlightedPath(graph.cycles[0]);
        }

        if (graphRef.current) {
          setTimeout(() => {
            graphRef.current.centerAt(0, 0, 500);
          }, 100);
        }
      } catch (err) {
        setLocalError('Failed to render graph data.');
      }
    }
  }, [caseData]);

  // ---- AI Chat ----
  const handleAiChat = async (question?: string) => {
    const query = question || aiChatInput;
    if (!query.trim() || !caseData) return;
    setAiResponse('');
    setIsAiTyping(true);

    try {
      const fullResponse = await chat({ caseId: caseData.case_id, query });
      const words = fullResponse.split(' ');
      let currentText = '';
      const interval = setInterval(() => {
        if (words.length > 0) {
          const word = words.shift();
          currentText += word + ' ';
          setAiResponse(currentText);
        } else {
          clearInterval(interval);
          setIsAiTyping(false);
        }
      }, 30);
    } catch (err) {
      setAiResponse('Error: Could not get response.');
      setIsAiTyping(false);
    }
  };

  // ---- Risk Signal Click ----
  const handleRiskSignalClick = (rule: string, evidence: string) => {
    const accounts = evidence.match(/ACC-\d{4}/g) || [];
    if (accounts.length > 0) {
      setHighlightedPath(accounts);
      if (graphRef.current) {
        // centerAtNode is not part of ForceGraph2D API; keep focus behavior safe.
        graphRef.current.centerAt(0, 0, 500);
        graphRef.current.zoom(2, 500);
      }
    }
    handleAiChat(`Explain the "${rule}" risk signal. Evidence: ${evidence}`);
  };

  // ---- Handle back navigation ----
  const handleBack = () => {
    navigate('/');
  };

  // ---- Loading State ----
  if (isStreaming && !caseData && !investigationError) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#E94532] border-t-transparent" />
          <p className="mt-4 text-gray-600">AI investigation in progress...</p>
          <div className="mt-2 text-sm text-gray-400">Analyzing transaction history • Checking connections • Evaluating risk</div>
        </div>
      </div>
    );
  }

  // ---- Error State (API or local) ----
  if (investigationError || localError) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] p-8 flex items-center justify-center">
        <div className="bg-white border border-[#4A4A4A] rounded-md p-6 max-w-md text-center shadow-sm">
          <AlertTriangle size={48} className="text-[#E94532] mx-auto mb-4" />
          <h2 className="text-xl font-serif font-bold text-[#242424] mb-2">Investigation Failed</h2>
          <p className="text-gray-600 text-sm mb-4">
            {investigationError || localError || 'Could not complete the investigation. Please try again.'}
          </p>
          <button
            onClick={handleBack}
            className="bg-[#E94532] text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---- No data state ----
  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] p-8 flex items-center justify-center">
        <div className="text-center text-gray-500">No investigation data found.</div>
      </div>
    );
  }

  // ---- Safe destructuring with defaults ----
  const {
    risk_score = 0,
    risk_level = 'Unknown',
    recommendation = 'N/A',
    reasons = [],
    similar_cases = [],
    status = 'Unknown',
    amount = 0,
    created_at = '',
  } = caseData;

  const confidence = risk_score >= 70 ? 92 : risk_score >= 40 ? 75 : 60;

  // ---- Render ----
  return (
    <div className="min-h-screen bg-[#F8F8F6] p-8 font-sans relative">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBack}
            className="flex items-center space-x-2 text-[#242424] hover:text-[#E94532] transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">Transaction ID:</span>
            <span className="font-mono font-bold">{caseData.transaction_id}</span>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white border border-[#4A4A4A] rounded-md p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase">Amount</div>
              <div className="text-2xl font-bold text-[#242424]">₹{amount.toLocaleString()}</div>
              <div className="text-sm text-gray-500">{created_at}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Risk Score</div>
              <div className="text-3xl font-bold text-[#E94532]">{risk_score}</div>
              <div className="text-sm font-medium">{risk_level}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Recommendation</div>
              <div className="text-lg font-semibold">{recommendation}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Status</div>
              <div className="text-lg font-semibold">{status}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">AI Confidence</div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-[#E94532]">{confidence}%</span>
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#E94532] rounded-full" style={{ width: `${confidence}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Graph + Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Transaction Network Graph */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm relative overflow-hidden">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Transaction Network</h3>
              <div className="h-80 w-full relative">
                {graphData.nodes.length > 0 ? (
                  <GraphErrorBoundary
                    fallback={
                      <div className="flex h-full items-center justify-center text-center text-sm text-gray-500 px-4">
                        Unable to render interactive graph for this case. Risk signals and evidence are still available.
                      </div>
                    }
                  >
                    <ForceGraph2D
                      ref={graphRef}
                      graphData={graphData}
                      nodeLabel={(node) => `${node.id}\n${node.name || ''}`}
                      nodeColor={(node) =>
                        highlightedPath.includes(node.id) ? '#E94532' : node.color || '#3B82F6'
                      }
                      nodeVal={(node) => (highlightedPath.includes(node.id) ? 8 : 5)}
                      linkLabel={(link) => `Amount: ₹${link.amount || 0}`}
                      linkDirectionalArrowLength={3.5}
                      linkDirectionalArrowRelPos={1}
                      cooldownTicks={50}
                      nodeRelSize={6}
                      width={800}
                      height={320}
                      onNodeClick={(node) => {
                        handleAiChat(
                          `Tell me about account ${node.id} (${node.name || 'Unknown'}) and its role in this investigation.`
                        );
                      }}
                    />
                  </GraphErrorBoundary>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">No network data available</div>
                )}
              </div>
            </div>

            {/* Investigation Timeline */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Investigation Timeline</h3>
              <div className="space-y-3">
                {AGENT_STEPS.map((step) => {
                  const currentStatus = stageState[step.id] || 'pending';
                  const isRunning = currentStatus === 'started';
                  const isCompleted = currentStatus === 'completed';
                  const isFailed = currentStatus === 'failed';
                  const durationMs = stageDurations[step.id];

                  return (
                    <div
                      key={step.id}
                      className="flex items-start space-x-3 relative group"
                      onMouseEnter={() => setExpandedAgent(step.id)}
                      onMouseLeave={() => setExpandedAgent(null)}
                    >
                      <div
                        className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                          isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : isRunning ? 'bg-[#E94532]' : 'bg-gray-300'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="font-medium flex items-center space-x-2">
                          <span>{step.label}</span>
                          {isRunning && <Loader2 size={14} className="text-[#E94532] animate-spin" />}
                          {isCompleted && <CheckCircle size={14} className="text-green-500" />}
                          {!isCompleted && !isRunning && !isFailed && <Circle size={12} className="text-gray-300" />}
                          {isFailed && <AlertTriangle size={14} className="text-red-500" />}
                          {typeof durationMs === 'number' && (
                            <span className="text-[10px] uppercase tracking-wide text-gray-400">{durationMs}ms</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{step.description}</div>
                        {expandedAgent === step.id && (
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 max-w-md">
                            {step.details.split('\n').map((line, i) => (
                              <div key={i}>{line}</div>
                            ))}
                            <div className="mt-1 text-gray-500">Use case: {step.useCase}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Risk Signals + Similar Cases */}
          <div className="space-y-6">
            {/* Risk Signals */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Risk Signals</h3>
              <div className="space-y-2">
                {reasons.length > 0 ? (
                  reasons.map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => handleRiskSignalClick(r.rule, r.evidence)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm group-hover:text-[#E94532] transition-colors">{r.rule}</span>
                        <span className="text-xs text-[#E94532] font-bold">+{r.points}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{r.evidence}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">No risk signals detected.</div>
                )}
              </div>
            </div>

            {/* Similar Historical Cases */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Similar Historical Cases</h3>
              {similar_cases && similar_cases.length > 0 ? (
                <div className="space-y-2">
                  {similar_cases.slice(0, 3).map((s: any, idx: number) => (
                    <div key={idx} className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="text-sm font-medium">{s.case_id || s.transaction_id}</div>
                      <div className="text-xs text-gray-500">Risk: {s.risk_score || 'N/A'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No comparable historical cases found.</div>
              )}
            </div>
          </div>
        </div>

        {/* AI Investigation Summary */}
        <div className="mt-6 bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
          <h3 className="font-serif font-bold text-[#242424] mb-2 flex items-center justify-between">
            <span>AI Investigation Summary</span>
            <span className="text-xs text-gray-400 font-normal">Streaming</span>
          </h3>
          <div className="text-gray-700 text-sm whitespace-pre-wrap">
            {reasons.map((r: any) => r.evidence).join(' ')}
          </div>
        </div>

        {/* Floating AI Orb */}
        <animated.div
          style={orbSpring}
          className="fixed bottom-8 right-8 z-50 cursor-pointer"
          onClick={() => setAiOrbExpanded(!aiOrbExpanded)}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-[#E94532] shadow-lg flex items-center justify-center hover:scale-110 transition-transform duration-300">
              <Sparkles size={28} className="text-white" />
              <div className="absolute inset-0 rounded-full animate-ping bg-[#E94532] opacity-20" />
            </div>
            {!aiOrbExpanded && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </div>
        </animated.div>

        {/* AI Chat Panel (expanded) */}
        {aiOrbExpanded && (
          <div className="fixed bottom-28 right-8 w-96 bg-white border border-[#4A4A4A] rounded-lg shadow-xl z-50 flex flex-col max-h-[500px]">
            <div className="flex justify-between items-center p-3 border-b border-[#4A4A4A]">
              <h4 className="font-serif font-bold text-[#242424] flex items-center space-x-2">
                <Sparkles size={16} className="text-[#E94532]" />
                <span>AI Investigator</span>
              </h4>
              <button onClick={() => setAiOrbExpanded(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-64">
              {aiResponse && (
                <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700">
                  {aiResponse}
                  {isAiTyping && <span className="inline-block w-1 h-3 bg-[#E94532] animate-pulse ml-1" />}
                </div>
              )}
              {!aiResponse && !isAiTyping && (
                <div className="text-sm text-gray-400">Ask me anything about this investigation.</div>
              )}
            </div>
            <div className="p-3 border-t border-[#4A4A4A] flex space-x-2">
              <input
                type="text"
                value={aiChatInput}
                onChange={(e) => setAiChatInput(e.target.value)}
                placeholder="Ask about this transaction..."
                className="flex-1 px-3 py-2 border border-[#4A4A4A] rounded-md focus:ring-1 focus:ring-[#E94532] text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAiChat()}
              />
              <button
                onClick={() => handleAiChat()}
                disabled={isAiTyping || !aiChatInput.trim()}
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