import { Card, Col, Row, Statistic, Tabs, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { NAVY, SUCCESS, WARNING } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { parseDonorRecords } from "../utils/donorAnalytics";
import type { DonorDataResponse } from "../utils/donorAnalytics";
import { safeCount, safeCurrency, safePercent } from "../utils/formatters";

const { Title } = Typography;

type FlowStatus = "Retained" | "Lapsed" | "Upgraded" | "Downgraded";

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

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load retention flow data" description={error} />;

  return (
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Retention Flow
      </Title>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Overall Retention Rate"
              value={safePercent(flow?.retentionRate ?? 0, { decimals: 1 })}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Dollars Retained"
              value={safeCurrency(flow?.retainedDollars ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: NAVY }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Lapsed Dollars at Risk"
              value={safeCurrency(flow?.lapsedDollars ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: WARNING }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={`FY25 Donor Base: ${safeCount(flow?.baseCount ?? 0)} donors`}>
        <Tabs
          items={[
            {
              key: "sankey",
              label: "Native Sankey",
              children: (
                <Plot
                  data={[
                    {
                      type: "sankey",
                      arrangement: "snap",
                      node: {
                        label: ["FY25 Donors", "Retained", "Upgraded", "Downgraded", "Lapsed"],
                        color: ["#1B365D", "#236B4A", "#1c88ed", "#C5A258", "#C4314B"],
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
                        color: ["rgba(35,107,74,0.5)", "rgba(28,136,237,0.5)", "rgba(197,162,88,0.5)", "rgba(196,49,75,0.5)"],
                      },
                    },
                  ]}
                  layout={{
                    autosize: true,
                    height: 430,
                    margin: { l: 20, r: 20, t: 10, b: 10 },
                  }}
                  style={{ width: "100%" }}
                  config={{ responsive: true, displayModeBar: false }}
                />
              ),
            },
            {
              key: "embedded",
              label: "Embedded Fallback",
              children: (
                <iframe
                  src={`${import.meta.env.BASE_URL}embedded/retention-sankey.html`}
                  title="Retention Sankey Embedded"
                  style={{ width: "100%", height: 460, border: "1px solid #F0F0F0" }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
