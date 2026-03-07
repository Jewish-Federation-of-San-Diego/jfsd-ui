import { Card, Col, Row, Statistic, Table, Typography, Space, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safeCurrency, safePercent, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED, DEVELOPMENT } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";
import { calculateSowPercent, parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse } from "../utils/donorAnalytics";

const { Title, Text } = Typography;

interface UnaskedDonor {
  id?: string;
  ownerId?: string;
}

interface UnaskedResponse {
  generated?: string;
  donors?: UnaskedDonor[];
}

interface OpportunityRow {
  key: string;
  name: string;
  drm: string;
  fy26Recognition: number;
  annualCapacity: number;
  sowPercent: number;
  capacityGap: number;
  segment: "Big Upside" | "Upgrade" | "Engaged" | "Champion";
}

function classifySowBand(sowPercent: number): OpportunityRow["segment"] {
  if (sowPercent < 5) return "Big Upside";
  if (sowPercent < 15) return "Upgrade";
  if (sowPercent < 40) return "Engaged";
  return "Champion";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function ShareOfWalletDashboard() {
  const [donorData, setDonorData] = useState<DonorDataResponse | null>(null);
  const [unaskedData, setUnaskedData] = useState<UnaskedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<DonorDataResponse>(`${import.meta.env.BASE_URL}data/donor_data.json`),
      fetchJson<UnaskedResponse>(`${import.meta.env.BASE_URL}data/unasked.json`),
    ])
      .then(([donorPayload, unaskedPayload]) => {
        setDonorData(donorPayload);
        setUnaskedData(unaskedPayload);
      })
      .catch((err) => setError((err as Error)?.message ?? "Unable to load share of wallet data"))
      .finally(() => setLoading(false));
  }, []);

  const opportunities = useMemo<OpportunityRow[]>(() => {
    const donors = parseDonorRecords(donorData);
    const drmById = new Map<string, string>();
    (unaskedData?.donors ?? []).forEach((row) => {
      const id = row?.id ?? "";
      if (id) drmById.set(id, row?.ownerId ?? "Unassigned");
    });

    return donors
      .filter((donor) => (donor?.annualCapacity ?? 0) > 0)
      .map((donor, index) => {
        const fy26Recognition = donor?.fy26 ?? 0;
        const annualCapacity = donor?.annualCapacity ?? 0;
        const sowPercent = calculateSowPercent(fy26Recognition, donor?.fiveYearCapacity ?? 0);
        const capacityGap = Math.max(annualCapacity - fy26Recognition, 0);
        return {
          key: donor?.id || `sow-row-${index}`,
          name: donor?.name ?? "Unknown Donor",
          drm: drmById.get(donor?.id ?? "") ?? "Unassigned",
          fy26Recognition,
          annualCapacity,
          sowPercent,
          capacityGap,
          segment: classifySowBand(sowPercent),
        };
      });
  }, [donorData, unaskedData]);

  const kpis = useMemo(() => {
    const values = opportunities.map((row) => row?.sowPercent ?? 0);
    return {
      medianSow: median(values),
      totalGap: opportunities.reduce((sum, row) => sum + (row?.capacityGap ?? 0), 0),
      donorCount: opportunities.length,
      averageSow: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    };
  }, [opportunities]);

  const topUpgradeRows = useMemo(
    () =>
      [...opportunities]
        .filter((row) => row?.segment === "Big Upside" || row?.segment === "Upgrade")
        .sort((a, b) => (b?.capacityGap ?? 0) - (a?.capacityGap ?? 0))
        .slice(0, 25),
    [opportunities],
  );

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load Share of Wallet data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={DEVELOPMENT}>Development</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Share of Wallet
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>
        SOW = FY26 Recognition / (WE 5-Year Capacity / 5). Big Upside &lt; 5%, Upgrade 5-15%, Engaged 15-40%, Champion
        40%+.
      </Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Median SOW" value={safePercent(kpis?.medianSow ?? 0, { decimals: 1 })} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Capacity Gap" value={safeCurrency(kpis?.totalGap ?? 0)} valueStyle={{ color: GOLD }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Donor Count" value={safeCount(kpis?.donorCount ?? 0)} valueStyle={{ color: SUCCESS }} />
            <Text style={{ color: MUTED }}>Avg SOW: {safeNumber(kpis?.averageSow ?? 0, { maximumFractionDigits: 1 })}%</Text>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Median SOW {safePercent(kpis?.medianSow ?? 0, { decimals: 1 })} — {safeCurrency(kpis?.totalGap ?? 0, { maximumFractionDigits: 0 })} capacity gap across {safeCount(kpis?.donorCount ?? 0)} donors
      </Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[
                {
                  type: "histogram",
                  x: opportunities.map((row) => row?.sowPercent ?? 0),
                  marker: { color: PLOTLY_COLORS[0] },
                },
              ]}
              layout={{
                ...PLOTLY_BASE_LAYOUT,
                height: 320,
                xaxis: { title: "SOW %" },
                yaxis: { title: "Donors" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "markers",
                  x: opportunities.map((row) => row?.annualCapacity ?? 0),
                  y: opportunities.map((row) => row?.fy26Recognition ?? 0),
                  text: opportunities.map((row) => row?.name ?? ""),
                  marker: {
                    color: opportunities.map((row) => row?.sowPercent ?? 0),
                    colorscale: [
                      [0, PLOTLY_COLORS[2]],
                      [0.5, PLOTLY_COLORS[0]],
                      [1, PLOTLY_COLORS[1]],
                    ],
                    size: 10,
                  },
                  hovertemplate: "<b>%{text}</b><br>Capacity: %{x:$,.0f}<br>Recognition: %{y:$,.0f}<extra></extra>",
                },
              ]}
              layout={{
                ...PLOTLY_BASE_LAYOUT,
                height: 320,
                xaxis: { title: "Annual Capacity" },
                yaxis: { title: "FY26 Recognition" },
                shapes: [
                  {
                    type: "line",
                    x0: 0,
                    y0: 0,
                    x1: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)),
                    y1: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.05,
                    line: { color: ERROR, width: 1, dash: "dash" },
                  },
                  {
                    type: "line",
                    x0: 0,
                    y0: 0,
                    x1: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)),
                    y1: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.15,
                    line: { color: WARNING, width: 1, dash: "dash" },
                  },
                  {
                    type: "line",
                    x0: 0,
                    y0: 0,
                    x1: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)),
                    y1: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.40,
                    line: { color: SUCCESS, width: 1, dash: "dash" },
                  },
                ],
                annotations: [
                  { x: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.3, y: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.3 * 0.02, text: "Big Upside (<5%)", showarrow: false, font: { size: 10, color: ERROR } },
                  { x: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.5, y: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.5 * 0.10, text: "Upgrade (5-15%)", showarrow: false, font: { size: 10, color: WARNING } },
                  { x: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.5, y: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.5 * 0.27, text: "Engaged (15-40%)", showarrow: false, font: { size: 10, color: NAVY } },
                  { x: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.5, y: Math.max(...opportunities.map(r => r?.annualCapacity ?? 0)) * 0.5 * 0.50, text: "Champion (>40%)", showarrow: false, font: { size: 10, color: SUCCESS } },
                ],
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Top {safeCount(topUpgradeRows.length)} upgrade opportunities — Big Upside & Upgrade segments
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table<OpportunityRow>
          dataSource={topUpgradeRows}
          rowKey={(row) => row?.key ?? "row"}
          pagination={{ pageSize: 10, size: "small" }}
          size="small"
          columns={[
            { title: "Donor", dataIndex: "name", key: "name", ellipsis: true },
            { title: "DRM", dataIndex: "drm", key: "drm", ellipsis: true },
            { title: "Recognition", dataIndex: "fy26Recognition", key: "fy26Recognition", render: (value: number) => safeCurrency(value ?? 0) },
            { title: "Annual Capacity", dataIndex: "annualCapacity", key: "annualCapacity", render: (value: number) => safeCurrency(value ?? 0) },
            { title: "SOW", dataIndex: "sowPercent", key: "sowPercent", render: (value: number) => safePercent(value ?? 0, { decimals: 1 }) },
            { title: "Gap", dataIndex: "capacityGap", key: "capacityGap", render: (value: number) => safeCurrency(value ?? 0) },
            {
              title: "Segment",
              dataIndex: "segment",
              key: "segment",
              render: (value: OpportunityRow["segment"]) => {
                const color = value === "Big Upside" ? ERROR : value === "Upgrade" ? WARNING : value === "Engaged" ? NAVY : SUCCESS;
                return <Tag color={color}>{value}</Tag>;
              },
            },
          ]}
        />
      </Card>

      <DataFreshness asOfDate={unaskedData?.generated ?? ""} />
    </Space>
  );
}
