import { Card, Col, Row, Statistic, Space, Progress, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCount } from '../utils/formatters';

interface Board { id: string; name: string; totalItems: number; groups: unknown[]; }
interface MondayData { asOfDate: string; boards: Board[]; kpis: { totalBoards: number; totalItems: number }; }

export function MondayDashboard() {
  const [data, setData] = useState<MondayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<MondayData>(`${import.meta.env.BASE_URL}data/monday.json`);
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardErrorState message="Failed to load Monday data" description={error} />;
  if (!data) return <DashboardErrorState message="Missing Monday data" />;

  const boards = data.boards ?? [];
  const kpis = data.kpis ?? { totalBoards: 0, totalItems: 0 };
  const sorted = [...boards].sort((a, b) => b.totalItems - a.totalItems);
  const maxItems = sorted[0]?.totalItems || 1;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate ?? ''} />
      <Row gutter={[16, 16]}>
        <Col xs={12}><Card><Statistic title={<DefinitionTooltip term="Board" dashboardKey="monday">Total Boards</DefinitionTooltip>} value={safeCount(kpis.totalBoards)} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12}><Card><Statistic title={<DefinitionTooltip term="Items" dashboardKey="monday">Total Items</DefinitionTooltip>} value={safeCount(kpis.totalItems)} valueStyle={{ color: GOLD }} /></Card></Col>
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
                  <Tag color="blue">{safeCount(b.totalItems)}</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}
