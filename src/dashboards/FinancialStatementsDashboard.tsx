import { Card, Col, Row, Statistic, Tabs, Table, Typography, Alert, Progress, Collapse, Tag} from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  BankOutlined,
  FundOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useEffect, useState, useRef, useCallback } from 'react';
import { PdfExport } from '../components/PdfExport';
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

const { Text, Title } = Typography;
const { Panel } = Collapse;

// ── Brand tokens ────────────────────────────────────────────────────────
const LIGHT_BG = '#FAFBFD';

// ── Formatting helpers ──────────────────────────────────────────────────
const fmtAcct = (v: number) => {
  if (Math.abs(v) < 0.5) return '—';
  if (v < 0) return `$(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtPct = (v: number) => {
  if (Math.abs(v) < 0.05) return '—';
  if (v < 0) return `(${Math.abs(v).toFixed(1)}%)`;
  return `${v.toFixed(1)}%`;
};

const numStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right' as const,
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: 13,
};

const headerStyle: React.CSSProperties = {
  background: NAVY,
  color: '#fff',
  fontWeight: 600,
  fontSize: 12,
  padding: '8px 12px',
};

// ── Types ───────────────────────────────────────────────────────────────
interface BSLine { name: string; amount: number; priorYear: number; }
interface RevLine { name: string; unrestricted: number; restricted: number; total: number; priorYear: number; budget: number; }
interface ExpLine { name: string; amount: number; priorYear: number; budget: number; }
interface FERow { name: string; programServices: number; managementGeneral: number; fundraising: number; total: number; }
interface BVALine { name: string; budget: number; actual: number; variance: number; variancePct: number; }
interface MonthLine { month: string; revenue: number; expenses: number; net: number; }

interface FinData {
  generatedAt: string;
  period: string;
  monthsElapsed: number;
  balanceSheet: any;
  activities: any;
  functionalExpenses: any;
  budgetVsActual: any;
  monthlyTrend: MonthLine[];
  kpis: any;
}

// ── KPI Card ────────────────────────────────────────────────────────────
function KPICard({ title, value, prefix, suffix, color, icon, defKey }: {
  title: string; value: string | number; prefix?: string; suffix?: string;
  color?: string; icon: React.ReactNode; defKey?: string;
}) {
  const label = defKey ? <DefinitionTooltip term={title} dashboardKey="financial">{title}</DefinitionTooltip> : title;
  return (
    <Card size="small" style={{ borderTop: `3px solid ${color || NAVY}` }}>
      <Statistic
        title={<span style={{ fontSize: 11, color: MUTED }}>{label}</span>}
        value={typeof value === 'number' ? value : undefined}
        formatter={typeof value === 'string' ? () => <span style={{ ...numStyle, fontSize: 20, color: color || NAVY }}>{value}</span> : undefined}
        prefix={prefix ? <span style={{ fontSize: 14 }}>{prefix}</span> : icon}
        suffix={suffix}
        valueStyle={{ color: color || NAVY, fontSize: 20, ...numStyle }}
      />
    </Card>
  );
}

// ── SVG Bar Chart ───────────────────────────────────────────────────────
function MonthlyBarChart({ data }: { data: MonthLine[] }) {
  if (!data.length) return null;
  const W = 700, H = 280, PAD = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expenses])) * 1.15;
  const barW = chartW / data.length;
  const bw = barW * 0.3;

  const yScale = (v: number) => chartH - (v / maxVal) * chartH;
  const yTicks = Array.from({ length: 5 }, (_, i) => (maxVal / 4) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 700, fontFamily: 'system-ui' }}>
      {/* Grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + yScale(t)} y2={PAD.top + yScale(t)}
                stroke="#e8e8e8" strokeDasharray="3,3" />
          <text x={PAD.left - 8} y={PAD.top + yScale(t) + 4} textAnchor="end" fontSize={10} fill={MUTED}>
            ${(t / 1000).toFixed(0)}K
          </text>
        </g>
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD.left + i * barW + barW * 0.15;
        return (
          <g key={i}>
            <rect x={x} y={PAD.top + yScale(d.revenue)} width={bw} height={chartH - yScale(d.revenue)}
                  fill={NAVY} rx={2} opacity={0.9} />
            <rect x={x + bw + 2} y={PAD.top + yScale(d.expenses)} width={bw} height={chartH - yScale(d.expenses)}
                  fill={GOLD} rx={2} opacity={0.9} />
            <text x={PAD.left + i * barW + barW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill={MUTED}>
              {d.month}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={W - 180} y={8} width={12} height={12} fill={NAVY} rx={2} />
      <text x={W - 164} y={18} fontSize={11} fill={NAVY}>Revenue</text>
      <rect x={W - 100} y={8} width={12} height={12} fill={GOLD} rx={2} />
      <text x={W - 84} y={18} fontSize={11} fill={GOLD}>Expenses</text>
    </svg>
  );
}

// ── Budget Variance Bar ─────────────────────────────────────────────────
function BudgetVarianceBar({ name, actual, budget }: { name: string; actual: number; budget: number }) {
  const pct = budget ? (actual / budget) * 100 : 0;
  const color = pct <= 100 ? SUCCESS : pct <= 110 ? WARNING : ERROR;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 12 }}>{name}</Text>
        <Text style={{ ...numStyle, fontSize: 12 }}>{fmtPct(pct)} of budget</Text>
      </div>
      <Progress percent={Math.min(pct, 120)} showInfo={false} strokeColor={color}
                trailColor="#f0f0f0" size="small" />
    </div>
  );
}

// ── Stacked Bar for Functional Expenses ─────────────────────────────────
function FunctionalStackedBar({ rows, totals: _totals }: { rows: FERow[]; totals: any }) {
  const W = 600, H = rows.length * 36 + 30;
  const PAD = { left: 150, right: 80, top: 10 };
  const barH = 22;
  const chartW = W - PAD.left - PAD.right;
  const maxVal = Math.max(...rows.map(r => r.total)) || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 600, fontFamily: 'system-ui' }}>
      {rows.map((r, i) => {
        const y = PAD.top + i * 36;
        const scale = chartW / maxVal;
        const w1 = r.programServices * scale;
        const w2 = r.managementGeneral * scale;
        const w3 = r.fundraising * scale;
        return (
          <g key={i}>
            <text x={PAD.left - 8} y={y + barH / 2 + 4} textAnchor="end" fontSize={11} fill="#333">{r.name}</text>
            <rect x={PAD.left} y={y} width={w1} height={barH} fill={NAVY} rx={2} />
            <rect x={PAD.left + w1} y={y} width={w2} height={barH} fill={GOLD} rx={2} />
            <rect x={PAD.left + w1 + w2} y={y} width={w3} height={barH} fill={WARNING} rx={2} />
            <text x={PAD.left + w1 + w2 + w3 + 6} y={y + barH / 2 + 4} fontSize={10} fill={MUTED}>
              {fmtAcct(r.total)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <g transform={`translate(${PAD.left}, ${H - 16})`}>
        <rect width={12} height={12} fill={NAVY} rx={2} />
        <text x={16} y={10} fontSize={10}>Program Services</text>
        <rect x={130} width={12} height={12} fill={GOLD} rx={2} />
        <text x={146} y={10} fontSize={10}>M&G</text>
        <rect x={210} width={12} height={12} fill={WARNING} rx={2} />
        <text x={226} y={10} fontSize={10}>Fundraising</text>
      </g>
    </svg>
  );
}

// ── BVA Summary Bar Chart ───────────────────────────────────────────────
function BVASummaryChart({ items }: { items: BVALine[] }) {
  const W = 600, H = items.length * 48 + 20;
  const PAD = { left: 150, right: 80, top: 10 };
  const barH = 16;
  const chartW = W - PAD.left - PAD.right;
  const maxVal = Math.max(...items.flatMap(r => [Math.abs(r.budget), Math.abs(r.actual)])) || 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 600, fontFamily: 'system-ui' }}>
      {items.map((r, i) => {
        const y = PAD.top + i * 48;
        const scale = chartW / maxVal;
        const wb = Math.abs(r.budget) * scale;
        const wa = Math.abs(r.actual) * scale;
        return (
          <g key={i}>
            <text x={PAD.left - 8} y={y + 14} textAnchor="end" fontSize={11} fill="#333">{r.name}</text>
            <rect x={PAD.left} y={y} width={wb} height={barH} fill="#e0e0e0" rx={2} />
            <rect x={PAD.left} y={y + barH + 2} width={wa} height={barH} fill={r.variance >= 0 ? SUCCESS : ERROR} rx={2} opacity={0.8} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Balance Sheet Section ───────────────────────────────────────────────
function BSSection({ title: _title, items, totalLabel, total, totalPY }: {
  title: string; items: BSLine[]; totalLabel: string; total: number; totalPY: number;
}) {
  const cols = [
    { title: '', dataIndex: 'name', key: 'name', width: '50%',
      render: (v: string, _: any, i: number) => i === items.length ?
        <Text strong>{totalLabel}</Text> : <Text style={{ paddingLeft: 16 }}>{v}</Text> },
    { title: 'Current', dataIndex: 'amount', key: 'amount', width: '25%', align: 'right' as const,
      render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>,
      onHeaderCell: () => ({ style: headerStyle }) },
    { title: 'Prior Year', dataIndex: 'priorYear', key: 'priorYear', width: '25%', align: 'right' as const,
      render: (v: number) => <span style={{ ...numStyle, color: MUTED }}>{fmtAcct(v)}</span>,
      onHeaderCell: () => ({ style: headerStyle }) },
  ];
  const dataSource = [
    ...items.map((it, i) => ({ key: i, ...it })),
    { key: 'total', name: totalLabel, amount: total, priorYear: totalPY },
  ];
  return (
    <Table dataSource={dataSource} columns={cols} pagination={false} size="small"
           rowClassName={(_, i) => i === items.length ? 'fs-grand-total' : ''}
           style={{ marginBottom: 16 }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function FinancialStatementsDashboard() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<FinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch('/jfsd-ui/data/financial-statements.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch('/jfsd-ui/data/financial-statements.json')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton kpiCount={4} hasChart={false} />;
  if (error || !data) return <Alert type="error" message="Failed to load financial data" description={error} showIcon />;

  const { kpis, monthlyTrend, balanceSheet: bs, activities: act, functionalExpenses: fe, budgetVsActual: bva } = data;

  // Program ratio
  const programRatio = fe.totals.total ? (fe.totals.programServices / fe.totals.total * 100) : 0;

  const tabItems = [
    // ── TAB 1: OVERVIEW ──
    { key: '1', label: '📊 Overview', children: (
      <div>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={4}>
            <KPICard title="Total Revenue" value={fmtAcct(kpis.totalRevenue)} color={SUCCESS} icon={<DollarOutlined />} />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Total Expenses" value={fmtAcct(kpis.totalExpenses)} color={ERROR} icon={<FallOutlined />} />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Net Surplus/(Deficit)" value={fmtAcct(kpis.netSurplusDeficit)}
                     color={kpis.netSurplusDeficit >= 0 ? SUCCESS : ERROR} icon={<RiseOutlined />} />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Operating Margin" value={`${kpis.operatingMargin.toFixed(1)}%`} color={NAVY} icon={<FundOutlined />} defKey="financial" />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Cash Position" value={fmtAcct(kpis.cashPosition)} color={NAVY} icon={<BankOutlined />} />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Months of Reserves" value={`${kpis.monthsOfReserves.toFixed(1)}`} color={NAVY} icon={<SafetyCertificateOutlined />} defKey="financial" />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={14}>
            <Card title="Monthly Revenue vs Expenses" size="small" styles={{ header: { background: LIGHT_BG } }}>
              <MonthlyBarChart data={monthlyTrend} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Budget Variance — Expenses" size="small" styles={{ header: { background: LIGHT_BG } }}>
              {bva.expenses.filter((e: BVALine) => e.budget > 0).map((e: BVALine, i: number) => (
                <BudgetVarianceBar key={i} name={e.name} actual={e.actual} budget={e.budget} />
              ))}
            </Card>
          </Col>
        </Row>
      </div>
    )},

    // ── TAB 2: BALANCE SHEET ──
    { key: '2', label: '🏦 Balance Sheet', children: (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>STATEMENT OF FINANCIAL POSITION</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>As of {bs.asOfDate}</Text>
        </div>
        <Row gutter={[24, 16]}>
          <Col xs={24} lg={12}>
            <Card title={<span style={{ color: NAVY, fontWeight: 700 }}>ASSETS</span>} size="small">
              <Collapse defaultActiveKey={['current', 'fixed', 'other']} ghost>
                <Panel header={<Text strong>Current Assets</Text>} key="current">
                  <BSSection title="Current" items={bs.assets.current} totalLabel="Total Current Assets"
                             total={bs.assets.totalCurrent} totalPY={bs.assets.totalCurrentPriorYear} />
                </Panel>
                <Panel header={<Text strong>Fixed Assets</Text>} key="fixed">
                  <BSSection title="Fixed" items={bs.assets.fixed} totalLabel="Total Fixed Assets"
                             total={bs.assets.totalFixed} totalPY={bs.assets.totalFixedPriorYear} />
                </Panel>
                <Panel header={<Text strong>Other Assets</Text>} key="other">
                  <BSSection title="Other" items={bs.assets.other} totalLabel="Total Other Assets"
                             total={bs.assets.totalOther} totalPY={bs.assets.totalOtherPriorYear} />
                </Panel>
              </Collapse>
              <div style={{ borderTop: '3px double #333', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 14 }}>TOTAL ASSETS</Text>
                <span style={{ ...numStyle, fontWeight: 700, fontSize: 14 }}>{fmtAcct(bs.assets.totalAssets)}</span>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={<span style={{ color: NAVY, fontWeight: 700 }}>LIABILITIES & NET ASSETS</span>} size="small">
              <Collapse defaultActiveKey={['cl', 'lt', 'na']} ghost>
                <Panel header={<Text strong>Current Liabilities</Text>} key="cl">
                  <BSSection title="CL" items={bs.liabilities.current} totalLabel="Total Current Liabilities"
                             total={bs.liabilities.totalCurrent} totalPY={bs.liabilities.totalCurrentPriorYear} />
                </Panel>
                <Panel header={<Text strong>Long-Term Liabilities</Text>} key="lt">
                  <BSSection title="LT" items={bs.liabilities.longTerm} totalLabel="Total Long-Term"
                             total={bs.liabilities.totalLongTerm} totalPY={bs.liabilities.totalLongTermPriorYear} />
                </Panel>
                <Panel header={<Text strong>Net Assets</Text>} key="na">
                  <Table dataSource={[
                    { key: 1, name: 'Without donor restrictions', amount: bs.netAssets.withoutRestriction, priorYear: bs.netAssets.priorYear.withoutRestriction },
                    { key: 2, name: 'With donor restrictions', amount: bs.netAssets.withRestriction, priorYear: bs.netAssets.priorYear.withRestriction },
                    { key: 3, name: 'Total Net Assets', amount: bs.netAssets.totalNetAssets, priorYear: bs.netAssets.priorYear.totalNetAssets },
                  ]} columns={[
                    { title: '', dataIndex: 'name', key: 'name', render: (v: string, _: any, i: number) => i === 2 ? <Text strong>{v}</Text> : <Text style={{ paddingLeft: 16 }}>{v}</Text> },
                    { title: 'Current', dataIndex: 'amount', key: 'a', align: 'right', render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
                    { title: 'Prior Year', dataIndex: 'priorYear', key: 'p', align: 'right', render: (v: number) => <span style={{ ...numStyle, color: MUTED }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
                  ]} pagination={false} size="small" rowClassName={(_, i) => i === 2 ? 'fs-grand-total' : ''} />
                </Panel>
              </Collapse>
              <div style={{ borderTop: '3px double #333', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 14 }}>TOTAL LIABILITIES & NET ASSETS</Text>
                <span style={{ ...numStyle, fontWeight: 700, fontSize: 14 }}>
                  {fmtAcct(bs.liabilities.totalLiabilities + bs.netAssets.totalNetAssets)}
                </span>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    )},

    // ── TAB 3: INCOME STATEMENT ──
    { key: '3', label: '📈 Income Statement', children: (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>STATEMENT OF ACTIVITIES</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{act.period}</Text>
        </div>

        {/* Revenue */}
        <Card title={<span style={{ color: SUCCESS }}>Revenue</span>} size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={[
              ...act.revenue.map((r: RevLine, i: number) => ({ key: i, ...r })),
              { key: 'total', name: 'TOTAL REVENUE', unrestricted: act.totalRevenue.unrestricted,
                restricted: act.totalRevenue.restricted, total: act.totalRevenue.total,
                priorYear: act.totalRevenue.priorYear, budget: act.totalRevenue.budget, _isTotal: true },
            ]}
            columns={[
              { title: '', dataIndex: 'name', key: 'name', width: '28%',
                render: (v: string, rec: any) => rec._isTotal ? <Text strong>{v}</Text> : v },
              { title: 'Unrestricted', dataIndex: 'unrestricted', key: 'u', align: 'right',
                render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Restricted', dataIndex: 'restricted', key: 'r', align: 'right',
                render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Total', dataIndex: 'total', key: 't', align: 'right',
                render: (v: number, rec: any) => <span style={{ ...numStyle, fontWeight: rec._isTotal ? 700 : 400 }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Prior Year', dataIndex: 'priorYear', key: 'py', align: 'right',
                render: (v: number) => <span style={{ ...numStyle, color: MUTED }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Budget', dataIndex: 'budget', key: 'b', align: 'right',
                render: (v: number) => <span style={{ ...numStyle, color: MUTED }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
            ]}
            pagination={false} size="small"
            rowClassName={(rec: any) => rec._isTotal ? 'fs-grand-total' : ''}
          />
        </Card>

        {/* Expenses */}
        <Card title={<span style={{ color: ERROR }}>Expenses</span>} size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={[
              ...act.expenses.map((e: ExpLine, i: number) => ({ key: i, ...e })),
              { key: 'total', name: 'TOTAL EXPENSES', amount: act.totalExpenses.amount,
                priorYear: act.totalExpenses.priorYear, budget: act.totalExpenses.budget, _isTotal: true },
            ]}
            columns={[
              { title: '', dataIndex: 'name', key: 'name', width: '40%',
                render: (v: string, rec: any) => rec._isTotal ? <Text strong>{v}</Text> : v },
              { title: 'Amount', dataIndex: 'amount', key: 'a', align: 'right',
                render: (v: number, rec: any) => <span style={{ ...numStyle, fontWeight: rec._isTotal ? 700 : 400 }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Prior Year', dataIndex: 'priorYear', key: 'py', align: 'right',
                render: (v: number) => <span style={{ ...numStyle, color: MUTED }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Budget', dataIndex: 'budget', key: 'b', align: 'right',
                render: (v: number) => <span style={{ ...numStyle, color: MUTED }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Variance', key: 'var', align: 'right',
                render: (_: any, rec: any) => {
                  const variance = rec.budget - rec.amount; // positive = favorable for expenses
                  const color = variance >= 0 ? SUCCESS : ERROR;
                  return <span style={{ ...numStyle, color }}>{fmtAcct(variance)}</span>;
                }, onHeaderCell: () => ({ style: headerStyle }) },
            ]}
            pagination={false} size="small"
            rowClassName={(rec: any) => rec._isTotal ? 'fs-grand-total' : ''}
          />
        </Card>

        {/* Change in Net Assets */}
        <Card size="small" style={{ background: LIGHT_BG, borderLeft: `4px solid ${NAVY}` }}>
          <Row justify="space-between" align="middle">
            <Col><Text strong style={{ fontSize: 15 }}>CHANGE IN NET ASSETS</Text></Col>
            <Col>
              <span style={{ ...numStyle, fontSize: 18, fontWeight: 700,
                color: act.changeInNetAssets.total >= 0 ? SUCCESS : ERROR }}>
                {fmtAcct(act.changeInNetAssets.total)}
              </span>
              <span style={{ ...numStyle, fontSize: 12, color: MUTED, marginLeft: 16 }}>
                PY: {fmtAcct(act.changeInNetAssets.priorYear)}
              </span>
              <span style={{ ...numStyle, fontSize: 12, color: MUTED, marginLeft: 16 }}>
                Budget: {fmtAcct(act.changeInNetAssets.budget)}
              </span>
            </Col>
          </Row>
        </Card>
      </div>
    )},

    // ── TAB 4: FUNCTIONAL EXPENSES ──
    { key: '4', label: '🧩 Functional Expenses', children: (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>STATEMENT OF FUNCTIONAL EXPENSES</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{act.period}</Text>
        </div>

        {/* Program Ratio callout */}
        <Card size="small" style={{ marginBottom: 16, background: programRatio >= 75 ? '#f0faf0' : '#fef4f0',
                                     borderLeft: `4px solid ${programRatio >= 75 ? SUCCESS : WARNING}` }}>
          <Row justify="space-between" align="middle">
            <Col>
              <DefinitionTooltip term="Program Ratio" dashboardKey="financial">Program Ratio</DefinitionTooltip>
              <Text type="secondary" style={{ marginLeft: 8 }}>(target ≥ 75%)</Text>
            </Col>
            <Col>
              <Tag color={programRatio >= 75 ? 'success' : 'warning'} style={{ fontSize: 16, padding: '4px 16px' }}>
                {programRatio.toFixed(1)}%
              </Tag>
            </Col>
          </Row>
        </Card>

        {/* Matrix table */}
        <Table
          dataSource={[
            ...fe.rows.map((r: FERow, i: number) => ({ key: i, ...r })),
            { key: 'total', name: 'TOTAL', ...fe.totals, _isTotal: true },
          ]}
          columns={[
            { title: '', dataIndex: 'name', key: 'name', width: '30%',
              render: (v: string, rec: any) => rec._isTotal ? <Text strong>{v}</Text> : v },
            { title: 'Program Services', dataIndex: 'programServices', key: 'ps', align: 'right',
              render: (v: number, rec: any) => <span style={{ ...numStyle, fontWeight: rec._isTotal ? 700 : 400 }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
            { title: 'M&G', dataIndex: 'managementGeneral', key: 'mg', align: 'right',
              render: (v: number, rec: any) => <span style={{ ...numStyle, fontWeight: rec._isTotal ? 700 : 400 }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
            { title: 'Fundraising', dataIndex: 'fundraising', key: 'fr', align: 'right',
              render: (v: number, rec: any) => <span style={{ ...numStyle, fontWeight: rec._isTotal ? 700 : 400 }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
            { title: 'Total', dataIndex: 'total', key: 't', align: 'right',
              render: (v: number, rec: any) => <span style={{ ...numStyle, fontWeight: rec._isTotal ? 700 : 400 }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
          ]}
          pagination={false} size="small"
          rowClassName={(rec: any) => rec._isTotal ? 'fs-grand-total' : ''}
          style={{ marginBottom: 24 }}
        />

        {/* Stacked bar chart */}
        <Card title="Functional Split" size="small">
          <FunctionalStackedBar rows={fe.rows} totals={fe.totals} />
        </Card>
      </div>
    )},

    // ── TAB 5: BUDGET VS ACTUAL ──
    { key: '5', label: '📋 Budget vs Actual', children: (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>BUDGET VS. ACTUAL</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{act.period} (YTD {data.monthsElapsed} months)</Text>
        </div>

        {/* Revenue */}
        <Card title={<span style={{ color: SUCCESS }}>Revenue</span>} size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={[
              ...bva.revenue.map((r: BVALine, i: number) => ({ key: i, ...r })),
              { key: 'total', name: 'TOTAL REVENUE', ...bva.totalRevenue, _isTotal: true },
            ]}
            columns={[
              { title: '', dataIndex: 'name', key: 'name', width: '28%',
                render: (v: string, rec: any) => rec._isTotal ? <Text strong>{v}</Text> : v },
              { title: 'Budget', dataIndex: 'budget', key: 'b', align: 'right',
                render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Actual', dataIndex: 'actual', key: 'a', align: 'right',
                render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Variance ($)', dataIndex: 'variance', key: 'v', align: 'right',
                render: (v: number) => <span style={{ ...numStyle, color: v >= 0 ? SUCCESS : ERROR }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Variance (%)', dataIndex: 'variancePct', key: 'vp', align: 'right',
                render: (v: number) => {
                  const color = v >= 0 ? SUCCESS : ERROR;
                  return <span style={{ ...numStyle, color }}>{fmtPct(v)}</span>;
                }, onHeaderCell: () => ({ style: headerStyle }) },
              { title: '', key: 'light', width: 40,
                render: (_: any, rec: any) => {
                  const p = rec.budget ? (rec.actual / rec.budget) * 100 : 0;
                  const c = p >= 90 && p <= 110 ? SUCCESS : p < 90 ? WARNING : ERROR;
                  return <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, margin: '0 auto' }} />;
                }},
            ]}
            pagination={false} size="small"
            rowClassName={(rec: any) => rec._isTotal ? 'fs-grand-total' : ''}
          />
        </Card>

        {/* Expenses */}
        <Card title={<span style={{ color: ERROR }}>Expenses</span>} size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={[
              ...bva.expenses.map((e: BVALine, i: number) => ({ key: i, ...e })),
              { key: 'total', name: 'TOTAL EXPENSES', ...bva.totalExpenses, _isTotal: true },
            ]}
            columns={[
              { title: '', dataIndex: 'name', key: 'name', width: '28%',
                render: (v: string, rec: any) => rec._isTotal ? <Text strong>{v}</Text> : v },
              { title: 'Budget', dataIndex: 'budget', key: 'b', align: 'right',
                render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Actual', dataIndex: 'actual', key: 'a', align: 'right',
                render: (v: number) => <span style={numStyle}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Variance ($)', dataIndex: 'variance', key: 'v', align: 'right',
                render: (v: number) => <span style={{ ...numStyle, color: v >= 0 ? SUCCESS : ERROR }}>{fmtAcct(v)}</span>, onHeaderCell: () => ({ style: headerStyle }) },
              { title: 'Variance (%)', dataIndex: 'variancePct', key: 'vp', align: 'right',
                render: (v: number) => {
                  const color = v >= 0 ? SUCCESS : ERROR;
                  return <span style={{ ...numStyle, color }}>{fmtPct(v)}</span>;
                }, onHeaderCell: () => ({ style: headerStyle }) },
              { title: '', key: 'light', width: 40,
                render: (_: any, rec: any) => {
                  // For expenses, under budget is favorable
                  const c = rec.variance >= 0 ? SUCCESS : rec.variancePct >= -10 ? WARNING : ERROR;
                  return <div style={{ width: 12, height: 12, borderRadius: '50%', background: c, margin: '0 auto' }} />;
                }},
            ]}
            pagination={false} size="small"
            rowClassName={(rec: any) => rec._isTotal ? 'fs-grand-total' : ''}
          />
        </Card>

        {/* Net */}
        <Card size="small" style={{ background: LIGHT_BG, borderLeft: `4px solid ${NAVY}` }}>
          <Row justify="space-between" align="middle">
            <Col><Text strong style={{ fontSize: 14 }}>NET SURPLUS / (DEFICIT)</Text></Col>
            <Col>
              <span style={{ ...numStyle, fontSize: 12, color: MUTED, marginRight: 16 }}>
                Budget: {fmtAcct(bva.netSurplusDeficit.budget)}
              </span>
              <span style={{ ...numStyle, fontSize: 12, color: MUTED, marginRight: 16 }}>
                Actual: {fmtAcct(bva.netSurplusDeficit.actual)}
              </span>
              <span style={{ ...numStyle, fontSize: 16, fontWeight: 700,
                color: bva.netSurplusDeficit.variance >= 0 ? SUCCESS : ERROR }}>
                Var: {fmtAcct(bva.netSurplusDeficit.variance)}
              </span>
            </Col>
          </Row>
        </Card>

        {/* Summary chart */}
        <Card title="Budget vs Actual — Expenses by Category" size="small" style={{ marginTop: 16 }}>
          <BVASummaryChart items={bva.expenses.filter((e: BVALine) => e.budget > 0)} />
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 8 }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#e0e0e0', borderRadius: 2, marginRight: 4 }} />Budget</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: SUCCESS, borderRadius: 2, marginRight: 4, opacity: 0.8 }} />Actual (favorable)</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, background: ERROR, borderRadius: 2, marginRight: 4, opacity: 0.8 }} />Actual (over budget)</span>
          </div>
        </Card>
      </div>
    )},
  ];

  return (
    <div ref={contentRef} style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16, position: 'relative' }}>
        <Title level={3} style={{ color: NAVY, marginBottom: 0 }}>Financial Statements</Title>
        <Text type="secondary">{data.period}</Text>
        <DataFreshness asOfDate={data.balanceSheet.asOfDate} onRefresh={refresh} refreshing={refreshing} />
        <Tag color="default" style={{ position: 'absolute', right: 0, top: 4, fontSize: 10, opacity: 0.6 }}>
          UNAUDITED
        </Tag>
        <div style={{ position: 'absolute', left: 0, top: 4 }}>
          <PdfExport filename="financial-statements" targetRef={contentRef} />
        </div>
      </div>

      <style>{`
        .fs-grand-total td { border-top: 2px solid #333 !important; border-bottom: 3px double #333 !important; }
        .ant-table-thead > tr > th { font-size: 12px !important; }
      `}</style>

      <Tabs items={tabItems} defaultActiveKey="1" type="card"
            style={{ '--ant-tabs-card-bg': LIGHT_BG } as any} />
    </div>
  );
}
