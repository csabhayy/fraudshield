"""Pydantic schemas for API and internal use."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class GraphEdge(BaseModel):
    from_: str = Field(..., alias="from")
    to: str
    amount: float

    class Config:
        allow_population_by_field_name = True

class GraphResult(BaseModel):
    cycles: List[List[str]]
    neighbors: List[str]
    evidence: List[str]
    edges: List[GraphEdge]

class InvestigationResult(BaseModel):
    """Investigation case result with outcomes and financial tracking."""
    case_id: str
    transaction_id: str
    customer_id: str
    masked_account: str
    amount: float
    risk_score: int
    risk_level: str
    rule_score: int
    anomaly_score: int
    network_score: int = 0
    customer_risk_score: int = 0
    reasons: List[Dict[str, Any]]
    graph: GraphResult
    recommendation: str
    status: str
    reviewer_decision: str = "Pending"
    reviewer_comment: str = ""
    created_at: str
    audit: List[Dict[str, Any]]
    similar_cases: Optional[List[Dict]] = None
    
    # Ground-truth fraud outcome (not risk prediction)
    # Values: UNKNOWN, LEGITIMATE, CONFIRMED_FRAUD
    outcome: str = "UNKNOWN"
    
    # Decision made on the transaction
    # Values: ALLOW, REVIEW, CHALLENGE, BLOCK
    decision: str = "ALLOW"
    
    # Whether the transaction completed (true = completed, false = prevented)
    transactionCompleted: bool = True
    
    # Financial outcome fields
    # Only populated when confirmed fraud with financial data available
    actualLossAmount: Optional[float] = None  # Actual financial loss incurred
    recoveredAmount: Optional[float] = None  # Amount recovered through chargeback/refund
    preventedAmount: Optional[float] = None  # Amount prevented from being lost (BLOCK/CHALLENGE decision)
    
    # Metadata for metrics calculation
    wasDetected: bool = False  # Was fraud detected by system before confirmation
    detectionTimestamp: Optional[str] = None  # When fraud was detected
    outcomeConfirmedTimestamp: Optional[str] = None  # When outcome was confirmed