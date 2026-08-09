"""LangGraph node functions – each is a step in the investigation workflow."""
import os
import requests
from typing import Dict, Any
import pandas as pd
from services.data_service import load_transactions
from services.graph_service import Neo4jClient
from services.rule_engine import apply_all_rules
from services.anomaly_detector import compute_anomaly_scores
from services.vector_service import VectorService

# Global instances – reused across calls
tx_df = load_transactions()
neo4j = Neo4jClient()
vector_db = VectorService()

def data_retriever_node(state: Dict[str, Any]) -> Dict[str, Any]:
    tx_id = state.get("transaction_id")
    if not tx_id:
        state["error"] = "No transaction_id"
        return state
    try:
        from services.data_service import load_transactions
        df = load_transactions()  # fresh load from SQLite (includes live data)
        tx_row = df[df["transaction_id"] == tx_id]
        if tx_row.empty:
            state["error"] = f"Transaction {tx_id} not found"
            return state
        state["transaction"] = tx_row.iloc[0].to_dict()
        state["all_transactions"] = df.to_dict("records")
    except Exception as e:
        state["error"] = f"Data retrieval error: {str(e)}"
    return state

def graph_analyst_node(state: Dict[str, Any]) -> Dict[str, Any]:
    if "transaction" not in state:
        state["error"] = "No transaction data"
        return state
    account = state["transaction"]["source_account"]
    state["graph_result"] = neo4j.analyze_account(account, lookback_days=7)
    return state

def rule_engine_node(state: Dict[str, Any]) -> Dict[str, Any]:
    if "transaction" not in state:
        state["error"] = "No transaction data"
        return state
    tx_series = pd.Series(state["transaction"])
    all_tx = pd.DataFrame(state["all_transactions"])
    graph_result = state.get("graph_result", {})
    score, reasons, rec = apply_all_rules(tx_series, all_tx, graph_result)
    state["rule_score"] = score
    state["reasons"] = reasons
    state["recommendation"] = rec
    return state

def anomaly_detector_node(state: Dict[str, Any]) -> Dict[str, Any]:
    all_tx = pd.DataFrame(state.get("all_transactions", []))
    if all_tx.empty:
        state["error"] = "No transactions for anomaly"
        return state
    scores = compute_anomaly_scores(all_tx)
    state["anomaly_score"] = scores.get(state["transaction_id"], 0)
    return state

def rag_retriever_node(state: Dict[str, Any]) -> Dict[str, Any]:
    query = {
        "transaction_id": state.get("transaction_id"),
        "amount": state["transaction"].get("amount", 0),
        "reasons": state.get("reasons", [])
    }
    state["similar_cases"] = vector_db.search_similar(query, limit=3)
    return state

def report_generator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Fast static report – no LLM."""
    tx = state.get("transaction", {})
    score = state.get("rule_score", 0)
    reasons = state.get("reasons", [])
    graph = state.get("graph_result", {})
    similar = state.get("similar_cases", [])
    case_id = state.get("case_id", "Unknown")
    reason_text = "\n".join([f"- {r['rule']}: {r['evidence']}" for r in reasons])
    graph_evidence = "\n".join(graph.get("evidence", []))
    state["narrative"] = f"""
Investigation Report – Case {case_id}
=====================================
Transaction: {tx.get('transaction_id')}
Risk Score: {score}
Recommendation: {state.get('recommendation', 'N/A')}
Reasons:
{reason_text}
Graph Evidence:
{graph_evidence}
Similar Cases: {len(similar)}
"""
    return state