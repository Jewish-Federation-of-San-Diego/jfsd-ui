import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safeCurrency, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, ERROR, WARNING, MUTED, DEVELOPMENT } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";

const { Title, Text } = Typography;

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
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={DEVELOPMENT}>Development</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          The Unasked
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>Donors with modeled capacity and no tracked solicitation activity.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Unasked Count" value={safeCount(kpis?.count ?? 0)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Estimated Capacity"
              value={safeCurrency(kpis?.totalCapacity ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Median Capacity"
              value={safeCurrency(kpis?.medianCapacity ?? 0, { maximumFractionDigits: 0 })}
            />
            <Text style={{ color: MUTED }}>Average: {safeNumber(kpis.count > 0 ? kpis.totalCapacity / kpis.count : 0, { maximumFractionDigits: 0 })}</Text>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
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

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        {safeCount(kpis?.count ?? 0)} unasked donors — {safeCurrency(kpis?.totalCapacity ?? 0, { maximumFractionDigits: 0 })} estimated capacity, {safeCurrency(kpis?.medianCapacity ?? 0, { maximumFractionDigits: 0 })} median
      </Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={11}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[
                {
                  type: "histogram",
                  x: filteredRows.map((row) => row?.estimatedCapacity ?? 0),
                  marker: { color: PLOTLY_COLORS[0] },
                },
              ]}
              layout={{
                ...PLOTLY_BASE_LAYOUT,
                height: 320,
                xaxis: { title: "Estimated Capacity ($)" },
                yaxis: { title: "Donors" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={13}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
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
                    <Tag color={tier === "Tier 1" ? ERROR : tier === "Tier 2" ? WARNING : tier === "Tier 3" ? NAVY : MUTED}>
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

      <DataFreshness asOfDate={data?.generated ?? ""} />
    </Space>
  );
}
