# Business Metrics Guide for FraudShield

This guide explains how the real business metrics work in FraudShield and how to verify they're calculating correctly.

## Quick Start

### 1. Start the Application
```bash
docker-compose up -d --build
```

### 2. Access the Dashboard
Open http://localhost:5173 and navigate to the Overview page.

### 3. Observe Real Metrics
The five business metrics now display real, traceable data:
- **Money at Risk** - Transactions requiring intervention
- **Fraud Prevented** - Blocked fraud that was confirmed
- **Fraud Loss** - Financial loss from confirmed fraud
- **Detection Rate** - Detected vs total confirmed fraud
- **Review Queue** - Investigations awaiting human decision

## Understanding the Metrics

### Money at Risk
**What it measures:** Exposure from transactions that need action

**Calculation:**
- Sum amounts for transactions flagged as high-risk but not yet investigated
- Plus sum amounts for open investigations awaiting human decision

**Why it matters:**
- Shows current operational risk
- Helps prioritize review queue
- Indicates system load

**Example:**
```
Transaction A: ₹35,000 (flagged as high-risk, not investigated)
Investigation B: ₹50,000 (awaiting human decision)
Money at Risk = ₹85,000
```

### Fraud Prevented
**What it measures:** Financial impact of system's fraud blocking

**Calculation:**
- Sum amounts for transactions where:
  - Decision = BLOCK or CHALLENGE (prevented from completion)
  - Fraud = CONFIRMED (verified as fraudulent after prevention)
  - Not completed (transaction was halted)

**Why it matters:**
- Proves system ROI
- Shows fraud prevention effectiveness
- Only counts when fraud confirmed (not predictions)

**Example:**
```
Transaction A: ₹10,000 blocked → later confirmed fraud = ₹10,000 prevented
Transaction B: ₹15,000 blocked → later confirmed legitimate = ₹0 prevented
Total Fraud Prevented = ₹10,000
```

**Unavailability Reason:**
- "No confirmed fraud outcomes recorded yet" - No fraud confirmations in system

### Fraud Loss
**What it measures:** Financial loss from confirmed fraud that completed

**Calculation:**
```
Net Loss = Actual Loss Amount - Recovered Amount
Total Loss = SUM(Net Loss) for completed fraudulent transactions
```

**Why it matters:**
- Quantifies operational impact
- Tracks recovery efforts
- Baseline for system improvement

**Example:**
```
Transaction A: Loss ₹30,000, Recovered ₹5,000, Net = ₹25,000
Transaction B: Loss ₹50,000, Recovered ₹0, Net = ₹50,000
Total Fraud Loss = ₹75,000
```

**Unavailability Reason:**
- "No confirmed fraud cases with financial loss data yet" - Outcomes not recorded

### Detection Rate
**What it measures:** System's ability to catch fraud before confirmation

**Calculation:**
```
Detection Rate = Fraud Detected by System / Total Confirmed Fraud
Rate = 8 / 10 = 80%
```

**Definition of "Detected":**
- System generated alert/flag BEFORE fraud outcome was confirmed
- Based on actual detection (not risk scores alone)

**Why it matters:**
- Measures system effectiveness
- Guides tuning and improvements
- Ground-truth metric (not predictions)

**Example:**
```
10 total confirmed fraud cases
8 were flagged by system before confirmation
2 slipped through undetected

Detection Rate = 80%
```

**Unavailability Reason:**
- "No confirmed fraud outcomes to calculate detection rate" - Insufficient data

### Review Queue
**What it measures:** Pending human review workload

**Calculation:**
- Count cases with status = "Awaiting Human Review"
- Does NOT include in-progress automated analysis

**Why it matters:**
- Operational metric (SLA tracking)
- Resource planning
- Shows system throughput

**Example:**
```
5 cases awaiting human decision
3 cases in automated analysis
2 cases completed

Review Queue = 5
```

## Key Principles

### Principle 1: No Manufactured Numbers
❌ **BAD:** "Fraud prevented = sum of risk scores * transaction amount"
✅ **GOOD:** "Fraud prevented = ₹10,000 (1 confirmed fraud transaction blocked)"

Reason: Risk scores are predictions, not outcomes.

### Principle 2: Ground Truth Matters
❌ **BAD:** "Detection rate = alerts generated / transactions"
✅ **GOOD:** "Detection rate = confirmed fraud detected / total confirmed fraud"

Reason: Only confirmed outcomes are ground truth.

### Principle 3: Unavailable is Better Than Guessed
❌ **BAD:** "Fraud prevented unavailable, showing 0"
✅ **GOOD:** "Fraud prevented unavailable, reason: No confirmed fraud outcomes yet"

Reason: 0 means "measured and found zero", unavailable means "insufficient data".

### Principle 4: Full Provenance
Every metric response includes:
- Definition of what's included/excluded
- Data source (which tables)
- Calculation window (what time period)
- Last update timestamp
- Underlying records (transactions/cases involved)

Example query:
```json
{
  "available": true,
  "value": 85000,
  "currency": "INR",
  "transactionCount": 2,
  "definition": "Sum of transaction amounts currently unresolved and requiring review",
  "dataSource": "transactions + cases (reviews requiring intervention)",
  "calculationWindow": "Current pending state",
  "lastUpdated": "2026-08-13T10:45:00",
  "underlyingRecords": [
    { "transaction_id": "TXN-001", "customer_id": "CUS-001", "amount": 35000, "status": "Flagged" },
    { "transaction_id": "TXN-002", "customer_id": "CUS-002", "amount": 50000, "status": "Awaiting Decision" }
  ]
}
```

## Testing Metrics Locally

### Option 1: Use Example Scenario Script
```bash
# Setup example data with known metric outcomes
python scripts/example_metrics_scenario.py

# Query the metrics
curl http://localhost:8000/metrics/all
```

This creates:
- 1 prevented fraud: ₹10,000
- 2 fraud losses: ₹70,000 net
- 4 detected, 5 total confirmed fraud (80% detection rate)
- 1 case awaiting review

### Option 2: Manual Testing
1. Investigate transactions (creates cases)
2. Manually update case outcomes via database
3. Query metrics endpoints to verify calculations

### Option 3: Run Unit Tests
```bash
pytest tests/test_metrics.py -v
```

## API Reference

### Get All Metrics
```
GET /metrics/all
Returns all business metrics in one call
Response includes timestamp and all five metrics
```

### Get Individual Metrics
```
GET /metrics/money-at-risk
GET /metrics/fraud-prevented
GET /metrics/fraud-loss
GET /metrics/detection-rate
GET /metrics/review-queue
```

### Response Structure
```json
{
  "available": true,
  "value": <number>,
  "currency": "INR",
  "transactionCount": <number>,
  "definition": "<what is included/excluded>",
  "dataSource": "<which tables>",
  "calculationWindow": "<time period>",
  "lastUpdated": "<ISO timestamp>",
  "underlyingRecords": [<records contributing to metric>]
}
```

When unavailable:
```json
{
  "available": false,
  "reason": "<why not available>",
  "definition": "...",
  "dataSource": "...",
  "calculationWindow": "...",
  "lastUpdated": "<ISO timestamp>"
}
```

## Frontend Integration

### Using Metrics in React
```typescript
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';

function MyComponent() {
  const { data: metrics } = useBusinessMetrics();
  
  if (!metrics?.moneyAtRisk.available) {
    return <div>Money at Risk: {metrics.moneyAtRisk.reason}</div>;
  }
  
  return (
    <div>
      Money at Risk: ₹{metrics.moneyAtRisk.value}
      ({metrics.moneyAtRisk.transactionCount} transactions)
    </div>
  );
}
```

### Dashboard Component
The Overview dashboard (src/pages/Dashboard.tsx) demonstrates:
- Loading metrics from hook
- Formatting values for display
- Showing unavailability reasons
- Integrating with existing components

## Verification Checklist

After implementation, verify:

- [ ] Money at Risk displays real unresolved transaction amounts
- [ ] Fraud Prevented only includes blocked + confirmed fraud
- [ ] Fraud Loss uses net calculation (loss - recovered)
- [ ] Detection Rate is ground-truth metric (not alert-based)
- [ ] Review Queue shows only "Awaiting Human Review" cases
- [ ] All metrics include provenance metadata
- [ ] "Unavailable" shown with reason when data insufficient
- [ ] Metrics update every 5 seconds
- [ ] Backend calculations deterministic (same query = same result)
- [ ] Frontend uses backend API (not local calculations)
- [ ] No hardcoded metric values in code
- [ ] Tests pass: `pytest tests/test_metrics.py -v`

## Troubleshooting

### All Metrics Showing "Unavailable"

**Reason:** No case records in database

**Solution:**
1. Investigate some transactions (creates cases)
2. Query `/investigate` endpoint for a transaction
3. Wait for processing to complete
4. Check metrics again

### Money at Risk Showing 0

**Reason:** No transactions flagged or awaiting review

**Solution:**
1. Ensure transactions have risk flags (amount > 3x baseline)
2. Ensure cases exist with "Awaiting Human Review" status
3. Check case records in database:
   ```bash
   sqlite3 data/fraudshield.db "SELECT COUNT(*) FROM cases WHERE json_extract(result_json, '$.status') = 'Awaiting Human Review';"
   ```

### Detection Rate Unavailable

**Reason:** No confirmed fraud outcomes

**Solution:**
1. Manually update case outcomes in database:
   ```bash
   sqlite3 data/fraudshield.db
   UPDATE cases SET result_json = json_set(result_json, '$.outcome', 'CONFIRMED_FRAUD') 
   WHERE transaction_id = 'TXN-001';
   ```
2. Set wasDetected: true for detected fraud
3. Query detection rate again

## Next Steps

1. **Implement Outcome Confirmation UI:**
   - Add UI to mark cases as fraud/legitimate
   - Record financial outcomes when available

2. **Add Historical Reporting:**
   - Query metrics over time periods
   - Compare period-over-period
   - Generate trend reports

3. **Implement Alerting:**
   - Alert when Money at Risk crosses threshold
   - Alert when Detection Rate drops below target
   - Alert on SLA violations in review queue

4. **Add Audit Trail:**
   - Track when outcomes confirmed
   - Record who made confirmation
   - Store changes with timestamps

5. **Implement Metrics Dashboard:**
   - Separate metrics-focused page
   - Time-series visualizations
   - Drill-down to underlying records
   - Export functionality

## References

- Metrics Service: `services/metrics_service.py`
- Tests: `tests/test_metrics.py`
- Schema: `models/schemas.py`
- Frontend Hook: `frontend/src/hooks/useBusinessMetrics.ts`
- Dashboard: `frontend/src/pages/Dashboard.tsx`
- API Endpoints: `main.py` (search for `@app.get("/metrics/`)
- Documentation: `METRICS_IMPLEMENTATION.md`
