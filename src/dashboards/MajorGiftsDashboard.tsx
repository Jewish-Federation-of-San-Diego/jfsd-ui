import { Card, Col, Row, Statistic, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { NAVY, GOLD, SUCCESS } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { safeCount, safeCurrency, safePercent } from "../utils/formatters";

const { Title } = Typography;

interface PipelineRecord {
  Id?: string;
  Name?: string;
  StageName?: string;
  Amount?: number;
  CloseDate?: string;
  Owner?: { Name?: string | null } | null;
  Account?: { Name?: string | null } | null;
}

interface PipelineResponse {
  fetchedAt?: string;
  records?: PipelineRecord[];
}

type StageBucket = "Cultivation" | "Solicitation" | "Pending" | "Closed";

function mapStage(stageName: string | undefined): StageBucket {
  const stage = (stageName ?? "").toLowerCase();
  if (stage.includes("cultivation") || stage.includes("qualification")) return "Cultivation";
  if (stage.includes("solicitation")) return "Solicitation";
  if (stage.includes("closed")) return "Closed";
  return "Pending";
}

export function MajorGiftsDashboard() {
  const [data, setData] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<PipelineResponse>(`${import.meta.env.BASE_URL}data/pipeline-data.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load major gifts data"))
      .finally(() => setLoading(false));
  }, []);

  const records = useMemo(() => (Array.isArray(data?.records) ? data?.records : []), [data]);

  const stageStats = useMemo(() => {
    const base: Record<StageBucket, { count: number; value: number }> = {
      Cultivation: { count: 0, value: 0 },
      Solicitation: { count: 0, value: 0 },
      Pending: { count: 0, value: 0 },
      Closed: { count: 0, value: 0 },
    };
    records.forEach((record) => {
      const bucket = mapStage(record?.StageName);
      const amount = record?.Amount ?? 0;
      base[bucket].count += 1;
      base[bucket].value += amount;
    });
    return base;
  }, [records]);

  const kpis = useMemo(() => {
    const openRecords = records.filter((record) => !(record?.StageName ?? "").toLowerCase().includes("closed lost"));
    const closedWon = records.filter((record) => (record?.StageName ?? "").toLowerCase().includes("closed won")).length;
    const closedLost = records.filter((record) => (record?.StageName ?? "").toLowerCase().includes("closed lost")).length;
    const pipelineValue = openRecords.reduce((sum, record) => sum + (record?.Amount ?? 0), 0);
    const avgGiftSize = openRecords.length > 0 ? pipelineValue / openRecords.length : 0;
    const closeRate = closedWon + closedLost > 0 ? (closedWon / (closedWon + closedLost)) * 100 : 0;
    return { pipelineValue, avgGiftSize, closeRate };
  }, [records]);

  const topProspects = useMemo(
    () =>
      [...records]
        .filter((record) => !(record?.StageName ?? "").toLowerCase().includes("closed"))
        .sort((a, b) => (b?.Amount ?? 0) - (a?.Amount ?? 0))
        .slice(0, 20)
        .map((record) => ({
          key: record?.Id ?? record?.Name ?? "prospect",
          name: record?.Account?.Name ?? "Unknown",
          opportunity: record?.Name ?? "Unnamed",
          stage: record?.StageName ?? "Unknown",
          owner: record?.Owner?.Name ?? "Unassigned",
          amount: record?.Amount ?? 0,
          closeDate: record?.CloseDate ?? "—",
        })),
    [records],
  );

  if (loading) return <DashboardSkeleton kpiCount={3} />;
  if (error) return <DashboardErrorState message="Failed to load major gifts data" description={error} />;

  return (
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Major Gifts Pipeline
      </Title>
      <DataFreshness asOfDate={data?.fetchedAt ?? ""} />

      <Row gutter={[12, 12]} style={{ marginTop: 8, marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Pipeline Value"
              value={safeCurrency(kpis?.pipelineValue ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: NAVY }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Avg Gift Size"
              value={safeCurrency(kpis?.avgGiftSize ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Close Rate"
              value={safePercent(kpis?.closeRate ?? 0, { decimals: 1 })}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Pipeline Funnel">
            <Plot
              data={[
                {
                  type: "funnel",
                  y: ["Cultivation", "Solicitation", "Pending", "Closed"],
                  x: [
                    stageStats?.Cultivation?.value ?? 0,
                    stageStats?.Solicitation?.value ?? 0,
                    stageStats?.Pending?.value ?? 0,
                    stageStats?.Closed?.value ?? 0,
                  ],
                  textinfo: "value+percent previous",
                  marker: { color: ["#1c88ed", "#236B4A", "#C5A258", "#1B365D"] },
                },
              ]}
              layout={{
                autosize: true,
                height: 320,
                margin: { l: 90, r: 15, t: 10, b: 20 },
              }}
              style={{ width: "100%" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Stage Distribution (Count)">
            <Plot
              data={[
                {
                  type: "pie",
                  labels: ["Cultivation", "Solicitation", "Pending", "Closed"],
                  values: [
                    stageStats?.Cultivation?.count ?? 0,
                    stageStats?.Solicitation?.count ?? 0,
                    stageStats?.Pending?.count ?? 0,
                    stageStats?.Closed?.count ?? 0,
                  ],
                  marker: { colors: ["#1c88ed", "#236B4A", "#C5A258", "#1B365D"] },
                  textinfo: "label+percent",
                },
              ]}
              layout={{
                autosize: true,
                height: 320,
                margin: { l: 10, r: 10, t: 10, b: 10 },
                showlegend: false,
              }}
              style={{ width: "100%" }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Top Prospects" style={{ marginTop: 12 }}>
        <Table
          dataSource={topProspects}
          size="small"
          pagination={{ pageSize: 10, size: "small" }}
          scroll={{ x: 850 }}
          columns={[
            { title: "Prospect", dataIndex: "name", key: "name", ellipsis: true },
            { title: "Opportunity", dataIndex: "opportunity", key: "opportunity", ellipsis: true },
            {
              title: "Stage",
              dataIndex: "stage",
              key: "stage",
              render: (stage: string) => <Tag color="blue">{stage ?? "Unknown"}</Tag>,
            },
            { title: "Owner", dataIndex: "owner", key: "owner", ellipsis: true },
            {
              title: "Amount",
              dataIndex: "amount",
              key: "amount",
              render: (value: number) => safeCurrency(value ?? 0, { maximumFractionDigits: 0 }),
              sorter: (a: { amount: number }, b: { amount: number }) => (a?.amount ?? 0) - (b?.amount ?? 0),
              defaultSortOrder: "descend",
            },
            { title: "Close Date", dataIndex: "closeDate", key: "closeDate", render: (v: string) => v ?? "—" },
          ]}
        />
      </Card>

      <Card size="small" style={{ marginTop: 12 }} title="Stage Summary">
        <Row gutter={[12, 12]}>
          {(["Cultivation", "Solicitation", "Pending", "Closed"] as StageBucket[]).map((stage) => (
            <Col xs={24} sm={12} md={6} key={stage}>
              <Card size="small">
                <Statistic title={stage} value={safeCount(stageStats?.[stage]?.count ?? 0)} />
                <div>{safeCurrency(stageStats?.[stage]?.value ?? 0, { maximumFractionDigits: 0 })}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
