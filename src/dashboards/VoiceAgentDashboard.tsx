import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Tabs } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safePercent, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, MUTED, OPERATIONS } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";

const { Title, Text } = Typography;

interface VoiceAgent {
  name?: string;
  phone?: string;
  purpose?: string;
}

interface VoiceCall {
  id?: string;
  agent?: string;
  timestamp?: string;
  durationSec?: number;
  completed?: boolean;
}

interface VoiceAgentData {
  asOfDate?: string;
  agents?: VoiceAgent[];
  calls?: VoiceCall[];
}

const DEFAULT_AGENTS: VoiceAgent[] = [
  { name: "Dalia", phone: "—", purpose: "Donor follow-up" },
  { name: "Mira", phone: "—", purpose: "Stewardship check-ins" },
  { name: "Hala", phone: "—", purpose: "Prospect qualification" },
  { name: "Scout", phone: "—", purpose: "Event reminders" },
  { name: "H2", phone: "—", purpose: "Payment outreach" },
];

function toDateKey(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toWeekKey(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shift);
  return date.toISOString().slice(0, 10);
}

export function VoiceAgentDashboard() {
  const [data, setData] = useState<VoiceAgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<VoiceAgentData>(`${import.meta.env.BASE_URL}data/voice-agent.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load voice agent data"))
      .finally(() => setLoading(false));
  }, []);

  const agents = useMemo(() => {
    const loaded = Array.isArray(data?.agents) && data?.agents.length > 0 ? data?.agents : DEFAULT_AGENTS;
    return loaded.map((agent) => ({
      name: agent?.name ?? "Unknown",
      phone: agent?.phone ?? "—",
      purpose: agent?.purpose ?? "—",
    }));
  }, [data]);

  const calls = useMemo(() => (Array.isArray(data?.calls) ? data?.calls : []), [data]);

  const byAgent = useMemo(() => {
    return agents.map((agent) => {
      const rows = calls.filter((call) => (call?.agent ?? "") === (agent?.name ?? ""));
      const lastActive = rows
        .map((call) => call?.timestamp ?? "")
        .filter((value) => value)
        .sort()
        .at(-1);
      return {
        key: agent?.name ?? "agent",
        name: agent?.name ?? "Unknown",
        phone: agent?.phone ?? "—",
        purpose: agent?.purpose ?? "—",
        callCount: rows.length,
        lastActive: lastActive ? new Date(lastActive).toLocaleString() : "—",
      };
    });
  }, [agents, calls]);

  const kpis = useMemo(() => {
    const totalCalls = calls.length;
    const avgDuration = totalCalls > 0 ? calls.reduce((sum, c) => sum + (c?.durationSec ?? 0), 0) / totalCalls : 0;
    const completed = calls.filter((c) => c?.completed === true).length;
    const completionRate = totalCalls > 0 ? (completed / totalCalls) * 100 : 0;
    return { totalCalls, avgDuration, completionRate };
  }, [calls]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, number>();
    calls.forEach((call) => {
      const key = toDateKey(call?.timestamp);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calls]);

  const weeklySeries = useMemo(() => {
    const map = new Map<string, number>();
    calls.forEach((call) => {
      const key = toWeekKey(call?.timestamp);
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calls]);

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load voice agent data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={OPERATIONS}>Operations</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Voice Agent Dashboard
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>Operational call volume and completion tracking for the five voice agents.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Total Calls" value={safeCount(kpis?.totalCalls ?? 0)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Avg Duration (sec)"
              value={safeNumber(kpis?.avgDuration ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Completion Rate"
              value={safePercent(kpis?.completionRate ?? 0, { decimals: 1 })}
              valueStyle={{ color: SUCCESS }}
            />
            <Text style={{ color: MUTED }}>
              Completed calls: {safeCount(calls.filter((call) => call?.completed).length)} / {safeCount(calls.length)}
            </Text>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Calls Over Time
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Tabs
          items={[
            {
              key: "daily",
              label: "Daily",
              children: (
                <Plot
                  data={[
                    {
                      type: "scatter",
                      mode: "lines+markers",
                      x: dailySeries.map(([x]) => x),
                      y: dailySeries.map(([, y]) => y),
                      line: { color: PLOTLY_COLORS[0], width: 2 },
                    },
                  ]}
                  layout={{
                    ...PLOTLY_BASE_LAYOUT,
                    height: 300,
                    yaxis: { title: "Calls" },
                    xaxis: { title: "Date" },
                  }}
                  style={{ width: "100%" }}
                  config={{ displayModeBar: false }}
                />
              ),
            },
            {
              key: "weekly",
              label: "Weekly",
              children: (
                <Plot
                  data={[
                    {
                      type: "bar",
                      x: weeklySeries.map(([x]) => x),
                      y: weeklySeries.map(([, y]) => y),
                      marker: { color: PLOTLY_COLORS[1] },
                    },
                  ]}
                  layout={{
                    ...PLOTLY_BASE_LAYOUT,
                    height: 300,
                    yaxis: { title: "Calls" },
                    xaxis: { title: "Week of" },
                  }}
                  style={{ width: "100%" }}
                  config={{ displayModeBar: false }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Agent Details
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table
          dataSource={byAgent}
          pagination={false}
          size="small"
          scroll={{ x: 650 }}
          columns={[
            { title: "Agent", dataIndex: "name", key: "name" },
            { title: "Phone", dataIndex: "phone", key: "phone", render: (value: string) => value || "—" },
            { title: "Purpose", dataIndex: "purpose", key: "purpose", ellipsis: true },
            { title: "Call Count", dataIndex: "callCount", key: "callCount", render: (v: number) => safeCount(v ?? 0) },
            { title: "Last Active", dataIndex: "lastActive", key: "lastActive" },
            {
              title: "Call Share",
              key: "share",
              render: (_: unknown, row: { callCount: number }) =>
                safePercent(calls.length > 0 ? (row.callCount / calls.length) * 100 : 0, { decimals: 1 }),
            },
          ]}
        />
      </Card>

      <DataFreshness asOfDate={data?.asOfDate ?? ""} />
    </Space>
  );
}
