# JFSD Dashboard — Data Refresh Reference

**Script:** `scripts/refresh-data.py`
**Shell wrapper:** `scripts/refresh-and-deploy.sh`
**Last validated:** 2026-03-03 (26/27 sources passing)

---

## Overview

The refresh script pulls data from 7 source systems into 27 JSON files that power the JFSD dashboard. Each source is independently isolated — one failure doesn't block the rest.

**Runtime:** ~70 seconds for a full refresh (Ramp pagination is the bottleneck at ~60s).

---

## Data Sources (27 total)

### Salesforce — 12 sources

| # | Source | File | What It Pulls |
|---|--------|------|---------------|
| 1 | `campaign-tracker` | `campaign-tracker.json` (16KB) | Annual Campaign recognition totals, giving levels, weekly momentum, top gifts, active campaigns |
| 2 | `drm-portfolio` | `drm-portfolio.json` (3KB) | DRM portfolio assignments, recognition by fundraiser, YoY comparison |
| 3 | `pledge-management` | `pledge-management.json` (55KB) | Open GiftCommitments, aging buckets, recent payments, by-campaign breakdown |
| 4 | `data-quality` | `data-quality.json` (1KB) | Record completeness: email, phone, address, birthday coverage rates |
| 5 | `sharon-donor-health` | `sharon-donor-health.json` (31KB) | New donors, by-source breakdown, failed/cancelled/new recurring gifts, reactivations |
| 6 | `silence-alerts` | `silence-alerts.json` (281KB) | LYBUNT donors (gave last year, not this year), revenue at risk, by tier and DRM |
| 7 | `weekly-ask-list` | `weekly-ask-list.json` (32KB) | Upgrade prospects — prior year donors giving less this year, sorted by potential |
| 8 | `board-reporting` | `board-reporting.json` (12KB) | Board member giving, participation rate, campaign summary |
| 9 | `donor-lifecycle` | `donor-lifecycle.json` (1KB) | New, retained, lapsed, reactivated donor counts |
| 10 | `retention-analysis` | `retention-analysis.json` (1KB) | Year-over-year retention rate |
| 11 | `cohort-survival` | `cohort-survival.json` (1KB) | Placeholder for cohort survival curves |
| 12 | `mortality-model` | `mortality-model.json` (1KB) | Placeholder for mortality/attrition modeling |

### Research Database (SQLite) — 3 sources

| # | Source | File | Database |
|---|--------|------|----------|
| 13 | `prospect-research` | `prospect-research.json` (54KB) | `research.db` → `prospect_master` table |
| 14 | `wealthengine` | `wealthengine.json` (12KB) | `research.db` → `wealth_engine` table |
| 15 | `nonprofit-boards` | `nonprofit-boards.json` (14KB) | `research.db` → `nonprofits` + `nonprofit_people` tables |

### Ecobee (SQLite) — 2 sources

| # | Source | File | Database |
|---|--------|------|----------|
| 16 | `facilities` | `facilities.json` (9KB) | `ecobee.db` → `readings` table (latest per thermostat) |
| 17 | `ecobee-trends` | `ecobee-trends.json` (36KB) | `ecobee.db` → `readings` table (28-day daily trend) |

### Ramp (REST API) — 2 sources

| # | Source | File | Endpoint |
|---|--------|------|----------|
| 18 | `ramp-analytics` | `ramp-analytics.json` (6KB) | `GET /developer/v1/transactions` (full FY, paginated) |
| 19 | `james-ap-expense` | `james-ap-expense.json` (6KB) | `GET /developer/v1/transactions` (last 30 days) |

### Other APIs — 3 sources

| # | Source | File | System |
|---|--------|------|--------|
| 20 | `stripe` | `stripe.json` (1KB) | Stripe via `stripe-query.py` |
| 21 | `givecloud` | `givecloud.json` (7KB) | GiveCloud REST API (`/contributions`, `/supporters`) |
| 22 | `financial-statements` | `financial-statements.json` (6KB) | Sage Intacct SQLite (`jfsd-gl.db`) |

### Analytics (SQLite) — 2 sources

| # | Source | File | Database |
|---|--------|------|----------|
| 23 | `data-duel` | `data-duel.json` (23KB) | `analytics.db` → `duel_runs`, `findings` tables |
| 24 | `project-tracker` | `project-tracker.json` (18KB) | Parsed from `projects/PROJECTS.md` |

### TODO (stubs) — 3 sources

| # | Source | Status |
|---|--------|--------|
| 25 | `hubspot-emails` | Skips, preserves existing data |
| 26 | `hubspot-engagement` | Skips, preserves existing data |
| 27 | `monday` | Skips, preserves existing data |

---

## Authentication & Credentials

| System | Credential Location | Auth Method |
|--------|---------------------|-------------|
| **Salesforce** | `projects/mcp-servers/salesforce/.env` | OAuth (auto-refresh via `sf-query.js`) |
| **Ramp** | `~/.clawdbot/ramp_token.json` | Bearer token (expires weekly, auto-refresh in `ramp.sh`) |
| **GiveCloud** | `~/.secrets/givecloud.env` | Bearer JWT (long-lived PAT) |
| **Stripe** | `~/.secrets/stripe.env` | Via `stripe-query.py` |
| **SQLite DBs** | Local files | No auth needed |

---

## Known Gotchas (Lessons Learned 2026-03-03)

### Salesforce / SOQL

1. **NPC uses `Donor.Name`, not `Account.Name`**
   - GiftTransaction → Account relationship name is `Donor`
   - GiftCommitment → Account relationship name is `Donor`
   - `Account.Name` will throw "Didn't understand relationship 'Account'"

2. **SOQL does NOT support `CASE WHEN` expressions**
   - Unlike SQL, you cannot use `CASE WHEN field >= X THEN 'label'` in SOQL
   - Workaround: run separate queries per range bracket

3. **SOQL does NOT support field-to-field comparisons in WHERE**
   - `WHERE field1 > field2` is invalid
   - Workaround: pull both fields, filter in Python

4. **Non-aggregate queries cannot use field aliases**
   - `SELECT Name, Amount myAlias FROM Account` → error
   - Aliases only work in GROUP BY aggregate queries
   - `SELECT SUM(Amount) total FROM Account GROUP BY Name` → OK

5. **GiftCommitment field names (NPC)**
   - `CommitmentAmount` → **`ExpectedTotalCmtAmount`**
   - `PaidAmount__c` → **`TotalPaidTransactionAmount`**
   - `BalanceDue__c` → **`Total_Expected_Remaining_Balance_Due__c`**
   - `CommitmentDate` → **`EffectiveStartDate`**

6. **DateTime vs Date fields**
   - `TransactionDate` (Date) → `WHERE TransactionDate >= 2026-01-01` (no quotes, no time)
   - `LastModifiedDate` (DateTime) → `WHERE LastModifiedDate >= 2026-01-01T00:00:00Z`
   - `CreatedDate` (DateTime) → same as LastModifiedDate

7. **Board member field**
   - `Board_Member__c` doesn't exist → use **`JFSD_Board_Active__c`**
   - Also available: `JFSD_Board_Previous__c`, `WP_Board_Active__c`

8. **Campaign fields (NPC)**
   - `TotalAmount` doesn't exist → use **`AmountWonOpportunities`**
   - `Full_Campaign_Gift_Transaction_Total__c` and `Full_Campaign_Gift_Commitment_Total__c` also available

9. **No `Estimated_Gift_Capacity__c` field**
   - Only `Gift_Capacity_Range__c` (text, not numeric — can't use in WHERE comparisons)
   - For upgrade prospects, use prior year recognition as proxy

### sf-query.js / dotenv

10. **dotenv@17.2.3 stdout pollution**
    - `sf-query.js` outputs `[dotenv@17.2.3] injecting env...` BEFORE the JSON
    - The line starts with `[` which looks like a JSON array
    - **Fix:** Skip lines starting with `[dotenv` when looking for JSON start
    - Find the first line starting with `{` (our queries always return objects)

### SQLite Schema Mapping

11. **research.db**
    - Table `prospects` doesn't exist → use **`prospect_master`**
    - `net_worth_range` doesn't exist → use **`net_worth`** (TEXT in `wealth_engine`)
    - `nonprofit_people` has no `role` column → use **`title`**
    - `nonprofit_people` has no `sf_account_id` → use **`sf_contact_id`**
    - JOIN nonprofits via `org_ein`, not `nonprofit_id`
    - Revenue field: `total_revenue` (not `revenue`) on `nonprofits`

12. **ecobee.db**
    - `thermostat_group` → **`group_name`**
    - `thermostat_name` → **`name`**
    - `fan_mode` → **`fan_running`** (integer, not text)
    - Only two tables: `readings` and `alerts`

13. **jfsd-gl.db**
    - `budget` table has NO `account_title` column — only `acct_no`
    - Must JOIN `chart_of_accounts` on `budget.acct_no = chart_of_accounts.account` to get titles
    - Budget uses monthly columns: `jul_2025`, `aug_2025`, ..., `jun_2026`

14. **analytics.db (Data Duel)**
    - Table `runs` doesn't exist → use **`duel_runs`**
    - `findings` table uses `dollar_impact`, not `impact_score`

### Ramp API

15. **Pagination returns full URLs, not cursor tokens**
    - `data.page.next` = `"https://api.ramp.com/developer/v1/transactions?...&start=uuid"`
    - Do NOT pass this as a `start` param (double-encoding breaks it)
    - **Fix:** Use the full next URL directly for subsequent requests

16. **`from_date` needs ISO datetime, not just date**
    - `from_date=2025-07-01` → 422 Unprocessable Entity
    - `from_date=2025-07-01T00:00:00` → works

17. **`accounting_categories` is a list, not a dict**
    - Always check: `if isinstance(acct_cats, list): acct_cats = acct_cats[0]`

18. **Minimum `page_size` is 2** (not 1)

### GiveCloud API

19. **Requires `User-Agent` header**
    - Without it: 403 Forbidden
    - With `User-Agent: JFSD-Dashboard/1.0`: 200 OK
    - urllib's default Python user agent gets blocked

20. **Maintenance mode returns HTML, not JSON**
    - Check if response starts with `<` before parsing JSON
    - Not a code bug — GiveCloud periodically goes into maintenance

---

## Usage

```bash
# Full refresh (all 27 sources)
python3 scripts/refresh-data.py

# Single source
python3 scripts/refresh-data.py --source campaign-tracker

# Refresh + deploy to GitHub Pages
bash scripts/refresh-and-deploy.sh

# Data only (no deploy)
bash scripts/refresh-and-deploy.sh --data-only

# Deploy only (no refresh)
bash scripts/refresh-and-deploy.sh --deploy-only
```

---

## File Paths

| Path | Purpose |
|------|---------|
| `scripts/refresh-data.py` | Main refresh script (Python) |
| `scripts/refresh-and-deploy.sh` | Shell wrapper (refresh + git + deploy) |
| `data/*.json` | Output JSON files (27 files, ~11MB total) |
| `~/clawd/projects/salesforce/sf-query.js` | Salesforce SOQL query tool |
| `~/clawd/skills/stripe/scripts/stripe-query.py` | Stripe query tool |
| `~/clawd/research/prototype/data/research.db` | Prospect research SQLite |
| `~/clawd/projects/ecobee-dashboard/data/ecobee.db` | Ecobee thermostat SQLite |
| `~/clawd/projects/sage-intacct/data/jfsd-gl.db` | Sage GL SQLite |
| `~/clawd/projects/daily-data-duel/state/analytics.db` | Data Duel SQLite |

---

## Cron Schedule

**Recommended:** Daily at 6:00 AM PT (before CFO daily brief at 7:30 AM)

```
Schedule: 0 6 * * * (cron) or { kind: "cron", expr: "0 6 * * *", tz: "America/Los_Angeles" }
```
