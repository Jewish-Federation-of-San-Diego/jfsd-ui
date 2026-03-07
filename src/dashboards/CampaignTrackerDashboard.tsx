import { Card, Col, Row, Statistic, Table, Typography, Space, Progress, Alert, Tag, Select } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import {
  RiseOutlined,
  FallOutlined,
  TeamOutlined,
  DollarOutlined,
  TrophyOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safeCurrency, safePercent } from '../utils/formatters';

const { Text, Title } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
// ── Types ───────────────────────────────────────────────────────────────
interface WeeklyMomentum { weekOf: string; gifts: number; amount: number; }
interface GivingLevel { level: string; donors: number; amount: number; }
interface TopGift { name: string; amount: number; campaign: string; date: string; }
interface CampaignItem { name: string; raised: number; goal: number; donors: number; pctOfGoal: number; }
interface CampaignData {
  asOfDate: string;
  annualCampaign: {
    name: string; goal: number; raised: number; pctOfGoal: number;
    donorCount: number; avgGift: number; priorYearSamePoint: number;
  };
  momentum: {
    giftsThisWeek: number; amountThisWeek: number;
    giftsLastWeek: number; amountLastWeek: number; weekOverWeekPct: number;
  };
  weeklyMomentum: WeeklyMomentum[];
  donorBreakdown: {
    newDonors: number; returningDonors: number;
    lybuntRecovered: number; retentionRate: number;
  };
  givingLevels: GivingLevel[];
  topGiftsThisWeek: TopGift[];
  pipeline: { openPledges: number; openPledgeAmount: number; expectedThisMonth: number; };
  campaigns: CampaignItem[];
}

const fmtUSD  = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });
const fmtPct  = (v: number) => safePercent(v, { decimals: 1, showSign: true });
const fmtDate = (d: string) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return d; } };

// ── Hook: measure width ─────────────────────────────────────────────────
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const measure = useCallback(() => {
    if (ref.current) {
      const w = ref.current.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.floor(w));
    }
  }, []);
  useEffect(() => {
    requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  return { ref, width };
}

// ── Progress Ring ───────────────────────────────────────────────────────
function ProgressRing({ pct, size = 120, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const capped = Math.min(pct, 100);
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E8ED" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GOLD} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - capped / 100)}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill={NAVY} fontSize={20} fontWeight={700}>
        {safePercent(capped, { decimals: 1 })}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill={MUTED} fontSize={11}>
        of goal
      </text>
    </svg>
  );
}

// ── KPI Row ─────────────────────────────────────────────────────────────
function KPIRow({ data, filteredMomentum }: { data: CampaignData; filteredMomentum?: { amountThisWeek: number; amountLastWeek: number; weekOverWeekPct: number } }) {
  const { annualCampaign: ac, donorBreakdown: db } = data;
  const m = filteredMomentum ?? data.momentum;
  const wowColor = m.weekOverWeekPct >= 0 ? SUCCESS : ERROR;
  const WowIcon = m.weekOverWeekPct >= 0 ? RiseOutlined : FallOutlined;
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} sm={12} md={6}>
        <Card size="small" style={{ textAlign: 'center' }}>
          <ProgressRing pct={ac.pctOfGoal} />
          <div style={{ marginTop: 8 }}>
            <Text strong style={{ fontSize: 20, color: NAVY }}>{fmtUSD(ac.raised)}</Text>
            <br />
            <Text type="secondary">of {fmtUSD(ac.goal)} goal</Text>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card size="small">
          <Statistic title="Total Donors" value={ac.donorCount} prefix={<TeamOutlined style={{ color: NAVY }} />}
            valueStyle={{ color: NAVY }} />
          <Text type="secondary"><DefinitionTooltip term="Average Gift" dashboardKey="campaign">Avg gift</DefinitionTooltip>: {fmtUSD(ac.avgGift)}</Text>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card size="small">
          <Statistic title="This Week" value={fmtUSD(m.amountThisWeek)}
            prefix={<DollarOutlined style={{ color: GOLD }} />} valueStyle={{ color: NAVY }} />
          <Space size={4}>
            <WowIcon style={{ color: wowColor }} />
            <Text style={{ color: wowColor }}>{fmtPct(m.weekOverWeekPct)} vs last week</Text>
          </Space>
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card size="small">
          <Statistic title={<DefinitionTooltip term="Retention Rate" dashboardKey="campaign">Retention Rate</DefinitionTooltip>} value={db.retentionRate} suffix="%" precision={1}
            valueStyle={{ color: db.retentionRate >= 50 ? SUCCESS : WARNING }} />
          <Text type="secondary">FY25→FY26</Text>
        </Card>
      </Col>
    </Row>
  );
}

// ── Campaign Thermometer ────────────────────────────────────────────────
function CampaignThermometer({ data }: { data: CampaignData }) {
  const { annualCampaign: ac } = data;
  const pct = Math.min(ac.pctOfGoal, 100);
  const priorPct = ac.goal > 0 ? Math.min(ac.priorYearSamePoint / ac.goal * 100, 100) : 0;
  return (
    <Card title={<span style={{ color: NAVY }}><TrophyOutlined /> Campaign Progress</span>} size="small">
      <div style={{ position: 'relative', height: 40, background: '#E8E8ED', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${NAVY}, ${GOLD})`,
          borderRadius: 20, transition: 'width 0.8s ease', display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 12,
        }}>
          {pct > 15 && <Text style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{fmtUSD(ac.raised)}</Text>}
        </div>
        {/* Prior year marker */}
        <div style={{
          position: 'absolute', left: `${priorPct}%`, top: 0, height: '100%',
          borderLeft: `2px dashed ${ERROR}`, opacity: 0.7,
        }} />
        <div style={{
          position: 'absolute', left: `${priorPct}%`, top: -18,
          transform: 'translateX(-50%)', fontSize: 10, color: ERROR, whiteSpace: 'nowrap',
        }}>
          PY: {fmtUSD(ac.priorYearSamePoint)}
        </div>
      </div>
      <Row justify="space-between" style={{ marginTop: 8 }}>
        <Text type="secondary">$0</Text>
        <Text type="secondary">{fmtUSD(ac.goal)}</Text>
      </Row>
    </Card>
  );
}

// ── Momentum Chart (SVG bars) ───────────────────────────────────────────
function MomentumChart({ weeks }: { weeks: WeeklyMomentum[] }) {
  const { ref, width } = useWidth();
  if (!weeks || weeks.length === 0) return null;
  const maxAmt = Math.max(...weeks.map(w => w.amount), 1);
  const h = 160;
  const barGap = 6;
  const barW = Math.max(20, (width - barGap * (weeks.length + 1)) / weeks.length);
  return (
    <Card title={<span style={{ color: NAVY }}><FieldTimeOutlined /> Weekly Giving Momentum</span>} size="small">
      <div ref={ref}>
        {width > 0 && (
          <svg width={width} height={h + 30}>
            {weeks.map((w, i) => {
              const bh = (w.amount / maxAmt) * h;
              const x = barGap + i * (barW + barGap);
              return (
                <g key={i}>
                  <rect x={x} y={h - bh} width={barW} height={bh} rx={4} fill={i === weeks.length - 1 ? GOLD : NAVY} opacity={0.85} />
                  <text x={x + barW / 2} y={h - bh - 4} textAnchor="middle" fontSize={9} fill={MUTED}>
                    {w.amount >= 1000 ? safeCurrency(w.amount, { notation: 'compact', maximumFractionDigits: 0 }) : fmtUSD(w.amount)}
                  </text>
                  <text x={x + barW / 2} y={h + 16} textAnchor="middle" fontSize={9} fill={MUTED}>
                    {fmtDate(w.weekOf)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </Card>
  );
}

// ── Donor Breakdown (donut) ─────────────────────────────────────────────
function DonorDonut({ data }: { data: CampaignData['donorBreakdown'] }) {
  const total = data.newDonors + data.returningDonors + data.lybuntRecovered;
  if (total === 0) return <Card size="small" title="Donor Breakdown"><Text type="secondary">No data</Text></Card>;
  const segments = [
    { label: 'New', value: data.newDonors, color: SUCCESS },
    { label: 'Returning', value: data.returningDonors, color: NAVY },
    { label: 'LYBUNT Recovered', value: data.lybuntRecovered, color: GOLD },
  ];
  const size = 140;
  const cx = size / 2, cy = size / 2, r = 50, sw = 20;
  let cumAngle = -Math.PI / 2;
  const arcs = segments.map(s => {
    const angle = (s.value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(cumAngle);
    const startY = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const endX = cx + r * Math.cos(cumAngle);
    const endY = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...s, d: `M ${startX} ${startY} A ${r} ${r} 0 ${large} 1 ${endX} ${endY}` };
  });
  return (
    <Card size="small" title={<span style={{ color: NAVY }}><TeamOutlined /> Donor Breakdown</span>}>
      <Row align="middle" gutter={16}>
        <Col>
          <svg width={size} height={size}>
            {arcs.map((a, i) => (
              <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="round" />
            ))}
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={18} fontWeight={700} fill={NAVY}>{safeCount(total)}</text>
          </svg>
        </Col>
        <Col>
          {segments.map(s => (
            <div key={s.label} style={{ marginBottom: 4 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color, marginRight: 6 }} />
              <Text>{s.label === 'LYBUNT Recovered' ? <DefinitionTooltip term="LYBUNT" dashboardKey="campaign">{s.label}</DefinitionTooltip> : s.label}: <strong>{safeCount(s.value)}</strong></Text>
            </div>
          ))}
        </Col>
      </Row>
    </Card>
  );
}

// ── Giving Levels (horizontal bars) ─────────────────────────────────────
function GivingLevels({ levels }: { levels: GivingLevel[] }) {
  const maxAmt = Math.max(...levels.map(l => l.amount), 1);
  return (
    <Card size="small" title={<span style={{ color: NAVY }}><DollarOutlined /> Giving Levels</span>}>
      {levels.map(l => (
        <div key={l.level} style={{ marginBottom: 8 }}>
          <Row justify="space-between">
            <Text style={{ fontSize: 12 }}>{l.level}</Text>
            <Text style={{ fontSize: 12 }}>{l.donors} donors · {fmtUSD(l.amount)}</Text>
          </Row>
          <div style={{ height: 14, background: '#E8E8ED', borderRadius: 7, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(l.amount / maxAmt) * 100}%`,
              background: NAVY, borderRadius: 7, transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── Top Gifts Table ─────────────────────────────────────────────────────
function TopGiftsTable({ gifts }: { gifts: TopGift[] }) {
  const cols = [
    { title: 'Donor', dataIndex: 'name', key: 'name' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v: number) => <Text strong>{fmtUSD(v)}</Text> },
    { title: 'Campaign', dataIndex: 'campaign', key: 'campaign', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => fmtDate(v) },
  ];
  return (
    <Card size="small" title={<span style={{ color: NAVY }}><TrophyOutlined /> Top Gifts This Week</span>}
      extra={<CsvExport data={gifts} columns={[
        { title: 'Donor', dataIndex: 'name' },
        { title: 'Amount', dataIndex: 'amount' },
        { title: 'Campaign', dataIndex: 'campaign' },
        { title: 'Date', dataIndex: 'date' },
      ]} filename="top-gifts" />}>
      <Table dataSource={gifts} columns={cols} rowKey={(_, i) => String(i)} pagination={false} size="small" />
    </Card>
  );
}

// ── Pipeline ────────────────────────────────────────────────────────────
function PipelineCard({ pipeline }: { pipeline: CampaignData['pipeline'] }) {
  return (
    <Card size="small" title={<span style={{ color: NAVY }}>📋 Pipeline</span>}>
      <Row gutter={16}>
        <Col span={8}>
          <Statistic title="Open Pledges" value={pipeline.openPledges} valueStyle={{ color: NAVY }} />
        </Col>
        <Col span={8}>
          <Statistic title="Pledge Amount" value={fmtUSD(pipeline.openPledgeAmount)} valueStyle={{ color: NAVY }} />
        </Col>
        <Col span={8}>
          <Statistic title="Expected This Month" value={fmtUSD(pipeline.expectedThisMonth)} valueStyle={{ color: SUCCESS }} />
        </Col>
      </Row>
    </Card>
  );
}

// ── Sub-Campaigns ───────────────────────────────────────────────────────
function SubCampaigns({ campaigns }: { campaigns: CampaignItem[] }) {
  if (!campaigns.length) return null;
  return (
    <Card size="small" title={<span style={{ color: NAVY }}>📊 Active Campaigns</span>}>
      <Row gutter={[12, 12]}>
        {campaigns.slice(0, 12).map((c, i) => (
          <Col xs={24} sm={12} md={8} key={i}>
            <Card size="small" style={{ borderLeft: `3px solid ${GOLD}` }}>
              <Text strong style={{ fontSize: 13 }}>{c.name}</Text>
              <Progress percent={Math.min(c.pctOfGoal, 100)} size="small"
                strokeColor={c.pctOfGoal >= 75 ? SUCCESS : c.pctOfGoal >= 50 ? GOLD : NAVY}
                format={() => `${c.pctOfGoal}%`} />
              <Row justify="space-between">
                <Text type="secondary" style={{ fontSize: 11 }}>{fmtUSD(c.raised)} raised</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{c.donors} donors</Text>
              </Row>
              {c.goal > 0 && <Text type="secondary" style={{ fontSize: 10 }}>Goal: {fmtUSD(c.goal)}</Text>}
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
type DateRange = 'week' | 'month' | 'quarter' | 'ytd';

function filterByDateRange(data: CampaignData, range: DateRange) {
  if (range === 'ytd') {
    return { weeks: data.weeklyMomentum, gifts: data.topGiftsThisWeek, momentum: undefined };
  }

  const now = new Date();
  const daysMap: Record<Exclude<DateRange, 'ytd'>, number> = { week: 7, month: 30, quarter: 90 };
  const weeksMap: Record<Exclude<DateRange, 'ytd'>, number> = { week: 1, month: 4, quarter: 13 };
  const days = daysMap[range];
  const maxWeeks = weeksMap[range];

  const cutoff = new Date(now.getTime() - days * 86400000);

  const weeks = data.weeklyMomentum.slice(-maxWeeks);
  const gifts = data.topGiftsThisWeek.filter(g => {
    const d = new Date(g.date + 'T00:00:00');
    return d >= cutoff;
  });

  // Recalculate momentum KPIs from filtered weeks
  const thisWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;
  const lastWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const amountThisWeek = thisWeek?.amount ?? 0;
  const amountLastWeek = lastWeek?.amount ?? 0;
  const weekOverWeekPct = amountLastWeek > 0 ? ((amountThisWeek - amountLastWeek) / amountLastWeek) * 100 : 0;

  return {
    weeks,
    gifts,
    momentum: { amountThisWeek, amountLastWeek, weekOverWeekPct },
  };
}

export function CampaignTrackerDashboard() {
  const [data, setData] = useState<CampaignData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('ytd');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(() => {
    fetchJson<CampaignData>(`${import.meta.env.BASE_URL}data/campaign-tracker.json`)
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchJson<CampaignData>(`${import.meta.env.BASE_URL}data/campaign-tracker.json`)
      .then(setData)
      .catch(e => setError((e as Error).message))
      .finally(() => setRefreshing(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return null;
    return filterByDateRange(data, dateRange);
  }, [data, dateRange]);

  if (error) return <Alert type="error" message="Failed to load campaign data" description={error} showIcon style={{ margin: 24 }} />;
  if (!data || !filtered) return <DashboardSkeleton />;

  const safeData: CampaignData = {
    asOfDate: data.asOfDate ?? '',
    annualCampaign: data.annualCampaign ?? { name: '', goal: 0, raised: 0, pctOfGoal: 0, donorCount: 0, avgGift: 0, priorYearSamePoint: 0 },
    momentum: data.momentum ?? { giftsThisWeek: 0, amountThisWeek: 0, giftsLastWeek: 0, amountLastWeek: 0, weekOverWeekPct: 0 },
    weeklyMomentum: data.weeklyMomentum ?? [],
    donorBreakdown: data.donorBreakdown ?? { newDonors: 0, returningDonors: 0, lybuntRecovered: 0, retentionRate: 0 },
    givingLevels: data.givingLevels ?? [],
    topGiftsThisWeek: data.topGiftsThisWeek ?? [],
    pipeline: data.pipeline ?? { openPledges: 0, openPledgeAmount: 0, expectedThisMonth: 0 },
    campaigns: data.campaigns ?? [],
  };

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Space align="center">
            <Title level={3} style={{ color: NAVY, margin: 0 }}>🎯 Campaign Tracker</Title>
            <Select value={dateRange} onChange={setDateRange} style={{ width: 160 }} size="small">
              <Select.Option value="week">This Week</Select.Option>
              <Select.Option value="month">This Month</Select.Option>
              <Select.Option value="quarter">This Quarter</Select.Option>
              <Select.Option value="ytd">FY26 YTD</Select.Option>
            </Select>
          </Space>
        </Row>
        <DataFreshness asOfDate={safeData.asOfDate} onRefresh={refresh} refreshing={refreshing} />

        <KPIRow data={safeData} filteredMomentum={filtered.momentum} />
        <CampaignThermometer data={safeData} />

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <MomentumChart weeks={filtered.weeks} />
          </Col>
          <Col xs={24} lg={10}>
            <DonorDonut data={safeData.donorBreakdown} />
          </Col>
        </Row>

        <GivingLevels levels={safeData.givingLevels} />

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <TopGiftsTable gifts={filtered.gifts} />
          </Col>
          <Col xs={24} lg={10}>
            <PipelineCard pipeline={safeData.pipeline} />
          </Col>
        </Row>

        <SubCampaigns campaigns={safeData.campaigns} />
      </Space>
    </div>
  );
}
