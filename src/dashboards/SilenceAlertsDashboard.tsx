import { Card, Col, Row, Statistic, Table, Tag, Typography, Spin, Alert, Tooltip as AntTooltip, Progress } from 'antd';
import { WarningOutlined, DollarOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback, useRef } from 'react';

const { Text, Title } = Typography;
import { DefinitionTooltip } from "../components/DefinitionTooltip";

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const GOLD = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';
const MUTED = '#8C8C8C';

// ── Types ───────────────────────────────────────────────────────────────
interface TierSummary { tier: string; count: number; revenueAtRisk: number; color: string; }
interface Donor {
  name: string; phone: string; email: string; fy25Amount: number;
  lifetimeGiving: number; avgAnnual: number; lastGiftDate: string;
  riskScore: number; riskTier: string; riskFactors: string[]; daysSinceGift: number;
}
interface KPIs {
  totalAtRisk: number; revenueAtRisk: number; criticalCount: number;
  criticalRevenue: number; avgDaysSinceGift: number;
}
interface SilenceData {
  asOfDate: string; count: number; revenueAtRisk: number;
  byTier: TierSummary[]; donors: Donor[]; kpis: KPIs;
}

const fmtUSD = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const TIER_COLORS: Record<string, string> = {
  Critical: ERROR, High: WARNING, Medium: GOLD, Watch: SUCCESS,
};

// ── Width hook ──────────────────────────────────────────────────────────
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [, setWidth] = useState(0);
  const measure = useCallback(() => {
    if (ref.current) { const w = ref.current.getBoundingClientRect().width; if (w > 0) setWidth(Math.floor(w)); }
  }, []);
  useEffect(() => { requestAnimationFrame(measure); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [measure]);
  return { ref };
}

// ── Stacked Bar ─────────────────────────────────────────────────────────
function RiskDistributionBar({ tiers, total }: { tiers: TierSummary[]; total: number }) {
  const { ref } = useWidth(); // width unused but hook measures
  if (!total) return null;
  return (
    <Card size="small" title={<Text strong style={{ color: NAVY }}>Risk Distribution</Text>} style={{ marginBottom: 16 }}>
      <div ref={ref}>
        <div style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
          {tiers.filter(t => t.count > 0).map(t => {
            const pct = (t.revenueAtRisk / total) * 100;
            return (
              <AntTooltip key={t.tier} title={`${t.tier}: ${t.count} donors — ${fmtUSD(t.revenueAtRisk)} (${pct.toFixed(1)}%)`}>
                <div style={{ width: `${pct}%`, background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600, minWidth: pct > 5 ? 0 : 0 }}>
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

// ── Main Dashboard ──────────────────────────────────────────────────────
export function SilenceAlertsDashboard() {
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

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /><br /><Text type="secondary">Loading silence alerts…</Text></div>;
  if (error) return <Alert type="error" message="Failed to load silence alerts" description={error} showIcon style={{ margin: 24 }} />;
  if (!data) return null;

  const { kpis, byTier, donors } = data;

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name', sorter: (a: Donor, b: Donor) => a.name.localeCompare(b.name),
      render: (v: string, r: Donor) => <><Text strong>{v}</Text>{r.riskTier === 'Critical' && <ExclamationCircleOutlined style={{ color: ERROR, marginLeft: 6 }} />}</>
    },
    {
      title: 'FY25 Amount', dataIndex: 'fy25Amount', key: 'fy25Amount', sorter: (a: Donor, b: Donor) => a.fy25Amount - b.fy25Amount,
      render: (v: number) => <Text strong style={{ color: NAVY }}>{fmtUSD(v)}</Text>, align: 'right' as const,
    },
    {
      title: 'Lifetime', dataIndex: 'lifetimeGiving', key: 'lifetime', sorter: (a: Donor, b: Donor) => a.lifetimeGiving - b.lifetimeGiving,
      render: (v: number) => fmtUSD(v), align: 'right' as const,
    },
    {
      title: 'Last Gift', dataIndex: 'lastGiftDate', key: 'lastGift',
      sorter: (a: Donor, b: Donor) => (a.lastGiftDate || '').localeCompare(b.lastGiftDate || ''),
      render: (v: string, r: Donor) => v ? <AntTooltip title={`${r.daysSinceGift} days ago`}>{new Date(v).toLocaleDateString()}</AntTooltip> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Risk', dataIndex: 'riskScore', key: 'risk', sorter: (a: Donor, b: Donor) => a.riskScore - b.riskScore, defaultSortOrder: 'descend' as const,
      render: (v: number, r: Donor) => (
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
        <Title level={4} style={{ color: NAVY, margin: 0 }}>🔕 Silence Alerts — LYBUNT Donors at Risk</Title>
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
        <Table
          dataSource={donors}
          columns={columns}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
          scroll={{ x: 1100 }}
          rowClassName={(r: Donor) => r.riskTier === 'Critical' ? 'ant-table-row-critical' : ''}
        />
      </Card>

      <style>{`.ant-table-row-critical { background: ${ERROR}08 !important; }`}</style>
    </div>
  );
}

export default SilenceAlertsDashboard;
