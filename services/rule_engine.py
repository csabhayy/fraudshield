"""Full implementation of MVP rules: M1–M3, S1–S3, A1–A2, G1–G3."""
import pandas as pd
from typing import Tuple, List, Dict, Any

def apply_all_rules(tx: pd.Series, all_tx: pd.DataFrame, graph_result: dict) -> Tuple[int, List[Dict], str]:
    score = 0
    reasons = []
    ratio = float(tx.amount) / max(float(tx.customer_avg_amount), 1)

    # ---- Existing R rules ----
    if ratio >= 3:
        pts = 25 if ratio < 10 else 30
        score += pts
        reasons.append({"rule": "R1 Transaction spike", "points": pts,
                        "evidence": f"Amount is {ratio:.1f}x historical average."})
    if int(tx.days_since_last_txn) >= 180:
        score += 30
        reasons.append({"rule": "R2 Dormant activation", "points": 30,
                        "evidence": f"No activity for {int(tx.days_since_last_txn)} days."})
    window = all_tx[(all_tx.source_account == tx.source_account) &
                    (all_tx.timestamp >= tx.timestamp - pd.Timedelta(hours=24)) &
                    (all_tx.timestamp <= tx.timestamp + pd.Timedelta(hours=24))]
    if len(window) >= 4:
        score += 15
        reasons.append({"rule": "R3 Velocity spike", "points": 15,
                        "evidence": f"{len(window)} transactions in 24h."})
    outgoing = float(window[window.transaction_id != tx.transaction_id].amount.sum())
    if float(tx.amount) >= 100000 and outgoing >= 0.8 * float(tx.amount):
        pct = min(999, outgoing / float(tx.amount) * 100)
        score += 25
        reasons.append({"rule": "R4 Rapid fund movement", "points": 25,
                        "evidence": f"Outgoing = {pct:.0f}% of credit."})
    if bool(tx.is_international) and ratio >= 3:
        score += 20
        reasons.append({"rule": "R5 Unusual international transfer", "points": 20,
                        "evidence": "International above baseline."})

    # ---- Mule Rules ----
    if outgoing >= 0.8 * float(tx.amount) and float(tx.amount) >= 50000:
        score += 25
        reasons.append({"rule": "M1 Rapid Fund Movement (Mule)", "points": 25,
                        "evidence": f"{outgoing/float(tx.amount)*100:.0f}% transferred out within 24h."})
    seven_days = all_tx[(all_tx.beneficiary_account == tx.beneficiary_account) &
                        (all_tx.timestamp >= tx.timestamp - pd.Timedelta(days=7))]
    unique_sources = seven_days["source_account"].nunique()
    if unique_sources > 5:
        avg_in = seven_days["amount"].mean()
        if 0.8 * avg_in <= tx.amount <= 1.2 * avg_in:
            score += 20
            reasons.append({"rule": "M2 Multiple Source Accounts", "points": 20,
                            "evidence": f"{unique_sources} unique sources with similar amounts."})
    if graph_result.get("cycles"):
        score += 30
        reasons.append({"rule": "M3 Circular Transaction Pattern", "points": 30,
                        "evidence": f"Cycle detected: {' → '.join(graph_result['cycles'][0])}"})

    # ---- Scam Rules ----
    historical = all_tx[(all_tx.source_account == tx.source_account) &
                        (all_tx.beneficiary_account == tx.beneficiary_account)]
    if historical.empty and ratio > 5:
        score += 20
        reasons.append({"rule": "S1 New Beneficiary High Value", "points": 20,
                        "evidence": f"First transfer to beneficiary, {ratio:.1f}x average."})
    past = all_tx[(all_tx.customer_id == tx.customer_id) &
                  (all_tx.timestamp >= tx.timestamp - pd.Timedelta(days=30))]
    if not past.empty:
        device_match = (past["device_id"] == tx.device_id).any()
        location_match = (past["location"] == tx.location).any()
        if (not device_match or not location_match) and ratio > 3:
            score += 25
            reasons.append({"rule": "S2 Sudden Behavioral Change", "points": 25,
                            "evidence": f"New device/location, {ratio:.1f}x average."})
    if int(tx.previous_alerts) >= 2 and ratio > 3:
        score += 15
        reasons.append({"rule": "S3 Vulnerable Customer Pattern", "points": 15,
                        "evidence": "Multiple high‑value transfers with new payees."})

    # ---- Account Takeover ----
    recent_customer = all_tx[(all_tx.customer_id == tx.customer_id) &
                             (all_tx.timestamp >= tx.timestamp - pd.Timedelta(hours=24))]
    if not recent_customer.empty and recent_customer["device_id"].iloc[0] != tx.device_id and ratio > 2:
        score += 30
        reasons.append({"rule": "A1 Device Change + Fund Transfer", "points": 30,
                        "evidence": "New device login with significant transfer."})
    if int(tx.previous_alerts) >= 3 and tx.channel in ["Internet Banking", "Mobile Banking"]:
        score += 20
        reasons.append({"rule": "A2 Multiple Failed Logins", "points": 20,
                        "evidence": "Multiple alerts for this account."})

    # ---- Graph Network ----
    suspicious = all_tx[all_tx.previous_alerts >= 2]["source_account"].unique()
    if graph_result:
        neighbors_set = set(graph_result.get("neighbors", []))
        if any(n in suspicious for n in neighbors_set):
            score += 15
            reasons.append({"rule": "G1 High‑Risk Network Proximity", "points": 15,
                            "evidence": "Connected to known suspicious account."})
        if graph_result.get("shared_devices"):
            score += 20
            reasons.append({"rule": "G2 Shared Device", "points": 20,
                            "evidence": f"Shared device with {len(set(graph_result['shared_devices']))} other accounts."})
        if len(graph_result.get("neighbors", [])) > 10 and graph_result.get("cycles"):
            score += 35
            reasons.append({"rule": "G3 Emerging Fraud Ring", "points": 35,
                            "evidence": f"Cluster of {len(graph_result['neighbors'])} accounts with circular flows."})

    final_score = max(0, min(100, score))
    if final_score >= 86:
        rec = "Temporary Block / Freeze"
    elif final_score >= 71:
        rec = "Manual Fraud Review"
    elif final_score >= 51:
        rec = "Step-Up Authentication"
    elif final_score >= 31:
        rec = "Enhanced Monitoring"
    else:
        rec = "Allow Transaction"
    return final_score, reasons, rec