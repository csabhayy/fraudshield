"""
Business metrics aggregation service for FraudShield.

This service calculates transparent, data-driven business metrics:
- Money at Risk: Sum of unresolved transactions requiring intervention
- Fraud Prevented: Blocked transactions later confirmed fraudulent
- Fraud Loss: Completed transactions confirmed fraudulent with financial loss
- Detection Rate: Detected fraud / Total confirmed fraud
- Review Queue: Investigations awaiting human decision

All metrics include provenance metadata explaining:
- What is included/excluded
- Calculation period
- Data source
- Number of records contributing
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DB_PATH = DATA_DIR / "fraudshield.db"

# Outcome classification (ground truth, not prediction)
class TransactionOutcome:
    """Ground truth fraud outcome for a transaction."""
    UNKNOWN = "UNKNOWN"  # No outcome determined yet
    LEGITIMATE = "LEGITIMATE"  # Confirmed not fraudulent
    CONFIRMED_FRAUD = "CONFIRMED_FRAUD"  # Confirmed fraudulent


class TransactionDecision:
    """Decision made on a transaction."""
    ALLOW = "ALLOW"  # Transaction allowed to complete
    REVIEW = "REVIEW"  # Flagged for review (challenge/hold)
    CHALLENGE = "CHALLENGE"  # Challenged/held for verification
    BLOCK = "BLOCK"  # Blocked/prevented from completion


class MetricsResponse:
    """Standard response structure for all metrics."""
    
    @staticmethod
    def money_at_risk(value: float, currency: str, transaction_count: int, 
                     underlying_records: List[Dict], definition: str) -> Dict[str, Any]:
        return {
            "available": True,
            "value": value,
            "currency": currency,
            "transactionCount": transaction_count,
            "definition": definition,
            "dataSource": "transactions + cases (reviews requiring intervention)",
            "calculationWindow": "Current pending state",
            "lastUpdated": datetime.now().isoformat(),
            "underlyingRecords": underlying_records,
        }
    
    @staticmethod
    def fraud_prevented(value: float, currency: str, transaction_count: int,
                       underlying_records: List[Dict], definition: str) -> Dict[str, Any]:
        return {
            "available": True,
            "value": value,
            "currency": currency,
            "transactionCount": transaction_count,
            "definition": definition,
            "dataSource": "cases with decision=BLOCK and outcome=CONFIRMED_FRAUD",
            "calculationWindow": "All confirmed outcomes",
            "lastUpdated": datetime.now().isoformat(),
            "underlyingRecords": underlying_records,
        }
    
    @staticmethod
    def fraud_prevented_unavailable(reason: str) -> Dict[str, Any]:
        return {
            "available": False,
            "reason": reason,
            "definition": "Transaction amount where decision was BLOCK/CHALLENGE and fraud was confirmed before completion",
            "dataSource": "cases",
            "calculationWindow": "All confirmed outcomes",
            "lastUpdated": datetime.now().isoformat(),
        }
    
    @staticmethod
    def fraud_loss(value: float, currency: str, transaction_count: int,
                  underlying_records: List[Dict], definition: str) -> Dict[str, Any]:
        return {
            "available": True,
            "value": value,
            "currency": currency,
            "transactionCount": transaction_count,
            "definition": definition,
            "dataSource": "cases with outcome=CONFIRMED_FRAUD and financial loss data",
            "calculationWindow": "All confirmed fraud with losses",
            "lastUpdated": datetime.now().isoformat(),
            "underlyingRecords": underlying_records,
        }
    
    @staticmethod
    def fraud_loss_unavailable(reason: str) -> Dict[str, Any]:
        return {
            "available": False,
            "reason": reason,
            "definition": "Net loss (actual loss - recovered) for completed fraudulent transactions",
            "dataSource": "cases",
            "calculationWindow": "All confirmed fraud",
            "lastUpdated": datetime.now().isoformat(),
        }
    
    @staticmethod
    def detection_rate(rate: float, detected_count: int, confirmed_count: int,
                      definition: str) -> Dict[str, Any]:
        return {
            "available": True,
            "rate": rate,  # 0.0 to 1.0
            "ratePercentage": rate * 100,
            "detectedFraudCount": detected_count,
            "confirmedFraudCount": confirmed_count,
            "definition": definition,
            "dataSource": "cases with alerts + confirmed fraud outcomes",
            "calculationWindow": "All confirmed fraud",
            "lastUpdated": datetime.now().isoformat(),
        }
    
    @staticmethod
    def detection_rate_unavailable(reason: str) -> Dict[str, Any]:
        return {
            "available": False,
            "reason": reason,
            "definition": "Detected confirmed fraud / Total confirmed fraud",
            "dataSource": "cases",
            "calculationWindow": "All confirmed fraud",
            "lastUpdated": datetime.now().isoformat(),
        }
    
    @staticmethod
    def review_queue(count: int, definition: str) -> Dict[str, Any]:
        return {
            "available": True,
            "count": count,
            "definition": definition,
            "dataSource": "cases with status='Awaiting Human Review'",
            "calculationWindow": "Current pending state",
            "lastUpdated": datetime.now().isoformat(),
        }


class MetricsService:
    """Core metrics calculation engine."""
    
    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
    
    def get_connection(self):
        return sqlite3.connect(self.db_path)
    
    def calculate_money_at_risk(self) -> Dict[str, Any]:
        """
        Money at Risk = Sum of transaction amounts that are currently unresolved
        and require intervention/review.
        
        Includes:
        - Transactions flagged by rule engine but not investigated
        - Open investigations awaiting human decision
        - Transactions blocked/challenged but not confirmed as fraud
        
        Excludes:
        - Completed and decided transactions (regardless of decision)
        - Transactions confirmed as legitimate
        """
        conn = self.get_connection()
        cur = conn.cursor()
        
        # Sum amounts for transactions with open/pending investigations
        # A transaction is "at risk" if:
        # 1. It has an investigation case in "Awaiting Human Review" status, OR
        # 2. It's flagged as high-risk but hasn't been investigated yet
        
        query = """
        SELECT
            COALESCE(SUM(t.amount), 0) as total_amount,
            COUNT(DISTINCT t.transaction_id) as tx_count
        FROM transactions t
        LEFT JOIN cases c ON t.transaction_id = c.transaction_id
        WHERE 
            -- High risk transaction flagged but not investigated
            (c.case_id IS NULL AND 
             (t.amount > 3 * t.customer_avg_amount OR 
              t.previous_alerts >= 2 OR 
              t.days_since_last_txn >= 180))
            OR
            -- Open investigation awaiting decision
            (c.case_id IS NOT NULL AND 
             json_extract(c.result_json, '$.status') = 'Awaiting Human Review')
        """
        
        cur.execute(query)
        result = cur.fetchone()
        
        # Get detailed records for transparency
        details_query = """
        SELECT
            t.transaction_id,
            t.customer_id,
            t.amount,
            t.channel,
            COALESCE(json_extract(c.result_json, '$.status'), 'Flagged - Not Investigated') as status
        FROM transactions t
        LEFT JOIN cases c ON t.transaction_id = c.transaction_id
        WHERE 
            (c.case_id IS NULL AND 
             (t.amount > 3 * t.customer_avg_amount OR 
              t.previous_alerts >= 2 OR 
              t.days_since_last_txn >= 180))
            OR
            (c.case_id IS NOT NULL AND 
             json_extract(c.result_json, '$.status') = 'Awaiting Human Review')
        ORDER BY t.amount DESC
        LIMIT 100
        """
        
        cur.execute(details_query)
        underlying = [
            {
                "transaction_id": row[0],
                "customer_id": row[1],
                "amount": row[2],
                "channel": row[3],
                "status": row[4],
            }
            for row in cur.fetchall()
        ]
        
        conn.close()
        
        total_amount = result[0] if result else 0
        tx_count = result[1] if result else 0
        
        return MetricsResponse.money_at_risk(
            value=round(total_amount, 2),
            currency="INR",
            transaction_count=tx_count,
            underlying_records=underlying,
            definition="Sum of transaction amounts that are unresolved and require intervention/review"
        )
    
    def calculate_fraud_prevented(self) -> Dict[str, Any]:
        """
        Fraud Prevented = Sum of amounts for transactions where:
        1. Decision was BLOCK or CHALLENGE (transaction was prevented/held)
        2. Fraud was confirmed (outcome = CONFIRMED_FRAUD)
        3. Transaction did not complete (prevented from full execution)
        
        Important: Do NOT include blocked amount that wasn't confirmed fraud.
        Do NOT substitute risk scores for confirmed outcomes.
        
        If no confirmed fraud outcomes exist, return unavailable.
        """
        conn = self.get_connection()
        cur = conn.cursor()
        
        # Check if we have any confirmed fraud outcomes
        check_query = "SELECT COUNT(*) FROM cases WHERE json_extract(result_json, '$.outcome') = ?"
        cur.execute(check_query, (TransactionOutcome.CONFIRMED_FRAUD,))
        confirmed_count = cur.fetchone()[0]
        
        if confirmed_count == 0:
            conn.close()
            return MetricsResponse.fraud_prevented_unavailable(
                "No confirmed fraud outcomes recorded yet"
            )
        
        # Find prevented fraud (blocked/challenged AND confirmed)
        query = """
        SELECT
            COALESCE(SUM(t.amount), 0) as total_prevented,
            COUNT(DISTINCT t.transaction_id) as tx_count
        FROM transactions t
        JOIN cases c ON t.transaction_id = c.transaction_id
        WHERE
            json_extract(c.result_json, '$.outcome') = ?
            AND json_extract(c.result_json, '$.decision') IN (?, ?)
            AND json_extract(c.result_json, '$.transactionCompleted') = 'false'
        """
        
        cur.execute(query, (
            TransactionOutcome.CONFIRMED_FRAUD,
            TransactionDecision.BLOCK,
            TransactionDecision.CHALLENGE
        ))
        
        result = cur.fetchone()
        
        # Get details
        details_query = """
        SELECT
            t.transaction_id,
            t.customer_id,
            t.amount,
            json_extract(c.result_json, '$.decision') as decision,
            json_extract(c.result_json, '$.preventedAmount') as prevented_amount
        FROM transactions t
        JOIN cases c ON t.transaction_id = c.transaction_id
        WHERE
            json_extract(c.result_json, '$.outcome') = ?
            AND json_extract(c.result_json, '$.decision') IN (?, ?)
            AND json_extract(c.result_json, '$.transactionCompleted') = 'false'
        ORDER BY t.amount DESC
        LIMIT 100
        """
        
        cur.execute(details_query, (
            TransactionOutcome.CONFIRMED_FRAUD,
            TransactionDecision.BLOCK,
            TransactionDecision.CHALLENGE
        ))
        
        underlying = [
            {
                "transaction_id": row[0],
                "customer_id": row[1],
                "transactionAmount": row[2],
                "decision": row[3],
                "preventedAmount": row[4],
            }
            for row in cur.fetchall()
        ]
        
        conn.close()
        
        total_prevented = result[0] if result else 0
        tx_count = result[1] if result else 0
        
        if tx_count == 0:
            return MetricsResponse.fraud_prevented_unavailable(
                "No blocked/challenged transactions confirmed as fraudulent yet"
            )
        
        return MetricsResponse.fraud_prevented(
            value=round(total_prevented, 2),
            currency="INR",
            transaction_count=tx_count,
            underlying_records=underlying,
            definition="Sum of amounts for transactions blocked/challenged and confirmed fraudulent"
        )
    
    def calculate_fraud_loss(self) -> Dict[str, Any]:
        """
        Fraud Loss = Sum of net losses from confirmed fraud transactions.
        
        Net Loss = Actual Loss Amount - Recovered Amount
        
        Only include:
        - Transactions completed (status != blocked)
        - Fraud confirmed (outcome = CONFIRMED_FRAUD)
        - Financial loss data available (not estimated from risk score)
        
        If actual loss data unavailable, return unavailable.
        """
        conn = self.get_connection()
        cur = conn.cursor()
        
        # Check if we have fraud outcomes with financial loss data
        check_query = """
        SELECT COUNT(*) FROM cases 
        WHERE json_extract(result_json, '$.outcome') = ?
        AND json_extract(result_json, '$.actualLossAmount') IS NOT NULL
        """
        cur.execute(check_query, (TransactionOutcome.CONFIRMED_FRAUD,))
        count_with_loss = cur.fetchone()[0]
        
        if count_with_loss == 0:
            conn.close()
            return MetricsResponse.fraud_loss_unavailable(
                "No confirmed fraud cases with financial loss data yet"
            )
        
        # Calculate net loss
        query = """
        SELECT
            COALESCE(SUM(
                COALESCE(json_extract(c.result_json, '$.actualLossAmount'), 0) -
                COALESCE(json_extract(c.result_json, '$.recoveredAmount'), 0)
            ), 0) as total_loss,
            COUNT(DISTINCT t.transaction_id) as tx_count
        FROM transactions t
        JOIN cases c ON t.transaction_id = c.transaction_id
        WHERE
            json_extract(c.result_json, '$.outcome') = ?
            AND json_extract(c.result_json, '$.transactionCompleted') = 'true'
            AND json_extract(c.result_json, '$.actualLossAmount') IS NOT NULL
        """
        
        cur.execute(query, (TransactionOutcome.CONFIRMED_FRAUD,))
        result = cur.fetchone()
        
        # Get details
        details_query = """
        SELECT
            t.transaction_id,
            t.customer_id,
            t.amount,
            json_extract(c.result_json, '$.actualLossAmount') as actual_loss,
            json_extract(c.result_json, '$.recoveredAmount') as recovered,
            json_extract(c.result_json, '$.actualLossAmount') - 
            COALESCE(json_extract(c.result_json, '$.recoveredAmount'), 0) as net_loss
        FROM transactions t
        JOIN cases c ON t.transaction_id = c.transaction_id
        WHERE
            json_extract(c.result_json, '$.outcome') = ?
            AND json_extract(c.result_json, '$.transactionCompleted') = 'true'
            AND json_extract(c.result_json, '$.actualLossAmount') IS NOT NULL
        ORDER BY t.amount DESC
        LIMIT 100
        """
        
        cur.execute(details_query, (TransactionOutcome.CONFIRMED_FRAUD,))
        
        underlying = [
            {
                "transaction_id": row[0],
                "customer_id": row[1],
                "transactionAmount": row[2],
                "actualLossAmount": row[3],
                "recoveredAmount": row[4],
                "netLoss": row[5],
            }
            for row in cur.fetchall()
        ]
        
        conn.close()
        
        total_loss = result[0] if result else 0
        tx_count = result[1] if result else 0
        
        if total_loss == 0 and tx_count == 0:
            return MetricsResponse.fraud_loss_unavailable(
                "No confirmed fraud with financial loss data available"
            )
        
        return MetricsResponse.fraud_loss(
            value=round(max(0, total_loss), 2),
            currency="INR",
            transaction_count=tx_count,
            underlying_records=underlying,
            definition="Sum of net losses (actual loss - recovered) for completed fraudulent transactions"
        )
    
    def calculate_detection_rate(self) -> Dict[str, Any]:
        """
        Detection Rate = Confirmed fraud transactions detected / Total confirmed fraud transactions
        
        A transaction is "detected" if:
        - The system generated a risk alert/flag BEFORE the fraud outcome was confirmed
        - AND fraud was later confirmed
        
        Does NOT use:
        - Risk score alone
        - Alert count without confirmed outcome
        - Predictions
        
        Returns ground-truth metric based on actual confirmed outcomes.
        """
        conn = self.get_connection()
        cur = conn.cursor()
        
        # Count all confirmed fraud transactions
        confirmed_query = """
        SELECT COUNT(DISTINCT c.transaction_id)
        FROM cases c
        WHERE json_extract(c.result_json, '$.outcome') = ?
        """
        cur.execute(confirmed_query, (TransactionOutcome.CONFIRMED_FRAUD,))
        total_confirmed = cur.fetchone()[0]
        
        if total_confirmed == 0:
            conn.close()
            return MetricsResponse.detection_rate_unavailable(
                "No confirmed fraud outcomes to calculate detection rate"
            )
        
        # Count confirmed fraud that was detected (had risk flag before confirmation)
        # A transaction is detected if it has a case record (was flagged and investigated)
        detected_query = """
        SELECT COUNT(DISTINCT c.transaction_id)
        FROM cases c
        WHERE json_extract(c.result_json, '$.outcome') = ?
        AND json_extract(c.result_json, '$.wasDetected') = 'true'
        """
        cur.execute(detected_query, (TransactionOutcome.CONFIRMED_FRAUD,))
        detected_count = cur.fetchone()[0]
        
        conn.close()
        
        # If no confirmed fraud, can't calculate rate
        if total_confirmed == 0:
            return MetricsResponse.detection_rate_unavailable(
                "No confirmed fraud transactions to establish detection rate"
            )
        
        detection_rate = detected_count / total_confirmed if total_confirmed > 0 else 0
        
        return MetricsResponse.detection_rate(
            rate=round(detection_rate, 4),
            detected_count=detected_count,
            confirmed_count=total_confirmed,
            definition="Detected confirmed fraud transactions / Total confirmed fraud transactions"
        )
    
    def calculate_review_queue(self) -> Dict[str, Any]:
        """
        Review Queue = Count of investigations currently awaiting human decision.
        
        Excludes:
        - Completed investigations
        - Closed cases
        - In-progress automated analysis
        """
        conn = self.get_connection()
        cur = conn.cursor()
        
        query = """
        SELECT COUNT(DISTINCT c.case_id)
        FROM cases c
        WHERE json_extract(c.result_json, '$.status') = 'Awaiting Human Review'
        """
        
        cur.execute(query)
        count = cur.fetchone()[0]
        
        conn.close()
        
        return MetricsResponse.review_queue(
            count=count,
            definition="Number of investigations awaiting human decision"
        )
    
    def get_all_business_metrics(self) -> Dict[str, Any]:
        """Get all business metrics in one call."""
        return {
            "timestamp": datetime.now().isoformat(),
            "moneyAtRisk": self.calculate_money_at_risk(),
            "fraudPrevented": self.calculate_fraud_prevented(),
            "fraudLoss": self.calculate_fraud_loss(),
            "detectionRate": self.calculate_detection_rate(),
            "reviewQueue": self.calculate_review_queue(),
        }


# Singleton instance for use throughout the application
_metrics_service = None

def get_metrics_service(db_path: str = str(DB_PATH)) -> MetricsService:
    """Get or create the metrics service singleton."""
    global _metrics_service
    if _metrics_service is None:
        _metrics_service = MetricsService(db_path)
    return _metrics_service
