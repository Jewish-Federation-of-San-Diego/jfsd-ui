import { Card, Col, Row, Statistic, Table, Tag, Space, Progress } from 'antd';
import { useEffect, useState } from 'react';
import { WarningOutlined } from '@ant-design/icons';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { GOLD, ERROR } from '../theme/jfsdTheme';

interface Donor {
  name: string; phone: string; email: string; fy25Amount: number; lifetimeGiving: number;
  avgAnnual: number; lastGiftDate: string; riskScore: number; riskTier: string;
  riskFactors: string[]; daysSinceGift: number;
}
interface TierInfo { tier: string; count: number; revenueAtRisk: number; color: string; }
interface SilenceData {
  asOfDate: string; count: number; revenueAtRisk: number;
  byTier: TierInfo[]; donors: Donor[];
  kpis: { totalAtRisk: number; revenueAtRisk: number; criticalCount: number; criticalRevenue: number; avgDaysSinceGift: number };
}

const fmtUSD = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
const tierColor = (t: string) => t === 'Critical' ? 'red' : t === 'High' ? 'orange' : t === 'Medium' ? 'gold' : 'green';

export function SilenceAlertsDashboard() {
  const [data, setData] = useState<SilenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/silence-alerts.json`).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const columns = [
    { title: 'Donor', dataIndex: 'name', key: 'name', fixed: 'left' as const, width: 160 },
    { title: 'Risk', dataIndex: 'riskTier', key: 'tier', width: 90,
      render: (v: string) => <Tag color={tierColor(v)} icon={<WarningOutlined />}>{v}</Tag>,
      filters: data.byTier.map(t => ({ text: t.tier, value: t.tier })),
      onFilter: (value: unknown, record: Donor) => record.riskTier === value },
    { title: 'Score', dataIndex: 'riskScore', key: 'score', width: 70, sorter: (a: Donor, b: Donor) => a.riskScore - b.riskScore },
    { title: 'Days Silent', dataIndex: 'daysSinceGift', key: 'days', width: 100, sorter: (a: Donor, b: Donor) => a.daysSinceGift - b.daysSinceGift },
    { title: <DefinitionTooltip term="Lifetime Value" dashboardKey="silence">Lifetime</DefinitionTooltip>, dataIndex: 'lifetimeGiving', key: 'life', width: 100,
      render: (v: number) => fmtUSD(v), sorter: (a: Donor, b: Donor) => a.lifetimeGiving - b.lifetimeGiving, defaultSortOrder: 'descend' as const },
    { title: 'Avg Annual', dataIndex: 'avgAnnual', key: 'avg', width: 100, render: (v: number) => fmtUSD(v) },
    { title: 'Last Gift', dataIndex: 'lastGiftDate', key: 'last', width: 100,
      render: (v: string) => new Date(v).toLocaleDateString() },
    { title: 'Risk Factors', dataIndex: 'riskFactors', key: 'factors',
      render: (v: string[]) => v?.slice(0, 2).map((f, i) => <div key={i} style={{ fontSize: 11, color: '#666' }}>{f}</div>) },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate} />
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title="Donors at Risk" value={data.kpis.totalAtRisk} valueStyle={{ color: ERROR }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Revenue at Risk" value={fmtUSD(data.kpis.revenueAtRisk)} valueStyle={{ color: ERROR }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Critical" value={data.kpis.criticalCount} valueStyle={{ color: ERROR }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Silence Period" dashboardKey="silence">Avg Days Silent</DefinitionTooltip>} value={data.kpis.avgDaysSinceGift} valueStyle={{ color: GOLD }} /></Card></Col>
      </Row>

      <Card title={<DefinitionTooltip term="Risk Tier" dashboardKey="silence">Risk Tiers</DefinitionTooltip>}>
        {data.byTier.map(t => (
          <div key={t.tier} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Tag color={tierColor(t.tier)}>{t.tier}</Tag>
              <span>{t.count} donors · {fmtUSD(t.revenueAtRisk)} at risk</span>
            </div>
            <Progress percent={Math.round((t.count / data.count) * 100)} strokeColor={t.color} showInfo={false} size={['100%', 12]} />
          </div>
        ))}
      </Card>

      <Card title={`Silent Donors (${data.count})`}>
        <Table dataSource={data.donors} columns={columns} rowKey="name"
          size="small" pagination={{ pageSize: 20 }} scroll={{ x: 900 }} />
      </Card>
    </Space>
  );
}
