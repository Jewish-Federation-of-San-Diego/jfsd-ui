import { Card, Col, Row, Statistic, Table, Tag, Typography, Alert, Space, Progress } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback } from 'react';

const { Text, Title } = Typography;
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

// ── Brand tokens ────────────────────────────────────────────────────────
const GRID    = '#E8E8ED';
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
const fmt = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtFull = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

// ── SVG Bar Chart ───────────────────────────────────────────────────────
function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  if (!data.length) return <Text type="secondary">No monthly data</Text>;
  const maxAmt = Math.max(...data.map(d => d.amount), 1);
  const W = 600, H = 260, PAD = 50, BAR_PAD = 6;
  const barW = Math.min(48, (W - PAD * 2) / data.length - BAR_PAD);
  const chartH = H - PAD - 30;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, fontFamily: 'inherit' }}>
      {/* Y-axis grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = PAD + chartH * (1 - f);
        return (
          <g key={f}>
            <line x1={PAD} x2={W - 10} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD - 6} y={y + 4} textAnchor="end" fontSize={10} fill={MUTED}>
              {fmt(maxAmt * f)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = PAD + i * ((W - PAD * 2) / data.length) + BAR_PAD / 2;
        const h = (d.amount / maxAmt) * chartH;
        const recH = d.recurringAmount ? (d.recurringAmount / maxAmt) * chartH : 0;
        const oneTimeH = h - recH;
        return (
          <g key={d.month}>
            {/* One-time portion */}
            <rect x={x} y={PAD + chartH - h} width={barW} height={oneTimeH} rx={3}
              fill={NAVY} opacity={0.85}>
              <title>{d.month}: {fmt(d.amount)} ({d.contributions} gifts)</title>
            </rect>
            {/* Recurring portion */}
            {recH > 0 && (
              <rect x={x} y={PAD + chartH - recH} width={barW} height={recH} rx={3}
                fill={GOLD} opacity={0.9}>
                <title>Recurring: {fmt(d.recurringAmount)}</title>
              </rect>
            )}
            {/* Label */}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={NAVY} fontWeight={500}>
              {d.month}
            </text>
            {/* Value on top */}
            <text x={x + barW / 2} y={PAD + chartH - h - 4} textAnchor="middle" fontSize={9} fill={MUTED}>
              {fmt(d.amount)}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <rect x={W - 150} y={4} width={10} height={10} fill={NAVY} rx={2} />
      <text x={W - 136} y={13} fontSize={10} fill={NAVY}>One-time</text>
      <rect x={W - 80} y={4} width={10} height={10} fill={GOLD} rx={2} />
      <text x={W - 66} y={13} fontSize={10} fill={GOLD}>Recurring</text>
    </svg>
  );
}

// ── Churn Gauge ─────────────────────────────────────────────────────────
function ChurnGauge({ rate }: { rate: number }) {
  const display = (rate * 100).toFixed(1);
  const color = rate > 0.1 ? ERROR : rate > 0.05 ? WARNING : SUCCESS;
  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="dashboard"
        percent={Math.min(rate * 100, 100)}
        strokeColor={color}
        format={() => `${display}%`}
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
    fetch(`${import.meta.env.BASE_URL}data/givecloud.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
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

  const { kpis, onlineGiving, monthlyTrend, recurring, topProducts, conversionBySource, recentContributions, failedPayments } = data;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: NAVY, margin: 0 }}>
          <span style={{ marginRight: 8 }}>🌐</span>GiveCloud — Online Giving
        </Title>
        <DataFreshness asOfDate={data.asOfDate} onRefresh={refresh} refreshing={refreshing} />
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
          <Card title={<Text strong style={{ color: NAVY }}>Monthly Giving Trend</Text>} size="small">
            <MonthlyChart data={monthlyTrend} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Text strong style={{ color: NAVY }}>Recurring Health</Text>} size="small">
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
          <Card title={<Text strong style={{ color: NAVY }}>Top Giving Pages / Products</Text>} size="small">
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
          <Card title={<Text strong style={{ color: NAVY }}>By Source</Text>} size="small">
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
          <Card title={<Text strong style={{ color: NAVY }}>Recent Contributions</Text>} size="small"
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
              title={<Text strong style={{ color: ERROR }}>⚠️ Failed Payments</Text>}
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
