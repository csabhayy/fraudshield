"""Real-time transaction generator with Indian patterns and fraud injection."""
import random
import time
import threading
import sqlite3
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from faker import Faker

fake = Faker('en_IN')

# ---- Configuration ----
GENERATION_INTERVAL = 2  # seconds between transactions
FRAUD_RATE = 0.05        # 5% fraud probability
BASE_TIME = datetime.now() - timedelta(days=30)

# ---- Customer Profiles (cached) ----
CUSTOMERS = []
ACCOUNTS = []

def load_customers():
    """Load customers from DB; create if empty."""
    global CUSTOMERS, ACCOUNTS
    conn = sqlite3.connect("data/fraudshield.db")
    cur = conn.cursor()
    cur.execute("SELECT customer_id, name, city, state, risk_profile FROM customers")
    rows = cur.fetchall()
    if not rows:
        # Generate fallback customers if DB empty (shouldn't happen)
        from .data_service import generate_customers
        df = generate_customers()
        df.to_sql('customers', conn, if_exists='append', index=False)
        cur.execute("SELECT customer_id, name, city, state, risk_profile FROM customers")
        rows = cur.fetchall()
    CUSTOMERS = [{"id": r[0], "name": r[1], "city": r[2], "state": r[3], "risk": r[4]} for r in rows]
    ACCOUNTS = [f"ACC-{1000+i}" for i in range(len(CUSTOMERS))]
    conn.close()

def get_random_customer():
    return random.choice(CUSTOMERS)

def get_account_for_customer(customer_id):
    idx = [c["id"] for c in CUSTOMERS].index(customer_id)
    return ACCOUNTS[idx]

# ---- Transaction Generation ----
def generate_amount(channel, customer_risk):
    """Generate amount based on channel and customer risk."""
    base = np.random.lognormal(mean=9.0, sigma=0.8)  # typical ~₹8k
    if channel in ["UPI", "Wallets"]:
        base = np.random.lognormal(mean=7.0, sigma=0.6)  # smaller amounts
    elif channel in ["NEFT", "RTGS"]:
        base = np.random.lognormal(mean=11.0, sigma=0.8)  # larger
    # Adjust for risk profile (high risk -> larger amounts)
    if customer_risk == "High":
        base *= 1.5
    return round(base, 2)

def generate_timestamp():
    """Generate a realistic timestamp: daytime hours, weekdays more active."""
    now = datetime.now()
    # Start from now and go back a bit to simulate current time
    # For real-time, we just use now.
    return now

def generate_device():
    """Random device ID; occasionally same device for multiple customers (fraud)."""
    if random.random() < 0.05:  # 5% chance of shared device
        return random.choice(["DEV-777", "DEV-889", "DEV-999"])
    return f"DEV-{random.randint(0, 39):03d}"

def generate_location(city_list):
    return random.choice(city_list)

def generate_previous_alerts():
    # Usually 0–2, but some customers have more
    return random.choices([0, 1, 2, 3], weights=[0.7, 0.2, 0.08, 0.02])[0]

def generate_transaction():
    """Generate a single transaction dict."""
    customer = get_random_customer()
    source_account = get_account_for_customer(customer["id"])
    beneficiary_account = random.choice(ACCOUNTS)
    while beneficiary_account == source_account:
        beneficiary_account = random.choice(ACCOUNTS)
    channels = ["UPI", "Mobile Banking", "Internet Banking", "Branch", "ATM", "NEFT", "RTGS", "Cards", "Wallets"]
    # Weight toward UPI and Mobile Banking (most common in India)
    channel = random.choices(channels, weights=[0.3, 0.2, 0.1, 0.05, 0.05, 0.1, 0.05, 0.1, 0.05])[0]
    amount = generate_amount(channel, customer["risk"])
    location = generate_location(["Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Jaipur"])
    device = generate_device()
    days_since = random.randint(0, 10)
    is_international = random.random() < 0.03
    customer_avg_amount = amount * random.uniform(0.6, 1.5)
    previous_alerts = generate_previous_alerts()
    story = "Normal"

    # ---- Fraud Injection ----
    fraud_type = None
    if random.random() < FRAUD_RATE:
        fraud_choice = random.choice(["spike", "velocity", "dormant", "circular"])
        if fraud_choice == "spike":
            amount *= random.uniform(10, 30)
            story = "Fraudulent spike"
        elif fraud_choice == "velocity":
            # We'll handle velocity via multiple transactions in quick succession
            # We'll set previous_alerts high and amount high
            amount *= 8
            previous_alerts = 2
            story = "Velocity fraud"
        elif fraud_choice == "dormant":
            days_since = random.randint(180, 365)
            amount *= random.uniform(5, 15)
            story = "Dormant activation fraud"
        elif fraud_choice == "circular":
            # We'll ensure the beneficiary is in a circular path later (graph)
            # For now, just mark story
            story = "Circular flow potential"
        # Additional fraud types: location mismatch (use different location from customer's city)
        # We'll handle location mismatch by choosing a location far from customer city
        if random.random() < 0.2:
            # location mismatch
            city_list = ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Jaipur", "Lucknow", "Ahmedabad"]
            # pick a city that is not the customer's typical city (we don't have typical, so just random)
            location = random.choice(city_list)

    return {
        "transaction_id": f"TXN-{int(time.time()*1000)}",  # unique by ms
        "customer_id": customer["id"],
        "source_account": source_account,
        "beneficiary_account": beneficiary_account,
        "timestamp": generate_timestamp().isoformat(),
        "amount": amount,
        "channel": channel,
        "location": location,
        "device_id": device,
        "days_since_last_txn": days_since,
        "account_status": "Active" if days_since < 180 else "Dormant",
        "kyc_risk": customer["risk"],
        "is_international": is_international,
        "customer_avg_amount": customer_avg_amount,
        "previous_alerts": previous_alerts,
        "story": story
    }

# ---- Insertion to DB and Neo4j ----
def insert_transaction(tx):
    """Insert a transaction into SQLite and Neo4j."""
    import sqlite3
    conn = sqlite3.connect("data/fraudshield.db")
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO transactions
        (transaction_id, customer_id, source_account, beneficiary_account,
         timestamp, amount, channel, location, device_id, days_since_last_txn,
         account_status, kyc_risk, is_international, customer_avg_amount,
         previous_alerts, story)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        tx["transaction_id"], tx["customer_id"], tx["source_account"],
        tx["beneficiary_account"], tx["timestamp"], tx["amount"],
        tx["channel"], tx["location"], tx["device_id"],
        tx["days_since_last_txn"], tx["account_status"],
        tx["kyc_risk"], 1 if tx["is_international"] else 0,
        tx["customer_avg_amount"], tx["previous_alerts"], tx["story"]
    ))
    conn.commit()
    conn.close()

    # Also add edge to Neo4j if available
    try:
        from .graph_service import Neo4jClient
        neo = Neo4jClient()
        df = pd.DataFrame([tx])
        neo.bulk_add_edges(df)
        neo.close()
    except Exception as e:
        print(f"Neo4j insertion error: {e}")

# ---- Background Runner ----
def run_generator():
    """Main loop: generate and insert transactions."""
    load_customers()
    while True:
        tx = generate_transaction()
        insert_transaction(tx)
        print(f"Generated: {tx['transaction_id']} | {tx['amount']} | {tx['story']}")
        time.sleep(GENERATION_INTERVAL)

def start_generator():
    """Start the generator in a background thread."""
    thread = threading.Thread(target=run_generator, daemon=True)
    thread.start()
    print("Real-time transaction generator started.")