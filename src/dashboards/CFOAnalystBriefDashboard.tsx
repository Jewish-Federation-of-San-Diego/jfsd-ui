import { Card, Col, Row, Tag, Typography, Space, Alert, Collapse } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useEffect, useState } from 'react';
import {
  BulbOutlined, CheckCircleOutlined,
  QuestionCircleOutlined, AimOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';

import { DataFreshness } from '../components/DataFreshness';
import { NAVY, GOLD, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';

const { Title, Text, Paragraph } = Typography;

// ── Types ───────────────────────────────────────────────────────────────
interface Insight {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  observation: string;
  surfaceRead: string;
  skepticsTake: string;
  action: string;
  goalConnection: string;
  dataPoints: Record<string, string | number>;
}

interface BriefData {
  generatedAt: string;
  weekOf: string;
  insights: Insight[];
  summary: string;
}

// ── Priority config ─────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: ERROR, label: 'CRITICAL' },
  high: { color: GOLD, label: 'HIGH' },
  medium: { color: NAVY, label: 'MEDIUM' },
  low: { color: MUTED, label: 'LOW' },
};

// ── Insight Card ────────────────────────────────────────────────────────
function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const priority = PRIORITY_CONFIG[insight.priority] || PRIORITY_CONFIG.medium;

  return (
    <Card
      style={{ marginBottom: 16, borderLeft: `4px solid ${priority.color}` }}
      title={
        <Space>
          <Tag color={priority.color} style={{ fontWeight: 700 }}>{priority.label}</Tag>
          <Text strong style={{ fontSize: 15 }}>#{index + 1}: {insight.title}</Text>
          <Tag style={{ marginLeft: 8 }}>{insight.source}</Tag>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Observation */}
        <div>
          <Space align="start">
            <CheckCircleOutlined style={{ color: NAVY, fontSize: 16, marginTop: 4 }} />
            <div>
              <Text strong style={{ color: NAVY }}>What the data shows</Text>
              <Paragraph style={{ margin: '4px 0 0', color: '#333' }}>{insight.observation}</Paragraph>
            </div>
          </Space>
        </div>

        {/* Surface Read */}
        <div>
          <Space align="start">
            <BulbOutlined style={{ color: GOLD, fontSize: 16, marginTop: 4 }} />
            <div>
              <Text strong style={{ color: GOLD }}>Obvious conclusion</Text>
              <Paragraph style={{ margin: '4px 0 0', color: '#333' }}>{insight.surfaceRead}</Paragraph>
            </div>
          </Space>
        </div>

        {/* Skeptic's Take */}
        <div style={{ background: '#FFF7ED', padding: '12px 16px', borderRadius: 8, border: '1px solid #FED7AA' }}>
          <Space align="start">
            <QuestionCircleOutlined style={{ color: ERROR, fontSize: 16, marginTop: 4 }} />
            <div>
              <Text strong style={{ color: ERROR }}>Skeptic's take — what else could explain this?</Text>
              <Paragraph style={{ margin: '4px 0 0', color: '#333' }}>{insight.skepticsTake}</Paragraph>
            </div>
          </Space>
        </div>

        {/* Action */}
        <div style={{ background: '#F0FDF4', padding: '12px 16px', borderRadius: 8, border: `1px solid ${SUCCESS}44` }}>
          <Space align="start">
            <AimOutlined style={{ color: SUCCESS, fontSize: 16, marginTop: 4 }} />
            <div>
              <Text strong style={{ color: SUCCESS }}>Recommended action</Text>
              <Paragraph style={{ margin: '4px 0 0', color: '#333' }}>{insight.action}</Paragraph>
            </div>
          </Space>
        </div>

        {/* Goal Connection */}
        {insight.goalConnection && (
          <div>
            <Space align="start">
              <ExclamationCircleOutlined style={{ color: MUTED, fontSize: 16, marginTop: 4 }} />
              <div>
                <Text strong style={{ color: MUTED }}>Goal connection</Text>
                <Paragraph style={{ margin: '4px 0 0', color: MUTED }}>{insight.goalConnection}</Paragraph>
              </div>
            </Space>
          </div>
        )}

        {/* Data Points */}
        {Object.keys(insight.dataPoints).length > 0 && (
          <Collapse
            ghost
            items={[{
              key: 'data',
              label: <Text type="secondary" style={{ fontSize: 12 }}>Supporting data points</Text>,
              children: (
                <Row gutter={[8, 8]}>
                  {Object.entries(insight.dataPoints).map(([k, v]) => (
                    <Col key={k} xs={12} sm={8} md={6}>
                      <div style={{ background: '#F5F5F5', padding: '6px 10px', borderRadius: 4 }}>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{k}</Text>
                        <Text strong style={{ fontSize: 13 }}>{typeof v === 'number' ? v.toLocaleString() : v}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            }]}
          />
        )}
      </Space>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function CFOAnalystBriefDashboard() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<BriefData>(`${import.meta.env.BASE_URL}data/cfo-analyst-brief.json`);
        setData(json);
      } catch {
        // Generate from live data if brief file doesn't exist
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <DashboardSkeleton />;

  // Count by priority
  const insights = data?.insights ?? [];
  const criticalCount = insights.filter(i => i.priority === 'critical').length;
  const highCount = insights.filter(i => i.priority === 'high').length;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {data?.generatedAt && <DataFreshness asOfDate={data.generatedAt} />}

      <div style={{ background: NAVY, padding: '24px 32px', borderRadius: 8, color: '#fff' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          CFO Analyst Brief
        </Title>
        <Text style={{ color: '#ffffffcc', fontSize: 14 }}>
          Week of {data?.weekOf ?? 'March 7, 2026'} · {insights.length} insights across {new Set(insights.map(i => i.source)).size} data sources
        </Text>
        {data?.summary && (
          <Paragraph style={{ color: '#ffffffdd', marginTop: 12, marginBottom: 0, fontSize: 14, lineHeight: 1.6 }}>
            {data.summary}
          </Paragraph>
        )}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Total Insights</Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: NAVY }}>{insights.length}</div>
            </div>
          </Card>
        </Col>
        <Col xs={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Critical</Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: criticalCount > 0 ? ERROR : MUTED }}>{criticalCount}</div>
            </div>
          </Card>
        </Col>
        <Col xs={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>High Priority</Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: highCount > 0 ? GOLD : MUTED }}>{highCount}</div>
            </div>
          </Card>
        </Col>
        <Col xs={6}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Data Sources</Text>
              <div style={{ fontSize: 28, fontWeight: 700, color: SUCCESS }}>{new Set(insights.map(i => i.source)).size}</div>
            </div>
          </Card>
        </Col>
      </Row>

      {insights.length === 0 && (
        <Alert
          type="info"
          message="No analyst brief generated yet"
          description="The weekly CFO Analyst Brief will be generated each Monday morning, analyzing all dashboard data with four-layer insight cards: observation, obvious conclusion, skeptic's take, and recommended action."
          showIcon
        />
      )}

      {insights.map((insight, i) => (
        <InsightCard key={insight.id} insight={insight} index={i} />
      ))}
    </Space>
  );
}

export default CFOAnalystBriefDashboard;
