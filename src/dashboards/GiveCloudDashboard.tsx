import { Card, Col, Row, Statistic, Table, Tag, Typography, Alert, Space, Progress } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';

const { Text, Title } = Typography;
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency, safePercent } from '../utils/formatters';

// ── Brand tokens ────────────────────────────────────────────────────────
// ── Types ───────────────────────────────────────────────────────────────
interface MonthlyRow { month: string; amount: number; recurringAmount: number; contributions: number; }
interface ProductRow { name: string; amount: number; count: number; }
interface SourceRow  { source: string; contributions: number; amount: number; }
interface ContribRow { name: string; amount: number; product: string; date: string; recurring: boolean; }
interface FailedRow  { name: string; amount: number; reason: string; date: string; }

interface GiveCloudData {
  asOfDate: string;
  notes: string[] | null;
  onlineGiving: { totalFY26: number; totalContributions: number; avgGift: number; medianGift: number; };
  monthlyTrend: MonthlyRow[];
  recurring: { activeProfiles: number; monthlyRecurringRevenue: number; newThisMonth: number; cancelledThisMonth: number; churnRate: number; avgRecurringAmount: number; };
  topProducts: ProductRow[];
  conversionBySource: SourceRow[];
  recentContributions: ContribRow[];
  failedPayments: FailedRow[];
  kpis: { totalOnlineRevenue: number; recurringRevenue: number; activeRecurring: number; newDonorsOnline: number; conversionRate: number; churnRate: number; };
}

// ── Helpers ─────────────────────────────────────────────────────────────
const fmt = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });
const fmtFull = (v: number) => safeCurrency(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Monthly Chart (Plotly) ──────────────────────────────────────────────
function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  if (!data.length) return <Text type="secondary">No monthly data</Text>;

  const monthLabels = data.map(d => d.month || 'Unknown');
  const recurringData = data.map(d => isNaN(d.recurringAmount) ? 0 : d.recurringAmount);
  const oneTimeData = data.map(d => {
    const total = isNaN(d.amount) ? 0 : d.amount;
    const recurring = isNaN(d.recurringAmount) ? 0 : d.recurringAmount;
    return Math.max(total - recurring, 0);
  });

  const plotData = [
    {
      name: 'One-time',
      type: 'bar' as const,
      x: monthLabels,
      y: oneTimeData,
      marker: {
        color: NAVY,
        opacity: 0.85,
      },
      hovertemplate: '<b>%{x}</b><br>One-time: $%{y:,.0f}<extra></extra>',
    },
    {
      name: 'Recurring',
      type: 'bar' as const,
      x: monthLabels,
      y: recurringData,
      marker: {
        color: GOLD,
        opacity: 0.9,
      },
      hovertemplate: '<b>%{x}</b><br>Recurring: $%{y:,.0f}<extra></extra>',
    },
  ];

  const layout = {
    margin: { l: 50, r: 10, t: 30, b: 40 },
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
    height: 260,
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

// ── Churn Gauge ─────────────────────────────────────────────────────────
function ChurnGauge({ rate }: { rate: number }) {
  const display = safePercent(rate, { fromFraction: true, decimals: 1 });
  const color = rate > 0.1 ? ERROR : rate > 0.05 ? WARNING : SUCCESS;
  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="dashboard"
        percent={Math.min(rate * 100, 100)}
        strokeColor={color}
        format={() => display}
        size={100}
      />
      <div style={{ marginTop: 4 }}><Text type="secondary">Monthly Churn</Text></div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function GiveCloudDashboard() {
  const [data, setData] = useState<GiveCloudData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJson<GiveCloudData>(`${import.meta.env.BASE_URL}data/givecloud.json`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/givecloud.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <Alert type="error" message="Failed to load GiveCloud data" description={error} showIcon />;
  if (!data) return null;

  const kpis = data.kpis ?? { totalOnlineRevenue: 0, recurringRevenue: 0, activeRecurring: 0, newDonorsOnline: 0, conversionRate: 0, churnRate: 0 };
  const onlineGiving = data.onlineGiving ?? { totalFY26: 0, totalContributions: 0, avgGift: 0, medianGift: 0 };
  const monthlyTrend = data.monthlyTrend ?? [];
  const recurring = data.recurring ?? { activeProfiles: 0, monthlyRecurringRevenue: 0, newThisMonth: 0, cancelledThisMonth: 0, churnRate: 0, avgRecurringAmount: 0 };
  const topProducts = data.topProducts ?? [];
  const conversionBySource = data.conversionBySource ?? [];
  const recentContributions = data.recentContributions ?? [];
  const failedPayments = data.failedPayments ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: NAVY, margin: 0 }}>
          <span style={{ marginRight: 8 }}>🌐</span>GiveCloud — Online Giving
        </Title>
        <DataFreshness asOfDate={data.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />
        {data.notes && data.notes.map((n, i) => (
          <Alert key={i} type="warning" message={n} style={{ marginTop: 8 }} showIcon banner />
        ))}
      </div>

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total Online Revenue', value: kpis.totalOnlineRevenue, prefix: '$', color: NAVY },
          { title: 'Monthly Recurring (MRR)', value: recurring.monthlyRecurringRevenue, prefix: '$', color: GOLD },
          { title: 'Active Recurring', value: kpis.activeRecurring, color: SUCCESS },
          { title: 'New Online Donors (Mo)', value: kpis.newDonorsOnline, color: NAVY },
          { title: 'Avg Gift', value: onlineGiving.avgGift, prefix: '$', color: GOLD },
        ].map((k, i) => (
          <Col xs={24} sm={12} md={8} lg={4} xl={4} key={i} style={i < 4 ? {} : { flex: 1 }}>
            <Card size="small" style={{ borderTop: `3px solid ${k.color}` }}>
              <Statistic
                title={<Text style={{ color: MUTED, fontSize: 12 }}>{k.title}</Text>}
                value={k.value}
                prefix={k.prefix}
                precision={k.prefix === '$' ? 0 : undefined}
                valueStyle={{ color: k.color, fontSize: 22, fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Monthly Trend + Recurring Health */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title={
            <Text strong style={{ color: NAVY }}>
              {monthlyTrend.length > 0 
                ? `${monthlyTrend.length} months of giving — ${fmt(monthlyTrend.reduce((sum, m) => sum + m.amount, 0))} total, ${
                    monthlyTrend.length > 1 && monthlyTrend[monthlyTrend.length - 1].amount > monthlyTrend[monthlyTrend.length - 2].amount ? '📈 trending up' : '📊 stable'
                  }`
                : "Monthly Giving Trend"
              }
            </Text>
          } size="small">
            <MonthlyChart data={monthlyTrend} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={
            <Text strong style={{ color: NAVY }}>
              {`${fmt(recurring.monthlyRecurringRevenue)} MRR — ${recurring.newThisMonth - recurring.cancelledThisMonth >= 0 ? '+' : ''}${recurring.newThisMonth - recurring.cancelledThisMonth} net monthly`}
            </Text>
          } size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Statistic
                title={<DefinitionTooltip term="MRR" dashboardKey="givecloud">Monthly Recurring Revenue</DefinitionTooltip>}
                value={recurring.monthlyRecurringRevenue}
                prefix="$"
                precision={0}
                valueStyle={{ color: GOLD, fontSize: 28, fontWeight: 700 }}
              />
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic title="New This Month" value={recurring.newThisMonth} valueStyle={{ color: SUCCESS }} />
                </Col>
                <Col span={12}>
                  <Statistic title={<DefinitionTooltip term="Churn Rate" dashboardKey="givecloud">Cancelled</DefinitionTooltip>} value={recurring.cancelledThisMonth} valueStyle={{ color: ERROR }} />
                </Col>
              </Row>
              <ChurnGauge rate={recurring.churnRate} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Avg Recurring: {fmtFull(recurring.avgRecurringAmount)} • {recurring.activeProfiles} active profiles
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Giving Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${NAVY}` }}>
            <Statistic title="Total Contributions" value={onlineGiving.totalContributions} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${GOLD}` }}>
            <Statistic title={<DefinitionTooltip term="Average Gift" dashboardKey="givecloud">Average Gift</DefinitionTooltip>} value={onlineGiving.avgGift} prefix="$" precision={2} valueStyle={{ color: GOLD }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ textAlign: 'center', borderTop: `3px solid ${SUCCESS}` }}>
            <Statistic title="Median Gift" value={onlineGiving.medianGift} prefix="$" precision={2} valueStyle={{ color: SUCCESS }} />
          </Card>
        </Col>
      </Row>

      {/* Top Products + Source */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card title={
            <Text strong style={{ color: NAVY }}>
              {topProducts.length > 0 
                ? `${topProducts.length} giving pages — ${topProducts[0]?.name || 'N/A'} leads with ${fmt(topProducts[0]?.amount || 0)}`
                : "Top Giving Pages / Products"
              }
            </Text>
          } size="small">
            <Table
              dataSource={topProducts}
              rowKey="name"
              size="small"
              pagination={false}
              columns={[
                { title: 'Page / Product', dataIndex: 'name', key: 'name', ellipsis: true,
                  render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text> },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, width: 120,
                  render: (v: number) => <Text strong>{fmt(v)}</Text>,
                  sorter: (a: ProductRow, b: ProductRow) => a.amount - b.amount, defaultSortOrder: 'descend' as const },
                { title: 'Gifts', dataIndex: 'count', key: 'count', align: 'right' as const, width: 70,
                  sorter: (a: ProductRow, b: ProductRow) => a.count - b.count },
                { title: 'Avg', key: 'avg', align: 'right' as const, width: 90,
                  render: (_: unknown, r: ProductRow) => <Text type="secondary">{fmt(r.count ? r.amount / r.count : 0)}</Text> },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={
            <Text strong style={{ color: NAVY }}>
              {conversionBySource.length > 0 
                ? `${conversionBySource.length} sources — ${conversionBySource[0]?.source || 'N/A'} leads with ${fmt(conversionBySource[0]?.amount || 0)}`
                : "By Source"
              }
            </Text>
          } size="small">
            <Table
              dataSource={conversionBySource}
              rowKey="source"
              size="small"
              pagination={false}
              columns={[
                { title: 'Source', dataIndex: 'source', key: 'source' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const,
                  render: (v: number) => <Text strong>{fmt(v)}</Text>,
                  sorter: (a: SourceRow, b: SourceRow) => a.amount - b.amount, defaultSortOrder: 'descend' as const },
                { title: '#', dataIndex: 'contributions', key: 'contributions', align: 'right' as const, width: 50 },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Contributions */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title={
            <Text strong style={{ color: NAVY }}>
              {recentContributions.length > 0 
                ? `${recentContributions.length} recent contributions — ${fmt(recentContributions.reduce((sum, c) => sum + c.amount, 0))} total`
                : "Recent Contributions"
              }
            </Text>
          } size="small"
            extra={<CsvExport data={recentContributions} columns={[
              { title: 'Date', dataIndex: 'date' },
              { title: 'Donor', dataIndex: 'name' },
              { title: 'Amount', dataIndex: 'amount' },
              { title: 'Page', dataIndex: 'product' },
              { title: 'Recurring', dataIndex: 'recurring' },
            ]} filename="givecloud-contributions" />}>
            <Table
              dataSource={recentContributions}
              rowKey={(_, i) => String(i)}
              size="small"
              pagination={false}
              columns={[
                { title: 'Date', dataIndex: 'date', key: 'date', width: 100 },
                { title: 'Donor', dataIndex: 'name', key: 'name', ellipsis: true },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, width: 110,
                  render: (v: number) => <Text strong style={{ color: NAVY }}>{fmtFull(v)}</Text> },
                { title: 'Page', dataIndex: 'product', key: 'product', ellipsis: true,
                  render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
                { title: 'Type', dataIndex: 'recurring', key: 'recurring', width: 90, align: 'center' as const,
                  render: (v: boolean) => v ? <Tag color="gold">Recurring</Tag> : <Tag>One-time</Tag> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Failed Payments */}
      {failedPayments.length > 0 && (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              title={
                <Text strong style={{ color: ERROR }}>
                  ⚠️ {failedPayments.length} failed payments — {fmt(failedPayments.reduce((sum, f) => sum + f.amount, 0))} at risk
                </Text>
              }
              size="small"
              style={{ borderTop: `3px solid ${ERROR}` }}
            >
              <Table
                dataSource={failedPayments}
                rowKey={(_, i) => String(i)}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Date', dataIndex: 'date', key: 'date', width: 100 },
                  { title: 'Donor', dataIndex: 'name', key: 'name' },
                  { title: 'Amount', dataIndex: 'amount', key: 'amount', align: 'right' as const, width: 110,
                    render: (v: number) => <Text strong style={{ color: ERROR }}>{fmtFull(v)}</Text> },
                  { title: 'Reason', dataIndex: 'reason', key: 'reason',
                    render: (v: string) => <Tag color="red">{v}</Tag> },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
