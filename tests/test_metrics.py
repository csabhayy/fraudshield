"""
Test suite for business metrics calculations.

These deterministic test cases validate that metrics are calculated correctly
from transaction and case data, without hardcoded or mocked values.
"""

import pytest
import sqlite3
import json
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

from services.metrics_service import (
    MetricsService,
    TransactionOutcome,
    TransactionDecision,
)


@pytest.fixture
def test_db():
    """Create an in-memory database for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = str(Path(tmpdir) / "test.db")
        conn = sqlite3.connect(db_path)
        
        # Create tables
        conn.executescript("""
            CREATE TABLE transactions (
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
            CREATE TABLE cases (
                case_id TEXT PRIMARY KEY,
                transaction_id TEXT,
                result_json TEXT,
                reviewer_decision TEXT,
                reviewer_comment TEXT,
                created_at TEXT,
                updated_at TEXT
            );
        """)
        conn.commit()
        conn.close()
        
        yield db_path


@pytest.fixture
def metrics_service(test_db):
    """Create a metrics service with test database."""
    return MetricsService(test_db)


class TestMoneyAtRisk:
    """Test Money at Risk calculations."""
    
    def test_no_at_risk_transactions(self, metrics_service, test_db):
        """When all transactions are safe, money at risk is zero."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert a normal transaction
        cur.execute("""
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "TXN-001", "CUS-001", "ACC-001", "ACC-002",
            datetime.now().isoformat(), 5000.0, "UPI", "Delhi",
            "DEV-001", 5, "Active", "Low", 0, 10000.0, 0, "Normal"
        ))
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_money_at_risk()
        
        assert result["available"] is True
        assert result["value"] == 0
        assert result["transactionCount"] == 0
    
    def test_high_risk_flagged_transaction_included(self, metrics_service, test_db):
        """High-risk transactions flagged but not investigated should be at risk."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert a high-risk flagged transaction (amount > 3x baseline)
        cur.execute("""
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "TXN-RISKY", "CUS-002", "ACC-001", "ACC-002",
            datetime.now().isoformat(), 35000.0, "UPI", "Delhi",
            "DEV-001", 5, "Active", "Low", 0, 10000.0, 0, "Unusual Amount"
        ))
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_money_at_risk()
        
        assert result["available"] is True
        assert result["value"] == 35000.0
        assert result["transactionCount"] == 1
    
    def test_open_investigation_at_risk(self, metrics_service, test_db):
        """Transactions with open investigations awaiting human decision are at risk."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert transaction
        cur.execute("""
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "TXN-OPEN", "CUS-003", "ACC-001", "ACC-002",
            datetime.now().isoformat(), 50000.0, "UPI", "Delhi",
            "DEV-001", 5, "Active", "High", 0, 10000.0, 0, "Unusual"
        ))
        
        # Insert open investigation
        case_data = {
            "case_id": "FS-TXN-OPEN",
            "transaction_id": "TXN-OPEN",
            "status": "Awaiting Human Review",
            "amount": 50000.0,
        }
        cur.execute("""
            INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "FS-TXN-OPEN", "TXN-OPEN", json.dumps(case_data),
            "Pending", "", datetime.now().isoformat(), datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_money_at_risk()
        
        assert result["available"] is True
        assert result["value"] == 50000.0
        assert result["transactionCount"] == 1


class TestFraudPrevented:
    """Test Fraud Prevented calculations."""
    
    def test_no_confirmed_fraud_unavailable(self, metrics_service, test_db):
        """When no confirmed fraud exists, metric is unavailable."""
        result = metrics_service.calculate_fraud_prevented()
        
        assert result["available"] is False
        assert "reason" in result
    
    def test_blocked_confirmed_fraud_counted(self, metrics_service, test_db):
        """Blocked transactions confirmed as fraud should be counted."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert transaction
        cur.execute("""
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "TXN-FRAUD-BLOCK", "CUS-004", "ACC-001", "ACC-002",
            datetime.now().isoformat(), 10000.0, "UPI", "Delhi",
            "DEV-001", 5, "Active", "High", 0, 5000.0, 2, "Fraud"
        ))
        
        # Insert case with confirmed fraud and blocked decision
        case_data = {
            "case_id": "FS-TXN-FRAUD-BLOCK",
            "transaction_id": "TXN-FRAUD-BLOCK",
            "status": "Fraud Confirmed",
            "outcome": TransactionOutcome.CONFIRMED_FRAUD,
            "decision": TransactionDecision.BLOCK,
            "transactionCompleted": "false",
            "amount": 10000.0,
            "preventedAmount": 10000.0,
        }
        cur.execute("""
            INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "FS-TXN-FRAUD-BLOCK", "TXN-FRAUD-BLOCK", json.dumps(case_data),
            "Confirmed Fraud", "Blocked fraudulent transaction", 
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_fraud_prevented()
        
        assert result["available"] is True
        assert result["value"] == 10000.0
        assert result["transactionCount"] == 1
    
    def test_allowed_confirmed_fraud_not_counted(self, metrics_service, test_db):
        """Allowed transactions confirmed as fraud should NOT be in prevented amount."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert transaction
        cur.execute("""
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "TXN-FRAUD-ALLOW", "CUS-005", "ACC-001", "ACC-002",
            datetime.now().isoformat(), 20000.0, "UPI", "Delhi",
            "DEV-001", 5, "Active", "High", 0, 5000.0, 1, "Fraud"
        ))
        
        # Insert case with confirmed fraud but allowed decision
        case_data = {
            "case_id": "FS-TXN-FRAUD-ALLOW",
            "transaction_id": "TXN-FRAUD-ALLOW",
            "status": "Fraud Confirmed",
            "outcome": TransactionOutcome.CONFIRMED_FRAUD,
            "decision": TransactionDecision.ALLOW,
            "transactionCompleted": "true",
            "amount": 20000.0,
        }
        cur.execute("""
            INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "FS-TXN-FRAUD-ALLOW", "TXN-FRAUD-ALLOW", json.dumps(case_data),
            "Fraud Confirmed", "Fraudulent but allowed", 
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_fraud_prevented()
        
        # Should not count ALLOW decision fraud
        assert result["available"] is False or result["value"] == 0


class TestFraudLoss:
    """Test Fraud Loss calculations."""
    
    def test_no_confirmed_fraud_loss_unavailable(self, metrics_service, test_db):
        """When no confirmed fraud with loss data exists, metric is unavailable."""
        result = metrics_service.calculate_fraud_loss()
        
        assert result["available"] is False
        assert "reason" in result
    
    def test_net_loss_calculation(self, metrics_service, test_db):
        """Net loss should be calculated as actual loss - recovered."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert transaction
        cur.execute("""
            INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "TXN-LOSS", "CUS-006", "ACC-001", "ACC-002",
            datetime.now().isoformat(), 30000.0, "UPI", "Delhi",
            "DEV-001", 5, "Active", "High", 0, 10000.0, 2, "Fraud"
        ))
        
        # Insert case with actual loss and recovery
        case_data = {
            "case_id": "FS-TXN-LOSS",
            "transaction_id": "TXN-LOSS",
            "status": "Fraud Confirmed",
            "outcome": TransactionOutcome.CONFIRMED_FRAUD,
            "transactionCompleted": "true",
            "amount": 30000.0,
            "actualLossAmount": 30000.0,
            "recoveredAmount": 5000.0,
        }
        cur.execute("""
            INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "FS-TXN-LOSS", "TXN-LOSS", json.dumps(case_data),
            "Fraud Confirmed", "Net loss: 25000",
            datetime.now().isoformat(), datetime.now().isoformat()
        ))
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_fraud_loss()
        
        assert result["available"] is True
        # Net loss = 30000 - 5000 = 25000
        assert result["value"] == 25000.0
        assert result["transactionCount"] == 1


class TestDetectionRate:
    """Test Detection Rate calculations."""
    
    def test_no_confirmed_fraud_unavailable(self, metrics_service, test_db):
        """When no confirmed fraud exists, detection rate is unavailable."""
        result = metrics_service.calculate_detection_rate()
        
        assert result["available"] is False
        assert "reason" in result
    
    def test_detection_rate_calculation(self, metrics_service, test_db):
        """Detection rate = detected / total confirmed fraud."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert 10 transactions
        for i in range(10):
            cur.execute("""
                INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"TXN-DETECT-{i:02d}", "CUS-007", "ACC-001", "ACC-002",
                datetime.now().isoformat(), 5000.0 * i, "UPI", "Delhi",
                "DEV-001", 5, "Active", "High", 0, 2000.0, 1, "Fraud"
            ))
        
        # First 8 are detected fraud
        for i in range(8):
            case_data = {
                "case_id": f"FS-TXN-DETECT-{i:02d}",
                "outcome": TransactionOutcome.CONFIRMED_FRAUD,
                "wasDetected": "true",
            }
            cur.execute("""
                INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                f"FS-TXN-DETECT-{i:02d}", f"TXN-DETECT-{i:02d}", json.dumps(case_data),
                "Fraud Confirmed", "",
                datetime.now().isoformat(), datetime.now().isoformat()
            ))
        
        # Last 2 are undetected fraud
        for i in range(8, 10):
            case_data = {
                "case_id": f"FS-TXN-DETECT-{i:02d}",
                "outcome": TransactionOutcome.CONFIRMED_FRAUD,
                "wasDetected": "false",
            }
            cur.execute("""
                INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                f"FS-TXN-DETECT-{i:02d}", f"TXN-DETECT-{i:02d}", json.dumps(case_data),
                "Fraud Confirmed", "",
                datetime.now().isoformat(), datetime.now().isoformat()
            ))
        
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_detection_rate()
        
        assert result["available"] is True
        # 8 detected / 10 confirmed = 0.8 = 80%
        assert result["detectedFraudCount"] == 8
        assert result["confirmedFraudCount"] == 10
        assert result["rate"] == pytest.approx(0.8, abs=0.01)


class TestReviewQueue:
    """Test Review Queue calculations."""
    
    def test_empty_review_queue(self, metrics_service, test_db):
        """When no cases awaiting review, queue count is zero."""
        result = metrics_service.calculate_review_queue()
        
        assert result["available"] is True
        assert result["count"] == 0
    
    def test_review_queue_count(self, metrics_service, test_db):
        """Count cases awaiting human review."""
        conn = sqlite3.connect(test_db)
        cur = conn.cursor()
        
        # Insert 5 cases awaiting review
        for i in range(5):
            case_data = {
                "case_id": f"FS-REVIEW-{i:02d}",
                "status": "Awaiting Human Review",
            }
            cur.execute("""
                INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                f"FS-REVIEW-{i:02d}", f"TXN-REVIEW-{i:02d}", json.dumps(case_data),
                "Pending", "",
                datetime.now().isoformat(), datetime.now().isoformat()
            ))
        
        # Insert 3 closed cases
        for i in range(5, 8):
            case_data = {
                "case_id": f"FS-REVIEW-{i:02d}",
                "status": "Closed - Low Risk",
            }
            cur.execute("""
                INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                f"FS-REVIEW-{i:02d}", f"TXN-REVIEW-{i:02d}", json.dumps(case_data),
                "Closed", "",
                datetime.now().isoformat(), datetime.now().isoformat()
            ))
        
        conn.commit()
        conn.close()
        
        result = metrics_service.calculate_review_queue()
        
        assert result["available"] is True
        assert result["count"] == 5


class TestMetricProvenance:
    """Test that metrics include proper provenance metadata."""
    
    def test_money_at_risk_includes_metadata(self, metrics_service):
        """Money at Risk should include calculation metadata."""
        result = metrics_service.calculate_money_at_risk()
        
        assert "definition" in result
        assert "dataSource" in result
        assert "calculationWindow" in result
        assert "lastUpdated" in result
        assert "underlyingRecords" in result
    
    def test_fraud_prevented_includes_metadata(self, metrics_service):
        """Fraud Prevented should include calculation metadata."""
        result = metrics_service.calculate_fraud_prevented()
        
        assert "definition" in result
        assert "dataSource" in result
        assert "calculationWindow" in result
        assert "lastUpdated" in result
    
    def test_detection_rate_includes_metadata(self, metrics_service):
        """Detection Rate should include calculation metadata."""
        result = metrics_service.calculate_detection_rate()
        
        assert "definition" in result
        assert "dataSource" in result
        assert "calculationWindow" in result
        assert "lastUpdated" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
