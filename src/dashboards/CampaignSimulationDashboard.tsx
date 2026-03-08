import { Card, Col, Row, Statistic, Typography, Space, Tag, Collapse, Alert, Tabs } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useEffect, useState } from 'react';
import { ArrowDownOutlined, ExclamationCircleOutlined, AimOutlined } from '@ant-design/icons';
import Plot from "react-plotly.js";

import { DataFreshness } from '../components/DataFreshness';
import { NAVY, GOLD, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency } from '../utils/formatters';

const { Title, Text, Paragraph } = Typography;

interface Scenario {
  label: string; description: string; projected: number;
  vsGoal: number; vsGoalPct: number;
  [key: string]: unknown;
}

interface FYBlock {
  goal: number;
  scenarios: Record<string, Scenario>;
  knownAdjustments: Array<{ donor: string; description: string; impact: number; [k: string]: unknown }>;
  chart: Record<string, unknown>;
  ytd?: number;
  ytdPctOfGoal?: number;
  baseline?: number;
  baselineNote?: string;
}

interface SimData {
  generatedAt: string;
  recognition: { FY24: number; FY25: number; FY26_YTD: number };
  fy26: FYBlock;
  fy27: FYBlock;
  variables: Array<{ name: string; value: string; note: string }>;
  skepticsNotes: string[];
}

const SCENARIO_COLORS: Record<string, string> = { low: ERROR, medium: GOLD, high: SUCCESS };

function ScenarioCards({ scenarios, goal }: { scenarios: Record<string, Scenario>; goal: number }) {
  return (
    <Row gutter={[16, 16]}>
      {(['low', 'medium', 'high'] as const).map(key => {
        const s = scenarios[key];
        if (!s) return null;
        const color = SCENARIO_COLORS[key];
        return (
          <Col xs={24} md={8} key={key}>
            <Card style={{ borderTop: `4px solid ${color}` }}>
              <Tag color={color} style={{ marginBottom: 8, fontWeight: 700 }}>{s.label.toUpperCase()}</Tag>
              <Statistic
                value={s.projected}
                prefix="$"
                valueStyle={{ fontSize: 28, fontWeight: 700, color }}
                formatter={(v) => Number(v).toLocaleString()}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <ArrowDownOutlined /> {safeCurrency(Math.abs(s.vsGoal), { maximumFractionDigits: 0 })} {s.vsGoal >= 0 ? 'above' : 'below'} ${(goal / 1e6).toFixed(1)}M goal ({s.vsGoalPct > 0 ? '+' : ''}{s.vsGoalPct}%)
                </Text>
              </div>
              <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>{s.description}</Paragraph>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

function CumulativeChart({ chart, title, isFY27 }: { chart: Record<string, unknown>; title: string; isFY27?: boolean }) {
  const months = chart.months as string[];
  const goalLine = chart.goalLine as number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];

  if (!isFY27) {
    // FY26 chart
    traces.push(
      { x: months, y: chart.fy24Cumulative as number[], type: 'scatter', mode: 'lines', name: 'FY24', line: { color: MUTED, width: 1, dash: 'dot' } },
      { x: months, y: chart.fy25Cumulative as number[], type: 'scatter', mode: 'lines', name: 'FY25', line: { color: MUTED, width: 2, dash: 'dash' } },
      { x: chart.fy26ActualMonths as string[], y: chart.fy26ActualCumulative as number[], type: 'scatter', mode: 'lines+markers', name: 'FY26 Actual', line: { color: NAVY, width: 3 }, marker: { size: 6 } },
      { x: months, y: chart.fy26LowCumulative as number[], type: 'scatter', mode: 'lines', name: 'LOW', line: { color: ERROR, width: 2, dash: 'dash' } },
      { x: months, y: chart.fy26MedCumulative as number[], type: 'scatter', mode: 'lines', name: 'BASE', line: { color: GOLD, width: 2, dash: 'dash' } },
      { x: months, y: chart.fy26HighCumulative as number[], type: 'scatter', mode: 'lines', name: 'HIGH', line: { color: SUCCESS, width: 2, dash: 'dash' } },
    );
  } else {
    // FY27 chart
    traces.push(
      { x: months, y: chart.fy25Cumulative as number[], type: 'scatter', mode: 'lines', name: 'FY25 Actual', line: { color: MUTED, width: 2, dash: 'dash' } },
      { x: months, y: chart.fy26MedCumulative as number[], type: 'scatter', mode: 'lines', name: 'FY26 (Base)', line: { color: NAVY, width: 2, dash: 'dot' } },
      { x: months, y: chart.fy27LowCumulative as number[], type: 'scatter', mode: 'lines', name: 'FY27 LOW', line: { color: ERROR, width: 2, dash: 'dash' } },
      { x: months, y: chart.fy27MedCumulative as number[], type: 'scatter', mode: 'lines', name: 'FY27 BASE', line: { color: GOLD, width: 2, dash: 'dash' } },
      { x: months, y: chart.fy27HighCumulative as number[], type: 'scatter', mode: 'lines', name: 'FY27 HIGH', line: { color: SUCCESS, width: 2, dash: 'dash' } },
    );
  }

  return (
    <Card title={<span style={{ color: NAVY }}>{title}</span>}>
      <Plot
        data={traces}
        layout={{
          height: 380,
          margin: { l: 60, r: 30, t: 10, b: 40 },
          xaxis: { tickfont: { size: 11 } },
          yaxis: { tickprefix: '$', separatethousands: true, tickfont: { size: 10 } },
          shapes: [{
            type: 'line', xref: 'paper', x0: 0, x1: 1,
            yref: 'y', y0: goalLine, y1: goalLine,
            line: { color: ERROR, width: 2, dash: 'dot' },
          }],
          annotations: [{
            xref: 'paper', x: 1, yref: 'y', y: goalLine,
            text: `$${(goalLine / 1e6).toFixed(1)}M Goal`, showarrow: false,
            font: { size: 11, color: ERROR }, xanchor: 'left', xshift: 4,
          }],
          legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
          plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
          hovermode: 'x unified',
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
    </Card>
  );
}

export function CampaignSimulationDashboard() {
  const [data, setData] = useState<SimData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<SimData>(`${import.meta.env.BASE_URL}data/campaign-simulation.json`);
        setData(json);
      } catch { setData(null); }
      finally { setLoading(false); }
    };
    void load();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <Alert type="info" message="Campaign simulation data not yet generated" />;

  const { fy26, fy27 } = data;

  const tabItems = [
    {
      key: 'fy26',
      label: <span><strong>FY26</strong> <Tag color={fy26.ytdPctOfGoal && fy26.ytdPctOfGoal >= 85 ? SUCCESS : GOLD} style={{ marginLeft: 4, fontSize: 10 }}>{fy26.ytdPctOfGoal}%</Tag></span>,
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* YTD Banner */}
          <div style={{ background: '#F0F5FF', padding: '16px 24px', borderRadius: 8, borderLeft: `4px solid ${NAVY}` }}>
            <Row gutter={24} align="middle">
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>FY26 YTD Recognition</Text>
                <div style={{ fontSize: 32, fontWeight: 700, color: NAVY }}>{safeCurrency(fy26.ytd ?? 0, { maximumFractionDigits: 0 })}</div>
              </Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>of ${(fy26.goal / 1e6).toFixed(0)}M Goal</Text>
                <div style={{ fontSize: 32, fontWeight: 700, color: fy26.ytdPctOfGoal && fy26.ytdPctOfGoal >= 85 ? SUCCESS : GOLD }}>{fy26.ytdPctOfGoal}%</div>
              </Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Remaining</Text>
                <div style={{ fontSize: 24, fontWeight: 600, color: MUTED }}>{safeCurrency(fy26.goal - (fy26.ytd ?? 0), { maximumFractionDigits: 0 })}</div>
              </Col>
            </Row>
          </div>
          <ScenarioCards scenarios={fy26.scenarios} goal={fy26.goal} />
          <CumulativeChart chart={fy26.chart as Record<string, unknown>} title="FY26 Cumulative: Actual + Projections vs FY24/FY25" />
          {/* Known Adjustments */}
          <Card title={<span style={{ color: NAVY }}><ExclamationCircleOutlined /> Known Intelligence</span>}>
            {fy26.knownAdjustments.map((adj, i) => (
              <div key={i} style={{ padding: '12px 16px', background: '#FFF7ED', borderRadius: 8, marginBottom: 8, borderLeft: `4px solid ${ERROR}` }}>
                <Text strong>{adj.donor}</Text>
                <Tag color={ERROR} style={{ marginLeft: 8 }}>{safeCurrency(Math.abs(adj.impact), { maximumFractionDigits: 0 })}</Tag>
                <br /><Text type="secondary">{adj.description}</Text>
              </div>
            ))}
          </Card>
        </Space>
      ),
    },
    {
      key: 'fy27',
      label: <span><strong>FY27</strong> <Tag color={MUTED} style={{ marginLeft: 4, fontSize: 10 }}>Projected</Tag></span>,
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Baseline Banner */}
          <div style={{ background: '#FFF7ED', padding: '16px 24px', borderRadius: 8, borderLeft: `4px solid ${GOLD}` }}>
            <Row gutter={24} align="middle">
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>FY27 Baseline (from FY26 Base Case)</Text>
                <div style={{ fontSize: 32, fontWeight: 700, color: GOLD }}>{safeCurrency(fy27.baseline ?? 0, { maximumFractionDigits: 0 })}</div>
              </Col>
              <Col>
                <Text type="secondary" style={{ fontSize: 12 }}>Goal</Text>
                <div style={{ fontSize: 32, fontWeight: 700, color: NAVY }}>{safeCurrency(fy27.goal, { maximumFractionDigits: 0 })}</div>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 11 }}>{fy27.baselineNote}</Text>
          </div>
          <ScenarioCards scenarios={fy27.scenarios} goal={fy27.goal} />
          <CumulativeChart chart={fy27.chart as Record<string, unknown>} title="FY27 Cumulative Projection vs FY25/FY26" isFY27 />
          {/* Known Adjustments */}
          <Card title={<span style={{ color: NAVY }}><ExclamationCircleOutlined /> Known Intelligence</span>}>
            {fy27.knownAdjustments.map((adj, i) => (
              <div key={i} style={{ padding: '12px 16px', background: '#FFF7ED', borderRadius: 8, marginBottom: 8, borderLeft: `4px solid ${GOLD}` }}>
                <Text strong>{adj.donor}</Text>
                <Tag color={GOLD} style={{ marginLeft: 8 }}>{safeCurrency(Math.abs(adj.impact), { maximumFractionDigits: 0 })}</Tag>
                <br /><Text type="secondary">{adj.description}</Text>
              </div>
            ))}
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.generatedAt} />

      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a1a5c 100%)`, padding: '24px 32px', borderRadius: 8, color: '#fff' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>Campaign Simulation</Title>
        <Text style={{ color: '#ffffffcc' }}>
          Recognition-based scenario modeling · FY26 (active) + FY27 (projected)
        </Text>
      </div>

      <Tabs items={tabItems} size="large" />

      {/* Shared: Variables */}
      <Card title={<span style={{ color: NAVY }}><AimOutlined /> Simulation Variables</span>}>
        <Row gutter={[12, 12]}>
          {data.variables.map((v, i) => (
            <Col xs={24} sm={12} md={8} key={i}>
              <div style={{ background: '#F5F5F5', padding: '10px 14px', borderRadius: 8, height: '100%' }}>
                <Text strong style={{ fontSize: 12, color: NAVY }}>{v.name}</Text>
                <div style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: '4px 0' }}>{v.value}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>{v.note}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Skeptic's Notes */}
      <Collapse ghost items={[{
        key: 'skeptic',
        label: <Text strong style={{ color: ERROR }}>Skeptic's Notes — What Could Change These Numbers?</Text>,
        children: (
          <Space direction="vertical" size="small">
            {data.skepticsNotes.map((note, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Text style={{ color: ERROR, fontSize: 14, marginTop: 2 }}>⚠</Text>
                <Text>{note}</Text>
              </div>
            ))}
          </Space>
        ),
      }]} />
    </Space>
  );
}

export default CampaignSimulationDashboard;
