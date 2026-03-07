import { Card, Col, Row, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { NAVY, SUCCESS, WARNING } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { safeCount, safeCurrency, safePercent } from "../utils/formatters";
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
  id: string;
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
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function ShareOfWalletDashboard() {
  const [donorData, setDonorData] = useState<DonorDataResponse | null>(null);
  const [unaskedData, setUnaskedData] = useState<UnaskedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<DonorDataResponse>(`${import.meta.env.BASE_URL}data/donor_data.json`),
      fetchJson<UnaskedResponse>(`${import.meta.env.BASE_URL}data/unasked.json`),
    ])
      .then(([donors, unasked]) => {
        setDonorData(donors);
        setUnaskedData(unasked);
      })
      .catch((err) => setError((err as Error)?.message ?? "Failed to load share-of-wallet data"))
      .finally(() => setLoading(false));
  }, []);

  const opportunities = useMemo<OpportunityRow[]>(() => {
    const parsed = parseDonorRecords(donorData);
    const drmById = new Map<string, string>();
    const unaskedDonors = Array.isArray(unaskedData?.donors) ? unaskedData?.donors : [];
    unaskedDonors.forEach((d) => {
      const id = d?.id ?? "";
      if (id) drmById.set(id, d?.ownerId ?? "Unassigned");
    });

    return parsed
      .filter((d) => (d?.annualCapacity ?? 0) > 0)
      .map((d) => {
        const sowPercent = calculateSowPercent(d?.fy26 ?? 0, d?.fiveYearCapacity ?? 0);
        const annualCapacity = d?.annualCapacity ?? 0;
        const recognition = d?.fy26 ?? 0;
        const capacityGap = Math.max(annualCapacity - recognition, 0);
        return {
          id: d?.id ?? "",
          name: d?.name ?? "Unknown Donor",
          drm: drmById.get(d?.id ?? "") ?? "Unassigned",
          fy26Recognition: recognition,
          annualCapacity,
          sowPercent,
          capacityGap,
          segment: classifySowBand(sowPercent),
        };
      });
  }, [donorData, unaskedData]);

  const kpis = useMemo(() => {
    const sowValues = opportunities.map((o) => o?.sowPercent ?? 0);
    const medianSow = median(sowValues);
    const totalGap = opportunities.reduce((sum, row) => sum + (row?.capacityGap ?? 0), 0);
    return {
      medianSow,
      totalGap,
      donorCount: opportunities.length,
    };
  }, [opportunities]);

  const topUpgradeRows = useMemo(
    () =>
      [...opportunities]
        .filter((r) => r?.segment === "Big Upside" || r?.segment === "Upgrade")
        .sort((a, b) => (b?.capacityGap ?? 0) - (a?.capacityGap ?? 0))
        .slice(0, 25),
    [opportunities],
  );

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load Share of Wallet data" description={error} />;

  return (
    <div style={{ padding: "4px" }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Share of Wallet
      </Title>
      <Text type="secondary">
        SOW = FY26 Recognition / (WE 5-Year Capacity / 5). Segments: Big Upside (&lt;5%), Upgrade (5-15%), Engaged
        (15-40%), Champion (40%+).
      </Text>
      <DataFreshness asOfDate={unaskedData?.generated ?? ""} />

      <Row gutter={[12, 12]} style={{ marginTop: 12, marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Median SOW"
              value={safePercent(kpis?.medianSow ?? 0, { decimals: 1 })}
              valueStyle={{ color: NAVY }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Total Capacity Gap"
              value={safeCurrency(kpis?.totalGap ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: WARNING }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Donors Scored" value={safeCount(kpis?.donorCount ?? 0)} valueStyle={{ color: SUCCESS }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="SOW Distribution">
            <Plot
              data={[
                {
                  type: "histogram",
                  x: opportunities.map((o) => o?.sowPercent ?? 0),
                  marker: { color: "#1c88ed" },
                  nbinsx: 24,
                },
              ]}
              layout={{
                autosize: true,
                height: 300,
                margin: { l: 45, r: 15, t: 10, b: 40 },
                xaxis: { title: "SOW %" },
                yaxis: { title: "Donors" },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Capacity vs Recognition">
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "markers",
                  x: opportunities.map((o) => o?.annualCapacity ?? 0),
                  y: opportunities.map((o) => o?.fy26Recognition ?? 0),
                  text: opportunities.map((o) => o?.name ?? ""),
                  marker: {
                    size: opportunities.map((o) => Math.min(Math.max((o?.sowPercent ?? 0) / 3, 6), 20)),
                    color: opportunities.map((o) => o?.sowPercent ?? 0),
                    colorscale: "Blues",
                    showscale: true,
                  },
                  hovertemplate:
                    "<b>%{text}</b><br>Annual Capacity: %{x:$,.0f}<br>FY26 Recognition: %{y:$,.0f}<extra></extra>",
                },
              ]}
              layout={{
                autosize: true,
                height: 300,
                margin: { l: 55, r: 15, t: 10, b: 45 },
                xaxis: { title: "Annual Capacity ($)" },
                yaxis: { title: "FY26 Recognition ($)" },
                paper_bgcolor: "white",
                plot_bgcolor: "white",
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Top Upgrade Opportunities" style={{ marginTop: 12 }}>
        <Table<OpportunityRow>
          rowKey={(row) => row?.id || row?.name || "donor-row"}
          dataSource={topUpgradeRows}
          pagination={{ pageSize: 10, size: "small" }}
          size="small"
          scroll={{ x: 700 }}
          columns={[
            { title: "Donor", dataIndex: "name", key: "name", ellipsis: true },
            { title: "DRM", dataIndex: "drm", key: "drm", ellipsis: true },
            {
              title: "FY26 Recognition",
              dataIndex: "fy26Recognition",
              key: "fy26Recognition",
              render: (v: number) => safeCurrency(v ?? 0, { maximumFractionDigits: 0 }),
            },
            {
              title: "Annual Capacity",
              dataIndex: "annualCapacity",
              key: "annualCapacity",
              render: (v: number) => safeCurrency(v ?? 0, { maximumFractionDigits: 0 }),
            },
            {
              title: "SOW",
              dataIndex: "sowPercent",
              key: "sowPercent",
              render: (v: number) => safePercent(v ?? 0, { decimals: 1 }),
            },
            {
              title: "Capacity Gap",
              dataIndex: "capacityGap",
              key: "capacityGap",
              render: (v: number) => safeCurrency(v ?? 0, { maximumFractionDigits: 0 }),
            },
            {
              title: "Segment",
              dataIndex: "segment",
              key: "segment",
              render: (v: OpportunityRow["segment"]) => (
                <Tag color={v === "Big Upside" ? "volcano" : v === "Upgrade" ? "gold" : v === "Engaged" ? "blue" : "green"}>
                  {v ?? "—"}
                </Tag>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
