# Valuation Model (Vibe Coding)

Last updated: 2026-05-23

## 1) Purpose
This file provides a reusable valuation framework for Vibe Coding, including:
- Market sizing (Global TAM / Taiwan SAM)
- 3-year operating scenarios
- Company valuation ranges (PS / simplified DCF / comps)
- A practical fundraising anchor range

## 2) Market Sizing (Reference)

### Global TAM (EdTech + e-learning)
- Working range: USD 370B-400B
- Approx. in TWD (USD/TWD=31.4): TWD 11.6T-12.6T

### Taiwan SAM (addressable by this system)
- Conservative range: USD 1.0B-1.3B
- Expansion range: USD 1.5B-2.5B
- Approx. in TWD (USD/TWD=31.4):
  - Conservative: TWD 31.4B-40.8B
  - Expansion: TWD 47.1B-78.5B

## 3) Core Revenue Logic

Annual Revenue = Paid Learners * ARPU

Where ARPU can include:
- Paid course sales
- Hardware kit sales
- Optional value-added services

## 4) Scenario Assumptions (3 years)

Base assumptions:
- Paid learners: 1,000 -> 3,000 -> 8,000
- ARPU: NTD 4,500 / year
- Revenue: NTD 4.5M -> 13.5M -> 36.0M
- Gross margin: 55% -> 58% -> 60%
- EBITDA margin: -20% -> 5% -> 18%

## 5) Valuation Methods

### A. Revenue Multiple (Primary for current stage)
Use PS multiple because the platform is still scaling.

Indicative ranges:
- Conservative: PS 2x
- Base: PS 4x
- Growth: PS 6x

Example (2028 Revenue = NTD 36.0M):
- 2x => NTD 72M
- 4x => NTD 144M
- 6x => NTD 216M

### B. Public comps with private-stage discount
Reference listed online-learning peers, then apply private-stage discount.
Typical discount for early private company: 70%-90%.

Indicative equity value range:
- NTD 80M-300M

### C. Simplified DCF (supporting method)
Sensitive to growth and margin assumptions.
Indicative range under high uncertainty:
- NTD 120M-350M

## 6) Suggested Fundraising Position (Pre-money)

- Anchor: NTD 220M
- Negotiation band: NTD 150M-300M
- Defensive floor: NTD 100M (unless strategic channel/resource package is included)

## 7) System-only Valuation (Product/IP carve-out)

If valuing only platform/IP (excluding operating company):
- NTD 15M-45M

This reflects:
- Build/rebuild cost
- Workflow integration value
- Production-readiness premium

## 8) How to Update Monthly

1. Update `docs/examples/valuation-scenarios.csv` assumptions.
2. Recompute revenue and valuation columns.
3. Update this markdown summary with latest numbers.
4. Keep one frozen copy per month for investor/audit traceability.

## 9) Notes
- This model is for strategic planning and fundraising discussion.
- Not a formal fairness opinion.
- Always pair with actual cohort metrics (conversion, retention, refund rate, CAC, LTV).
