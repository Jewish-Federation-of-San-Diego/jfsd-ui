# Data Visualization Decision Matrix

**Version:** 1.0  
**Created:** 2026-03-07  
**Purpose:** Prescriptive framework mapping every JFSD report type to specific visualization choices. Every sub-agent that generates a chart or dashboard MUST consult this document.

---

## Framework Sources

This matrix synthesizes four established frameworks:

1. **FT Visual Vocabulary** — 9 data relationship categories, each mapped to optimal chart types
2. **Storytelling with Data (Knaflic)** — Context-first approach, cognitive load minimization
3. **Tufte's Principles** — Data-ink ratio, chartjunk elimination, small multiples
4. **Stephen Few** — Dashboard design, information density by audience

---

## Part 1: The 9 Data Relationships → Chart Selection

Every visualization answers one question. Identify the relationship first, then select the chart.

### 1. DEVIATION — How far from a reference point?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Actual vs budget (few categories) | Diverging bar | Department variance to budget |
| Actual vs budget (over time) | Surplus/deficit area | Monthly revenue vs plan |
| Single metric vs target | Bullet chart | Campaign progress vs goal |
| Multiple metrics vs targets | Dot plot with reference line | KPI scorecard |

**JFSD reports using this:** Finance Committee variance, budget watchdog, campaign pacing

### 2. CORRELATION — What is the relationship between two variables?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Two continuous variables | Scatter plot | Gift capacity vs actual giving (SOW) |
| Many points with density | Bubble chart or heatmap | Donor RFM clustering |
| Showing trend line | Scatter + regression line | Wealth score vs recognition |

**JFSD reports using this:** Share of Wallet, prospect prioritization, WealthEngine analysis

### 3. RANKING — How do items compare in order?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Ordered categorical comparison | Horizontal bar (sorted) | Top 20 donors by recognition |
| Comparison with benchmark | Lollipop chart | DRM portfolio sizes vs target |
| Few items with context | Ordered table with bars | Board giving by org |

**JFSD reports using this:** Board reports, DRM portfolios, vendor spending, department budgets

### 4. DISTRIBUTION — How is data spread across a range?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Single variable spread | Histogram | Gift size distribution |
| Compare distributions | Box plot | Giving by society level |
| Dense continuous data | Density/violin plot | Temperature readings |

**JFSD reports using this:** Gift histograms, HVAC comfort scores, donor segmentation

### 5. CHANGE OVER TIME — How has a value evolved?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Single metric trend | Line chart | Campaign cumulative giving |
| Comparing periods | Multi-line (max 4) | FY26 vs FY25 revenue |
| Cumulative progress | Area chart (single series) | YTD giving progress |
| Categorical change over time | Grouped bar | Monthly gifts by designation |
| High-frequency data | Sparkline | Thermostat temp over 24h |

**JFSD reports using this:** Campaign pacing, HVAC history, HubSpot engagement trends, Ramp spending trends

### 6. MAGNITUDE — How big/small compared to others?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Simple size comparison | Bar chart (sorted) | Department spend totals |
| Proportional with hierarchy | Treemap | Spending by category > vendor |
| Paired comparison | Paired/butterfly bar | Revenue vs expense by dept |

**JFSD reports using this:** Ramp spending, fund balances, campaign totals

### 7. PART-TO-WHOLE — How does this fit the total?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Few segments (<5) | Stacked bar (100%) | Revenue by source type |
| Hierarchy with drill-down | Treemap or sunburst | Gift designations |
| Single proportion | Big number + progress bar | % of campaign goal |
| Time + composition | Stacked area | Gift mix over months |

**NEVER use pie charts.** Human brains cannot accurately compare angles. Use horizontal stacked bar instead.

**JFSD reports using this:** Revenue composition, donor segmentation, fund allocation

### 8. SPATIAL — Where is it located?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Geographic distribution | Choropleth map | Donor concentration by ZIP |
| Point locations | Dot map | Donor addresses |
| Building layout | Floor plan heatmap | Thermostat locations |

**JFSD reports using this:** Donor geography, building climate zones

### 9. FLOW — How do things move between states?
| Use When | Chart | JFSD Example |
|----------|-------|--------------|
| Source → destination | Sankey diagram | Fund flow (gifts → designations → GL) |
| Sequential stages | Funnel | Donor pipeline (prospect → ask → gift) |
| Process with branches | Flowchart | Gift processing workflow |

**JFSD reports using this:** Revenue reconciliation flow, donor pipeline, gift processing

---

## Part 2: Report Type → Visualization Prescription

### Financial Reports

| Report | Primary Viz | Supporting Viz | Key Metric Display | Annotation Strategy |
|--------|------------|----------------|-------------------|-------------------|
| **Finance Committee Packet** | Variance waterfall (revenue → expense → surplus) | Sparklines per dept, trend lines | Big number: surplus/deficit vs budget | Annotate largest favorable + unfavorable variance |
| **Budget vs Actual** | Diverging horizontal bar (sorted by abs variance) | Monthly trend line (actual vs budget) | % and $ variance side by side | Flag items >10% off, note NET_BUDGET methodology items |
| **AP Performance** | Horizontal bar (vendor spend, sorted descending) | Aging buckets stacked bar | Big number: total AP, avg days to pay | Call out overdue >60 days |
| **Ramp Spending** | Treemap (category → merchant) | Monthly trend line, category bars | Big number: MTD spend vs prior month | Annotate unusual spikes, declined cards |
| **Cash Position** | Waterfall (opening → inflows → outflows → closing) | 12-month trend line | Big number: days of operating cash | Mark reserve thresholds |
| **Financial Statements** | Columnar table (current, prior, budget) | Variance bars inline | Bold totals, light subtotals | Footnotes for methodology, reclassifications |

### Development / Fundraising Reports

| Report | Primary Viz | Supporting Viz | Key Metric Display | Annotation Strategy |
|--------|------------|----------------|-------------------|-------------------|
| **Campaign Progress** | Bullet chart (actual vs goal) | Cumulative line (FY26 vs FY25 overlay) | Big number: $ raised, % to goal | Annotate major gift inflection points |
| **Board Giving** | Horizontal bar (giving by member, sorted) | Participation rate big number | Big number: % participation, total $ | Mark $0 givers, highlight new gifts |
| **DRM Portfolio** | Grouped horizontal bar (portfolio value, sorted) | Small multiples: action status per DRM | Big number: total portfolio, avg $ | Annotate top prospects, overdue touches |
| **Donor Retention** | Slope chart (prior year → current year) | Retention rate big number + trend | Big number: retention %, $ at risk | Call out LYBUNT count and total |
| **Weekly Ask List** | Ordered table with suggested ask bars | — | Big number: total potential $ | Bold top 3 highest-impact asks |
| **Pledge Management** | Aging horizontal bar (current/30/60/90+) | Trend line: pledge payment rate | Big number: outstanding $, overdue $ | Flag write-off risks (>120 days) |
| **Share of Wallet** | Scatter (capacity vs giving, sized by SOW%) | Histogram of SOW distribution | Big number: median SOW%, capacity gap | Quadrant labels: Champion/Engaged/Upgrade/Big Upside |
| **Silence Alerts** | Ordered table with last-gift-date bars | Segment bar (by years since last gift) | Big number: # donors, $ at risk | Highlight top-value lapsed donors |

### Operations Reports

| Report | Primary Viz | Supporting Viz | Key Metric Display | Annotation Strategy |
|--------|------------|----------------|-------------------|-------------------|
| **HVAC Dashboard** | Heatmap grid (thermostat × time) | Sparklines per zone | Big number: comfort score, alerts | Red border on out-of-range zones |
| **Building Analytics** | Multi-line (temp over 24h per zone) | Box plot (daily range by zone) | Big number: avg temp, anomalies | Annotate set point vs actual deviations |
| **Data Quality** | Horizontal bar (issue type, sorted by count) | Trend line: quality score over time | Big number: health score (0-100) | Flag critical issues (missing addresses) |
| **HubSpot Engagement** | Funnel (sent → opened → clicked) | Line chart: engagement rate over time | Big number: open rate, click rate | Benchmark vs industry (AFP standards) |
| **Voice Agent** | Bar chart (calls by agent) | Line chart: calls over time | Big number: total calls, avg duration | Annotate peak periods |

### Board / Executive Reports

| Report | Primary Viz | Supporting Viz | Key Metric Display | Annotation Strategy |
|--------|------------|----------------|-------------------|-------------------|
| **Executive Dashboard** | 4-5 KPI cards across top | One primary trend chart | Big numbers ONLY at top | One-sentence insight per KPI |
| **Board Packet** | Minimal: 2-3 charts max per page | Supporting table for detail | Big numbers with YoY comparison | Plain-language annotations, no jargon |
| **Internal Audit** | Traffic light table (test → status) | Trend: findings over time | Big number: open findings count | Severity badges: CRITICAL/HIGH/MEDIUM |

---

## Part 3: Color Application Rules

### Semantic Palette (mandatory — never deviate)

| Meaning | Color | Hex | When to Use |
|---------|-------|-----|-------------|
| Primary data | Primary Blue | `#1e3eaf` | Default for main data series |
| Favorable / on track | Teal | `#009191` | Positive variance, met targets, good |
| Unfavorable / alert | Orange | `#eb6136` | Negative variance, missed targets, bad |
| Warning / watch | Gold | `#d98000` | Approaching threshold, needs monitoring |
| Context / prior period | Grey 40% | `#2a2a2a` @ 40% opacity | Benchmarks, prior year, reference |
| Background | Off White | `#f5f5f5` | Card backgrounds, containers |
| Emphasis / selected | Medium Blue | `#1c88ed` | Highlighted selection, links, interactive |

### Section Headers (dashboard navigation only)

| Section | Color | Hex |
|---------|-------|-----|
| Finance | Forest Green | `#236B4A` |
| Development | Medium Blue | `#1c88ed` |
| ScalingOps | Teal | `#009191` |
| Marketing | Purple | `#942494` |
| Facilities | Violet | `#594fa3` |
| AI/Voice | Deep Purple | `#4B0082` |

### Color Rules — Hard Constraints

1. **Maximum 5 colors per chart.** If you need more, use small multiples instead.
2. **Grey is your best friend.** Default everything to grey, then promote ONE thing with color.
3. **Teal = good, Orange = bad. ALWAYS.** No exceptions. No "red for negative" (colorblind).
4. **No rainbow palettes.** Ever. They encode no meaning and confuse everyone.
5. **No red/green pairing.** 8% of men are colorblind. Use teal/orange instead.
6. **Background: white or off-white only.** No colored backgrounds on charts.
7. **4.5:1 contrast minimum** for all text against its background.

### Variance Color Logic

```
variance > 0 AND favorable  → Teal (#009191)
variance > 0 AND unfavorable → Orange (#eb6136) [e.g., expense over budget]
variance < 0 AND favorable  → Teal (#009191) [e.g., expense under budget]  
variance < 0 AND unfavorable → Orange (#eb6136) [e.g., revenue under budget]
variance = 0 or near zero   → Grey
```

Favorability depends on context, not sign. Revenue over budget = teal. Expense over budget = orange.

---

## Part 4: Annotation Strategy

### The 3-Second Rule

If a viewer can't get the main point in 3 seconds, the visualization has failed.

### Title Formula

**Bad:** "Q2 Revenue" (label, not insight)  
**Good:** "Q2 revenue grew 12% to $2.4M, exceeding budget by $200K" (headline)

Every chart title should be a complete sentence stating the insight.

### Annotation Hierarchy

| Level | When | Example |
|-------|------|---------|
| **Title** | Always | States the main finding |
| **Subtitle** | When context needed | "vs FY25 Annual Campaign, as of Mar 7" |
| **Call-out** | Max 2 per chart | Arrow + "COVID impact" at anomaly |
| **Reference line** | For targets/benchmarks | Dashed grey line at $3M goal |
| **Data label** | Only key values | Label the endpoint, not every point |
| **Footnote** | Methodology, caveats | "Excludes pass-through designations" |

### What to Annotate by Report Type

| Report Type | Must Annotate | Never Annotate |
|-------------|--------------|----------------|
| Finance Committee | Largest variance, methodology notes | Every line item |
| Campaign Progress | Major gifts, milestone dates | Individual small gifts |
| HVAC | Out-of-range readings, equipment issues | Normal readings |
| Board Reports | The one thing they should take away | Technical details |
| DRM Portfolios | Top prospect, overdue actions | Donor contact info |

---

## Part 5: Layout Patterns

### KPI-First Pattern (Executive / Board)

```
┌─────────┬─────────┬─────────┬─────────┐
│  KPI 1  │  KPI 2  │  KPI 3  │  KPI 4  │  ← Big numbers, sparklines
├─────────┴─────────┴─────────┴─────────┤
│                                        │
│        Primary Insight Chart           │  ← The one chart that matters
│                                        │
├───────────────────┬────────────────────┤
│  Supporting A     │  Supporting B      │  ← Context if needed
└───────────────────┴────────────────────┘
```

**Use for:** Finance Committee, Board packets, Executive dashboards  
**Max KPIs:** 5. If you need more, you haven't prioritized.

### Analytical Pattern (DRM / Development)

```
┌──────────────────────────┬─────────────┐
│  Filters / Segments      │  KPI Strip  │
├──────────────────────────┴─────────────┤
│                                        │
│         Primary Analysis Chart         │
│                                        │
├───────────────────┬────────────────────┤
│  Detail Table     │  Trend / Context   │
└───────────────────┴────────────────────┘
```

**Use for:** DRM portfolios, donor analytics, data quality  
**Key:** Filters MUST be visible and persistent (no hidden panels)

### Monitoring Pattern (HVAC / Alerts)

```
┌──────────────────────────────────────┐
│  Status Bar: ● Normal  ▲ 2 Alerts   │
├───────────┬───────────┬──────────────┤
│  Zone A   │  Zone B   │  Zone C      │  ← Small multiples (identical scale)
│  [spark]  │  [spark]  │  [spark]     │
│  72°F ✓   │  78°F ▲   │  71°F ✓     │
├───────────┴───────────┴──────────────┤
│          24-Hour Detail Chart        │
└──────────────────────────────────────┘
```

**Use for:** HVAC dashboard, building analytics, system health  
**Key:** Alerts at top, detail below. Status at a glance.

### Comparison Pattern (Variance / Benchmarking)

```
┌──────────────────────────────────────┐
│  Summary: $1.7M ahead of budget      │
├──────────────────────────────────────┤
│                                      │
│    Diverging Bar (sorted by impact)  │
│    ◄── Unfavorable | Favorable ──►   │
│                                      │
├──────────────────────────────────────┤
│  Detail Table (drill-down)           │
└──────────────────────────────────────┘
```

**Use for:** Budget variance, campaign vs prior year, benchmark comparisons

---

## Part 6: Anti-Patterns — What to Kill on Sight

### Chart Crimes (Immediate Fix Required)

| Anti-Pattern | Why It's Wrong | Fix |
|-------------|---------------|-----|
| **Pie chart** | Can't compare angles | Horizontal bar, sorted |
| **3D anything** | Distorts perception | 2D equivalent |
| **Dual-axis** | Implies false correlation | Two separate charts |
| **Gauge/donut** | Low info density | Big number + context |
| **Rainbow palette** | No meaning encoded | Semantic colors only |
| **Red/green only** | Colorblind exclusion | Teal/orange |
| **Legend far from data** | Eye travel waste | Direct labels |
| **Rotated axis labels** | Hard to read | Horizontal bar instead |
| **Dense gridlines** | Cognitive noise | Remove or lighten to 5% grey |
| **Chart border/box** | Wastes ink | Use whitespace |

### Dashboard Crimes (Systematic Fix Required)

| Anti-Pattern | Why It's Wrong | Fix |
|-------------|---------------|-----|
| **>7 charts on one page** | Information overload | Prioritize, use progressive disclosure |
| **No hierarchy** | Everything screams equally | KPIs → primary → supporting |
| **Inconsistent scales** | Misleading comparison | Same axis range for comparable charts |
| **Missing data freshness** | Trust problem | Always show "as of [date]" |
| **No actionable insight** | Pretty but useless | Add headline title stating the so-what |
| **Chartjunk** | Decorative elements | Strip to essentials |

---

## Part 7: Number Formatting Standards

| Context | Format | Example |
|---------|--------|---------|
| Currency ≥ $1M | $X.XM | $2.4M |
| Currency $1K–$999K | $XXXK | $850K |
| Currency < $1K | $X,XXX | $1,234 |
| Variance (favorable) | +$XXK / +X.X% | +$200K / +9.1% |
| Variance (unfavorable) | -$XXK / -X.X% | -$50K / -3.2% |
| Percentages | X.X% or X% | 12.5% or 85% |
| Counts ≥ 1000 | X.XK or X,XXX | 2.4K or 1,234 |
| Dates (axis) | Mon 'YY | Jan '26 |
| Dates (specific) | Mon DD, YYYY | Jan 15, 2026 |
| Temperature | XX°F | 72°F |

**Rules:**
- Always show both $ and % for variance
- Round to match precision needed (board = round, analyst = precise)
- Right-align all numbers in tables
- Consistent decimals within a column

---

## Part 8: Typography in Charts

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Chart title | Outfit | 16-18px | SemiBold |
| Subtitle / data freshness | Outfit | 12-13px | Light, grey |
| Axis labels | Outfit | 11-12px | Light |
| Data labels | Outfit | 10-12px | Light or Regular |
| Annotations | Outfit | 11px | Regular, italic |
| KPI big number | Outfit | 36-48px | SemiBold |
| KPI label | Outfit | 12-14px | Light |

**Fallback:** Helvetica Neue → Arial → system sans-serif

---

## Part 9: Quality Gate Checklist

Before ANY visualization ships, it must pass ALL of these:

### Must Pass (blocking)
- [ ] Chart type matches the data relationship (refer to Part 1)
- [ ] Title states the insight, not just the topic
- [ ] Colors follow semantic rules (teal=good, orange=bad)
- [ ] Maximum 5 colors used
- [ ] No pie charts, 3D, dual-axis, or gauges
- [ ] Numbers formatted consistently per Part 7
- [ ] Data freshness timestamp visible
- [ ] 3-second rule: main point is immediately obvious
- [ ] Accessible contrast (4.5:1 minimum)

### Should Pass (flag if missing)
- [ ] Direct labels preferred over legend
- [ ] Gridlines removed or barely visible
- [ ] White space used for grouping (no heavy borders)
- [ ] Annotations on key insights (max 2 per chart)
- [ ] Sorted meaningfully (by value, not alphabetically)
- [ ] Consistent axis scales across comparable charts
- [ ] Progressive disclosure for complex dashboards

---

## Part 10: JFSD Report Inventory — Current State Assessment

Based on audit of 93 reports/dashboards (2026-02-05):

### Known Issues to Fix (Phase 2)

| Dashboard | Issue | Prescribed Fix |
|-----------|-------|---------------|
| Chart Gallery (#05) | Contains pie chart | Replace with horizontal bar |
| Chart Gallery (#33) | Contains gauge chart | Replace with big number + progress bar |
| Chart Gallery (#20, #21) | 3D charts | Eliminate, use 2D equivalents |
| Chart Gallery (#29, #30) | Polar charts | Replace with standard bar/line |
| HubSpot engagement | Funnel area chart | Replace with standard funnel or horizontal bar |
| DRM portfolios | Dense multi-metric display | Restructure with KPI-first pattern |
| Several dashboards | Missing data freshness | Add "as of" timestamp to all |
| Several dashboards | Generic titles | Rewrite as insight headlines |
| Board reports | Too many charts per page | Reduce to 2-3 with clear hierarchy |
| HVAC dashboard | Temperature sparklines too small | Increase size, add reference bands |

### Priority Order (Phase 2 execution)
1. **Finance Committee reports** — Highest visibility, board-facing
2. **Board giving reports** — External audience, must be polished
3. **Campaign progress** — Used weekly by development team
4. **DRM portfolios** — Active tool for 10 fundraisers
5. **HVAC dashboard** — Operational monitoring
6. **Data quality** — Internal tool, lower visibility
7. **HubSpot** — Marketing team, lower urgency
8. **Chart gallery** — Template library, fix sets precedent for everything
9. **Voice agent** — Low usage
10. **Advancement services** — Nascent, build right from start

---

*This document is the single source of truth for data visualization decisions at JFSD. When in doubt, consult this matrix. When this matrix conflicts with aesthetic preference, this matrix wins.*
