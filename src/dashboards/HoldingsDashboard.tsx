import { Card, Col, Row, Statistic, Table, Typography, Space, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safeCurrency, safePercent } from "../utils/formatters";
import { NAVY, GOLD, MUTED, OPERATIONS } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE } from "../utils/dashboardStyles";

const { Title, Text } = Typography;

interface HoldingsData {
  asOfDate?: string;
  metrics?: {
    assets?: number;
    liabilities?: number;
    netIncome?: number;
  };
}

interface HoldingsMetricRow {
  key: string;
  metric: string;
  value: number;
}

export function HoldingsDashboard() {
  const [data, setData] = useState<HoldingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<HoldingsData>(`${import.meta.env.BASE_URL}data/holdings.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load holdings data"))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(
    () => ({
      assets: data?.metrics?.assets ?? 0,
      liabilities: data?.metrics?.liabilities ?? 0,
      netIncome: data?.metrics?.netIncome ?? 0,
    }),
    [data],
  );

  const tableRows = useMemo<HoldingsMetricRow[]>(
    () => [
      { key: "assets", metric: "Total Assets", value: metrics.assets },
      { key: "liabilities", metric: "Total Liabilities", value: metrics.liabilities },
      { key: "netIncome", metric: "Net Income", value: metrics.netIncome },
    ],
    [metrics],
  );

  if (loading) return <DashboardSkeleton kpiCount={3} hasChart />;
  if (error) return <DashboardErrorState message="Failed to load holdings data" description={error} />;

  const leverageRatio = metrics.assets > 0 ? (metrics.liabilities / metrics.assets) * 100 : 0;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={OPERATIONS}>Operations</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          UJF Holdings Corp
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>Financial overview placeholder until holdings feeds are fully populated.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Total Assets" value={safeCurrency(metrics?.assets ?? 0, { maximumFractionDigits: 0 })} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Total Liabilities"
              value={safeCurrency(metrics?.liabilities ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Net Income" value={safeCurrency(metrics?.netIncome ?? 0, { maximumFractionDigits: 0 })} />
            <Text style={{ color: MUTED }}>Leverage: {safePercent(leverageRatio, { decimals: 1 })}</Text>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        {safeCurrency(metrics?.assets ?? 0, { maximumFractionDigits: 0 })} assets — {safePercent(leverageRatio, { decimals: 1 })} leverage ratio
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table<HoldingsMetricRow>
          size="small"
          rowKey={(row) => row.key}
          pagination={false}
          dataSource={tableRows}
          columns={[
            { title: "Metric", dataIndex: "metric", key: "metric" },
            { title: "Value", dataIndex: "value", key: "value", render: (value: number) => safeCurrency(value ?? 0) },
          ]}
        />
      </Card>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Embedded holdings dashboard — detailed breakdown
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <iframe
          src={`${import.meta.env.BASE_URL}embedded/holdings-dashboard.html`}
          title="Holdings Embedded Dashboard"
          style={{ width: "100%", height: 640, border: `1px solid ${MUTED}` }}
        />
      </Card>

      <DataFreshness asOfDate={data?.asOfDate ?? ""} />
    </Space>
  );
}
