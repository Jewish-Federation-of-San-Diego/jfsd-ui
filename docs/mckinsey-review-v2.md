# Federation Analytics — Strategic Platform Review (v2)

**Prepared for:** David Fuhriman, CFO  
**Date:** February 20, 2026  
**Scope:** 15-dashboard analytics platform for Jewish Federation of San Diego  
**Classification:** Internal — Draft for Discussion  
**Platform URL:** https://jewish-federation-of-san-diego.github.io/jfsd-ui/  
**Review context:** Follow-up to v1 review; 14 of 19 original recommendations implemented

---

## 1. Executive Summary

Federation Analytics has matured significantly since the v1 review. The platform has evolved from an impressive but view-only data consolidation tool into a more operational intelligence system — one that users can now search, export, print, and navigate with meaningfully less friction. The implementation of 14 recommendations in rapid succession is itself a signal of architectural soundness: the codebase absorbed CSV export on 25+ tables, skeleton loading across all dashboards, a global search system, PDF generation, print optimization, a date range selector, and a tabbed dashboard merger without degradation or architectural debt. **The platform is ready for power-user rollout (David, Sharon, James) and approaching readiness for DRM deployment with 2-3 targeted additions.**

### Top 3 Strengths (updated)
1. **Operational completeness for a 3-person team** — David can search for any donor across dashboards, Sharon can export risk alerts to CSV, James can print financial statements. The search → navigate → export → print workflow now exists end-to-end. This was the platform's most critical gap and it's largely closed.
2. **Consistent design system with centralized tokens** — The migration from 16 copies of `const NAVY = '#1B365D'` to a single `import { NAVY } from '../theme/jfsdTheme'` across all dashboards eliminates an entire class of drift risk. The `statusColors`, `jfsdChartColors`, and Ant Design seed tokens create a coherent design language. All 16 dashboard files (including the legacy SilenceAlertsDashboard.tsx) import from theme.
3. **Contextual intelligence, not just data display** — The Outreach dashboard now combines proactive asks (Ask List) with reactive risk management (Risk Alerts) in a single tabbed view with a badge showing critical count. The Pledge Management dashboard distinguishes "not yet due" from "past due." The DRM Portfolio flags Rabkin as an unassigned pool. These aren't cosmetic changes — they prevent bad decisions.

### Top 3 Gaps (updated)
1. **No authentication or access control** — This remains the platform's single largest barrier to organizational rollout. Every user sees every dashboard, including financial statements, AP data, and data quality scores. A board member opening the app sees internal operational data. Until this is addressed, deployment beyond the core 3 users carries reputational and data-sensitivity risk.
2. **Static data with no refresh mechanism** — All 15 JSON files are pre-computed snapshots. Users cannot trigger a refresh, and there is no visual indicator of data staleness beyond the "as of" date. The date range selector on Campaign Tracker filters pre-loaded data client-side rather than querying a different dataset. This is a ceiling on the platform's utility: it will always feel like a "morning report" rather than a live tool.
3. **No notification or alerting system** — The platform requires manual check-in. Failed recurring charges, server room temperature spikes, and pledge payment defaults all wait silently until someone opens the dashboard. For a platform that surfaces time-sensitive operational data (Facilities, Donor Health, Risk Alerts), the absence of push notifications limits its impact.

---

## 2. Information Architecture Assessment

### Menu Hierarchy

The sidebar now organizes 15 dashboards into four labeled groups:

| Group | Label | Dashboards | Count |
|-------|-------|-----------|-------|
| **Hub** | *(none — top-level)* | Overview | 1 |
| **Fundraising** | `FUNDRAISING` | Campaign Tracker, Donor Health, DRM Portfolios, Outreach, Prospect Research, Pledge Management, Board Reporting | 7 |
| **Finance** | `FINANCE` | Financial Statements, Stripe Analytics, GiveCloud, Ramp Analytics, AP & Expense | 5 |
| **Operations** | `OPERATIONS` | Facilities, Data Quality | 2 |

**Assessment (v1 → v2):** The addition of group labels (`FUNDRAISING / FINANCE / OPERATIONS`) with appropriate styling (11px, 0.5px letter-spacing, 40% white opacity) is a meaningful improvement. The merge of Silence Alerts into Outreach reduced the fundraising section from 8 to 7 dashboards. The cognitive load on first open is now manageable — a new user can immediately identify which section is relevant to them.

**Remaining issues:**
- The fundraising section still has 7 dashboards. A DRM needs to choose between Outreach, DRM Portfolios, Prospect Research, and Pledge Management — all containing overlapping donor data. The v1 recommendation to merge Prospect Research into DRM Portfolios remains valid.
- Board Reporting sits in "Fundraising" but its primary audience is board members, not fundraisers. It could be its own top-level item or under a "Governance" label.
- The groups use `type: 'group'` which renders labels but is not collapsible. For the current 15-dashboard count, this is fine. At 20+, collapsible sub-menus would be needed.

### Audience Mapping (updated)

| Dashboard | David (CFO) | Sharon (Donor Systems) | James (Accounting) | DRMs | Board | CEO |
|-----------|:-----------:|:---------------------:|:------------------:|:----:|:-----:|:---:|
| Overview | ✅ Primary | ✅ | ✅ | | | ✅ |
| Campaign Tracker | ✅ | ✅ | | | | ✅ |
| Donor Health | ✅ | ✅ Primary | | | | |
| DRM Portfolios | ✅ | ✅ | | ✅ Primary | | |
| Outreach | ✅ | ✅ | | ✅ Primary | | |
| Prospect Research | ✅ | ✅ | | ✅ | | |
| Pledge Management | ✅ | ✅ | | | | |
| Board Reporting | ✅ | | | | ✅ Primary | ✅ |
| Financial Statements | ✅ Primary | | ✅ Primary | | | ✅ |
| Stripe Analytics | ✅ | | ✅ | | | |
| GiveCloud | ✅ | ✅ | | | | |
| Ramp Analytics | ✅ | | ✅ Primary | | | |
| AP & Expense | ✅ | | ✅ Primary | | | |
| Facilities | ✅ | | | | | |
| Data Quality | ✅ | ✅ Primary | | | | |

**Key insight (unchanged):** David still sees everything (15 dashboards). DRMs need 3-4. Board members need 1-2. The role-based visibility recommendation (v1 2.1) remains the most important outstanding item for organizational deployment.

### Redundancy Analysis (updated)

The Silence Alerts → Outreach merge was the right call. The tabbed approach (Ask List + Risk Alerts) keeps the data accessible but reduces sidebar noise. The badge on the Risk Alerts tab showing critical count is a nice touch — it creates urgency without requiring a separate dashboard.

**Remaining redundancy:**
- **Prospect Research ↔ DRM Portfolios:** Upgrade prospects and capacity gaps are portfolio management data. The DRM detail view should incorporate prospect data for assigned donors.
- **Campaign thermometer** appears in both Campaign Tracker and Board Reporting. This is intentional (different audiences) and acceptable.

---

## 3. Decision Orientation — "So What?" Audit

| # | Dashboard | Rating | v1 Rating | Decision It Should Drive | Changes Since v1 | Remaining Gaps |
|---|-----------|--------|-----------|-------------------------|-------------------|----------------|
| 1 | **Overview** | 🟢 Action-oriented | 🟡 | "Where should I focus today?" | Quick Links now navigate via `onNavigate` prop ✅. Global search in header enables donor lookup from any page | Quick Links show metrics but no trend indicators (up/down arrows). No "attention needed" prioritization |
| 2 | **Campaign Tracker** | 🟢 Action-oriented | 🟢 | "Are we on track? Where are the gaps?" | Date range selector (Week/Month/Quarter/YTD) filters momentum chart and top gifts ✅. `useMemo` for filtered data is clean | Date range filters client-side only — no new data loads. Sub-campaigns with $0 goals remain noise |
| 3 | **Donor Health** | 🟢 Action-oriented | 🟢 | "What donor issues need attention this week?" | CSV export on tables ✅, skeleton loading ✅ | Strongest action panel in the platform — no changes needed |
| 4 | **DRM Portfolios** | 🟢 Action-oriented | 🟢 | "Which of my donors need attention?" | Rabkin flagged as "Unassigned Pool" and excluded from averages via `isUnassignedPool()` ✅, CSV export ✅ | Still no prospect data integration. LYBUNT list lacks suggested ask amounts |
| 5 | **Outreach** | 🟢 Action-oriented | 🟢 (was Ask List) | "Who should I call and who's at risk?" | Tabbed merge with Risk Alerts ✅. Deceased filtering ✅. Badge on Risk Alerts tab ✅. CSV export on both tabs ✅ | Best decision tool in the platform. The tabbed UX is well-executed |
| 6 | **Prospect Research** | 🟡 Informational | 🟡 | "Who has capacity to give more?" | CSV export added ✅ | Still passive. Trajectory analysis shows trends without recommending next steps. Should be absorbed into DRM Portfolios |
| 7 | **Pledge Management** | 🟢 Action-oriented | 🟡 | "Which pledges need follow-up?" | "Not yet due" vs "past due" distinction ✅. Info alert explaining pledge accounting ✅. Status tags (Current/Past Due/Open-ended) ✅. CSV export ✅ | Upgraded from 🟡 to 🟢. The `getPledgeStatus()` function with 3-year future threshold for open-ended pledges is smart. The 2.7% fulfillment rate now has proper context |
| 8 | **Board Reporting** | 🟡 Informational | 🟡 | "Is the board giving at expected levels?" | Print CSS ✅. PDF export ✅. CSV export on member tables ✅ | Read-only by nature. PDF export is the key addition — board reports are frequently distributed as PDFs. Print styles are thorough |
| 9 | **Financial Statements** | 🟢 Action-oriented | 🟢 | "Are we on budget? Where are the variances?" | Print CSS ✅. PDF export ✅ | Multi-page PDF pagination via `yOffset` loop is well-implemented. Tab nav hidden in print is correct |
| 10 | **Stripe Analytics** | 🔴 Passive display | 🔴 | "Are our payment processing costs acceptable?" | CSV export ✅ | Still the weakest dashboard for decision-making. No recommendations, no action items. Card brand breakdown remains informational |
| 11 | **GiveCloud** | 🟡 Informational | 🟡 | "How is online giving performing?" | CSV export ✅ | Recurring Health section approaches actionability but doesn't close the loop |
| 12 | **Ramp Analytics** | 🟡 Informational | 🟡 | "Where is the organization spending money?" | CSV export ✅ | Department spend vs budget is useful but still overlaps with AP & Expense |
| 13 | **AP & Expense** | 🟢 Action-oriented | 🟢 | "What needs my attention as accounting manager?" | CSV export ✅ | James's Monday morning tool — remains strong |
| 14 | **Facilities** | 🟢 Action-oriented | 🟡 | "Is the building operating normally?" | Relative timestamps ("3h ago") ✅. Stale data warning ✅. Expandable 24h trend charts ✅. Server room gauges ✅. Building summaries ✅ | Upgraded from 🟡 to 🟢. The expanded trend chart with labeled axes, comfort zone shading, and threshold lines transforms this from a status board into a diagnostic tool. The `timeAgo()` function addresses the v1 staleness concern |
| 15 | **Data Quality** | 🟢 Action-oriented | 🟢 | "What data needs to be fixed?" | CSV export ✅ | Score of 24/100 remains alarming and correctly surfaced |

### Summary of Decision Orientation Changes

| Rating | v1 Count (of 16) | v2 Count (of 15) | Change |
|--------|:-:|:-:|--------|
| 🟢 Action-oriented | 7 | 9 | +2 (Pledge Management, Facilities upgraded) |
| 🟡 Informational | 6 | 5 | -1 (one merged, one upgraded, Prospect Research remains) |
| 🔴 Passive display | 1 | 1 | Stripe Analytics unchanged |

---

## 4. Visual & UX Consistency Review

### Pattern Consistency (updated)

The v2 codebase is more consistent than v1. Key improvements:

| Pattern | v1 State | v2 State |
|---------|----------|----------|
| Color constants | 16 local copies of `const NAVY` | ✅ All import from `jfsdTheme.ts` |
| Loading states | `Spin` only, blank page | ✅ `DashboardSkeleton` component with KPI/chart/table placeholders |
| Export capability | None | ✅ `CsvExport` on 13 dashboards (25+ tables) |
| Print support | None | ✅ Print CSS + `PrintButton` on Board Reporting + Financial Statements |
| PDF generation | None | ✅ `PdfExport` on Board Reporting + Financial Statements |
| Search | None | ✅ `GlobalSearch` in header, indexes 8 data files |

### New Component Assessment

**`DashboardSkeleton`** — Clean, minimal implementation. Accepts `kpiCount`, `hasChart`, `hasTable` props. The skeleton matches the actual dashboard layout pattern (title → KPI row → chart card → table card). Uses Ant Design's `Skeleton` component correctly. The fixed `maxWidth: 1400` doesn't match all dashboards (some use 1200, some 1600), but this is a minor visual inconsistency during the brief loading state. **Score: 8/10.**

**`GlobalSearch`** — Well-architected. Lazy-loads and caches a search index built from 8 data files. Debounced search (200ms). Results show donor name with highlighted match, plus context lines per dashboard occurrence (e.g., "Outreach · LYBUNT · $5,000 ask"). Clicking a context line navigates to the relevant dashboard. Desktop/mobile responsive with icon-to-expanded pattern on mobile. **Score: 9/10.** One concern: the search only indexes donor names, not amounts or campaign names — searching "$10,000" or "Annual Campaign" returns nothing.

**`CsvExport`** — Minimal and correct. Handles comma/quote escaping. Uses `Blob` + `URL.createObjectURL` for download. The column definition requires a separate `csvColumns` array in each dashboard, which is slightly redundant with the table `columns`, but this allows controlling which fields export (e.g., excluding render-heavy columns). **Score: 8/10.**

**`PdfExport`** — Uses `html2canvas` + `jsPDF` with dynamic imports (good for bundle size). Scale factor of 2 for retina quality. Multi-page support via `yOffset` loop. Letter-size output. **Score: 7/10.** The rasterization approach means PDFs are images, not selectable text. File sizes will be large. For financial statements, a true HTML-to-PDF renderer (e.g., Puppeteer server-side, or `react-pdf`) would produce smaller, searchable output. Acceptable for current use case.

**`PrintButton`** — One-liner calling `window.print()`. The real work is in the print CSS, which is comprehensive: hides sidebar, navigation, export buttons; removes shadows and backgrounds; preserves chart colors via `print-color-adjust: exact`; avoids page breaks inside cards and table rows; hides tab navigation for Financial Statements. **Score: 8/10.** The print CSS is well-structured and covers edge cases.

### Typography (unchanged concerns)

- KPI value sizes still vary: `fontSize: 18` (Outreach KPIs) vs `fontSize: 28` (theme default for `Statistic`). This is intentional density variation but creates inconsistency when scanning across dashboards.
- Section titles remain a mix of `Title level={3-5}` and `Text strong`.

### Chart Types (unchanged)

All charts remain hand-rolled SVG. The new 24h trend charts in Facilities (`ExpandedTrendChart`) continue this approach with labeled axes, comfort zone shading, and threshold lines. The SVG approach scales well for these charts. The original v1 observation stands: no interactivity (zoom, pan, granular tooltips), but this is an acceptable trade-off for the current audience.

### Mobile Readiness (slightly improved)

- GlobalSearch has a mobile variant (icon → expanded input on click)
- Mobile menu button classes are properly managed
- Observation: the Outreach tabbed view works well on tablet but the two-level nesting (tabs → full-width table) requires significant scrolling on phone

### maxWidth Inconsistency

Dashboards use varying `maxWidth` values:

| maxWidth | Dashboards |
|----------|-----------|
| 1200 | Campaign Tracker, several others |
| 1400 | DashboardSkeleton default, Facilities |
| 1600 | Outreach (WeeklyAskList), DRM Portfolios |

This creates slight layout inconsistency when switching between dashboards — content width jumps. Not user-impacting but noticeable.

---

## 5. Data Quality & Freshness

### Data Freshness (updated)

All 15 JSON files dated **2026-02-20**, confirming active data pipelines. The v1 concerns have been partially addressed:

| v1 Concern | v2 Status |
|------------|-----------|
| Facilities staleness (6am reading at 3pm) | ✅ **Addressed** — `timeAgo()` relative timestamps show "3h ago", "12h ago". Stale data warning surfaces when readings are old |
| Stripe monthly aggregation | ⚠️ **Unchanged** — still monthly buckets |
| Financial Statements through Jan 31 | ⚠️ **Unchanged** — structural (GL data lags by close cycle) |

### Data Issues (updated from v1)

| v1 Issue | v2 Status |
|----------|-----------|
| Rita S. Hartman Z"L on Ask List (#1 ranked, deceased) | ✅ **Fixed** — `isDeceased()` regex filters Z"L notation. Alert shows count of filtered donors |
| Michael Rabkin 30,505 donors (unassigned catch-all) | ✅ **Fixed** — `isUnassignedPool()` flags Rabkin, excluded from portfolio averages |
| Pledge 2.7% fulfillment rate (misleading without context) | ✅ **Fixed** — `getPledgeStatus()` distinguishes "not yet due" vs "past due". Info alert explains pledge accounting |
| Silence Alerts failed charges with `reason: null` | ⚠️ **Unchanged** — data pipeline issue, not UI |
| Campaign WoW -70.3% volatile metric | ⚠️ **Partially addressed** — date range selector lets users switch to month/quarter view, reducing WoW noise. But no rolling average |
| Board Reporting "not matched" members | ⚠️ **Unchanged** — data entry/matching issue upstream |
| Data Quality score 24/100 | ⚠️ **Unchanged** — platform correctly surfaces this; score reflects real SF data quality |

### New Data Concerns

1. **GlobalSearch indexes only 8 of 15 data files.** Board Reporting, Financial Statements, Ramp, AP & Expense, Facilities, Stripe, and Data Quality are not searchable. A search for "Server Room" or a board member's name returns nothing.
2. **Outreach fetches silence-alerts.json via two paths.** The Risk Alerts tab fetches `/jfsd-ui/data/silence-alerts.json` while GlobalSearch fetches `/data/silence-alerts.json` (without base path). One of these will fail depending on deployment context. The main WeeklyAskListDashboard also fetches the same file for badge count. This is three fetches of the same file.
3. **SilenceAlertsDashboard.tsx still exists as a file** but is not imported in App.tsx. This is dead code that should be cleaned up.
4. **Campaign Tracker date range filtering is client-side only.** The `filterByDateRange()` function slices `weeklyMomentum` and filters `topGiftsThisWeek` — but giving levels, donor breakdown, pipeline, and sub-campaigns don't change. This creates a half-filtered view where some cards respond to the selector and others don't.

---

## 6. Missing Capabilities (Updated)

### Addressed Since v1

| v1 Capability Gap | Implementation | Quality |
|------------------|---------------|---------|
| **Date range filtering** | ✅ Campaign Tracker has week/month/quarter/YTD selector | 7/10 — client-side filter of pre-loaded data; only affects momentum and top gifts |
| **Export/Download** | ✅ CSV on 25+ tables across 13 dashboards; PDF on 2 | 9/10 — comprehensive coverage, clean implementation |
| **Sidebar organization** | ✅ Group labels (FUNDRAISING/FINANCE/OPERATIONS) | 9/10 — clean, professional |
| **Overview Quick Links navigation** | ✅ `onNavigate` prop wired to `setSelectedKey` | 10/10 — simple, correct |
| **Deceased donor filtering** | ✅ Regex-based Z"L detection with count alert | 8/10 — catches Z"L; may miss other deceased indicators |
| **Facilities staleness** | ✅ Relative timestamps + stale data warnings | 9/10 — well-executed |
| **Color DRY refactor** | ✅ All dashboards import from `jfsdTheme.ts` | 10/10 — zero local color constants remaining |
| **Silence Alerts → Outreach merge** | ✅ Tabbed dashboard with badge | 9/10 — elegant implementation |
| **Print support** | ✅ Print CSS + PrintButton on Board Reporting + Financial Statements | 8/10 — comprehensive print styles |
| **Rabkin "Unassigned Pool"** | ✅ Flagged and excluded from averages | 9/10 |
| **Skeleton loading** | ✅ DashboardSkeleton on all 16 files | 8/10 — good component, minor maxWidth mismatch |
| **Pledge aging distinction** | ✅ "Not yet due" vs "past due" with status tags | 9/10 — addresses the v1 alarm about 2.7% fulfillment |
| **Global search** | ✅ Cross-dashboard donor search in header | 8/10 — great UX, but only 8 of 15 data files indexed |
| **Facilities enhancements** | ✅ 24h trends, server room gauges, building summaries | 9/10 — transforms Facilities from passive to diagnostic |
| **PDF export** | ✅ html2canvas + jsPDF on Board Reporting + Financial Statements | 7/10 — works but produces raster images, not searchable text |

### Remaining Critical Gaps

| Capability | Impact | Effort | Priority |
|-----------|--------|--------|----------|
| **Authentication (Azure AD OAuth)** | Required for any deployment beyond 3 users. Board members, DRMs, and executives cannot safely access the same unfiltered view | High | 🔴 Critical |
| **Role-based dashboard visibility** | Depends on auth. Filter sidebar by role | High | 🔴 Critical (paired with auth) |
| **Notification system** | Failed recurring, temp alerts, pledge defaults should push via email/Slack/OpenClaw | High | 🟡 High |
| **Embedded Salesforce actions** | "Log Call," "Create Task" in Outreach and DRM Portfolios would close the action loop | High | 🟡 High |
| **Live API queries** | Replace static JSON with on-demand queries. Enables true date range filtering and real-time data | Transformative | 🟡 High (long-term) |

### Nice-to-Have Gaps (updated)

| Capability | Status |
|-----------|--------|
| Comparison mode (FY25 vs FY26) | Still missing |
| Annotations / notes | Still missing |
| Dashboard customization | Still missing |
| Real-time Facilities (WebSocket) | Partially addressed (24h trends exist, but still polling static JSON) |
| Audit trail | Still missing |
| Dark mode | Not needed for this audience |

---

## 7. Prioritized Recommendations (Next Phase)

### Tier 1 — Quick Wins (This Week)

| # | Recommendation | Why It Matters | Effort |
|---|---------------|----------------|--------|
| 1.1 | **Delete `SilenceAlertsDashboard.tsx`** | Dead code. Not imported anywhere. Confuses developers and inflates line counts | 5 min |
| 1.2 | **Fix fetch path inconsistency** | GlobalSearch uses `/data/` while dashboards use `/jfsd-ui/data/`. One will break depending on deployment. Use `import.meta.env.BASE_URL` consistently | 30 min |
| 1.3 | **Expand GlobalSearch to index all data files** | Board member names, financial line items, facilities names should be searchable. Currently only 8 of 15 files indexed | 2-3 hours |
| 1.4 | **Add search by amount and campaign name** | GlobalSearch only matches donor names. Searching "$10,000" or "Annual Campaign 26" returns nothing. Add amount ranges and campaign indexing | 2-3 hours |
| 1.5 | **Normalize `maxWidth` across dashboards** | Pick 1400 and apply consistently. Current mix of 1200/1400/1600 causes layout jumps | 1 hour |
| 1.6 | **Cache silence-alerts.json fetch** | Outreach fetches it 3 times (RiskAlertsContent, badge count, GlobalSearch). Use a shared cache or React context | 1-2 hours |
| 1.7 | **Add CSV export to remaining 2 dashboards** | Overview and Facilities lack CSV export. Overview aggregates data (no single table), but Facilities thermostat list should be exportable | 1 hour |

### Tier 2 — Medium Effort (This Month)

| # | Recommendation | Why It Matters | Effort |
|---|---------------|----------------|--------|
| 2.1 | **Implement authentication (Azure AD OAuth)** | Required for organizational rollout. Graph API creds already exist. Start with simple JWT token gating | 1-2 weeks |
| 2.2 | **Add role-based sidebar filtering** | Once auth exists, map roles to visible dashboards. Board → Overview + Board Reporting. DRM → 4-5 fundraising dashboards. Finance → all finance dashboards | 2-3 days |
| 2.3 | **Make Campaign Tracker date filter comprehensive** | Currently only momentum and top gifts respond to the selector. Giving levels, donor breakdown, pipeline, and sub-campaigns should also filter or show an "FY26 YTD only" indicator | 3-5 days |
| 2.4 | **Add date range selectors to Donor Health and DRM Portfolios** | Campaign Tracker proved the pattern works. Apply it to the next-highest-value dashboards | 3-5 days |
| 2.5 | **Merge Prospect Research into DRM Portfolios** | Add a "Prospects" tab to the DRM detail view showing upgrade opportunities and capacity gaps for that DRM's assigned donors | 3-5 days |
| 2.6 | **Upgrade Stripe Analytics from 🔴 to 🟡** | Add an "Action Items" card: fee optimization recommendations, failed charge retry suggestions, volume anomaly alerts. Even simple rule-based logic would help | 2-3 days |
| 2.7 | **Add data refresh indicator and manual refresh** | Show "Last refreshed: 6:04 AM" prominently. Add a refresh button that re-fetches JSON files. Even without live APIs, this builds trust | 1 day |

### Tier 3 — Strategic (Next Quarter)

| # | Recommendation | Why It Matters | Effort |
|---|---------------|----------------|--------|
| 3.1 | **Build notification system** | Push alerts for: failed recurring, server room temp >78°F, pledge defaults, new major gifts ($5K+). Route through OpenClaw/email/Slack | 1-2 weeks |
| 3.2 | **Embedded Salesforce actions** | "Create Task," "Log Call," "Send Email" buttons in Outreach and DRM Portfolios. Opens SF in new tab or uses SF API to create records inline | 2-3 weeks |
| 3.3 | **Migrate to live API queries (phased)** | Phase 1: Campaign Tracker + Donor Health via Salesforce SOQL. Phase 2: Stripe + GiveCloud real-time. Phase 3: Full migration. Keep JSON files as fallback | 4-6 weeks |
| 3.4 | **Donor 360 profile view** | Click any donor name anywhere → slide-out panel showing their complete profile: giving history, pledges, risk factors, portfolio assignment, contact info, Salesforce link | 2-3 weeks |
| 3.5 | **True PDF rendering** | Replace html2canvas (raster) with server-side Puppeteer or `@react-pdf/renderer` for searchable, smaller PDF output. Financial Statements PDFs should look print-publication quality | 1-2 weeks |
| 3.6 | **Predictive analytics layer** | ML-based donor churn prediction, optimal ask amount modeling, campaign outcome forecasting. Even simple regression (3-year trend → next-year estimate) would add significant value | 3-4 weeks |
| 3.7 | **Mobile-first DRM view** | A simplified 3-dashboard mobile experience for DRMs in the field: My Portfolio, My Calls Today, Quick Search. React Native or PWA | 3-4 weeks |

---

## 8. Competitive Benchmark (Updated)

### vs. Nonprofit Analytics Platforms

| Capability | Federation Analytics v2 | Blackbaud Analytics | Bloomerang | DonorPerfect |
|-----------|------------------------|-------------------|------------|-------------|
| **Multi-source integration** | ✅ 6 systems unified | ❌ Ecosystem only | ❌ Single | ❌ Single |
| **Custom dashboards** | ✅ 15 purpose-built | ⚠️ Templates | ⚠️ Limited | ⚠️ Basic |
| **Financial statements** | ✅ Full GAAP 5-tab | ❌ | ❌ | ❌ |
| **HVAC/Facilities** | ✅ With 24h trends | ❌ | ❌ | ❌ |
| **Export (CSV)** | ✅ 25+ tables | ✅ | ✅ | ✅ |
| **Export (PDF)** | ✅ 2 dashboards | ✅ | ⚠️ | ⚠️ |
| **Print optimization** | ✅ 2 dashboards | ✅ | ⚠️ | ⚠️ |
| **Global search** | ✅ Cross-dashboard donor search | ✅ | ✅ | ✅ |
| **Filtering/Date ranges** | ⚠️ Campaign Tracker only | ✅ All views | ✅ | ✅ |
| **User access control** | ❌ Missing | ✅ | ✅ | ✅ |
| **Authentication** | ❌ Missing | ✅ | ✅ | ✅ |
| **Notifications** | ❌ Missing | ✅ | ✅ | ⚠️ |
| **Mobile app** | ⚠️ Responsive web | ✅ Native | ⚠️ | ⚠️ |
| **Cost** | Internal build | $10-50K/yr | $3-12K/yr | $3-15K/yr |

**Verdict (updated):** The gap between Federation Analytics and commercial tools has narrowed significantly. Export, search, and print were the most visible gaps — all now addressed. The remaining differentiators (auth, notifications, comprehensive filtering) are the features that separate "internal tool for power users" from "organizational platform." The breadth advantage (6-system integration, HVAC, financial statements, expense management) remains unmatched by any single commercial product.

### vs. Enterprise BI Tools (unchanged assessment)

Federation Analytics remains deliberately **not** a BI tool. It provides curated answers to specific operational questions rather than self-service exploration. This is the correct positioning for a 200-person nonprofit where the analytics team is effectively one person (David) with two power users (Sharon, James).

---

## 9. Summary Scorecard

| Dimension | v1 Score | v2 Score | Change | Notes |
|-----------|:--------:|:--------:|:------:|-------|
| **Information Architecture** | 7/10 | 8/10 | +1 | Group labels, Outreach merge, reduced count from 16 to 15. Still needs Prospect Research merge and role-based filtering |
| **Decision Orientation** | 8/10 | 8.5/10 | +0.5 | 9 of 15 dashboards now action-oriented (was 7/16). Pledge Management and Facilities upgraded. Stripe Analytics remains 🔴 |
| **Visual Consistency** | 9/10 | 9.5/10 | +0.5 | Color centralization eliminates drift risk. DashboardSkeleton creates consistent loading pattern. Minor maxWidth inconsistency |
| **Data Quality** | 7/10 | 8/10 | +1 | Deceased filtering, pledge status distinction, Rabkin flagging, stale data warnings. Remaining issues are upstream (null failure reasons, unmatched board members) |
| **Data Freshness** | 8/10 | 8/10 | — | Relative timestamps on Facilities are a UX improvement but underlying freshness hasn't changed. Still static JSON snapshots |
| **Export & Distribution** | 4/10 | 8/10 | +4 | Largest single improvement. CSV on 25+ tables, PDF on 2 dashboards, print CSS on 2. Was the #1 gap; now largely closed |
| **Mobile Readiness** | 6/10 | 6.5/10 | +0.5 | GlobalSearch mobile variant is nice. Core tablet/phone experience unchanged |
| **Help & Documentation** | 9/10 | 9/10 | — | 78-term glossary unchanged. DefinitionTooltip usage consistent. No regressions |
| **Technical Quality** | 9/10 | 9/10 | — | Clean TypeScript, consistent patterns. New components are well-structured. Dead SilenceAlertsDashboard and fetch path inconsistency are minor blemishes |
| **Security & Access Control** | 3/10 | 3/10 | — | No authentication, no access control. This was not addressed and remains the #1 barrier to organizational deployment |
| **Organizational Readiness** | 6/10 | 7/10 | +1 | Export, search, and print close the workflow gaps for David/Sharon/James. Still not ready for DRMs or board without auth |

### Composite Score

| | v1 | v2 |
|---|:---:|:---:|
| **Overall (weighted)** | **7.3/10** | **8.0/10** |

**The 0.7-point improvement reflects real, substantive progress** — not incremental polish. The platform moved from "impressive prototype with critical workflow gaps" to "operational tool for a small power-user team." The next 0.5-1.0 points require authentication and role-based access — without which the platform cannot move beyond 3 users. The jump from 8.0 to 9.0 requires live data, notifications, and embedded actions — the features that would make this a best-in-class internal analytics platform at any nonprofit of this size.

---

### Implementation Velocity Note

Implementing 14 of 19 recommendations in a single development cycle — across 6,253 lines of dashboard code, 7 new components, comprehensive print CSS, and a cross-dashboard search index — without introducing regressions or architectural debt is a testament to the platform's clean foundation. The codebase is well-positioned for the next phase. The limiting factor is not technical debt or architectural constraints — it's the strategic decision to invest in authentication infrastructure, which unlocks everything else.

---

*This review was conducted by examining all 16 dashboard source files (6,253 lines of TypeScript/React), 7 shared components, 15 JSON data files, the theme system, and CSS. All comparisons reference the v1 review dated February 20, 2026. Data references are from production files dated February 20, 2026.*
