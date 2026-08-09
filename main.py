"""FraudShield API – investigation, chat, and graph endpoints."""
import os
import requests
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from dotenv import load_dotenv

from agents.workflow import build_investigation_workflow
from services.data_service import load_transactions, save_case, load_cases
from services.vector_service import VectorService
from services.graph_service import Neo4jClient

load_dotenv()

# ------- Helper: Convert NumPy types to Python types for JSON -------
def convert_numpy(obj):
    """Recursively convert NumPy types to native Python types."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(v) for v in obj]
    else:
        return obj

# ------- Lifespan (replaces deprecated on_event) -------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🔄 Initialising Neo4j client...")
    app.state.neo4j = Neo4jClient()
    print("📦 Populating Neo4j with transactions...")
    df = load_transactions()
    try:
        app.state.neo4j.clear_graph()
        print("🧹 Cleared existing graph.")
    except Exception as e:
        print(f"⚠️ Could not clear graph: {e}")
    app.state.neo4j.bulk_add_edges(df)
    print(f"✅ Inserted {len(df)} edges into Neo4j.")

    # Application runs
    yield

    # Shutdown
    if hasattr(app.state, "neo4j"):
        app.state.neo4j.close()
        print("🔌 Neo4j connection closed.")

# ------- FastAPI App -------
app = FastAPI(title="FraudShield Copilot", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Global services
investigation_workflow = build_investigation_workflow()
vector_db = VectorService()

# ------- Pydantic Models -------
class InvestigateRequest(BaseModel):
    transaction_id: str

class ChatRequest(BaseModel):
    case_id: str
    query: str

# ------- Endpoints -------
@app.post("/investigate")
async def investigate(req: InvestigateRequest):
    df = load_transactions()
    if req.transaction_id not in df["transaction_id"].values:
        raise HTTPException(404, "Transaction not found")

    state = {
        "transaction_id": req.transaction_id,
        "case_id": f"FS-{req.transaction_id}",
        "created_at": datetime.now().isoformat()
    }
    result_state = investigation_workflow.invoke(state)
    tx = result_state["transaction"]
    graph = result_state.get("graph_result", {})
    similar = result_state.get("similar_cases", [])

    final = {
        "case_id": result_state["case_id"],
        "transaction_id": tx["transaction_id"],
        "customer_id": tx["customer_id"],
        "masked_account": "XXXX" + tx["source_account"][-4:],
        "amount": float(tx["amount"]),
        "risk_score": int(result_state["rule_score"]),
        "risk_level": "Critical" if result_state["rule_score"] >= 86 else
                      "Very High" if result_state["rule_score"] >= 71 else
                      "High" if result_state["rule_score"] >= 51 else
                      "Medium" if result_state["rule_score"] >= 31 else "Low",
        "rule_score": int(result_state["rule_score"]),
        "anomaly_score": int(result_state.get("anomaly_score", 0)),
        "network_score": 0,
        "customer_risk_score": 0,
        "reasons": result_state.get("reasons", []),
        "graph": {
            "cycles": graph.get("cycles", []),
            "neighbors": graph.get("neighbors", []),
            "evidence": graph.get("evidence", []),
            "edges": graph.get("edges", [])
        },
        "recommendation": result_state.get("recommendation", "Allow Transaction"),
        "status": "Awaiting Human Review" if result_state["rule_score"] >= 31 else "Closed - Low Risk",
        "reviewer_decision": "Pending",
        "reviewer_comment": "",
        "created_at": result_state["created_at"],
        "audit": [{"time": result_state["created_at"], "actor": "FraudShield AI", "event": "Analysis completed"}],
        "similar_cases": similar
    }
    final = convert_numpy(final)
    save_case(final)
    vector_db.index_case(final)
    return final

@app.post("/chat")
async def chat(req: ChatRequest):
    cases = load_cases()
    case = next((c for c in cases if c["case_id"] == req.case_id), None)
    if not case:
        raise HTTPException(404, "Case not found")

    context = f"""
Case {case['case_id']}: Transaction {case['transaction_id']} amount {case['amount']}, risk score {case['risk_score']}, level {case['risk_level']}.
Reasons: {case.get('reasons', [])}
Graph evidence: {case.get('graph', {}).get('evidence', [])}
Recommendation: {case['recommendation']}
"""
    prompt = f"{context}\n\nInvestigator question: {req.query}\nAnswer concisely based on the data:"
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    # 1. Check if Ollama is reachable and get available models
    try:
        models_resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
        if models_resp.status_code != 200:
            return {"response": "Ollama is not responding. Please start it with `docker start fraudshield-ollama-1` and pull a model."}
        models = models_resp.json().get("models", [])
        model_names = [m["name"] for m in models]
        if not model_names:
            return {"response": "No models found in Ollama. Please pull one: `docker exec -it fraudshield-ollama-1 ollama pull llama3.2:3b`"}
    except Exception as e:
        return {"response": f"Could not connect to Ollama: {str(e)}. Make sure the container is running."}

    # 2. Pick the first available model (or a specific one)
    # You can set your preferred model here or use the first one.
    preferred_model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    model_to_use = preferred_model if preferred_model in model_names else model_names[0]

    # 3. Generate answer
    try:
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={"model": model_to_use, "prompt": prompt, "stream": False},
            timeout=30
        )
        if response.status_code == 200:
            answer = response.json().get("response", "No answer generated.")
        else:
            answer = f"Ollama error: {response.status_code} - {response.text}"
    except Exception as e:
        answer = f"Error calling Ollama: {str(e)}"

    return {"response": answer}

@app.get("/cases")
async def list_cases():
    return load_cases()

@app.get("/graph/{account}")
async def get_graph(account: str):
    neo4j = getattr(app.state, "neo4j", None)
    if neo4j is None:
        raise HTTPException(503, "Neo4j client not initialised yet.")
    return neo4j.analyze_account(account)