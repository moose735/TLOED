# Copilot / AI Agent Instructions for TLOED

Quick, focused guidance to help an AI agent be productive in this repo.

- **Big picture:** This is a Create-React-App (CRA) single-page dashboard that pulls fantasy data from the Sleeper API and a few Google Apps Script endpoints and then computes league analytics. The UI lives in `src/components` and `src/lib` (analysis views). Global data is produced by the `SleeperDataProvider` in `src/contexts/SleeperDataContext.js` and consumed throughout the app.

- **Entry points:**
  - App shell: `src/App.js` (wires nav and routes)
  - React root: `src/index.js`
  - Context/central data: `src/contexts/SleeperDataContext.js` (single-most-important file for data flow)

- **Primary data flows & responsibilities:**
  - External fetch layer: `src/utils/sleeperApi.js` (implements caching, all API calls to Sleeper, draft history, transactions, brackets).
  - Context assembly: `SleeperDataContext` calls `sleeperApi` functions (e.g. `fetchAllHistoricalMatchups`, `fetchAllDraftHistory`), merges with hardcoded Yahoo data (2021) and produces `historicalData` with canonical keys:
    - `matchupsBySeason`, `rostersBySeason`, `usersBySeason`, `winnersBracketBySeason`, `losersBracketBySeason`, `draftsBySeason`, `draftPicksBySeason`.
  - Consumers read `historicalData`, `draftPicksBySeason`, `processedSeasonalRecords`, `transactions`, and helpers exported by the context: `getTeamName`, `getTeamDetails`, `computeBadgesNow`.

- **Important integration/configuration points:**
  - League selection: `src/config.js` exports `CURRENT_LEAGUE_ID`. Changing this value changes the league/season chain used by `fetchLeagueData`.
  - Google Sheets / Apps Script endpoints: `GOOGLE_SHEET_POWER_RANKINGS_API_URL` and `HISTORICAL_MATCHUPS_API_URL` are used for non-Sleeper historical/tagged data.
  - Caching: `src/utils/sleeperApi.js` uses an in-memory cache and persists NFL players in `localStorage` (key: `sleeper_nfl_players_cache`). Respect these caches when adding new heavy fetches.

- **Patterns & conventions unique to this repo:**
  - Single global context: Almost all data flows through `SleeperDataProvider`. Add derived data to the provider when multiple components need it.
  - Historical merge: The app merges the current league chain (via `previous_league_id`) and then flattens weekly matchups. When adding a historical data source, ensure it fits into the existing `historicalData` shape.
  - Heavy computations are deferred/on-demand: badge computation and some player-stat heavy tasks are done in `computeBadgesNow` (explicit invocation) to keep initial load fast.
  - Debug hooks: `computeBadgesNow` sets `window.__computedBadges` for local dev debugging—useful when diagnosing badge logic.

- **Where to implement new API or background work:**
  - Add endpoint wrappers to `src/utils/sleeperApi.js` (maintain caching behavior). Call them from `SleeperDataContext` to include results in the canonical `historicalData` shape.
  - Avoid duplicating fetch logic; reuse `fetchDataWithCache` for consistent logging and cache semantics.

- **Build / test / run commands**
  - Dev server: `npm start` (CRA default)
  - Build for production: `npm run build`
  - Tests: `npm test` (project currently uses CRA test script; there are few/no unit tests by default)

- **Files to check when debugging data issues**
  - `src/contexts/SleeperDataContext.js` — orchestration, merging, and derived metrics.
  - `src/utils/sleeperApi.js` — HTTP endpoints, caching and data normalization.
  - `src/config.js` — league IDs and external Google Apps Script URLs.
  - `src/lib/*` — analytics code that expects specific `historicalData` shapes (examples: `DPRAnalysis.js`, `LeagueHistory.js`, `RecordBook.js`).

- **Common pitfalls to watch for (examples from repo):**
  - Inconsistent season shapes: some historical sources return arrays keyed by week, others return flattened arrays — `SleeperDataContext` normalizes these. When adding a new data source, follow the normalization code in `fetchAllHistoricalMatchups` and the subsequent merge.
  - `sleeperService.js` exists but is empty — the real API helpers live in `src/utils/sleeperApi.js`. Prefer editing `sleeperApi.js`.
  - Tests and CI are not present — make minimal, isolated changes and locally run `npm start` to validate UI/data flows.

- **Examples of targeted tasks and where to change:**
  - Change league ID used by the app: edit `src/config.js` -> `CURRENT_LEAGUE_ID`.
  - Add an API wrapper for a new Sleeper endpoint with caching: add to `src/utils/sleeperApi.js` and call from `SleeperDataContext`.
  - Compute an extra derived metric globally: add processing to `SleeperDataContext` after `mergedHistoricalData` is built, and expose it in the context value.

If anything is unclear or you want me to expand any section (examples of normalized data shape, a short checklist for adding new API calls, or a suggested unit-test template), tell me which part to elaborate and I will iterate.
