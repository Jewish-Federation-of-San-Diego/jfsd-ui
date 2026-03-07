import { Card, Col, Row, Statistic, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { NAVY } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { safeCurrency } from "../utils/formatters";

const { Title, Text } = Typography;

interface HoldingsData {
  asOfDate?: string;
  metrics?: {
    assets?: number;
    liabilities?: number;
    netIncome?: number;
  };
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

  if (loading) return <DashboardSkeleton kpiCount={3} hasChart />;
  if (error) return <DashboardErrorState message="Failed to load holdings data" description={error} />;

  return (
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        UJF Holdings Corp
      </Title>
      <Text type="secondary">Financial overview will be expanded as holdings data feeds are finalized.</Text>
      <DataFreshness asOfDate={data?.asOfDate ?? ""} />

      <Row gutter={[12, 12]} style={{ marginTop: 8, marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Total Assets" value={safeCurrency(metrics?.assets ?? 0, { maximumFractionDigits: 0 })} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Total Liabilities"
              value={safeCurrency(metrics?.liabilities ?? 0, { maximumFractionDigits: 0 })}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Net Income" value={safeCurrency(metrics?.netIncome ?? 0, { maximumFractionDigits: 0 })} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Embedded Holdings Dashboard">
        <iframe
          src={`${import.meta.env.BASE_URL}embedded/holdings-dashboard.html`}
          title="Holdings Embedded Dashboard"
          style={{ width: "100%", height: 640, border: "1px solid #F0F0F0" }}
        />
      </Card>
    </div>
  );
}
