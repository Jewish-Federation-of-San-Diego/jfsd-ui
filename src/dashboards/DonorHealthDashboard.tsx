import { Card, Col, Row, Statistic, Table, Tag, Typography, Space, Progress, Alert, Badge, Tooltip as AntTooltip } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  UserAddOutlined,
  DollarOutlined,
  SyncOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useEffect, useRef, useState, useCallback } from 'react';

import { DataFreshness } from '../components/DataFreshness';
const { Text, Title } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

// ── Brand tokens ────────────────────────────────────────────────────────
const GRID = '#E8E8ED';

// ── Types ───────────────────────────────────────────────────────────────
interface FailedRecurring { name: string; amount: number; reason: string; date: string; }
interface Refund { name: string; amount: number; date: string; reason: string; }
interface DonorSource { source: string; count: number; totalAmount: number; }
interface Conversion { name: string; firstGift: string; secondGift: string; amount: number; }
interface RecurringItem { name: string; amount: number; frequency?: string; date: string; }
interface LapsedItem { name: string; fy25Amount: number; fy26Amount: number; }
interface MilestoneItem { name: string; currentTotal: number; nextMilestone: number; yearsConsecutive: number; }
interface DataQuality {
  missingCampaign: number; missingAmountOpps: number; overdueOpps: number;
  largGiftsNoCampaign: number; duplicateRecords: number;
  majorDonorsMissingInfo: number; zeroRecognitionWithGifts: number;
}
interface KPIs {
  totalDonorsThisWeek: number; recurringRevenue: number;
  failedChargesCount: number; failedChargesAmount: number;
  dataQualityScore: number; retentionRate: number;
}
interface DonorHealthData {
  asOfDate: string;
  failedRecurring: FailedRecurring[];
  refundsOver100: Refund[];
  newDonorsBySource: DonorSource[];
  newDonorsThisWeek: number;
  firstToSecondConversions: Conversion[];
  newRecurring: RecurringItem[];
  cancelledRecurring: RecurringItem[];
  lapsedReactivated: LapsedItem[];
  milestoneApproaching: MilestoneItem[];
  dataQuality: DataQuality;
  kpis: KPIs;
}

const fmtUSD = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Hook: measure width ─────────────────────────────────────────────────
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
function KPICards({ kpis, newDonors }: { kpis: KPIs; newDonors: number }) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title="NEW DONORS THIS WEEK"
            value={newDonors || kpis.totalDonorsThisWeek}
            valueStyle={{ color: SUCCESS }}
            prefix={<UserAddOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title={<DefinitionTooltip term="Failed Charges" dashboardKey="donor-health">FAILED CHARGES</DefinitionTooltip>}
            value={kpis.failedChargesAmount}
            precision={0}
            prefix="$"
            valueStyle={{ color: kpis.failedChargesCount > 0 ? ERROR : SUCCESS }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>{kpis.failedChargesCount} failed</Text>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title={<DefinitionTooltip term="Monthly Recurring" dashboardKey="donor-health">MONTHLY RECURRING</DefinitionTooltip>}
            value={kpis.recurringRevenue}
            precision={0}
            prefix="$"
            valueStyle={{ color: NAVY }}
            suffix={<SyncOutlined style={{ fontSize: 14 }} />}
          />
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title={<DefinitionTooltip term="Data Quality Score" dashboardKey="donor-health">DATA QUALITY</DefinitionTooltip>}
            value={kpis.dataQualityScore}
            suffix="/100"
            valueStyle={{ color: kpis.dataQualityScore >= 80 ? SUCCESS : kpis.dataQualityScore >= 60 ? WARNING : ERROR }}
            prefix={<SafetyCertificateOutlined />}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>Retention: {kpis.retentionRate}%</Text>
        </Card>
      </Col>
    </Row>
  );
}

// ── Action Items ────────────────────────────────────────────────────────
function ActionItems({ data }: { data: DonorHealthData }) {
  const { failedRecurring, refundsOver100, dataQuality } = data;

  const items: { label: string; count: number; severity: 'error' | 'warning' | 'success'; detail: string }[] = [];

  if (failedRecurring.length > 0)
    items.push({ label: 'Failed Recurring', count: failedRecurring.length, severity: 'error', detail: fmtUSD(failedRecurring.reduce((s, f) => s + f.amount, 0)) + ' at risk' });
  if (refundsOver100.length > 0)
    items.push({ label: 'Refunds >$100', count: refundsOver100.length, severity: 'warning', detail: fmtUSD(refundsOver100.reduce((s, r) => s + r.amount, 0)) + ' refunded' });
  if (dataQuality.overdueOpps > 0)
    items.push({ label: 'Overdue Opps', count: dataQuality.overdueOpps, severity: 'warning', detail: 'Past expected close' });

  if (items.length === 0)
    items.push({ label: 'All Clear', count: 0, severity: 'success', detail: 'No urgent items' });

  return (
    <Card title={<><ExclamationCircleOutlined style={{ marginRight: 8 }} />Action Items</>} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#FAFAFA', borderRadius: 6 }}>
            <Space>
              <Tag color={item.severity}>{item.count}</Tag>
              <Text strong>{item.label}</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>{item.detail}</Text>
          </div>
        ))}
      </Space>
    </Card>
  );
}

// ── Failed Recurring Table ──────────────────────────────────────────────
function FailedRecurringTable({ data }: { data: FailedRecurring[] }) {
  if (data.length === 0) return null;
  const columns = [
    { title: 'Donor', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 90, render: (v: number) => fmtUSD(v) },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true, render: (v: string) => <Tag color="error">{v}</Tag> },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 100 },
  ];
  return (
    <Card title={<><WarningOutlined style={{ color: ERROR, marginRight: 8 }} />Failed Recurring Charges</>} size="small"
      extra={<CsvExport data={data} columns={[
        { title: 'Donor', dataIndex: 'name' },
        { title: 'Amount', dataIndex: 'amount' },
        { title: 'Reason', dataIndex: 'reason' },
        { title: 'Date', dataIndex: 'date' },
      ]} filename="failed-recurring" />}>
      <Table dataSource={data.map((d, i) => ({ ...d, key: i }))} columns={columns} pagination={false} size="small" scroll={{ x: 400 }} />
    </Card>
  );
}

// ── Refunds Table ───────────────────────────────────────────────────────
function RefundsTable({ data }: { data: Refund[] }) {
  if (data.length === 0) return null;
  const columns = [
    { title: 'Donor', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 90, render: (v: number) => <span style={{ color: ERROR }}>{fmtUSD(v)}</span> },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 120 },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 100 },
  ];
  return (
    <Card title="Refunds Over $100" size="small">
      <Table dataSource={data.map((d, i) => ({ ...d, key: i }))} columns={columns} pagination={false} size="small" scroll={{ x: 400 }} />
    </Card>
  );
}

// ── New Donors by Source (Bar Chart) ────────────────────────────────────
function SourceBarChart({ data, width: w }: { data: DonorSource[]; width: number }) {
  if (data.length === 0) return <Text type="secondary">No new donors this week</Text>;
  const H = 200;
  const PAD = { top: 10, right: 10, bottom: 50, left: 60 };
  const cw = w - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.totalAmount));
  const barW = Math.min(Math.max((cw / data.length) * 0.6, 20), 60);
  const gap = cw / data.length;

  return (
    <svg width={w} height={H} style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const val = maxVal * f;
        const y = PAD.top + ch - f * ch;
        return (
          <g key={f}>
            <line x1={PAD.left} y1={y} x2={w - PAD.right} y2={y} stroke={GRID} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill={MUTED}>${Math.round(val / 1000)}K</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = maxVal > 0 ? (d.totalAmount / maxVal) * ch : 0;
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const y = PAD.top + ch - barH;
        const label = d.source.length > 12 ? d.source.substring(0, 12) + '…' : d.source;
        return (
          <g key={d.source}>
            <AntTooltip title={`${d.source}: ${fmtUSD(d.totalAmount)} (${d.count} donors)`}>
              <rect x={x} y={y} width={barW} height={barH} fill={GOLD} rx={3} style={{ cursor: 'pointer' }} />
            </AntTooltip>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={MUTED}
              transform={`rotate(-30, ${x + barW / 2}, ${H - 8})`}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function NewDonorsBySource({ data }: { data: DonorSource[] }) {
  const { ref, width } = useWidth();
  return (
    <Card title="New Donors by Source" size="small">
      <div ref={ref} style={{ width: '100%', minHeight: 200 }}>
        {width > 0 && <SourceBarChart data={data} width={width} />}
      </div>
    </Card>
  );
}

// ── Conversions Table ───────────────────────────────────────────────────
function ConversionsCard({ data }: { data: Conversion[] }) {
  if (data.length === 0) return (
    <Card title={<><CheckCircleOutlined style={{ color: SUCCESS, marginRight: 8 }} />First → Second Conversions</>} size="small">
      <Text type="secondary">No conversions this week</Text>
    </Card>
  );
  return (
    <Card title={<><CheckCircleOutlined style={{ color: SUCCESS, marginRight: 8 }} />First → Second Conversions ({data.length})</>} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {data.slice(0, 10).map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${GRID}` }}>
            <Text strong style={{ fontSize: 13 }}>{d.name}</Text>
            <Text style={{ fontSize: 13 }}>{fmtUSD(d.amount)}</Text>
          </div>
        ))}
        {data.length > 10 && <Text type="secondary" style={{ fontSize: 11 }}>+{data.length - 10} more</Text>}
      </Space>
    </Card>
  );
}

// ── Lapsed Reactivated ──────────────────────────────────────────────────
function LapsedCard({ data }: { data: LapsedItem[] }) {
  if (data.length === 0) return null;
  return (
    <Card title="Lapsed Donors Reactivated" size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {data.slice(0, 10).map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${GRID}` }}>
            <Text strong style={{ fontSize: 13 }}>{d.name}</Text>
            <Space size={4}>
              <Tag color="default">FY25: {fmtUSD(d.fy25Amount)}</Tag>
              <Tag color="success">FY26: {fmtUSD(d.fy26Amount)}</Tag>
            </Space>
          </div>
        ))}
      </Space>
    </Card>
  );
}

// ── Milestone Approaching ───────────────────────────────────────────────
function MilestoneCard({ data }: { data: MilestoneItem[] }) {
  if (data.length === 0) return null;
  return (
    <Card title="Approaching Milestones" size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {data.slice(0, 10).map((d, i) => {
          const pct = Math.round((d.currentTotal / d.nextMilestone) * 100);
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>{d.name}</Text>
                <Text style={{ fontSize: 12 }}>{fmtUSD(d.currentTotal)} → {fmtUSD(d.nextMilestone)}</Text>
              </div>
              <Progress percent={pct} strokeColor={GOLD} size="small" />
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

// ── Recurring Health ────────────────────────────────────────────────────
function RecurringHealth({ newRecurring, cancelled }: { newRecurring: RecurringItem[]; cancelled: RecurringItem[] }) {
  return (
    <Card title={<><SyncOutlined style={{ marginRight: 8 }} />Recurring Health</>} size="small">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Title level={5} style={{ color: SUCCESS, fontSize: 14 }}>
            <Badge color={SUCCESS} /> New Recurring ({newRecurring.length})
          </Title>
          {newRecurring.length === 0 ? <Text type="secondary">None this week</Text> : (
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              {newRecurring.slice(0, 8).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text>{d.name}</Text>
                  <Text strong>{fmtUSD(d.amount)}/{d.frequency || 'mo'}</Text>
                </div>
              ))}
            </Space>
          )}
        </Col>
        <Col xs={24} md={12}>
          <Title level={5} style={{ color: ERROR, fontSize: 14 }}>
            <Badge color={ERROR} /> Cancelled ({cancelled.length})
          </Title>
          {cancelled.length === 0 ? <Text type="secondary">None this week</Text> : (
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              {cancelled.slice(0, 8).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text>{d.name}</Text>
                  <Text type="danger">{fmtUSD(d.amount)}</Text>
                </div>
              ))}
            </Space>
          )}
        </Col>
      </Row>
    </Card>
  );
}

// ── Data Quality Section ────────────────────────────────────────────────
function DataQualitySection({ dq, score }: { dq: DataQuality; score: number }) {
  const issues = [
    { label: 'Missing Campaign', count: dq.missingCampaign, icon: <WarningOutlined /> },
    { label: 'Missing Amount', count: dq.missingAmountOpps, icon: <WarningOutlined /> },
    { label: 'Overdue Opps', count: dq.overdueOpps, icon: <ExclamationCircleOutlined /> },
    { label: 'Large Gifts No Campaign', count: dq.largGiftsNoCampaign, icon: <DollarOutlined /> },
    { label: 'Duplicate Records', count: dq.duplicateRecords, icon: <WarningOutlined /> },
    { label: 'Major Donors Missing Info', count: dq.majorDonorsMissingInfo, icon: <WarningOutlined /> },
    { label: '$0 Recognition w/ Gifts', count: dq.zeroRecognitionWithGifts, icon: <ExclamationCircleOutlined /> },
  ];

  const scoreColor = score >= 80 ? SUCCESS : score >= 60 ? WARNING : ERROR;

  return (
    <Card title={<><SafetyCertificateOutlined style={{ marginRight: 8 }} />Data Quality</>} size="small">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Progress
              type="dashboard"
              percent={score}
              strokeColor={scoreColor}
              format={(pct) => <span style={{ color: scoreColor, fontSize: 24, fontWeight: 700 }}>{pct}</span>}
              size={140}
            />
            <div style={{ marginTop: 8 }}>
              <Text strong>Quality Score</Text>
            </div>
          </div>
        </Col>
        <Col xs={24} md={16}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {issues.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: item.count > 0 ? '#FFF7F0' : '#F6FFF5', borderRadius: 6 }}>
                <Space>
                  <span style={{ color: item.count > 0 ? WARNING : SUCCESS }}>{item.icon}</span>
                  <Text style={{ fontSize: 13 }}>{item.label}</Text>
                </Space>
                <Tag color={item.count === 0 ? 'success' : item.count > 10 ? 'error' : 'warning'}>{item.count}</Tag>
              </div>
            ))}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function DonorHealthDashboard() {
  const [data, setData] = useState<DonorHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sharon-donor-health.json`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
        return res.json();
      })
      .then((json: DonorHealthData) => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/sharon-donor-health.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <Alert
        message="Unable to load donor health data"
        description={error || 'Unknown error'}
        type="error"
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate} onRefresh={refresh} refreshing={refreshing} />

      {/* KPI Row */}
      <KPICards kpis={data.kpis} newDonors={data.newDonorsThisWeek} />

      {/* Action Items */}
      <ActionItems data={data} />

      {/* Failed & Refunds */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><FailedRecurringTable data={data.failedRecurring} /></Col>
        <Col xs={24} lg={12}><RefundsTable data={data.refundsOver100} /></Col>
      </Row>

      {/* Donor Lifecycle */}
      <Title level={5} style={{ color: NAVY, margin: '8px 0 0' }}>Donor Lifecycle</Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><NewDonorsBySource data={data.newDonorsBySource} /></Col>
        <Col xs={24} lg={12}><ConversionsCard data={data.firstToSecondConversions} /></Col>
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><LapsedCard data={data.lapsedReactivated} /></Col>
        <Col xs={24} lg={12}><MilestoneCard data={data.milestoneApproaching} /></Col>
      </Row>

      {/* Recurring Health */}
      <RecurringHealth newRecurring={data.newRecurring} cancelled={data.cancelledRecurring} />

      {/* Data Quality */}
      <DataQualitySection dq={data.dataQuality} score={data.kpis.dataQualityScore} />
    </Space>
  );
}
