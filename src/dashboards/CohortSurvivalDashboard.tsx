import { Card, Col, Row, Statistic, Tabs, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { NAVY, SUCCESS, GOLD } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse } from "../utils/donorAnalytics";
import { safeCount, safePercent } from "../utils/formatters";

const { Title, Text } = Typography;

function toCohortLabel(year: number): string {
  if (year <= 2005) return "≤2005";
  if (year <= 2010) return "2006-2010";
  if (year <= 2015) return "2011-2015";
  if (year <= 2020) return "2016-2020";
  if (year <= 2023) return "2021-2023";
  if (year === 2024) return "2024";
  if (year === 2025) return "2025";
  return "2026+";
}

interface CohortSeries {
  cohort: string;
  size: number;
  survival: [number, number, number];
  retention: [number, number];
}

export function CohortSurvivalDashboard() {
  const [data, setData] = useState<DonorDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<DonorDataResponse>(`${import.meta.env.BASE_URL}data/donor_data.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load cohort analysis data"))
      .finally(() => setLoading(false));
  }, []);

  const donors = useMemo(() => parseDonorRecords(data), [data]);

  const cohorts = useMemo<CohortSeries[]>(() => {
    const groups = new Map<string, typeof donors>();
    donors.forEach((donor) => {
      const label = toCohortLabel(donor?.inferredCohortYear ?? 2026);
      const items = groups.get(label) ?? [];
      items.push(donor);
      groups.set(label, items);
    });

    return [...groups.entries()]
      .map(([cohort, members]) => {
        const size = members.length;
        const fy24Active = members.filter((d) => (d?.fy24 ?? 0) > 0);
        const fy25Active = members.filter((d) => (d?.fy25 ?? 0) > 0);
        const fy26Active = members.filter((d) => (d?.fy26 ?? 0) > 0);
        const s24 = size > 0 ? (fy24Active.length / size) * 100 : 0;
        const s25 = size > 0 ? (fy25Active.length / size) * 100 : 0;
        const s26 = size > 0 ? (fy26Active.length / size) * 100 : 0;
        const ret2425 = fy24Active.length > 0 ? (fy24Active.filter((d) => (d?.fy25 ?? 0) > 0).length / fy24Active.length) * 100 : 0;
        const ret2526 = fy25Active.length > 0 ? (fy25Active.filter((d) => (d?.fy26 ?? 0) > 0).length / fy25Active.length) * 100 : 0;
        const survival: [number, number, number] = [s24, s25, s26];
        const retention: [number, number] = [ret2425, ret2526];
        return {
          cohort,
          size,
          survival,
          retention,
        };
      })
      .filter((row) => row?.size >= 10)
      .sort((a, b) => b.size - a.size);
  }, [donors]);

  const avgRetention = useMemo(() => {
    if (cohorts.length === 0) return 0;
    const total = cohorts.reduce((sum, cohort) => sum + (cohort?.retention?.[1] ?? 0), 0);
    return total / cohorts.length;
  }, [cohorts]);

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load cohort survival data" description={error} />;

  return (
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Cohort Survival Analysis
      </Title>
      <Text type="secondary">
        Cohorts are inferred from historical recognition depth in donor records, then tracked across FY24-FY26.
      </Text>

      <Row gutter={[12, 12]} style={{ marginTop: 12, marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Cohorts Tracked" value={safeCount(cohorts.length)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Donors Modeled" value={safeCount(donors.length)} valueStyle={{ color: SUCCESS }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Avg FY25→FY26 Retention"
              value={safePercent(avgRetention, { decimals: 1 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Survival Curves and Retention Heatmap" style={{ marginBottom: 12 }}>
        <Tabs
          items={[
            {
              key: "native",
              label: "Native Plotly",
              children: (
                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={12}>
                    <Plot
                      data={cohorts.map((cohort) => ({
                        type: "scatter",
                        mode: "lines+markers",
                        name: `${cohort?.cohort} (${safeCount(cohort?.size ?? 0)})`,
                        x: ["FY24", "FY25", "FY26"],
                        y: cohort?.survival ?? [0, 0, 0],
                        line: { width: 2 },
                      }))}
                      layout={{
                        autosize: true,
                        height: 340,
                        margin: { l: 55, r: 15, t: 10, b: 45 },
                        yaxis: { title: "Active Donors (%)", range: [0, 100] },
                        paper_bgcolor: "white",
                        plot_bgcolor: "white",
                      }}
                      style={{ width: "100%" }}
                      config={{ responsive: true, displayModeBar: false }}
                    />
                  </Col>
                  <Col xs={24} lg={12}>
                    <Plot
                      data={[
                        {
                          type: "heatmap",
                          x: ["FY24→FY25", "FY25→FY26"],
                          y: cohorts.map((cohort) => cohort?.cohort),
                          z: cohorts.map((cohort) => cohort?.retention ?? [0, 0]),
                          colorscale: "Blues",
                          zmin: 0,
                          zmax: 100,
                          hovertemplate: "Cohort %{y}<br>%{x}: %{z:.1f}%<extra></extra>",
                        },
                      ]}
                      layout={{
                        autosize: true,
                        height: 340,
                        margin: { l: 95, r: 10, t: 10, b: 45 },
                        paper_bgcolor: "white",
                        plot_bgcolor: "white",
                      }}
                      style={{ width: "100%" }}
                      config={{ responsive: true, displayModeBar: false }}
                    />
                  </Col>
                </Row>
              ),
            },
            {
              key: "embedded",
              label: "Embedded Fallback",
              children: (
                <iframe
                  src={`${import.meta.env.BASE_URL}embedded/cohort-survival.html`}
                  title="Cohort Survival Embedded"
                  style={{ width: "100%", height: 520, border: "1px solid #F0F0F0" }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card size="small" title="Mortality Model">
        <iframe
          src={`${import.meta.env.BASE_URL}embedded/mortality-model.html`}
          title="Mortality Model Embedded"
          style={{ width: "100%", height: 520, border: "1px solid #F0F0F0" }}
        />
      </Card>
    </div>
  );
}
