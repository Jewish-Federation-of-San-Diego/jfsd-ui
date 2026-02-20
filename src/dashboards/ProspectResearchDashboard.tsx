import { Card, Col, Row, Space, Statistic, Table, Typography, Spin, Alert, Tag, Tooltip } from 'antd';
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
import { useEffect, useRef, useState, useCallback } from 'react';

const { Text } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY    = '#1B365D';
const GOLD    = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR   = '#C4314B';
const WARNING = '#D4880F';

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

const fmtUSD = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

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

// ── Simple bar chart (SVG) ──────────────────────────────────────────────
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

function GroupedBarChart({ data }: { data: GivingVsCapacity[] }) {
  const { ref, width } = useWidth();
  if (!width || !data.length) return <div ref={ref} style={{ minHeight: 200 }} />;

  const barH = 24;
  const gap = 6;
  const groupGap = 16;
  const labelW = 100;
  const rightPad = 60;
  const chartW = width - labelW - rightPad;
  const maxVal = Math.max(...data.flatMap(d => [d.avgGiving, d.avgCapacity]), 1);
  const totalH = data.length * (barH * 2 + gap + groupGap);

  return (
    <div ref={ref}>
      <svg width={width} height={totalH + 20}>
        {data.map((d, i) => {
          const y = i * (barH * 2 + gap + groupGap);
          const wGiving = (d.avgGiving / maxVal) * chartW;
          const wCapacity = (d.avgCapacity / maxVal) * chartW;
          return (
            <g key={d.level}>
              <text x={0} y={y + barH + gap / 2} fontSize={12} fill="#555" dominantBaseline="middle">
                {d.level}
              </text>
              {/* Avg Giving */}
              <rect x={labelW} y={y} width={Math.max(wGiving, 2)} height={barH} rx={4} fill={NAVY} opacity={0.85} />
              <text x={labelW + wGiving + 4} y={y + barH / 2} fontSize={11} fill={NAVY} dominantBaseline="middle">
                {fmtCompact(d.avgGiving)}
              </text>
              {/* Avg Capacity */}
              <rect x={labelW} y={y + barH + gap} width={Math.max(wCapacity, 2)} height={barH} rx={4} fill={GOLD} opacity={0.85} />
              <text x={labelW + wCapacity + 4} y={y + barH + gap + barH / 2} fontSize={11} fill={GOLD} dominantBaseline="middle">
                {fmtCompact(d.avgCapacity)}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 12 }}><span style={{ display: 'inline-block', width: 12, height: 12, background: NAVY, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Avg Giving</span>
        <span style={{ fontSize: 12 }}><span style={{ display: 'inline-block', width: 12, height: 12, background: GOLD, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />Avg Capacity</span>
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function ProspectResearchDashboard() {
  const [data, setData] = useState<ProspectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/jfsd-ui/data/prospect-research.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="Failed to load prospect research data" description={error} showIcon />;
  if (!data) return null;

  const { kpis } = data;

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
        <Text style={{ marginLeft: 12, color: '#8C8C8C', fontSize: 13 }}>
          as of {new Date(data.asOfDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </Text>
      </div>

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
      <Card title={<Text style={{ color: NAVY, fontWeight: 600 }}>Upgrade Opportunities</Text>}
        extra={<Space><CsvExport data={data.upgradeProspects} columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Current Giving', dataIndex: 'currentGiving' },
          { title: 'Est. Capacity', dataIndex: 'estimatedCapacity' },
          { title: 'Gap', dataIndex: 'gap' },
          { title: 'Years Giving', dataIndex: 'yearsGiving' },
          { title: 'Trend', dataIndex: 'trend' },
        ]} filename="upgrade-prospects" /><Text type="secondary" style={{ fontSize: 12 }}>Giving $1K–$5K · Capacity $5K+</Text></Space>}
        style={{ marginBottom: 24 }}>
        <Table dataSource={data.upgradeProspects} columns={upgradeCols}
          rowKey="name" size="small" pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 700 }} />
      </Card>

      {/* Major Donor Pipeline + Giving vs Capacity */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card title={<Text style={{ color: NAVY, fontWeight: 600 }}>Major Donor Pipeline</Text>}
            extra={<Space><CsvExport data={data.majorDonorPipeline} columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Tier', dataIndex: 'capacityTier' },
              { title: 'Capacity', dataIndex: 'capacity' },
              { title: 'FY26', dataIndex: 'currentFY26' },
              { title: 'FY25', dataIndex: 'priorFY25' },
            ]} filename="major-donor-pipeline" /><Text type="secondary" style={{ fontSize: 12 }}>Capacity $100K+ · Not yet giving at that level</Text></Space>}>
            <Table dataSource={data.majorDonorPipeline} columns={majorCols}
              rowKey="name" size="small" pagination={{ pageSize: 10 }}
              scroll={{ x: 600 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Text style={{ color: NAVY, fontWeight: 600 }}>Giving vs Capacity by Level</Text>}>
            <GroupedBarChart data={data.givingVsCapacity} />
          </Card>
        </Col>
      </Row>

      {/* Trajectory Analysis */}
      <Card title={<Text style={{ color: NAVY, fontWeight: 600 }}>Trajectory Analysis</Text>}
        extra={<Space><CsvExport data={data.trajectoryAnalysis} columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'FY24', dataIndex: 'fy24' },
          { title: 'FY25', dataIndex: 'fy25' },
          { title: 'FY26', dataIndex: 'fy26' },
          { title: 'Trajectory', dataIndex: 'trajectory' },
        ]} filename="trajectory-analysis" /><Text type="secondary" style={{ fontSize: 12 }}>Year-over-year recognition trends</Text></Space>}>
        <Table dataSource={data.trajectoryAnalysis} columns={trajCols}
          rowKey="name" size="small" pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 500 }} />
      </Card>
    </div>
  );
}
