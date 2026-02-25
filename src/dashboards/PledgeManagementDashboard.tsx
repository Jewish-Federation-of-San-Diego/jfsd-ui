import { Card, Col, Row, Statistic, Table, Typography, Space, Progress, Alert, Tag } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import {
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';

const { Text, Title } = Typography;
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING } from '../theme/jfsdTheme';

// ── Brand tokens ────────────────────────────────────────────────────────
// ── Types ───────────────────────────────────────────────────────────────
interface AgingBucket { bucket: string; count: number; amount: number; }
interface WriteOffItem { name: string; pledgeAmount: number; paidAmount: number; balance: number; endDate: string; daysOverdue: number; campaign: string; }
interface PledgeItem { name: string; pledgedAmount: number; paidAmount: number; balance: number; startDate: string; endDate: string; campaign: string; }
interface CampaignItem { campaign: string; pledgeCount: number; pledgedAmount: number; paidAmount: number; fulfillmentRate: number; }
interface PaymentItem { name: string; amount: number; date: string; pledgeTotal: number; }
interface PledgeData {
  asOfDate: string;
  summary: { totalOpenPledges: number; totalPledgedAmount: number; totalPaidAmount: number; totalOutstanding: number; fulfillmentRate: number; avgPledgeSize: number; };
  agingBuckets: AgingBucket[];
  writeOffRisk: WriteOffItem[];
  topOpenPledges: PledgeItem[];
  byCampaign: CampaignItem[];
  recentPayments: PaymentItem[];
  kpis: { totalOutstanding: number; fulfillmentRate: number; writeOffRiskAmount: number; writeOffRiskCount: number; avgDaysToPayment: number; pledgesThisMonth: number; };
}

const fmtUSD = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtShortDate = (d: string) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return d; } };

const AGING_COLORS: Record<string, string> = {
  '0-90 days': SUCCESS,
  '91-180 days': GOLD,
  '181-365 days': WARNING,
  '365+ days': ERROR,
};

const AGING_LABELS: Record<string, string> = {
  '0-90 days': 'Current',
  '91-180 days': 'Approaching',
  '181-365 days': 'Aging',
  '365+ days': 'Overdue',
};

/** Determine pledge status based on endDate */
function getPledgeStatus(endDate: string): { label: string; color: string } {
  if (!endDate) return { label: 'Open-ended', color: 'blue' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate + 'T00:00:00');
  // "Far future" = more than 3 years out
  const farFuture = new Date(today);
  farFuture.setFullYear(farFuture.getFullYear() + 3);
  if (end > farFuture) return { label: 'Open-ended', color: 'blue' };
  if (end < today) return { label: 'Past Due', color: 'red' };
  return { label: 'Current', color: 'green' };
}

// ── Component ───────────────────────────────────────────────────────────
export function PledgeManagementDashboard() {
  const [data, setData] = useState<PledgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/pledge-management.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/pledge-management.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <Alert type="error" message="Failed to load pledge data" description={error} showIcon style={{ margin: 24 }} />;
  if (!data) return null;

  const { summary, kpis, agingBuckets, writeOffRisk, topOpenPledges, byCampaign, recentPayments } = data;
  const totalAging = agingBuckets.reduce((s, b) => s + b.amount, 0) || 1;

  // Compute past-due stats from topOpenPledges (pledges with non-empty endDate in the past)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pastDuePledges = topOpenPledges.filter(p => {
    if (!p.endDate) return false;
    const end = new Date(p.endDate + 'T00:00:00');
    return end < today && p.balance > 0;
  });
  const pastDueAmount = pastDuePledges.reduce((s, p) => s + p.balance, 0);
  const pastDueCount = pastDuePledges.length;

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      <Title level={3} style={{ color: NAVY, marginBottom: 4 }}>Pledge Management</Title>
      <Text type="secondary">{summary.totalOpenPledges} open pledges</Text>
      <DataFreshness asOfDate={data.asOfDate} onRefresh={refresh} refreshing={refreshing} />

      {/* ── Low fulfillment context alert ─────────────────────── */}
      {kpis.fulfillmentRate < 10 && (
        <Alert
          message="Low fulfillment rate includes pledges not yet due"
          description="Many open pledges are recent commitments or multi-year pledges with future payment schedules. Focus on the 365+ day aging bucket for truly overdue pledges."
          type="info"
          showIcon
          style={{ marginTop: 16, marginBottom: 16 }}
        />
      )}

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {[
          { title: 'Total Outstanding', value: fmtUSD(kpis.totalOutstanding), icon: <DollarOutlined />, color: NAVY, contextNote: undefined as string | undefined },
          { title: <DefinitionTooltip term="Fulfillment Rate" dashboardKey="pledge">Fulfillment Rate</DefinitionTooltip>, value: `${kpis.fulfillmentRate}%`, icon: <CheckCircleOutlined />, color: kpis.fulfillmentRate >= 50 ? SUCCESS : WARNING, contextNote: 'Includes new & open-ended pledges not yet due' },
          { title: 'Past Due', value: fmtUSD(pastDueAmount), icon: <ExclamationCircleOutlined />, color: ERROR, contextNote: `${pastDueCount} pledges past end date` },
          { title: <DefinitionTooltip term="Write-off Risk" dashboardKey="pledge">Write-off Risk</DefinitionTooltip>, value: fmtUSD(kpis.writeOffRiskAmount), icon: <WarningOutlined />, color: ERROR, suffix: `${kpis.writeOffRiskCount} pledges`, contextNote: undefined as string | undefined },
          { title: 'Pledges This Month', value: kpis.pledgesThisMonth, icon: <CalendarOutlined />, color: GOLD, contextNote: undefined as string | undefined },
          { title: 'Avg Pledge Size', value: fmtUSD(summary.avgPledgeSize), icon: <FileTextOutlined />, color: NAVY, contextNote: undefined as string | undefined },
        ].map((kpi, i) => (
          <Col xs={24} sm={12} md={8} lg={4} xl={4} key={i}>
            <Card size="small" style={{ borderTop: `3px solid ${kpi.color}` }}>
              <Statistic title={kpi.title} value={kpi.value} prefix={kpi.icon} valueStyle={{ color: kpi.color, fontSize: 22 }} />
              {'suffix' in kpi && kpi.suffix && <Text type="secondary" style={{ fontSize: 12 }}>{kpi.suffix}</Text>}
              {kpi.contextNote && <Text type="secondary" style={{ fontSize: 11 }}>{kpi.contextNote}</Text>}
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Aging Buckets ──────────────────────────────────────── */}
      <Card title={<DefinitionTooltip term="Aging" dashboardKey="pledge">Aging Buckets</DefinitionTooltip>} size="small" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', height: 32, borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          {agingBuckets.map(b => {
            const pct = (b.amount / totalAging) * 100;
            if (pct < 1) return null;
            return (
              <div key={b.bucket} title={`${AGING_LABELS[b.bucket] || b.bucket}: ${fmtUSD(b.amount)} (${b.count})`}
                style={{ width: `${pct}%`, background: AGING_COLORS[b.bucket] || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                {pct > 8 ? AGING_LABELS[b.bucket] || b.bucket : ''}
              </div>
            );
          })}
        </div>
        <Row gutter={16}>
          {agingBuckets.map(b => (
            <Col key={b.bucket} xs={12} sm={6}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: AGING_COLORS[b.bucket] }} />
                <Text strong style={{ fontSize: 13 }}>{AGING_LABELS[b.bucket] || b.bucket}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>({b.bucket})</Text>
              </div>
              <Text style={{ fontSize: 13 }}>{fmtUSD(b.amount)} · {b.count} pledges</Text>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* ── Write-off Risk ──────────────────────────────────── */}
        <Col xs={24} lg={12}>
          <Card title={<span><WarningOutlined style={{ color: ERROR, marginRight: 6 }} />Write-off Risk</span>} size="small"
            extra={<Space><CsvExport data={writeOffRisk} columns={[
              { title: 'Donor', dataIndex: 'name' },
              { title: 'Balance', dataIndex: 'balance' },
              { title: 'Days Overdue', dataIndex: 'daysOverdue' },
              { title: 'Campaign', dataIndex: 'campaign' },
            ]} filename="writeoff-risk" /><Tag color="error">{writeOffRisk.length} pledges</Tag></Space>}>
            <Table dataSource={writeOffRisk} rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 8 }} scroll={{ x: 600 }}
              columns={[
                { title: 'Donor', dataIndex: 'name', width: 140, ellipsis: true },
                { title: 'Balance', dataIndex: 'balance', width: 100, render: v => <Text strong style={{ color: ERROR }}>{fmtUSD(v)}</Text>, sorter: (a: WriteOffItem, b: WriteOffItem) => a.balance - b.balance, defaultSortOrder: 'descend' as const },
                { title: 'Overdue', dataIndex: 'daysOverdue', width: 80, render: (v: number) => <Tag color={v > 365 ? 'red' : v > 180 ? 'orange' : 'gold'}>{v}d</Tag> },
                { title: 'Campaign', dataIndex: 'campaign', width: 150, ellipsis: true },
              ]}
            />
          </Card>
        </Col>

        {/* ── Top Open Pledges ────────────────────────────────── */}
        <Col xs={24} lg={12}>
          <Card title="Top Open Pledges" size="small"
            extra={<CsvExport data={topOpenPledges} columns={[
              { title: 'Donor', dataIndex: 'name' },
              { title: 'Pledged', dataIndex: 'pledgedAmount' },
              { title: 'Paid', dataIndex: 'paidAmount' },
              { title: 'Campaign', dataIndex: 'campaign' },
            ]} filename="top-open-pledges" />}>
            <Table dataSource={topOpenPledges} rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 8 }} scroll={{ x: 700 }}
              columns={[
                { title: 'Donor', dataIndex: 'name', width: 140, ellipsis: true },
                { title: 'Pledged', dataIndex: 'pledgedAmount', width: 100, render: fmtUSD, sorter: (a: PledgeItem, b: PledgeItem) => a.pledgedAmount - b.pledgedAmount },
                { title: 'Progress', key: 'progress', width: 140,
                  render: (_: unknown, r: PledgeItem) => {
                    const pct = r.pledgedAmount > 0 ? Math.round(r.paidAmount / r.pledgedAmount * 100) : 0;
                    return <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Progress percent={pct} size="small" strokeColor={pct >= 75 ? SUCCESS : pct >= 40 ? GOLD : WARNING} showInfo={false} />
                      <Text style={{ fontSize: 11 }}>{fmtUSD(r.paidAmount)} / {fmtUSD(r.pledgedAmount)}</Text>
                    </Space>;
                  }
                },
                { title: 'Status', key: 'status', width: 90,
                  render: (_: unknown, r: PledgeItem) => {
                    const status = getPledgeStatus(r.endDate);
                    return <Tag color={status.color}>{status.label}</Tag>;
                  },
                  filters: [
                    { text: 'Open-ended', value: 'Open-ended' },
                    { text: 'Current', value: 'Current' },
                    { text: 'Past Due', value: 'Past Due' },
                  ],
                  onFilter: (value: unknown, record: PledgeItem) => getPledgeStatus(record.endDate).label === value,
                },
                { title: 'Campaign', dataIndex: 'campaign', width: 140, ellipsis: true },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* ── By Campaign ─────────────────────────────────────── */}
        <Col xs={24} lg={14}>
          <Card title="Pledges by Campaign" size="small"
            extra={<CsvExport data={byCampaign} columns={[
              { title: 'Campaign', dataIndex: 'campaign' },
              { title: 'Pledge Count', dataIndex: 'pledgeCount' },
              { title: 'Pledged Amount', dataIndex: 'pledgedAmount' },
              { title: 'Fulfillment Rate', dataIndex: 'fulfillmentRate' },
            ]} filename="pledges-by-campaign" />}>
            <Table dataSource={byCampaign} rowKey="campaign" size="small" pagination={{ pageSize: 10 }} scroll={{ x: 500 }}
              columns={[
                { title: 'Campaign', dataIndex: 'campaign', width: 180, ellipsis: true },
                { title: '#', dataIndex: 'pledgeCount', width: 50, sorter: (a: CampaignItem, b: CampaignItem) => a.pledgeCount - b.pledgeCount },
                { title: 'Pledged', dataIndex: 'pledgedAmount', width: 100, render: fmtUSD, sorter: (a: CampaignItem, b: CampaignItem) => a.pledgedAmount - b.pledgedAmount, defaultSortOrder: 'descend' as const },
                { title: 'Fulfillment', key: 'ful', width: 120,
                  render: (_: unknown, r: CampaignItem) => (
                    <Space size={4}>
                      <Progress type="circle" percent={r.fulfillmentRate} size={28} strokeColor={r.fulfillmentRate >= 70 ? SUCCESS : r.fulfillmentRate >= 40 ? GOLD : ERROR} strokeWidth={8}
                        format={() => ''} />
                      <Text style={{ fontSize: 12 }}>{r.fulfillmentRate}%</Text>
                    </Space>
                  ),
                  sorter: (a: CampaignItem, b: CampaignItem) => a.fulfillmentRate - b.fulfillmentRate,
                },
              ]}
            />
          </Card>
        </Col>

        {/* ── Recent Payments ─────────────────────────────────── */}
        <Col xs={24} lg={10}>
          <Card title="Recent Pledge Payments" size="small">
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {recentPayments.length === 0 && <Text type="secondary">No recent payments</Text>}
              {recentPayments.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < recentPayments.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{p.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />{fmtShortDate(p.date)}
                      {p.pledgeTotal > 0 && <> · Pledge: {fmtUSD(p.pledgeTotal)}</>}
                    </Text>
                  </div>
                  <Text strong style={{ color: SUCCESS, fontSize: 14 }}>{fmtUSD(p.amount)}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
