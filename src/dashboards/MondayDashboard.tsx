import { Card, Col, Row, Statistic, Space, Progress, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';

interface Board { id: string; name: string; totalItems: number; groups: unknown[]; }
interface MondayData { asOfDate: string; boards: Board[]; kpis: { totalBoards: number; totalItems: number }; }

export function MondayDashboard() {
  const [data, setData] = useState<MondayData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/monday.json').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const sorted = [...data.boards].sort((a, b) => b.totalItems - a.totalItems);
  const maxItems = sorted[0]?.totalItems || 1;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate} />
      <Row gutter={[16, 16]}>
        <Col xs={12}><Card><Statistic title={<DefinitionTooltip term="Board" dashboardKey="monday">Total Boards</DefinitionTooltip>} value={data.kpis.totalBoards} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12}><Card><Statistic title={<DefinitionTooltip term="Items" dashboardKey="monday">Total Items</DefinitionTooltip>} value={data.kpis.totalItems} valueStyle={{ color: GOLD }} /></Card></Col>
      </Row>

      <Card title="Boards by Item Count">
        <Row gutter={[12, 12]}>
          {sorted.map(b => (
            <Col xs={24} sm={12} md={8} key={b.id}>
              <Card size="small" style={{ height: '100%' }}>
                <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>{b.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress percent={Math.round((b.totalItems / maxItems) * 100)} showInfo={false}
                    strokeColor={NAVY} size={['100%', 8]} style={{ flex: 1 }} />
                  <Tag color="blue">{b.totalItems}</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}
