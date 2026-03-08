import { Card, Col, Row, Statistic, Table, Tag, Typography, Alert, Tooltip } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';

import { DataFreshness } from '../components/DataFreshness';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { safeCount, safeCurrency, safePercent } from '../utils/formatters';

const { Text, Title } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
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
  receiptCompliance?: number; // Optional field for receipt attachment rate
}
interface RampData {
  asOfDate: string; monthlyTrend: MonthlyTrend[]; departmentSpend: DeptSpend[];
  categoryBreakdown: CategoryRow[]; topMerchants: MerchantRow[];
  topSpenders: SpenderRow[]; cardUtilization: CardUtil;
  weekOverWeek: WoW; kpis: KPIs;
}

const fmt = (n: number) => safeCurrency(n, { maximumFractionDigits: 0 });
const fmtK = (n: number) => safeCurrency(n, { notation: 'compact', maximumFractionDigits: 1 });

// ── Monthly Bar Chart (Plotly) ──────────────────────────────────────────
function MonthlyBarChart({ data }: { data: MonthlyTrend[] }) {
  if (!data.length) return null;

  const monthLabels = data.map(d => d.month || 'Unknown');
  const amounts = data.map(d => isNaN(d.amount) ? 0 : d.amount);
  const txnCounts = data.map(d => isNaN(d.txnCount) ? 0 : d.txnCount);

  const plotData = [
    {
      name: 'Monthly Spend',
      type: 'bar' as const,
      x: monthLabels,
      y: amounts,
      marker: {
        color: NAVY,
        opacity: 0.85,
      },
      hovertemplate: '<b>%{x}</b><br>Amount: $%{y:,.0f}<br>Transactions: %{customdata}<extra></extra>',
      customdata: txnCounts,
    },
    {
      name: 'Trend',
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      x: monthLabels,
      y: amounts,
      line: {
        color: GOLD,
        width: 2.5,
        shape: 'spline' as const,
      },
      marker: {
        color: GOLD,
        size: 7,
        line: {
          color: 'white',
          width: 1.5,
        },
      },
      hovertemplate: '<b>%{x}</b><br>Trend: $%{y:,.0f}<extra></extra>',
      yaxis: 'y',
    },
  ];

  const layout = {
    margin: { l: 60, r: 20, t: 20, b: 60 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    xaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 11, color: NAVY, family: 'system-ui' },
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#E8E8ED',
      gridwidth: 1,
      showline: false,
      tickfont: { size: 10, color: MUTED },
      tickformat: '$,.0s',
    },
    height: 220,
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
  const total = Math.max(data.reduce((s, d) => s + d.amount, 0), 1);
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
              <div style={{ fontSize: 10, opacity: 0.7 }}>{safePercent(pct, { decimals: 1 })}</div>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Card Utilization Statistics (replaced gauge) ────────────────────────
function CardUtilization({ util }: { util: CardUtil }) {
  const activeCards = util.active || 0;
  const dormantCards = util.dormant30d || 0;

  return (
    <Card title="Card Utilization" size="small">
      <Row gutter={16}>
        <Col span={12}>
          <Statistic 
            title="Active (30d)" 
            value={safeCount(activeCards)} 
            valueStyle={{ color: activeCards > 0 ? SUCCESS : MUTED, fontSize: 28 }} 
          />
        </Col>
        <Col span={12}>
          <Statistic 
            title="Dormant" 
            value={safeCount(dormantCards)} 
            valueStyle={{ color: dormantCards > 0 ? GOLD : MUTED, fontSize: 28 }} 
          />
        </Col>
      </Row>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function RampAnalyticsDashboard() {
  const [data, setData] = useState<RampData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/ramp-analytics.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/ramp-analytics.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <Alert type="error" message="Failed to load Ramp analytics" description={error} showIcon />;
  if (!data) return null;

  const kpis = data.kpis ?? { totalSpendFY26: 0, monthlyAvg: 0, activeCards: 0, topDepartment: '—', topDepartmentAmount: 0, weekOverWeekChange: 0 };
  const monthlyTrend = data.monthlyTrend ?? [];
  const departmentSpend = data.departmentSpend ?? [];
  const categoryBreakdown = data.categoryBreakdown ?? [];
  const topMerchants = data.topMerchants ?? [];
  const topSpenders = data.topSpenders ?? [];
  const cardUtilization = data.cardUtilization ?? { active: 0, dormant30d: 0, totalLimit: 0, totalSpent: 0, utilizationPct: 0 };
  const weekOverWeek = data.weekOverWeek ?? { thisWeek: 0, lastWeek: 0, changePct: 0 };

  // Fix KPI disconnect - if totalSpendFY26 is 0 but we have category data, sum the categories
  const categoryTotal = categoryBreakdown.reduce((sum, cat) => sum + (cat.amount || 0), 0);
  const displayTotalSpend = (kpis.totalSpendFY26 || 0) > 0 ? kpis.totalSpendFY26 : categoryTotal;

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

  // Dynamic titles
  const currentMonth = monthlyTrend[monthlyTrend.length - 1];
  const monthTitle = currentMonth ? `Monthly Trend: ${fmt(currentMonth.amount)} this month` : "Monthly Spend Trend";
  const deptTitle = kpis.topDepartment && kpis.topDepartment !== '—' 
    ? `Department Spend: ${kpis.topDepartment} leads at ${fmt(kpis.topDepartmentAmount)}` 
    : 'Department Spend';
  const topMerchantTitle = topMerchants[0] ? `Top Merchants: ${topMerchants[0].merchant} leads at ${fmt(topMerchants[0].amount)}` : "Top Merchants";
  const topSpenderTitle = topSpenders[0] ? `Top Spenders: ${topSpenders[0].name} leads at ${fmt(topSpenders[0].amount)}` : "Top Spenders";

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <Title level={3} style={{ color: NAVY, margin: 0 }}>Ramp Spend Analytics — FY26</Title>
      </div>
      <DataFreshness asOfDate={data.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" bordered={false} style={{ background: NAVY, borderRadius: 8 }}>
            <Statistic title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>Total FY26 Spend</span>} value={displayTotalSpend} prefix="$" precision={0} valueStyle={{ color: '#fff', fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            <Statistic title="Monthly Avg" value={kpis.monthlyAvg} prefix="$" precision={0} valueStyle={{ color: NAVY, fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            <Statistic title="Active Cards" value={safeCount(kpis.activeCards)} valueStyle={{ color: NAVY, fontSize: 20 }} />
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

      {/* Receipt Compliance Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} lg={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 8 }}>
            {kpis.receiptCompliance != null ? (
              <Statistic
                title="Receipt Compliance"
                value={kpis.receiptCompliance}
                suffix="%"
                precision={1}
                valueStyle={{ color: (kpis.receiptCompliance || 0) >= 80 ? SUCCESS : (kpis.receiptCompliance || 0) >= 60 ? WARNING : ERROR, fontSize: 20 }}
              />
            ) : (
              <div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Receipt Compliance</div>
                <div style={{ color: WARNING, fontSize: 16, fontWeight: 600 }}>Connect Ramp API</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={monthTitle} size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}>
            <MonthlyBarChart data={monthlyTrend} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={deptTitle} size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}>
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
          <CardUtilization util={cardUtilization} />
        </Col>
      </Row>

      {/* Tables Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={topMerchantTitle} size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}
            extra={<CsvExport data={topMerchants} columns={[
              { title: 'Merchant', dataIndex: 'merchant' },
              { title: 'Spend', dataIndex: 'amount' },
              { title: 'Txns', dataIndex: 'txnCount' },
            ]} filename="ramp-top-merchants" />}>
            <Table dataSource={topMerchants} columns={merchantCols} rowKey="merchant" size="small" pagination={false} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={topSpenderTitle} size="small" styles={{ header: { color: NAVY, borderBottom: `2px solid ${GOLD}` } }}
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
