"""Data loading, generation, and SQLite persistence."""
import sqlite3
import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime

import numpy as np

def convert_numpy(obj):
    """Recursively convert NumPy types to Python types for JSON serialization."""
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

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DB_PATH = DATA_DIR / "fraudshield.db"
CSV_PATH = DATA_DIR / "transactions.csv"

def generate_demo_data(seed=42):
    """Create realistic synthetic data with embedded fraud scenarios."""
    rng = np.random.default_rng(seed)
    rows = []
    accounts = [f"ACC-{1000+i}" for i in range(40)]
    customers = [f"CUS-{2000+i}" for i in range(40)]
    channels = ["UPI", "Mobile Banking", "Internet Banking", "Branch", "ATM", "NEFT", "RTGS"]
    cities = ["Delhi", "Mumbai", "Lucknow", "Pune", "Jaipur", "Chennai", "Kolkata"]
    base = pd.Timestamp("2026-07-01 09:00:00")
    for i in range(360):
        idx = rng.integers(0, 40)
        amount = float(max(250, rng.lognormal(10.0, .72)))
        rows.append({
            "transaction_id": f"TXN-{10000+i}",
            "customer_id": customers[idx],
            "source_account": accounts[idx],
            "beneficiary_account": accounts[rng.integers(0, 40)],
            "timestamp": base + pd.Timedelta(hours=int(rng.integers(0, 650))),
            "amount": round(amount, 2),
            "channel": str(rng.choice(channels)),
            "location": str(rng.choice(cities)),
            "device_id": f"DEV-{idx:03d}",
            "days_since_last_txn": int(rng.integers(0, 18)),
            "account_status": "Active",
            "kyc_risk": str(rng.choice(["Low", "Low", "Medium", "Medium", "High"])),
            "is_international": bool(rng.random() < .04),
            "customer_avg_amount": round(amount * rng.uniform(.65, 1.5), 2),
            "previous_alerts": int(rng.integers(0, 3)),
            "story": "Normal"
        })
    # Critical chain
    chain = [
        ("TXN-CRIT-001","CUS-2021","ACC-1021","ACC-1031","2026-07-28 09:05:00",700000,"DEV-777","Dormant account receives high-value credit"),
        ("TXN-CRIT-002","CUS-2021","ACC-1021","ACC-1006","2026-07-28 09:42:00",250000,"DEV-777","Rapid outgoing movement"),
        ("TXN-CRIT-003","CUS-2021","ACC-1021","ACC-1014","2026-07-28 10:08:00",210000,"DEV-777","Rapid outgoing movement"),
        ("TXN-CRIT-004","CUS-2021","ACC-1021","ACC-1033","2026-07-28 10:27:00",184000,"DEV-777","Rapid outgoing movement"),
        ("TXN-CRIT-005","CUS-2031","ACC-1031","ACC-1006","2026-07-28 11:00:00",650000,"DEV-889","Layering chain"),
        ("TXN-CRIT-006","CUS-2006","ACC-1006","ACC-1014","2026-07-28 11:35:00",620000,"DEV-889","Layering chain"),
        ("TXN-CRIT-007","CUS-2014","ACC-1014","ACC-1021","2026-07-28 12:05:00",600000,"DEV-889","Circular flow")
    ]
    for tid,cid,src,dst,ts,amt,dev,story in chain:
        rows.append({
            "transaction_id": tid, "customer_id": cid, "source_account": src,
            "beneficiary_account": dst, "timestamp": pd.Timestamp(ts), "amount": amt,
            "channel": "Mobile Banking", "location": "Delhi", "device_id": dev,
            "days_since_last_txn": 286 if tid=="TXN-CRIT-001" else 0,
            "account_status": "Dormant" if tid=="TXN-CRIT-001" else "Active",
            "kyc_risk": "High", "is_international": False,
            "customer_avg_amount": 40000, "previous_alerts": 2, "story": story
        })
    return pd.DataFrame(rows).sort_values("timestamp", ascending=False)

def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id TEXT PRIMARY KEY,
            customer_id TEXT,
            source_account TEXT,
            beneficiary_account TEXT,
            timestamp TEXT,
            amount REAL,
            channel TEXT,
            location TEXT,
            device_id TEXT,
            days_since_last_txn INTEGER,
            account_status TEXT,
            kyc_risk TEXT,
            is_international INTEGER,
            customer_avg_amount REAL,
            previous_alerts INTEGER,
            story TEXT
        );
        CREATE TABLE IF NOT EXISTS cases (
            case_id TEXT PRIMARY KEY,
            transaction_id TEXT,
            result_json TEXT,
            reviewer_decision TEXT,
            reviewer_comment TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT,
            actor TEXT,
            event TEXT,
            timestamp TEXT
        );
    """)
    conn.commit()
    conn.close()

def load_transactions() -> pd.DataFrame:
    init_db()
    if not CSV_PATH.exists():
        df = generate_demo_data()
        df.to_csv(CSV_PATH, index=False)
    return pd.read_csv(CSV_PATH, parse_dates=["timestamp"])

def save_case(case: dict):
    # Convert numpy types before saving
    case = convert_numpy(case)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO cases (case_id, transaction_id, result_json, reviewer_decision, reviewer_comment, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        case["case_id"],
        case["transaction_id"],
        json.dumps(case),
        case.get("reviewer_decision", "Pending"),
        case.get("reviewer_comment", ""),
        case["created_at"],
        datetime.now().isoformat()
    ))
    conn.commit()
    conn.close()
    
def load_cases() -> list:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT result_json FROM cases")
    rows = cur.fetchall()
    conn.close()
    return [json.loads(row[0]) for row in rows]