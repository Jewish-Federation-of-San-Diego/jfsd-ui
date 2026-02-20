import { Card, Col, Row, Statistic, Table, Tag, Typography, Progress, Spin, Alert, Tooltip } from 'antd';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState } from 'react';

import { DefinitionTooltip } from '../components/DefinitionTooltip';

const { Text, Title } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const GOLD = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';
const MUTED = '#8C8C8C';

// ── Types ───────────────────────────────────────────────────────────────
interface MonthlyTrend { month: string; amount: number; txnCount: number; }
interface DeptSpend { dept: string; amount: number; txnCount: number; budget: number; pctOfBudget: number; }
interface CategoryRow { category: string; amount: number; txnCount: number; }
interface MerchantRow { merchant: string; amount: number; txnCount: number; }
interface SpenderRow { name: string; amount: number; txnCount: number; dept: string; }
interface CardUtil { active: number; dormant30d: number; totalLimit: number; totalSpent: number; utilizationPct: number; }
interface WoW { thisWeek: number; lastWeek: number; changePct: number; }
interface KPIs {
  totalSpendFY26: number; monthlyAvg: number; activeCards: number;
  topDepartment: string; topDepartmentAmount: number; weekOverWeekChange: number;
}
interface RampData {
  asOfDate: string; monthlyTrend: MonthlyTrend[]; departmentSpend: DeptSpend[];
  categoryBreakdown: CategoryRow[]; topMerchants: MerchantRow[];
  topSpenders: SpenderRow[]; cardUtilization: CardUtil;
  weekOverWeek: WoW; kpis: KPIs;
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : fmt(n);

// ── SVG Bar Chart ───────────────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: MonthlyTrend[] }) {
  if (!data.length) return null;
  const W = 600, H = 220, PAD = { t: 20, r: 20, b: 40, l: 60 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.amount), 1);
  const barW = Math.min(cW / data.length * 0.7, 60);
  const gap = cW / data.length;

  // Trend line points
  const pts = data.map((d, i) => `${PAD.l + gap * i + gap / 2},${PAD.t + cH - (d.amount / max) * cH}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 220 }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = PAD.t + cH - f * cH;
        return (
          <g key={f}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#E8E8ED" strokeWidth={1} />
            <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize={10} fill={MUTED}>{fmtK(max * f)}</text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.l + gap * i + (gap - barW) / 2;
        const h = (d.amount / max) * cH;
        const y = PAD.t + cH - h;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barW} height={h} fill={NAVY} rx={3} opacity={0.85} />
            <text x={PAD.l + gap * i + gap / 2} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill={NAVY} fontWeight={600}>{d.month}</text>
          </g>
        );
      })}
      {/* Trend line */}
      <polyline points={pts} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={PAD.l + gap * i + gap / 2} cy={PAD.t + cH - (d.amount / max) * cH} r={3.5} fill={GOLD} stroke="#fff" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── Horizontal Bar Chart for Department Spend ───────────────────────────
function DeptBarChart({ data }: { data: DeptSpend[] }) {
  if (!data.length) return null;
  const maxAmt = Math.max(...data.map(d => Math.max(d.amount, d.budget)), 1);

  return (
    <div>
      {data.slice(0, 8).map(d => (
        <div key={d.dept} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text strong style={{ fontSize: 12 }}>{d.dept}</Text>
            <Text style={{ fontSize: 12, color: MUTED }}>{fmt(d.amount)} / {fmt(d.budget)}</Text>
          </div>
          <div style={{ position: 'relative', height: 20, background: '#F0F0F5', borderRadius: 4 }}>
            {/* Budget marker */}
            {d.budget > 0 && (
              <div style={{
                position: 'absolute', left: `${(d.budget / maxAmt) * 100}%`, top: 0, bottom: 0,
                borderLeft: `2px dashed ${MUTED}`, zIndex: 2,
              }} />
            )}
            {/* Actual bar */}
            <div style={{
              position: 'absolute', left: 0, top: 2, bottom: 2,
              width: `${(d.amount / maxAmt) * 100}%`,
              background: d.pctOfBudget > 80 ? (d.pctOfBudget > 100 ? ERROR : WARNING) : NAVY,
              borderRadius: 3, transition: 'width 0.3s',
            }} />
          </div>
          {d.budget > 0 && (
            <Text style={{ fontSize: 10, color: d.pctOfBudget > 80 ? ERROR : MUTED }}>{d.pctOfBudget}% of budget</Text>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Category Treemap Grid ───────────────────────────────────────────────
function CategoryGrid({ data }: { data: CategoryRow[] }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.amount, 0);
  const colors = [NAVY, GOLD, SUCCESS, WARNING, '#5B8DB8', '#8B6B3D', '#6B8E6B', '#9B6B6B', '#7B7B9B', '#4B7B7B'];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {data.slice(0, 10).map((d, i) => {
        const pct = (d.amount / total) * 100;
        return (
          <Tooltip key={d.category} title={`${fmt(d.amount)} · ${d.txnCount} txns`}>
            <div style={{
              flex: `0 0 ${Math.max(pct * 2.5, 80)}px`, minHeight: 60, padding: 8,
              background: colors[i % colors.length], borderRadius: 6, color: '#fff',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 10, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.category}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtK(d.amount)}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{pct.toFixed(1)}%</div>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Card Utilization Gauge ──────────────────────────────────────────────
function UtilGauge({ util }: { util: CardUtil }) {
  const used = util.active - util.dormant30d;
  const pctActive = util.active > 0 ? Math.round((used / util.active) * 100) : 0;

  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="dashboard"
        percent={pctActive}
        strokeColor={pctActive > 70 ? SUCCESS : pctActive > 40 ? WARNING : ERROR}
        format={() => <span style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{pctActive}%</span>}
        size={140}
      />
      <div style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: MUTED }}>Active cards in use (30d)</Text>
      </div>
      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col span={12}>
          <Statistic title="Active" value={util.active} valueStyle={{ fontSize: 18, color: SUCCESS }} />
        </Col>
        <Col span={12}>
          <Statistic title={<DefinitionTooltip term="Dormant Card" dashboardKey="ramp">Dormant</DefinitionTooltip>} value={util.dormant30d} valueStyle={{ fontSize: 18, color: WARNING }} />
        </Col>
      </Row>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function RampAnalyticsDashboard() {
  const [data, setData] = useState<RampData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/jfsd-ui/data/ramp-analytics.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="Failed to load Ramp analytics" description={error} showIcon />;
  if (!data) return null;

  const { kpis, monthlyTrend, departmentSpend, categoryBreakdown, topMerchants, topSpenders, cardUtilization, weekOverWeek } = data;
  const asOf = new Date(data.asOfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const merchantCols = [
    { title: 'Merchant', dataIndex: 'merchant', key: 'merchant', sorter: (a: MerchantRow, b: MerchantRow) => a.merchant.localeCompare(b.merchant) },
    { title: 'Spend', dataIndex: 'amount', key: 'amount', render: (v: number) => fmt(v), sorter: (a: MerchantRow, b: MerchantRow) => a.amount - b.amount, defaultSortOrder: 'descend' as const },
    { title: 'Txns', dataIndex: 'txnCount', key: 'txnCount', sorter: (a: MerchantRow, b: MerchantRow) => a.txnCount - b.txnCount },
  ];

  const spenderCols = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Dept', dataIndex: 'dept', key: 'dept', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Spend', dataIndex: 'amount', key: 'amount', render: (v: number) => fmt(v), sorter: (a: SpenderRow, b: SpenderRow) => a.amount - b.amount, defaultSortOrder: 'descend' as const },
    { title: 'Txns', dataIndex: 'txnCount', key: 'txnCount' },
  ];

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <Title level={3} style={{ color: NAVY, margin: 0 }}>Ramp Spend Analytics — FY26</Title>
        <Text style={{ color: MUTED, fontSize: 12 }}>As of {asOf}</Text>
      </div>

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" bordered={false} style={{ background: NAVY, borderRadius: 8 }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>Total FY26 Spend</span>} value={kpis.totalSpendFY26} prefix="$" precision={0} valueStyle={{ color: '#fff', fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            <Statistic title="Monthly Avg" value={kpis.monthlyAvg} prefix="$" precision={0} valueStyle={{ color: NAVY, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            <Statistic title="Active Cards" value={kpis.activeCards} valueStyle={{ color: NAVY, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            <Statistic title="Top Department" value={kpis.topDepartment} valueStyle={{ color: GOLD, fontSize: 16 }} />
            <Text style={{ fontSize: 11, color: MUTED }}>{fmt(kpis.topDepartmentAmount)}</Text>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            <Statistic
              title="Week over Week"
              value={kpis.weekOverWeekChange}
              suffix="%"
              precision={1}
              valueStyle={{ color: kpis.weekOverWeekChange < 0 ? SUCCESS : ERROR, fontSize: 20 }}
              prefix={kpis.weekOverWeekChange < 0 ? '↓' : '↑'}
            />
            <Text style={{ fontSize: 10, color: MUTED }}>{fmt(weekOverWeek.thisWeek)} vs {fmt(weekOverWeek.lastWeek)}</Text>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Monthly Spend Trend" size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}>
            <MonthlyBarChart data={monthlyTrend} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Department Spend vs Budget" size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}>
            <DeptBarChart data={departmentSpend} />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Spending by Category" size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}>
            <CategoryGrid data={categoryBreakdown} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Card Utilization" size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}>
            <UtilGauge util={cardUtilization} />
          </Card>
        </Col>
      </Row>

      {/* Tables Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Merchants" size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}
            extra={<CsvExport data={topMerchants} columns={[
              { title: 'Merchant', dataIndex: 'merchant' },
              { title: 'Spend', dataIndex: 'amount' },
              { title: 'Txns', dataIndex: 'txnCount' },
            ]} filename="ramp-top-merchants" />}>
            <Table dataSource={topMerchants} columns={merchantCols} rowKey="merchant" size="small" pagination={false} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top Spenders" size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}
            extra={<CsvExport data={topSpenders} columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Dept', dataIndex: 'dept' },
              { title: 'Spend', dataIndex: 'amount' },
              { title: 'Txns', dataIndex: 'txnCount' },
            ]} filename="ramp-top-spenders" />}>
            <Table dataSource={topSpenders} columns={spenderCols} rowKey="name" size="small" pagination={false} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
