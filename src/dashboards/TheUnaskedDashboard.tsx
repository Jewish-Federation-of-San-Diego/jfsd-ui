import { Card, Col, Row, Select, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { NAVY, WARNING } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { safeCount, safeCurrency } from "../utils/formatters";

const { Title } = Typography;

interface UnaskedDonor {
  id?: string;
  name?: string;
  years?: number;
  avgAnnual?: number;
  upgradeFactor?: number;
  capacity?: number | null;
  ownerId?: string | null;
}

interface UnaskedResponse {
  generated?: string;
  donors?: UnaskedDonor[];
}

interface UnaskedRow {
  key: string;
  name: string;
  tier: string;
  drm: string;
  years: number;
  avgAnnual: number;
  estimatedCapacity: number;
}

function estimateCapacity(donor: UnaskedDonor): number {
  const provided = donor?.capacity;
  if (typeof provided === "number" && Number.isFinite(provided) && provided > 0) return provided;
  const average = donor?.avgAnnual ?? 0;
  const factor = donor?.upgradeFactor ?? 1;
  return Math.max(average * Math.max(factor, 1), average);
}

function tierForCapacity(capacity: number): string {
  if (capacity >= 100000) return "Tier 1";
  if (capacity >= 25000) return "Tier 2";
  if (capacity >= 5000) return "Tier 3";
  return "Tier 4";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function TheUnaskedDashboard() {
  const [data, setData] = useState<UnaskedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("All");
  const [drmFilter, setDrmFilter] = useState<string>("All");

  useEffect(() => {
    fetchJson<UnaskedResponse>(`${import.meta.env.BASE_URL}data/unasked.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load unasked donor data"))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo<UnaskedRow[]>(() => {
    const donors = Array.isArray(data?.donors) ? data?.donors : [];
    return donors.map((donor, index) => {
      const estimated = estimateCapacity(donor);
      return {
        key: donor?.id ?? `unasked-${index}`,
        name: donor?.name ?? "Unknown Donor",
        tier: tierForCapacity(estimated),
        drm: donor?.ownerId ?? "Unassigned",
        years: donor?.years ?? 0,
        avgAnnual: donor?.avgAnnual ?? 0,
        estimatedCapacity: estimated,
      };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const tierPass = tierFilter === "All" || row?.tier === tierFilter;
      const drmPass = drmFilter === "All" || row?.drm === drmFilter;
      return tierPass && drmPass;
    });
  }, [rows, tierFilter, drmFilter]);

  const kpis = useMemo(() => {
    const capacities = filteredRows.map((row) => row?.estimatedCapacity ?? 0);
    return {
      count: filteredRows.length,
      totalCapacity: capacities.reduce((sum, value) => sum + value, 0),
      medianCapacity: median(capacities),
    };
  }, [filteredRows]);

  const topRows = useMemo(
    () => [...filteredRows].sort((a, b) => (b?.estimatedCapacity ?? 0) - (a?.estimatedCapacity ?? 0)).slice(0, 50),
    [filteredRows],
  );

  const drms = useMemo(() => [...new Set(rows.map((row) => row?.drm ?? "Unassigned"))].sort(), [rows]);

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load The Unasked data" description={error} />;

  return (
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        The Unasked
      </Title>
      <DataFreshness asOfDate={data?.generated ?? ""} />

      <Row gutter={[12, 12]} style={{ marginTop: 8, marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Unasked Count" value={safeCount(kpis?.count ?? 0)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Estimated Capacity"
              value={safeCurrency(kpis?.totalCapacity ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: WARNING }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Median Capacity"
              value={safeCurrency(kpis?.medianCapacity ?? 0, { maximumFractionDigits: 0 })}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Select
              style={{ width: "100%" }}
              value={tierFilter}
              onChange={setTierFilter}
              options={[
                { label: "All Tiers", value: "All" },
                { label: "Tier 1", value: "Tier 1" },
                { label: "Tier 2", value: "Tier 2" },
                { label: "Tier 3", value: "Tier 3" },
                { label: "Tier 4", value: "Tier 4" },
              ]}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              style={{ width: "100%" }}
              value={drmFilter}
              onChange={setDrmFilter}
              options={[{ label: "All DRMs", value: "All" }, ...drms.map((drm) => ({ label: drm, value: drm }))]}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={11}>
          <Card size="small" title="Capacity Distribution">
            <Plot
              data={[
                {
                  type: "histogram",
                  x: filteredRows.map((row) => row?.estimatedCapacity ?? 0),
                  marker: { color: "#1c88ed" },
                  nbinsx: 20,
                },
              ]}
              layout={{
                autosize: true,
                height: 320,
                margin: { l: 50, r: 10, t: 10, b: 45 },
                xaxis: { title: "Estimated Capacity ($)" },
                yaxis: { title: "Donors" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={13}>
          <Card size="small" title="Top Unasked Donors (by Capacity)">
            <Table
              dataSource={topRows}
              size="small"
              pagination={{ pageSize: 10, size: "small" }}
              scroll={{ x: 750 }}
              columns={[
                { title: "Donor", dataIndex: "name", key: "name", ellipsis: true },
                {
                  title: "Tier",
                  dataIndex: "tier",
                  key: "tier",
                  render: (tier: string) => (
                    <Tag color={tier === "Tier 1" ? "volcano" : tier === "Tier 2" ? "gold" : tier === "Tier 3" ? "blue" : "default"}>
                      {tier}
                    </Tag>
                  ),
                },
                { title: "DRM", dataIndex: "drm", key: "drm", ellipsis: true },
                { title: "Years", dataIndex: "years", key: "years", render: (value: number) => safeCount(value ?? 0) },
                {
                  title: "Avg Annual",
                  dataIndex: "avgAnnual",
                  key: "avgAnnual",
                  render: (value: number) => safeCurrency(value ?? 0, { maximumFractionDigits: 0 }),
                },
                {
                  title: "Estimated Capacity",
                  dataIndex: "estimatedCapacity",
                  key: "estimatedCapacity",
                  render: (value: number) => safeCurrency(value ?? 0, { maximumFractionDigits: 0 }),
                  sorter: (a: UnaskedRow, b: UnaskedRow) =>
                    (a?.estimatedCapacity ?? 0) - (b?.estimatedCapacity ?? 0),
                  defaultSortOrder: "descend",
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
