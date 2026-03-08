import { Card, Col, Row, Statistic, Table, Tag, Typography, Space, Progress, Alert, List } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback } from 'react';
import { InfoCircleOutlined, WarningOutlined, CheckCircleOutlined, BulbOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import Plot from "react-plotly.js";

import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safeCurrency, safePercent } from '../utils/formatters';

const { Text } = Typography;

// ── Types ───────────────────────────────────────────────────────────────
interface MonthlyRow {
  month: string;
  charges: number;
  amount: number;
  fees: number;
  feeRate: number;
}

interface CardBrandRow {
  brand: string;
  amount: number;
  charges: number;
}

interface SourceRow {
  source: string;
  charges: number;
  amount: number;
  pct: number;
}

interface KPIs {
  grossVolume: number;
  netAfterFees: number;
  totalFees: number;
  avgFeeRate: number;
  totalCharges: number;
  avgPerCharge: number;
  asOfDate: string;
}

interface StripeData {
  monthlyData: MonthlyRow[];
  cardBrandData: CardBrandRow[];
  sourceData: SourceRow[];
  kpis: KPIs;
}

// ── Card brand colors ───────────────────────────────────────────────────
const BRAND_COLORS: Record<string, string> = {
  Visa: NAVY,
  Mastercard: GOLD,
  Amex: '#5B8DB8',
  Discover: '#E87722',
  Other: MUTED,
};

const fmtUSD = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });

const feeColor = (v: number) => v > 2.6 ? ERROR : v > 2.5 ? WARNING : SUCCESS;
const feeTag = (v: number): 'error' | 'warning' | 'success' => v > 2.6 ? 'error' : v > 2.5 ? 'warning' : 'success';

// ── Hook: measure width reliably on mobile Safari ───────────────────────
// useWidth removed — Plotly handles responsive sizing

// ── Monthly comparison helper ────────────────────────────────────────────
function MonthDelta({ current, prior }: { current: number; prior: number; prefix?: string; suffix?: string; precision?: number }) {
  if (!prior) return null;
  const pctChange = ((current - prior) / prior) * 100;
  const up = pctChange >= 0;
  const color = up ? SUCCESS : ERROR;
  const Icon = up ? ArrowUpOutlined : ArrowDownOutlined;
  return (
    <Text style={{ fontSize: 11, color, marginLeft: 4 }}>
      <Icon style={{ fontSize: 9 }} /> {safePercent(Math.abs(pctChange), { decimals: 1 })} vs prior mo
    </Text>
  );
}

// ── KPI Cards ───────────────────────────────────────────────────────────
function KPICards({ kpis, monthlyData }: { kpis: KPIs; monthlyData: MonthlyRow[] }) {
  const curr = monthlyData.length >= 1 ? monthlyData[monthlyData.length - 1] : null;
  const prev = monthlyData.length >= 2 ? monthlyData[monthlyData.length - 2] : null;

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Gross Volume" dashboardKey="stripe">GROSS VOLUME</DefinitionTooltip>} value={kpis.grossVolume} precision={0} prefix="$" valueStyle={{ color: NAVY }} />
          <Text type="secondary" style={{ fontSize: 11 }}>FY26 thru {kpis.asOfDate}</Text>
          {curr && prev && <MonthDelta current={curr.amount} prior={prev.amount} />}
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Net After Fees" dashboardKey="stripe">NET AFTER FEES</DefinitionTooltip>} value={kpis.netAfterFees} precision={0} prefix="$" valueStyle={{ color: SUCCESS }} />
          <Text type="secondary" style={{ fontSize: 11 }}>{fmtUSD(kpis.totalFees)} in fees</Text>
          {curr && prev && <MonthDelta current={curr.amount - curr.fees} prior={prev.amount - prev.fees} />}
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Fee Rate" dashboardKey="stripe">AVG FEE RATE</DefinitionTooltip>} value={kpis.avgFeeRate} precision={2} suffix="%" valueStyle={{ color: kpis.avgFeeRate > 2.5 ? WARNING : SUCCESS }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Target: &lt;2.5%</Text>
          {curr && prev && <MonthDelta current={curr.feeRate} prior={prev.feeRate} suffix="%" precision={2} />}
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title="TOTAL CHARGES" value={kpis.totalCharges} valueStyle={{ color: NAVY }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Avg {fmtUSD(kpis.avgPerCharge)}/charge</Text>
          {curr && prev && <MonthDelta current={curr.charges} prior={prev.charges} />}
        </Card>
      </Col>
    </Row>
  );
}

// ── Insights & Actions ──────────────────────────────────────────────────
interface Insight {
  icon: React.ReactNode;
  color: string;
  text: string;
}

function generateInsights(data: StripeData): Insight[] {
  const insights: Insight[] = [];
  const { kpis, monthlyData, cardBrandData, sourceData } = data;

  // Fee optimization
  if (kpis.avgFeeRate > 2.5) {
    insights.push({
      icon: <WarningOutlined />,
      color: WARNING,
      text: `Consider negotiating Stripe rates — current average ${safePercent(kpis.avgFeeRate, { decimals: 2 })} exceeds industry benchmark of 2.2–2.4% for nonprofits`,
    });
  } else {
    insights.push({
      icon: <CheckCircleOutlined />,
      color: SUCCESS,
      text: `Average fee rate of ${safePercent(kpis.avgFeeRate, { decimals: 2 })} is within the nonprofit benchmark range — good`,
    });
  }

  // Volume anomaly — compare most recent month to average
  if (monthlyData.length >= 2) {
    const recent = monthlyData[monthlyData.length - 1];
    const avgCharges = monthlyData.reduce((s, d) => s + d.charges, 0) / monthlyData.length;
    const pctDiff = ((recent.charges - avgCharges) / avgCharges) * 100;
    if (Math.abs(pctDiff) > 20) {
      const direction = pctDiff > 0 ? 'above' : 'below';
      insights.push({
        icon: <WarningOutlined />,
        color: WARNING,
        text: `${recent.month} volume is ${safePercent(Math.abs(pctDiff), { decimals: 0 })} ${direction} average (${safeCount(recent.charges)} vs avg ${safeCount(Math.round(avgCharges))}) — investigate`,
      });
    }
  }

  // Large transaction alert
  const avgPerCharge = kpis.avgPerCharge;
  // We check via monthly data — if any month's avg charge > $10K, flag it
  const largeMonths = monthlyData.filter(d => d.amount / d.charges > 10000);
  if (largeMonths.length > 0 || avgPerCharge > 10000) {
    // Use a simpler heuristic: check if any month has total/charges implying >$10K transactions
    insights.push({
      icon: <InfoCircleOutlined />,
      color: NAVY,
      text: `Some months show average charge amounts suggesting large transactions (>$10K) — verify these processed correctly`,
    });
  }

  // Card brand concentration
  const totalChargesByBrand = cardBrandData.reduce((s, d) => s + d.charges, 0);
  for (const brand of cardBrandData) {
    const pct = (brand.charges / totalChargesByBrand) * 100;
    if (pct > 80) {
      insights.push({
        icon: <InfoCircleOutlined />,
        color: NAVY,
        text: `${safePercent(pct, { decimals: 0 })} of charges on ${brand.brand} — consider if payment method diversity is a risk`,
      });
    }
  }

  // Source concentration
  for (const src of sourceData) {
    if (src.pct > 95) {
      insights.push({
        icon: <InfoCircleOutlined />,
        color: NAVY,
        text: `${src.pct}% of charges route through ${src.source} — all payment processing depends on this integration`,
      });
    }
  }

  // Fee rate spikes in individual months
  const highFeeMonths = monthlyData.filter(d => d.feeRate > 2.8);
  if (highFeeMonths.length > 0) {
    insights.push({
      icon: <WarningOutlined />,
      color: WARNING,
      text: `${highFeeMonths.length} month(s) with fee rates above 2.8% (${highFeeMonths.map(m => `${m.month}: ${safePercent(m.feeRate, { decimals: 2 })}`).join(', ')}) — typically caused by small-dollar charges where fixed $0.30 fee dominates`,
    });
  }

  return insights;
}

function InsightsCard({ data }: { data: StripeData }) {
  const insights = generateInsights(data);

  return (
    <Card
      title="Insights & Action Items"
      size="small"
      style={{ borderLeft: `3px solid ${GOLD}` }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {insights.map((insight, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: insight.color, fontSize: 16, marginTop: 2, flexShrink: 0 }}>{insight.icon}</span>
            <Text style={{ fontSize: 13 }}>{insight.text}</Text>
          </div>
        ))}
      </Space>
    </Card>
  );
}

// ── Recommendations ─────────────────────────────────────────────────────
const RECOMMENDATIONS = [
  'Review failed charges weekly and contact donors with expired cards',
  'Request nonprofit pricing from Stripe (2.2% + $0.30 typical)',
  'Consider ACH/bank transfer for large gifts (0.8% fee vs 2.5%)',
];

function RecommendationsCard() {
  return (
    <Card title="Best Practice Recommendations" size="small" style={{ borderLeft: `3px solid ${SUCCESS}` }}>
      <List
        size="small"
        dataSource={RECOMMENDATIONS}
        renderItem={(item) => (
          <List.Item style={{ padding: '6px 0', border: 'none' }}>
            <Space>
              <BulbOutlined style={{ color: GOLD, fontSize: 15 }} />
              <Text style={{ fontSize: 13 }}>{item}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}

// ── Monthly Revenue Chart (Plotly bar) ──────────────────────────────────
function MonthlyRevenueChart({ data }: { data: MonthlyRow[] }) {
  if (!data || data.length === 0) return (
    <Card title="Monthly Revenue" size="small">
      <div style={{ textAlign: 'center', padding: '3rem 0', color: MUTED }}>No monthly data loaded — connect Stripe API for live volume</div>
    </Card>
  );
  const peak = data.reduce((a, b) => a.amount > b.amount ? a : b);
  const total = data.reduce((s, d) => s + d.amount, 0);
  const peakPct = total > 0 ? Math.round(peak.amount / total * 100) : 0;
  const title = peak.amount > 0
    ? `${peak.month} year-end giving drove ${fmtUSD(peak.amount)} — ${peakPct}% of FY26 volume`
    : 'Monthly Revenue';

  return (
    <Card title={title} size="small">
      <Plot
        data={[{
          x: data.map(d => d.month),
          y: data.map(d => d.amount),
          type: 'bar',
          marker: { color: NAVY, opacity: 0.85 },
          hovertemplate: '%{x}: %{y:$,.0f}<extra></extra>',
        }]}
        layout={{
          height: 220,
          margin: { l: 50, r: 10, t: 5, b: 30 },
          xaxis: { tickfont: { size: 11, color: MUTED } },
          yaxis: { tickfont: { size: 10, color: MUTED }, tickprefix: '$', separatethousands: true },
          plot_bgcolor: 'transparent',
          paper_bgcolor: 'transparent',
          showlegend: false,
          bargap: 0.3,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
      <Text type="secondary" style={{ fontSize: 11 }}>Source: Stripe API · FY26 Jul–present</Text>
    </Card>
  );
}

// ── Fee Rate Chart (Plotly line + target) ───────────────────────────────
function FeeRateChart({ data }: { data: MonthlyRow[] }) {
  if (!data || data.length === 0) return (
    <Card title="Fee Rate Trend" size="small">
      <div style={{ textAlign: 'center', padding: '3rem 0', color: MUTED }}>No fee data loaded — connect Stripe API for rate analysis</div>
    </Card>
  );
  const peak = data.reduce((a, b) => a.feeRate > b.feeRate ? a : b);
  const title = peak.feeRate > 0
    ? `${peak.month} fee rate spiked to ${safePercent(peak.feeRate, { decimals: 2 })} — driven by small-dollar charges`
    : 'Fee Rate Trend';

  return (
    <Card title={title} size="small">
      <Plot
        data={[{
          x: data.map(d => d.month),
          y: data.map(d => d.feeRate),
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: NAVY, width: 2 },
          marker: { color: data.map(d => feeColor(d.feeRate)), size: 8, line: { color: '#fff', width: 2 } },
          hovertemplate: '%{x}: %{y:.2f}%<extra></extra>',
        }]}
        layout={{
          height: 220,
          margin: { l: 44, r: 16, t: 5, b: 30 },
          xaxis: { tickfont: { size: 11, color: MUTED } },
          yaxis: { tickfont: { size: 10, color: MUTED }, ticksuffix: '%', range: [2.0, 3.2] },
          shapes: [{
            type: 'line', xref: 'paper', x0: 0, x1: 1,
            yref: 'y', y0: 2.5, y1: 2.5,
            line: { color: WARNING, width: 1.5, dash: 'dash' },
          }],
          annotations: [{
            xref: 'paper', x: 1, yref: 'y', y: 2.5,
            text: '2.5% target', showarrow: false,
            font: { size: 9, color: WARNING },
            xanchor: 'left', xshift: 4,
          }],
          plot_bgcolor: 'transparent',
          paper_bgcolor: 'transparent',
          showlegend: false,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
      <Text type="secondary" style={{ fontSize: 11 }}>Dashed line = 2.5% target · Source: Stripe API</Text>
    </Card>
  );
}

// ── Card Brand Breakdown (horizontal bars) ──────────────────────────────
function CardBrandBreakdown({ data }: { data: CardBrandRow[] }) {
  if (!data || data.length === 0) return (
    <Card title="Card Brand Breakdown" size="small">
      <div style={{ textAlign: 'center', padding: '1rem 0', color: MUTED }}>No card data loaded</div>
    </Card>
  );
  const total = Math.max(data.reduce((a, d) => a + d.amount, 0), 1);
  const top = data[0];
  const topPct = Math.round((top.amount / total) * 100);
  const title = top.amount > 0 ? `${top.brand} dominates at ${topPct}% of volume` : 'Card Brand Breakdown';

  return (
    <Card title={title} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        {data.map((d) => {
          const pct = (d.amount / total) * 100;
          return (
            <div key={d.brand}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>{d.brand}</Text>
                <Text style={{ fontSize: 13 }}>{fmtUSD(d.amount)} <span style={{ color: MUTED }}>({d.charges})</span></Text>
              </div>
              <Progress percent={pct} strokeColor={BRAND_COLORS[d.brand] || MUTED} showInfo={true} format={() => `${safePercent(pct, { decimals: 0 })}`} size="small" />
            </div>
          );
        })}
      </Space>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Source: Stripe API · Charge count in parentheses</div>
    </Card>
  );
}

// ── Monthly Detail Table ────────────────────────────────────────────────
function MonthlyTable({ data }: { data: MonthlyRow[] }) {
  const columns = [
    { title: 'Month', dataIndex: 'month', key: 'month', width: 56, fixed: 'left' as const },
    { title: 'Charges', dataIndex: 'charges', key: 'charges', align: 'right' as const, width: 70, sorter: (a: MonthlyRow, b: MonthlyRow) => a.charges - b.charges },
    { title: 'Gross', dataIndex: 'amount', key: 'amount', align: 'right' as const, width: 100, render: (v: number) => fmtUSD(v), sorter: (a: MonthlyRow, b: MonthlyRow) => a.amount - b.amount },
    { title: 'Fees', dataIndex: 'fees', key: 'fees', align: 'right' as const, width: 80, render: (v: number) => fmtUSD(v) },
    { title: 'Rate', dataIndex: 'feeRate', key: 'feeRate', align: 'right' as const, width: 80, render: (v: number) => v > 0 ? <Tag color={feeTag(v)}>{safePercent(v, { decimals: 2 })}</Tag> : <Text type="secondary">—</Text>, sorter: (a: MonthlyRow, b: MonthlyRow) => a.feeRate - b.feeRate },
  ];

  return (
    <Card title="Monthly fee rate detail" size="small"
      extra={<CsvExport data={data} columns={[
        { title: 'Month', dataIndex: 'month' },
        { title: 'Charges', dataIndex: 'charges' },
        { title: 'Gross', dataIndex: 'amount' },
        { title: 'Fees', dataIndex: 'fees' },
        { title: 'Fee Rate', dataIndex: 'feeRate' },
      ]} filename="stripe-monthly" />}>
      <Table
        dataSource={data.map((d, i) => ({ ...d, key: i }))}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ x: 386 }}
        summary={() => {
          const t = data.reduce((a, d) => ({ charges: a.charges + d.charges, amount: a.amount + d.amount, fees: a.fees + d.fees }), { charges: 0, amount: 0, fees: 0 });
          return (
            <Table.Summary.Row style={{ fontWeight: 600 }}>
              <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">{safeCount(t.charges)}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">{fmtUSD(t.amount)}</Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">{fmtUSD(t.fees)}</Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Tag color="processing">{safePercent((t.fees / (t.amount || 1)) * 100, { decimals: 2 })}</Tag></Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />
      <div style={{ fontSize: 11, color: MUTED, marginTop: 8 }}>Source: Stripe API · Sortable columns</div>
    </Card>
  );
}

// ── Source Breakdown ────────────────────────────────────────────────────
function SourceBreakdown({ data }: { data: SourceRow[] }) {
  if (!data || data.length === 0) return (
    <Card title="Payment Source Breakdown" size="small">
      <div style={{ textAlign: 'center', padding: '1rem 0', color: MUTED }}>No source data loaded</div>
    </Card>
  );
  const top = data[0];
  const title = top.amount > 0 ? `${top.pct}% of volume routes through ${top.source}` : 'Payment Source Breakdown';
  return (
    <Card title={title} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {data.map((s) => (
          <div key={s.source}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text strong style={{ fontSize: 13 }}>{s.source}</Text>
              <Text style={{ fontSize: 13 }}>{fmtUSD(s.amount)} <span style={{ color: MUTED }}>({s.charges} charges)</span></Text>
            </div>
            <Progress percent={s.pct} strokeColor={s.source === 'GiveCloud' ? NAVY : GOLD} showInfo={false} size="small" />
          </div>
        ))}
      </Space>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Source: Stripe API</div>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function StripeDashboard() {
  const [data, setData] = useState<StripeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJson<StripeData>(`${import.meta.env.BASE_URL}data/stripe.json`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/stripe.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <Alert
        message="Unable to load Stripe data"
        description={error || 'Unknown error'}
        type="error"
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  const safeData: StripeData = {
    kpis: data.kpis ?? { grossVolume: 0, netAfterFees: 0, totalFees: 0, avgFeeRate: 0, totalCharges: 0, avgPerCharge: 0, asOfDate: '' },
    monthlyData: data.monthlyData ?? [],
    cardBrandData: data.cardBrandData ?? [],
    sourceData: data.sourceData ?? [],
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <DataFreshness asOfDate={safeData.kpis.asOfDate} onRefresh={refresh} refreshing={refreshing} />
      <KPICards kpis={safeData.kpis} monthlyData={safeData.monthlyData} />
      <InsightsCard data={safeData} />
      <MonthlyRevenueChart data={safeData.monthlyData} />
      <FeeRateChart data={safeData.monthlyData} />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><MonthlyTable data={safeData.monthlyData} /></Col>
        <Col xs={24} lg={12}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <CardBrandBreakdown data={safeData.cardBrandData} />
            <SourceBreakdown data={safeData.sourceData} />
          </Space>
        </Col>
      </Row>
      <RecommendationsCard />
    </Space>
  );
}
