# Federation Analytics — Strategic Platform Review (v3)

**Prepared for:** David Fuhriman, CFO  
**Date:** March 6, 2026  
**Scope:** 34-dashboard analytics platform for Jewish Federation of San Diego  
**Classification:** Internal — Draft for Discussion  
**Platform URL:** https://jewish-federation-of-san-diego.github.io/jfsd-ui/  
**Review context:** Follow-up to v2 review (Feb 20, 2026); platform expanded from 15 to 34 dashboards

---

## 1. Executive Summary

Federation Analytics v3 represents a significant expansion in scope — more than doubling from 15 to 34 dashboards — while maintaining the architectural discipline that made v2 work. The platform has added a CI/CD pipeline, dashboard design standards, schema validation, a shared analytics utility layer (`donorAnalytics.ts`), and 10 new dashboards that push into donor intelligence territory (Share of Wallet, Cohort Analysis, Retention Flow, The Unasked). The codebase has grown from ~6,250 lines of dashboard code to ~10,075 lines across 34 files, plus 1,642 lines of shared components, utilities, and schemas.

**The good news:** The new dashboards are genuinely useful and fill real analytical gaps. Share of Wallet, The Unasked, and Major Gifts Pipeline are the kind of donor intelligence tools that most nonprofits pay five-figure annual fees for. The CI/CD pipeline and design standards bring engineering maturity. The shared `donorAnalytics.ts` utility avoids duplicating lifecycle/SOW logic across four dashboards.

**The concern:** The platform has grown faster than its organizational infrastructure. Authentication still doesn't exist. The sidebar now lists 34 items across 4 groups with no collapsibility — the Development section alone has 15 entries. Several new dashboards share the same underlying data (`donor_data.json` powers 5+ dashboards), which is architecturally efficient but creates the perception of redundancy. And the original v2 concern about static data is now more acute: 34 dashboards of stale snapshots feel more like a report archive than a living platform.

**Bottom line:** v3 is an impressive analytical toolkit for David, Sharon, and James. The 10 new dashboards demonstrate genuine domain expertise — these aren't vanity metrics. But the platform has reached the point where its breadth demands better navigation, access control, and data freshness to be useful beyond 3 power users. The gap between "impressive internal tool" and "organizational platform" has widened, not narrowed, because the surface area grew while the infrastructure gaps remained.

---

## 2. Summary Scorecard

| Dimension | v2 Score | v3 Score | Change | Notes |
|-----------|:--------:|:--------:|:------:|-------|
| **Information Architecture** | 8/10 | 6.5/10 | **-1.5** | 34 dashboards in 4 flat groups is past the usability threshold. DEVELOPMENT has 15 items. Navigation is the platform's most visible regression |
| **Data Quality & Freshness** | 8/10 | 7.5/10 | -0.5 | Schema validation is a genuine improvement, but 5 dashboards derive from `donor_data.json` with inferred cohort years and estimated capacity — analytical models presented as data. Data freshness unchanged (static JSON) |
| **Visual Design** | 9.5/10 | 8.5/10 | -1 | New dashboards follow standards well but introduce embedded iframes (Cohort, Retention, Holdings) that break visual consistency. D3 force graph has different interaction patterns than Plotly charts. Section-colored Tags are a nice addition |
| **Interactivity** | 5/10 | 6.5/10 | +1.5 | D3 force graph with zoom/drag/filter is the platform's most interactive element. SOW and Unasked have filtering. But most new dashboards remain view-only |
| **Export & Distribution** | 8/10 | 7/10 | -1 | v2's CSV coverage was comprehensive. Many new dashboards lack CSV export. PDF still limited to 2 dashboards. Net coverage rate dropped |
| **Operational Intelligence** | 7/10 | 7.5/10 | +0.5 | Voice Agent monitoring and Major Gifts pipeline are operationally useful. Immersive Travel fills a real tracking gap. But still no notifications or alerts |
| **Strategic Value** | 7/10 | 8/10 | **+1** | SOW, Cohort Survival, Retention Flow, and The Unasked are genuine strategic analytics — the kind that drive fundraising strategy, not just reporting. This is the strongest improvement in v3 |
| **Developer Experience** *(NEW)* | — | 7.5/10 | *new* | CI/CD pipeline, DASHBOARD-STANDARDS.md, schema validation, shared utilities, and `import.meta.env.BASE_URL` fix (from v2 fetch path issue) are all solid. `@ts-nocheck` on Overview is a blemish. Dead `SilenceAlertsDashboard.tsx` still exists |

### Composite Score

| | v1 | v2 | v3 |
|---|:---:|:---:|:---:|
| **Overall (weighted)** | **7.3/10** | **8.0/10** | **7.4/10** |

**The composite score decreased despite genuine improvements.** This is not contradictory — the platform added significant strategic value (+1) and interactivity (+1.5), but the navigation regression (-1.5), visual consistency issues (-1), and export coverage decline (-1) offset those gains. When you more than double dashboard count without proportional investment in IA, UX consistency, and feature parity, the average experience degrades even as the best-case experience improves. The strategic value of the new dashboards is real; the platform just hasn't scaled its infrastructure to match.

---

## 3. Dimension Deep Dives

### 3.1 Information Architecture (6.5/10, down from 8)

**Current menu structure:**

| Group | Dashboards | Count |
|-------|-----------|:-----:|
| *(top-level)* | Overview | 1 |
| **DEVELOPMENT** | Campaign Tracker, Donor Health, DRM Portfolios, Share of Wallet, Major Gifts, The Unasked, Donor Lifecycle, Outreach, Prospect Research, Pledge Management, Board Reporting, HubSpot, Silence Alerts, WealthEngine, Nonprofit Boards | 15 |
| **FINANCE** | Financial Statements, Stripe Analytics, GiveCloud, Ramp Analytics, AP & Expense | 5 |
| **OPERATIONS** | Facilities, Project Tracker, Monday.com, Voice Agent, Immersive Travel, Holdings | 6 |
| **ANALYTICS** | Data Quality, Data Duel, Ecobee Trends, Chart Gallery, Cohort Analysis, Retention Flow, Community Network | 7 |

**Critical issues:**

1. **DEVELOPMENT has 15 items.** This is the single largest IA failure. A DRM scrolling through the sidebar must parse Campaign Tracker, Donor Health, DRM Portfolios, Share of Wallet, Major Gifts, The Unasked, Donor Lifecycle, Outreach, Prospect Research, Pledge Management, Board Reporting, HubSpot, Silence Alerts, WealthEngine, and Nonprofit Boards — most of which are irrelevant to their role. The v2 concern about 7 items in FUNDRAISING was already flagged; 15 is untenable.

2. **Category naming confusion.** "Development" is the nonprofit term for fundraising, but it now contains marketing tools (HubSpot), external research (WealthEngine, Nonprofit Boards), and board governance (Board Reporting). The category has become a dumping ground.

3. **ANALYTICS is audience-confused.** Cohort Survival, Retention Flow, and Community Network are strategic donor analytics that belong with Development. Data Duel and Chart Gallery are internal/experimental tools. Ecobee Trends is facilities data. These 7 dashboards share a label but not an audience.

4. **Silence Alerts is still in the menu.** The v2 review noted SilenceAlertsDashboard.tsx was dead code (not imported in App.tsx). It's now *both* imported in App.tsx *and* still a separate menu item — the merge into Outreach was partially reversed or never completed.

5. **Flat groups, no collapsibility.** At 15 dashboards, non-collapsible groups worked. At 34, the sidebar requires scrolling to reach ANALYTICS. The `type: 'group'` Ant Design pattern does not support collapse.

**What would move this to 8:** Collapsible sub-menus, max 7-8 items per group, proper subcategorization (see Section 6 for detailed recommendation).

### 3.2 Data Quality & Freshness (7.5/10, down from 8)

**Improvements since v2:**
- Schema validation (`validate-data.ts`) with 20+ registered file schemas and field-level type checking
- `DataFreshness` component now shows relative timestamps, stale warnings (>12h), and a formatted date
- Refresh button in Overview (re-fetches same static JSON, but UX signal is right)
- `import.meta.env.BASE_URL` used consistently across all new dashboards (v2 fetch path inconsistency fixed)

**New concerns:**

1. **Analytical models presented as data.** The `donorAnalytics.ts` utility infers cohort year from all-time recognition divided by average annual giving, estimates capacity from WealthEngine net worth brackets, and classifies lifecycle segments from FY24-FY26 deltas. These are reasonable models, but they're presented in dashboards as facts. The Cohort Survival dashboard shows "Cohort: ≤2005" as if that's a known acquisition date — it's an inference. The Share of Wallet shows "Annual Capacity: $250,000" derived from a net worth bracket lookup table. **Users need to understand these are estimates, not Salesforce data.**

2. **5 dashboards share `donor_data.json`.** Share of Wallet, Donor Lifecycle, Cohort Survival, Retention Flow, and Community Network all derive from the same 1,000-record donor data file. This is architecturally efficient but means a bad data refresh propagates to 5 dashboards simultaneously. The schema validation file (`schemas.ts`) does not include a schema for `donor_data.json`, `unasked.json`, `pipeline-data.json`, `network-data.json`, `voice-agent.json`, `holdings.json`, or the `travel/` directory — the newer data files bypassed validation.

3. **Empty `DataFreshness` on new dashboards.** Donor Lifecycle, Cohort Survival, Retention Flow, and Community Network pass empty strings to `DataFreshness`, meaning no freshness indicator renders. These dashboards give users no signal about data currency.

4. **Overview shows "undefined · —" for Top Gift.** The screenshot captures a data access bug where `topGift` renders "undefined" for the donor name. The `@ts-nocheck` at the top of OverviewDashboard.tsx masks these issues.

5. **Several zero/empty metrics.** Board Participation at 0%, DRM Portfolio at 0 donors, Ramp Spend YTD at $0, $0 assets for Holdings — either these data pipelines aren't running or the test data needs updating. On a public GitHub Pages URL, this looks broken.

**What would move this to 9:** Schema validation for ALL data files (not just original 20), confidence indicators on modeled vs factual data, non-empty DataFreshness dates on all dashboards, and fixing the Overview's `undefined` display bug.

### 3.3 Visual Design (8.5/10, down from 9.5)

**What's working well:**
- Section-colored `Tag` badges (Development blue, Finance green, Analytics teal, Operations purple) give each dashboard visual identity and help users know which zone they're in
- `DASHBOARD_CARD_STYLE`, `PLOTLY_BASE_LAYOUT`, and `PLOTLY_COLORS` constants in `dashboardStyles.ts` enforce consistency
- New dashboards follow the standards document pattern: KPI row → chart section → table → DataFreshness footer
- Theme constants fully adopted — zero hardcoded hex values in new dashboard files

**What's concerning:**

1. **Embedded iframes break visual consistency.** Cohort Survival has two embedded iframes (`cohort-survival.html`, `mortality-model.html`). Retention Flow has one (`retention-sankey.html`). Holdings has one (`holdings-dashboard.html`). These iframes have their own styling, fonts, and color palettes that may not match the parent application. The "Embedded Fallback" tab label in Cohort and Retention suggests these are legacy visualizations being preserved, but they sit alongside native Plotly charts with "Native Plotly" and "Embedded Fallback" tabs — a confusing UX pattern.

2. **D3 force graph interaction model differs from everything else.** The Community Network dashboard uses D3 with drag, zoom, and force simulation. Every other dashboard uses Plotly with `displayModeBar: false`. The D3 chart responds to mouse drag differently than Plotly charts. This is not a bug — D3 was the right choice for force-directed graphs — but it creates an interaction inconsistency.

3. **Sidebar is visually cluttered.** 34 menu items with identical icon sizes and spacing creates a wall of text. The screenshot shows sidebar text clipping ("Jew..." for "Jewish Federation of San Diego") and some labels truncating on the left edge.

4. **Card density varies.** Holdings has 3 KPIs and a 3-row table — visually sparse. WeeklyAskListDashboard has 626 lines of dense, multi-section layout. The viewer experience ranges from "is this finished?" to "information overload."

**What would move this to 9.5:** Eliminate iframes in favor of native Plotly/D3 implementations, add consistent card density guidelines to DASHBOARD-STANDARDS.md, and fix sidebar clipping.

### 3.4 Interactivity (6.5/10, up from 5)

**Genuine improvements:**
- **Community Network D3 graph** — zoom, pan, drag, search filter, giving-level filter. This is the platform's first truly interactive visualization
- **The Unasked** — tier filter and DRM filter allow drilling into specific segments
- **Share of Wallet** scatter plot — Plotly hover tooltips show donor name, capacity, and recognition
- **Voice Agent** — daily/weekly tab toggle for call volume
- **Cohort Survival** — native Plotly / embedded fallback tab toggle

**Still missing:**
- No cross-dashboard drill-through (clicking a donor name doesn't navigate anywhere)
- No date range selectors on new dashboards (the Campaign Tracker pattern wasn't replicated)
- Sorting on table columns exists on Major Gifts and The Unasked but not on all tables
- No bookmark/favorite dashboards
- No dashboard-level URL routing (can't share a link to a specific dashboard)

**What would move this to 8:** URL-based routing (React Router or hash routing), donor name click → slide-out profile, date range selectors on Donor Lifecycle and Cohort dashboards.

### 3.5 Export & Distribution (7/10, down from 8)

**v2 had CSV export on 13 of 15 dashboards (87% coverage).** v3 has CSV export on approximately 13 of 34 dashboards (~38% coverage). The new dashboards (Share of Wallet, Donor Lifecycle, Community Network, Voice Agent, Immersive Travel, Major Gifts, The Unasked, Cohort Survival, Retention Flow, Holdings) were not reviewed for CsvExport integration — none of the 10 new dashboard files import the `CsvExport` component.

- PDF export remains on only 2 dashboards (Board Reporting, Financial Statements) — 6% coverage
- Print CSS remains on only 2 dashboards — 6% coverage
- No shareable URLs for individual dashboards

**What would move this to 9:** CSV export on all 34 dashboards (or at minimum, all dashboards with tables), PDF export on at least 5 high-value dashboards, and URL-based deep linking.

### 3.6 Operational Intelligence (7.5/10, up from 7)

**New operational capabilities:**
- **Voice Agent Dashboard** — monitoring call volume, completion rates, and agent utilization. This is genuinely useful for overseeing the 5-agent ElevenLabs deployment
- **Major Gifts Pipeline** — funnel visualization, close rates, and top prospects table. Classic moves management reporting
- **Immersive Travel** — trip capacity tracking with fill rates and revenue. Solves a real operational gap (trip registrations were previously tracked in spreadsheets)
- **UJF Holdings** — separate entity financials. Currently a placeholder ("Financial overview placeholder until holdings feeds are fully populated") but the structure is right

**Still missing:**
- No push notifications or alerting system (v2 gap #3, unchanged)
- No embedded Salesforce actions (v2 gap #4, unchanged)
- Voice Agent dashboard shows call data but doesn't surface quality issues or failed calls
- Major Gifts has no velocity tracking (how long have prospects been in each stage?)
- Immersive Travel has no waitlist management or deadline alerts

**What would move this to 9:** Notification system (even email-based), stage-duration tracking on Major Gifts, and real-time voice agent status (not static JSON).

### 3.7 Strategic Value (8/10, up from 7)

**This is v3's strongest contribution.** The 10 new dashboards include several that would be considered premium features in commercial donor analytics platforms:

1. **Share of Wallet** — Comparing FY26 recognition against WealthEngine capacity estimates to identify donors giving below their means. The SOW histogram and capacity scatter plot are exactly what a VP of Development needs for strategy sessions. The "Top Upgrade Opportunities" table sorted by capacity gap is immediately actionable.

2. **The Unasked** — Donors with modeled capacity and no tracked solicitation. This is a prospecting gold mine. Tier-based segmentation (Tier 1: $100K+, Tier 2: $25K+, etc.) with DRM filtering allows portfolio-level targeting.

3. **Cohort Survival Analysis** — First-gift-year cohorts tracked across FY24-FY26 with survival curves and retention heatmaps. This answers the question "which vintage of donors are we losing?" — a question most nonprofits can't answer.

4. **Retention Flow** — Sankey diagram showing FY25 donors flowing into Retained, Upgraded, Downgraded, and Lapsed segments with dollar quantification. "Lapsed Dollars at Risk" is a powerful metric for making the case for retention investment.

5. **Donor Lifecycle** — Migration matrix showing donor movement between giving bands. The heatmap visualization makes patterns visible that would be invisible in a table.

These five dashboards represent a meaningful step toward predictive/prescriptive analytics. They don't just report what happened — they surface what to do about it.

**What would move this to 9:** Actionable recommendations (e.g., "These 12 Tier 1 Unasked donors should be assigned to DRMs this week"), predictive churn scoring, and historical trend analysis (are we getting better or worse at retaining cohorts?).

### 3.8 Developer Experience (7.5/10, NEW)

**Strengths:**
- **CI/CD pipeline** — GitHub Actions: push to main → npm ci → validate data → build → deploy to gh-pages. Clean, standard, reproducible
- **DASHBOARD-STANDARDS.md** — comprehensive style guide covering file structure, imports, component patterns, chart configs, formatting rules, and anti-patterns ("DO NOT" section). Well-written and actionable
- **Schema validation** — `validate-data.ts` runs in CI, catches missing fields and type mismatches. Custom path resolver handles nested fields and array wildcards
- **Shared utilities** — `donorAnalytics.ts` centralizes SOW calculation, lifecycle classification, cohort inference, and donor record parsing. `dashboardStyles.ts` centralizes Plotly config. `formatters.ts` provides null-safe formatting. These prevent copy-paste drift
- **`import.meta.env.BASE_URL`** — used consistently in all new dashboards, fixing the v2 fetch path issue
- **TypeScript interfaces** — every data shape has a typed interface (with the notable exception of Overview's `@ts-nocheck`)

**Weaknesses:**
1. **`@ts-nocheck` on Overview.** The most-viewed dashboard bypasses TypeScript entirely. The `type D = Record<string, any>` pattern and loose `safe()` wrapper are pragmatic but mask real bugs (the "undefined · —" display issue)
2. **SilenceAlertsDashboard.tsx still exists.** v2 flagged this as dead code. It's now re-imported and back in the menu — the merge into Outreach was incomplete or reverted
3. **Schema validation coverage gap.** 20 of ~30 data files have validation schemas. The 10 newest data files (`donor_data.json`, `unasked.json`, `pipeline-data.json`, `network-data.json`, `voice-agent.json`, `holdings.json`, `travel/*.json`) do not
4. **No linting in CI.** The pipeline runs `npm run validate` (data schemas) but doesn't enforce ESLint or TypeScript strict mode
5. **No test coverage.** No unit tests, no component tests, no integration tests. The utility functions in `donorAnalytics.ts` (lifecycle classification, SOW calculation, cohort inference) are ideal candidates for unit testing

**What would move this to 9:** Remove `@ts-nocheck`, add schemas for all data files, add ESLint + `tsc --noEmit` to CI, and add unit tests for utility functions.

---

## 4. v2 → v3 Score Comparison

| Dimension | v2 | v3 | Δ | Explanation |
|-----------|:--:|:--:|:-:|-------------|
| Information Architecture | 8 | 6.5 | -1.5 | 34 dashboards broke the IA that worked at 15 |
| Data Quality & Freshness | 8 | 7.5 | -0.5 | Schema validation helps, but model-as-data and empty freshness dates hurt |
| Visual Design | 9.5 | 8.5 | -1 | Iframes, D3/Plotly inconsistency, sidebar clutter |
| Interactivity | 5 | 6.5 | +1.5 | D3 graph, filters on Unasked/SOW, tabs |
| Export & Distribution | 8 | 7 | -1 | Coverage rate dropped from 87% to ~38% |
| Operational Intelligence | 7 | 7.5 | +0.5 | Voice Agent, Major Gifts, Travel fill real gaps |
| Strategic Value | 7 | 8 | +1 | SOW, Cohort, Retention, Unasked are genuine strategic tools |
| Developer Experience | — | 7.5 | *new* | CI/CD, standards, validation, shared utilities |

**Note on score methodology:** Scores are absolute, not relative. A feature that was "comprehensive at 15 dashboards" (CSV export) becomes "incomplete at 34 dashboards" even though nothing was removed. The platform's ambition grew; the scoring reflects whether the infrastructure matches the ambition.

---

## 5. Top 5 Strengths

1. **Strategic donor analytics suite.** Share of Wallet, The Unasked, Cohort Survival, Retention Flow, and Donor Lifecycle collectively represent a donor intelligence capability that most nonprofits of JFSD's size would pay $30-50K annually for. These aren't vanity dashboards — they answer specific strategic questions about capacity gaps, unasked potential, cohort decay, and retention economics.

2. **Shared analytical utility layer.** `donorAnalytics.ts` centralizes lifecycle classification, SOW calculation, cohort year inference, and donor record parsing. When five dashboards derive from the same data, having one source of truth for the analytics logic prevents divergent calculations. The `parseDonorRecords()` function's null-safe handling of every Salesforce field is especially well-done.

3. **CI/CD and engineering maturity.** The GitHub Actions pipeline (push → validate → build → deploy) with data schema validation is a real engineering practice, not a checkbox. The DASHBOARD-STANDARDS.md is actionable, specific, and comprehensive. The section-banner color system gives each dashboard domain identity. This is a platform being built with discipline.

4. **Overview as executive command center.** The Overview dashboard aggregates 16 data files into a single-pane view with hero KPIs, campaign progress, weekly pulse, system health, and quick links to all 19 dashboards. The quick links show live metrics from the underlying data (not just labels). The refresh button and DataFreshness component create the right UX pattern even while data remains static.

5. **D3 Community Network graph.** The force-directed relationship graph with zoom, drag, search, and giving-level filtering is the platform's most technically ambitious visualization. The implementation is clean — proper D3 lifecycle management with cleanup on unmount, responsive SVG viewBox, and collision avoidance. It demonstrates the platform can go beyond standard chart libraries when the visualization demands it.

---

## 6. Top 5 Gaps / Risks

### Gap 1: No Authentication or Access Control (v2 #1 — UNCHANGED)

**Status: Still critical. Now more urgent.**

At 15 dashboards, the lack of authentication was a blocker for organizational rollout. At 34 dashboards — including donor capacity estimates, solicitation gaps, major gift pipeline data, and voice agent monitoring — the risk surface has more than doubled. The platform is deployed to a public GitHub Pages URL. Anyone with the URL can view:
- Donor names, giving amounts, and capacity estimates
- Major gift pipeline with prospect names and dollar amounts
- Voice agent call logs with timestamps
- Financial statements and AP data

**Risk:** If this URL is discovered or shared, it exposes sensitive donor and financial information with no access barrier. GitHub Pages URLs are indexed by search engines unless explicitly blocked.

**Assessment:** This remains the #1 gap. The 34-dashboard surface area makes it more urgent, not less. The platform cannot be shared beyond 3 power users without authentication.

**Recommendation:** Implement authentication before any further dashboard expansion. Options: Azure AD OAuth (Graph API creds already exist), Cloudflare Access (zero-code), or a simple API key gate.

### Gap 2: Navigation Collapse (NEW — #2 priority)

The sidebar has 34 items in 4 flat, non-collapsible groups. DEVELOPMENT alone has 15 entries — more dashboards than the entire v2 platform. This is the most visible UX regression in v3.

**Impact:** Users must scroll to reach lower sections. First-time users face decision paralysis. The cognitive load of choosing between 15 development dashboards is high.

**Recommendation:** See Section 7 for a detailed restructuring proposal. Summary: restructure into 6-8 collapsible groups with max 5-7 items each. Move analytics dashboards into their parent domains (Cohort Analysis → Development, Ecobee Trends → Operations).

### Gap 3: Static Data at Scale (v2 #2 — WORSE)

At 15 dashboards, static JSON was a limitation. At 34 dashboards with ~30 data files, it's a systemic constraint. Five dashboards share `donor_data.json` — a single stale file degrades five views. The Overview aggregates 16 data files, any of which could be outdated.

The `DataFreshness` component now shows "Updated 11h ago" — but several new dashboards pass empty strings, showing no freshness indicator at all. Users of Cohort Survival, Retention Flow, Donor Lifecycle, and Community Network have no idea how old the data is.

**Assessment:** The static data architecture has reached its practical limit. Adding more dashboards without live data pipelines creates an increasingly brittle system where refresh failures cascade across the platform.

### Gap 4: Export Coverage Regression (NEW)

v2 achieved 87% CSV coverage (13/15 dashboards). v3 has approximately 38% coverage (~13/34). None of the 10 new dashboards appear to integrate the `CsvExport` component. The Upgrade Opportunities table in Share of Wallet, the Top Prospects table in Major Gifts, the Most Connected Nodes table in Community Network — these are all tables users would want to export.

**Impact:** Users who discovered and relied on CSV export in v2 will find it missing on the dashboards they use most.

### Gap 5: Model Transparency (NEW)

Five dashboards derive analytics from models in `donorAnalytics.ts`:
- **Cohort year** — inferred from all-time recognition / recent average annual giving
- **Annual capacity** — looked up from a net worth bracket → dollar mapping table
- **SOW percentage** — recognition / (WealthEngine 5-year capacity / 5)
- **Lifecycle segment** — classified from FY24-FY26 giving transitions

These are reasonable models, but they're presented as factual data. A user viewing "Cohort: 2006-2010" doesn't know this is an inference. A user seeing "Annual Capacity: $250,000" doesn't know this is derived from a net worth bracket, not a wealth screening.

**Risk:** Decision-makers may over-rely on modeled data without understanding its limitations. A DRM may present "The Unasked" tier assignments to a prospect without knowing the capacity estimate is a rough bracket lookup.

**Recommendation:** Add visual indicators (tooltip, icon, or footnote) distinguishing factual data (from Salesforce) from modeled/inferred data. The Donor Lifecycle dashboard's subtitle "Lifecycle segments are inferred from FY24-FY26 giving transitions" is a good start — apply this pattern everywhere.

---

## 7. New Dashboard Assessment

### Individual Dashboard Reviews

| # | Dashboard | Useful? | Right Category? | Right Audience? | Grade |
|---|-----------|:-------:|:---------------:|:---------------:|:-----:|
| 1 | **Share of Wallet** | ✅ Highly useful | ✅ Development | VP Dev, DRMs | A- |
| 2 | **Donor Lifecycle** | ✅ Useful | ⚠️ Should be in Development, not Analytics | David, Sharon | B+ |
| 3 | **Community Network** | ⚠️ Interesting but niche | ⚠️ Fits Analytics | David, Research team | B |
| 4 | **Voice Agent** | ✅ Useful for monitoring | ✅ Operations | David, IT | B+ |
| 5 | **Immersive Travel** | ✅ Fills real gap | ✅ Operations | Program staff, David | B |
| 6 | **Major Gifts** | ✅ Essential for fundraising | ✅ Development | VP Dev, Major Gift Officers | A- |
| 7 | **The Unasked** | ✅ High strategic value | ✅ Development | VP Dev, DRMs | A |
| 8 | **Cohort Analysis** | ✅ Strong analytical tool | ⚠️ Should be in Development | David, VP Dev | A- |
| 9 | **Retention Flow** | ✅ Strong analytical tool | ⚠️ Should be in Development | David, VP Dev | B+ |
| 10 | **UJF Holdings** | ⚠️ Placeholder state | ✅ Finance (not Operations) | David, Board | C+ |

### Detailed Notes

**Share of Wallet (A-):** The strongest new addition. SOW histogram, capacity scatter plot, and Upgrade Opportunities table are all well-executed. The `calculateSowPercent()` function correctly uses annualized 5-year capacity. Deduction: no CSV export, and the capacity model transparency issue noted above.

**Donor Lifecycle (B+):** The migration heatmap (FY25 band → FY26 band) is an elegant visualization of donor movement. The lifecycle segment bar chart is standard but effective. Deduction: placed in the wrong category (listed under ANALYTICS but is fundamentally a donor analysis tool), empty DataFreshness date, and the YoY tab toggle could show both views simultaneously rather than hiding one.

**Community Network (B):** Technically impressive D3 implementation. The force-directed graph with search, filter, and zoom is well-built. However, the use case is unclear: who looks at this and what decision does it drive? The "Most Connected Nodes" table is informational but not actionable. This feels like a showcase feature more than an operational tool.

**Voice Agent (B+):** Correctly placed in Operations. The daily/weekly call volume tabs, agent detail table, and completion rate KPIs are useful for monitoring the ElevenLabs deployment. The DEFAULT_AGENTS fallback array is a nice touch for when data isn't loaded. Deduction: no quality metrics (sentiment, call outcome), no alerting on completion rate drops.

**Immersive Travel (B):** Fills a real operational gap — trip registrations were previously in spreadsheets. The trip cards with status tags, fill rates, and revenue per trip are well-designed. The 3-file data architecture (trips, registrations, payments) is properly normalized. Deduction: no waitlist tracking, no deadline alerts, no participant list view.

**Major Gifts (A-):** The funnel visualization is the right chart type for pipeline stages. The Top Prospects table with sortable Amount column and Close Date is immediately useful. The `mapStage()` function that normalizes stage names into buckets is pragmatic. Deduction: no velocity tracking (days in stage), no win/loss trend analysis, and the funnel uses generic bucket names rather than actual Salesforce stage names.

**The Unasked (A):** The most actionable new dashboard. Tier segmentation, DRM filtering, capacity histogram, and a sorted donor table create a clear workflow: filter → identify → assign → solicit. The `estimateCapacity()` function with provided-capacity-first, then model-based fallback is well-designed. The tier thresholds ($100K/$25K/$5K) are appropriate for JFSD's donor base.

**Cohort Survival (A-):** Survival curves by cohort vintage and the retention heatmap are best-in-class donor analytics. The `inferCohortYear()` function's approach of estimating years from all-time/average is a reasonable heuristic. The "Embedded Fallback" tabs suggest these visualizations existed before the dashboard and were brought in. Deduction: cohort year inference should be more prominently flagged as a model, and the embedded iframes break visual consistency.

**Retention Flow (B+):** The Sankey diagram clearly shows donor flow from FY25 to FY26 outcomes. "Lapsed Dollars at Risk" is a powerful KPI. The distinction between retained dollars (min of FY25 and FY26) and lapsed dollars (FY25 total for lapsed donors) is a thoughtful calculation. Deduction: empty DataFreshness date, "Embedded Fallback" iframe, and no trend view (is retention improving or declining year over year?).

**UJF Holdings (C+):** Clearly labeled as a placeholder ("Financial overview placeholder until holdings feeds are fully populated"). Three KPIs (assets, liabilities, net income), a 3-row table repeating those KPIs, and an embedded iframe. This is fine as scaffolding but shouldn't count toward the platform's dashboard count yet. Misplaced in Operations — this is Finance. Currently showing $0 across all metrics.

---

## 8. Menu Organization Assessment & Recommendation

### Current State: 34 items across 4 flat groups

The sidebar requires vertical scrolling on a standard 1080p display. DEVELOPMENT's 15 items are overwhelming. The ANALYTICS section mixes strategic donor analytics (Cohort, Retention) with utility dashboards (Chart Gallery, Data Duel) and operational data (Ecobee Trends).

### Recommended Restructure: 7 collapsible groups

```
📊 Overview

▸ CAMPAIGN (4)
    Campaign Tracker
    Board Reporting
    Major Gifts
    Pledge Management

▸ DONOR INTELLIGENCE (6)
    Donor Health
    DRM Portfolios
    Share of Wallet
    The Unasked
    Donor Lifecycle
    Outreach

▸ RESEARCH & ANALYTICS (5)
    Prospect Research
    WealthEngine
    Cohort Analysis
    Retention Flow
    Community Network

▸ MARKETING & ENGAGEMENT (3)
    HubSpot
    Nonprofit Boards
    Silence Alerts

▸ FINANCE (6)
    Financial Statements
    Stripe Analytics
    GiveCloud
    Ramp Analytics
    AP & Expense
    UJF Holdings

▸ OPERATIONS (5)
    Facilities
    Ecobee Trends
    Voice Agent
    Immersive Travel
    Project Tracker

▸ TOOLS (3)
    Data Quality
    Data Duel
    Chart Gallery
    Monday.com
```

**Key changes:**
1. Split DEVELOPMENT into CAMPAIGN, DONOR INTELLIGENCE, and RESEARCH & ANALYTICS
2. Move Holdings from Operations to Finance
3. Move Ecobee Trends from Analytics to Operations
4. Move Cohort Analysis and Retention Flow from Analytics to Research & Analytics
5. Create TOOLS for internal/utility dashboards
6. Use collapsible groups (`type: 'submenu'` in Ant Design instead of `type: 'group'`)
7. Maximum 6 items per group

**Implementation effort:** ~2 hours. The menu definition is already a data structure in App.tsx — restructuring requires only changing the array.

---

## 9. Overall Readiness Assessment

### Who Can Use This Now

| User | Ready? | Notes |
|------|:------:|-------|
| **David (CFO)** | ✅ Yes | Sees everything, navigates by memory, uses Overview as entry point |
| **Sharon (Donor Systems)** | ✅ Yes | Donor Health, Data Quality, DRM Portfolios are her tools. New donor analytics dashboards add value |
| **James (Accounting)** | ✅ Yes | Financial Statements, AP & Expense, Ramp — unchanged and still strong |
| **VP of Development** | ⚠️ Partially | Major Gifts, Share of Wallet, The Unasked, Campaign Tracker are excellent — but 34 dashboards with no role filtering is overwhelming |
| **DRMs** | ❌ Not yet | Too many dashboards. Need role-based filtering (show only: DRM Portfolios, Outreach, Major Gifts, The Unasked). No auth = no access |
| **Board Members** | ❌ Not yet | No authentication. Financial and operational data exposed. Board Reporting is ready; the platform isn't |
| **CEO** | ❌ Not yet | Overview is excellent, but the URL can't be shared without auth |
| **Program Staff** | ❌ Not yet | Immersive Travel is useful but buried in a 34-item sidebar. No auth |

### What's Needed for Broader Rollout

| Gate | Effort | Impact |
|------|--------|--------|
| **Authentication** (Azure AD or Cloudflare Access) | 1-2 weeks | Unblocks all non-power-user access |
| **Role-based sidebar filtering** | 2-3 days (after auth) | Reduces cognitive load from 34 → 4-6 per role |
| **Menu restructure** (collapsible groups) | 2 hours | Immediate UX improvement for all users |
| **CSV export on new dashboards** | 1 day | Restores parity with v2 coverage |
| **Fix Overview `@ts-nocheck` and display bugs** | 4 hours | Fixes "undefined" display, restores type safety |
| **Schema validation for all data files** | 2-3 hours | Catches data issues before they reach production |
| **Non-empty DataFreshness dates** | 1 hour | Users see when data was last updated |
| **URL-based routing** | 1 day | Enables sharing links to specific dashboards |

### Priority Sequencing

**Week 1 (quick wins):**
- Menu restructure (collapsible groups, 7 categories)
- CSV export on all 10 new dashboards
- Fix Overview `@ts-nocheck` and "undefined" bug
- Schema validation for missing data files
- Non-empty DataFreshness dates

**Week 2-3:**
- Authentication (Azure AD OAuth or Cloudflare Access)
- URL-based routing (React Router hash mode)
- Role-based sidebar filtering

**Month 2:**
- Model transparency indicators on derived metrics
- Remove embedded iframes (native Plotly implementations)
- Delete or properly merge SilenceAlertsDashboard.tsx
- Add unit tests for `donorAnalytics.ts`

**Quarter 2:**
- Live data pipelines (start with `donor_data.json` since 5 dashboards depend on it)
- Notification system for Voice Agent, Facilities, and failed charges
- Mobile-optimized DRM view
- Donor 360 profile (click any name → slide-out panel)

---

## 10. Competitive Benchmark (Updated)

| Capability | Fed Analytics v3 | Blackbaud Analytics | Bloomerang | DonorPerfect | DonorSearch |
|-----------|-----------------|-------------------|------------|-------------|-------------|
| **Multi-source integration** | ✅ 8+ systems | ❌ Ecosystem only | ❌ Single | ❌ Single | ❌ Single |
| **Custom dashboards** | ✅ 34 purpose-built | ⚠️ Templates | ⚠️ Limited | ⚠️ Basic | ❌ |
| **SOW / Capacity analysis** | ✅ Native | ❌ | ❌ | ❌ | ✅ External |
| **Cohort survival curves** | ✅ Native | ❌ | ⚠️ Basic | ❌ | ❌ |
| **Retention Sankey** | ✅ Native | ❌ | ⚠️ | ❌ | ❌ |
| **Network graph** | ✅ D3 force-directed | ❌ | ❌ | ❌ | ❌ |
| **Financial statements** | ✅ Full GAAP 5-tab | ❌ | ❌ | ❌ | ❌ |
| **HVAC / Facilities** | ✅ With trends | ❌ | ❌ | ❌ | ❌ |
| **Voice agent monitoring** | ✅ Native | ❌ | ❌ | ❌ | ❌ |
| **Authentication** | ❌ Missing | ✅ | ✅ | ✅ | ✅ |
| **Live data** | ❌ Static JSON | ✅ | ✅ | ✅ | ✅ |
| **Mobile app** | ⚠️ Responsive | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **Cost** | Internal build | $10-50K/yr | $3-12K/yr | $3-15K/yr | $5-20K/yr |

**Verdict:** v3's strategic analytics capabilities (SOW, cohort survival, retention flow, network graph) are genuinely differentiated. No single commercial product combines donor intelligence, financial reporting, facilities monitoring, voice agent tracking, and travel management. The breadth advantage is now extraordinary. But the infrastructure gaps (auth, live data, navigation) that commercial products solved years ago continue to limit who can actually use the platform.

---

## 11. Summary

Federation Analytics v3 is a paradox: it's simultaneously the most analytically sophisticated nonprofit analytics platform I've reviewed and a platform that fewer than 5 people can safely use. The new dashboards demonstrate real domain expertise — Share of Wallet, The Unasked, and Cohort Survival are tools that drive strategy, not just reporting. The CI/CD pipeline and design standards bring engineering maturity.

But the platform has outgrown its infrastructure. Authentication was the #1 gap in v2 and remains the #1 gap in v3 — now with double the sensitive data surface. The sidebar that worked at 15 dashboards breaks at 34. Export coverage regressed. Visual consistency suffered from embedded iframes. Several new dashboards present modeled data as factual data.

**The path from 7.4 to 9.0 is clear:**
1. Authentication + role-based access (unlocks organizational use)
2. Menu restructure + URL routing (fixes navigation)
3. Live data pipelines (eliminates static data limitation)
4. Export parity + model transparency (closes quality gaps)
5. Notifications + embedded actions (creates operational platform)

The strategic vision is right. The analytical depth is impressive. The engineering foundation is sound. What's needed now is less "build new dashboards" and more "make the existing 34 work for everyone who needs them."

---

*This review was conducted by examining all 34 dashboard source files (10,075 lines of TypeScript/React), 10 shared component/utility files (1,642 lines), 30+ JSON data files, the CI/CD pipeline configuration, DASHBOARD-STANDARDS.md, schema validation system, theme constants, and the live production deployment. All comparisons reference the v2 review dated February 20, 2026. Live platform accessed March 6, 2026.*
