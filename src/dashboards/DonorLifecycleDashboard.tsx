import { Card, Col, Row, Statistic, Tabs, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { NAVY, SUCCESS, GOLD } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { classifyLifecycleSegment, parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse, LifecycleSegment } from "../utils/donorAnalytics";
import { safeCount, safePercent } from "../utils/formatters";

const { Title } = Typography;

const SEGMENT_ORDER: LifecycleSegment[] = ["New", "Retained", "Upgraded", "Downgraded", "Lapsed", "Reactivated"];

function band(value: number): "No Gift" | "Under $1K" | "$1K+" {
  if (value <= 0) return "No Gift";
  if (value < 1000) return "Under $1K";
  return "$1K+";
}

export function DonorLifecycleDashboard() {
  const [data, setData] = useState<DonorDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJson<DonorDataResponse>(`${import.meta.env.BASE_URL}data/donor_data.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load donor lifecycle data"))
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

  const migrationMatrix = useMemo(() => {
    const rowLabels: Array<"No Gift" | "Under $1K" | "$1K+"> = ["No Gift", "Under $1K", "$1K+"];
    const colLabels: Array<"No Gift" | "Under $1K" | "$1K+"> = ["No Gift", "Under $1K", "$1K+"];
    const grid = rowLabels.map(() => colLabels.map(() => 0));
    donors.forEach((donor) => {
      const from = band(donor?.fy25 ?? 0);
      const to = band(donor?.fy26 ?? 0);
      const row = rowLabels.indexOf(from);
      const col = colLabels.indexOf(to);
      if (row >= 0 && col >= 0) grid[row][col] += 1;
    });
    return { rowLabels, colLabels, grid };
  }, [donors]);

  const yoy = useMemo(() => {
    const fy24Donors = donors.filter((d) => (d?.fy24 ?? 0) > 0).length;
    const fy25Donors = donors.filter((d) => (d?.fy25 ?? 0) > 0).length;
    const fy26Donors = donors.filter((d) => (d?.fy26 ?? 0) > 0).length;
    const fy24Dollars = donors.reduce((sum, d) => sum + (d?.fy24 ?? 0), 0);
    const fy25Dollars = donors.reduce((sum, d) => sum + (d?.fy25 ?? 0), 0);
    const fy26Dollars = donors.reduce((sum, d) => sum + (d?.fy26 ?? 0), 0);
    return {
      donorCounts: [fy24Donors, fy25Donors, fy26Donors],
      dollars: [fy24Dollars, fy25Dollars, fy26Dollars],
    };
  }, [donors]);

  const retentionRate = useMemo(() => {
    const fy25Base = donors.filter((d) => (d?.fy25 ?? 0) > 0);
    if (fy25Base.length === 0) return 0;
    const retained = fy25Base.filter((d) => (d?.fy26 ?? 0) > 0).length;
    return (retained / fy25Base.length) * 100;
  }, [donors]);

  const upgradeRate = useMemo(() => {
    const comparable = donors.filter((d) => (d?.fy25 ?? 0) > 0 && (d?.fy26 ?? 0) > 0);
    if (comparable.length === 0) return 0;
    const upgraded = comparable.filter((d) => (d?.fy26 ?? 0) > (d?.fy25 ?? 0)).length;
    return (upgraded / comparable.length) * 100;
  }, [donors]);

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load donor lifecycle data" description={error} />;

  return (
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Donor Lifecycle
      </Title>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Segmented Donors" value={safeCount(donors.length)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Retention Rate"
              value={safePercent(retentionRate, { decimals: 1 })}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Upgrade Rate" value={safePercent(upgradeRate, { decimals: 1 })} valueStyle={{ color: GOLD }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Lifecycle Segments">
            <Plot
              data={[
                {
                  type: "bar",
                  x: SEGMENT_ORDER,
                  y: SEGMENT_ORDER.map((segment) => segmentCounts?.[segment] ?? 0),
                  marker: { color: "#1c88ed" },
                },
              ]}
              layout={{
                autosize: true,
                height: 320,
                margin: { l: 45, r: 10, t: 10, b: 55 },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Lifecycle Migration Matrix (FY25 → FY26)">
            <Plot
              data={[
                {
                  type: "heatmap",
                  x: migrationMatrix?.colLabels ?? [],
                  y: migrationMatrix?.rowLabels ?? [],
                  z: migrationMatrix?.grid ?? [],
                  colorscale: "Blues",
                  hovertemplate: "From %{y}<br>To %{x}<br>Donors: %{z}<extra></extra>",
                },
              ]}
              layout={{
                autosize: true,
                height: 320,
                margin: { l: 80, r: 10, t: 10, b: 55 },
                xaxis: { title: "FY26 Band" },
                yaxis: { title: "FY25 Band" },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="YoY Comparison" style={{ marginTop: 12 }}>
        <Tabs
          items={[
            {
              key: "donors",
              label: "Donor Count",
              children: (
                <Plot
                  data={[
                    {
                      type: "bar",
                      x: ["FY24", "FY25", "FY26"],
                      y: yoy?.donorCounts ?? [],
                      marker: { color: "#236B4A" },
                    },
                  ]}
                  layout={{
                    autosize: true,
                    height: 300,
                    margin: { l: 45, r: 10, t: 10, b: 40 },
                    paper_bgcolor: "white",
                    plot_bgcolor: "white",
                  }}
                  style={{ width: "100%" }}
                  config={{ displayModeBar: false, responsive: true }}
                />
              ),
            },
            {
              key: "dollars",
              label: "Recognition Dollars",
              children: (
                <Plot
                  data={[
                    {
                      type: "bar",
                      x: ["FY24", "FY25", "FY26"],
                      y: yoy?.dollars ?? [],
                      marker: { color: "#1c88ed" },
                    },
                  ]}
                  layout={{
                    autosize: true,
                    height: 300,
                    margin: { l: 55, r: 10, t: 10, b: 40 },
                    yaxis: { tickprefix: "$" },
                    paper_bgcolor: "white",
                    plot_bgcolor: "white",
                  }}
                  style={{ width: "100%" }}
                  config={{ displayModeBar: false, responsive: true }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
