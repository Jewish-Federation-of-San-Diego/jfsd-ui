import { Card, Col, Row, Statistic, Table, Tag, Progress, Space } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safePercent } from '../utils/formatters';

interface Segment { count: number; pct: number; }
interface EngagementData {
  summary: {
    total_contacts: number;
    segments: Record<string, Segment>;
    generated_at: string;
  };
}
interface EmailCampaign {
  id: string; name: string; subject: string; state: string; type: string;
  created: string; updated: string; publishedAt: string | null;
}

const SEGMENT_COLORS: Record<string, string> = {
  Champion: SUCCESS, Active: '#5B8DB8', Passive: GOLD, 'At Risk': ERROR,
  Dormant: MUTED, Ghost: '#152B4D', New: '#9B4DCA',
};

const fmtNum = (v: number) => safeCount(v);

export function HubSpotDashboard() {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [emails, setEmails] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [eng, em] = await Promise.all([
          fetchJson<EngagementData>(`${import.meta.env.BASE_URL}data/hubspot-engagement.json`),
          fetchJson<EmailCampaign[] | { emails: EmailCampaign[] }>(`${import.meta.env.BASE_URL}data/hubspot-emails.json`),
        ]);
        setEngagement(eng);
        setEmails(Array.isArray(em) ? em : (em?.emails ?? []));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardErrorState message="Failed to load HubSpot data" description={error} />;
  if (!engagement) return <DashboardErrorState message="Missing HubSpot engagement data" />;

  const summary = engagement.summary ?? { total_contacts: 0, generated_at: '', segments: {} };
  const segments = Object.entries(summary.segments ?? {}).sort((a, b) => (b[1]?.pct ?? 0) - (a[1]?.pct ?? 0));
  const engagementRate = segments
    .filter(([k]) => ['Champion', 'Active', 'New'].includes(k))
    .reduce((s, [, v]) => s + (v?.pct ?? 0), 0);
  const champions = summary.segments?.Champion?.count || 0;
  const ghosts = summary.segments?.Ghost?.count || 0;

  const emailColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', ellipsis: true },
    { title: 'State', dataIndex: 'state', key: 'state',
      render: (v: string) => <Tag color={v === 'PUBLISHED' ? 'green' : v === 'DRAFT' ? 'default' : 'blue'}>{v}</Tag> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (v: string) => v.replace(/_/g, ' ') },
    { title: 'Created', dataIndex: 'created', key: 'created',
      render: (v: string) => new Date(v).toLocaleDateString() },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={summary.generated_at} />

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title="Total Contacts" value={fmtNum(summary.total_contacts)} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Engagement Rate" value={safePercent(engagementRate, { decimals: 1 })} valueStyle={{ color: SUCCESS }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Champion" dashboardKey="hubspot">Champions</DefinitionTooltip>} value={champions} valueStyle={{ color: GOLD }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Ghost" dashboardKey="hubspot">Ghosts</DefinitionTooltip>} value={fmtNum(ghosts)} valueStyle={{ color: MUTED }} /></Card></Col>
      </Row>

      <Card title={
        <DefinitionTooltip term="Engagement Segment" dashboardKey="hubspot">
          {`${fmtNum(summary.total_contacts)} contacts — ${safePercent(engagementRate, { decimals: 1 })} engaged, ${segments.length > 0 ? segments[0][0] : 'None'} leads at ${safePercent(segments[0]?.[1]?.pct, { decimals: 1 })}`}
        </DefinitionTooltip>
      }>
        {segments.map(([name, seg]) => (
          <div key={name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>{name}</span>
              <span style={{ color: MUTED }}>{fmtNum(seg?.count ?? 0)} ({safePercent(seg?.pct, { decimals: 1 })})</span>
            </div>
            <Progress percent={seg?.pct ?? 0} showInfo={false} strokeColor={SEGMENT_COLORS[name] || NAVY}
              size={['100%', 16]} />
          </div>
        ))}
      </Card>

      <Card title={
        emails.length > 0 
          ? `${emails.length} email campaigns — ${emails.filter(e => e.state === 'PUBLISHED').length} published, ${emails.filter(e => e.state === 'DRAFT').length} draft`
          : `Email Campaigns (${emails.length})`
      }>
        <Table dataSource={emails} columns={emailColumns} rowKey="id"
          size="small" pagination={{ pageSize: 15 }} scroll={{ x: 700 }} />
      </Card>
    </Space>
  );
}
