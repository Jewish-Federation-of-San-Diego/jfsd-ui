import { Card, Col, Row, Statistic, Table, Space } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD, SUCCESS } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safeCurrency, safePercent } from '../utils/formatters';

interface Org { name: string; boardMembers: number; revenue: number; city: string; state: string; }
interface Contact { name: string; title: string; org: string; }
interface BoardsData {
  asOfDate: string;
  kpis: { totalOrgs: number; totalMembers: number; matchedToSF: number; matchRate: number };
  organizations: Org[];
  matchedContacts: Contact[];
}

const fmtUSD = (v: number) => safeCurrency(v, { notation: 'compact', maximumFractionDigits: 1 });

export function NonprofitBoardsDashboard() {
  const [data, setData] = useState<BoardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<BoardsData>(`${import.meta.env.BASE_URL}data/nonprofit-boards.json`);
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
  if (error) return <DashboardErrorState message="Failed to load nonprofit boards data" description={error} />;
  if (!data) return <DashboardErrorState message="Missing nonprofit boards data" />;

  const kpis = data.kpis ?? { totalOrgs: 0, totalMembers: 0, matchedToSF: 0, matchRate: 0 };
  const organizations = data.organizations ?? [];
  const matchedContacts = data.matchedContacts ?? [];

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
      <DataFreshness asOfDate={data.asOfDate ?? ''} />
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title="Organizations" value={safeCount(kpis.totalOrgs)} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Board Members" value={safeCount(kpis.totalMembers)} valueStyle={{ color: GOLD }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="SF Match" dashboardKey="boards">SF Matches</DefinitionTooltip>} value={safeCount(kpis.matchedToSF)} valueStyle={{ color: SUCCESS }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Match Rate" dashboardKey="boards">Match Rate</DefinitionTooltip>} value={safePercent(kpis.matchRate, { decimals: 0 })} valueStyle={{ color: NAVY }} /></Card></Col>
      </Row>

      <Card title={
        organizations.length > 0 
          ? `${organizations.length} organizations, ${kpis.totalMembers} board members — ${safePercent(kpis.matchRate, { decimals: 0 })} match rate`
          : "Top Organizations"
      }>
        <Table dataSource={organizations} columns={orgCols} rowKey="name"
          size="small" pagination={{ pageSize: 15 }} scroll={{ x: 600 }} />
      </Card>

      {matchedContacts.length > 0 && (
        <Card title={`Salesforce Matched Contacts (${safeCount(matchedContacts.length)})`}>
          <Table dataSource={matchedContacts} columns={contactCols} rowKey={(r) => `${r.name}-${r.org}`}
            size="small" pagination={{ pageSize: 15 }} scroll={{ x: 500 }} />
        </Card>
      )}
    </Space>
  );
}
