// @ts-nocheck
import { Card, Col, Row, Statistic, Typography, Progress, Space, Tag } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useEffect, useState, useCallback } from 'react';

const { Title, Text } = Typography;
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

// ── Brand tokens ────────────────────────────────────────────────────────
// ── Helpers ─────────────────────────────────────────────────────────────
const fmtUSD = (v?: number) => v != null ? `$${v.toLocaleString()}` : '—';
const fmtK = (v?: number) => v == null ? '—' : v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${v}`;
const fmtPct = (v?: number) => v != null ? `${v.toFixed(1)}%` : '—';
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

// ── Types (loose, since we aggregate many sources) ──────────────────────
type D = Record<string, any>;

const DATA_FILES = [
  'campaign-tracker', 'sharon-donor-health', 'stripe', 'givecloud',
  'ramp-analytics', 'james-ap-expense', 'facilities', 'board-reporting', 'drm-portfolio',
] as const;

type DataKey = typeof DATA_FILES[number];

// ── Quick-link definitions ──────────────────────────────────────────────
const QUICK_LINKS: { key: DataKey; navKey: string; label: string; metric: (d: D) => string; color: string }[] = [
  { key: 'campaign-tracker', navKey: 'campaign', label: 'Campaign Tracker', metric: d => `${fmtPct(d?.annualCampaign?.pctOfGoal)} of goal`, color: NAVY },
  { key: 'sharon-donor-health', navKey: 'donor-health', label: 'Donor Health', metric: d => `${d?.kpis?.dataQualityScore ?? '—'}/100 quality`, color: SUCCESS },
  { key: 'stripe', navKey: 'stripe', label: 'Stripe', metric: d => `${fmtK(d?.kpis?.grossVolume)} volume`, color: '#5B8DB8' },
  { key: 'givecloud', navKey: 'givecloud', label: 'GiveCloud', metric: d => `${fmtK(d?.kpis?.totalOnlineRevenue)} online`, color: GOLD },
  { key: 'ramp-analytics', navKey: 'ramp', label: 'Ramp', metric: d => `${fmtK(d?.kpis?.totalSpendFY26)} YTD`, color: WARNING },
  { key: 'james-ap-expense', navKey: 'ap-expense', label: 'AP / Expense', metric: d => `${d?.kpis?.missingReceipts ?? '—'} missing receipts`, color: ERROR },
  { key: 'facilities', navKey: 'facilities', label: 'Facilities', metric: d => `${d?.kpis?.alertCount ?? 0} alerts`, color: '#2D5F2D' },
  { key: 'board-reporting', navKey: 'board', label: 'Board', metric: d => `${fmtPct(d?.kpis?.overallBoardParticipation)} participation`, color: '#9B4DCA' },
  { key: 'drm-portfolio', navKey: 'drm', label: 'DRM Portfolio', metric: d => `${d?.kpis?.totalPortfolioDonors ?? '—'} donors`, color: '#8B6914' },
];

// ── Component ───────────────────────────────────────────────────────────
export function OverviewDashboard({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [data, setData] = useState<Record<DataKey, D | null>>({} as any);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    Promise.allSettled(
      DATA_FILES.map(k =>
        fetch(`${base}${k}.json`).then(r => r.ok ? r.json() : null).then(d => [k, d] as const)
      )
    ).then(results => {
      const m: any = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) m[r.value[0]] = r.value[1];
      }
      setData(m);
      setLoading(false);
    });
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    const base = `${import.meta.env.BASE_URL}data/`;
    Promise.allSettled(
      DATA_FILES.map(k =>
        fetch(`${base}${k}.json`).then(r => r.ok ? r.json() : null).then(d => [k, d] as const)
      )
    ).then(results => {
      const m: any = {};
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) m[r.value[0]] = r.value[1];
      }
      setData(m);
      setRefreshing(false);
    });
  }, []);

  if (loading) return <DashboardSkeleton kpiCount={6} />;

  const campaign = data['campaign-tracker'];
  const donors = data['sharon-donor-health'];
  const stripe = data['stripe'];
  const gc = data['givecloud'];
  const ramp = data['ramp-analytics'];
  const ap = data['james-ap-expense'];
  const fac = data['facilities'];
  const board = data['board-reporting'];

  // Derived KPIs
  const raised = safe(() => campaign.annualCampaign.raised, null);
  const goal = safe(() => campaign.annualCampaign.goal, null);
  const pctGoal = safe(() => campaign.annualCampaign.pctOfGoal, null);
  const totalDonors = safe(() => campaign.annualCampaign.donorCount, null);
  const onlineRev = safe(() => gc.kpis.totalOnlineRevenue, null);
  const rampYTD = safe(() => ramp.kpis.totalSpendFY26, null);
  const alertCount = safe(() => fac.kpis.alertCount, 0);
  const boardPart = safe(() => board.kpis.overallBoardParticipation, null);

  // This Week
  const newDonors = safe(() => donors.newDonorsThisWeek, null);
  const failedAmt = safe(() => donors.kpis.failedChargesAmount, null);
  const missingReceipts = safe(() => ap.kpis.missingReceipts, null);
  const stripeWoW = safe(() => {
    const m = stripe.monthlyData;
    return ((m[m.length - 1].amount - m[m.length - 2].amount) / m[m.length - 2].amount * 100);
  }, null);
  const topGift = safe(() => {
    const g = campaign.topGiftsThisWeek[0];
    return { name: g.donor || g.name, amount: g.amount };
  }, null);
  const thermoAlerts = safe(() => fac.kpis.alertCount, 0);

  // System Health
  const dataQuality = safe(() => donors.kpis.dataQualityScore, null);
  const receiptComp = safe(() => ap.kpis.receiptComplianceRate, null);
  const thermOnline = safe(() => fac.kpis.online, null);
  const thermOffline = safe(() => fac.kpis.offline, null);

  const cardStyle = { borderRadius: 8, height: '100%' };
  const kpiCard = (title: React.ReactNode, value: string | number | null, prefix?: string, color?: string) => (
    <Col xs={12} sm={8} md={4}>
      <Card style={cardStyle} bodyStyle={{ padding: 16, textAlign: 'center' }}>
        <Statistic
          title={<Text style={{ fontSize: 12, color: MUTED }}>{title}</Text>}
          value={value ?? '—'}
          prefix={prefix}
          valueStyle={{ color: color || NAVY, fontSize: 26, fontWeight: 700 }}
        />
      </Card>
    </Col>
  );

  const miniCard = (label: string, value: string | number | null, tagColor?: string) => (
    <Col xs={24} sm={12}>
      <Card size="small" style={{ borderRadius: 6, borderLeft: `3px solid ${tagColor || NAVY}` }} bodyStyle={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: MUTED }}>{label}</Text>
          <Text strong style={{ fontSize: 16 }}>{value ?? '—'}</Text>
        </div>
      </Card>
    </Col>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ color: NAVY, margin: 0 }}>Executive Overview</Title>
        <Text type="secondary">Single-pane snapshot</Text>
        <DataFreshness asOfDate={safe(() => campaign.asOfDate, '') || safe(() => stripe.kpis?.asOfDate, '') || ''} onRefresh={refresh} refreshing={refreshing} />
      </div>

      {/* ── Hero KPI Row ─────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {kpiCard(<DefinitionTooltip term="Recognition" dashboardKey="overview">Campaign Raised</DefinitionTooltip>, raised != null ? fmtK(raised) : null, undefined, NAVY)}
        {kpiCard('Total Donors', totalDonors, undefined, NAVY)}
        {kpiCard(<DefinitionTooltip term="Cash" dashboardKey="overview">Online Revenue</DefinitionTooltip>, onlineRev != null ? fmtK(onlineRev) : null, undefined, SUCCESS)}
        {kpiCard('Ramp Spend YTD', rampYTD != null ? fmtK(rampYTD) : null, undefined, WARNING)}
        {kpiCard('Building Alerts', alertCount, undefined, alertCount > 0 ? ERROR : SUCCESS)}
        {kpiCard('Board Participation', boardPart != null ? `${boardPart}%` : null, undefined, GOLD)}
      </Row>

      {/* ── Campaign Progress ────────────────────────────────────────── */}
      {(raised != null && goal != null) && (
        <Card size="small" style={{ marginBottom: 24, borderRadius: 8 }} bodyStyle={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text strong style={{ color: NAVY }}>Annual Campaign Progress</Text>
            <Text type="secondary">{fmtK(raised)} of {fmtK(goal)}</Text>
          </div>
          <Progress
            percent={pctGoal ?? 0}
            strokeColor={{ '0%': NAVY, '100%': GOLD }}
            trailColor="#E8E8ED"
            format={p => `${p?.toFixed(1)}%`}
            strokeWidth={20}
            style={{ marginBottom: 0 }}
          />
        </Card>
      )}

      {/* ── This Week at a Glance ────────────────────────────────────── */}
      <Card
        title={<Text strong style={{ color: NAVY }}>This Week at a Glance</Text>}
        style={{ marginBottom: 24, borderRadius: 8 }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={[12, 12]}>
          {miniCard('New Donors', newDonors, SUCCESS)}
          {miniCard('Failed Recurring', failedAmt != null ? fmtUSD(failedAmt) : null, ERROR)}
          {miniCard('Missing Receipts', missingReceipts, WARNING)}
          {miniCard('Stripe WoW Δ', stripeWoW != null ? `${stripeWoW > 0 ? '+' : ''}${stripeWoW.toFixed(1)}%` : null, stripeWoW != null && stripeWoW >= 0 ? SUCCESS : ERROR)}
          {miniCard('Top Gift', topGift ? `${topGift.name} · ${fmtUSD(topGift.amount)}` : null, GOLD)}
          {miniCard('Thermostat Alerts', thermoAlerts, thermoAlerts > 0 ? ERROR : SUCCESS)}
        </Row>
      </Card>

      {/* ── System Health ────────────────────────────────────────────── */}
      <Card
        title={<Text strong style={{ color: NAVY }}>System Health</Text>}
        style={{ marginBottom: 24, borderRadius: 8 }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Data Quality Score</Text>
              <div>
                <Progress
                  type="circle"
                  percent={dataQuality ?? 0}
                  size={80}
                  strokeColor={dataQuality != null && dataQuality >= 80 ? SUCCESS : dataQuality != null && dataQuality >= 60 ? WARNING : ERROR}
                  format={p => <span style={{ fontSize: 18, fontWeight: 700 }}>{p ?? '—'}</span>}
                />
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Receipt Compliance</Text>
              <div>
                <Progress
                  type="circle"
                  percent={receiptComp ?? 0}
                  size={80}
                  strokeColor={receiptComp != null && receiptComp >= 90 ? SUCCESS : receiptComp != null && receiptComp >= 75 ? WARNING : ERROR}
                  format={p => <span style={{ fontSize: 18, fontWeight: 700 }}>{p != null ? `${p}%` : '—'}</span>}
                />
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ fontSize: 12, color: MUTED }}>Thermostats</Text>
              <div style={{ marginTop: 12 }}>
                <Space size="middle">
                  <Tag color="success" style={{ fontSize: 16, padding: '4px 12px' }}>{thermOnline ?? '—'} online</Tag>
                  <Tag color={thermOffline && thermOffline > 0 ? 'error' : 'default'} style={{ fontSize: 16, padding: '4px 12px' }}>{thermOffline ?? '—'} offline</Tag>
                </Space>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* ── Quick Links ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ color: NAVY, fontSize: 16 }}>Dashboard Quick Links</Text>
      </div>
      <Row gutter={[12, 12]}>
        {QUICK_LINKS.map(ql => (
          <Col xs={12} sm={8} md={6} key={ql.key}>
            <Card
              hoverable
              size="small"
              onClick={() => onNavigate?.(ql.navKey)}
              style={{ borderRadius: 8, borderTop: `3px solid ${ql.color}`, height: '100%', cursor: 'pointer' }}
              bodyStyle={{ padding: '12px 14px' }}
            >
              <Text strong style={{ display: 'block', fontSize: 13, color: NAVY, marginBottom: 4 }}>{ql.label}</Text>
              <Text style={{ fontSize: 12, color: MUTED }}>{safe(() => ql.metric(data[ql.key] || {}), '—')}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
