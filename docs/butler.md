# DART / Kiwoom integration

The default Integrated Analysis tab uses owner-supplied DART and Kiwoom secrets.
Environment names: DART_API_KEY, KIWOOM_APP_KEY, KIWOOM_SECRET_KEY.
All three are production Sites secrets. No secret is returned to the browser.

## Data boundary
- Kiwoom OAuth `/oauth2/token` and quote `/api/dostk/stkinfo`, API ID `ka10001` only.
- No trading, portfolio account, order, or balance endpoints are implemented.
- REST polling is opt-in every 60 seconds while the tab is visible; not WebSocket streaming.
- A received quote has a retrieval timestamp, not an inferred trade date.
- Provider PER/PBR retain their provider basis. Forecast PER retains the existing data source.
- Verified DART corporate-code ZIP snapshot (2026-10-18, 3,999 stock-code entries) maps known stock codes immediately. It can include inactive listings; this is an issuer lookup, not a current trading-universe claim. Search uses the snapshot for 30 days, then attempts the 24h live cache with explicit snapshot fallback. Unknown codes attempt a live lookup; unmatched codes are reported.
- DART financial statements use explicit year, report, and CFS/OFS. No silent fallback to another basis.
- Interim IS/CIS are cumulative amounts; H1 and Q3 never fall back to 3-month values.
- Balance-sheet comparators are prior fiscal year-end; interim cash flow uses the prior corresponding period.
- Non-KRW or unmatched accounts remain null. Debt ratio is total liabilities/equity, not net debt.
- No annualization of interim earnings or unverified TTM reconstruction.
- Insights are deterministic rules. No LLM API has been connected.

## Resilience
Requests have timeouts. Identical in-flight requests are coalesced per isolate.
D1 metadata and R2 content-addressed snapshots reuse existing tables and bindings.
Companies cache 24h, financials 30m, disclosures 5m, quotes 30s.
Failures are damped and last good data is explicitly marked stale. API keys and tokens are never cached as response data.
OAuth token is memory-only; expiry is parsed in Asia/Seoul.
`/api/butler` requires signed-in identity.
`/api/butler/health` is a fixed-scope, public-market-data diagnostic for authenticated Sites service callers, relying on the existing owner-private dispatch boundary. Keep that audience unchanged.

## Sources
- https://openapi.kiwoom.com/m/guide/apiguide?dummyVal=0
- https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS003&apiId=2019020
- https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001
- https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018

## Verification
Run TypeScript type checks, tests/butler.test.ts, adapter tests and the production build.
Source tests and live-provider checks are distinct. Record provider failures without replacing them with demo data.
