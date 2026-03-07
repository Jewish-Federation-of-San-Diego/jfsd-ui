import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Input, Select } from "antd";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safePercent, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, WARNING, MUTED, ANALYTICS } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_COLORS } from "../utils/dashboardStyles";

const { Title, Text } = Typography;

interface NetworkNode {
  id?: string;
  name?: string;
  type?: string;
  group?: string;
  size?: number;
}

interface NetworkLink {
  source?: string;
  target?: string;
  type?: string;
  label?: string;
  weight?: number;
}

interface NetworkResponse {
  nodes?: NetworkNode[];
  links?: NetworkLink[];
}

type SimNode = NetworkNode & d3.SimulationNodeDatum & { id: string; name: string; size: number };
type SimLink = d3.SimulationLinkDatum<SimNode> & NetworkLink;

const GROUP_COLORS: Record<string, string> = {
  board: PLOTLY_COLORS[0],
  campaign: PLOTLY_COLORS[1],
  society: PLOTLY_COLORS[2],
  community: PLOTLY_COLORS[5],
  synagogue: PLOTLY_COLORS[4],
  committee: PLOTLY_COLORS[6],
  central: NAVY,
};

export function CommunityNetworkDashboard() {
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minSize, setMinSize] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    fetchJson<NetworkResponse>(`${import.meta.env.BASE_URL}data/network-data.json`)
      .then(setData)
      .catch((err) => setError((err as Error)?.message ?? "Failed to load community network data"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const nodes = (Array.isArray(data?.nodes) ? data?.nodes : []).map((node) => ({
      id: node?.id ?? "",
      name: node?.name ?? "Unknown",
      type: node?.type ?? "unknown",
      group: node?.group ?? "other",
      size: Number.isFinite(node?.size) ? Number(node?.size) : 8,
    }));
    const validNodes = nodes.filter((node) => node?.id && node?.size >= minSize);
    const q = search.trim().toLowerCase();
    const searched = q ? validNodes.filter((node) => node?.name.toLowerCase().includes(q)) : validNodes;
    const keepIds = new Set(searched.map((node) => node?.id));
    const links = (Array.isArray(data?.links) ? data?.links : []).filter((link) => {
      const source = link?.source ?? "";
      const target = link?.target ?? "";
      return keepIds.has(source) && keepIds.has(target);
    });
    return { nodes: searched, links };
  }, [data, minSize, search]);

  const summaryRows = useMemo(() => {
    const degree = new Map<string, number>();
    filtered.links.forEach((link) => {
      const source = link?.source ?? "";
      const target = link?.target ?? "";
      degree.set(source, (degree.get(source) ?? 0) + 1);
      degree.set(target, (degree.get(target) ?? 0) + 1);
    });
    return filtered.nodes
      .map((node, index) => ({
        key: node?.id || `node-${index}`,
        name: node?.name ?? "Unknown",
        type: node?.type ?? "unknown",
        group: node?.group ?? "other",
        size: node?.size ?? 0,
        degree: degree.get(node?.id ?? "") ?? 0,
      }))
      .sort((a, b) => (b?.degree ?? 0) - (a?.degree ?? 0))
      .slice(0, 20);
  }, [filtered]);

  const avgDegree = useMemo(() => {
    if (filtered.nodes.length === 0) return 0;
    return (filtered.links.length * 2) / filtered.nodes.length;
  }, [filtered]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth > 0 ? svgRef.current.clientWidth : 1100;
    const height = 620;

    const g = svg.append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 6])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });
    svg.call(zoom);

    const nodes: SimNode[] = filtered.nodes.map((node) => ({
      ...node,
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      index: 0,
    }));
    const links: SimLink[] = filtered.links.map((link) => ({
      ...link,
      source: link?.source ?? "",
      target: link?.target ?? "",
      weight: Number.isFinite(link?.weight) ? Number(link?.weight) : 1,
      index: 0,
    }));

    const link = g
      .append("g")
      .attr("stroke", MUTED)
      .attr("stroke-opacity", 0.65)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.max(0.6, d?.weight ?? 1));

    const node = (g
      .append("g")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => Math.min(Math.max((d?.size ?? 8) * 0.35, 4), 20))
      .attr("fill", (d) => GROUP_COLORS[d?.group ?? "other"] ?? NAVY)) as d3.Selection<
      SVGCircleElement,
      SimNode,
      SVGGElement,
      unknown
    >;

    node.call(
      d3
        .drag<SVGCircleElement, SimNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.25).restart();
          d.fx = d.x ?? null;
          d.fy = d.y ?? null;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as unknown as d3.DragBehavior<SVGCircleElement, SimNode, SimNode | d3.SubjectPosition>,
    );

    node.append("title").text((d) => `${d?.name ?? "Unknown"} (${d?.type ?? "node"})`);

    const labels = g
      .append("g")
      .selectAll("text")
      .data(nodes.filter((n) => (n?.size ?? 0) >= 16))
      .join("text")
      .text((d) => d?.name ?? "")
      .attr("font-size", 10)
      .attr("fill", MUTED)
      .attr("dy", -10)
      .attr("text-anchor", "middle");

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => Math.max(35, 90 - ((d?.weight ?? 1) * 8)))
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-140))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => Math.min(Math.max((d?.size ?? 8) * 0.4, 6), 24)));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => ((d.source as SimNode)?.x ?? 0))
        .attr("y1", (d) => ((d.source as SimNode)?.y ?? 0))
        .attr("x2", (d) => ((d.target as SimNode)?.x ?? 0))
        .attr("y2", (d) => ((d.target as SimNode)?.y ?? 0));

      node.attr("cx", (d) => d?.x ?? 0).attr("cy", (d) => d?.y ?? 0);

      labels.attr("x", (d) => d?.x ?? 0).attr("y", (d) => d?.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [filtered]);

  if (loading) return <DashboardSkeleton kpiCount={3} hasChart />;
  if (error) return <DashboardErrorState message="Failed to load community network data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={ANALYTICS}>Analytics</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Community Network
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>
        Force-directed donor relationship graph with giving-level filtering, search, and zoom.
      </Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Visible Nodes" value={safeCount(filtered?.nodes?.length ?? 0)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Visible Edges" value={safeCount(filtered?.links?.length ?? 0)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Average Degree"
              value={safeNumber(avgDegree, { maximumFractionDigits: 1 })}
              valueStyle={{ color: GOLD }}
            />
            <Text style={{ color: MUTED }}>Type count: {safeCount(new Set(filtered.nodes.map((n) => n?.type ?? "unknown")).size)}</Text>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Input.Search
              allowClear
              value={search}
              onChange={(event) => setSearch(event?.target?.value ?? "")}
              placeholder="Search donor or organization..."
            />
          </Col>
          <Col xs={24} md={12}>
            <Select<number>
              style={{ width: "100%" }}
              value={minSize}
              onChange={setMinSize}
              options={[
                { label: "All giving levels", value: 0 },
                { label: "Medium and above", value: 10 },
                { label: "Major nodes", value: 16 },
                { label: "Top tier only", value: 24 },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        {safeCount(filtered?.nodes?.length ?? 0)} nodes, {safeCount(filtered?.links?.length ?? 0)} edges — avg degree {safeNumber(avgDegree, { maximumFractionDigits: 1 })}
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <svg ref={svgRef} viewBox="0 0 1100 620" style={{ width: "100%", height: 620, border: `1px solid ${MUTED}` }} />
      </Card>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Top {safeCount(summaryRows.length)} most connected nodes
      </Title>
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table
          size="small"
          dataSource={summaryRows}
          pagination={{ pageSize: 10, size: "small" }}
          columns={[
            { title: "Name", dataIndex: "name", key: "name", ellipsis: true },
            { title: "Type", dataIndex: "type", key: "type", render: (value: string) => <Tag color={SUCCESS}>{value}</Tag> },
            { title: "Group", dataIndex: "group", key: "group", render: (value: string) => <Tag color={WARNING}>{value}</Tag> },
            { title: "Node Size", dataIndex: "size", key: "size", render: (value: number) => safeCount(value ?? 0) },
            { title: "Degree", dataIndex: "degree", key: "degree", render: (value: number) => safeCount(value ?? 0) },
            {
              title: "Share",
              key: "share",
              render: (_: unknown, row: { degree: number }) =>
                safePercent(filtered.links.length > 0 ? (row.degree / (filtered.links.length * 2)) * 100 : 0, { decimals: 1 }),
            },
          ]}
        />
      </Card>

      <DataFreshness asOfDate="" />
    </Space>
  );
}
