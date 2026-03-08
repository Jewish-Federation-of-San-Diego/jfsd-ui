import { Card, Col, Row, Space, Statistic, Table, Typography, Alert, Tag, Tooltip } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import {
  RiseOutlined,
  FallOutlined,
  MinusOutlined,
  TeamOutlined,
  DollarOutlined,
  FundOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';

import { DataFreshness } from '../components/DataFreshness';
const { Text } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency } from '../utils/formatters';

// ── Brand tokens ────────────────────────────────────────────────────────
// ── Types ───────────────────────────────────────────────────────────────
interface UpgradeProspect {
  name: string; currentGiving: number; estimatedCapacity: number;
  gap: number; yearsGiving: number; trend: 'up' | 'down' | 'flat';
}
interface MajorPipelineEntry {
  name: string; capacity: number; capacityTier: string;
  currentFY26: number; priorFY25: number; email: string; phone: string;
}
interface GivingVsCapacity {
  level: string; donors: number; avgGiving: number; avgCapacity: number;
}
interface TrajectoryEntry {
  name: string; fy24: number; fy25: number; fy26: number;
  trajectory: 'increasing' | 'decreasing' | 'stable';
}
interface KPIs {
  totalProfiled: number; totalCapacityGap: number;
  upgradeCount: number; avgUpgradeAmount: number; highCapacityNonDonors: number;
}
interface ProspectData {
  asOfDate: string;
  totalProfiled: number;
  capacityGap: number;
  upgradeProspects: UpgradeProspect[];
  majorDonorPipeline: MajorPipelineEntry[];
  givingVsCapacity: GivingVsCapacity[];
  trajectoryAnalysis: TrajectoryEntry[];
  kpis: KPIs;
}

const fmtUSD = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });
const fmtCompact = (v: number) => safeCurrency(v, { notation: 'compact', maximumFractionDigits: 1 });

// ── Trend icon ──────────────────────────────────────────────────────────
function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'up' || trend === 'increasing')
    return <RiseOutlined style={{ color: SUCCESS, fontSize: 16 }} />;
  if (trend === 'down' || trend === 'decreasing')
    return <FallOutlined style={{ color: ERROR, fontSize: 16 }} />;
  return <MinusOutlined style={{ color: '#8C8C8C', fontSize: 14 }} />;
}

// ── Capacity tier badge ─────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const color = tier === '$1M+' ? GOLD : tier === '$500K+' ? SUCCESS : tier === '$250K+' ? WARNING : NAVY;
  return <Tag color={color} style={{ fontWeight: 600 }}>{tier}</Tag>;
}

// ── Grouped Bar Chart (Plotly) ──────────────────────────────────────────
function GroupedBarChart({ data }: { data: GivingVsCapacity[] }) {
  if (!data.length) return <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Text type="secondary">No capacity data available</Text>
  </div>;

  const levels = data.map(d => d.level || 'Unknown');
  const avgGivingData = data.map(d => isNaN(d.avgGiving) ? 0 : d.avgGiving);
  const avgCapacityData = data.map(d => isNaN(d.avgCapacity) ? 0 : d.avgCapacity);

  const plotData = [
    {
      name: 'Avg Giving',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: levels,
      x: avgGivingData,
      marker: {
        color: NAVY,
        opacity: 0.85,
      },
      hovertemplate: '<b>%{y}</b><br>Avg Giving: $%{x:,.0f}<extra></extra>',
    },
    {
      name: 'Avg Capacity',
      type: 'bar' as const,
      orientation: 'h' as const,
      y: levels,
      x: avgCapacityData,
      marker: {
        color: GOLD,
        opacity: 0.85,
      },
      hovertemplate: '<b>%{y}</b><br>Avg Capacity: $%{x:,.0f}<extra></extra>',
    },
  ];

  const layout = {
    margin: { l: 100, r: 60, t: 10, b: 60 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: true,
    legend: {
      orientation: 'h' as const,
      x: 0.5,
      xanchor: 'center' as const,
      y: -0.2,
      bgcolor: 'rgba(255,255,255,0)',
    },
    xaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 11, color: '#555' },
      tickformat: '$,.0s',
    },
    yaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 12, color: '#555' },
      categoryorder: 'total ascending' as const,
    },
    height: Math.max(data.length * 80 + 100, 280),
    barmode: 'group' as const,
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

// ── Main Dashboard ──────────────────────────────────────────────────────
export function ProspectResearchDashboard() {
  const [data, setData] = useState<ProspectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJson<ProspectData>(`${import.meta.env.BASE_URL}data/prospect-research.json`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/prospect-research.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <Alert type="error" message="Failed to load prospect research data" description={error} showIcon />;
  if (!data) return null;

  const kpis = data.kpis ?? { totalProfiled: 0, totalCapacityGap: 0, upgradeCount: 0, avgUpgradeAmount: 0, highCapacityNonDonors: 0 };
  const upgradeProspects = data.upgradeProspects ?? [];
  const majorDonorPipeline = data.majorDonorPipeline ?? [];
  const givingVsCapacity = data.givingVsCapacity ?? [];
  const trajectoryAnalysis = data.trajectoryAnalysis ?? [];

  // ── Upgrade table columns ────────────────────────────────────────────
  const upgradeCols = [
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a: UpgradeProspect, b: UpgradeProspect) => a.name.localeCompare(b.name) },
    { title: 'Current Giving', dataIndex: 'currentGiving', key: 'currentGiving', render: fmtUSD, sorter: (a: UpgradeProspect, b: UpgradeProspect) => a.currentGiving - b.currentGiving },
    { title: 'Est. Capacity', dataIndex: 'estimatedCapacity', key: 'estimatedCapacity', render: fmtUSD, sorter: (a: UpgradeProspect, b: UpgradeProspect) => a.estimatedCapacity - b.estimatedCapacity },
    { title: 'Gap', dataIndex: 'gap', key: 'gap', render: (v: number) => <Text style={{ color: WARNING, fontWeight: 600 }}>{fmtUSD(v)}</Text>, sorter: (a: UpgradeProspect, b: UpgradeProspect) => a.gap - b.gap, defaultSortOrder: 'descend' as const },
    { title: 'Years', dataIndex: 'yearsGiving', key: 'yearsGiving', width: 70 },
    { title: 'Trend', dataIndex: 'trend', key: 'trend', width: 60, render: (t: string) => <TrendArrow trend={t} /> },
  ];

  // ── Major pipeline columns ───────────────────────────────────────────
  const majorCols = [
    { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a: MajorPipelineEntry, b: MajorPipelineEntry) => a.name.localeCompare(b.name) },
    { title: 'Tier', dataIndex: 'capacityTier', key: 'capacityTier', render: (t: string) => <TierBadge tier={t} />, width: 100 },
    { title: 'Capacity', dataIndex: 'capacity', key: 'capacity', render: fmtUSD, sorter: (a: MajorPipelineEntry, b: MajorPipelineEntry) => a.capacity - b.capacity, defaultSortOrder: 'descend' as const },
    { title: 'FY26', dataIndex: 'currentFY26', key: 'currentFY26', render: fmtUSD },
    { title: 'FY25', dataIndex: 'priorFY25', key: 'priorFY25', render: fmtUSD },
    { title: 'Contact', key: 'contact', render: (_: unknown, r: MajorPipelineEntry) => (
      <Tooltip title={[r.email, r.phone].filter(Boolean).join(' | ') || 'No contact info'}>
        <Text style={{ color: NAVY, cursor: 'pointer' }}>{r.email ? '📧' : ''} {r.phone ? '📱' : ''}</Text>
      </Tooltip>
    ), width: 70 },
  ];

  // ── Trajectory columns ───────────────────────────────────────────────
  const trajCols = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'FY24', dataIndex: 'fy24', key: 'fy24', render: fmtUSD },
    { title: 'FY25', dataIndex: 'fy25', key: 'fy25', render: fmtUSD },
    { title: 'FY26', dataIndex: 'fy26', key: 'fy26', render: fmtUSD },
    { title: 'Trend', dataIndex: 'trajectory', key: 'trajectory', render: (t: string) => <TrendArrow trend={t} />, width: 60 },
  ];

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: 700, color: NAVY }}>Prospect Research</Text>
      </div>
      <DataFreshness asOfDate={data.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${NAVY}` }}>
            <Statistic title="Total Profiled" value={kpis.totalProfiled} prefix={<TeamOutlined style={{ color: NAVY }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${GOLD}` }}>
            <Statistic title={<DefinitionTooltip term="Capacity Gap" dashboardKey="prospect">Capacity Gap</DefinitionTooltip>} value={kpis.totalCapacityGap} prefix={<DollarOutlined style={{ color: GOLD }} />}
              formatter={(v) => fmtCompact(Number(v))} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${SUCCESS}` }}>
            <Statistic title={<DefinitionTooltip term="Upgrade Prospect" dashboardKey="prospect">Upgrade Prospects</DefinitionTooltip>} value={kpis.upgradeCount} prefix={<FundOutlined style={{ color: SUCCESS }} />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${ERROR}` }}>
            <Statistic title="High-Cap Non-Donors" value={kpis.highCapacityNonDonors} prefix={<UserSwitchOutlined style={{ color: ERROR }} />} />
          </Card>
        </Col>
      </Row>

      {/* Upgrade Opportunities */}
          <Card title={
            <Text style={{ color: NAVY, fontWeight: 600 }}>
              {upgradeProspects.length > 0 
                ? `${upgradeProspects.length} upgrade prospects — ${fmtCompact(upgradeProspects.reduce((sum, p) => sum + p.gap, 0))} capacity gap`
                : "Upgrade Opportunities"
              }
            </Text>
          }
        extra={<Space><CsvExport data={upgradeProspects} columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Current Giving', dataIndex: 'currentGiving' },
          { title: 'Est. Capacity', dataIndex: 'estimatedCapacity' },
          { title: 'Gap', dataIndex: 'gap' },
          { title: 'Years Giving', dataIndex: 'yearsGiving' },
          { title: 'Trend', dataIndex: 'trend' },
        ]} filename="upgrade-prospects" /><Text type="secondary" style={{ fontSize: 12 }}>Giving $1K–$5K · Capacity $5K+</Text></Space>}
        style={{ marginBottom: 24 }}>
        <Table dataSource={upgradeProspects} columns={upgradeCols}
          rowKey="name" size="small" pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 700 }} />
      </Card>

      {/* Major Donor Pipeline + Giving vs Capacity */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card title={
            <Text style={{ color: NAVY, fontWeight: 600 }}>
              {majorDonorPipeline.length > 0 
                ? `${majorDonorPipeline.length} major prospects — ${fmtCompact(majorDonorPipeline.reduce((sum, p) => sum + p.capacity, 0))} total capacity`
                : "Major Donor Pipeline"
              }
            </Text>
          }
            extra={<Space><CsvExport data={majorDonorPipeline} columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Tier', dataIndex: 'capacityTier' },
              { title: 'Capacity', dataIndex: 'capacity' },
              { title: 'FY26', dataIndex: 'currentFY26' },
              { title: 'FY25', dataIndex: 'priorFY25' },
            ]} filename="major-donor-pipeline" /><Text type="secondary" style={{ fontSize: 12 }}>Capacity $100K+ · Not yet giving at that level</Text></Space>}>
            <Table dataSource={majorDonorPipeline} columns={majorCols}
              rowKey="name" size="small" pagination={{ pageSize: 10 }}
              scroll={{ x: 600 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Text style={{ color: NAVY, fontWeight: 600 }}>Giving vs Capacity by Level</Text>}>
            <GroupedBarChart data={givingVsCapacity} />
          </Card>
        </Col>
      </Row>

      {/* Trajectory Analysis */}
      <Card title={
        <Text style={{ color: NAVY, fontWeight: 600 }}>
          {trajectoryAnalysis.length > 0 
            ? `${trajectoryAnalysis.length} donors tracked — ${trajectoryAnalysis.filter(t => t.trajectory === 'increasing').length} increasing, ${trajectoryAnalysis.filter(t => t.trajectory === 'decreasing').length} decreasing`
            : "Trajectory Analysis"
          }
        </Text>
      }
        extra={<Space><CsvExport data={trajectoryAnalysis} columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'FY24', dataIndex: 'fy24' },
          { title: 'FY25', dataIndex: 'fy25' },
          { title: 'FY26', dataIndex: 'fy26' },
          { title: 'Trajectory', dataIndex: 'trajectory' },
        ]} filename="trajectory-analysis" /><Text type="secondary" style={{ fontSize: 12 }}>Year-over-year recognition trends</Text></Space>}>
        <Table dataSource={trajectoryAnalysis} columns={trajCols}
          rowKey="name" size="small" pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 500 }} />
      </Card>
    </div>
  );
}
