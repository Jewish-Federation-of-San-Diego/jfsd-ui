import { Card, Col, Row, Table, Tag, Typography, Progress, Spin, Alert, Collapse, Statistic, Space } from 'antd';
import { CsvExport } from '../components/CsvExport';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  BugOutlined,
  TeamOutlined,
  FlagOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { DefinitionTooltip } from '../components/DefinitionTooltip';

const { Text } = Typography;
const { Panel } = Collapse;

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';
const CRITICAL = '#8B0000';
const MUTED = '#8C8C8C';

// ── Types ───────────────────────────────────────────────────────────────
interface IssueDetail {
  name?: string;
  id?: string;
  fy26?: number;
  count?: number;
  giving?: number;
  amount?: number;
  closeDate?: string;
  gifts?: number;
}

interface Issue {
  metric: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: IssueDetail[];
  dollarAmount?: number;
  totalAffectedRecords?: number;
}

interface Category {
  name: string;
  score: number;
  issues: Issue[];
}

interface KPIs {
  overallScore: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalRecordsAffected: number;
  totalMajorDonors: number;
}

interface DataQualityData {
  asOfDate: string;
  overallScore: number;
  categories: Category[];
  kpis: KPIs;
}

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtUSD = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const severityColor: Record<string, string> = {
  critical: CRITICAL,
  high: ERROR,
  medium: WARNING,
  low: MUTED,
};

const severityLabel: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function scoreColor(score: number): string {
  if (score >= 70) return SUCCESS;
  if (score >= 40) return WARNING;
  return ERROR;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Contact Completeness': <TeamOutlined />,
  'Duplicate Records': <BugOutlined />,
  'Campaign Health': <FlagOutlined />,
  'Pipeline Hygiene': <AuditOutlined />,
  'Recognition Integrity': <SafetyCertificateOutlined />,
};

// ── Score Gauge ─────────────────────────────────────────────────────────
function ScoreGauge({ score, size = 160 }: { score: number; size?: number }) {
  const color = scoreColor(score);
  const label = score >= 70 ? 'Good' : score >= 40 ? 'Needs Work' : 'Critical';
  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="dashboard"
        percent={score}
        strokeColor={color}
        trailColor="#f0f0f0"
        width={size}
        format={(pct) => (
          <div>
            <div style={{ fontSize: size * 0.25, fontWeight: 700, color }}>{pct}</div>
            <div style={{ fontSize: size * 0.1, color: MUTED }}>{label}</div>
          </div>
        )}
      />
    </div>
  );
}

// ── Severity Summary Bar ────────────────────────────────────────────────
function SeveritySummary({ kpis }: { kpis: KPIs }) {
  const items = [
    { label: 'Critical', count: kpis.criticalIssues, color: CRITICAL },
    { label: 'High', count: kpis.highIssues, color: ERROR },
    { label: 'Medium', count: kpis.mediumIssues, color: WARNING },
    { label: 'Low', count: kpis.lowIssues, color: MUTED },
  ];
  const total = items.reduce((s, i) => s + i.count, 0) || 1;

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row align="middle" gutter={16}>
        <Col flex="none"><Text strong style={{ color: NAVY }}>Issue Summary</Text></Col>
        <Col flex="auto">
          <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
            {items.filter(i => i.count > 0).map(i => (
              <div
                key={i.label}
                style={{
                  width: `${(i.count / total) * 100}%`,
                  background: i.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  minWidth: 30,
                }}
              >
                {i.count}
              </div>
            ))}
          </div>
        </Col>
        <Col flex="none">
          <Space size={12}>
            {items.map(i => (
              <Text key={i.label} style={{ fontSize: 12 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: i.color, marginRight: 4 }} />
                {i.label}: {i.count}
              </Text>
            ))}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

// ── Category Card ───────────────────────────────────────────────────────
function CategoryCard({ category }: { category: Category }) {
  const icon = categoryIcons[category.name] || <ExclamationCircleOutlined />;

  return (
    <Card
      size="small"
      title={
        <Space>
          <span style={{ color: scoreColor(category.score) }}>{icon}</span>
          <Text strong style={{ color: NAVY }}>{category.name}</Text>
          <Tag color={scoreColor(category.score) === SUCCESS ? 'green' : scoreColor(category.score) === WARNING ? 'gold' : 'red'}>
            {category.score}/100
          </Tag>
        </Space>
      }
      style={{ height: '100%' }}
    >
      <div style={{ marginBottom: 8 }}>
        <Progress
          percent={category.score}
          strokeColor={scoreColor(category.score)}
          showInfo={false}
          size="small"
        />
      </div>

      <Collapse ghost size="small">
        {category.issues.map((issue, idx) => (
          <Panel
            key={idx}
            header={
              <Space>
                <Tag
                  color={
                    issue.severity === 'critical' ? 'magenta' :
                    issue.severity === 'high' ? 'red' :
                    issue.severity === 'medium' ? 'gold' : 'default'
                  }
                  style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                >
                  {severityLabel[issue.severity]}
                </Tag>
                <Text style={{ fontSize: 13 }}>{issue.metric}</Text>
                <Text strong style={{ color: severityColor[issue.severity], fontSize: 13 }}>
                  {issue.count}
                </Text>
                {issue.dollarAmount ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>({fmtUSD(issue.dollarAmount)})</Text>
                ) : null}
              </Space>
            }
          >
            {issue.details && issue.details.length > 0 ? (
              <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <CsvExport data={issue.details} columns={buildColumns(issue).filter((c: any) => c.dataIndex).map((c: any) => ({ title: typeof c.title === 'string' ? c.title : c.dataIndex, dataIndex: c.dataIndex }))} filename={`data-quality-${issue.metric.replace(/\s+/g, '-').toLowerCase()}`} />
              </div>
              <Table
                dataSource={issue.details.map((d, i) => ({ ...d, _key: i }))}
                rowKey="_key"
                size="small"
                pagination={false}
                columns={buildColumns(issue)}
                style={{ fontSize: 12 }}
                scroll={{ x: true }}
              />
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>No detail records available</Text>
            )}
          </Panel>
        ))}
      </Collapse>
    </Card>
  );
}

function buildColumns(issue: Issue) {
  const cols: any[] = [{ title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true }];
  const sample = issue.details?.[0];
  if (!sample) return cols;
  if (sample.fy26 !== undefined) cols.push({ title: 'FY26 Recognition', dataIndex: 'fy26', key: 'fy26', render: (v: number) => fmtUSD(v || 0), width: 140 });
  if (sample.count !== undefined) cols.push({ title: 'Count', dataIndex: 'count', key: 'count', width: 80 });
  if (sample.giving !== undefined) cols.push({ title: 'Giving', dataIndex: 'giving', key: 'giving', render: (v: number) => fmtUSD(v || 0), width: 120 });
  if (sample.amount !== undefined) cols.push({ title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v: number) => fmtUSD(v || 0), width: 120 });
  if (sample.closeDate !== undefined) cols.push({ title: 'Close Date', dataIndex: 'closeDate', key: 'closeDate', width: 110 });
  if (sample.gifts !== undefined) cols.push({ title: 'Gift Txns', dataIndex: 'gifts', key: 'gifts', width: 100 });
  return cols;
}

// ── KPI Row ─────────────────────────────────────────────────────────────
function KPIRow({ kpis }: { kpis: KPIs }) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title={<DefinitionTooltip term="Severity Levels" dashboardKey="data-quality">Total Issues</DefinitionTooltip>}
            value={kpis.totalRecordsAffected}
            valueStyle={{ color: kpis.totalRecordsAffected > 50 ? ERROR : NAVY }}
            prefix={<ExclamationCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title={<DefinitionTooltip term="Overall Score" dashboardKey="data-quality">Critical</DefinitionTooltip>}
            value={kpis.criticalIssues}
            valueStyle={{ color: kpis.criticalIssues > 0 ? CRITICAL : SUCCESS }}
            prefix={<CloseCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="High Priority"
            value={kpis.highIssues}
            valueStyle={{ color: kpis.highIssues > 20 ? ERROR : WARNING }}
            prefix={<WarningOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="Major Donors Tracked"
            value={kpis.totalMajorDonors}
            valueStyle={{ color: NAVY }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function DataQualityDashboard() {
  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/jfsd-ui/data/data-quality.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /><br /><Text type="secondary">Loading data quality metrics…</Text></div>;
  if (error) return <Alert type="error" message="Failed to load data quality data" description={error} showIcon />;
  if (!data) return <Alert type="warning" message="No data available" showIcon />;

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Header */}
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <ScoreGauge score={data.overallScore} size={180} />
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Overall Data Quality Score</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>As of {data.asOfDate}</Text>
          </div>
        </Col>
        <Col xs={24} md={16}>
          <KPIRow kpis={data.kpis} />
          <div style={{ marginTop: 12 }}>
            <SeveritySummary kpis={data.kpis} />
          </div>
        </Col>
      </Row>

      {/* Category Cards */}
      <Row gutter={[16, 16]}>
        {data.categories.map(cat => (
          <Col xs={24} lg={12} key={cat.name}>
            <CategoryCard category={cat} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
