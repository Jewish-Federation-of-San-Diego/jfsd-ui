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
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency, safeNumber, safePercent } from '../utils/formatters';
import Plot from 'react-plotly.js';

const { Text, Title } = Typography;
const { Panel } = Collapse;

// ── Brand tokens ────────────────────────────────────────────────────────
const LIGHT_BG = '#FAFBFD';

// ── Formatting helpers ──────────────────────────────────────────────────
const fmtAcct = (v: number) => {
  if (Math.abs(v) < 0.5) return '—';
  const abs = safeCurrency(Math.abs(v), { maximumFractionDigits: 0 }).replace('$', '');
  if (v < 0) return `$(${abs})`;
  return safeCurrency(v, { maximumFractionDigits: 0 });
};

const fmtPct = (v: number) => {
  if (Math.abs(v) < 0.05) return '—';
  if (v < 0) return `(${safeNumber(Math.abs(v), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`;
  return safePercent(v, { decimals: 1 });
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

// ── Monthly Bar Chart (Plotly) ──────────────────────────────────────────
function MonthlyBarChart({ data }: { data: MonthLine[] }) {
  if (!data.length) return null;

  const revenueData = data.map(d => isNaN(d.revenue) ? 0 : d.revenue);
  const expenseData = data.map(d => isNaN(d.expenses) ? 0 : d.expenses);
  const monthLabels = data.map(d => d.month || 'Unknown');

  const plotData = [
    {
      name: 'Revenue',
      type: 'bar' as const,
      x: monthLabels,
      y: revenueData,
      marker: {
        color: NAVY,
        opacity: 0.9,
      },
      hovertemplate: '<b>%{x}</b><br>Revenue: $%{y:,.0f}<extra></extra>',
    },
    {
      name: 'Expenses',
      type: 'bar' as const,
      x: monthLabels,
      y: expenseData,
      marker: {
        color: GOLD,
        opacity: 0.9,
      },
      hovertemplate: '<b>%{x}</b><br>Expenses: $%{y:,.0f}<extra></extra>',
    },
  ];

  const layout = {
    margin: { l: 70, r: 20, t: 30, b: 40 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: true,
    legend: {
      orientation: 'h' as const,
      x: 0.7,
      y: 1.02,
      bgcolor: 'rgba(255,255,255,0)',
    },
    xaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 11, color: MUTED },
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#e8e8e8',
      gridwidth: 1,
      showline: false,
      tickfont: { size: 10, color: MUTED },
      tickformat: '$,.0s',
    },
    height: 280,
    barmode: 'group' as const,
  };

  return (
    <Plot
      data={plotData}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
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

// ── Functional Stacked Bar (Plotly) ─────────────────────────────────────
function FunctionalStackedBar({ rows, totals: _totals }: { rows: FERow[]; totals: any }) {
  if (!rows.length) return null;

  const categoryNames = rows.map(r => r.name || 'Unknown');
  const programServices = rows.map(r => isNaN(r.programServices) ? 0 : r.programServices);
  const managementGeneral = rows.map(r => isNaN(r.managementGeneral) ? 0 : r.managementGeneral);
  const fundraising = rows.map(r => isNaN(r.fundraising) ? 0 : r.fundraising);

  const plotData = [
    {
      name: 'Program Services',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: categoryNames,
      x: programServices,
      marker: {
        color: NAVY,
      },
      hovertemplate: '<b>%{y}</b><br>Program Services: $%{x:,.0f}<extra></extra>',
    },
    {
      name: 'M&G',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: categoryNames,
      x: managementGeneral,
      marker: {
        color: GOLD,
      },
      hovertemplate: '<b>%{y}</b><br>Management & General: $%{x:,.0f}<extra></extra>',
    },
    {
      name: 'Fundraising',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: categoryNames,
      x: fundraising,
      marker: {
        color: WARNING,
      },
      hovertemplate: '<b>%{y}</b><br>Fundraising: $%{x:,.0f}<extra></extra>',
    },
  ];

  const layout = {
    margin: { l: 150, r: 80, t: 10, b: 40 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: true,
    legend: {
      orientation: 'h' as const,
      x: 0,
      y: -0.2,
      bgcolor: 'rgba(255,255,255,0)',
    },
    xaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 10, color: MUTED },
      tickformat: '$,.0s',
    },
    yaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 11, color: '#333' },
      categoryorder: 'total ascending' as const,
    },
    height: Math.max(rows.length * 50 + 80, 200),
    barmode: 'stack' as const,
  };

  return (
    <Plot
      data={plotData}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// ── BVA Summary Chart (Plotly) ──────────────────────────────────────────
function BVASummaryChart({ items }: { items: BVALine[] }) {
  if (!items.length) return null;

  const categoryNames = items.map(r => r.name || 'Unknown');
  const budgetData = items.map(r => isNaN(r.budget) ? 0 : Math.abs(r.budget));
  const actualData = items.map(r => isNaN(r.actual) ? 0 : Math.abs(r.actual));
  const favorableColors = items.map(r => (r.variance >= 0 ? SUCCESS : ERROR));

  const plotData = [
    {
      name: 'Budget',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: categoryNames,
      x: budgetData,
      marker: {
        color: '#e0e0e0',
      },
      hovertemplate: '<b>%{y}</b><br>Budget: $%{x:,.0f}<extra></extra>',
    },
    {
      name: 'Actual',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: categoryNames,
      x: actualData,
      marker: {
        color: favorableColors,
        opacity: 0.8,
      },
      hovertemplate: '<b>%{y}</b><br>Actual: $%{x:,.0f}<extra></extra>',
    },
  ];

  const layout = {
    margin: { l: 150, r: 80, t: 10, b: 60 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    xaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 10, color: MUTED },
      tickformat: '$,.0s',
    },
    yaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 11, color: '#333' },
      categoryorder: 'total ascending' as const,
    },
    height: Math.max(items.length * 60 + 80, 200),
    barmode: 'group' as const,
  };

  return (
    <Plot
      data={plotData}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '100%' }}
    />
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
    fetchJson<FinData>(`${import.meta.env.BASE_URL}data/financial-statements.json`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/financial-statements.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton kpiCount={4} hasChart={false} />;
  if (error || !data) return <Alert type="error" message="Failed to load financial data" description={error} showIcon />;

  const kpis = data.kpis ?? { totalRevenue: 0, totalExpenses: 0, netSurplusDeficit: 0, operatingMargin: 0, cashPosition: 0, monthsOfReserves: 0 };
  const monthlyTrend = data.monthlyTrend ?? [];
  const bs = data.balanceSheet ?? { asOfDate: '', assets: { current: [], fixed: [], other: [], totalCurrent: 0, totalCurrentPriorYear: 0, totalFixed: 0, totalFixedPriorYear: 0, totalOther: 0, totalOtherPriorYear: 0, totalAssets: 0 }, liabilities: { current: [], longTerm: [], totalCurrent: 0, totalCurrentPriorYear: 0, totalLongTerm: 0, totalLongTermPriorYear: 0, totalLiabilities: 0 }, netAssets: { withoutRestriction: 0, withRestriction: 0, totalNetAssets: 0, priorYear: { withoutRestriction: 0, withRestriction: 0, totalNetAssets: 0 } } };
  const act = data.activities ?? { period: '', revenue: [], totalRevenue: { unrestricted: 0, restricted: 0, total: 0, priorYear: 0, budget: 0 }, expenses: [], totalExpenses: { amount: 0, priorYear: 0, budget: 0 }, changeInNetAssets: { total: 0, priorYear: 0, budget: 0 } };
  const fe = data.functionalExpenses ?? { rows: [], totals: { programServices: 0, managementGeneral: 0, fundraising: 0, total: 0 } };
  const bva = data.budgetVsActual ?? { revenue: [], totalRevenue: { budget: 0, actual: 0, variance: 0, variancePct: 0 }, expenses: [], totalExpenses: { budget: 0, actual: 0, variance: 0, variancePct: 0 }, netSurplusDeficit: { budget: 0, actual: 0, variance: 0 } };

  // Program ratio
  const programRatio = fe.totals.total ? (fe.totals.programServices / fe.totals.total * 100) : 0;

  // Dynamic titles
  const currentMonth = monthlyTrend[monthlyTrend.length - 1];
  const monthlyTitle = currentMonth ? 
    `Revenue vs Expenses: ${fmtAcct(currentMonth.revenue)} revenue, ${fmtAcct(currentMonth.expenses)} expenses this month` : 
    "Monthly Revenue vs Expenses";
  
  const totalVariance = Math.abs(bva.totalExpenses.variance);
  const varianceTitle = bva.expenses.length > 0 ? 
    `Budget Variance: ${fmtAcct(totalVariance)} ${bva.totalExpenses.variance >= 0 ? 'over' : 'under'} budget` : 
    "Budget Variance — Expenses";

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
            <KPICard title="Operating Margin" value={safePercent(kpis.operatingMargin, { decimals: 1 })} color={NAVY} icon={<FundOutlined />} defKey="financial" />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Cash Position" value={fmtAcct(kpis.cashPosition)} color={NAVY} icon={<BankOutlined />} />
          </Col>
          <Col xs={12} md={4}>
            <KPICard title="Months of Reserves" value={safeNumber(kpis.monthsOfReserves, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} color={NAVY} icon={<SafetyCertificateOutlined />} defKey="financial" />
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={14}>
            <Card title={monthlyTitle} size="small" styles={{ header: { background: LIGHT_BG } }}>
              <MonthlyBarChart data={monthlyTrend} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={varianceTitle} size="small" styles={{ header: { background: LIGHT_BG } }}>
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
                {safePercent(programRatio, { decimals: 1 })}
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
        <DataFreshness asOfDate={bs.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />
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
