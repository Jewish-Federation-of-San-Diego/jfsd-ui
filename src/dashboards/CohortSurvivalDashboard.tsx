import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Tabs } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse } from "../utils/donorAnalytics";
import { safePercent, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, MUTED, ANALYTICS } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";

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

interface CohortTableRow {
  key: string;
  cohort: string;
  size: number;
  fy26Active: number;
  retention2526: number;
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

  const cohortTable = useMemo<CohortTableRow[]>(
    () =>
      cohorts.map((cohort) => ({
        key: cohort.cohort,
        cohort: cohort.cohort,
        size: cohort.size,
        fy26Active: cohort.survival[2] ?? 0,
        retention2526: cohort.retention[1] ?? 0,
      })),
    [cohorts],
  );

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load cohort survival data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={ANALYTICS}>Analytics</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Cohort Survival Analysis
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>Cohorts are inferred from historical recognition depth and tracked across FY24-FY26.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Cohorts Tracked" value={safeCount(cohorts.length)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Donors Modeled" value={safeCount(donors.length)} valueStyle={{ color: SUCCESS }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Avg FY25→FY26 Retention"
              value={safePercent(avgRetention, { decimals: 1 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        {safeCount(cohorts.length)} cohorts tracked — avg {safePercent(avgRetention, { decimals: 1 })} FY25→FY26 retention
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Tabs
          items={[
            {
              key: "native",
              label: "Native Plotly",
              children: (
                <Row gutter={[12, 12]}>
                  <Col xs={24} lg={12}>
                    <Plot
                      data={cohorts.map((cohort, index) => ({
                        type: "scatter",
                        mode: "lines+markers",
                        name: `${cohort?.cohort} (${safeCount(cohort?.size ?? 0)})`,
                        x: ["FY24", "FY25", "FY26"],
                        y: cohort?.survival ?? [0, 0, 0],
                        line: { width: 2, color: PLOTLY_COLORS[index % PLOTLY_COLORS.length] },
                      }))}
                      layout={{
                        ...PLOTLY_BASE_LAYOUT,
                        height: 340,
                        yaxis: { title: "Active Donors (%)", range: [0, 100] },
                      }}
                      style={{ width: "100%" }}
                      config={{ displayModeBar: false }}
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
                          colorscale: [[0, PLOTLY_COLORS[6]], [1, PLOTLY_COLORS[0]]],
                          zmin: 0,
                          zmax: 100,
                          hovertemplate: "Cohort %{y}<br>%{x}: %{z:.1f}%<extra></extra>",
                        },
                      ]}
                      layout={{
                        ...PLOTLY_BASE_LAYOUT,
                        height: 340,
                        margin: { l: 95, r: 20, t: 40, b: 40 },
                      }}
                      style={{ width: "100%" }}
                      config={{ displayModeBar: false }}
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
                  style={{ width: "100%", height: 520, border: `1px solid ${MUTED}` }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table<CohortTableRow>
          size="small"
          rowKey={(row) => row.key}
          dataSource={cohortTable}
          pagination={false}
          columns={[
            { title: "Cohort", dataIndex: "cohort", key: "cohort" },
            { title: "Size", dataIndex: "size", key: "size", render: (value: number) => safeCount(value ?? 0) },
            { title: "FY26 Active %", dataIndex: "fy26Active", key: "fy26Active", render: (value: number) => safePercent(value ?? 0, { decimals: 1 }) },
            { title: "FY25→FY26 Retention", dataIndex: "retention2526", key: "retention2526", render: (value: number) => safePercent(value ?? 0, { decimals: 1 }) },
            {
              title: "Expected Active Donors",
              key: "expected",
              render: (_: unknown, row: CohortTableRow) => safeNumber(((row?.size ?? 0) * (row?.fy26Active ?? 0)) / 100, { maximumFractionDigits: 0 }),
            },
          ]}
        />
      </Card>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Mortality model — predictive view across {safeCount(donors.length)} donors
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <iframe
          src={`${import.meta.env.BASE_URL}embedded/mortality-model.html`}
          title="Mortality Model Embedded"
          style={{ width: "100%", height: 520, border: `1px solid ${MUTED}` }}
        />
      </Card>

      <DataFreshness asOfDate="" />
    </Space>
  );
}
