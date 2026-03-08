import { Card, Col, Row, Statistic, Typography, Space, Tag, Collapse, Alert } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useEffect, useState } from 'react';
import { ArrowUpOutlined, ArrowDownOutlined, ExclamationCircleOutlined, AimOutlined } from '@ant-design/icons';
import Plot from "react-plotly.js";

import { DataFreshness } from '../components/DataFreshness';
import { NAVY, GOLD, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency } from '../utils/formatters';

const { Title, Text, Paragraph } = Typography;

interface SimData {
  generatedAt: string;
  campaignGoal: number;
  recognition: { FY24: number; FY25: number; FY26_YTD: number };
  scenarios: Record<string, {
    label: string; description: string; projected: number;
    vsGoal: number; vsGoalPct: number; vsFY25: number; vsFY25Pct: number; h2Growth: string;
  }>;
  knownAdjustments: Array<{ donor: string; description: string; fy25_amount: number; fy26_expected: number; impact: number }>;
  variables: Array<{ name: string; value: string; note: string }>;
  skepticsNotes: string[];
  chart: {
    months: string[];
    fy24Cumulative: number[];
    fy25Cumulative: number[];
    fy26ActualMonths: string[];
    fy26ActualCumulative: number[];
    fy26LowCumulative: number[];
    fy26MedCumulative: number[];
    fy26HighCumulative: number[];
    goalLine: number;
  };
}

const SCENARIO_COLORS = { low: ERROR, medium: GOLD, high: SUCCESS };

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

  const { scenarios, chart, recognition } = data;
  const low = scenarios.low;
  const med = scenarios.medium;
  const high = scenarios.high;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.generatedAt} />

      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a1a5c 100%)`, padding: '24px 32px', borderRadius: 8, color: '#fff' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          FY26 Campaign Simulation
        </Title>
        <Text style={{ color: '#ffffffcc' }}>
          Recognition-based projection · 3 scenarios · {data.knownAdjustments.length} known adjustment{data.knownAdjustments.length !== 1 ? 's' : ''}
        </Text>
      </div>

      {/* Scenario Cards */}
      <Row gutter={[16, 16]}>
        {(['low', 'medium', 'high'] as const).map(key => {
          const s = scenarios[key];
          const color = SCENARIO_COLORS[key];
          const icon = s.vsGoal >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
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
                    {icon} {safeCurrency(Math.abs(s.vsGoal), { maximumFractionDigits: 0 })} {s.vsGoal >= 0 ? 'above' : 'below'} $9M goal ({s.vsGoalPct > 0 ? '+' : ''}{s.vsGoalPct}%)
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    vs FY25: {safeCurrency(Math.abs(s.vsFY25), { maximumFractionDigits: 0 })} {s.vsFY25 >= 0 ? 'above' : 'below'} ({s.vsFY25Pct > 0 ? '+' : ''}{s.vsFY25Pct}%)
                  </Text>
                </div>
                <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>{s.description}</Paragraph>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Cumulative Chart */}
      <Card title={<span style={{ color: NAVY }}>Cumulative Recognition: FY24 vs FY25 vs FY26 Scenarios</span>}>
        <Plot
          data={[
            // FY24 reference
            { x: chart.months, y: chart.fy24Cumulative, type: 'scatter', mode: 'lines', name: `FY24 (${safeCurrency(recognition.FY24, { maximumFractionDigits: 0 })})`, line: { color: MUTED, width: 1, dash: 'dot' } },
            // FY25 reference
            { x: chart.months, y: chart.fy25Cumulative, type: 'scatter', mode: 'lines', name: `FY25 (${safeCurrency(recognition.FY25, { maximumFractionDigits: 0 })})`, line: { color: MUTED, width: 2, dash: 'dash' } },
            // FY26 actual
            { x: chart.fy26ActualMonths, y: chart.fy26ActualCumulative, type: 'scatter', mode: 'lines+markers', name: 'FY26 Actual', line: { color: NAVY, width: 3 }, marker: { size: 6 } },
            // Scenarios (from actual endpoint forward)
            { x: chart.months, y: chart.fy26LowCumulative, type: 'scatter', mode: 'lines', name: `LOW: ${safeCurrency(low.projected, { maximumFractionDigits: 0 })}`, line: { color: ERROR, width: 2, dash: 'dash' }, },
            { x: chart.months, y: chart.fy26MedCumulative, type: 'scatter', mode: 'lines', name: `BASE: ${safeCurrency(med.projected, { maximumFractionDigits: 0 })}`, line: { color: GOLD, width: 2, dash: 'dash' }, },
            { x: chart.months, y: chart.fy26HighCumulative, type: 'scatter', mode: 'lines', name: `HIGH: ${safeCurrency(high.projected, { maximumFractionDigits: 0 })}`, line: { color: SUCCESS, width: 2, dash: 'dash' }, },
          ]}
          layout={{
            height: 400,
            margin: { l: 60, r: 20, t: 10, b: 40 },
            xaxis: { tickfont: { size: 11 } },
            yaxis: { tickprefix: '$', separatethousands: true, tickfont: { size: 10 } },
            shapes: [{
              type: 'line', xref: 'paper', x0: 0, x1: 1,
              yref: 'y', y0: chart.goalLine, y1: chart.goalLine,
              line: { color: ERROR, width: 2, dash: 'dot' },
            }],
            annotations: [{
              xref: 'paper', x: 1, yref: 'y', y: chart.goalLine,
              text: '$9M Goal', showarrow: false,
              font: { size: 11, color: ERROR, family: 'bold' },
              xanchor: 'left', xshift: 4,
            }],
            legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            hovermode: 'x unified',
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%' }}
        />
      </Card>

      {/* Known Adjustments */}
      <Card title={<span style={{ color: NAVY }}><ExclamationCircleOutlined /> Known Intelligence Adjustments</span>}>
        {data.knownAdjustments.map((adj, i) => (
          <div key={i} style={{ padding: '12px 16px', background: '#FFF7ED', borderRadius: 8, marginBottom: 8, borderLeft: `4px solid ${ERROR}` }}>
            <Text strong>{adj.donor}</Text>
            <Tag color={ERROR} style={{ marginLeft: 8 }}>{safeCurrency(Math.abs(adj.impact), { maximumFractionDigits: 0 })}</Tag>
            <br />
            <Text type="secondary">{adj.description}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>FY25: {safeCurrency(adj.fy25_amount)} → FY26 expected: {safeCurrency(adj.fy26_expected)}</Text>
          </div>
        ))}
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          Add donor-specific intelligence here as it becomes known. Each adjustment is applied to all three scenarios.
        </Text>
      </Card>

      {/* Variables */}
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
