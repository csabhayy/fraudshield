"""
Example scenario setup for testing metrics with real data.

This script demonstrates how to:
1. Create transaction records
2. Create investigations with outcomes
3. Record financial data
4. Verify metrics calculations

Run from project root:
    python -m scripts.example_metrics_scenario
"""

import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path

# Outcome and decision enums (match services/metrics_service.py)
class TransactionOutcome:
    UNKNOWN = "UNKNOWN"
    LEGITIMATE = "LEGITIMATE"
    CONFIRMED_FRAUD = "CONFIRMED_FRAUD"


class TransactionDecision:
    ALLOW = "ALLOW"
    REVIEW = "REVIEW"
    CHALLENGE = "CHALLENGE"
    BLOCK = "BLOCK"


def setup_example_scenario():
    """Create example data demonstrating real metrics calculation."""
    
    db_path = Path(__file__).parent.parent / "data" / "fraudshield.db"
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    
    print("Setting up example metrics scenario...")
    print("=" * 60)
    
    # Scenario: 10 fraudulent cases with different outcomes
    
    # 1. PREVENTED FRAUD (₹10,000)
    # Transaction blocked, confirmed fraud
    print("\n1. PREVENTED FRAUD: Transaction blocked, confirmed fraud")
    cur.execute("""
        INSERT OR IGNORE INTO transactions VALUES 
        ('SCENARIO-001', 'CUS-SCENARIO', 'ACC-S001', 'ACC-S002', 
         ?, 10000, 'UPI', 'Delhi', 'DEV-001', 0, 'Active', 'High', 0, 2000, 0, 'Test')
    """, (datetime.now().isoformat(),))
    
    case_1 = {
        "case_id": "FS-SCENARIO-001",
        "transaction_id": "SCENARIO-001",
        "customer_id": "CUS-SCENARIO",
        "status": "Fraud Confirmed",
        "outcome": TransactionOutcome.CONFIRMED_FRAUD,
        "decision": TransactionDecision.BLOCK,
        "transactionCompleted": False,
        "amount": 10000.0,
        "actualLossAmount": 0.0,
        "recoveredAmount": 0.0,
        "preventedAmount": 10000.0,
        "wasDetected": True,
    }
    cur.execute("""
        INSERT OR IGNORE INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        case_1["case_id"], case_1["transaction_id"], json.dumps(case_1),
        "Fraud Confirmed", "",
        datetime.now().isoformat(), datetime.now().isoformat()
    ))
    print("   ✓ Transaction blocked: ₹10,000")
    print("   ✓ Prevented amount: ₹10,000")
    
    # 2-3. COMPLETED FRAUD WITH LOSS (₹20,000 + ₹30,000)
    # Transactions allowed, confirmed fraud, financial loss recorded
    print("\n2-3. COMPLETED FRAUD WITH LOSS: Allowed, confirmed, losses recorded")
    
    for i, (txn_id, amount, loss, recovered) in enumerate([
        ("SCENARIO-002", 20000, 20000, 0),
        ("SCENARIO-003", 30000, 30000, 5000),
    ], start=2):
        cur.execute("""
            INSERT OR IGNORE INTO transactions VALUES 
            (?, 'CUS-SCENARIO', 'ACC-S001', 'ACC-S002', 
             ?, ?, 'UPI', 'Delhi', 'DEV-001', 0, 'Active', 'High', 0, 5000, 0, 'Test')
        """, (txn_id, datetime.now().isoformat(), amount))
        
        case_data = {
            "case_id": f"FS-{txn_id}",
            "transaction_id": txn_id,
            "customer_id": "CUS-SCENARIO",
            "status": "Fraud Confirmed",
            "outcome": TransactionOutcome.CONFIRMED_FRAUD,
            "decision": TransactionDecision.ALLOW,
            "transactionCompleted": True,
            "amount": amount,
            "actualLossAmount": loss,
            "recoveredAmount": recovered,
            "wasDetected": True,
        }
        cur.execute("""
            INSERT OR IGNORE INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            case_data["case_id"], case_data["transaction_id"], json.dumps(case_data),
            "Fraud Confirmed", "",
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        net_loss = loss - recovered
        print(f"   ✓ Transaction {txn_id}: ₹{amount} | Loss: ₹{loss} | Recovered: ₹{recovered} | Net: ₹{net_loss}")
    
    # 4-6. UNDETECTED FRAUD (₹15,000 + ₹25,000 + ₹35,000)
    # Confirmed fraud but not detected by system before confirmation
    print("\n4-6. UNDETECTED FRAUD: Confirmed fraud but not detected by system")
    
    for i, (txn_id, amount) in enumerate([
        ("SCENARIO-004", 15000),
        ("SCENARIO-005", 25000),
        ("SCENARIO-006", 35000),
    ], start=4):
        cur.execute("""
            INSERT OR IGNORE INTO transactions VALUES 
            (?, 'CUS-SCENARIO', 'ACC-S001', 'ACC-S002', 
             ?, ?, 'UPI', 'Delhi', 'DEV-001', 0, 'Active', 'Low', 0, 10000, 0, 'Test')
        """, (txn_id, datetime.now().isoformat(), amount))
        
        case_data = {
            "case_id": f"FS-{txn_id}",
            "transaction_id": txn_id,
            "customer_id": "CUS-SCENARIO",
            "status": "Fraud Confirmed",
            "outcome": TransactionOutcome.CONFIRMED_FRAUD,
            "decision": TransactionDecision.ALLOW,
            "transactionCompleted": True,
            "amount": amount,
            "actualLossAmount": amount,
            "recoveredAmount": 0.0,
            "wasDetected": False,  # Not detected by system
        }
        cur.execute("""
            INSERT OR IGNORE INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            case_data["case_id"], case_data["transaction_id"], json.dumps(case_data),
            "Fraud Confirmed", "",
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        print(f"   ✓ Transaction {txn_id}: ₹{amount} (undetected)")
    
    # 7. FLAGGED BUT AWAITING REVIEW
    # High-risk transaction not yet investigated
    print("\n7. AWAITING REVIEW: Flagged high-risk, under investigation")
    cur.execute("""
        INSERT OR IGNORE INTO transactions VALUES 
        ('SCENARIO-007', 'CUS-SCENARIO', 'ACC-S001', 'ACC-S002', 
         ?, 45000, 'UPI', 'Delhi', 'DEV-001', 100, 'Active', 'High', 0, 10000, 0, 'Test')
    """, (datetime.now().isoformat(),))
    
    case_7 = {
        "case_id": "FS-SCENARIO-007",
        "transaction_id": "SCENARIO-007",
        "customer_id": "CUS-SCENARIO",
        "status": "Awaiting Human Review",
        "outcome": TransactionOutcome.UNKNOWN,
        "decision": TransactionDecision.REVIEW,
        "transactionCompleted": True,
        "amount": 45000.0,
    }
    cur.execute("""
        INSERT OR IGNORE INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        case_7["case_id"], case_7["transaction_id"], json.dumps(case_7),
        "Pending", "",
        datetime.now().isoformat(), datetime.now().isoformat()
    ))
    print("   ✓ Transaction: ₹45,000")
    print("   ✓ Status: Awaiting human decision")
    
    # 8. LEGITIMATE TRANSACTION
    # Confirmed as legitimate
    print("\n8. LEGITIMATE: Flagged but confirmed as legitimate")
    cur.execute("""
        INSERT OR IGNORE INTO transactions VALUES 
        ('SCENARIO-008', 'CUS-SCENARIO', 'ACC-S001', 'ACC-S002', 
         ?, 50000, 'UPI', 'Delhi', 'DEV-001', 0, 'Active', 'High', 0, 10000, 1, 'Test')
    """, (datetime.now().isoformat(),))
    
    case_8 = {
        "case_id": "FS-SCENARIO-008",
        "transaction_id": "SCENARIO-008",
        "customer_id": "CUS-SCENARIO",
        "status": "Closed - Legitimate",
        "outcome": TransactionOutcome.LEGITIMATE,
        "decision": TransactionDecision.ALLOW,
        "transactionCompleted": True,
        "amount": 50000.0,
        "wasDetected": True,
    }
    cur.execute("""
        INSERT OR IGNORE INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        case_8["case_id"], case_8["transaction_id"], json.dumps(case_8),
        "Closed", "Customer confirmed legitimate transaction",
        datetime.now().isoformat(), datetime.now().isoformat()
    ))
    print("   ✓ Transaction: ₹50,000")
    print("   ✓ Outcome: Legitimate (not counted as fraud)")
    
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 60)
    print("Example scenario setup complete!")
    print("\nExpected metrics results:")
    print("  Money at Risk:     ₹45,000 (1 transaction awaiting review)")
    print("  Fraud Prevented:   ₹10,000 (1 transaction blocked)")
    print("  Fraud Loss:        ₹70,000 (Net: 20000 + 25000)")
    print("  Detection Rate:    80% (4 detected / 5 total confirmed fraud)")
    print("  Review Queue:      1 investigation")
    print("\nQuery metrics at:")
    print("  GET http://localhost:8000/metrics/all")
    print("\n" + "=" * 60)


if __name__ == "__main__":
    setup_example_scenario()
