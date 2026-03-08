import { Card, Col, Row, Statistic, Table, Tag, Typography, Space, Progress, Alert, Badge } from 'antd';
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
import { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';

import { DataFreshness } from '../components/DataFreshness';
const { Text, Title } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency, safeCount, safePercent } from '../utils/formatters';

// ── Brand tokens ────────────────────────────────────────────────────────

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

const fmtUSD = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });



// ── KPI Cards ───────────────────────────────────────────────────────────
function KPICards({ kpis, newDonors }: { kpis: KPIs; newDonors: number }) {
  const safeNewDonors = safeCount(newDonors || kpis.totalDonorsThisWeek);
  const safeFailedAmount = safeCurrency(kpis.failedChargesAmount, { maximumFractionDigits: 0 });
  const safeRecurringRevenue = safeCurrency(kpis.recurringRevenue, { maximumFractionDigits: 0 });
  const safeQualityScore = safeCount(kpis.dataQualityScore);
  const safeRetentionRate = safePercent(kpis.retentionRate);

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title="NEW DONORS THIS WEEK"
            value={safeNewDonors}
            valueStyle={{ color: SUCCESS }}
            prefix={<UserAddOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title={<DefinitionTooltip term="Failed Charges" dashboardKey="donor-health">FAILED CHARGES</DefinitionTooltip>}
            value={safeFailedAmount}
            valueStyle={{ color: (kpis.failedChargesCount || 0) > 0 ? ERROR : SUCCESS }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>{safeCount(kpis.failedChargesCount)} failed</Text>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title={<DefinitionTooltip term="Monthly Recurring" dashboardKey="donor-health">MONTHLY RECURRING</DefinitionTooltip>}
            value={safeRecurringRevenue}
            valueStyle={{ color: NAVY }}
            suffix={<SyncOutlined style={{ fontSize: 14 }} />}
          />
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card className="kpi-card" size="small">
          <Statistic
            title={<DefinitionTooltip term="Data Quality Score" dashboardKey="donor-health">DATA QUALITY</DefinitionTooltip>}
            value={safeQualityScore}
            suffix="/100"
            valueStyle={{ color: (kpis.dataQualityScore || 0) >= 80 ? SUCCESS : (kpis.dataQualityScore || 0) >= 60 ? WARNING : ERROR }}
            prefix={<SafetyCertificateOutlined />}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>Retention: {safeRetentionRate}</Text>
        </Card>
      </Col>
    </Row>
  );
}

// ── Action Items ────────────────────────────────────────────────────────
function ActionItems({ data }: { data: DonorHealthData }) {
  const failedRecurring = data.failedRecurring ?? [];
  const refundsOver100 = data.refundsOver100 ?? [];
  const dataQuality = data.dataQuality ?? { missingCampaign: 0, missingAmountOpps: 0, overdueOpps: 0, largGiftsNoCampaign: 0, duplicateRecords: 0, majorDonorsMissingInfo: 0, zeroRecognitionWithGifts: 0 };

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
    <Card title={`${data.length} refunds over $100 — ${fmtUSD(data.reduce((sum, r) => sum + r.amount, 0))} total`} size="small">
      <Table dataSource={data.map((d, i) => ({ ...d, key: i }))} columns={columns} pagination={false} size="small" scroll={{ x: 400 }} />
    </Card>
  );
}

// ── New Donors by Source (Bar Chart) ────────────────────────────────────
function NewDonorsBySource({ data }: { data: DonorSource[] }) {
  const totalDonors = data.reduce((sum, d) => sum + (isNaN(d.count) ? 0 : d.count), 0);
  const totalAmount = data.reduce((sum, d) => sum + (isNaN(d.totalAmount) ? 0 : d.totalAmount), 0);
  const topSource = data.length > 0 ? data.reduce((max, d) => (d.count || 0) > (max.count || 0) ? d : max, { source: 'None', count: 0 }) : { source: 'None', count: 0 };
  
  // Check if all data is empty/NaN
  const hasValidData = data.length > 0 && totalDonors > 0 && totalAmount > 0;
  
  const cardTitle = hasValidData 
    ? `${safeCount(totalDonors)} new donors, ${safeCurrency(totalAmount, { maximumFractionDigits: 0 })} — ${topSource.source} leads with ${safeCount(topSource.count)}`
    : "New Donor Acquisition";
  
  if (!hasValidData) {
    return (
      <Card title={cardTitle} size="small">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: MUTED }}>
          <Text type="secondary">No lifecycle data loaded</Text>
        </div>
      </Card>
    );
  }

  const plotData = [{
    type: 'bar' as const,
    x: data.map(d => d.source || 'Unknown'),
    y: data.map(d => isNaN(d.totalAmount) ? 0 : d.totalAmount),
    marker: {
      color: GOLD,
      opacity: 0.85,
    },
    text: data.map(d => `${safeCount(isNaN(d.count) ? 0 : d.count)} donors`),
    textposition: 'outside' as const,
    hovertemplate: '<b>%{x}</b><br>' +
                   'Amount: $%{y:,.0f}<br>' +
                   'Donors: %{text}<br>' +
                   '<extra></extra>',
  }];

  const layout = {
    margin: { l: 60, r: 10, t: 10, b: 80 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    xaxis: {
      showgrid: false,
      showline: false,
      tickangle: -30,
      tickfont: { size: 10, color: MUTED },
    },
    yaxis: {
      showgrid: true,
      gridcolor: '#E8E8ED',
      showline: false,
      tickfont: { size: 10, color: MUTED },
      tickformat: '$,.0s',
    },
    height: 200,
  };
  
  return (
    <Card title={cardTitle} size="small">
      <Plot
        data={plotData}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
      />
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
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E8E8ED' }}>
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
  const totalFy26 = data.reduce((sum, d) => sum + (d.fy26Amount || 0), 0);
  const hasValidData = data.length > 0 && totalFy26 > 0;
  
  if (!hasValidData) {
    return (
      <Card title="Reactivated Donors" size="small">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: MUTED }}>
          <Text type="secondary">No reactivation data this period</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`${safeCount(data.length)} lapsed donors reactivated — ${safeCurrency(totalFy26, { maximumFractionDigits: 0 })} recovered in FY26`} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {data.slice(0, 10).map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #E8E8ED' }}>
            <Text strong style={{ fontSize: 13 }}>{d.name || 'Unknown Donor'}</Text>
            <Space size={4}>
              <Tag color="default">FY25: {safeCurrency(d.fy25Amount, { maximumFractionDigits: 0 })}</Tag>
              <Tag color="success">FY26: {safeCurrency(d.fy26Amount, { maximumFractionDigits: 0 })}</Tag>
            </Space>
          </div>
        ))}
      </Space>
    </Card>
  );
}

// ── Milestone Approaching ───────────────────────────────────────────────
function MilestoneCard({ data }: { data: MilestoneItem[] }) {
  const hasValidData = data.length > 0 && data.some(d => (d.currentTotal || 0) > 0 && (d.nextMilestone || 0) > 0);
  
  if (!hasValidData) {
    return (
      <Card title="Milestone Progress" size="small">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: MUTED }}>
          <Text type="secondary">No milestone data loaded</Text>
        </div>
      </Card>
    );
  }

  const avgProgress = data.reduce((sum, d) => {
    const current = d.currentTotal || 0;
    const next = d.nextMilestone || 1; // Avoid division by zero
    return sum + (current / next);
  }, 0) / data.length * 100;

  const safeAvgProgress = isNaN(avgProgress) ? 0 : Math.round(avgProgress);

  return (
    <Card title={`${safeCount(data.length)} donors approaching milestones — ${safePercent(safeAvgProgress)} average progress`} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {data.slice(0, 10).map((d, i) => {
          const current = d.currentTotal || 0;
          const next = d.nextMilestone || 1;
          const pct = Math.round((current / next) * 100);
          const safePct = isNaN(pct) ? 0 : Math.min(pct, 100);
          
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text strong style={{ fontSize: 13 }}>{d.name || 'Unknown Donor'}</Text>
                <Text style={{ fontSize: 12 }}>
                  {safeCurrency(current, { maximumFractionDigits: 0 })} → {safeCurrency(next, { maximumFractionDigits: 0 })}
                </Text>
              </div>
              <Progress percent={safePct} strokeColor={GOLD} size="small" />
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

// ── Recurring Health ────────────────────────────────────────────────────
function RecurringHealth({ newRecurring, cancelled }: { newRecurring: RecurringItem[]; cancelled: RecurringItem[] }) {
  const hasNewData = newRecurring.length > 0 && newRecurring.some(d => (d.amount || 0) > 0);
  const hasCancelledData = cancelled.length > 0 && cancelled.some(d => (d.amount || 0) > 0);
  
  if (!hasNewData && !hasCancelledData) {
    return (
      <Card title={<><SyncOutlined style={{ marginRight: 8 }} />Recurring Health</>} size="small">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: MUTED }}>
          <Text type="secondary">No recurring data loaded</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card title={<><SyncOutlined style={{ marginRight: 8 }} />Recurring Health</>} size="small">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Title level={5} style={{ color: SUCCESS, fontSize: 14 }}>
            <Badge color={SUCCESS} /> New Recurring ({safeCount(newRecurring.length)})
          </Title>
          {!hasNewData ? <Text type="secondary">None this week</Text> : (
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              {newRecurring.slice(0, 8).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text>{d.name || 'Unknown Donor'}</Text>
                  <Text strong>{safeCurrency(d.amount, { maximumFractionDigits: 0 })}/{d.frequency || 'mo'}</Text>
                </div>
              ))}
            </Space>
          )}
        </Col>
        <Col xs={24} md={12}>
          <Title level={5} style={{ color: ERROR, fontSize: 14 }}>
            <Badge color={ERROR} /> Cancelled ({safeCount(cancelled.length)})
          </Title>
          {!hasCancelledData ? <Text type="secondary">None this week</Text> : (
            <Space direction="vertical" style={{ width: '100%' }} size={4}>
              {cancelled.slice(0, 8).map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text>{d.name || 'Unknown Donor'}</Text>
                  <Text type="danger">{safeCurrency(d.amount, { maximumFractionDigits: 0 })}</Text>
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
    { label: 'Missing Campaign', count: dq.missingCampaign || 0, icon: <WarningOutlined /> },
    { label: 'Missing Amount', count: dq.missingAmountOpps || 0, icon: <WarningOutlined /> },
    { label: 'Overdue Opps', count: dq.overdueOpps || 0, icon: <ExclamationCircleOutlined /> },
    { label: 'Large Gifts No Campaign', count: dq.largGiftsNoCampaign || 0, icon: <DollarOutlined /> },
    { label: 'Duplicate Records', count: dq.duplicateRecords || 0, icon: <WarningOutlined /> },
    { label: 'Major Donors Missing Info', count: dq.majorDonorsMissingInfo || 0, icon: <WarningOutlined /> },
    { label: '$0 Recognition w/ Gifts', count: dq.zeroRecognitionWithGifts || 0, icon: <ExclamationCircleOutlined /> },
  ];

  const safeScore = score || 0;
  const scoreColor = safeScore >= 70 ? SUCCESS : safeScore >= 40 ? GOLD : ERROR;

  return (
    <Card title={<><SafetyCertificateOutlined style={{ marginRight: 8 }} />Data Quality</>} size="small">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Statistic 
              title="Data Quality Score" 
              value={safeScore} 
              suffix="/100" 
              valueStyle={{ color: scoreColor, fontSize: 28, fontWeight: 700 }} 
            />
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
                <Tag color={item.count === 0 ? 'success' : item.count > 10 ? 'error' : 'warning'}>{safeCount(item.count)}</Tag>
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
    fetchJson<DonorHealthData>(`${import.meta.env.BASE_URL}data/sharon-donor-health.json`)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
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

  const kpis = data.kpis ?? { totalDonorsThisWeek: 0, recurringRevenue: 0, failedChargesCount: 0, failedChargesAmount: 0, dataQualityScore: 0, retentionRate: 0 };
  const failedRecurring = data.failedRecurring ?? [];
  const refundsOver100 = data.refundsOver100 ?? [];
  const newDonorsBySource = data.newDonorsBySource ?? [];
  const firstToSecondConversions = data.firstToSecondConversions ?? [];
  const lapsedReactivated = data.lapsedReactivated ?? [];
  const milestoneApproaching = data.milestoneApproaching ?? [];
  const newRecurring = data.newRecurring ?? [];
  const cancelledRecurring = data.cancelledRecurring ?? [];
  const dataQuality = data.dataQuality ?? { missingCampaign: 0, missingAmountOpps: 0, overdueOpps: 0, largGiftsNoCampaign: 0, duplicateRecords: 0, majorDonorsMissingInfo: 0, zeroRecognitionWithGifts: 0 };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />

      {/* KPI Row */}
      <KPICards kpis={kpis} newDonors={data.newDonorsThisWeek} />

      {/* Action Items */}
      <ActionItems data={data} />

      {/* Failed & Refunds */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><FailedRecurringTable data={failedRecurring} /></Col>
        <Col xs={24} lg={12}><RefundsTable data={refundsOver100} /></Col>
      </Row>

      {/* Donor Lifecycle */}
      <Title level={5} style={{ color: NAVY, margin: '8px 0 0' }}>Donor Lifecycle</Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><NewDonorsBySource data={newDonorsBySource} /></Col>
        <Col xs={24} lg={12}><ConversionsCard data={firstToSecondConversions} /></Col>
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><LapsedCard data={lapsedReactivated} /></Col>
        <Col xs={24} lg={12}><MilestoneCard data={milestoneApproaching} /></Col>
      </Row>

      {/* Recurring Health */}
      <RecurringHealth newRecurring={newRecurring} cancelled={cancelledRecurring} />

      {/* Data Quality */}
      <DataQualitySection dq={dataQuality} score={kpis.dataQualityScore} />
    </Space>
  );
}
