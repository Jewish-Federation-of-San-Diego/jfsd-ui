import { useState, useEffect, useMemo } from 'react';
import { Card, Col, Row, Statistic, Tag, Input, Select, Checkbox, Table, Typography, Grid } from 'antd';
import {
  FireOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { NAVY, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCount } from '../utils/formatters';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface TrackerItem {
  id: string;
  title: string;
  description: string;
  column: string;
  swimLane: string;
  priority: string;
  effort: string;
  owner: string;
  blocker: string | null;
  lastTouched: string;
  source: string;
  tags: string[];
}

interface TrackerData {
  asOfDate: string;
  kpis: { totalItems: number; thisWeek: number; blocked: number; completedThisMonth: number };
  columns: string[];
  columnLabels: Record<string, string>;
  swimLanes: string[];
  items: TrackerItem[];
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#C4314B',
  P1: '#D4880F',
  P2: '#C5A258',
  P3: '#8C8C8C',
};

const SWIM_LANE_COLORS: Record<string, string> = {
  'Federation Analytics': '#4DA3FF',
  'Finance & Accounting': '#1B365D',
  'Facilities & Ops': '#3D8B37',
  'Advancement Services': '#C5A258',
  'System Integrations': '#5B8DB8',
  'Agent Architecture': '#9B4DCA',
};

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ItemCard({ item, columnKey }: { item: TrackerItem; columnKey: string }) {
  const isBlocked = columnKey === 'blocked';
  const isDone = columnKey === 'done';

  return (
    <div
      style={{
        background: isBlocked ? 'rgba(196, 49, 75, 0.06)' : '#fff',
        borderLeft: `4px solid ${isDone ? SUCCESS : PRIORITY_COLORS[item.priority] || MUTED}`,
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 8,
        opacity: isDone ? 0.7 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{item.title}</Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        <Tag
          style={{
            fontSize: 10,
            lineHeight: '16px',
            padding: '0 6px',
            background: SWIM_LANE_COLORS[item.swimLane] || MUTED,
            color: ['Finance & Accounting'].includes(item.swimLane) ? '#fff' : '#fff',
            border: 'none',
          }}
        >
          {item.swimLane}
        </Tag>
        <Tag
          style={{
            fontSize: 10,
            lineHeight: '16px',
            padding: '0 6px',
            color: PRIORITY_COLORS[item.priority],
            borderColor: PRIORITY_COLORS[item.priority],
          }}
        >
          {item.priority}
        </Tag>
        <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>{item.owner}</Tag>
        {item.effort && (
          <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', color: MUTED, borderColor: '#E8E8ED' }}>
            {item.effort}
          </Tag>
        )}
      </div>
      {item.blocker && (
        <Text style={{ fontSize: 11, color: ERROR, display: 'block', marginBottom: 4 }}>
          ⚠ {item.blocker}
        </Text>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: MUTED }}>Last: {formatDate(item.lastTouched)}</Text>
        <Text style={{ fontSize: 10, color: MUTED }}>{item.source}</Text>
      </div>
    </div>
  );
}

export function ProjectTrackerDashboard() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState<string | undefined>(undefined);
  const [ownerFilter, setOwnerFilter] = useState<string | undefined>(undefined);
  const [priorityFilter, setPriorityFilter] = useState<string[]>(['P0', 'P1', 'P2', 'P3']);
  const screens = useBreakpoint();

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<TrackerData>(`${import.meta.env.BASE_URL}data/project-tracker.json`);
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const items = data.items ?? [];
    return items.filter(item => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (laneFilter && item.swimLane !== laneFilter) return false;
      if (ownerFilter && item.owner !== ownerFilter) return false;
      if (!priorityFilter.includes(item.priority)) return false;
      return true;
    });
  }, [data, search, laneFilter, ownerFilter, priorityFilter]);

  const owners = useMemo(() => {
    if (!data) return [];
    return [...new Set((data.items ?? []).map(i => i.owner))].sort();
  }, [data]);

  if (loading) return <DashboardSkeleton kpiCount={4} hasChart={false} hasTable />;
  if (error) return <DashboardErrorState message="Failed to load project tracker data" description={error} />;
  if (!data) return <DashboardErrorState message="Missing project tracker data" />;

  const kpis = data.kpis ?? { totalItems: 0, thisWeek: 0, blocked: 0, completedThisMonth: 0 };
  const columns = data.columns ?? [];
  const columnLabels = data.columnLabels ?? {};
  const swimLanes = data.swimLanes ?? [];
  const isMobile = !screens.md;

  const columnGroups = columns.map(col => ({
    key: col,
    label: columnLabels[col] ?? col,
    items: filtered.filter(i => i.column === col),
  }));

  const tableColumns = [
    { title: 'Title', dataIndex: 'title', key: 'title', sorter: (a: TrackerItem, b: TrackerItem) => a.title.localeCompare(b.title) },
    {
      title: 'Priority', dataIndex: 'priority', key: 'priority', width: 70,
      sorter: (a: TrackerItem, b: TrackerItem) => a.priority.localeCompare(b.priority),
      render: (p: string) => <Tag style={{ color: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }}>{p}</Tag>,
    },
    {
      title: 'Column', dataIndex: 'column', key: 'column', width: 120,
      sorter: (a: TrackerItem, b: TrackerItem) => columns.indexOf(a.column) - columns.indexOf(b.column),
      render: (c: string) => columnLabels[c] || c,
    },
    {
      title: 'Swim Lane', dataIndex: 'swimLane', key: 'swimLane', width: 160,
      sorter: (a: TrackerItem, b: TrackerItem) => a.swimLane.localeCompare(b.swimLane),
      render: (s: string) => (
        <Tag style={{ background: SWIM_LANE_COLORS[s], color: '#fff', border: 'none', fontSize: 11 }}>{s}</Tag>
      ),
    },
    { title: 'Owner', dataIndex: 'owner', key: 'owner', width: 100 },
    { title: 'Effort', dataIndex: 'effort', key: 'effort', width: 80 },
    {
      title: 'Last Touched', dataIndex: 'lastTouched', key: 'lastTouched', width: 110,
      sorter: (a: TrackerItem, b: TrackerItem) => a.lastTouched.localeCompare(b.lastTouched),
      render: (d: string) => formatDate(d),
    },
    { title: 'Source', dataIndex: 'source', key: 'source', width: 140 },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <DataFreshness asOfDate={data.asOfDate ?? ''} />

      {/* KPI Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${NAVY}` }}>
            <Statistic
              title={<DefinitionTooltip term="Swim Lane" dashboardKey="projects">Total Items</DefinitionTooltip>}
              value={safeCount(kpis.totalItems)}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${WARNING}` }}>
            <Statistic title="This Week" value={safeCount(kpis.thisWeek)} prefix={<FireOutlined />} valueStyle={{ color: WARNING }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${ERROR}` }}>
            <Statistic title="Blocked" value={safeCount(kpis.blocked)} prefix={<PauseCircleOutlined />} valueStyle={{ color: ERROR }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${SUCCESS}` }}>
            <Statistic title="Done This Month" value={safeCount(kpis.completedThisMonth)} prefix={<CheckCircleOutlined />} valueStyle={{ color: SUCCESS }} />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <Input.Search
            placeholder="Search items..."
            allowClear
            style={{ width: 220 }}
            onSearch={setSearch}
            onChange={e => !e.target.value && setSearch('')}
          />
          <Select
            placeholder="Swim Lane"
            allowClear
            style={{ width: 180 }}
            value={laneFilter}
            onChange={setLaneFilter}
            options={swimLanes.map(s => ({ label: s, value: s }))}
          />
          <Select
            placeholder="Owner"
            allowClear
            style={{ width: 140 }}
            value={ownerFilter}
            onChange={setOwnerFilter}
            options={owners.map(o => ({ label: o, value: o }))}
          />
          <Checkbox.Group
            value={priorityFilter}
            onChange={v => setPriorityFilter(v as string[])}
            options={['P0', 'P1', 'P2', 'P3'].map(p => ({
              label: <Tag style={{ color: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p], margin: 0 }}>{p}</Tag>,
              value: p,
            }))}
          />
        </div>
      </Card>

      {/* Kanban Board */}
      {isMobile ? (
        // Mobile: vertical list grouped by column
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {columnGroups.map(col => (
            <Card
              key={col.key}
              size="small"
              title={<span>{col.label} <Tag>{col.items.length}</Tag></span>}
            >
              {col.items.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>No items</Text>
              ) : (
                col.items.map(item => <ItemCard key={item.id} item={item} columnKey={col.key} />)
              )}
            </Card>
          ))}
        </div>
      ) : (
        // Desktop: horizontal kanban
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, overflowX: 'auto' }}>
          {columnGroups.map(col => (
            <div
              key={col.key}
              style={{
                flex: col.key === 'done' ? '1 1 180px' : '1 1 220px',
                minWidth: 200,
                background: '#F5F5F7',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text strong style={{ fontSize: 13 }}>{col.label}</Text>
                <Tag style={{ borderRadius: 10, fontSize: 11 }}>{col.items.length}</Tag>
              </div>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {col.items.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>No items</Text>
                ) : (
                  col.items.map(item => <ItemCard key={item.id} item={item} columnKey={col.key} />)
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Table */}
      <Card
        size="small"
        title={
          filtered.length > 0 
            ? `${filtered.length} project items — ${filtered.filter(i => i.column === 'blocked').length} blocked, ${filtered.filter(i => i.column === 'done').length} done`
            : "All Items"
        }
        extra={
          <CsvExport
            data={filtered}
            columns={tableColumns.map(c => ({ title: String(c.title), dataIndex: c.dataIndex }))}
            filename="project-tracker"
          />
        }
      >
        <Table
          dataSource={filtered}
          columns={tableColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
}
