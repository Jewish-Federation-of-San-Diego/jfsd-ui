import { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Collapse, Alert, Tabs } from 'antd';
import Plot from 'react-plotly.js';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { DataFreshness } from '../components/DataFreshness';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency } from '../utils/formatters';
import { NAVY, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';
import {
  DollarCircleOutlined, WarningOutlined, CalendarOutlined,
  TeamOutlined, FileSearchOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface Segment {
  label: string; color: string; total: number; count: number;
  action: string; collectionCycle: string;
  topPledges: Array<{
    name: string; balance: number; committed: number; startDate: string;
    daysOld: number | null; campaign: string; paymentCount: number; totalPaid: number;
  }>;
  aging: Record<string, { count: number; amount: number }>;
}

interface MonthlyInflow { month: string; fy26: number; fy25: number; fy26Count: number; fy25Count: number; }
interface SeasonalityItem { month: string; avgAmount: number; pctOfTotal: number; }
interface CalendarItem { month: string; actions: string[]; }

interface CashData {
  generatedAt: string;
  kpis: {
    totalReceivable: number; totalPledges: number; cashReceivedYTD: number;
    collectionRate: number; pledgesWithZeroPayments: number; zeroPctOfTotal: number;
    writeOffCandidates: number; writeOffAmount: number;
    drmActionable: number; drmActionableAmount: number;
    eventActionable: number; eventActionableAmount: number;
  };
  segments: Record<string, Segment>;
  monthlyInflow: MonthlyInflow[];
  seasonality: SeasonalityItem[];
  collectionCalendar: CalendarItem[];
  narrative?: { title: string; keyFindings: string[] };
}

const SEGMENT_ORDER = ['capital', 'drm_major', 'drm_mid', 'event', 'telemarketing', 'recurring', 'other'];

export function CashForecastDashboard() {
  const [data, setData] = useState<CashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<CashData>(`${import.meta.env.BASE_URL}data/cash-forecast.json`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <Alert type="info" message="Cash forecast data not yet generated" />;

  const { kpis, segments, monthlyInflow, seasonality, collectionCalendar } = data;

  // Segment chart data
  const segLabels = SEGMENT_ORDER.filter(k => segments[k]?.count > 0).map(k => segments[k].label);
  const segValues = SEGMENT_ORDER.filter(k => segments[k]?.count > 0).map(k => segments[k].total);
  const segColors = SEGMENT_ORDER.filter(k => segments[k]?.count > 0).map(k => segments[k].color);
  const segCounts = SEGMENT_ORDER.filter(k => segments[k]?.count > 0).map(k => segments[k].count);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.generatedAt} />

      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a1a5c 100%)`, padding: '24px 32px', borderRadius: 8, color: '#fff' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          <DollarCircleOutlined /> Cash Forecast & Collections Intelligence
        </Title>
        <Text style={{ color: '#ffffffcc' }}>
          {kpis.totalPledges} active pledges · {Object.keys(segments).filter(k => segments[k].count > 0).length} segments · Collection calendar
        </Text>
      </div>

      {/* Alert: Zero Payment Rate */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message={<Text strong>93% of active pledges have zero payments collected</Text>}
        description={`${kpis.pledgesWithZeroPayments} of ${kpis.totalPledges} pledges ($${(kpis.totalReceivable / 1e6).toFixed(1)}M) have never had a single dollar collected. This is a collections process issue, not a donor intent issue.`}
      />

      {/* KPIs */}
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card><Statistic title="Total Receivable" value={kpis.totalReceivable} prefix="$" formatter={v => Number(v).toLocaleString()} valueStyle={{ color: NAVY, fontSize: 24 }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="FY26 Cash Received" value={kpis.cashReceivedYTD} prefix="$" formatter={v => Number(v).toLocaleString()} valueStyle={{ color: SUCCESS, fontSize: 24 }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="DRM Actionable" value={kpis.drmActionableAmount} prefix="$" formatter={v => Number(v).toLocaleString()} suffix={<Text type="secondary" style={{ fontSize: 12 }}> ({kpis.drmActionable} pledges)</Text>} valueStyle={{ color: '#d98000', fontSize: 24 }} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Write-Off Candidates" value={kpis.writeOffAmount} prefix="$" formatter={v => Number(v).toLocaleString()} suffix={<Text type="secondary" style={{ fontSize: 12 }}> ({kpis.writeOffCandidates} pledges)</Text>} valueStyle={{ color: MUTED, fontSize: 24 }} /></Card>
        </Col>
      </Row>

      {/* Segment Breakdown */}
      <Card title={<span style={{ color: NAVY }}><TeamOutlined /> Receivable by Segment</span>}>
        <Plot
          data={[{
            type: 'bar', orientation: 'h',
            y: segLabels, x: segValues,
            marker: { color: segColors },
            text: segLabels.map((_, i) => `$${(segValues[i] / 1e6).toFixed(1)}M (${segCounts[i]})`),
            textposition: 'auto', textfont: { color: '#fff', size: 12 },
            hovertemplate: '%{y}<br>$%{x:,.0f}<br>%{customdata} pledges<extra></extra>',
            customdata: segCounts,
          }]}
          layout={{
            height: 300, margin: { l: 220, r: 40, t: 10, b: 30 },
            xaxis: { tickprefix: '$', separatethousands: true, tickfont: { size: 10 } },
            yaxis: { tickfont: { size: 11 }, autorange: 'reversed' },
            plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </Card>

      {/* Segment Detail Tabs */}
      <Tabs items={SEGMENT_ORDER.filter(k => segments[k]?.count > 0).map(key => {
        const seg = segments[key];
        return {
          key,
          label: <span><span style={{ color: seg.color }}>●</span> {seg.label.split('(')[0].trim()} <Tag style={{ fontSize: 10 }}>{seg.count}</Tag></span>,
          children: (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ background: '#F0F5FF', padding: 16, borderRadius: 8, borderLeft: `4px solid ${seg.color}` }}>
                    <Text strong style={{ color: NAVY }}>Collection Action</Text>
                    <Paragraph style={{ marginBottom: 0, marginTop: 4 }}>{seg.action}</Paragraph>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: '#F5F5F5', padding: 16, borderRadius: 8 }}>
                    <Text strong style={{ color: NAVY }}>Collection Cycle</Text>
                    <Paragraph style={{ marginBottom: 0, marginTop: 4 }}>{seg.collectionCycle}</Paragraph>
                  </div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}><Statistic title="Pledges" value={seg.count} /></Col>
                <Col span={8}><Statistic title="Outstanding" value={seg.total} prefix="$" formatter={v => Number(v).toLocaleString()} /></Col>
                <Col span={8}><Statistic title="Avg Pledge" value={seg.count > 0 ? Math.round(seg.total / seg.count) : 0} prefix="$" formatter={v => Number(v).toLocaleString()} /></Col>
              </Row>
              {seg.topPledges.length > 0 && (
                <Table
                  size="small"
                  pagination={{ pageSize: 10, size: 'small' }}
                  dataSource={seg.topPledges.map((p, i) => ({ ...p, key: i }))}
                  columns={[
                    { title: 'Donor', dataIndex: 'name', key: 'name', ellipsis: true, width: 200 },
                    { title: 'Balance', dataIndex: 'balance', key: 'balance', width: 110, align: 'right' as const,
                      render: (v: number) => <Text strong>{safeCurrency(v, { maximumFractionDigits: 0 })}</Text>,
                      sorter: (a: { balance: number }, b: { balance: number }) => b.balance - a.balance, defaultSortOrder: 'descend' as const },
                    { title: 'Committed', dataIndex: 'committed', key: 'committed', width: 110, align: 'right' as const,
                      render: (v: number) => safeCurrency(v, { maximumFractionDigits: 0 }) },
                    { title: 'Campaign', dataIndex: 'campaign', key: 'campaign', ellipsis: true, width: 180 },
                    { title: 'Days', dataIndex: 'daysOld', key: 'days', width: 70, align: 'right' as const,
                      render: (v: number | null) => v !== null ? (v < 0 ? <Tag color="blue">Future</Tag> : v > 365 ? <Tag color={ERROR}>{v}d</Tag> : `${v}d`) : '—' },
                    { title: 'Payments', dataIndex: 'paymentCount', key: 'payments', width: 80, align: 'center' as const,
                      render: (v: number) => v > 0 ? <Tag color={SUCCESS}>{v}</Tag> : <Tag color={ERROR}>0</Tag> },
                  ]}
                />
              )}
            </Space>
          ),
        };
      })} />

      {/* Monthly Cash Inflow */}
      {monthlyInflow.length > 0 && (
        <Card title={<span style={{ color: NAVY }}>Monthly Cash Inflow: FY26 vs FY25</span>}>
          <Plot
            data={[
              { x: monthlyInflow.map(m => m.month), y: monthlyInflow.map(m => m.fy25), type: 'bar', name: 'FY25', marker: { color: MUTED } },
              { x: monthlyInflow.map(m => m.month), y: monthlyInflow.map(m => m.fy26), type: 'bar', name: 'FY26', marker: { color: NAVY } },
            ]}
            layout={{
              height: 300, margin: { l: 60, r: 20, t: 10, b: 40 },
              barmode: 'group',
              xaxis: { tickfont: { size: 11 } },
              yaxis: { tickprefix: '$', separatethousands: true, tickfont: { size: 10 } },
              legend: { orientation: 'h', y: -0.15 },
              plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </Card>
      )}

      {/* Payment Seasonality */}
      {seasonality.length > 0 && (
        <Card title={<span style={{ color: NAVY }}><CalendarOutlined /> Payment Seasonality (3-Year Average)</span>}>
          <Plot
            data={[{
              x: seasonality.map(s => s.month),
              y: seasonality.map(s => s.pctOfTotal),
              type: 'bar',
              marker: {
                color: seasonality.map(s => s.pctOfTotal > 10 ? SUCCESS : s.pctOfTotal > 5 ? '#009191' : MUTED),
              },
              text: seasonality.map(s => `${s.pctOfTotal}%`),
              textposition: 'outside',
              hovertemplate: '%{x}<br>%{y:.1f}% of annual gifts<br>Avg: $%{customdata:,.0f}<extra></extra>',
              customdata: seasonality.map(s => s.avgAmount),
            }]}
            layout={{
              height: 280, margin: { l: 40, r: 20, t: 10, b: 40 },
              yaxis: { ticksuffix: '%', tickfont: { size: 10 } },
              xaxis: { tickfont: { size: 11 } },
              plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
              annotations: [{
                x: 'Dec', y: seasonality.find(s => s.month === 'Dec')?.pctOfTotal ?? 0,
                text: 'Peak: Dec 21%', showarrow: true, arrowhead: 2,
                font: { size: 10, color: SUCCESS },
              }],
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%' }}
          />
        </Card>
      )}

      {/* Collection Calendar */}
      <Card title={<span style={{ color: NAVY }}><CalendarOutlined /> Collection Calendar — When to Act</span>}>
        <Collapse
          ghost
          items={collectionCalendar.map(item => ({
            key: item.month,
            label: (
              <Text strong style={{ color: ['Dec', 'Jan', 'Oct', 'May'].includes(item.month) ? SUCCESS : NAVY }}>
                {item.month} {['Dec', 'Jan', 'Oct', 'May'].includes(item.month) ? '🔥' : ''}
              </Text>
            ),
            children: (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {item.actions.map((action, i) => (
                  <li key={i} style={{ marginBottom: 4 }}><Text>{action}</Text></li>
                ))}
              </ul>
            ),
          }))}
        />
      </Card>

      {/* Key Findings */}
      {data.narrative && (
        <Card title={<span style={{ color: NAVY }}><FileSearchOutlined /> {data.narrative.title}</span>}>
          <Space direction="vertical" size="small">
            {data.narrative.keyFindings.map((finding, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Text style={{ color: NAVY, fontWeight: 700, minWidth: 20 }}>{i + 1}.</Text>
                <Text>{finding}</Text>
              </div>
            ))}
          </Space>
        </Card>
      )}
    </Space>
  );
}

export default CashForecastDashboard;
