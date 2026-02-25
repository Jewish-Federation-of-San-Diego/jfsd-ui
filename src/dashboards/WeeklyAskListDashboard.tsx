import { Card, Col, Row, Statistic, Table, Tag, Typography, Alert, Space, Tabs, Tooltip as AntTooltip, Progress, Badge } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import {
  PhoneOutlined,
  MailOutlined,
  DollarOutlined,
  TeamOutlined,
  TrophyOutlined,
  RiseOutlined,
  HistoryOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback, useRef } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

const { Text, Title } = Typography;

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

// ── Silence / Risk Alert Types ──────────────────────────────────────────
interface TierSummary { tier: string; count: number; revenueAtRisk: number; color: string; }
interface RiskDonor {
  name: string; phone: string; email: string; fy25Amount: number;
  lifetimeGiving: number; avgAnnual: number; lastGiftDate: string;
  riskScore: number; riskTier: string; riskFactors: string[]; daysSinceGift: number;
}
interface RiskKPIs {
  totalAtRisk: number; revenueAtRisk: number; criticalCount: number;
  criticalRevenue: number; avgDaysSinceGift: number;
}
interface SilenceData {
  asOfDate: string; count: number; revenueAtRisk: number;
  byTier: TierSummary[]; donors: RiskDonor[]; kpis: RiskKPIs;
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

const TIER_COLORS: Record<string, string> = {
  Critical: ERROR, High: WARNING, Medium: GOLD, Watch: SUCCESS,
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

// ── Risk Distribution Bar ───────────────────────────────────────────────
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [, setWidth] = useState(0);
  const measure = useCallback(() => {
    if (ref.current) { const w = ref.current.getBoundingClientRect().width; if (w > 0) setWidth(Math.floor(w)); }
  }, []);
  useEffect(() => { requestAnimationFrame(measure); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [measure]);
  return { ref };
}

function RiskDistributionBar({ tiers, total }: { tiers: TierSummary[]; total: number }) {
  const { ref } = useWidth();
  if (!total) return null;
  return (
    <Card size="small" title={<Text strong style={{ color: NAVY }}>Risk Distribution</Text>} style={{ marginBottom: 16 }}>
      <div ref={ref}>
        <div style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
          {tiers.filter(t => t.count > 0).map(t => {
            const pct = (t.revenueAtRisk / total) * 100;
            return (
              <AntTooltip key={t.tier} title={`${t.tier}: ${t.count} donors — ${fmtUSD(t.revenueAtRisk)} (${pct.toFixed(1)}%)`}>
                <div style={{ width: `${pct}%`, background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                  {pct > 8 && `${t.tier}`}
                </div>
              </AntTooltip>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {tiers.map(t => (
            <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: t.color }} />
              <Text style={{ fontSize: 12 }}>{t.tier}: {t.count} ({fmtUSD(t.revenueAtRisk)})</Text>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Risk Alerts Tab Content ─────────────────────────────────────────────
function RiskAlertsContent() {
  const [data, setData] = useState<SilenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/jfsd-ui/data/silence-alerts.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <Alert type="error" message="Failed to load risk alerts" description={error} showIcon style={{ margin: 24 }} />;
  if (!data) return null;

  const { kpis, byTier, donors } = data;

  const columns: ColumnsType<RiskDonor> = [
    {
      title: 'Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v: string, r: RiskDonor) => <><Text strong>{v}</Text>{r.riskTier === 'Critical' && <ExclamationCircleOutlined style={{ color: ERROR, marginLeft: 6 }} />}</>
    },
    {
      title: 'FY25 Amount', dataIndex: 'fy25Amount', key: 'fy25Amount', sorter: (a, b) => a.fy25Amount - b.fy25Amount,
      render: (v: number) => <Text strong style={{ color: NAVY }}>{fmtUSD(v)}</Text>, align: 'right' as const,
    },
    {
      title: 'Lifetime', dataIndex: 'lifetimeGiving', key: 'lifetime', sorter: (a, b) => a.lifetimeGiving - b.lifetimeGiving,
      render: (v: number) => fmtUSD(v), align: 'right' as const,
    },
    {
      title: 'Last Gift', dataIndex: 'lastGiftDate', key: 'lastGift',
      sorter: (a, b) => (a.lastGiftDate || '').localeCompare(b.lastGiftDate || ''),
      render: (v: string, r: RiskDonor) => v ? <AntTooltip title={`${r.daysSinceGift} days ago`}>{new Date(v).toLocaleDateString()}</AntTooltip> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Risk', dataIndex: 'riskScore', key: 'risk', sorter: (a, b) => a.riskScore - b.riskScore, defaultSortOrder: 'descend' as const,
      render: (v: number, r: RiskDonor) => (
        <AntTooltip title={r.riskFactors.join(' · ')}>
          <Tag color={TIER_COLORS[r.riskTier]} style={{ fontWeight: 600, minWidth: 36, textAlign: 'center' }}>{v}</Tag>
        </AntTooltip>
      ),
    },
    {
      title: 'Risk Factors', dataIndex: 'riskFactors', key: 'factors', width: 280,
      render: (factors: string[]) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{factors.slice(0, 3).map((f, i) => <Tag key={i} style={{ fontSize: 11, margin: 0 }}>{f}</Tag>)}</div>
    },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (v: string) => v ? <a href={`mailto:${v}`}>{v}</a> : <Text type="secondary">—</Text> },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (v: string) => v || <Text type="secondary">—</Text> },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ color: NAVY, margin: 0 }}>🔕 Risk Alerts — LYBUNT Donors at Risk</Title>
        <Text type="secondary">Donors who gave in Annual Campaign 25 but have not yet given to AC26. As of {new Date(data.asOfDate).toLocaleDateString()}</Text>
      </div>

      {/* KPI Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${NAVY}` }}>
            <Statistic title="Donors at Risk" value={kpis.totalAtRisk} prefix={<WarningOutlined style={{ color: WARNING }} />} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${ERROR}` }}>
            <Statistic title={<DefinitionTooltip term="Revenue at Risk" dashboardKey="silence">Revenue at Risk</DefinitionTooltip>} value={kpis.revenueAtRisk} prefix={<DollarOutlined style={{ color: ERROR }} />} formatter={v => fmtUSD(Number(v))} valueStyle={{ color: ERROR }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${ERROR}` }}>
            <Statistic title={<DefinitionTooltip term="Risk Tiers" dashboardKey="silence">Critical Donors</DefinitionTooltip>} value={kpis.criticalCount} prefix={<ExclamationCircleOutlined style={{ color: ERROR }} />} valueStyle={{ color: ERROR }} suffix={<Text style={{ fontSize: 13, color: MUTED }}>{fmtUSD(kpis.criticalRevenue)}</Text>} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderTop: `3px solid ${GOLD}` }}>
            <Statistic title={<DefinitionTooltip term="Risk Score" dashboardKey="silence">Avg Days Since Gift</DefinitionTooltip>} value={kpis.avgDaysSinceGift} prefix={<ClockCircleOutlined style={{ color: GOLD }} />} valueStyle={{ color: NAVY }} suffix="days" />
          </Card>
        </Col>
      </Row>

      {/* Tier Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {byTier.map(t => (
          <Col xs={12} sm={6} key={t.tier}>
            <Card size="small" style={{ borderLeft: `4px solid ${t.color}`, background: `${t.color}08` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text strong style={{ color: t.color, fontSize: 15 }}>{t.tier}</Text>
                <Text style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{t.count}</Text>
              </div>
              <Text style={{ color: MUTED, fontSize: 13 }}>{fmtUSD(t.revenueAtRisk)} at risk</Text>
              <Progress percent={Math.round((t.count / data.count) * 100)} strokeColor={t.color} showInfo={false} size="small" style={{ marginTop: 4 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Risk Distribution Bar */}
      <RiskDistributionBar tiers={byTier} total={data.revenueAtRisk} />

      {/* Donor Table */}
      <Card size="small" title={<Text strong style={{ color: NAVY }}>Donor Detail</Text>}
        extra={<CsvExport data={donors} columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'FY25 Amount', dataIndex: 'fy25Amount' },
          { title: 'Lifetime', dataIndex: 'lifetimeGiving' },
          { title: 'Last Gift', dataIndex: 'lastGiftDate' },
          { title: 'Risk Score', dataIndex: 'riskScore' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Phone', dataIndex: 'phone' },
        ]} filename="silence-alerts" />}
        style={{ marginBottom: 16 }}>
        <Table<RiskDonor>
          dataSource={donors}
          columns={columns}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
          scroll={{ x: 1100 }}
          rowClassName={(r: RiskDonor) => r.riskTier === 'Critical' ? 'ant-table-row-critical' : ''}
        />
      </Card>

      <style>{`.ant-table-row-critical { background: ${ERROR}08 !important; }`}</style>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function WeeklyAskListDashboard() {
  const [data, setData] = useState<AskListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch('/jfsd-ui/data/weekly-ask-list.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: AskListData) => {
        const isDeceased = (name: string) => /Z["'\u201c\u201d\u2018\u2019]L/i.test(name);
        const filtered = d.donors.filter((donor) => !isDeceased(donor.name));
        const removedCount = d.donors.length - filtered.length;
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

  // Fetch critical count for badge
  useEffect(() => {
    fetch('/jfsd-ui/data/silence-alerts.json')
      .then(r => r.ok ? r.json() : null)
      .then((d: SilenceData | null) => { if (d?.kpis) setCriticalCount(d.kpis.criticalCount); })
      .catch(() => {});
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch('/jfsd-ui/data/weekly-ask-list.json')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <Alert type="error" message="Failed to load ask list data" description={error} showIcon />;
  if (!data) return <Alert type="warning" message="No data available" showIcon />;

  const tabItems = [
    {
      key: 'ask-list',
      label: '📋 Ask List',
      children: (
        <div>
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
      ),
    },
    {
      key: 'risk-alerts',
      label: (
        <span>
          🔕 Risk Alerts{' '}
          {criticalCount > 0 && (
            <Badge count={criticalCount} size="small" style={{ marginLeft: 4 }} />
          )}
        </span>
      ),
      children: <RiskAlertsContent />,
    },
  ];

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <DataFreshness asOfDate={data.asOfDate} onRefresh={refresh} refreshing={refreshing} />
      <Tabs defaultActiveKey="ask-list" items={tabItems} size="large" />
    </div>
  );
}
