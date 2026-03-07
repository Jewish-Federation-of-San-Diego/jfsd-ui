import { useState, useEffect, useMemo } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Space, Tag, Progress } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { DataFreshness } from '../components/DataFreshness';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safePercent } from '../utils/formatters';
import { NAVY, GOLD, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';

const { Title, Text } = Typography;
const ANALYTICS = '#009191';

interface AuditIssue {
  type: 'FIX' | 'IMPROVE' | 'ADD' | 'OK';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  description: string;
}

interface DashboardEntry {
  name: string;
  file: string;
  score: 'Strong' | 'Mostly Good' | 'Needs Work' | 'Critical';
  issues: AuditIssue[];
}

interface AuditSummary {
  total: number;
  strong: number;
  good: number;
  needsWork: number;
  critical: number;
  topIssues: string[];
  chartCrimes: number;
  totalIssues: number;
  previouslyFixed: number;
}

interface AuditData {
  summary: AuditSummary;
  dashboards: DashboardEntry[];
}

const SCORE_COLOR: Record<string, string> = {
  'Strong': SUCCESS,
  'Mostly Good': GOLD,
  'Needs Work': '#d98000',
  'Critical': ERROR,
};

const ISSUE_COLOR: Record<string, string> = {
  'FIX': ERROR,
  'IMPROVE': GOLD,
  'ADD': '#1c88ed',
  'OK': SUCCESS,
};

const DASHBOARD_CARD_STYLE = { borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };

export function DashboardAuditDashboard() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<AuditData>('/jfsd-ui/data/dashboard-audit.json')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const scoreDistribution = useMemo(() => {
    if (!data) return [];
    return [
      { score: 'Strong', count: data.summary.strong, color: SUCCESS },
      { score: 'Mostly Good', count: data.summary.good, color: GOLD },
      { score: 'Needs Work', count: data.summary.needsWork, color: '#d98000' },
      { score: 'Critical', count: data.summary.critical, color: ERROR },
    ];
  }, [data]);

  const sortedDashboards = useMemo(() => {
    if (!data) return [];
    const scoreOrder = { 'Critical': 0, 'Needs Work': 1, 'Mostly Good': 2, 'Strong': 3 };
    return [...data.dashboards].sort((a, b) =>
      (scoreOrder[a.score] ?? 2) - (scoreOrder[b.score] ?? 2)
    );
  }, [data]);

  const fixCount = useMemo(() => {
    if (!data) return 0;
    return data.dashboards.reduce((sum, d) =>
      sum + d.issues.filter(i => i.type === 'FIX').length, 0
    );
  }, [data]);

  if (loading) return <DashboardSkeleton kpiCount={4} />;
  if (error || !data) return <DashboardErrorState message="Failed to load dashboard audit data" description={error ?? undefined} />;

  const pctStrong = data.summary.total > 0
    ? ((data.summary.strong + data.summary.good) / data.summary.total * 100)
    : 0;

  const columns = [
    {
      title: 'Dashboard',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 130,
      render: (score: string) => (
        <Tag color={SCORE_COLOR[score] ?? MUTED} style={{ fontWeight: 600 }}>
          {score}
        </Tag>
      ),
    },
    {
      title: 'Issues',
      key: 'issues',
      width: 80,
      render: (_: unknown, record: DashboardEntry) => (
        <Text style={{ color: record.issues.filter(i => i.type !== 'OK').length > 0 ? GOLD : SUCCESS }}>
          {safeCount(record.issues.filter(i => i.type !== 'OK').length)}
        </Text>
      ),
    },
    {
      title: 'Breakdown',
      key: 'breakdown',
      render: (_: unknown, record: DashboardEntry) => (
        <Space size={4} wrap>
          {record.issues
            .filter(i => i.type !== 'OK')
            .map((issue, idx) => (
              <Tag key={idx} color={ISSUE_COLOR[issue.type]} style={{ fontSize: 11 }}>
                {issue.type}
              </Tag>
            ))}
          {record.issues.filter(i => i.type === 'OK').length > 0 && (
            <Tag color={SUCCESS} style={{ fontSize: 11 }}>
              {record.issues.filter(i => i.type === 'OK').length} OK
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: DashboardEntry) => (
    <div style={{ padding: '8px 0' }}>
      {record.issues.map((issue, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'flex-start' }}>
          <Tag color={ISSUE_COLOR[issue.type]} style={{ fontSize: 11, flexShrink: 0 }}>
            {issue.type}
          </Tag>
          <Text style={{ fontSize: 13, color: issue.type === 'OK' ? MUTED : '#1e293b' }}>
            {issue.description}
          </Text>
        </div>
      ))}
    </div>
  );

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space align="center">
        <Tag color={ANALYTICS}>Analytics</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Dashboard Visualization Audit
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>
        All 34 dashboards evaluated against the data visualization decision matrix.
      </Text>

      {/* KPIs */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title={`${safeCount(data.summary.strong + data.summary.good)} of ${safeCount(data.summary.total)} pass — ${safePercent(pctStrong, { decimals: 0 })} compliance`}
              value={safeCount(data.summary.total)}
              suffix="dashboards"
              valueStyle={{ color: NAVY }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title={fixCount > 0 ? `${safeCount(fixCount)} chart crimes remain` : 'No chart crimes'}
              value={safeCount(data.summary.chartCrimes)}
              suffix="chart crimes found"
              valueStyle={{ color: fixCount > 0 ? ERROR : SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title={`Across ${safeCount(data.summary.total)} dashboards`}
              value={safeCount(data.summary.totalIssues)}
              suffix="issues"
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Previously fixed in Phase 2"
              value={safeCount(data.summary.previouslyFixed)}
              suffix="dashboards"
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
      </Row>

      {/* Score Distribution */}
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}
        title={`Score distribution — ${safeCount(data.summary.strong)} strong, ${safeCount(data.summary.needsWork + data.summary.critical)} need work`}>
        <Row gutter={[16, 8]}>
          {scoreDistribution.map(({ score, count, color }) => (
            <Col xs={12} sm={6} key={score}>
              <div style={{ textAlign: 'center' }}>
                <Progress
                  type="line"
                  percent={data.summary.total > 0 ? Math.round(count / data.summary.total * 100) : 0}
                  strokeColor={color}
                  format={() => safeCount(count)}
                  style={{ marginBottom: 4 }}
                />
                <Text style={{ fontSize: 12, color: MUTED }}>{score}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Top Issues */}
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}
        title={`Top cross-cutting issues — ${safeCount(data.summary.topIssues.length)} patterns affecting multiple dashboards`}>
        {data.summary.topIssues.map((issue, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <Tag color={idx < 2 ? ERROR : GOLD} style={{ fontSize: 11 }}>{idx + 1}</Tag>
            <Text style={{ fontSize: 13 }}>{issue}</Text>
          </div>
        ))}
      </Card>

      {/* Full Dashboard Table */}
      <Card bordered={false} style={DASHBOARD_CARD_STYLE}
        title={`All ${safeCount(data.summary.total)} dashboards — sorted by severity (worst first)`}>
        <Table
          dataSource={sortedDashboards.map(d => ({ ...d, key: d.file }))}
          columns={columns}
          expandable={{ expandedRowRender }}
          pagination={false}
          size="small"
          style={{ fontSize: 13 }}
        />
      </Card>

      <DataFreshness asOfDate="2026-03-07" />
    </Space>
  );
}
