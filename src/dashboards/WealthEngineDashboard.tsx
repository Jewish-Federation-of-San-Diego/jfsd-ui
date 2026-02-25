import { Card, Col, Row, Statistic, Table, Space, Progress } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD, SUCCESS } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';

interface DistItem { label: string; count: number; }
interface P2GItem { score: string; count: number; }
interface Prospect {
  name: string; netWorth: string; giftCapacity: string; p2g: string;
  totalAssets: string; realEstate: string; age: number; gender: string;
}
interface WEData {
  asOfDate: string;
  kpis: { totalScreened: number; matched: number; avgAge: number };
  netWorthDistribution: DistItem[];
  giftCapacityDistribution: DistItem[];
  p2gDistribution: P2GItem[];
  topProspects: Prospect[];
}

function DistributionChart({ data, title, color }: { data: { label: string; count: number }[]; title: React.ReactNode; color: string }) {
  const max = Math.max(...data.map(d => d.count));
  return (
    <Card title={title}>
      {data.slice(0, 10).map(d => (
        <div key={d.label} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 12 }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{d.count.toLocaleString()}</span>
          </div>
          <Progress percent={Math.round((d.count / max) * 100)} showInfo={false} strokeColor={color} size={['100%', 10]} />
        </div>
      ))}
    </Card>
  );
}

export function WealthEngineDashboard() {
  const [data, setData] = useState<WEData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/wealthengine.json`).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const prospectCols = [
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Net Worth', dataIndex: 'netWorth', key: 'netWorth' },
    { title: 'Gift Capacity', dataIndex: 'giftCapacity', key: 'giftCapacity' },
    { title: 'P2G', dataIndex: 'p2g', key: 'p2g', width: 60 },
    { title: 'Age', dataIndex: 'age', key: 'age', width: 60 },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate} />
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}><Card><Statistic title="Total Screened" value={data.kpis.totalScreened.toLocaleString()} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Matched" value={data.kpis.matched.toLocaleString()} valueStyle={{ color: SUCCESS }} /></Card></Col>
        <Col xs={12} sm={8}><Card><Statistic title="Avg Age" value={data.kpis.avgAge} valueStyle={{ color: GOLD }} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <DistributionChart data={data.netWorthDistribution} title={<DefinitionTooltip term="Net Worth" dashboardKey="wealth">Net Worth Distribution</DefinitionTooltip>} color={NAVY} />
        </Col>
        <Col xs={24} md={12}>
          <DistributionChart data={data.giftCapacityDistribution} title={<DefinitionTooltip term="Gift Capacity" dashboardKey="wealth">Gift Capacity Distribution</DefinitionTooltip>} color={GOLD} />
        </Col>
      </Row>

      <DistributionChart
        data={data.p2gDistribution.filter(d => d.count > 5).map(d => ({ label: `Score ${d.score}`, count: d.count }))}
        title={<DefinitionTooltip term="P2G Score" dashboardKey="wealth">P2G Score Distribution</DefinitionTooltip>} color={SUCCESS} />

      <Card title="Top Prospects">
        <Table dataSource={data.topProspects.slice(0, 50)} columns={prospectCols} rowKey="name"
          size="small" pagination={{ pageSize: 20 }} scroll={{ x: 600 }} />
      </Card>
    </Space>
  );
}
