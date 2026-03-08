import { Card, Col, Row, Statistic, Table, Typography, Space, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse } from "../utils/donorAnalytics";
import { safeCurrency, safePercent, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED, ANALYTICS } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";

const { Title, Text } = Typography;

type FlowStatus = "Retained" | "Lapsed" | "Upgraded" | "Downgraded";

interface FlowTableRow {
  key: FlowStatus;
  status: FlowStatus;
  donors: number;
  share: number;
}

export function RetentionFlowDashboard() {
  const [data, setData] = useState<DonorDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<DonorDataResponse>(`${import.meta.env.BASE_URL}data/donor_data.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load retention flow data"))
      .finally(() => setLoading(false));
  }, []);

  const donors = useMemo(() => parseDonorRecords(data), [data]);

  const flow = useMemo(() => {
    const base = donors.filter((d) => (d?.fy25 ?? 0) > 0);
    const statusCounts: Record<FlowStatus, number> = {
      Retained: 0,
      Lapsed: 0,
      Upgraded: 0,
      Downgraded: 0,
    };

    let retainedDollars = 0;
    let lapsedDollars = 0;

    base.forEach((donor) => {
      const fy25 = donor?.fy25 ?? 0;
      const fy26 = donor?.fy26 ?? 0;
      let status: FlowStatus = "Retained";

      if (fy26 <= 0) status = "Lapsed";
      else if (fy26 > fy25) status = "Upgraded";
      else if (fy26 < fy25) status = "Downgraded";

      statusCounts[status] += 1;

      if (status === "Lapsed") {
        lapsedDollars += fy25;
      } else {
        retainedDollars += Math.min(fy25, fy26);
      }
    });

    const retentionRate = base.length > 0 ? ((statusCounts.Retained + statusCounts.Upgraded + statusCounts.Downgraded) / base.length) * 100 : 0;

    return {
      baseCount: base.length,
      statusCounts,
      retentionRate,
      retainedDollars,
      lapsedDollars,
    };
  }, [donors]);

  const flowRows = useMemo<FlowTableRow[]>(
    () =>
      (["Retained", "Upgraded", "Downgraded", "Lapsed"] as FlowStatus[]).map((status) => ({
        key: status,
        status,
        donors: flow.statusCounts[status] ?? 0,
        share: flow.baseCount > 0 ? ((flow.statusCounts[status] ?? 0) / flow.baseCount) * 100 : 0,
      })),
    [flow],
  );

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load retention flow data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={ANALYTICS}>Analytics</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Retention Flow
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>FY25 donor outcomes flowing into FY26 retained, lapsed, upgraded, and downgraded groups.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Overall Retention Rate"
              value={safePercent(flow?.retentionRate ?? 0, { decimals: 1 })}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Dollars Retained"
              value={safeCurrency(flow?.retainedDollars ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: NAVY }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Lapsed Dollars at Risk"
              value={safeCurrency(flow?.lapsedDollars ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: WARNING }}
            />
            <Text style={{ color: MUTED }}>
              Donor base: {safeCount(flow.baseCount)} | Retained avg: {safeNumber(flow.baseCount > 0 ? flow.retainedDollars / flow.baseCount : 0, { maximumFractionDigits: 0 })}
            </Text>
          </Card>
        </Col>
      </Row>

      {(() => {
        const rate = flow?.retentionRate ?? 0;
        const afpBenchmark = 45; // AFP Fundraising Effectiveness Project avg
        const vsAfp = rate > afpBenchmark
          ? `${safePercent(rate - afpBenchmark, { decimals: 0 })} above AFP avg (${afpBenchmark}%)`
          : `${safePercent(afpBenchmark - rate, { decimals: 0 })} below AFP avg (${afpBenchmark}%)`;
        return (
          <Title level={5} style={{ margin: 0, color: NAVY }}>
            {safePercent(rate, { decimals: 1 })} retention from {safeCount(flow.baseCount)} FY25 donors — {vsAfp} · {safeCurrency(flow?.lapsedDollars ?? 0, { maximumFractionDigits: 0 })} at risk
          </Title>
        );
      })()}
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Plot
          data={[
            {
              type: "sankey",
              arrangement: "snap",
              node: {
                label: ["FY25 Donors", "Retained", "Upgraded", "Downgraded", "Lapsed"],
                color: [PLOTLY_COLORS[6], PLOTLY_COLORS[1], PLOTLY_COLORS[0], PLOTLY_COLORS[2], PLOTLY_COLORS[3]],
                pad: 18,
                thickness: 20,
              },
              link: {
                source: [0, 0, 0, 0],
                target: [1, 2, 3, 4],
                value: [
                  flow?.statusCounts?.Retained ?? 0,
                  flow?.statusCounts?.Upgraded ?? 0,
                  flow?.statusCounts?.Downgraded ?? 0,
                  flow?.statusCounts?.Lapsed ?? 0,
                ],
                color: [SUCCESS, NAVY, GOLD, ERROR],
              },
            },
          ]}
          layout={{
            ...PLOTLY_BASE_LAYOUT,
            height: 430,
          }}
          style={{ width: "100%" }}
          config={{ displayModeBar: false }}
        />
      </Card>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table<FlowTableRow>
          size="small"
          dataSource={flowRows}
          pagination={false}
          rowKey={(row) => row.key}
          columns={[
            { title: "Status", dataIndex: "status", key: "status", render: (value: FlowStatus) => <Tag color={value === "Lapsed" ? ERROR : value === "Upgraded" ? SUCCESS : value === "Downgraded" ? GOLD : NAVY}>{value}</Tag> },
            { title: "Donors", dataIndex: "donors", key: "donors", render: (value: number) => safeCount(value ?? 0) },
            { title: "Share", dataIndex: "share", key: "share", render: (value: number) => safePercent(value ?? 0, { decimals: 1 }) },
          ]}
        />
      </Card>

      <DataFreshness asOfDate="" />
    </Space>
  );
}
