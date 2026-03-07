# JFSD Dashboard Design Standards
*For all dashboards in the jfsd-ui SPA*

## Architecture
- **Framework:** React + TypeScript + Vite
- **UI Library:** Ant Design 5
- **Charts:** react-plotly.js (Plotly)
- **Fonts:** Inter (loaded via Google Fonts)
- **Deploy:** GitHub Pages via CI (push to `main` → build → gh-pages)

## File Structure
```
src/dashboards/{DashboardName}Dashboard.tsx   # One file per dashboard
public/data/{data-file}.json                  # JSON data files
src/theme/jfsdTheme.ts                        # Brand color constants
src/utils/formatters.ts                       # Null-safe number formatters
src/utils/dataFetch.ts                        # Fetch helper with error handling
src/components/DashboardSkeleton.tsx           # Loading skeleton
src/components/DashboardErrorState.tsx         # Error display
src/components/DataFreshness.tsx               # "Data as of" footer
```

## Brand Colors

### Theme Constants (import from `../theme/jfsdTheme`)
| Constant | Hex | Use |
|----------|-----|-----|
| `NAVY` | #27277c | Deep headers, primary text |
| `GOLD` | #d98000 | Warnings, watch items |
| `SUCCESS` | #236B4A | Positive metrics, forest green |
| `ERROR` | #eb6136 | Negative, alerts, orange |
| `WARNING` | #d98000 | Caution |
| `MUTED` | #8c8c8c | Secondary text |

### Section Banner Colors
| Section | Hex | Dashboards |
|---------|-----|------------|
| Development | #1c88ed | Campaign, Donors, DRM, Ask Lists, Board |
| Finance | #236B4A | Ramp, AP, Stripe, GiveCloud, Financial Statements |
| Analytics | #009191 | Data Quality, Cohort, Retention, Community Network |
| Operations | #594fa3 | Facilities, Voice Agent, Travel, Holdings |
| Marketing | #942494 | HubSpot, Monday.com |

### Chart Color Palette (in order)
```typescript
const CHART_COLORS = ['#1c88ed', '#236B4A', '#d98000', '#eb6136', '#942494', '#009191', '#27277c'];
```

## Required Imports (every dashboard)
```tsx
import { Card, Col, Row, Statistic, Table, Typography, Space, Tag } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency, safePercent, safeNumber, safeCount } from '../utils/formatters';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
```

## Dashboard Component Pattern
```tsx
export default function ExampleDashboard() {
  const [data, setData] = useState<ExampleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<ExampleData>('/jfsd-ui/data/example.json')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error || !data) return <DashboardErrorState message={error} />;

  return (
    <div>
      {/* KPI row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic title="Total" value={safeCurrency(data.total)} />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Plot data={[...]} layout={{...}} config={{ displayModeBar: false }} />
      </Card>

      {/* Tables */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Table dataSource={data.items} columns={columns} pagination={false} />
      </Card>

      {/* Footer */}
      <DataFreshness date={data.asOfDate} />
    </div>
  );
}
```

## Rules

### Data
- All data fetched from `public/data/*.json` via `fetchJson()`
- Every data access uses optional chaining and defaults
- TypeScript interfaces for ALL data shapes — no `any` types
- Data files validated by `scripts/validate-data.ts`

### Formatting
- **Currency:** `safeCurrency(value)` — never raw `.toLocaleString()`
- **Percentages:** `safePercent(value)` — never raw `.toFixed()`
- **Numbers:** `safeNumber(value)` or `safeCount(value)`
- **Dates:** Format via `toLocaleDateString('en-US', { month: 'short', day: 'numeric' })`

### Charts (Plotly)
```typescript
// Standard layout
const layout = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  font: { family: 'Inter, system-ui, sans-serif', size: 12 },
  margin: { l: 40, r: 20, t: 40, b: 40 },
  showlegend: true,
  legend: { orientation: 'h', y: -0.15 },
};

// Standard config
const config = { displayModeBar: false, responsive: true };
```

### Cards
- `bordered={false}` with subtle box-shadow
- KPI cards use Ant Design `Statistic` with `valueStyle` for brand colors
- Consistent 16px gutter between cards

### Typography
- Dashboard title: `<Title level={4}>`
- Section headers: `<Title level={5}>`
- Body text: Ant Design `<Text>`
- Muted text: `<Text type="secondary">`

### Error Handling
- Every dashboard must handle: loading, error, empty data states
- Use `DashboardErrorState` for errors
- Use `DashboardSkeleton` for loading
- Empty arrays show "No data available" — never crash

## DO NOT
- Use custom CSS files (use Ant Design + inline styles with theme constants)
- Use colors by hex in components (use theme constants)
- Use raw `.toLocaleString()` or `.toFixed()` (use formatters)
- Leave `any` types
- Skip TypeScript interfaces
- Assume data fields exist (always optional chain)

## Reference Dashboard
**CampaignTrackerDashboard.tsx** is the gold standard. Match its patterns exactly.
