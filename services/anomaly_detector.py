"""Isolation Forest anomaly scoring."""
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict

def compute_anomaly_scores(all_tx: pd.DataFrame) -> Dict[str, int]:
    if all_tx.empty:
        return {}
    x = pd.DataFrame({
        "log_amount": np.log1p(all_tx["amount"].astype(float)),
        "ratio": all_tx["amount"].astype(float) / all_tx["customer_avg_amount"].astype(float).clip(lower=1),
        "inactivity": all_tx["days_since_last_txn"].astype(float),
        "alerts": all_tx["previous_alerts"].astype(float),
        "intl": all_tx["is_international"].astype(int)
    })
    model = IsolationForest(n_estimators=160, contamination=0.06, random_state=42)
    model.fit(x)
    raw = -model.score_samples(x)
    norm = 100 * (raw - raw.min()) / (raw.max() - raw.min() + 1e-9)
    return dict(zip(all_tx["transaction_id"], norm.round().astype(int)))