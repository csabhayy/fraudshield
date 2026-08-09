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

import json
from datetime import datetime, timedelta
import sqlite3

from agents.workflow import build_investigation_workflow
from services.data_service import load_transactions, save_case, load_cases, get_customer
from services.vector_service import VectorService
from services.graph_service import Neo4jClient
from services.transaction_generator import start_generator

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
    # Generates 1 transaction every 2-5 sec
    start_generator()
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
    import traceback
    import pandas as pd
    from services.data_service import load_transactions, save_case, convert_numpy
    from agents.workflow import build_investigation_workflow
    from datetime import datetime

    try:
        # 1. Load transactions from SQLite (includes live data)
        df = load_transactions()
        if req.transaction_id not in df["transaction_id"].values:
            raise HTTPException(404, "Transaction not found")

        # 2. Build and run the workflow
        workflow = build_investigation_workflow()
        state = {
            "transaction_id": req.transaction_id,
            "case_id": f"FS-{req.transaction_id}",
            "created_at": datetime.now().isoformat()
        }

        result_state = workflow.invoke(state)

        # 3. Check for errors from nodes
        if result_state.get("error"):
            raise HTTPException(400, result_state["error"])

        # 4. Extract data
        tx = result_state["transaction"]
        graph = result_state.get("graph_result", {})
        similar = result_state.get("similar_cases", [])

        # 5. Build final response
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

        # 6. Save and index the case
        final = convert_numpy(final)
        save_case(final)
        vector_db.index_case(final)
        return final

    except HTTPException:
        raise
    except Exception as e:
        # Log full stack trace to container logs
        print("=" * 80)
        print("Investigation failed with error:")
        traceback.print_exc()
        print("=" * 80)
        raise HTTPException(500, f"Investigation failed: {str(e)}")

@app.get("/customer/{customer_id}/history")
async def customer_history(customer_id: str, limit: int = 30):
    """Return recent transactions for a customer."""
    import sqlite3
    conn = sqlite3.connect("data/fraudshield.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT transaction_id, amount, channel, location, timestamp,
               days_since_last_txn, previous_alerts
        FROM transactions
        WHERE customer_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (customer_id, limit))
    rows = cur.fetchall()
    conn.close()
    history = []
    for row in rows:
        history.append({
            "transaction_id": row[0],
            "amount": row[1],
            "channel": row[2],
            "location": row[3],
            "timestamp": row[4],
            "days_since_last_txn": row[5],
            "previous_alerts": row[6]
        })
    return history

@app.post("/chat")
async def chat(req: ChatRequest):
    cases = load_cases()
    case = next((c for c in cases if c["case_id"] == req.case_id), None)
    if not case:
        raise HTTPException(404, "Case not found")

    # 1. Fetch customer details from SQLite
    customer_id = case.get("customer_id")
    customer_info = "Not available"
    if customer_id:
        cust = get_customer(customer_id)
        if cust:
            customer_info = (
                f"Name: {cust.get('name', 'N/A')}, "
                f"Age: {cust.get('age', 'N/A')}, "
                f"Occupation: {cust.get('occupation', 'N/A')}, "
                f"City: {cust.get('city', 'N/A')}, "
                f"State: {cust.get('state', 'N/A')}, "
                f"KYC Status: {cust.get('kyc_status', 'N/A')}, "
                f"Risk Profile: {cust.get('risk_profile', 'N/A')}"
            )

    # 2. Format similar cases (from RAG) for context
    similar_cases = case.get("similar_cases", [])
    similar_text = ""
    if similar_cases:
        similar_text = "\n".join([
            f"- Case {sim.get('case_id')}: risk {sim.get('risk_score')}, "
            f"decision: {sim.get('reviewer_decision', 'Pending')}"
            for sim in similar_cases[:3]
        ])
    else:
        similar_text = "No similar past cases found."

    # 3. Build a rich prompt
    context = f"""
Case ID: {case['case_id']}
Transaction: {case['transaction_id']}
Amount: ₹{case['amount']:,.2f}
Risk Score: {case['risk_score']} ({case['risk_level']})
Recommendation: {case['recommendation']}

Customer Profile:
{customer_info}

Reasons for risk score:
{chr(10).join([f"- {r['rule']}: {r['evidence']}" for r in case.get('reasons', [])])}

Graph Evidence:
{chr(10).join(case.get('graph', {}).get('evidence', []))}

Similar Past Cases:
{similar_text}

Investigator Question: {req.query}

Answer the question using the provided information. Be concise and helpful.
"""

    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    # Check if Ollama is reachable and get available models
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

    preferred_model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    model_to_use = preferred_model if preferred_model in model_names else model_names[0]

    try:
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={"model": model_to_use, "prompt": context, "stream": False},
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

@app.get("/dashboard/stats")
async def dashboard_stats():
    import sqlite3
    import json
    from datetime import datetime, timedelta

    fallback = {
        "totalTransactions": 36421,
        "unusualTransactions": 250,
        "verification": {"verified": 130, "fraudulent": 80, "unassigned": 40},
        "alerts": [
            {"client": "Johnson", "description": "12 transactions within 24h", "amount": 550000},
            {"client": "Martha", "description": "25 transactions in same month", "amount": 2550000},
            {"client": "Smith", "description": "Large international transfer", "amount": 89000},
        ],
        "investigations": [
            {"bank": "Federal bank USA", "client": "Johnson", "assigned": "Agent smith", "progress": 2, "status": "Investigation opened"},
            {"bank": "Bank", "client": "Martha", "assigned": "Agent", "progress": 3, "status": "In peer review"},
        ],
        "chartData": [
            {"category": "Valid", "count": 120},
            {"category": "Fraud", "count": 80},
            {"category": "Unassigned", "count": 40},
        ]
    }

    try:
        conn = sqlite3.connect("data/fraudshield.db")
        cur = conn.cursor()

        total = cur.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        unusual = cur.execute(
            "SELECT COUNT(*) FROM transactions WHERE amount > 3 * customer_avg_amount OR previous_alerts >= 2"
        ).fetchone()[0]

        # Verification from cases (fallback if empty)
        cases = cur.execute("SELECT result_json FROM cases").fetchall()
        verified = 0
        fraudulent = 0
        unassigned = 0
        for row in cases:
            result = json.loads(row[0])
            score = result.get('risk_score', 0)
            if score >= 70:
                fraudulent += 1
            elif score >= 30:
                unassigned += 1
            else:
                verified += 1
        if verified == 0 and fraudulent == 0 and unassigned == 0:
            verified = 130
            fraudulent = 80
            unassigned = 40

        # Alerts
        alerts_rows = cur.execute("""
            SELECT t.customer_id, t.amount, c.name 
            FROM transactions t 
            JOIN customers c ON t.customer_id = c.customer_id 
            WHERE t.amount > 3 * t.customer_avg_amount OR t.previous_alerts >= 2 
            ORDER BY t.amount DESC 
            LIMIT 3
        """).fetchall()
        alerts = []
        for row in alerts_rows:
            alerts.append({
                "client": row[2] if row[2] else "Unknown",
                "description": "unusual transaction amount",
                "amount": row[1]
            })
        if not alerts:
            alerts = [{"client": "No alerts", "description": "", "amount": 0}]

        # Investigations
        investigations = []
        cases_rows = cur.execute("""
            SELECT result_json FROM cases 
            WHERE json_extract(result_json, '$.status') IN ('Awaiting Human Review', 'Human Decision Recorded')
        """).fetchall()
        for row in cases_rows:
            result = json.loads(row[0])
            investigations.append({
                "bank": "Bank",
                "client": result.get('customer_id', ''),
                "assigned": "Agent",
                "progress": 2,
                "status": result.get('status', '')
            })
        if not investigations:
            investigations = [
                {"bank": "Federal bank USA", "client": "Johnson", "assigned": "Agent smith", "progress": 2, "status": "Investigation opened"},
                {"bank": "Bank", "client": "Martha", "assigned": "Agent", "progress": 3, "status": "In peer review"},
            ]

        # ----- NEW CHART DATA: total counts per category -----
        valid_count = cur.execute("""
            SELECT COUNT(*) FROM transactions 
            WHERE amount <= 3 * customer_avg_amount 
              AND previous_alerts < 2 
              AND days_since_last_txn <= 180
        """).fetchone()[0]

        fraud_count = cur.execute("""
            SELECT COUNT(*) FROM transactions 
            WHERE amount > 3 * customer_avg_amount OR previous_alerts >= 2
        """).fetchone()[0]

        unassigned_count = cur.execute("""
            SELECT COUNT(*) FROM transactions 
            WHERE amount <= 3 * customer_avg_amount 
              AND previous_alerts < 2 
              AND days_since_last_txn > 180
        """).fetchone()[0]

        chart_data = [
            {"category": "Valid", "count": valid_count},
            {"category": "Fraud", "count": fraud_count},
            {"category": "Unassigned", "count": unassigned_count},
        ]

        conn.close()
        return {
            "totalTransactions": total,
            "unusualTransactions": unusual,
            "verification": {"verified": verified, "fraudulent": fraudulent, "unassigned": unassigned},
            "alerts": alerts,
            "investigations": investigations,
            "chartData": chart_data
        }
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        return fallback

@app.get("/recent-transactions")
async def recent_transactions(limit: int = 10):
    import sqlite3
    conn = sqlite3.connect("data/fraudshield.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT transaction_id, customer_id, amount, channel, location, timestamp, story
        FROM transactions
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "customer": r[1],
            "amount": r[2],
            "channel": r[3],
            "location": r[4],
            "timestamp": r[5],
            "story": r[6]
        }
        for r in rows
    ]