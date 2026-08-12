# Quick Reference - Business Metrics Implementation

## What Changed

The FraudShield Overview dashboard now displays **real business metrics** instead of hardcoded values.

## Five Metrics

| Metric | Calculation | Source | Availability |
|--------|-------------|--------|---|
| **Money at Risk** | Sum of unresolved transactions requiring action | transactions + cases | ✅ Always available |
| **Fraud Prevented** | Blocked transactions confirmed as fraudulent | cases | ⚠️ Unavailable if no confirmed fraud |
| **Fraud Loss** | Net loss from completed fraudulent transactions | cases | ⚠️ Unavailable if no financial data |
| **Detection Rate** | Detected fraud / Total confirmed fraud (%) | cases | ⚠️ Unavailable if no confirmed fraud |
| **Review Queue** | Cases awaiting human decision | cases | ✅ Always available |

## API Endpoints

```
GET /metrics/all                    - All metrics
GET /metrics/money-at-risk          - Money at Risk
GET /metrics/fraud-prevented        - Fraud Prevented
GET /metrics/fraud-loss             - Fraud Loss
GET /metrics/detection-rate         - Detection Rate
GET /metrics/review-queue           - Review Queue
```

## Example Response

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
    {"transaction_id": "TXN-001", "customer_id": "CUS-001", "amount": 35000}
  ]
}
```

## Frontend Hook

```typescript
import { useBusinessMetrics } from '../hooks/useBusinessMetrics';

const { data: metrics } = useBusinessMetrics();

// Access individual metrics
metrics.moneyAtRisk.value
metrics.fraudPrevented.available
metrics.detectionRate.ratePercentage
metrics.reviewQueue.count
```

## Database Fields

Cases now include outcome/decision metadata:

```json
{
  "outcome": "CONFIRMED_FRAUD",           // UNKNOWN, LEGITIMATE, CONFIRMED_FRAUD
  "decision": "BLOCK",                    // ALLOW, REVIEW, CHALLENGE, BLOCK
  "transactionCompleted": false,          // true/false
  "actualLossAmount": 30000.0,           // Financial data (optional)
  "recoveredAmount": 5000.0,             // Financial data (optional)
  "preventedAmount": 30000.0,            // For blocked fraud
  "wasDetected": true,                   // System detection status
  "detectionTimestamp": "2026-08-13T10:00:00",
  "outcomeConfirmedTimestamp": "2026-08-13T11:00:00"
}
```

## Testing

**Run tests:**
```bash
pytest tests/test_metrics.py -v
```

**Setup example data:**
```bash
python scripts/example_metrics_scenario.py
```

**Query metrics:**
```bash
curl http://localhost:8000/metrics/all
```

## Key Principles

1. **Never show fake numbers** - Only display calculated values
2. **Use "Unavailable" intentionally** - When data insufficient
3. **Include full provenance** - Every metric explains how it was calculated
4. **Ground truth only** - Fraud outcomes, not risk predictions
5. **Single source** - Same calculation engine for all uses

## Documentation

- **Complete guide:** `METRICS_GUIDE.md`
- **Technical details:** `METRICS_IMPLEMENTATION.md`
- **Full overview:** `BUSINESS_METRICS_SUMMARY.md`

## Implementation Files

**Backend:**
- `services/metrics_service.py` - Calculation engine
- `main.py` - API endpoints
- `models/schemas.py` - Data schema

**Frontend:**
- `frontend/src/hooks/useBusinessMetrics.ts` - React hooks
- `frontend/src/pages/Dashboard.tsx` - Dashboard component

**Tests:**
- `tests/test_metrics.py` - Unit tests
- `scripts/example_metrics_scenario.py` - Example setup

## Status

✅ **Implementation Complete**

All metrics are now:
- Real (calculated from actual data)
- Traceable (full provenance included)
- Transparent (unavailability reasons explained)
- Tested (comprehensive test suite)
- Documented (multiple guides and references)
