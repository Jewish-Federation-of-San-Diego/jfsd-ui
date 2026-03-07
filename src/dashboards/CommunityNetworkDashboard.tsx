import { Card, Col, Input, Row, Select, Statistic, Typography } from "antd";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { NAVY } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { safeCount } from "../utils/formatters";

const { Title } = Typography;

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
  board: "#1c88ed",
  campaign: "#236B4A",
  society: "#C5A258",
  community: "#8B6914",
  synagogue: "#5B8DB8",
  committee: "#9B4DCA",
  central: "#1B365D",
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
      .attr("stroke", "#D9D9D9")
      .attr("stroke-opacity", 0.65)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.max(0.6, d?.weight ?? 1));

    const node = (g
      .append("g")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 1)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => Math.min(Math.max((d?.size ?? 8) * 0.35, 4), 20))
      .attr("fill", (d) => GROUP_COLORS[d?.group ?? "other"] ?? "#1c88ed")) as d3.Selection<
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
      .attr("fill", "#555")
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
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Community Network
      </Title>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Visible Nodes" value={safeCount(filtered?.nodes?.length ?? 0)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Visible Edges" value={safeCount(filtered?.links?.length ?? 0)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Node Types"
              value={safeCount(new Set(filtered?.nodes?.map((n) => n?.type ?? "unknown")).size)}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
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

      <Card size="small" title="D3 Force-Directed Network (drag nodes, scroll to zoom)">
        <svg ref={svgRef} viewBox="0 0 1100 620" style={{ width: "100%", height: 620, border: "1px solid #F0F0F0" }} />
      </Card>
    </div>
  );
}
