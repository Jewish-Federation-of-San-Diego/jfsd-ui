import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Alert, Tabs } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useEffect, useState } from 'react';
import {
  WarningOutlined, ExclamationCircleOutlined, CalendarOutlined,
  CheckCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import Plot from 'react-plotly.js';

import { DataFreshness } from '../components/DataFreshness';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency } from '../utils/formatters';

const { Text, Title } = Typography;

interface PriorityItem {
  name: string; balance: number; pledgedAmount: number; paidAmount: number;
  startDate: string; daysOld: number | null; campaign: string;
  paymentCount: number; priority: string; nextAction: string;
}

interface PriorityBucket {
  count: number; total: number; description: string;
  topItems: PriorityItem[];
}

interface CampaignItem {
  campaign: string; pledgeCount: number; pledgedAmount: number;
  paidAmount: number; outstanding: number; fulfillmentRate: number;
}

interface PaymentItem {
  name: string; amount: number; date: string; campaign: string; method: string;
}

interface AgingBucket { bucket: string; count: number; amount: number; }

interface PledgeData {
  asOfDate: string;
  summary: {
    totalOpenPledges: number; totalPledgedAmount: number; totalPaidAmount: number;
    totalOutstanding: number; fulfillmentRate: number; avgPledgeSize: number;
    pledgesWithPayments: number; pledgesWithZeroPayments: number; zeroPaymentPct: number;
  };
  agingBuckets: AgingBucket[];
  collectionPriority: Record<string, PriorityBucket>;
  writeOffRisk: PriorityItem[];
  topOpenPledges: PriorityItem[];
  byCampaign: CampaignItem[];
  recentPayments: PaymentItem[];
  kpis: {
    totalOutstanding: number; fulfillmentRate: number;
    writeOffRiskAmount: number; writeOffRiskCount: number;
    pledgesThisMonth: number; criticalCount: number; criticalAmount: number;
    highCount: number; highAmount: number; nextCollectionWindow: string;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: ERROR, high: '#d98000', medium: NAVY, low: MUTED
};
const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  critical: <ExclamationCircleOutlined />, high: <WarningOutlined />,
  medium: <ClockCircleOutlined />, low: <CheckCircleOutlined />,
};

const AGING_COLORS: Record<string, string> = {
  '0-90 days': SUCCESS, '91-180 days': GOLD, '181-365 days': WARNING, '365+ days': ERROR,
};

const pledgeColumns = [
  { title: 'Donor', dataIndex: 'name', key: 'name', ellipsis: true, width: 180 },
  { title: 'Balance', dataIndex: 'balance', key: 'balance', width: 110, align: 'right' as const,
    render: (v: number) => <Text strong style={{ color: NAVY }}>{safeCurrency(v, { maximumFractionDigits: 0 })}</Text>,
    sorter: (a: PriorityItem, b: PriorityItem) => b.balance - a.balance, defaultSortOrder: 'descend' as const },
  { title: 'Pledged', dataIndex: 'pledgedAmount', key: 'pledged', width: 100, align: 'right' as const,
    render: (v: number) => safeCurrency(v, { maximumFractionDigits: 0 }) },
  { title: 'Campaign', dataIndex: 'campaign', key: 'campaign', ellipsis: true, width: 170 },
  { title: 'Days', dataIndex: 'daysOld', key: 'days', width: 70, align: 'right' as const,
    render: (v: number | null) => v === null ? '—' : v < 0 ? <Tag color="blue">Future</Tag> : v > 365 ? <Tag color={ERROR}>{v}d</Tag> : v > 180 ? <Tag color={WARNING}>{v}d</Tag> : `${v}d` },
  { title: 'Pmts', dataIndex: 'paymentCount', key: 'pmts', width: 60, align: 'center' as const,
    render: (v: number) => v > 0 ? <Tag color={SUCCESS}>{v}</Tag> : <Tag color={ERROR}>0</Tag> },
  { title: 'Priority', dataIndex: 'priority', key: 'priority', width: 85,
    render: (v: string) => <Tag color={PRIORITY_COLORS[v]}>{v.toUpperCase()}</Tag> },
  { title: 'Next Action', dataIndex: 'nextAction', key: 'action', width: 120,
    render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> },
];

export function PledgeManagementDashboard() {
  const [data, setData] = useState<PledgeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<PledgeData>(`${import.meta.env.BASE_URL}data/pledge-management.json`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <Alert type="info" message="Pledge management data not yet generated" />;

  const { summary, kpis, agingBuckets, collectionPriority, byCampaign, recentPayments } = data;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate} />

      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a1a5c 100%)`, padding: '24px 32px', borderRadius: 8, color: '#fff' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>Pledge Management</Title>
        <Text style={{ color: '#ffffffcc' }}>
          {summary.totalOpenPledges} open pledges · {summary.fulfillmentRate}% fulfillment · Next window: {kpis.nextCollectionWindow}
        </Text>
      </div>

      {/* Zero Payment Alert */}
      {summary.zeroPaymentPct > 80 && (
        <Alert type="error" showIcon icon={<WarningOutlined />}
          message={<Text strong>{summary.zeroPaymentPct}% of pledges have zero payments</Text>}
          description={`${summary.pledgesWithZeroPayments} of ${summary.totalOpenPledges} pledges have never been collected. A statement run is the single highest-ROI action available.`}
        />
      )}

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={4}>
          <Card><Statistic title="Outstanding" value={summary.totalOutstanding} prefix="$" formatter={v => Number(v).toLocaleString()} valueStyle={{ color: NAVY, fontSize: 22 }} /></Card>
        </Col>
        <Col xs={12} md={4}>
          <Card><Statistic title="Fulfillment Rate" value={summary.fulfillmentRate} suffix="%" valueStyle={{ color: summary.fulfillmentRate > 50 ? SUCCESS : ERROR, fontSize: 22 }} /></Card>
        </Col>
        <Col xs={12} md={4}>
          <Card><Statistic title={<span style={{color: ERROR}}>Critical</span>} value={kpis.criticalAmount} prefix="$" formatter={v => Number(v).toLocaleString()} suffix={<Text type="secondary" style={{fontSize:11}}> ({kpis.criticalCount})</Text>} valueStyle={{ color: ERROR, fontSize: 22 }} /></Card>
        </Col>
        <Col xs={12} md={4}>
          <Card><Statistic title={<span style={{color:'#d98000'}}>High Priority</span>} value={kpis.highAmount} prefix="$" formatter={v => Number(v).toLocaleString()} suffix={<Text type="secondary" style={{fontSize:11}}> ({kpis.highCount})</Text>} valueStyle={{ color: '#d98000', fontSize: 22 }} /></Card>
        </Col>
        <Col xs={12} md={4}>
          <Card><Statistic title="Write-Off Risk" value={kpis.writeOffRiskAmount} prefix="$" formatter={v => Number(v).toLocaleString()} suffix={<Text type="secondary" style={{fontSize:11}}> ({kpis.writeOffRiskCount})</Text>} valueStyle={{ color: MUTED, fontSize: 22 }} /></Card>
        </Col>
        <Col xs={12} md={4}>
          <Card><Statistic title="New This Month" value={kpis.pledgesThisMonth} valueStyle={{ color: SUCCESS, fontSize: 22 }} /></Card>
        </Col>
      </Row>

      {/* Aging + Priority side by side */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title={<span style={{ color: NAVY }}><ClockCircleOutlined /> Aging</span>}>
            <Plot
              data={[{
                type: 'bar', orientation: 'h',
                y: agingBuckets.map(b => b.bucket),
                x: agingBuckets.map(b => b.amount),
                marker: { color: agingBuckets.map(b => AGING_COLORS[b.bucket] || MUTED) },
                text: agingBuckets.map(b => `$${(b.amount / 1e6).toFixed(1)}M (${b.count})`),
                textposition: 'auto', textfont: { color: '#fff', size: 11 },
              }]}
              layout={{
                height: 200, margin: { l: 100, r: 20, t: 5, b: 25 },
                xaxis: { tickprefix: '$', separatethousands: true, tickfont: { size: 10 } },
                yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
                plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<span style={{ color: NAVY }}><ExclamationCircleOutlined /> Collection Priority</span>}>
            <Plot
              data={[{
                type: 'bar', orientation: 'h',
                y: ['Critical', 'High', 'Medium', 'Low'],
                x: ['critical', 'high', 'medium', 'low'].map(k => collectionPriority[k]?.total || 0),
                marker: { color: [ERROR, '#d98000', NAVY, MUTED] },
                text: ['critical', 'high', 'medium', 'low'].map(k => {
                  const b = collectionPriority[k];
                  return b ? `$${(b.total / 1e6).toFixed(1)}M (${b.count})` : '$0';
                }),
                textposition: 'auto', textfont: { color: '#fff', size: 11 },
              }]}
              layout={{
                height: 200, margin: { l: 80, r: 20, t: 5, b: 25 },
                xaxis: { tickprefix: '$', separatethousands: true, tickfont: { size: 10 } },
                yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
                plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Priority Tabs with Pledge Tables */}
      <Card title={<span style={{ color: NAVY }}>Pledges by Priority — Who Needs Attention?</span>}>
        <Tabs items={['critical', 'high', 'medium', 'low'].filter(k => collectionPriority[k]?.count > 0).map(key => {
          const bucket = collectionPriority[key];
          return {
            key,
            label: <span>{PRIORITY_ICONS[key]} <span style={{ color: PRIORITY_COLORS[key] }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span> <Tag style={{ fontSize: 10 }}>{bucket.count}</Tag></span>,
            children: (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ background: '#F5F5F5', padding: '8px 16px', borderRadius: 6, marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{bucket.description}</Text>
                  <Text strong style={{ float: 'right' }}>{safeCurrency(bucket.total, { maximumFractionDigits: 0 })}</Text>
                </div>
                <Table
                  size="small" pagination={{ pageSize: 10, size: 'small' }}
                  dataSource={bucket.topItems.map((p, i) => ({ ...p, key: i }))}
                  columns={pledgeColumns}
                />
              </Space>
            ),
          };
        })} />
      </Card>

      {/* Campaign Fulfillment */}
      <Card title={<span style={{ color: NAVY }}><CalendarOutlined /> Fulfillment by Campaign</span>}>
        <Table
          size="small" pagination={{ pageSize: 15, size: 'small' }}
          dataSource={byCampaign.filter(c => c.pledgedAmount > 0).map((c, i) => ({ ...c, key: i }))}
          columns={[
            { title: 'Campaign', dataIndex: 'campaign', key: 'campaign', ellipsis: true, width: 250 },
            { title: 'Pledges', dataIndex: 'pledgeCount', key: 'count', width: 70, align: 'right' as const,
              sorter: (a: CampaignItem, b: CampaignItem) => b.pledgeCount - a.pledgeCount },
            { title: 'Pledged', dataIndex: 'pledgedAmount', key: 'pledged', width: 120, align: 'right' as const,
              render: (v: number) => safeCurrency(v, { maximumFractionDigits: 0 }),
              sorter: (a: CampaignItem, b: CampaignItem) => b.pledgedAmount - a.pledgedAmount, defaultSortOrder: 'descend' as const },
            { title: 'Outstanding', dataIndex: 'outstanding', key: 'outstanding', width: 120, align: 'right' as const,
              render: (v: number) => <Text strong>{safeCurrency(v, { maximumFractionDigits: 0 })}</Text> },
            { title: 'Fulfillment', dataIndex: 'fulfillmentRate', key: 'rate', width: 100, align: 'right' as const,
              render: (v: number) => <Tag color={v >= 50 ? SUCCESS : v >= 20 ? GOLD : ERROR}>{v}%</Tag>,
              sorter: (a: CampaignItem, b: CampaignItem) => a.fulfillmentRate - b.fulfillmentRate },
          ]}
        />
      </Card>

      {/* Recent Payments */}
      {recentPayments.length > 0 && (
        <Card title={<span style={{ color: NAVY }}><CheckCircleOutlined /> Recent Payments (Last 90 Days)</span>}>
          <Table
            size="small" pagination={{ pageSize: 10, size: 'small' }}
            dataSource={recentPayments.map((p, i) => ({ ...p, key: i }))}
            columns={[
              { title: 'Donor', dataIndex: 'name', key: 'name', ellipsis: true, width: 200 },
              { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 100, align: 'right' as const,
                render: (v: number) => <Text strong style={{ color: SUCCESS }}>{safeCurrency(v, { maximumFractionDigits: 0 })}</Text> },
              { title: 'Date', dataIndex: 'date', key: 'date', width: 100 },
              { title: 'Campaign', dataIndex: 'campaign', key: 'campaign', ellipsis: true, width: 200 },
              { title: 'Method', dataIndex: 'method', key: 'method', width: 100 },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}

export default PledgeManagementDashboard;
