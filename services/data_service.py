"""Data loading, generation, and SQLite persistence with Indian context."""
import sqlite3
import pandas as pd
import numpy as np
import json
from pathlib import Path
from datetime import datetime, timedelta
import random

try:
    from faker import Faker
    fake = Faker('en_IN')
except ImportError:
    # Fallback if faker not installed (should not happen in Docker)
    class Fake:
        def name(self): return "John Doe"
        def company(self): return "Acme Corp"
        def date_between(self, **kwargs): return datetime.now() - timedelta(days=365)
    fake = Fake()

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DB_PATH = DATA_DIR / "fraudshield.db"
CSV_PATH = DATA_DIR / "transactions.csv"
CUSTOMERS_PATH = DATA_DIR / "customers.csv"
MERCHANTS_PATH = DATA_DIR / "merchants.csv"

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

def generate_customers(n=40, seed=42):
    """Generate Indian customer profiles."""
    rng = np.random.default_rng(seed)
    customers = []
    occupations = ["Software Engineer", "Teacher", "Doctor", "Business Owner",
                   "Accountant", "Government Employee", "Retired", "Student",
                   "Lawyer", "Banker", "Consultant", "Homemaker"]
    cities = ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad",
              "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"]
    states = ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Telangana",
              "West Bengal", "Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh"]
    kyc_statuses = ["Verified", "Pending", "Rejected"]

    for i in range(n):
        customer_id = f"CUS-{2000+i}"
        name = fake.name()
        age = rng.integers(22, 70)
        occupation = rng.choice(occupations)
        city = rng.choice(cities)
        state = states[cities.index(city)]  # simplified mapping
        kyc_status = rng.choice(kyc_statuses, p=[0.8, 0.15, 0.05])
        risk_profile = rng.choice(["Low", "Medium", "High"], p=[0.6, 0.3, 0.1])
        account_open_date = fake.date_between(start_date='-5y', end_date='-30d')
        customers.append({
            "customer_id": customer_id,
            "name": name,
            "age": age,
            "occupation": occupation,
            "city": city,
            "state": state,
            "kyc_status": kyc_status,
            "risk_profile": risk_profile,
            "account_open_date": account_open_date.isoformat()
        })
    return pd.DataFrame(customers)

def generate_merchants(n=20, seed=42):
    """Generate merchant categories."""
    rng = np.random.default_rng(seed)
    categories = ["Retail", "E-commerce", "Food & Dining", "Travel", "Entertainment",
                  "Utilities", "Healthcare", "Education", "Gambling", "Cryptocurrency"]
    risk_levels = ["Low", "Medium", "High"]
    merchants = []
    for i in range(n):
        merchants.append({
            "merchant_id": f"MER-{1000+i}",
            "name": fake.company(),
            "category": rng.choice(categories),
            "risk_level": rng.choice(risk_levels, p=[0.6, 0.3, 0.1])
        })
    return pd.DataFrame(merchants)

def generate_transactions(customers_df, merchants_df=None, n=360, seed=42):
    """Generate transactions with Indian context."""
    rng = np.random.default_rng(seed)
    rows = []
    accounts = [f"ACC-{1000+i}" for i in range(len(customers_df))]
    channels = ["UPI", "IMPS", "NEFT", "RTGS", "Cards", "Wallets"]
    cities = customers_df["city"].unique()
    base = pd.Timestamp("2026-07-01 09:00:00")

    for i in range(n):
        customer = customers_df.iloc[rng.integers(0, len(customers_df))]
        source_account = accounts[rng.integers(0, len(accounts))]
        beneficiary_account = accounts[rng.integers(0, len(accounts))]
        while beneficiary_account == source_account:
            beneficiary_account = accounts[rng.integers(0, len(accounts))]
        amount = float(max(250, rng.lognormal(10.0, .72)))
        rows.append({
            "transaction_id": f"TXN-{10000+i}",
            "customer_id": customer["customer_id"],
            "source_account": source_account,
            "beneficiary_account": beneficiary_account,
            "timestamp": (base + pd.Timedelta(hours=int(rng.integers(0, 650)))).isoformat(),
            "amount": round(amount, 2),
            "channel": rng.choice(channels),
            "location": rng.choice(cities),
            "device_id": f"DEV-{rng.integers(0, 40):03d}",
            "days_since_last_txn": int(rng.integers(0, 18)),
            "account_status": "Active",
            "kyc_risk": customer["risk_profile"],
            "is_international": bool(rng.random() < .04),
            "customer_avg_amount": round(amount * rng.uniform(.65, 1.5), 2),
            "previous_alerts": int(rng.integers(0, 3)),
            "story": "Normal"
        })
    # Add critical fraud chain
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
        if cid not in customers_df["customer_id"].values:
            continue
        rows.append({
            "transaction_id": tid,
            "customer_id": cid,
            "source_account": src,
            "beneficiary_account": dst,
            "timestamp": pd.Timestamp(ts).isoformat(),
            "amount": amt,
            "channel": "Mobile Banking",
            "location": "Delhi",
            "device_id": dev,
            "days_since_last_txn": 286 if tid=="TXN-CRIT-001" else 0,
            "account_status": "Dormant" if tid=="TXN-CRIT-001" else "Active",
            "kyc_risk": "High",
            "is_international": False,
            "customer_avg_amount": 40000,
            "previous_alerts": 2,
            "story": story
        })
    return pd.DataFrame(rows)

def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            customer_id TEXT PRIMARY KEY,
            name TEXT,
            age INTEGER,
            occupation TEXT,
            city TEXT,
            state TEXT,
            kyc_status TEXT,
            risk_profile TEXT,
            account_open_date TEXT
        );
        CREATE TABLE IF NOT EXISTS merchants (
            merchant_id TEXT PRIMARY KEY,
            name TEXT,
            category TEXT,
            risk_level TEXT
        );
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
            story TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
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
        # Generate customers and merchants first
        customers_df = generate_customers()
        customers_df.to_csv(CUSTOMERS_PATH, index=False)
        merchants_df = generate_merchants()
        merchants_df.to_csv(MERCHANTS_PATH, index=False)
        # Generate transactions
        df = generate_transactions(customers_df)
        df.to_csv(CSV_PATH, index=False)
        # Insert into SQLite
        conn = sqlite3.connect(DB_PATH)
        customers_df.to_sql('customers', conn, if_exists='replace', index=False)
        merchants_df.to_sql('merchants', conn, if_exists='replace', index=False)
        df.to_sql('transactions', conn, if_exists='replace', index=False)
        conn.close()
    return pd.read_csv(CSV_PATH, parse_dates=["timestamp"])

def get_customer(customer_id: str) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT * FROM customers WHERE customer_id = ?", (customer_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        cols = [desc[0] for desc in cur.description]
        return dict(zip(cols, row))
    return None

def save_case(case: dict):
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