# Business Metrics Implementation - Audit & Changes

## Summary

FraudShield's Overview dashboard now displays real, traceable, data-driven business metrics instead of hardcoded, mocked, or randomly generated values.

## Implementation Details

### 1. Backend Changes

#### New Metrics Service (`services/metrics_service.py`)
- Created centralized metrics aggregation engine
- Implements TransactionOutcome enum (UNKNOWN, LEGITIMATE, CONFIRMED_FRAUD)
- Implements TransactionDecision enum (ALLOW, REVIEW, CHALLENGE, BLOCK)
- All metrics include full provenance metadata

#### API Endpoints
Added new endpoints for business metrics:
- `GET /metrics/money-at-risk` - Unresolved transactions requiring intervention
- `GET /metrics/fraud-prevented` - Blocked transactions confirmed as fraudulent
- `GET /metrics/fraud-loss` - Net financial loss from confirmed fraud
- `GET /metrics/detection-rate` - Detected confirmed fraud / Total confirmed fraud
- `GET /metrics/review-queue` - Investigations awaiting human decision
- `GET /metrics/all` - All metrics in one call

#### Enhanced Case Schema (`models/schemas.py`)
Added outcome and financial fields to InvestigationResult:
- `outcome` - Ground-truth fraud status (UNKNOWN, LEGITIMATE, CONFIRMED_FRAUD)
- `decision` - Transaction decision (ALLOW, REVIEW, CHALLENGE, BLOCK)
- `transactionCompleted` - Whether transaction completed
- `actualLossAmount` - Financial loss amount
- `recoveredAmount` - Amount recovered
- `preventedAmount` - Amount prevented from loss
- `wasDetected` - System detection status
- `detectionTimestamp` - When detected
- `outcomeConfirmedTimestamp` - When outcome confirmed

### 2. Frontend Changes

#### New Hook (`frontend/src/hooks/useBusinessMetrics.ts`)
- `useBusinessMetrics()` - All metrics in one query
- `useMoneyAtRisk()` - Money at risk metric
- `useFraudPrevented()` - Fraud prevented metric
- `useFraudLoss()` - Fraud loss metric
- `useDetectionRate()` - Detection rate metric
- `useReviewQueue()` - Review queue metric

#### Updated Dashboard (`frontend/src/pages/Dashboard.tsx`)
- Removed hardcoded metric calculations
- Integrated real business metrics from backend
- Proper formatting of metric values
- Display of unavailability reasons from backend
- Real transaction counts and metadata

### 3. Metric Definitions

#### Money at Risk
**Definition:** Sum of transaction amounts currently unresolved and requiring intervention/review

**Includes:**
- Transactions flagged as high-risk but not yet investigated
- Open investigations awaiting human decision

**Excludes:**
- Completed and decided transactions
- Transactions confirmed as legitimate

**Data Source:** transactions + cases (with "Awaiting Human Review" status)

#### Fraud Prevented
**Definition:** Sum of amounts for transactions where decision was BLOCK/CHALLENGE and fraud was confirmed

**Calculation:** Requires:
- Decision = BLOCK or CHALLENGE
- Outcome = CONFIRMED_FRAUD
- transactionCompleted = false

**Unavailability:** Returns unavailable if no confirmed fraud outcomes exist

**Data Source:** cases with confirmed fraud outcomes

#### Fraud Loss
**Definition:** Sum of net losses (actual loss - recovered) from completed fraudulent transactions

**Calculation:** 
```
netLoss = actualLossAmount - recoveredAmount
totalLoss = SUM(netLoss) for confirmed fraud with financial data
```

**Unavailability:** Returns unavailable if no confirmed fraud with financial loss data exists

**Data Source:** cases with outcome=CONFIRMED_FRAUD and financial data

#### Detection Rate
**Definition:** Detected confirmed fraud transactions / Total confirmed fraud transactions

**Calculation:**
```
detectionRate = confirmedFraudDetected / confirmedFraudTotal
```

**Detection Criteria:** System-generated alert/flag BEFORE fraud outcome confirmed

**Unavailability:** Returns unavailable if insufficient confirmed fraud ground-truth data

**Data Source:** cases with confirmed fraud outcomes and detection status

#### Review Queue
**Definition:** Number of investigations currently awaiting human decision

**Includes:** Cases with status = "Awaiting Human Review"

**Excludes:** Completed, closed, or in-progress automated analysis

**Data Source:** cases table

### 4. Key Principles

1. **No Manufactured Metrics**
   - Never show a number that isn't backed by actual transaction/case data
   - Use "Unavailable" intentionally when data is insufficient
   - 0 and Unavailable are NOT the same

2. **Ground Truth Over Prediction**
   - Outcome = confirmed fraud status (not risk score)
   - Decision = action taken (not recommendation)
   - Detection = happened before confirmation (not based on risk score)

3. **Full Provenance**
   - Every metric includes metadata about what was included/excluded
   - Calculation window specified
   - Data source documented
   - Contributing records accessible

4. **Single Source of Truth**
   - Centralized metrics service ensures consistency
   - Dashboard and future reports use same calculations
   - No duplicate data models

### 5. Test Coverage (`tests/test_metrics.py`)

Deterministic test cases validating:
- Money at Risk calculations
- Fraud Prevented calculations
- Fraud Loss net calculations
- Detection Rate calculations
- Review Queue counting
- Metric provenance metadata
- Unavailability conditions

Run with: `pytest tests/test_metrics.py -v`

### 6. Removed Hardcoded Values

#### Frontend
- ✅ Dashboard metric calculations now use backend API
- ✅ "Unavailable" messages only shown when backend returns unavailable
- ✅ Removed derived calculations from transaction/alert arrays
- ℹ️ mockData.ts preserved for reference (not imported anywhere)

#### Backend
- ✅ _build_case_response now initializes outcome/decision/financial fields
- ✅ Case API endpoints return structured outcome data
- ✅ Metrics computed from actual database records

### 7. Data Consistency Verification

All metrics use the same underlying transaction and case records:
- Live Transactions table
- Alert Queue (from cases table)
- Investigations (from cases table)
- Verification Activity (from cases table)
- Business Metrics (from cases + transactions)

No separate fake datasets or mock aggregations.

### 8. Real-Time Behavior

**Frontend Refresh Intervals:**
- Business metrics: 5 second refetch
- Stale time: 2 seconds
- Background refetch enabled

**Data Freshness Indicators:**
- "LIVE" status when data < 15 seconds old
- "STALE" status when data < 5 minutes old
- "OFFLINE" when data unavailable

### 9. Financial Data Model

Cases store financial outcomes as JSON:
```json
{
  "actualLossAmount": 25000.0,
  "recoveredAmount": 5000.0,
  "preventedAmount": 10000.0,
  "outcome": "CONFIRMED_FRAUD",
  "decision": "BLOCK",
  "transactionCompleted": false
}
```

These are populated only when actual financial data available, not estimated.

### 10. Next Steps for Full Implementation

For production use:
1. Implement UI to confirm fraud outcomes (mark as CONFIRMED_FRAUD/LEGITIMATE)
2. Implement UI to record financial outcomes when available
3. Add historical reporting using same metrics service
4. Add alerting when metrics cross thresholds
5. Add audit trail for outcome confirmations
6. Implement SLA tracking for review queue
7. Add metrics comparison (period-over-period)

## Verification Checklist

- [x] All metrics computed from real transaction/case data
- [x] No hardcoded monetary values in Dashboard
- [x] No hardcoded percentages for detection rate
- [x] No random/mock metric generation
- [x] "Unavailable" only when data insufficient
- [x] 0 only shown when calculated value is zero
- [x] Metric definitions documented
- [x] Underlying records accessible
- [x] Calculations deterministic
- [x] No duplicate data models
- [x] Metrics have provenance metadata
- [x] Test cases covering all metrics
- [x] Frontend using backend API
- [x] No hardcoded business metrics in code

## References

See: `services/metrics_service.py` for complete calculation logic
See: `tests/test_metrics.py` for validation examples
See: `models/schemas.py` for outcome/decision/financial field definitions
