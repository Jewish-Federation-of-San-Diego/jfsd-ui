import { Card, Col, Row, Statistic, Table, Tag, Typography, Spin, Alert, Space } from 'antd';
import {
  PhoneOutlined,
  MailOutlined,
  DollarOutlined,
  TeamOutlined,
  TrophyOutlined,
  RiseOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { DefinitionTooltip } from '../components/DefinitionTooltip';

const { Text, Title } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const GOLD = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';

// ── Types ───────────────────────────────────────────────────────────────
interface Donor {
  rank: number;
  name: string;
  phone: string;
  email: string;
  score: number;
  suggestedAsk: number;
  askReason: string;
  category: 'LYBUNT' | 'Upgrade' | 'Lapsed';
  lifetimeGiving: number;
  yearsGiving: number;
  lastGiftDate: string;
  fy24: number;
  fy25: number;
  fy26: number;
  avgAnnual: number;
}

interface PriorityBucket {
  priority: string;
  count: number;
  potential: number;
}

interface AskListData {
  asOfDate: string;
  totalPotentialRevenue: number;
  totalProspects: number;
  byPriority: PriorityBucket[];
  donors: Donor[];
  kpis: {
    totalPotential: number;
    top10Potential: number;
    lybuntCount: number;
    upgradeCount: number;
    lapsedCount: number;
  };
  _deceasedFiltered?: number;
}

const fmtUSD = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CATEGORY_COLORS: Record<string, string> = {
  LYBUNT: WARNING,
  Upgrade: '#1677ff',
  Lapsed: ERROR,
};

const CATEGORY_TAG: Record<string, string> = {
  LYBUNT: 'warning',
  Upgrade: 'processing',
  Lapsed: 'error',
};

// ── KPI Row ─────────────────────────────────────────────────────────────
function KPIRow({ kpis }: { kpis: AskListData['kpis'] }) {
  const items = [
    { title: 'Total Potential', value: fmtUSD(kpis.totalPotential), icon: <DollarOutlined />, color: NAVY },
    { title: 'Top 10 Potential', value: fmtUSD(kpis.top10Potential), icon: <TrophyOutlined />, color: GOLD },
    { title: 'LYBUNT', value: kpis.lybuntCount, icon: <HistoryOutlined />, color: WARNING },
    { title: 'Upgrade', value: kpis.upgradeCount, icon: <RiseOutlined />, color: '#1677ff' },
    { title: 'Lapsed', value: kpis.lapsedCount, icon: <TeamOutlined />, color: ERROR },
  ];
  return (
    <Row gutter={[12, 12]}>
      {items.map((item) => (
        <Col xs={12} sm={8} md={4} lg={4} xl={4} key={item.title}>
          <Card size="small" style={{ borderTop: `3px solid ${item.color}` }}>
            <Statistic
              title={<Text style={{ fontSize: 12 }}>{item.title === 'LYBUNT' ? <DefinitionTooltip term="LYBUNT" dashboardKey="ask-list">{item.title}</DefinitionTooltip> : item.title}</Text>}
              value={item.value}
              prefix={item.icon}
              valueStyle={{ fontSize: 18, fontWeight: 700, color: item.color }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

// ── Priority Summary ────────────────────────────────────────────────────
function PrioritySummary({ buckets }: { buckets: PriorityBucket[] }) {
  const colors = [GOLD, NAVY, '#6B7280'];
  return (
    <Row gutter={[12, 12]}>
      {buckets.map((b, i) => (
        <Col xs={24} sm={8} key={b.priority}>
          <Card
            size="small"
            style={{ borderLeft: `4px solid ${colors[i] || NAVY}` }}
          >
            <Text strong style={{ fontSize: 14 }}>{b.priority}</Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Text type="secondary">{b.count} prospects</Text>
              <Text strong style={{ color: colors[i] || NAVY }}>{fmtUSD(b.potential)}</Text>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

// ── Category Breakdown ──────────────────────────────────────────────────
function CategoryBreakdown({ donors }: { donors: Donor[] }) {
  const cats = ['LYBUNT', 'Upgrade', 'Lapsed'] as const;
  const counts = cats.map((c) => ({
    category: c,
    count: donors.filter((d) => d.category === c).length,
    potential: donors.filter((d) => d.category === c).reduce((s, d) => s + d.suggestedAsk, 0),
  }));
  const total = donors.length || 1;

  return (
    <Card size="small" title="Category Breakdown">
      {counts.map((c) => {
        const pct = Math.round((c.count / total) * 100);
        return (
          <div key={c.category} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Tag color={CATEGORY_TAG[c.category]}>{c.category}</Tag>
              <Text>{c.count} donors · {fmtUSD(c.potential)}</Text>
            </div>
            <div style={{ background: '#f0f0f0', borderRadius: 4, height: 20, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: CATEGORY_COLORS[c.category],
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: pct > 5 ? undefined : 24,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{pct}%</Text>
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ── Ask List Table ──────────────────────────────────────────────────────
function AskListTable({ donors }: { donors: Donor[] }) {
  const columns: ColumnsType<Donor> = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 48,
      sorter: (a, b) => a.rank - b.rank,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: <DefinitionTooltip term="Suggested Ask" dashboardKey="ask-list">Suggested Ask</DefinitionTooltip>,
      dataIndex: 'suggestedAsk',
      key: 'suggestedAsk',
      width: 130,
      sorter: (a, b) => a.suggestedAsk - b.suggestedAsk,
      defaultSortOrder: 'descend',
      render: (v: number) => (
        <Text strong style={{ fontSize: 15, color: NAVY }}>{fmtUSD(v)}</Text>
      ),
    },
    {
      title: 'Ask Reason',
      dataIndex: 'askReason',
      key: 'askReason',
      width: 220,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      filters: [
        { text: 'LYBUNT', value: 'LYBUNT' },
        { text: 'Upgrade', value: 'Upgrade' },
        { text: 'Lapsed', value: 'Lapsed' },
      ],
      onFilter: (value, record) => record.category === value,
      render: (cat: string) => <Tag color={CATEGORY_TAG[cat]}>{cat}</Tag>,
    },
    {
      title: 'FY24',
      dataIndex: 'fy24',
      key: 'fy24',
      width: 90,
      sorter: (a, b) => a.fy24 - b.fy24,
      render: (v: number) => v > 0 ? fmtUSD(v) : '—',
    },
    {
      title: 'FY25',
      dataIndex: 'fy25',
      key: 'fy25',
      width: 90,
      sorter: (a, b) => a.fy25 - b.fy25,
      render: (v: number) => v > 0 ? fmtUSD(v) : '—',
    },
    {
      title: 'FY26',
      dataIndex: 'fy26',
      key: 'fy26',
      width: 90,
      sorter: (a, b) => a.fy26 - b.fy26,
      render: (v: number) => v > 0 ? <Text style={{ color: SUCCESS }}>{fmtUSD(v)}</Text> : '—',
    },
    {
      title: 'Lifetime',
      dataIndex: 'lifetimeGiving',
      key: 'lifetimeGiving',
      width: 110,
      sorter: (a, b) => a.lifetimeGiving - b.lifetimeGiving,
      render: (v: number) => fmtUSD(v),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (v: string) =>
        v ? (
          <Space size={4}>
            <PhoneOutlined style={{ color: NAVY, fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{v}</Text>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (v: string) =>
        v ? (
          <Space size={4}>
            <MailOutlined style={{ color: NAVY, fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>{v}</Text>
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  const csvColumns = [
    { title: 'Rank', dataIndex: 'rank' },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Suggested Ask', dataIndex: 'suggestedAsk' },
    { title: 'Ask Reason', dataIndex: 'askReason' },
    { title: 'Category', dataIndex: 'category' },
    { title: 'FY24', dataIndex: 'fy24' },
    { title: 'FY25', dataIndex: 'fy25' },
    { title: 'FY26', dataIndex: 'fy26' },
    { title: 'Lifetime', dataIndex: 'lifetimeGiving' },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Email', dataIndex: 'email' },
  ];

  return (
    <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <CsvExport data={donors} columns={csvColumns} filename="weekly-ask-list" />
    </div>
    <Table<Donor>
      columns={columns}
      dataSource={donors}
      rowKey="rank"
      size="small"
      pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'] }}
      scroll={{ x: 1400 }}
      style={{ marginTop: 4 }}
    />
    </>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function WeeklyAskListDashboard() {
  const [data, setData] = useState<AskListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/jfsd-ui/data/weekly-ask-list.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: AskListData) => {
        // Filter out deceased donors (Z"L / Z'L) as safety net
        const isDeceased = (name: string) => /Z["'\u201c\u201d\u2018\u2019]L/i.test(name);
        const filtered = d.donors.filter((donor) => !isDeceased(donor.name));
        const removedCount = d.donors.length - filtered.length;
        // Re-rank and update counts
        filtered.forEach((donor, i) => { donor.rank = i + 1; });
        setData({
          ...d,
          donors: filtered,
          totalProspects: filtered.length,
          _deceasedFiltered: removedCount,
          kpis: { ...d.kpis, totalPotential: filtered.reduce((s, x) => s + x.suggestedAsk, 0) },
        } as AskListData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (error) return <Alert type="error" message="Failed to load ask list data" description={error} showIcon />;
  if (!data) return <Alert type="warning" message="No data available" showIcon />;

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      {(data._deceasedFiltered ?? 0) > 0 && (
        <Alert
          message={`${data._deceasedFiltered} deceased donor(s) automatically excluded`}
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ color: NAVY, margin: 0 }}>
          📋 Weekly Ask List
        </Title>
        <Text type="secondary">
          Prioritized outreach list · As of {data.asOfDate} · {data.totalProspects} prospects · {fmtUSD(data.totalPotentialRevenue)} potential
        </Text>
      </div>

      <KPIRow kpis={data.kpis} />

      <div style={{ marginTop: 16 }}>
        <PrioritySummary buckets={data.byPriority} />
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={18}>
          <Card size="small" title="Ask List" styles={{ body: { padding: 0 } }}>
            <AskListTable donors={data.donors} />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <CategoryBreakdown donors={data.donors} />
        </Col>
      </Row>
    </div>
  );
}
