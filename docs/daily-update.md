# Daily data and report update

GitHub Pages reads `data/daily.json` with `cache: no-store` on each page load.
The API adapter in `pages/api-adapter.ts` creates the visible stock universe from actual public quotes; it does not require an Excel upload and never invents analyst forecasts.
The static app uses `assets/data-adapter.js` before its application bundle.
Personal watchlists, imported snapshots and report edits remain in browser storage.

## Scheduled run

1. Fetch the current `scripts/refresh-data.py` and `scripts/prepare-pages-data.py` from this repository, plus `data/dart-companies.json` and the previous `data/daily.json`, into a temporary working directory. Preserve their paths. Python standard library only is required for collection and reporting.
2. Obtain authorized owner-provided DART credentials privately. The setup automation identifies the private file; it is intentionally not named here. Never print its `.env`, key, Site bearer token or token responses. Use official Library download helpers for private files.
3. Get the current Site service-access token for the exact PER Observatory Site, preserve its private audience, and run `scripts/refresh-data.py` with its documented JSON on hidden stdin. Never pass credentials in command-line arguments or commit them. This collects four public market files, the most recent expected interim CFS and previous-year CFS annual statements and 90-day disclosures for Samsung Electronics and SK Hynix. It also imports and reads back the shared public-market cache on the private Site. If the Site import fails, preserve that failure in the run result; independently collected valid public data may still update Pages.
4. Run `python3 scripts/prepare-pages-data.py .sites-runtime/daily-public.json <previous-daily-json-path>`. Unavailable responses retain previous valid items with their original `collectedAt`. Do not replace the dataset when no valid quotes exist, its count is unexpectedly under 1,000, or source validation fails. Record partial failures honestly.
5. Inspect `data/daily.json`'s current GitHub SHA or branch head before writing. Publish `.sites-runtime/daily-public.json` as `data/daily.json` and `.sites-runtime/daily-report.md` as `reports/YYYY-MM-DD.md` in one Git tree/commit on `main`, preserving all unrelated files and using an expected-head lease. Retry a changed head only after re-reading it. Never upload the input ZIP, `.env`, private user data or runtime credentials.
6. Read back the new data file and verify the quote count, generation time, actual quote date and report date. GitHub Pages deploys from `main` root. Inspect the matching Pages workflow if publishing fails. Report the result in Korean, separating collection time from trading date and noting Kiwoom IP-authentication limits. No trade execution.

## Reports

`report.html` loads the generated public-market draft, supports personal edits saved in this browser, Markdown download and print/PDF. Only the factual automatically generated draft is stored in public `reports/`; personal edits are never published. Reports identify source dates and failed requests and do not turn missing forecasts into estimates.

## Coverage

Initial verified quote dataset: 2,779 stocks, actual quote date 2026-10-15, collected 2026-10-18. DART: two companies, four financial responses plus 30 recent disclosures each. These are verified source responses, not demo values. Coverage changes with the source. User-provided initial consensus Excel is excluded from this public repository.
