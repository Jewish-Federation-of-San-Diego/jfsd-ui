import { Card, Col, Row, Statistic, Table, Space } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD, SUCCESS } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';

interface Org { name: string; boardMembers: number; revenue: number; city: string; state: string; }
interface Contact { name: string; title: string; org: string; }
interface BoardsData {
  asOfDate: string;
  kpis: { totalOrgs: number; totalMembers: number; matchedToSF: number; matchRate: number };
  organizations: Org[];
  matchedContacts: Contact[];
}

const fmtUSD = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`;

export function NonprofitBoardsDashboard() {
  const [data, setData] = useState<BoardsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/nonprofit-boards.json`).then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <DashboardSkeleton />;

  const orgCols = [
    { title: 'Organization', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Members', dataIndex: 'boardMembers', key: 'members', sorter: (a: Org, b: Org) => a.boardMembers - b.boardMembers, defaultSortOrder: 'descend' as const },
    { title: 'Revenue', dataIndex: 'revenue', key: 'rev', render: (v: number) => v ? fmtUSD(v) : '—', sorter: (a: Org, b: Org) => (a.revenue||0) - (b.revenue||0) },
    { title: 'City', dataIndex: 'city', key: 'city' },
  ];

  const contactCols = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Organization', dataIndex: 'org', key: 'org', ellipsis: true },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate} />
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title="Organizations" value={data.kpis.totalOrgs} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Board Members" value={data.kpis.totalMembers.toLocaleString()} valueStyle={{ color: GOLD }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="SF Match" dashboardKey="boards">SF Matches</DefinitionTooltip>} value={data.kpis.matchedToSF} valueStyle={{ color: SUCCESS }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Match Rate" dashboardKey="boards">Match Rate</DefinitionTooltip>} value={`${data.kpis.matchRate}%`} valueStyle={{ color: NAVY }} /></Card></Col>
      </Row>

      <Card title="Top Organizations">
        <Table dataSource={data.organizations} columns={orgCols} rowKey="name"
          size="small" pagination={{ pageSize: 15 }} scroll={{ x: 600 }} />
      </Card>

      {data.matchedContacts && (
        <Card title={`Salesforce Matched Contacts (${data.matchedContacts.length})`}>
          <Table dataSource={data.matchedContacts} columns={contactCols} rowKey={(r) => `${r.name}-${r.org}`}
            size="small" pagination={{ pageSize: 15 }} scroll={{ x: 500 }} />
        </Card>
      )}
    </Space>
  );
}
