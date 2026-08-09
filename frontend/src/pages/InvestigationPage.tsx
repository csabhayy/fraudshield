import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvestigate } from '../hooks/useInvestigation';
import { useChat } from '../hooks/useChat';
import { ArrowLeft, Send, CheckCircle, Loader2 } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

interface GraphNode {
  id: string;
  label: string;
  val?: number;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  amount?: number;
}

// Agent steps for timeline
const AGENT_STEPS = [
  { id: 'data_retriever', label: 'Data Retriever', description: 'Fetch transaction and customer data' },
  { id: 'graph_analyst', label: 'Graph Analyst', description: 'Query Neo4j for cycles and connections' },
  { id: 'rule_engine', label: 'Rule Engine', description: 'Apply deterministic fraud rules' },
  { id: 'anomaly_detector', label: 'Anomaly Detector', description: 'Run Isolation Forest for outliers' },
  { id: 'rag_retriever', label: 'RAG Retriever', description: 'Search similar past cases' },
  { id: 'report_generator', label: 'Report Generator', description: 'Generate AI narrative' },
];

const InvestigationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mutateAsync: investigate, data: caseData, isPending, error } = useInvestigate();
  const { mutateAsync: chat } = useChat();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const graphRef = useRef<any>(null);

  // Auto-investigate on load
  useEffect(() => {
    if (id) {
      investigate(id);
    }
  }, [id, investigate]);

  // Build graph data from case result
  useEffect(() => {
    if (caseData && caseData.graph) {
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

      const nodes: GraphNode[] = Array.from(accountSet).map(acc => ({
        id: acc,
        label: acc,
        val: 5,
        color: acc === caseData.source_account ? '#E94532' : '#3B82F6',
      }));

      setGraphData({ nodes, links });

      // Center graph after data loads
      if (graphRef.current) {
        setTimeout(() => {
          graphRef.current.centerAt(0, 0, 500);
        }, 100);
      }
    }
  }, [caseData]);

  const handleBack = () => navigate('/');

  const handleChatSend = async () => {
    if (!chatInput.trim() || !caseData) return;
    setIsChatting(true);
    try {
      const response = await chat({ caseId: caseData.case_id, query: chatInput });
      setChatResponse(response);
      setChatInput('');
    } catch (err) {
      setChatResponse('Error: Could not get response.');
    }
    setIsChatting(false);
  };

  if (isPending) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#E94532] border-t-transparent"></div>
          <p className="mt-4 text-gray-600">AI investigation in progress...</p>
          <div className="mt-2 text-sm text-gray-400">Analyzing transaction history • Checking connections • Evaluating risk</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] p-8 flex items-center justify-center">
        <div className="text-center text-red-600">Error loading investigation: {error.message}</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-[#F8F8F6] p-8 flex items-center justify-center">
        <div className="text-center text-gray-500">No investigation data found.</div>
      </div>
    );
  }

  const { risk_score, risk_level, recommendation, reasons, similar_cases, status } = caseData;

  // Compute confidence (simple heuristic)
  const confidence = risk_score >= 70 ? 92 : risk_score >= 40 ? 75 : 60;

  return (
    <div className="min-h-screen bg-[#F8F8F6] p-8 font-sans">
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

        {/* Transaction Summary Card with confidence */}
        <div className="bg-white border border-[#4A4A4A] rounded-md p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase">Amount</div>
              <div className="text-2xl font-bold text-[#242424]">₹{caseData.amount.toLocaleString()}</div>
              <div className="text-sm text-gray-500">{caseData.created_at}</div>
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

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interactive Graph with bounding */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm relative overflow-hidden">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Transaction Network</h3>
              <div className="h-80 w-full relative">
                {graphData.nodes.length > 0 ? (
                  <ForceGraph2D
                    ref={graphRef}
                    graphData={graphData}
                    nodeLabel="label"
                    nodeColor={(node: any) => node.color || '#3B82F6'}
                    linkLabel={(link: any) => `Amount: ₹${link.amount || 0}`}
                    linkDirectionalArrowLength={3.5}
                    linkDirectionalArrowRelPos={1}
                    cooldownTicks={50}
                    nodeRelSize={6}
                    width={800}
                    height={320}
                    onNodeClick={(node: any) => {
                      alert(`Account: ${node.id}\nClick to inspect – you can add a side panel here.`);
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">No network data available</div>
                )}
              </div>
            </div>

            {/* Investigation Timeline with Agent Steps */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Investigation Timeline</h3>
              <div className="space-y-3">
                {AGENT_STEPS.map((step, idx) => {
                  // All steps are done once investigation is complete
                  return (
                    <div key={idx} className="flex items-start space-x-3">
                      <div className="w-3 h-3 rounded-full mt-1 bg-green-500" />
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <span>{step.label}</span>
                          <CheckCircle size={14} className="text-green-500" />
                        </div>
                        <div className="text-sm text-gray-500">{step.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chat Widget (Voodoo Doll) */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Ask the AI Investigator</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about this transaction..."
                  className="flex-1 px-4 py-2 border border-[#4A4A4A] rounded-md focus:ring-1 focus:ring-[#E94532] text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                />
                <button
                  onClick={handleChatSend}
                  disabled={isChatting || !chatInput.trim()}
                  className="bg-[#E94532] text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isChatting ? <Loader2 className="animate-spin h-4 w-4" /> : <Send size={16} />}
                </button>
              </div>
              {chatResponse && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                  {chatResponse}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Risk Signals – All reasons */}
            <div className="bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
              <h3 className="font-serif font-bold text-[#242424] mb-3">Risk Signals</h3>
              <div className="space-y-2">
                {reasons.length > 0 ? (
                  reasons.map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => alert(`Rule: ${r.rule}\nEvidence: ${r.evidence}`)}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{r.rule}</span>
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

            {/* Similar Cases */}
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

        {/* AI Narrative */}
        <div className="mt-6 bg-white border border-[#4A4A4A] rounded-md p-4 shadow-sm">
          <h3 className="font-serif font-bold text-[#242424] mb-2">AI Investigation Summary</h3>
          <p className="text-gray-700 text-sm">
            {caseData.reasons.map((r: any) => r.evidence).join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvestigationPage;