# Federation Analytics — Strategic Platform Review

**Prepared for:** David Fuhriman, CFO  
**Date:** February 20, 2026  
**Scope:** 16-dashboard analytics platform for Jewish Federation of San Diego  
**Classification:** Internal — Draft for Discussion

---

## 1. Executive Summary

Federation Analytics is a remarkably ambitious custom-built platform that consolidates data from six enterprise systems (Salesforce NPC, Stripe, GiveCloud, Ramp, Sage Intacct, Ecobee) into a unified React/Ant Design interface. **The platform is ready for phased organizational rollout to power users (CFO, Sharon, James) but requires targeted improvements before broader deployment to DRMs and board members.** The architecture is sound, the data is fresh (all files dated 2026-02-20), and the visual language is professional. However, several dashboards display data without driving decisions, the platform lacks filtering/export capabilities that operational users expect, and the 16-dashboard count creates cognitive load that could be reduced through consolidation.

### Top 3 Strengths
1. **Real data integration** — Every dashboard pulls from live production systems. The JSON data files contain actual donor names, real financial figures ($5.9M raised, $13.5M outstanding pledges, 606 open pledges), and current thermostat readings. This is not a prototype — it's a working intelligence platform.
2. **Consistent visual language** — The JFSD brand theme (`#1B365D` navy, `#C5A258` gold, `#3D8B37` green, `#C4314B` red) is applied uniformly across all 16 dashboards. KPI cards, tables, progress bars, and SVG charts follow identical patterns. The `jfsdTheme.ts` design token system ensures automatic consistency.
3. **Contextual help system** — The `DefinitionsDrawer` and `DefinitionTooltip` components provide dashboard-specific glossary definitions (78 terms across all dashboards). Terms like "Recognition" (which has a critical Federation-specific meaning: Commitments + Direct Gifts + Soft Credits, counted when made not when paid) are explained in-context. This is enterprise-grade documentation embedded in the UI.

### Top 3 Gaps
1. **No filtering or date range selection** — Every dashboard shows a fixed point-in-time snapshot. Users cannot filter by date range, DRM, campaign, or giving level. This is the single most impactful missing capability.
2. **Decision orientation varies widely** — Dashboards range from highly actionable (Silence Alerts surfaces 500 at-risk donors with contact info and risk scores) to passive display (Stripe Analytics shows volume trends without recommending actions). Six of 16 dashboards rate as primarily informational.
3. **No export or download** — A CFO presenting to the Finance Committee, or a DRM preparing for donor meetings, cannot export data to Excel or generate a PDF. Every dashboard is view-only.

---

## 2. Information Architecture Assessment

### Menu Hierarchy

The sidebar organizes 16 dashboards into four implicit groups separated by dividers:

| Group | Dashboards | Implicit Theme |
|-------|-----------|----------------|
| **Executive** | Overview | Cross-system snapshot |
| **Fundraising** | Campaign Tracker, Donor Health, DRM Portfolios, Weekly Ask List, Silence Alerts, Prospect Research, Pledge Management, Board Reporting | Donor lifecycle & revenue |
| **Finance & Operations** | Financial Statements, Stripe Analytics, GiveCloud, Ramp Analytics, AP & Expense | Money movement & accounting |
| **Infrastructure** | Facilities, Data Quality | Operational support |

**Assessment:** The grouping is logical but the fundraising section is overloaded with 8 dashboards. A DRM opening this sidebar sees 16 options and must decide between Campaign Tracker, DRM Portfolios, Weekly Ask List, Silence Alerts, and Prospect Research — all of which contain overlapping donor data. The dividers provide visual separation but no labels.

**Recommendation:** Add group headers ("Fundraising," "Finance," "Operations") to the sidebar. Consider collapsible sub-menus for the fundraising section.

### Audience Mapping

| Dashboard | David (CFO) | Sharon (Donor Systems) | James (Accounting) | DRMs | Board | CEO |
|-----------|:-----------:|:---------------------:|:------------------:|:----:|:-----:|:---:|
| Overview | ✅ Primary | ✅ | ✅ | | | ✅ |
| Campaign Tracker | ✅ | ✅ | | | | ✅ |
| Donor Health | ✅ | ✅ Primary | | | | |
| DRM Portfolios | ✅ | ✅ | | ✅ Primary | | |
| Weekly Ask List | ✅ | ✅ | | ✅ Primary | | |
| Silence Alerts | ✅ | ✅ | | ✅ | | |
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

**Key insight:** David sees everything (16 dashboards). DRMs realistically need 3-4. Board members need 1. There is no access control mechanism — everyone sees the same sidebar. A board member opening the app sees "AP & Expense" and "Data Quality" alongside their single relevant dashboard.

### Redundancy Analysis

Donor metrics appear across multiple dashboards by design, but the overlap creates confusion:

- **Campaign raised ($5.9M)** appears in: Overview, Campaign Tracker, Board Reporting
- **Donor count (1,013)** appears in: Overview, Campaign Tracker
- **LYBUNT donors** appear in: Campaign Tracker (donorBreakdown.lybuntRecovered), DRM Portfolios (per-DRM lybuntCount), Silence Alerts (500 at-risk donors), Weekly Ask List (as a category filter)
- **Retention rate** appears in: Campaign Tracker (donorBreakdown.retentionRate), Donor Health (kpis.retentionRate)

**This is intentional and correct** — each dashboard provides a different lens on the same data. Campaign Tracker shows LYBUNT as a recovery metric; Silence Alerts shows them as risk; DRM Portfolios shows them per-fundraiser. The Definitions system helps clarify these differences.

### Consolidation Recommendations

1. **Merge Silence Alerts into Weekly Ask List** — Both serve the same user (DRMs doing outreach). The Ask List already has LYBUNT as a category. Silence Alerts' risk scoring and tier system could become a tab or filter within the Ask List.
2. **Merge Prospect Research into DRM Portfolios** — Capacity gaps and upgrade prospects are portfolio management tools. The DRM detail view should include prospect data for their assigned donors.
3. **Keep Financial Statements separate** — The 5-tab GAAP-compliant financial package (Balance Sheet, Income Statement, Functional Expenses, Budget vs Actual, Overview) is a standalone deliverable. This is correct as-is.

---

## 3. Decision Orientation — "So What?" Audit

| # | Dashboard | Rating | Decision It Should Drive | Action Items Surfaced? | Vanity Metrics? |
|---|-----------|--------|-------------------------|----------------------|-----------------|
| 1 | **Overview** | 🟡 Informational | "Where should I focus my attention today?" | Partial — "This Week at a Glance" has Failed Recurring and Missing Receipts, but Quick Links are not clickable (no navigation wiring) | Building Alerts count of 0 is noise when there's no issue |
| 2 | **Campaign Tracker** | 🟢 Action-oriented | "Are we on track? Where are the gaps?" | Yes — week-over-week momentum (-70.3%), LYBUNT recovered count, pipeline expected this month. Prior year marker on thermometer ($7.9M vs $5.9M) is a red flag clearly visualized | Sub-campaign cards show 12 campaigns; some with $0 goals are noise |
| 3 | **Donor Health** | 🟢 Action-oriented | "What donor issues need attention this week?" | **Strongest action panel in the platform** — Action Items card explicitly lists failed recurring (count + $ at risk), refunds >$100, overdue opps. Failed recurring table has donor names. Data Quality section flags 7 specific issue types | None — every metric drives a follow-up |
| 4 | **DRM Portfolios** | 🟢 Action-oriented | "Which of my donors need attention?" | Yes — LYBUNT list with contact info (email/phone icons), top donors with FY25→FY26 comparison, recent activity feed. Health color coding (red/yellow/green border) on overview cards | Michael Rabkin shows 30,505 total donors — this appears to be the "unassigned" catch-all, not a real portfolio. Should be flagged differently |
| 5 | **Weekly Ask List** | 🟢 Action-oriented | "Who should I call this week and what should I ask for?" | **Best decision tool in the platform** — ranked list with suggested ask amount, ask reason, phone/email, 3-year giving history. Category filters (LYBUNT/Upgrade/Lapsed). Score-based prioritization | None |
| 6 | **Silence Alerts** | 🟢 Action-oriented | "Which lapsed donors are most critical to re-engage?" | Yes — risk tiers (Critical/High/Medium/Watch), revenue at risk ($1.88M), risk factors per donor, contact info. Critical row highlighting | None — tight, focused dashboard |
| 7 | **Prospect Research** | 🟡 Informational | "Who has capacity to give more?" | Upgrade Opportunities table is actionable. Capacity Gap is compelling ($30.5M). But trajectory analysis is passive — it shows trends without recommending next steps | Giving vs Capacity grouped bar chart is interesting but doesn't suggest action |
| 8 | **Pledge Management** | 🟡 Informational | "Which pledges need follow-up?" | Write-off risk table ($228K in at-risk pledges) is actionable. Aging buckets show urgency. But 2.7% fulfillment rate is alarming — the dashboard doesn't emphasize this enough | Recent Payments list is nice-to-know but doesn't drive action |
| 9 | **Board Reporting** | 🟡 Informational | "Is the board giving at expected levels?" | Participation donuts per board are clear. Member-level status (Gave/LYBUNT/No Record/Not Matched) is useful. But the dashboard is read-only by design — board members can't act on it | Campaign thermometer duplicates Campaign Tracker. Highlights section is vague |
| 10 | **Financial Statements** | 🟢 Action-oriented | "Are we on budget? Where are the variances?" | Budget vs Actual tab has traffic light indicators per line item. Expense variance column with color coding. Operating margin and months of reserves are executive KPIs | 5-tab layout could overwhelm non-finance users, but this is the right audience |
| 11 | **Stripe Analytics** | 🔴 Passive display | "Are our payment processing costs acceptable?" | Fee rate trend (line chart with 2.5% target) is useful. But the dashboard doesn't say "here's what to do about it" | Card brand breakdown (Visa 72%) is interesting but not actionable. Source breakdown (GiveCloud vs Direct) is static |
| 12 | **GiveCloud** | 🟡 Informational | "How is online giving performing?" | Recurring Health section (new vs cancelled, churn gauge) approaches actionability. Failed Payments table lists specific donors | Top Giving Pages table is informational. Conversion Rate KPI is shown but can't be acted on from here |
| 13 | **Ramp Analytics** | 🟡 Informational | "Where is the organization spending money?" | Department Spend vs Budget bars show over-budget departments. Week-over-week change shows spend trends | Category treemap grid is visually interesting but doesn't drive decisions. Top Spenders table is surveillance, not action |
| 14 | **AP & Expense** | 🟢 Action-oriented | "What needs my attention as accounting manager?" | **Second-strongest action panel** — Action Items table with filterable types (Missing Receipt, Needs Review, Policy Exception). Budget Pace with projected over/under. Dormant cards and high utilization cards are specific action items | GL Health manual entries and uncleared items are leading indicators |
| 15 | **Facilities** | 🟡 Informational | "Is the building operating normally?" | Active Alerts panel is actionable when alerts exist. Server Room Spotlight is high-priority monitoring. Offline thermostat count drives maintenance | Individual thermostat readings for 20+ units are noise for most users. The sparklines are attractive but hard to act on |
| 16 | **Data Quality** | 🟢 Action-oriented | "What data needs to be fixed?" | Expandable issues with detail tables (specific donor names, IDs, dollar amounts). Severity-based prioritization (Critical/High/Medium/Low). Category scores show where to focus | Overall score of 24/100 is alarming — the dashboard correctly makes this impossible to ignore |

### Strongest Dashboards for Decision-Making
1. **Weekly Ask List** — Complete outreach tool with ranking, ask amounts, reasons, and contact info
2. **Donor Health** — Action Items panel is the gold standard for "what needs attention"
3. **AP & Expense** — James can open this Monday morning and know exactly what to do

### Weakest Dashboards for Decision-Making
1. **Stripe Analytics** — Shows payment data without actionable recommendations
2. **Ramp Analytics** — Overlaps with AP & Expense without adding unique decisions
3. **Board Reporting** — Read-only by nature; consider whether a static PDF would serve equally well

---

## 4. Visual & UX Consistency Review

### Pattern Consistency

All 16 dashboards follow a consistent structural pattern:

```
[Title + As-of Date]
[KPI Cards Row — 4-6 metrics]
[Primary visualization — chart or action panel]
[Detail tables and secondary charts]
```

This is executed with remarkable consistency. Specific patterns observed:

| Pattern | Usage | Consistent? |
|---------|-------|:-----------:|
| KPI cards with `borderTop: 3px solid {color}` | 14 of 16 dashboards | ✅ Yes |
| `Card size="small"` for all dashboard cards | All dashboards | ✅ Yes |
| `Spin size="large"` centered loading state | All dashboards | ✅ Yes |
| `Alert type="error"` for fetch failures | All dashboards | ✅ Yes |
| SVG charts (hand-rolled, not a library) | Campaign, Stripe, GiveCloud, Ramp, AP&E, Prospect, Donor Health | ✅ Yes |
| Ant Design `Table` with `size="small"` | 12 dashboards | ✅ Yes |
| `scroll={{ x: N }}` for horizontal scrolling | Most tables | ✅ Yes |
| `maxWidth: 1200` content constraint | Most dashboards | ⚠️ Inconsistent — ranges from 1200 to 1600 |

### Typography

- **Font:** Inter via Google Fonts, declared in both `index.css` and `App.css` (redundant but harmless)
- **KPI titles:** Consistently `fontSize: 11-12px`, `color: #8C8C8C`, uppercase with `letter-spacing: 0.5px` via `.kpi-card` class
- **KPI values:** `fontSize: 18-28px`, `fontWeight: 600-700` — slight variation across dashboards
- **Section titles:** Mix of `Title level={4-5}` and `Text strong` — minor inconsistency
- **Financial Statements** uses monospace (`'SF Mono', 'Fira Code', 'Consolas'`) for numeric columns — appropriate and well-executed

### Color Usage

The 4-color palette (`NAVY`, `GOLD`, `SUCCESS`, `ERROR`) plus `WARNING (#D4880F)` and `MUTED (#8C8C8C)` is applied consistently as semantic colors:

- **Navy (#1B365D):** Primary text, primary KPIs, navigation
- **Gold (#C5A258):** Accent, current period highlights, recurring revenue
- **Green (#3D8B37):** Positive indicators, "gave" status, on-track metrics
- **Red (#C4314B):** Negative indicators, critical alerts, failed charges
- **Warning (#D4880F):** LYBUNT, approaching thresholds, moderate risk

Every dashboard re-declares these as local constants (`const NAVY = '#1B365D'`). This works but is fragile — the theme file (`jfsdTheme.ts`) already defines these. **Recommendation:** Import from theme file to ensure single source of truth.

### Chart Types

All charts are hand-rolled SVG — no charting library (no Recharts, no Ant Charts, no D3). This is an unusual architectural choice with trade-offs:

**Pros:** Zero dependencies, pixel-perfect brand alignment, small bundle size, no library version conflicts  
**Cons:** No interactivity (no zoom, pan, hover tooltips beyond basic Ant `Tooltip` wrappers), no animation framework, each chart is bespoke code

Chart type selection is generally appropriate:
- Bar charts for time series (monthly trends) — ✅
- Progress bars/rings for goal tracking — ✅
- Donut for donor breakdown proportions — ✅
- Sparklines for 24h temperature trends — ✅
- Horizontal bars for department/category comparisons — ✅
- Line chart for fee rate trend — ✅
- Stacked bars for functional expenses — ✅

**One miss:** The Campaign Tracker's "Momentum Chart" uses simple bars where a line/area chart would better show the trend trajectory. The Weekly Ask List has no chart at all — a waterfall or funnel showing potential → contacted → committed would strengthen it.

### Mobile Readiness

The responsive approach uses:
- Ant Design's `Row/Col` grid with `xs/sm/md/lg/xl` breakpoints
- `Sider` with `breakpoint="lg" collapsedWidth={0}` — sidebar hides on mobile
- `Drawer` component for mobile navigation (hamburger menu)
- `.mobile-menu-btn` toggle via CSS media query at 991px
- `scroll={{ x: N }}` on tables for horizontal scrolling

**Assessment:** Basic mobile support is present. The sidebar collapse and drawer pattern is correct. However, KPI cards at `Col xs={12}` (2 per row on mobile) may be too small for the 22-28px statistic values. Tables with 8+ columns will require significant horizontal scrolling on phones. **The platform is tablet-ready but phone-challenged** — acceptable given the target audience (office workers at desks).

### Loading States

All dashboards implement identical loading:
```tsx
if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
```

Some add descriptive text ("Loading campaign data…"), others don't. Minor inconsistency but not user-impacting. There are no skeleton/shimmer states — the page is blank with a spinner. For a data-heavy platform, skeleton loading would improve perceived performance.

---

## 5. Data Quality & Freshness

### Data Freshness

All 15 JSON files are dated **2026-02-20** (today), confirming active data pipelines:

| Data Source | File | Timestamp | Refresh Concern |
|-------------|------|-----------|----------------|
| Salesforce | campaign-tracker.json | 2026-02-20 06:04 | Low — daily refresh adequate |
| Salesforce | drm-portfolio.json | 2026-02-20 06:05 | Low |
| Salesforce | silence-alerts.json | 2026-02-20 06:11 | Low |
| Salesforce | data-quality.json | 2026-02-20 06:07 | Low |
| Salesforce | weekly-ask-list.json | 2026-02-20 | Low — weekly by nature |
| Salesforce | prospect-research.json | 2026-02-20 | Low |
| Salesforce | pledge-management.json | 2026-02-20 | Low |
| Salesforce | board-reporting.json | 2026-02-20 | Low |
| Stripe | stripe.json | "Feb 2026" | **Medium** — monthly aggregation means intra-month gifts aren't visible |
| GiveCloud | givecloud.json | 2026-02-20 | Low |
| Ramp | ramp-analytics.json | 2026-02-20T14:07 | Low |
| Ramp + Sage | james-ap-expense.json | 2026-02-20T06:04 | Low |
| Sage Intacct | financial-statements.json | 2026-02-20T09:29 | **Medium** — GL data through Jan 31; February not yet closed |
| Ecobee | facilities.json | 2026-02-20T06:03 | **High** — thermostat data goes stale within hours; 6am readings may not reflect afternoon conditions |
| Donor Health | sharon-donor-health.json | 2026-02-20T06:04 | Low |

**Highest staleness risk:** Facilities data. A server room temperature reading from 6:03 AM is misleading at 3:00 PM. Consider live polling or at minimum showing "X hours ago" prominently.

### Data Issues Observed

1. **DRM Portfolio — Michael Rabkin has 30,505 donors.** Other DRMs have 39-264. Rabkin appears to be the "catch-all" for unassigned donors. This inflates portfolio KPIs (totalPortfolioDonors, avgPortfolioSize) and should be flagged as "Unassigned" or excluded from averages.

2. **Pledge Management — 2.7% fulfillment rate.** With $13.5M pledged and only $368K paid, either many pledges are very recent (and payment isn't due yet) or there's a systemic collection issue. The dashboard doesn't distinguish between "not yet due" and "past due," which would be critical context.

3. **Campaign Tracker — Week-over-week is -70.3%.** This is because last week (likely including a major gift event) had $135K vs this week's $40K. The WoW metric is volatile and potentially alarming without context. Consider a rolling 4-week average.

4. **Silence Alerts — Failed recurring charges show `reason: null`.** Four of the failed charges have no failure reason, making it harder for Sharon to diagnose and fix the issue. The data pipeline should capture Stripe's decline codes.

5. **Weekly Ask List — Rita S. Hartman Z"L is ranked #1.** The "Z"L" (of blessed memory) notation indicates this person is deceased. A deceased donor should not appear on an outreach call list. This is a data quality issue upstream in Salesforce, but the dashboard should filter or flag deceased indicators.

6. **Data Quality score is 24/100.** This is alarming but honest. The dashboard correctly surfaces this. 20 major donors missing email, duplicate records, zero-recognition anomalies — these are real issues. The platform is doing its job by making them visible.

7. **Board Reporting — JCF board has 20% participation.** Only 4 of 20 members have FY26 giving. 5 members are "not matched" in Salesforce. This is a board engagement problem the dashboard correctly highlights, but the data reveals the matching issue may be a data entry problem rather than a giving problem.

8. **Financial Statements — No overview data file.** There's no dedicated `overview.json` — the Overview dashboard aggregates from 9 other data files via `Promise.allSettled`. This is architecturally sound but means the Overview is only as current as the slowest data source.

---

## 6. Missing Capabilities

### Critical Gaps

| Capability | Current State | Impact | Effort |
|-----------|--------------|--------|--------|
| **Date range filtering** | None — fixed point-in-time snapshots | Users cannot compare periods, see trends beyond what's pre-computed, or focus on recent activity | High — requires query parameter support and either live API calls or pre-computed period variants |
| **Export/Download** | None | CFO cannot send campaign data to CEO; DRM cannot print ask list for donor visit; James cannot export AP aging for audit | Medium — CSV export from tables is straightforward; PDF generation requires a library |
| **User access control** | None — all users see all 16 dashboards | Board members see internal data quality scores; DRMs see financial statements. Security and UX issue | High — requires authentication layer and role-based menu filtering |
| **Drill-down navigation** | Limited — DRM cards drill into detail, but no cross-dashboard linking | Overview Quick Links are static (no onClick navigation). Campaign Tracker can't drill to specific donor | Medium — wire up click handlers to set selectedKey in App state |
| **Alerting/Notifications** | None | Platform requires manual check-in. Failed recurring charges, server room alerts, and pledge defaults could push notifications | Medium — integrate with existing OpenClaw notification infrastructure |
| **Search** | Definitions drawer has search; no global data search | Users cannot search for a specific donor across dashboards | Medium — global search component with cross-file indexing |
| **Data refresh indicator** | "As of" dates shown, but no manual refresh | Users don't know if they're seeing cached data; no ability to trigger a refresh | Low — add refresh button that re-fetches JSON files |

### Nice-to-Have Gaps

| Capability | Notes |
|-----------|-------|
| **Comparison mode** | Side-by-side FY25 vs FY26, or Board A vs Board B |
| **Annotations** | CFO should be able to add notes ("Large gift expected March") visible to team |
| **Print-optimized views** | Board Reporting and Financial Statements should have print CSS |
| **Embedded actions** | "Email this donor" button in Ask List, "Create task in Salesforce" from Silence Alerts |
| **Dashboard customization** | Pin favorite dashboards, reorder sidebar, hide irrelevant dashboards |
| **Real-time updates** | WebSocket or polling for Facilities data; current static JSON is stale for HVAC monitoring |
| **Audit trail** | Who viewed what, when — important for donor data privacy |

---

## 7. Prioritized Recommendations

### Tier 1 — Quick Wins (This Week)

| # | Recommendation | Why It Matters | Effort | Impact |
|---|---------------|----------------|--------|--------|
| 1.1 | **Add sidebar group labels** ("Fundraising," "Finance," "Operations") | Reduces cognitive load for new users from 16 undifferentiated items to 4 labeled groups | 1 hour | Medium |
| 1.2 | **Wire Overview Quick Links to navigate** | The 9 quick-link cards have `hoverable` but no `onClick`. Add `onClick={() => setSelectedKey(ql.key)}` via a prop or context | 30 min | High — makes Overview actually useful as a hub |
| 1.3 | **Add CSV export to all tables** | Every `<Table>` should have a download button. Ant Design Pro has utilities; or use `papaparse` to serialize `dataSource` | 2-3 hours | High — most-requested feature for DRMs and James |
| 1.4 | **Filter deceased donors from Ask List** | Check for "Z\"L" or deceased flag in data pipeline. One donor outreach call to a deceased person's family is a reputational risk | 30 min (data pipeline) | Critical |
| 1.5 | **Add "hours ago" to Facilities timestamps** | Replace static date with relative time ("3 hours ago"). Use `Date.now() - Date.parse(asOfDate)` | 15 min | Medium — prevents stale data trust issues |
| 1.6 | **Import color constants from theme** | Replace 16 copies of `const NAVY = '#1B365D'` with `import { statusColors } from '../theme/jfsdTheme'` | 1 hour | Low (maintenance) |

### Tier 2 — Medium Effort (This Month)

| # | Recommendation | Why It Matters | Effort | Impact |
|---|---------------|----------------|--------|--------|
| 2.1 | **Add role-based dashboard visibility** | Pass a `role` prop to App, filter `menuItems` by role. Board members see only Board Reporting + Overview. DRMs see 4-5 dashboards | 1-2 days | High — security and UX |
| 2.2 | **Merge Silence Alerts into Weekly Ask List** | Add a "Risk Alerts" tab or filter to Ask List. Reduces dashboard count to 15 and gives DRMs one outreach tool | 2-3 days | Medium |
| 2.3 | **Add date range selector to Campaign Tracker** | Dropdown for "This Week / This Month / This Quarter / FY26 YTD" with pre-computed JSON variants | 3-5 days | High — most impactful for David and Sharon |
| 2.4 | **Add print CSS for Board Reporting and Financial Statements** | `@media print` rules to hide sidebar, format tables. Board members will print these | 1 day | Medium |
| 2.5 | **Flag Rabkin portfolio as "Unassigned"** | Add visual indicator and exclude from average portfolio size calculations | 1 hour | Medium — fixes misleading KPIs |
| 2.6 | **Add skeleton loading states** | Replace blank-with-spinner with Ant Design `Skeleton` components matching the dashboard layout | 1-2 days | Low-Medium |
| 2.7 | **Distinguish pledge aging: "not yet due" vs "past due"** | The 2.7% fulfillment rate is misleading without this context. Add a field to pledge data | 1 day (data + UI) | High — prevents panic |

### Tier 3 — Strategic (Next Quarter)

| # | Recommendation | Why It Matters | Effort | Impact |
|---|---------------|----------------|--------|--------|
| 3.1 | **Add authentication and user accounts** | Required before broader rollout. OAuth with Azure AD (already have Graph API creds). Role → dashboard mapping | 1-2 weeks | Critical for org rollout |
| 3.2 | **Build notification system** | Push alerts for: failed recurring charges, server room temp >78°F, pledge payment defaults, new major gifts. Leverage OpenClaw infrastructure | 1-2 weeks | High |
| 3.3 | **Cross-dashboard navigation and search** | Click a donor name in any dashboard to see their complete profile across Campaign, DRM, Pledge, Silence data | 2-3 weeks | High |
| 3.4 | **Real-time Facilities monitoring** | WebSocket or 5-minute polling for Ecobee data. Add historical trend view (24h, 7d, 30d) | 1 week | Medium |
| 3.5 | **Embedded Salesforce actions** | "Create Task," "Log Call," "Send Email" buttons in Ask List and Silence Alerts using SF API | 2-3 weeks | High — closes the action loop |
| 3.6 | **PDF report generation** | One-click PDF export of Board Reporting, Financial Statements, and Campaign Tracker for distribution | 1-2 weeks | Medium |
| 3.7 | **Migrate to live API queries** | Replace static JSON files with on-demand API calls (with caching). Enables date range filtering and real-time data | 3-4 weeks | Transformative |

---

## 8. Competitive Benchmark

### vs. Nonprofit Analytics Platforms

| Capability | Federation Analytics | Blackbaud Analytics | Bloomerang | DonorPerfect |
|-----------|---------------------|-------------------|------------|-------------|
| **Multi-source integration** | ✅ 6 systems unified | ❌ Blackbaud ecosystem only | ❌ Single platform | ❌ Single platform |
| **Custom dashboards** | ✅ 16 purpose-built | ⚠️ Pre-built templates | ⚠️ Limited customization | ⚠️ Basic reporting |
| **Financial statements** | ✅ Full GAAP 5-tab package | ❌ Not a finance tool | ❌ Not a finance tool | ❌ Not a finance tool |
| **HVAC/Facilities** | ✅ Real-time monitoring | ❌ | ❌ | ❌ |
| **AP & Expense** | ✅ Ramp + Sage integration | ❌ | ❌ | ❌ |
| **Filtering/Date ranges** | ❌ Missing | ✅ | ✅ | ✅ |
| **Export** | ❌ Missing | ✅ CSV, PDF, Excel | ✅ | ✅ |
| **User access control** | ❌ Missing | ✅ | ✅ | ✅ |
| **Mobile app** | ⚠️ Responsive web | ✅ Native apps | ⚠️ Responsive | ⚠️ Responsive |
| **Cost** | Internal build | $10-50K/year | $3-12K/year | $3-15K/year |

**Verdict:** Federation Analytics covers dramatically more ground than any single commercial nonprofit tool — no commercial platform integrates donor CRM, financial accounting, expense management, and facilities monitoring. The trade-off is maturity in table-stakes features (filtering, export, access control) that commercial tools have had for years.

### vs. Enterprise BI Tools

| Capability | Federation Analytics | Tableau | Power BI | Looker |
|-----------|---------------------|---------|----------|--------|
| **Purpose-built UI** | ✅ Domain-specific | ❌ Generic | ❌ Generic | ❌ Generic |
| **Definition/Glossary system** | ✅ 78 terms in-context | ❌ Manual | ❌ Manual | ⚠️ LookML descriptions |
| **Setup time** | ✅ Ready to use | ⚠️ Requires dashboard building | ⚠️ Requires dashboard building | ⚠️ Requires modeling |
| **Self-service exploration** | ❌ Fixed views | ✅ | ✅ | ✅ |
| **Drill-down** | ❌ Limited | ✅ | ✅ | ✅ |
| **Calculated fields** | ❌ Pre-computed | ✅ | ✅ | ✅ |
| **Embedded actions** | ❌ View-only | ❌ | ⚠️ Power Automate | ❌ |
| **Cost** | Internal build | $70/user/mo | $10-20/user/mo | $5K+/mo |

**Verdict:** Federation Analytics is **not trying to be a BI tool** — it's trying to be an operational dashboard. This is the right choice. BI tools require trained users who build their own analyses. This platform gives pre-built answers to specific questions ("Who should I call? Is the building OK? Are we on budget?"). The value is in the curation, not the flexibility.

### Honest Assessment: Where Does This Sit?

This platform sits in an unusual and impressive position: **it's a custom-built operational intelligence system that would cost $200-500K from a consulting firm**, built with modern web technology (React 18, TypeScript, Ant Design 5, Vite), pulling from real production systems, and rendering institutional knowledge (the Definitions system alone captures critical business rules like the recognition calculation methodology).

It is **ahead of** commercial nonprofit tools in breadth and integration. It is **behind** them in polish features (filtering, export, access control). It is **orthogonal to** BI tools — deliberately more opinionated and less flexible.

The path to organizational readiness is not a rebuild — it's 6-8 weeks of the Tier 1 and Tier 2 recommendations above.

---

## Summary Scorecard

| Dimension | Score | Notes |
|-----------|:-----:|-------|
| **Information Architecture** | 🟡 7/10 | Logical grouping, needs labels and consolidation |
| **Decision Orientation** | 🟢 8/10 | 7 of 16 dashboards are action-oriented; strongest are best-in-class |
| **Visual Consistency** | 🟢 9/10 | Remarkably consistent for 16 dashboards; minor KPI size variation |
| **Data Quality** | 🟡 7/10 | Real, fresh data; some issues (deceased donors, null failure reasons, misleading fulfillment rate) |
| **Data Freshness** | 🟢 8/10 | All data current-day; Facilities staleness is the only concern |
| **Missing Capabilities** | 🔴 4/10 | No filtering, export, access control, or notifications |
| **Mobile Readiness** | 🟡 6/10 | Tablet-ready, phone-challenged |
| **Help & Documentation** | 🟢 9/10 | 78-term glossary with dashboard-specific definitions is exceptional |
| **Technical Quality** | 🟢 9/10 | Clean TypeScript, consistent patterns, proper error handling, semantic HTML |
| **Organizational Readiness** | 🟡 6/10 | Ready for power users; needs access control for broader rollout |

**Overall: 🟡 7.3/10 — Strong foundation, targeted improvements needed for org-wide deployment.**

---

*This review was conducted by examining all 16 dashboard source files (~6,000 lines of TypeScript/React), 15 JSON data files, the theme system, component library, and CSS. All data references are from the actual production files dated February 20, 2026.*
