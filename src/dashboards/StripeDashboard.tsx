import { Card, Col, Row, Statistic, Table, Tag, Typography, Space, Progress, Tooltip as AntTooltip, Spin, Alert } from 'antd';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useRef, useState, useCallback } from 'react';

import { DefinitionTooltip } from '../components/DefinitionTooltip';

const { Text } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const GOLD = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';
const GRID = '#E8E8ED';
const MUTED = '#8C8C8C';

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

const fmtUSD = (v: number) => `$${v.toLocaleString()}`;
const fmtK = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

const feeColor = (v: number) => v > 2.6 ? ERROR : v > 2.5 ? WARNING : SUCCESS;
const feeTag = (v: number): 'error' | 'warning' | 'success' => v > 2.6 ? 'error' : v > 2.5 ? 'warning' : 'success';

// ── Hook: measure width reliably on mobile Safari ───────────────────────
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    if (ref.current) {
      const w = ref.current.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.floor(w));
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return { ref, width };
}

// ── KPI Cards ───────────────────────────────────────────────────────────
function KPICards({ kpis }: { kpis: KPIs }) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Gross Volume" dashboardKey="stripe">GROSS VOLUME</DefinitionTooltip>} value={kpis.grossVolume} precision={0} prefix="$" valueStyle={{ color: NAVY }} />
          <Text type="secondary" style={{ fontSize: 11 }}>FY26 thru {kpis.asOfDate}</Text>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Net After Fees" dashboardKey="stripe">NET AFTER FEES</DefinitionTooltip>} value={kpis.netAfterFees} precision={0} prefix="$" valueStyle={{ color: SUCCESS }} />
          <Text type="secondary" style={{ fontSize: 11 }}>${kpis.totalFees.toLocaleString()} in fees</Text>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Fee Rate" dashboardKey="stripe">AVG FEE RATE</DefinitionTooltip>} value={kpis.avgFeeRate} precision={2} suffix="%" valueStyle={{ color: kpis.avgFeeRate > 2.5 ? WARNING : SUCCESS }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Target: &lt;2.5%</Text>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic title="TOTAL CHARGES" value={kpis.totalCharges} valueStyle={{ color: NAVY }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Avg ${kpis.avgPerCharge.toLocaleString()}/charge</Text>
        </Card>
      </Col>
    </Row>
  );
}

// ── SVG Bar Chart ───────────────────────────────────────────────────────
function BarChart({ data, width: w }: { data: MonthlyRow[]; width: number }) {
  const H = 220;
  const PAD = { top: 10, right: 10, bottom: 30, left: 50 };
  const cw = w - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.amount));
  const barW = Math.max((cw / data.length) * 0.6, 8);
  const gap = cw / data.length;

  // Dynamic y-axis ticks
  const step = Math.ceil(maxVal / 4 / 10000) * 10000;
  const yTicks = Array.from({ length: 5 }, (_, i) => i * step);

  return (
    <svg width={w} height={H} style={{ display: 'block' }}>
      {yTicks.map(t => {
        const y = PAD.top + ch - (t / maxVal) * ch;
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={w - PAD.right} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={MUTED}>{fmtK(t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.amount / maxVal) * ch;
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const y = PAD.top + ch - barH;
        return (
          <g key={d.month}>
            <AntTooltip title={`${d.month}: ${fmtUSD(d.amount)} (${d.charges} charges)`}>
              <rect x={x} y={y} width={barW} height={barH} fill={NAVY} rx={3} style={{ cursor: 'pointer' }} />
            </AntTooltip>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthlyRevenueChart({ data }: { data: MonthlyRow[] }) {
  const { ref, width } = useWidth();
  // Find the peak month for the title
  const peak = data.reduce((a, b) => a.amount > b.amount ? a : b, data[0]);
  const peakPct = Math.round(peak.amount / data.reduce((s, d) => s + d.amount, 0) * 100);

  return (
    <Card title={`${peak.month} year-end giving drove $${Math.round(peak.amount / 1000)}K — ${peakPct}% of FY26 volume`} size="small">
      <div ref={ref} style={{ width: '100%', minHeight: 220 }}>
        {width > 0 && <BarChart data={data} width={width} />}
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>Source: Stripe API · FY26 Jul–present</Text>
    </Card>
  );
}

// ── SVG Line Chart ──────────────────────────────────────────────────────
function LineChart({ data, width: w }: { data: MonthlyRow[]; width: number }) {
  const H = 220;
  const PAD = { top: 10, right: 16, bottom: 30, left: 44 };
  const cw = w - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const minY = 2.0, maxY = 3.2;
  const range = maxY - minY;

  const yTicks = [2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2];

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * cw;
  const toY = (v: number) => PAD.top + ch - ((v - minY) / range) * ch;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.feeRate), ...d }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const targetY = toY(2.5);

  return (
    <svg width={w} height={H} style={{ display: 'block' }}>
      {yTicks.map(t => {
        const y = toY(t);
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={w - PAD.right} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={MUTED}>{t.toFixed(1)}%</text>
          </g>
        );
      })}
      <line x1={PAD.left} y1={targetY} x2={w - PAD.right} y2={targetY} stroke={WARNING} strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={w - PAD.right + 2} y={targetY + 4} fontSize={9} fill={WARNING}>2.5%</text>
      <path d={linePath} fill="none" stroke={NAVY} strokeWidth={2} />
      {points.map((p) => (
        <g key={p.month}>
          <AntTooltip title={`${p.month}: ${p.feeRate.toFixed(2)}% (${p.charges} charges, ${fmtUSD(p.amount)})`}>
            <circle cx={p.x} cy={p.y} r={5} fill={feeColor(p.feeRate)} stroke="#fff" strokeWidth={2} style={{ cursor: 'pointer' }} />
          </AntTooltip>
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>{p.month}</text>
        </g>
      ))}
    </svg>
  );
}

function FeeRateChart({ data }: { data: MonthlyRow[] }) {
  const { ref, width } = useWidth();
  // Find month with highest fee rate for title
  const peak = data.reduce((a, b) => a.feeRate > b.feeRate ? a : b, data[0]);

  return (
    <Card title={`${peak.month} fee rate spiked to ${peak.feeRate.toFixed(2)}% — driven by small-dollar charges`} size="small">
      <div ref={ref} style={{ width: '100%', minHeight: 220 }}>
        {width > 0 && <LineChart data={data} width={width} />}
      </div>
      <Text type="secondary" style={{ fontSize: 11 }}>Dashed line = 2.5% target · Source: Stripe API</Text>
    </Card>
  );
}

// ── Card Brand Breakdown (horizontal bars) ──────────────────────────────
function CardBrandBreakdown({ data }: { data: CardBrandRow[] }) {
  const total = data.reduce((a, d) => a + d.amount, 0);
  // Find top brand for title
  const top = data[0];
  const topPct = Math.round((top.amount / total) * 100);

  return (
    <Card title={`${top.brand} dominates at ${topPct}% of volume`} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        {data.map((d) => {
          const pct = (d.amount / total) * 100;
          return (
            <div key={d.brand}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>{d.brand}</Text>
                <Text style={{ fontSize: 13 }}>{fmtUSD(d.amount)} <span style={{ color: MUTED }}>({d.charges})</span></Text>
              </div>
              <Progress percent={pct} strokeColor={BRAND_COLORS[d.brand] || MUTED} showInfo={true} format={() => `${pct.toFixed(0)}%`} size="small" />
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
    { title: 'Fees', dataIndex: 'fees', key: 'fees', align: 'right' as const, width: 80, render: (v: number) => `$${v.toLocaleString()}` },
    { title: 'Rate', dataIndex: 'feeRate', key: 'feeRate', align: 'right' as const, width: 80, render: (v: number) => <Tag color={feeTag(v)}>{v.toFixed(2)}%</Tag>, sorter: (a: MonthlyRow, b: MonthlyRow) => a.feeRate - b.feeRate },
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
              <Table.Summary.Cell index={1} align="right">{t.charges}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">{fmtUSD(t.amount)}</Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">${t.fees.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right"><Tag color="processing">{(t.fees / t.amount * 100).toFixed(2)}%</Tag></Table.Summary.Cell>
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
  const top = data[0];
  return (
    <Card title={`${top.pct}% of volume routes through ${top.source}`} size="small">
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

  useEffect(() => {
    fetch('/jfsd-ui/data/stripe.json')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        return res.json();
      })
      .then((json: StripeData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="Loading Stripe data..." />
      </div>
    );
  }

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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ fontSize: 11, color: MUTED, textAlign: 'right' }}>
        Data as of: {data.kpis.asOfDate}
      </div>
      <KPICards kpis={data.kpis} />
      <MonthlyRevenueChart data={data.monthlyData} />
      <FeeRateChart data={data.monthlyData} />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><MonthlyTable data={data.monthlyData} /></Col>
        <Col xs={24} lg={12}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <CardBrandBreakdown data={data.cardBrandData} />
            <SourceBreakdown data={data.sourceData} />
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
