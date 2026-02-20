import { Card, Col, Row, Statistic, Table, Typography, Space, Progress, Spin, Alert, Tag } from 'antd';
import { CsvExport } from '../components/CsvExport';
import {
  DollarOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';

const { Text, Title } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY    = '#1B365D';
const GOLD    = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR   = '#C4314B';
const WARNING = '#D4880F';

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
const fmtDate = (d: string) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; } };
const fmtShortDate = (d: string) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return d; } };

const AGING_COLORS: Record<string, string> = {
  '0-90 days': SUCCESS,
  '91-180 days': GOLD,
  '181-365 days': WARNING,
  '365+ days': ERROR,
};

// ── Component ───────────────────────────────────────────────────────────
export function PledgeManagementDashboard() {
  const [data, setData] = useState<PledgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/jfsd-ui/data/pledge-management.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /><br /><Text type="secondary">Loading pledge data…</Text></div>;
  if (error) return <Alert type="error" message="Failed to load pledge data" description={error} showIcon style={{ margin: 24 }} />;
  if (!data) return null;

  const { summary, kpis, agingBuckets, writeOffRisk, topOpenPledges, byCampaign, recentPayments } = data;
  const totalAging = agingBuckets.reduce((s, b) => s + b.amount, 0) || 1;

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      <Title level={3} style={{ color: NAVY, marginBottom: 4 }}>Pledge Management</Title>
      <Text type="secondary">As of {fmtDate(data.asOfDate)} · {summary.totalOpenPledges} open pledges</Text>

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {[
          { title: 'Total Outstanding', value: fmtUSD(kpis.totalOutstanding), icon: <DollarOutlined />, color: NAVY },
          { title: <DefinitionTooltip term="Fulfillment Rate" dashboardKey="pledge">Fulfillment Rate</DefinitionTooltip>, value: `${kpis.fulfillmentRate}%`, icon: <CheckCircleOutlined />, color: kpis.fulfillmentRate >= 50 ? SUCCESS : WARNING },
          { title: <DefinitionTooltip term="Write-off Risk" dashboardKey="pledge">Write-off Risk</DefinitionTooltip>, value: fmtUSD(kpis.writeOffRiskAmount), icon: <WarningOutlined />, color: ERROR, suffix: `${kpis.writeOffRiskCount} pledges` },
          { title: 'Pledges This Month', value: kpis.pledgesThisMonth, icon: <CalendarOutlined />, color: GOLD },
          { title: 'Avg Pledge Size', value: fmtUSD(summary.avgPledgeSize), icon: <FileTextOutlined />, color: NAVY },
        ].map((kpi, i) => (
          <Col xs={24} sm={12} md={8} lg={4} xl={4} key={i}>
            <Card size="small" style={{ borderTop: `3px solid ${kpi.color}` }}>
              <Statistic title={kpi.title} value={kpi.value} prefix={kpi.icon} valueStyle={{ color: kpi.color, fontSize: 22 }} />
              {kpi.suffix && <Text type="secondary" style={{ fontSize: 12 }}>{kpi.suffix}</Text>}
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
              <div key={b.bucket} title={`${b.bucket}: ${fmtUSD(b.amount)} (${b.count})`}
                style={{ width: `${pct}%`, background: AGING_COLORS[b.bucket] || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}>
                {pct > 8 ? `${b.bucket}` : ''}
              </div>
            );
          })}
        </div>
        <Row gutter={16}>
          {agingBuckets.map(b => (
            <Col key={b.bucket} xs={12} sm={6}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: AGING_COLORS[b.bucket] }} />
                <Text strong style={{ fontSize: 13 }}>{b.bucket}</Text>
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
            <Table dataSource={topOpenPledges} rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 8 }} scroll={{ x: 600 }}
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
