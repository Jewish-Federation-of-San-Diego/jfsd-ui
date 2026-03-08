import { Card, Col, Row, Statistic, Table, Typography, Space, Alert, Tag, Collapse } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import {
  RiseOutlined,
  FallOutlined,
  TeamOutlined,
  DollarOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useEffect, useState, useRef, useCallback } from 'react';
import { PdfExport } from '../components/PdfExport';
import { DataFreshness } from '../components/DataFreshness';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safeCurrency, safePercent } from '../utils/formatters';
import Plot from 'react-plotly.js';

const { Text, Title } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

// ── Brand tokens ────────────────────────────────────────────────────────
const BG_LIGHT = '#F7F8FA';

// ── Types ───────────────────────────────────────────────────────────────
interface BoardMember {
  name: string;
  role: string;
  status: 'gave' | 'lybunt' | 'no-record' | 'not-matched';
  fy26Amount: number;
  fy25Amount: number;
}

interface Board {
  name: string;
  shortName: string;
  totalMembers: number;
  matchedInSF: number;
  gaveFY26: number;
  participationRate: number;
  totalGiven: number;
  members: BoardMember[];
}

interface GivingLevel {
  level: string;
  donors: number;
  amount: number;
}

interface Highlight {
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
}

interface BoardData {
  asOfDate: string;
  boards: Board[];
  campaignSummary: {
    goal: number;
    raised: number;
    pctOfGoal: number;
    donorCount: number;
    priorYearComparison: number;
  };
  givingLevels: GivingLevel[];
  highlights: Highlight[];
  kpis: {
    overallBoardParticipation: number;
    campaignPctOfGoal: number;
    totalBoardGiving: number;
    yoyChange: number;
  };
}

const fmtUSD = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });

// ── Status Badge ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    gave:          { color: SUCCESS, label: 'Gave',        icon: <CheckCircleOutlined /> },
    lybunt:        { color: WARNING, label: 'LYBUNT',      icon: <ClockCircleOutlined /> },
    'no-record':   { color: ERROR,   label: 'No Record',   icon: <CloseCircleOutlined /> },
    'not-matched': { color: MUTED,   label: 'Not Matched', icon: <QuestionCircleOutlined /> },
  };
  const c = config[status] || config['not-matched'];
  return <Tag color={c.color} icon={c.icon}>{c.label}</Tag>;
}

// ── Participation Bar ──────────────────────────────────────────────────
function ParticipationBar({ pct, size = 100 }: { pct: number; size?: number }) {
  const safePct = isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100);
  const remaining = 100 - safePct;
  const color = safePct >= 50 ? SUCCESS : safePct >= 25 ? WARNING : ERROR;
  
  const plotData = [{
    type: 'bar' as const,
    orientation: 'h' as const,
    x: [safePct, remaining],
    y: ['Participation'],
    marker: {
      color: [color, '#E8E8ED'],
    },
    text: [safePct > 10 ? `${Math.round(safePct)}%` : '', remaining > 10 ? `${Math.round(remaining)}%` : ''],
    textposition: 'inside' as const,
    textfont: { color: 'white', size: 12, family: 'system-ui' },
    hovertemplate: '<b>%{text}</b><extra></extra>',
    showlegend: false,
  }];

  const layout = {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    xaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
      zeroline: false,
      range: [0, 100],
    },
    yaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
    },
    height: size,
    barmode: 'stack' as const,
  };

  return (
    <div style={{ width: size, height: size }}>
      <Plot
        data={plotData}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
      />
      <div style={{ textAlign: 'center', marginTop: '-20px', fontSize: '14px', fontWeight: 700, color: NAVY }}>
        {Math.round(safePct)}%
      </div>
    </div>
  );
}

// ── Campaign Progress Bar ──────────────────────────────────────────────
function CampaignProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const safeRaised = isNaN(raised) ? 0 : raised;
  const safeGoal = isNaN(goal) ? 0 : goal;
  const pct = safeGoal > 0 ? Math.min((safeRaised / safeGoal) * 100, 100) : 0;
  const remaining = Math.max(safeGoal - safeRaised, 0);

  const plotData = [{
    type: 'bar' as const,
    orientation: 'h' as const,
    x: [safeRaised, remaining],
    y: ['Campaign Goal'],
    marker: {
      color: [GOLD, '#E8E8ED'],
    },
    text: [pct > 15 ? fmtUSD(safeRaised) : '', ''],
    textposition: 'inside' as const,
    textfont: { color: 'white', size: 13, family: 'system-ui' },
    hovertemplate: '<b>Raised:</b> %{x:$,.0f}<extra></extra>',
    showlegend: false,
  }];

  const layout = {
    margin: { l: 80, r: 80, t: 10, b: 30 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    xaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
      zeroline: false,
      range: [0, safeGoal],
    },
    yaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
    },
    height: 80,
    barmode: 'stack' as const,
    annotations: [
      {
        x: safeGoal,
        y: 'Campaign Goal',
        text: `Goal: ${fmtUSD(safeGoal)}`,
        showarrow: false,
        xanchor: 'left' as const,
        yanchor: 'middle' as const,
        font: { size: 11, color: MUTED },
        xshift: 10,
      },
    ],
  };

  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <Plot
        data={plotData}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
      />
      <Text type="secondary" style={{ fontSize: 13, marginTop: '-10px', display: 'block' }}>
        {safePercent(pct, { decimals: 1 })} of goal
      </Text>
    </div>
  );
}

// ── Trend Arrow ─────────────────────────────────────────────────────────
function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'up') return <RiseOutlined style={{ color: SUCCESS, fontSize: 18 }} />;
  if (trend === 'down') return <FallOutlined style={{ color: ERROR, fontSize: 18 }} />;
  return <span style={{ color: MUTED, fontSize: 14 }}>—</span>;
}

// ── Giving Level Bars ───────────────────────────────────────────────────
function GivingLevelBars({ levels }: { levels: GivingLevel[] }) {
  const maxAmt = Math.max(...levels.map(l => l.amount), 1);
  return (
    <div>
      {levels.filter(l => l.donors > 0 || l.amount > 0).map((l, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 13 }}>{l.level}</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {l.donors} donor{l.donors !== 1 ? 's' : ''} · {fmtUSD(l.amount)}
            </Text>
          </div>
          <div style={{ background: '#E8E8ED', borderRadius: 4, height: 12, overflow: 'hidden' }}>
            <div style={{
              width: `${(l.amount / maxAmt) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${NAVY}, ${GOLD})`,
              borderRadius: 4,
              transition: 'width 0.8s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Board Card ──────────────────────────────────────────────────────────
function BoardCard({ board }: { board: Board }) {
  const lybunt = board.members.filter(m => m.status === 'lybunt').length;
  const noRecord = board.members.filter(m => m.status === 'no-record').length;
  const notMatched = board.members.filter(m => m.status === 'not-matched').length;

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (name: string, r: BoardMember) => (
        <span>
          <Text strong>{name}</Text>
          {r.role && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{r.role}</Text>}
        </span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (s: string) => <StatusBadge status={s} />,
      sorter: (a: BoardMember, b: BoardMember) => {
        const order = { gave: 0, lybunt: 1, 'no-record': 2, 'not-matched': 3 };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
      },
    },
    {
      title: 'FY26', dataIndex: 'fy26Amount', key: 'fy26', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text strong style={{ color: SUCCESS }}>{fmtUSD(v)}</Text> : <Text type="secondary">—</Text>,
      sorter: (a: BoardMember, b: BoardMember) => a.fy26Amount - b.fy26Amount,
    },
    {
      title: 'FY25', dataIndex: 'fy25Amount', key: 'fy25', width: 110, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="secondary">{fmtUSD(v)}</Text> : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <Card
      style={{ borderRadius: 12, marginBottom: 16 }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Row gutter={24} align="middle">
          <Col>
            <ParticipationBar pct={board.participationRate} size={80} />
          </Col>
          <Col flex="auto">
            <Title level={5} style={{ margin: 0, color: NAVY }}>{board.name}</Title>
            <Space size={16} style={{ marginTop: 8 }}>
              <Text type="secondary">{board.totalMembers} members</Text>
              <Text type="secondary">{board.matchedInSF} in SF</Text>
              <Text style={{ color: SUCCESS }}><CheckCircleOutlined /> {board.gaveFY26} gave</Text>
              {lybunt > 0 && <Text style={{ color: WARNING }}><ClockCircleOutlined /> {lybunt} LYBUNT</Text>}
              <Text style={{ color: ERROR }}><CloseCircleOutlined /> {noRecord} no record</Text>
              {notMatched > 0 && <Text style={{ color: MUTED }}><QuestionCircleOutlined /> {notMatched} unmatched</Text>}
            </Space>
          </Col>
          <Col>
            <Statistic
              title="Board Giving"
              value={board.totalGiven}
              prefix="$"
              valueStyle={{ color: NAVY, fontSize: 20 }}
              groupSeparator=","
            />
          </Col>
        </Row>
      </div>
      <Collapse ghost expandIconPosition="end" items={[{
        key: '1',
        label: <Text type="secondary" style={{ fontSize: 13 }}>View {board.members.length} members</Text>,
        children: (
          <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 8px 8px' }}>
            <CsvExport data={board.members} columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Role', dataIndex: 'role' },
              { title: 'Status', dataIndex: 'status' },
              { title: 'FY26', dataIndex: 'fy26Amount' },
              { title: 'FY25', dataIndex: 'fy25Amount' },
            ]} filename={`board-${board.name.replace(/\s+/g, '-').toLowerCase()}`} />
          </div>
          <Table
            dataSource={board.members}
            columns={columns}
            rowKey="name"
            pagination={false}
            size="small"
            style={{ margin: '0 8px 8px' }}
          />
          </>
        ),
      }]} />
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function BoardReportingDashboard() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJson<BoardData>(`${import.meta.env.BASE_URL}data/board-reporting.json`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch(`${import.meta.env.BASE_URL}data/board-reporting.json`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) return (
    <Alert type="error" message="Failed to load board reporting data" description={error} showIcon
      style={{ margin: 24 }} />
  );

  const kpis = data.kpis ?? { overallBoardParticipation: 0, campaignPctOfGoal: 0, totalBoardGiving: 0, yoyChange: 0 };
  const campaignSummary = data.campaignSummary ?? { goal: 0, raised: 0, pctOfGoal: 0, donorCount: 0, priorYearComparison: 0 };
  const boards = data.boards ?? [];
  const givingLevels = data.givingLevels ?? [];
  const highlights = data.highlights ?? [];

  return (
    <div ref={contentRef} style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', background: BG_LIGHT, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ color: NAVY, margin: 0 }}>Board Reporting</Title>
        </div>
        <PdfExport filename="board-reporting" targetRef={contentRef} />
      </div>
      <DataFreshness asOfDate={data.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderTop: `3px solid ${GOLD}` }}>
            <Statistic
              title={<Text type="secondary"><TrophyOutlined /> Campaign Progress</Text>}
              value={safePercent(campaignSummary.pctOfGoal, { decimals: 0 })}
              valueStyle={{ color: NAVY, fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {fmtUSD(campaignSummary.raised)} of {fmtUSD(campaignSummary.goal)}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderTop: `3px solid ${NAVY}` }}>
            <Statistic
              title={<Text type="secondary"><TeamOutlined /> <DefinitionTooltip term="Board Participation" dashboardKey="board">Board Participation</DefinitionTooltip></Text>}
              value={safePercent(kpis.overallBoardParticipation, { decimals: 0 })}
              valueStyle={{ color: kpis.overallBoardParticipation >= 50 ? SUCCESS : WARNING, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderTop: `3px solid ${SUCCESS}` }}>
            <Statistic
              title={<Text type="secondary"><DollarOutlined /> <DefinitionTooltip term="Recognition" dashboardKey="board">Total Board Giving</DefinitionTooltip></Text>}
              value={kpis.totalBoardGiving}
              prefix="$"
              valueStyle={{ color: NAVY, fontWeight: 700 }}
              groupSeparator=","
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderRadius: 12, borderTop: `3px solid ${kpis.yoyChange >= 0 ? SUCCESS : ERROR}` }}>
            <Statistic
              title={<Text type="secondary">{kpis.yoyChange >= 0 ? <RiseOutlined /> : <FallOutlined />} YoY Change</Text>}
              value={safePercent(kpis.yoyChange, { decimals: 0, showSign: true })}
              valueStyle={{ color: kpis.yoyChange >= 0 ? SUCCESS : ERROR, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Campaign Thermometer */}
      <Card title={<Text strong style={{ color: NAVY }}>
        Annual Campaign: {safePercent(campaignSummary.pctOfGoal)} to goal — {fmtUSD(campaignSummary.raised)} raised
      </Text>}
        style={{ borderRadius: 12, marginBottom: 32 }}>
        <CampaignProgressBar raised={campaignSummary.raised} goal={campaignSummary.goal} />
        <Row gutter={24} justify="center" style={{ marginTop: 8 }}>
          <Col><Statistic title="Donors" value={safeCount(campaignSummary.donorCount)} valueStyle={{ fontSize: 16 }} /></Col>
          <Col><Statistic title="vs Prior Year" value={safePercent(campaignSummary.priorYearComparison, { decimals: 0, showSign: true })} valueStyle={{ fontSize: 16, color: campaignSummary.priorYearComparison >= 0 ? SUCCESS : ERROR }} /></Col>
        </Row>
      </Card>

      {/* Board Participation Cards */}
      <Title level={4} style={{ color: NAVY, marginBottom: 16 }}>
        Board Participation: {safePercent(kpis.overallBoardParticipation)} overall — {boards.length} boards tracked
      </Title>
      {boards.map(b => <BoardCard key={b.shortName} board={b} />)}

      {/* Bottom row: Giving Levels + Highlights */}
      <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={<Text strong style={{ color: NAVY }}>
            Giving Levels: {givingLevels.reduce((sum, level) => sum + level.donors, 0)} total donors across {givingLevels.length} levels
          </Text>}
            style={{ borderRadius: 12 }}>
            <GivingLevelBars levels={givingLevels} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Text strong style={{ color: NAVY }}>
            Key Insights: {highlights.length} metrics to watch
          </Text>}
            style={{ borderRadius: 12 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {highlights.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < highlights.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{h.metric}</Text>
                    <Text strong style={{ fontSize: 18, color: NAVY }}>{h.value}</Text>
                  </div>
                  <TrendArrow trend={h.trend} />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 40, paddingBottom: 24 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Data refreshed {data.asOfDate} · Board Reporting Dashboard · Jewish Federation of San Diego
        </Text>
      </div>
    </div>
  );
}
