# JFSD Dashboard — Long-Term Fix Scope

## Current State (Broken)

**Architecture:**
- Source code exists on branch `cursor/jfsd-analytics-dashboard-review-7af7` (React/TS, Vite, 24 dashboards)
- `gh-pages` branch has ONLY built/minified output — no source
- Data refreshed via `scripts/refresh-and-deploy.sh` on gh-pages (pushes JSON to `data/`)
- Build + deploy happens via the source branch's `scripts/refresh-and-deploy.sh` (different script)

**Problems:**
1. **No build pipeline** — we're patching minified JS when things break
2. **Schema drift** — data scripts output JSON that doesn't match what React components expect (5 missing KPI fields caused today's crash)
3. **No validation** — data refresh writes whatever it gets, no schema check
4. **Source is orphaned** — lives on a random Cursor branch, not `main`
5. **No CI/CD** — manual deploy, no automated build-on-push
6. **Formatters crash on null** — `toLocaleString()`, `toFixed()` etc. called on undefined values

## Proposed Fix

### Phase 1: Source Branch Cleanup (1 hour)
- Create proper `main` branch from `cursor/jfsd-analytics-dashboard-review-7af7`
- Verify all 24 dashboard components match current data schemas
- Add null-safe wrappers to ALL formatters (global `safeCurrency()`, `safePercent()`, etc.)
- Set up `.github/workflows/deploy.yml` — build + deploy to gh-pages on push to main

### Phase 2: Data Schema Validation (2 hours)
- Define TypeScript interfaces for each dashboard's expected JSON shape
- Create `scripts/validate-data.ts` that checks every JSON file against its interface
- Add validation step to `refresh-and-deploy.sh` — fail loudly if schema mismatch
- Generate JSON Schema files from TS interfaces for runtime validation
- Add default/fallback values in each dashboard component for every optional field

### Phase 3: Automated Build Pipeline (1 hour)
- GitHub Actions workflow: `main` push → `npm run build` → deploy to `gh-pages`
- Data refresh stays on gh-pages (H2 cron pushes JSON)
- OR: data refresh triggers a main branch commit → CI builds → deploys
- Preferred: **data lives on main, CI builds everything**

### Phase 4: Data Refresh Hardening (2 hours)
- Each `generate-*.py` script validates its output against the schema before writing
- Add `--dry-run` flag to preview changes without writing
- Add `--validate` flag to check existing data without refreshing
- Integrate into H2's daily cron — validate after every refresh, alert on schema drift

## Architecture Decision

**Option A: Data on gh-pages (current)**
- H2 pushes JSON directly to gh-pages
- Source/build on main, deployed via CI
- Risk: data and build can diverge

**Option B: Data on main (recommended)**
- H2 pushes JSON to main branch `public/data/`
- CI builds and deploys on every push
- Single source of truth, no divergence
- Slightly slower deploy (build step) but more reliable

## Effort Estimate

| Phase | Effort | Who |
|-------|--------|-----|
| Phase 1: Source cleanup | 1h | Cursor agent |
| Phase 2: Schema validation | 2h | Cursor agent + H2 review |
| Phase 3: CI pipeline | 1h | H2 (GitHub Actions) |
| Phase 4: Data hardening | 2h | H2 (Python scripts) |
| **Total** | **~6h** | |

## Quick Win (Now)
Ship the null-safe formatter fix and data defaults. Prevents crashes but doesn't fix root cause.
Already done — commit `706a9ac`.
