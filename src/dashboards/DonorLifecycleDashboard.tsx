import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Tabs } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safePercent, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, MUTED, DEVELOPMENT } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";
import { classifyLifecycleSegment, parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse, LifecycleSegment } from "../utils/donorAnalytics";

const { Title, Text } = Typography;

const SEGMENT_ORDER: LifecycleSegment[] = ["New", "Retained", "Upgraded", "Downgraded", "Lapsed", "Reactivated"];

interface SegmentTableRow {
  key: LifecycleSegment;
  segment: LifecycleSegment;
  count: number;
}

function band(value: number): "No Gift" | "Under $1K" | "$1K+" {
  if (value <= 0) return "No Gift";
  if (value < 1000) return "Under $1K";
  return "$1K+";
}

export function DonorLifecycleDashboard() {
  const [data, setData] = useState<DonorDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<DonorDataResponse>(`${import.meta.env.BASE_URL}data/donor_data.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Unable to load donor lifecycle data"))
      .finally(() => setLoading(false));
  }, []);

  const donors = useMemo(() => parseDonorRecords(data), [data]);

  const segmentCounts = useMemo(() => {
    const counts: Record<LifecycleSegment, number> = {
      New: 0,
      Retained: 0,
      Upgraded: 0,
      Downgraded: 0,
      Lapsed: 0,
      Reactivated: 0,
    };
    donors.forEach((donor) => {
      const segment = classifyLifecycleSegment(donor);
      if (segment) counts[segment] += 1;
    });
    return counts;
  }, [donors]);

  const segmentTable = useMemo<SegmentTableRow[]>(
    () => SEGMENT_ORDER.map((segment) => ({ key: segment, segment, count: segmentCounts[segment] ?? 0 })),
    [segmentCounts],
  );

  const migrationMatrix = useMemo(() => {
    const rowLabels: Array<"No Gift" | "Under $1K" | "$1K+"> = ["No Gift", "Under $1K", "$1K+"];
    const colLabels: Array<"No Gift" | "Under $1K" | "$1K+"> = ["No Gift", "Under $1K", "$1K+"];
    const values = rowLabels.map(() => colLabels.map(() => 0));
    donors.forEach((donor) => {
      const from = band(donor?.fy25 ?? 0);
      const to = band(donor?.fy26 ?? 0);
      const row = rowLabels.indexOf(from);
      const col = colLabels.indexOf(to);
      if (row >= 0 && col >= 0) values[row][col] += 1;
    });
    return { rowLabels, colLabels, values };
  }, [donors]);

  const yoy = useMemo(() => {
    const fy24Donors = donors.filter((donor) => (donor?.fy24 ?? 0) > 0).length;
    const fy25Donors = donors.filter((donor) => (donor?.fy25 ?? 0) > 0).length;
    const fy26Donors = donors.filter((donor) => (donor?.fy26 ?? 0) > 0).length;
    const fy24Dollars = donors.reduce((sum, donor) => sum + (donor?.fy24 ?? 0), 0);
    const fy25Dollars = donors.reduce((sum, donor) => sum + (donor?.fy25 ?? 0), 0);
    const fy26Dollars = donors.reduce((sum, donor) => sum + (donor?.fy26 ?? 0), 0);
    return {
      donorCounts: [fy24Donors, fy25Donors, fy26Donors],
      dollars: [fy24Dollars, fy25Dollars, fy26Dollars],
    };
  }, [donors]);

  const retentionRate = useMemo(() => {
    const fy25Base = donors.filter((donor) => (donor?.fy25 ?? 0) > 0);
    if (fy25Base.length === 0) return 0;
    const retained = fy25Base.filter((donor) => (donor?.fy26 ?? 0) > 0).length;
    return (retained / fy25Base.length) * 100;
  }, [donors]);

  const upgradeRate = useMemo(() => {
    const comparable = donors.filter((donor) => (donor?.fy25 ?? 0) > 0 && (donor?.fy26 ?? 0) > 0);
    if (comparable.length === 0) return 0;
    const upgraded = comparable.filter((donor) => (donor?.fy26 ?? 0) > (donor?.fy25 ?? 0)).length;
    return (upgraded / comparable.length) * 100;
  }, [donors]);

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load donor lifecycle data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={DEVELOPMENT}>Development</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Donor Lifecycle
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>Lifecycle segments are inferred from FY24-FY26 giving transitions for each donor.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Segmented Donors" value={safeCount(donors.length)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Retention Rate" value={safePercent(retentionRate, { decimals: 1 })} valueStyle={{ color: SUCCESS }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Upgrade Rate" value={safePercent(upgradeRate, { decimals: 1 })} valueStyle={{ color: GOLD }} />
            <Text style={{ color: MUTED }}>FY25 to FY26 compare</Text>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Lifecycle Mix and Migration
      </Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[{ type: "bar", x: SEGMENT_ORDER, y: SEGMENT_ORDER.map((segment) => segmentCounts[segment] ?? 0), marker: { color: PLOTLY_COLORS[0] } }]}
              layout={{ ...PLOTLY_BASE_LAYOUT, height: 320 }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[{ type: "heatmap", x: migrationMatrix.colLabels, y: migrationMatrix.rowLabels, z: migrationMatrix.values, colorscale: [[0, PLOTLY_COLORS[6]], [1, PLOTLY_COLORS[0]]] }]}
              layout={{ ...PLOTLY_BASE_LAYOUT, height: 320, xaxis: { title: "FY26 Band" }, yaxis: { title: "FY25 Band" } }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Tabs
          items={[
            {
              key: "yoy-donors",
              label: "YoY Donor Count",
              children: (
                <Plot
                  data={[{ type: "bar", x: ["FY24", "FY25", "FY26"], y: yoy.donorCounts, marker: { color: PLOTLY_COLORS[1] } }]}
                  layout={{ ...PLOTLY_BASE_LAYOUT, height: 280 }}
                  style={{ width: "100%" }}
                  config={{ displayModeBar: false }}
                />
              ),
            },
            {
              key: "yoy-dollars",
              label: "YoY Dollars",
              children: (
                <Plot
                  data={[{ type: "bar", x: ["FY24", "FY25", "FY26"], y: yoy.dollars, marker: { color: PLOTLY_COLORS[2] } }]}
                  layout={{ ...PLOTLY_BASE_LAYOUT, height: 280, yaxis: { title: "Recognition", tickprefix: "$" } }}
                  style={{ width: "100%" }}
                  config={{ displayModeBar: false }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table<SegmentTableRow>
          size="small"
          dataSource={segmentTable}
          rowKey={(row) => row.key}
          pagination={false}
          columns={[
            { title: "Segment", dataIndex: "segment", key: "segment" },
            { title: "Count", dataIndex: "count", key: "count", render: (value: number) => safeCount(value ?? 0) },
            {
              title: "Share",
              key: "share",
              render: (_: unknown, row: SegmentTableRow) =>
                safePercent(donors.length > 0 ? ((row?.count ?? 0) / donors.length) * 100 : 0, { decimals: 1 }),
            },
          ]}
        />
      </Card>

      <DataFreshness asOfDate="" />
    </Space>
  );
}
