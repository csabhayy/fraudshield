"""FraudShield API – investigation, chat, and graph endpoints."""
import os
import requests
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from dotenv import load_dotenv

import json
from datetime import datetime, timedelta
import sqlite3

from agents.workflow import build_investigation_workflow
from services.data_service import load_transactions, save_case, load_cases, get_customer, convert_numpy
from services.vector_service import VectorService
from services.graph_service import Neo4jClient
from services.transaction_generator import start_generator
from agents.nodes import (
    data_retriever_node,
    graph_analyst_node,
    rule_engine_node,
    anomaly_detector_node,
    rag_retriever_node,
    report_generator_node,
)

load_dotenv()

# ------- Helper: Convert NumPy types to Python types for JSON -------
# Reuse the shared data service helper to ensure consistent serialization across the app.

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


STAGE_PIPELINE = [
    ("data_retriever", data_retriever_node),
    ("graph_analyst", graph_analyst_node),
    ("rule_engine", rule_engine_node),
    ("anomaly_detector", anomaly_detector_node),
    ("rag_retriever", rag_retriever_node),
    ("report_generator", report_generator_node),
]


def _create_initial_state(transaction_id: str) -> dict:
    return {
        "transaction_id": transaction_id,
        "case_id": f"FS-{transaction_id}",
        "created_at": datetime.now().isoformat(),
    }


def _summarize_stage_output(stage_name: str, state: dict) -> dict:
    if stage_name == "data_retriever":
        tx = state.get("transaction", {})
        return {
            "transaction_id": tx.get("transaction_id"),
            "customer_id": tx.get("customer_id"),
            "amount": tx.get("amount"),
            "channel": tx.get("channel"),
        }
    if stage_name == "graph_analyst":
        graph = state.get("graph_result", {})
        return {
            "cycles": len(graph.get("cycles", [])),
            "neighbors": len(graph.get("neighbors", [])),
            "edges": len(graph.get("edges", [])),
        }
    if stage_name == "rule_engine":
        return {
            "risk_score": state.get("rule_score", 0),
            "reasons": len(state.get("reasons", [])),
            "recommendation": state.get("recommendation", "N/A"),
        }
    if stage_name == "anomaly_detector":
        return {
            "anomaly_score": state.get("anomaly_score", 0),
        }
    if stage_name == "rag_retriever":
        return {
            "similar_cases": len(state.get("similar_cases", [])),
        }
    if stage_name == "report_generator":
        return {
            "narrative_ready": bool(state.get("narrative")),
        }
    return {}


def _build_case_response(result_state: dict) -> dict:
    tx = result_state["transaction"]
    graph = result_state.get("graph_result", {})
    similar = result_state.get("similar_cases", [])

    final = {
        "case_id": result_state["case_id"],
        "transaction_id": tx["transaction_id"],
        "customer_id": tx["customer_id"],
        "masked_account": "XXXX" + tx["source_account"][-4:],
        "source_account": tx.get("source_account"),
        "beneficiary_account": tx.get("beneficiary_account"),
        "amount": float(tx["amount"]),
        "timestamp": tx.get("timestamp"),
        "channel": tx.get("channel"),
        "location": tx.get("location"),
        "device_id": tx.get("device_id"),
        "customer_avg_amount": float(tx.get("customer_avg_amount", 0) or 0),
        "days_since_last_txn": int(tx.get("days_since_last_txn", 0) or 0),
        "previous_alerts": int(tx.get("previous_alerts", 0) or 0),
        "is_international": bool(tx.get("is_international", False)),
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
        "similar_cases": similar,
        # Ground-truth fraud outcome (initialized as UNKNOWN until confirmed)
        "outcome": "UNKNOWN",
        # Decision made by rule engine (will be updated by reviewer)
        "decision": "BLOCK" if result_state["rule_score"] >= 70 else
                   "REVIEW" if result_state["rule_score"] >= 40 else
                   "CHALLENGE" if result_state["rule_score"] >= 31 else "ALLOW",
        # Transaction completion status (true = completed, false = prevented/blocked)
        "transactionCompleted": True if result_state["rule_score"] < 31 else False,
        # Financial outcome fields (null until confirmed)
        "actualLossAmount": None,
        "recoveredAmount": None,
        "preventedAmount": None,
        # Detection metadata
        "wasDetected": result_state["rule_score"] >= 31,  # Considered detected if flagged by rule engine
        "detectionTimestamp": result_state["created_at"] if result_state["rule_score"] >= 31 else None,
        "outcomeConfirmedTimestamp": None,
    }
    return convert_numpy(final)


def _run_pipeline(transaction_id: str):
    df = load_transactions()
    if transaction_id not in df["transaction_id"].values:
        raise HTTPException(404, "Transaction not found")

    state = _create_initial_state(transaction_id)
    stage_events = []

    for stage_name, stage_fn in STAGE_PIPELINE:
        started_at = datetime.now()
        state = stage_fn(state)
        duration_ms = int((datetime.now() - started_at).total_seconds() * 1000)

        stage_payload = {
            "stage": stage_name,
            "status": "failed" if state.get("error") else "completed",
            "duration_ms": duration_ms,
            "output": _summarize_stage_output(stage_name, state),
        }
        stage_events.append(stage_payload)

        if state.get("error"):
            break

    return state, stage_events


def _persist_case(final_case: dict):
    save_case(final_case)
    vector_db.index_case(final_case)


def _sse_event(event_name: str, payload: dict) -> str:
    return f"event: {event_name}\ndata: {json.dumps(convert_numpy(payload), default=str)}\n\n"

# ------- Endpoints -------
@app.post("/investigate")
async def investigate(req: InvestigateRequest):
    import traceback

    try:
        result_state, _ = _run_pipeline(req.transaction_id)

        if result_state.get("error"):
            raise HTTPException(400, result_state["error"])

        final = _build_case_response(result_state)
        _persist_case(final)
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


@app.get("/investigate/stream/{transaction_id}")
async def investigate_stream(transaction_id: str):
    def stream_events():
        import traceback

        try:
            state = _create_initial_state(transaction_id)
            yield _sse_event("investigation_started", {
                "transaction_id": transaction_id,
                "case_id": state["case_id"],
                "created_at": state["created_at"],
            })

            df = load_transactions()
            if transaction_id not in df["transaction_id"].values:
                yield _sse_event("investigation_error", {
                    "message": "Transaction not found",
                    "status_code": 404,
                })
                return

            for stage_name, stage_fn in STAGE_PIPELINE:
                yield _sse_event("stage_update", {
                    "stage": stage_name,
                    "status": "started",
                })

                started_at = datetime.now()
                state = stage_fn(state)
                duration_ms = int((datetime.now() - started_at).total_seconds() * 1000)

                if state.get("error"):
                    yield _sse_event("stage_update", {
                        "stage": stage_name,
                        "status": "failed",
                        "duration_ms": duration_ms,
                        "error": state["error"],
                    })
                    yield _sse_event("investigation_error", {
                        "message": state["error"],
                        "status_code": 400,
                    })
                    return

                yield _sse_event("stage_update", {
                    "stage": stage_name,
                    "status": "completed",
                    "duration_ms": duration_ms,
                    "output": _summarize_stage_output(stage_name, state),
                })

            final = _build_case_response(state)
            _persist_case(final)

            yield _sse_event("investigation_result", final)
            yield _sse_event("investigation_done", {
                "transaction_id": transaction_id,
                "case_id": final.get("case_id"),
            })

        except Exception as exc:
            print("=" * 80)
            print("Streaming investigation failed:")
            traceback.print_exc()
            print("=" * 80)
            yield _sse_event("investigation_error", {
                "message": f"Investigation failed: {str(exc)}",
                "status_code": 500,
            })

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(stream_events(), media_type="text/event-stream", headers=headers)

@app.get("/customer/{customer_id}/history")
async def customer_history(customer_id: str, limit: int = 30):
    """Return recent transactions for a customer."""
    import sqlite3
    conn = sqlite3.connect("data/fraudshield.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT transaction_id, amount, channel, location, timestamp,
               days_since_last_txn, previous_alerts, source_account,
               beneficiary_account, device_id
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
            "previous_alerts": row[6],
            "source_account": row[7],
            "beneficiary_account": row[8],
            "device_id": row[9],
        })
    return history

@app.post("/chat")
async def chat(req: ChatRequest):
    import requests
    import os
    from services.data_service import load_cases, get_customer

    cases = load_cases()
    requested_id = req.case_id.strip()

    if requested_id.lower() == 'general_query':
        case = cases[-1] if cases else None
    else:
        if requested_id.startswith("TXN-") and not requested_id.startswith("FS-"):
            requested_id = f"FS-{requested_id}"

        case = next(
            (
                c for c in cases
                if c.get("case_id") == requested_id or c.get("transaction_id") == req.case_id
            ),
            None,
        )

    if not case:
        raise HTTPException(404, "Case not found")

    # Fetch customer details if available
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

    # Similar cases
    similar = case.get("similar_cases", [])
    similar_text = ""
    if similar:
        similar_text = "\n".join([
            f"- Case {s.get('case_id')}: risk {s.get('risk_score')}, decision: {s.get('reviewer_decision', 'Pending')}"
            for s in similar[:3]
        ])
    else:
        similar_text = "No similar past cases found."

    # Build a structured, concise prompt
    context = f"""
Transaction: {case['transaction_id']}
Amount: ₹{case['amount']:,.2f}
Risk Score: {case['risk_score']} ({case['risk_level']})
Recommendation: {case['recommendation']}

Customer Profile:
{customer_info}

Risk Signals (reasons):
{chr(10).join([f"- {r['rule']}: {r['evidence']}" for r in case.get('reasons', [])])}

Graph Evidence:
{chr(10).join(case.get('graph', {}).get('evidence', []))}

Similar Cases:
{similar_text}

Investigator Question: {req.query}

Instructions:
- You are a fraud investigator. Answer directly, confidently, and concisely.
- Use a conversational tone, as if speaking to a colleague.
- Do not hedge or use phrases like "based on the provided information" or "I can infer".
- Focus on the facts and the data. Be precise.
- Keep the answer under 4 sentences unless the question requires more detail.
- If the question asks about the transaction's nature, state it clearly (e.g., "This is a suspicious transfer because...").
- If the question asks for a recommendation, give a clear actionable next step.

Answer:
"""

    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")

    # Check if Ollama is available
    try:
        models_resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
        if models_resp.status_code != 200:
            return {"response": "Ollama is not responding. Please start it."}
        models = models_resp.json().get("models", [])
        model_names = [m["name"] for m in models]
        if not model_names:
            return {"response": "No models found. Please pull a model."}
    except Exception as e:
        return {"response": f"Could not connect to Ollama: {str(e)}"}

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
            answer = f"Ollama error: {response.status_code}"
    except Exception as e:
        answer = f"Error: {str(e)}"

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

# ------- Business Metrics Endpoints -------
@app.get("/metrics/money-at-risk")
async def metrics_money_at_risk():
    """Get current Money at Risk metric with full provenance."""
    from services.metrics_service import get_metrics_service
    metrics = get_metrics_service()
    return metrics.calculate_money_at_risk()

@app.get("/metrics/fraud-prevented")
async def metrics_fraud_prevented():
    """Get Fraud Prevented metric with full provenance."""
    from services.metrics_service import get_metrics_service
    metrics = get_metrics_service()
    return metrics.calculate_fraud_prevented()

@app.get("/metrics/fraud-loss")
async def metrics_fraud_loss():
    """Get Fraud Loss metric with full provenance."""
    from services.metrics_service import get_metrics_service
    metrics = get_metrics_service()
    return metrics.calculate_fraud_loss()

@app.get("/metrics/detection-rate")
async def metrics_detection_rate():
    """Get Detection Rate metric with full provenance."""
    from services.metrics_service import get_metrics_service
    metrics = get_metrics_service()
    return metrics.calculate_detection_rate()

@app.get("/metrics/review-queue")
async def metrics_review_queue():
    """Get Review Queue metric with full provenance."""
    from services.metrics_service import get_metrics_service
    metrics = get_metrics_service()
    return metrics.calculate_review_queue()

@app.get("/metrics/all")
async def metrics_all():
    """Get all business metrics in one call."""
    from services.metrics_service import get_metrics_service
    metrics = get_metrics_service()
    return metrics.get_all_business_metrics()

@app.get("/dashboard/stats")
async def dashboard_stats():
    import sqlite3
    import json
    from datetime import datetime

    empty_payload = {
        "totalTransactions": 0,
        "unusualTransactions": 0,
        "verification": {"verified": 0, "fraudulent": 0, "unassigned": 0},
        "verificationActivity": [],
        "alerts": [],
        "investigations": [],
        "chartData": [
            {"category": "Valid", "count": 0},
            {"category": "Fraud", "count": 0},
            {"category": "Unassigned", "count": 0},
        ],
    }

    try:
        conn = sqlite3.connect("data/fraudshield.db")
        cur = conn.cursor()

        total = cur.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        unusual = cur.execute(
            "SELECT COUNT(*) FROM transactions WHERE amount > 3 * customer_avg_amount OR previous_alerts >= 2"
        ).fetchone()[0]

        # Verification from cases
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

        # Detailed verification activity for dashboard filters
        verification_rows = cur.execute("""
            SELECT
                c.case_id,
                c.transaction_id,
                c.updated_at,
                c.result_json,
                t.customer_id,
                t.source_account,
                t.beneficiary_account,
                t.amount,
                t.timestamp,
                cust.name
            FROM cases c
            LEFT JOIN transactions t ON t.transaction_id = c.transaction_id
            LEFT JOIN customers cust ON cust.customer_id = t.customer_id
            ORDER BY COALESCE(c.updated_at, t.timestamp) DESC
            LIMIT 200
        """).fetchall()

        verification_activity = []
        for row in verification_rows:
            result_json = row[3]
            result = json.loads(result_json) if result_json else {}
            case_risk_score = int(result.get("risk_score", 0) or 0)
            if case_risk_score >= 70:
                risk_level = "High"
            elif case_risk_score >= 40:
                risk_level = "Medium"
            else:
                risk_level = "Low"
            verification_activity.append({
                "case_id": row[0],
                "transaction_id": row[1],
                "updated_at": row[2] or row[8],
                "customer_id": row[4] or result.get("customer_id", "Unknown"),
                "customer_name": row[9] or "Unknown",
                "source_account": row[5] or "Unknown",
                "beneficiary_account": row[6] or "Unknown",
                "amount": float(row[7] or result.get("amount", 0) or 0),
                "risk_score": case_risk_score,
                "risk_level": risk_level,
                "status": result.get("status", "Unknown"),
                "investigation_status": "Complete" if result.get("status") != "Awaiting Human Review" else "Awaiting Human Review",
            })

        # Alerts with evidence, status, and historical comparison
        alerts_rows = cur.execute("""
            SELECT
                t.transaction_id,
                t.customer_id,
                c.name,
                t.source_account,
                t.beneficiary_account,
                t.amount,
                t.customer_avg_amount,
                t.previous_alerts,
                t.days_since_last_txn,
                t.channel,
                t.location,
                t.timestamp,
                t.is_international,
                COALESCE(json_extract(cs.result_json, '$.status'), 'Not Investigated') AS investigation_status
            FROM transactions t
            JOIN customers c ON t.customer_id = c.customer_id
            LEFT JOIN cases cs ON cs.transaction_id = t.transaction_id
            WHERE t.amount > 3 * t.customer_avg_amount
               OR t.previous_alerts >= 2
               OR t.days_since_last_txn >= 180
            ORDER BY t.amount DESC 
            LIMIT 20
        """).fetchall()

        alerts = []
        for row in alerts_rows:
            avg_amount = float(row[6] or 0)
            amount = float(row[5] or 0)
            ratio = amount / max(avg_amount, 1)
            previous_alerts = int(row[7] or 0)
            dormant_days = int(row[8] or 0)
            is_international = bool(row[12] or 0)

            risk_score = 0
            risk_signals = []

            if ratio >= 3:
                ratio_score = 35 if ratio < 10 else 45
                risk_score += ratio_score
                risk_signals.append({
                    "signal": "Unusual Amount",
                    "severity": "High" if ratio >= 5 else "Medium",
                    "evidence": f"Amount is {ratio:.1f}x the customer baseline.",
                    "comparison": {
                        "transaction_amount": amount,
                        "baseline_amount": avg_amount,
                        "multiplier": round(ratio, 2),
                    },
                })

            if previous_alerts >= 2:
                risk_score += 25
                risk_signals.append({
                    "signal": "Velocity Anomaly",
                    "severity": "High",
                    "evidence": f"{previous_alerts} prior alerts exist for this customer.",
                    "comparison": {
                        "previous_alerts": previous_alerts,
                    },
                })

            if dormant_days >= 180:
                risk_score += 20
                risk_signals.append({
                    "signal": "Dormant Reactivation",
                    "severity": "Medium",
                    "evidence": f"Account inactive for {dormant_days} days before this transaction.",
                    "comparison": {
                        "days_since_last_transaction": dormant_days,
                    },
                })

            if is_international:
                risk_score += 15
                risk_signals.append({
                    "signal": "International Route",
                    "severity": "Medium",
                    "evidence": "Transaction marked as international.",
                    "comparison": {
                        "is_international": True,
                    },
                })

            risk_score = min(100, risk_score)
            if risk_score >= 80:
                risk_level = "High"
            elif risk_score >= 45:
                risk_level = "Medium"
            else:
                risk_level = "Low"

            flagged_reason = ", ".join(signal["signal"] for signal in risk_signals[:3]) or "Manual review suggested"

            alerts.append({
                "transaction_id": row[0],
                "customer_id": row[1],
                "customer_name": row[2] if row[2] else "Unknown",
                "source_account": row[3],
                "beneficiary_account": row[4],
                "amount": amount,
                "channel": row[9],
                "location": row[10],
                "timestamp": row[11],
                "risk_score": risk_score,
                "risk_level": risk_level,
                "flagged_reason": flagged_reason,
                "risk_signals": risk_signals,
                "historical_comparison": {
                    "customer_avg_amount": avg_amount,
                    "amount_multiplier": round(ratio, 2),
                    "previous_alerts": previous_alerts,
                    "days_since_last_transaction": dormant_days,
                },
                "investigation_status": row[13],
                "recommended_next_action": "Open investigation and validate beneficiary relationship." if risk_score >= 70 else "Monitor and verify customer intent.",
                # legacy keys for backward compatibility
                "client": row[2] if row[2] else "Unknown",
                "description": flagged_reason,
            })

        # Investigations from completed cases with explicit stage model
        investigations = []
        cases_rows = cur.execute("""
            SELECT case_id, transaction_id, result_json, updated_at
            FROM cases
            ORDER BY COALESCE(updated_at, datetime('now')) DESC
            LIMIT 20
        """).fetchall()
        for row in cases_rows:
            result = json.loads(row[2])
            final_status = result.get("status", "Unknown")
            stage_sequence = [
                "Transaction ingestion",
                "Customer history retrieved",
                "Historical transactions analyzed",
                "Network relationships analyzed",
                "Risk pattern comparison",
                "Investigation summary generated",
            ]

            if final_status in ("Awaiting Human Review", "Human Decision Recorded", "Closed - Low Risk"):
                completed_steps = stage_sequence
                active_step = "Awaiting Human decision" if final_status == "Awaiting Human Review" else "Completed"
                pending_steps = ["Human review"] if final_status == "Awaiting Human Review" else []
                progress_pct = 85 if final_status == "Awaiting Human Review" else 100
                agent_status = "Awaiting human reviewer" if final_status == "Awaiting Human Review" else "Completed"
            else:
                completed_steps = stage_sequence[:4]
                active_step = "Risk pattern comparison"
                pending_steps = stage_sequence[4:]
                progress_pct = 65
                agent_status = "In progress"

            investigations.append({
                "investigation_id": row[0],
                "transaction_id": row[1],
                "customer_id": result.get("customer_id", "Unknown"),
                "risk_score": int(result.get("risk_score", 0) or 0),
                "status": final_status,
                "current_stage": active_step,
                "progress_pct": progress_pct,
                "completed_steps": completed_steps,
                "active_step": active_step,
                "pending_steps": pending_steps,
                "last_updated": row[3] or result.get("created_at") or datetime.now().isoformat(),
                "agent_status": agent_status,
                # legacy keys for backward compatibility
                "bank": "FraudShield",
                "client": result.get("customer_id", "Unknown"),
                "assigned": "AI Supervisor",
                "progress": max(1, round(progress_pct / 20)),
            })

        # Chart data: total counts per category
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
            "verificationActivity": verification_activity,
            "alerts": alerts,
            "investigations": investigations,
            "chartData": chart_data
        }
    except Exception as e:
        print(f"Dashboard stats error: {e}")
        return empty_payload

@app.get("/recent-transactions")
async def recent_transactions(limit: int = 10):
    import sqlite3
    conn = sqlite3.connect("data/fraudshield.db")
    cur = conn.cursor()
    cur.execute("""
        SELECT transaction_id, customer_id, source_account, beneficiary_account, amount, channel, location, timestamp,
               device_id, days_since_last_txn, customer_avg_amount, previous_alerts, is_international, story
        FROM transactions
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = cur.fetchall()
    conn.close()

    def compute_risk(amount, avg_amount, previous_alerts, is_international):
        score = 0
        if avg_amount and avg_amount > 0:
            ratio = amount / avg_amount
            score += 30 if ratio >= 3 else 0
            score += 15 if ratio >= 10 else 0
        score += 20 if previous_alerts >= 2 else 0
        score += 10 if is_international else 0
        score = min(100, int(score))
        if score >= 85:
            level = 'Critical'
        elif score >= 70:
            level = 'High'
        elif score >= 45:
            level = 'Medium'
        else:
            level = 'Low'
        decision = 'BLOCK' if score >= 70 else 'REVIEW' if score >= 40 else 'ALLOW'
        return score, level, decision

    result = []
    for r in rows:
        amount = float(r[4] or 0)
        avg_amount = float(r[10] or 0)
        score, level, decision = compute_risk(amount, avg_amount, int(r[11] or 0), bool(r[12] or 0))
        result.append({
            "transaction_id": r[0],
            "customer_id": r[1],
            "source_account": r[2] or "Unknown",
            "beneficiary_account": r[3] or "Unknown",
            "amount": amount,
            "channel": r[5],
            "location": r[6],
            "timestamp": r[7],
            "device_id": r[8] or "Unknown",
            "days_since_last_txn": int(r[9] or 0),
            "customer_avg_amount": avg_amount,
            "previous_alerts": int(r[11] or 0),
            "is_international": bool(r[12] or 0),
            "story": r[13] or "",
            "risk_score": score,
            "risk_level": level,
            "decision": decision,
        })
    return result
