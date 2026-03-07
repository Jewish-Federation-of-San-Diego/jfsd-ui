import { Card, Col, Row, Statistic, Table, Tag, Space, Badge } from 'antd';
import { useEffect, useState } from 'react';
import { TrophyOutlined } from '@ant-design/icons';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD, SUCCESS, ERROR } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safeCurrency, safePercent } from '../utils/formatters';

interface Run {
  date: string; winner: string; detective: number; oracle: number; whisperer: number; findings: string;
}
interface Finding {
  date: string; analyst: string; category: string; title: string; summary: string; impact: number; severity: string;
}
interface Trend {
  title: string; direction: string; occurrences: string; firstSeen: number; lastSeen: string;
}
interface Analyst { wins: number; runs: number; avgScore: number; bestScore: number; }
interface DuelData {
  asOfDate: string; runs: Run[]; topFindings: Finding[]; trends: Trend[];
  analysts: Record<string, Analyst>; kpis: { totalRuns: number; totalFindings: number; totalImpact: number; openQuestions: number };
}

const ANALYST_COLORS: Record<string, string> = {
  donor_whisperer: GOLD, data_detective: NAVY, operations_oracle: SUCCESS,
};
const ANALYST_LABELS: Record<string, string> = {
  donor_whisperer: '🔮 Whisperer', data_detective: '🔍 Detective', operations_oracle: '🏛️ Oracle',
};
const fmtUSD = (v: number) => safeCurrency(v, { notation: 'compact', maximumFractionDigits: 1 });

export function DataDuelDashboard() {
  const [data, setData] = useState<DuelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<DuelData>(`${import.meta.env.BASE_URL}data/data-duel.json`);
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
  if (error) return <DashboardErrorState message="Failed to load Data Duel data" description={error} />;
  if (!data) return <DashboardErrorState message="Missing Data Duel data" />;

  const kpis = data.kpis ?? { totalRuns: 0, totalFindings: 0, totalImpact: 0, openQuestions: 0 };
  const analysts = data.analysts ?? {};

  const runCols = [
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Winner', dataIndex: 'winner', key: 'winner',
      render: (v: string) => <Tag color={ANALYST_COLORS[v]} style={{ color: '#fff' }}><TrophyOutlined /> {ANALYST_LABELS[v] || v}</Tag> },
    { title: <DefinitionTooltip term="Data Detective" dashboardKey="data-duel">Detective</DefinitionTooltip>, dataIndex: 'detective', key: 'det' },
    { title: <DefinitionTooltip term="Operations Oracle" dashboardKey="data-duel">Oracle</DefinitionTooltip>, dataIndex: 'oracle', key: 'orc' },
    { title: <DefinitionTooltip term="Donor Whisperer" dashboardKey="data-duel">Whisperer</DefinitionTooltip>, dataIndex: 'whisperer', key: 'whi' },
  ];

  const findingCols = [
    { title: 'Finding', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Analyst', dataIndex: 'analyst', key: 'analyst',
      render: (v: string) => <Tag color={ANALYST_COLORS[v]}>{ANALYST_LABELS[v] || v}</Tag> },
    { title: 'Impact', dataIndex: 'impact', key: 'impact', render: (v: number) => fmtUSD(v),
      sorter: (a: Finding, b: Finding) => a.impact - b.impact, defaultSortOrder: 'descend' as const },
    { title: 'Severity', dataIndex: 'severity', key: 'sev',
      render: (v: string) => <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'default'}>{v}</Tag> },
  ];

  const trendCols = [
    { title: 'Trend', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Direction', dataIndex: 'direction', key: 'dir',
      render: (v: string) => <Tag color={v === 'improving' ? 'green' : v === 'declining' ? 'red' : 'blue'}>{v}</Tag> },
    { title: 'Occurrences', dataIndex: 'occurrences', key: 'occ' },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate ?? ''} />

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title="Total Runs" value={safeCount(kpis.totalRuns)} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Findings" value={safeCount(kpis.totalFindings)} valueStyle={{ color: GOLD }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Dollar Impact" dashboardKey="data-duel">Total Impact</DefinitionTooltip>} value={fmtUSD(kpis.totalImpact)} valueStyle={{ color: SUCCESS }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Open Questions" value={safeCount(kpis.openQuestions)} valueStyle={{ color: ERROR }} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        {Object.entries(analysts).map(([key, a]) => (
          <Col xs={24} sm={8} key={key}>
            <Card style={{ borderTop: `3px solid ${ANALYST_COLORS[key] || NAVY}` }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{ANALYST_LABELS[key] || key}</div>
                <Badge count={`${safeCount(a.wins)}W`} style={{ backgroundColor: ANALYST_COLORS[key] || NAVY, fontSize: 16, padding: '0 12px', height: 28, lineHeight: '28px' }} />
                <div style={{ marginTop: 8, color: '#8C8C8C', fontSize: 12 }}>
                  Avg: {safePercent(a.avgScore, { decimals: 1 }).replace('%', '')} | Best: {safeCount(a.bestScore)} | {safeCount(a.runs)} runs
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title={data.runs?.length > 0 
        ? `${safeCount(data.runs.length)} runs — ${(() => {
            const winCounts = Object.entries(analysts).map(([key, analyst]) => ({ key, wins: analyst.wins, label: ANALYST_LABELS[key] || key }));
            const topAnalyst = winCounts.reduce((max, current) => current.wins > max.wins ? current : max, { wins: 0, label: 'None' });
            return `${topAnalyst.label} leads with ${safeCount(topAnalyst.wins)} wins`;
          })()}`
        : "Run History"
      }>
        <Table dataSource={data.runs} columns={runCols} rowKey="date" size="small" pagination={false} scroll={{ x: 500 }} />
      </Card>

      <Card title={data.topFindings?.length > 0 
        ? `${safeCount(data.topFindings.length)} findings — Total impact ${fmtUSD(data.topFindings.reduce((sum, f) => sum + (f.impact || 0), 0))}`
        : "Top Findings by Impact"
      }>
        <Table dataSource={data.topFindings} columns={findingCols} rowKey={(r) => `${r.date}-${r.title}`}
          size="small" pagination={{ pageSize: 10 }} scroll={{ x: 600 }} />
      </Card>

      <Card title={data.trends?.length > 0 
        ? `${safeCount(data.trends.length)} active trends — ${data.trends.filter(t => t.direction === 'improving').length} improving, ${data.trends.filter(t => t.direction === 'declining').length} declining`
        : "Active Trends"
      }>
        <Table dataSource={data.trends} columns={trendCols} rowKey="title" size="small" pagination={false} scroll={{ x: 500 }} />
      </Card>
    </Space>
  );
}
