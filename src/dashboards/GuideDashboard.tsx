import { Card, Col, Row, Typography, Space, Tag, Divider } from 'antd';
import {
  FundOutlined, HeartOutlined, UsergroupAddOutlined, DollarOutlined,
  TrophyOutlined, AlertOutlined, TeamOutlined, PhoneOutlined, SearchOutlined,
  FileTextOutlined, MailOutlined, BankOutlined, ApartmentOutlined,
  AccountBookOutlined, ShoppingCartOutlined, CreditCardOutlined,
  DashboardOutlined, HomeOutlined, ProjectOutlined, CalendarOutlined,
  SafetyCertificateOutlined, LineChartOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { NAVY, GOLD, SUCCESS, MUTED } from '../theme/jfsdTheme';

const { Title, Text, Paragraph } = Typography;

// ── Section colors matching sidebar groups ──
const DEVELOPMENT = '#1c88ed';
const FINANCE = '#236B4A';
const OPERATIONS = '#594fa3';
const ANALYTICS = '#009191';

interface DashboardItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  chartTypes: string[];
  dataSource: string;
}

const SECTIONS: { name: string; color: string; description: string; dashboards: DashboardItem[] }[] = [
  {
    name: 'Development',
    color: DEVELOPMENT,
    description: 'Fundraising intelligence: campaign tracking, donor lifecycle analysis, portfolio management, and prospect research. These dashboards power the development team\'s daily decisions on who to call, what to ask, and where the gaps are.',
    dashboards: [
      { key: 'campaign', label: 'Campaign Tracker', icon: <FundOutlined />, description: 'Annual Campaign progress vs goal, momentum tracking, and donor acquisition trends.', chartTypes: ['Line (momentum)', 'Bar (YoY)', 'KPI cards'], dataSource: 'campaign-tracker.json' },
      { key: 'donor-health', label: 'Donor Health', icon: <HeartOutlined />, description: 'Refund monitoring, new donor sources, lapsed reactivation, and milestone tracking.', chartTypes: ['KPI cards', 'Tables with status'], dataSource: 'sharon-donor-health.json' },
      { key: 'drm', label: 'DRM Portfolios', icon: <UsergroupAddOutlined />, description: 'Portfolio performance by Development Relationship Manager. LYBUNT risk, activity, and donor assignments.', chartTypes: ['KPI cards', 'Filtered tables'], dataSource: 'drm-portfolio.json' },
      { key: 'share-of-wallet', label: 'Share of Wallet', icon: <DollarOutlined />, description: 'WealthEngine capacity vs actual giving. Identifies upgrade opportunities using SOW quadrants: Big Upside (<5%), Upgrade (5-15%), Engaged (15-40%), Champion (>40%).', chartTypes: ['Scatter (capacity vs giving)', 'Histogram (SOW distribution)'], dataSource: 'donor_data.json' },
      { key: 'major-gifts', label: 'Major Gifts', icon: <TrophyOutlined />, description: 'Pipeline funnel tracking, stage distribution, close rates, and prospect prioritization.', chartTypes: ['Funnel (pipeline)', 'Horizontal bar (stages)', 'Prospect table'], dataSource: 'pipeline-data.json' },
      { key: 'the-unasked', label: 'The Unasked', icon: <AlertOutlined />, description: 'Donors with capacity who haven\'t been solicited. Filtered by tier, DRM, and years since last ask. The "money left on the table" dashboard.', chartTypes: ['Histogram (capacity)', 'Filtered table'], dataSource: 'donor_data.json' },
      { key: 'donor-lifecycle', label: 'Donor Lifecycle', icon: <TeamOutlined />, description: 'Segment migration analysis: New, Retained, Upgraded, Downgraded, Lapsed, Reactivated. Shows how donors move between giving bands year over year.', chartTypes: ['Bar (segments)', 'Heatmap (migration matrix)', 'YoY comparison'], dataSource: 'donor_data.json' },
      { key: 'ask-list', label: 'Outreach', icon: <PhoneOutlined />, description: 'Weekly prioritized ask list for DRMs. Sorted by impact potential with suggested amounts.', chartTypes: ['Prioritized table', 'Impact indicators'], dataSource: 'donor_data.json' },
      { key: 'prospect', label: 'Prospect Research', icon: <SearchOutlined />, description: 'Research pipeline status, capacity analysis, and prospect scoring for new cultivation targets.', chartTypes: ['KPI cards', 'Pipeline table'], dataSource: 'donor_data.json' },
      { key: 'pledge', label: 'Pledge Management', icon: <FileTextOutlined />, description: 'Open pledges, fulfillment rates, aging analysis, and payment tracking. Flags overdue pledges.', chartTypes: ['KPI cards', 'Aging table', 'Campaign breakdown'], dataSource: 'campaign-tracker.json' },
      { key: 'board', label: 'Board Reporting', icon: <TeamOutlined />, description: 'Board giving participation rates by organization. Tracks the 100% board participation goal.', chartTypes: ['KPI cards', 'Participation bars', 'Member table'], dataSource: 'board-reporting.json' },
      { key: 'hubspot', label: 'HubSpot', icon: <MailOutlined />, description: 'Email marketing engagement: open rates, click rates, segment health, and campaign performance.', chartTypes: ['Segment cards', 'Campaign table'], dataSource: 'HubSpot API' },
      { key: 'silence', label: 'Silence Alerts', icon: <AlertOutlined />, description: 'Donors who have gone silent. Risk-tiered by giving history and time since last engagement.', chartTypes: ['Risk tier cards', 'Silent donor table'], dataSource: 'donor_data.json' },
      { key: 'wealth', label: 'WealthEngine', icon: <BankOutlined />, description: 'Wealth screening results: capacity tiers, top prospects, and screening coverage rates.', chartTypes: ['KPI cards', 'Prospect table'], dataSource: 'donor_data.json' },
      { key: 'boards', label: 'Nonprofit Boards', icon: <ApartmentOutlined />, description: 'Cross-organizational board member database. 113 orgs, 1,650 board members, SF match rates.', chartTypes: ['KPI cards', 'Organization table'], dataSource: 'research.db' },
    ],
  },
  {
    name: 'Finance',
    color: FINANCE,
    description: 'Financial oversight: GL statements, payment analytics, expense management, and online giving. Designed for the CFO and Finance Committee, with emphasis on variance analysis and trend detection.',
    dashboards: [
      { key: 'financial', label: 'Financial Statements', icon: <AccountBookOutlined />, description: 'Statement of Activities and Statement of Financial Position. ASC 958 format with budget vs actual.', chartTypes: ['Financial tables', 'Variance highlighting'], dataSource: 'Sage Intacct GL' },
      { key: 'stripe', label: 'Stripe Analytics', icon: <DollarOutlined />, description: 'Payment processing: volume trends, fee analysis, card brand distribution, and failure rates.', chartTypes: ['Line (trends)', 'Bar (monthly)', 'Stacked (brands)'], dataSource: 'Stripe API' },
      { key: 'givecloud', label: 'GiveCloud', icon: <ShoppingCartOutlined />, description: 'Online giving platform: MRR trends, donor sources, product performance, and recurring health.', chartTypes: ['Line (MRR)', 'Bar (sources)', 'KPI cards'], dataSource: 'GiveCloud API' },
      { key: 'ramp', label: 'Ramp Analytics', icon: <CreditCardOutlined />, description: 'Corporate card spending: department breakdowns, top merchants, receipt compliance, and anomaly detection.', chartTypes: ['Treemap (spending)', 'Line (trends)', 'Compliance bars'], dataSource: 'Ramp API' },
      { key: 'ap-expense', label: 'AP & Expense', icon: <DashboardOutlined />, description: 'Accounts payable aging, department spending pace vs budget, and GL health monitoring.', chartTypes: ['Horizontal bar (departments)', 'KPI cards', 'Action table'], dataSource: 'james-ap-expense.json' },
      { key: 'holdings', label: 'Holdings', icon: <HomeOutlined />, description: 'UJF Holdings Corp financial overview: assets, liabilities, leverage ratio, and key metrics.', chartTypes: ['KPI cards', 'Summary table'], dataSource: 'Sage Intacct GL' },
    ],
  },
  {
    name: 'Operations',
    color: OPERATIONS,
    description: 'Operational monitoring: building systems, project tracking, event management, and AI voice agents. Real-time awareness of what\'s happening across facilities and programs.',
    dashboards: [
      { key: 'facilities', label: 'Facilities', icon: <HomeOutlined />, description: 'Building comfort monitoring: zone temperatures, HVAC status, server room alerts, and comfort scores.', chartTypes: ['Status cards', 'Sparklines', 'Zone grid'], dataSource: 'Ecobee API' },
      { key: 'projects', label: 'Project Tracker', icon: <ProjectOutlined />, description: 'Project status board: in-progress, blocked, and completed items across all departments.', chartTypes: ['Status cards', 'Project table'], dataSource: 'PROJECTS.md' },
      { key: 'monday', label: 'Monday.com', icon: <CalendarOutlined />, description: 'Monday.com board analytics: item counts, status distribution, and board activity.', chartTypes: ['Bar (boards)', 'KPI cards'], dataSource: 'Monday.com API' },
      { key: 'voice-agent', label: 'Voice Agent', icon: <PhoneOutlined />, description: 'AI voice agent monitoring: call volumes, agent activity, and performance tracking for Dalia, Mira, Hala, Scout, and H2.', chartTypes: ['Line (calls over time)', 'Bar (by agent)'], dataSource: 'ElevenLabs' },
      { key: 'immersive-travel', label: 'Immersive Travel', icon: <CalendarOutlined />, description: 'Mission trip tracking: registration timelines, fill rates, revenue per seat, and trip comparisons.', chartTypes: ['Line (registrations)', 'Bar (revenue)', 'Trip table'], dataSource: 'travel/trips.json' },
    ],
  },
  {
    name: 'Analytics',
    color: ANALYTICS,
    description: 'Deep analytics and meta-tools: cohort analysis, retention modeling, data quality scoring, and visualization standards. These dashboards analyze the data itself, not just report it.',
    dashboards: [
      { key: 'data-quality', label: 'Data Quality', icon: <SafetyCertificateOutlined />, description: 'Salesforce data quality scoring: completeness, consistency, and hygiene metrics.', chartTypes: ['Score cards', 'Quality bars'], dataSource: 'Salesforce API' },
      { key: 'data-duel', label: 'Data Duel', icon: <TrophyOutlined />, description: 'Daily AI analyst competition: three AI agents analyze JFSD data independently, scored by finding impact.', chartTypes: ['Run history', 'Finding table', 'Trend tracking'], dataSource: 'data-duel runs' },
      { key: 'ecobee-trends', label: 'Ecobee Trends', icon: <LineChartOutlined />, description: '28-day temperature trends, daily averages, and server room monitoring across all building zones.', chartTypes: ['Line (28-day)', 'Zone comparison'], dataSource: 'Ecobee API' },
      { key: 'chart-gallery', label: 'Chart Gallery', icon: <BarChartOutlined />, description: 'Reference gallery of Plotly chart types available in the platform. Training resource for dashboard builders.', chartTypes: ['41 chart examples'], dataSource: 'Static HTML' },
      { key: 'cohort-analysis', label: 'Cohort Analysis', icon: <LineChartOutlined />, description: 'Donor cohort survival curves: tracks how giving cohorts retain over FY24→FY25→FY26. Identifies which acquisition vintages produce lasting donors.', chartTypes: ['Line (survival curves)', 'Heatmap (retention)'], dataSource: 'donor_data.json' },
      { key: 'retention-flow', label: 'Retention Flow', icon: <ApartmentOutlined />, description: 'Sankey diagram showing donor flow between states: Retained, Upgraded, Downgraded, Lapsed. The clearest view of where donors go.', chartTypes: ['Sankey (flow)', 'KPI cards'], dataSource: 'donor_data.json' },
      { key: 'community-network', label: 'Community Network', icon: <ApartmentOutlined />, description: 'D3 force-directed graph of community relationships. Reveals hidden connectors and influence clusters.', chartTypes: ['D3 force graph', 'Node table'], dataSource: 'network-data.json' },
      { key: 'dashboard-audit', label: 'Dashboard Audit', icon: <SafetyCertificateOutlined />, description: 'Meta-dashboard: scores all 34 dashboards against the data visualization decision matrix. Tracks compliance and identifies chart crimes.', chartTypes: ['Score distribution', 'Issue table'], dataSource: 'dashboard-audit.json' },
    ],
  },
];

const CARD_STYLE = { borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };

interface GuideProps {
  onNavigate?: (key: string) => void;
}

export function GuideDashboard({ onNavigate }: GuideProps) {
  const totalDashboards = SECTIONS.reduce((sum, s) => sum + s.dashboards.length, 0);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 960 }}>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #27277c 0%, #1c88ed 100%)', borderRadius: 12, padding: '2rem 2.5rem', color: '#fff' }}>
        <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
          Federation Analytics
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
          {totalDashboards} dashboards across 4 domains — Development, Finance, Operations, Analytics
        </Text>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '1.25rem 0' }} />

        <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.7, marginBottom: 0 }}>
          This platform provides Jewish Federation of San Diego with institutional-grade analytics
          across fundraising, financial operations, facilities, and donor intelligence.
          Every dashboard follows a unified design system built on three principles:
          <strong> insight-first titles</strong> (charts tell you what matters, not just what they show),
          <strong> semantic color</strong> (green means favorable, orange means unfavorable — always),
          and <strong> progressive disclosure</strong> (KPIs first, then charts, then detail tables).
        </Paragraph>
      </div>

      {/* Design Philosophy */}
      <Card bordered={false} style={CARD_STYLE}>
        <Title level={4} style={{ color: NAVY, marginTop: 0 }}>
          Design Philosophy
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: '#f0fdf4', border: 'none', height: '100%' }}>
              <Title level={5} style={{ color: SUCCESS, marginTop: 0 }}>Insight, Not Decoration</Title>
              <Text style={{ fontSize: 13 }}>
                Every chart earns its place by answering a question. Titles state the finding
                ("Pipeline at $2.8M needs 3x velocity") not the label ("Pipeline Chart").
                No pie charts, no 3D effects, no gauges. If a big number works better than a chart, we use the number.
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: '#eff6ff', border: 'none', height: '100%' }}>
              <Title level={5} style={{ color: DEVELOPMENT, marginTop: 0 }}>Decision Matrix</Title>
              <Text style={{ fontSize: 13 }}>
                Chart type selection follows a structured decision matrix: <em>What relationship are you showing?</em>
                {' '}Change over time → line chart. Magnitude comparison → horizontal bar. Correlation → scatter.
                Flow/process → Sankey. This eliminates "what chart should I use?" debates and ensures consistency across 34 dashboards.
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card size="small" style={{ background: '#fefce8', border: 'none', height: '100%' }}>
              <Title level={5} style={{ color: GOLD, marginTop: 0 }}>Semantic Color System</Title>
              <Text style={{ fontSize: 13 }}>
                Color carries meaning, not decoration. Forest green (<span style={{ color: SUCCESS }}>■</span>) = favorable.
                Orange (<span style={{ color: '#eb6136' }}>■</span>) = unfavorable.
                Gold (<span style={{ color: GOLD }}>■</span>) = watch.
                Navy (<span style={{ color: NAVY }}>■</span>) = neutral/primary.
                A user scanning any dashboard instantly knows what needs attention without reading a legend.
              </Text>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Platform Review */}
      <Card bordered={false} style={CARD_STYLE}>
        <Title level={4} style={{ color: NAVY, marginTop: 0 }}>
          Platform Maturity
        </Title>
        <Paragraph style={{ color: MUTED, fontSize: 13 }}>
          This platform has been through three rounds of independent review against McKinsey-style
          analytical standards. The current v3 review scored it across 8 dimensions including
          information architecture, data quality, visual design, interactivity, and strategic value.
          The strongest gains have been in strategic analytics — Share of Wallet, Cohort Survival,
          Retention Flow, and The Unasked are tools most nonprofits pay five-figure annual fees for.
          The Dashboard Audit page tracks ongoing compliance with visualization best practices.
        </Paragraph>
        <Row gutter={[12, 8]}>
          {[
            { label: 'Information Architecture', score: '6.5/10', trend: 'Navigation needs collapsible groups' },
            { label: 'Visual Design', score: '8.5/10', trend: 'Strong — consistent brand system' },
            { label: 'Strategic Value', score: '8/10', trend: 'Best improvement area in v3' },
            { label: 'Developer Experience', score: '7.5/10', trend: 'CI/CD, standards, shared utilities' },
          ].map(({ label, score, trend }) => (
            <Col xs={12} sm={6} key={label}>
              <div style={{ textAlign: 'center', padding: '0.5rem' }}>
                <Text strong style={{ fontSize: 18, color: NAVY }}>{score}</Text>
                <br />
                <Text style={{ fontSize: 11, color: MUTED }}>{label}</Text>
                <br />
                <Text style={{ fontSize: 10, color: GOLD }}>{trend}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Chart Type Quick Reference */}
      <Card bordered={false} style={CARD_STYLE}>
        <Title level={4} style={{ color: NAVY, marginTop: 0 }}>
          Chart Type Quick Reference
        </Title>
        <Paragraph style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>
          Every chart type was selected using the decision matrix. Here's when we use each one:
        </Paragraph>
        <Row gutter={[12, 8]}>
          {[
            { type: 'Line Chart', when: 'Change over time — campaign momentum, temperature trends, MRR growth', color: DEVELOPMENT },
            { type: 'Horizontal Bar', when: 'Magnitude comparison — department spending, stage distribution, donor segments', color: FINANCE },
            { type: 'Scatter Plot', when: 'Correlation — capacity vs giving (Share of Wallet), with quadrant annotations', color: ANALYTICS },
            { type: 'Sankey Diagram', when: 'Flow between states — donor retention paths (Retained → Upgraded → Lapsed)', color: OPERATIONS },
            { type: 'Heatmap', when: 'Pattern density — cohort retention rates, migration matrices', color: ANALYTICS },
            { type: 'Treemap', when: 'Hierarchical magnitude — Ramp spending by category and merchant', color: FINANCE },
            { type: 'KPI Cards', when: 'Executive summary — always the first row, answering "what\'s the headline?"', color: NAVY },
            { type: 'Tables', when: 'Detail drill-down — always last, after KPIs and charts tell the story first', color: MUTED },
          ].map(({ type, when, color }) => (
            <Col xs={24} sm={12} key={type}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <Tag color={color} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600 }}>{type}</Tag>
                <Text style={{ fontSize: 12 }}>{when}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Dashboard Directory */}
      {SECTIONS.map((section) => (
        <Card bordered={false} key={section.name} style={{ ...CARD_STYLE, borderLeft: `4px solid ${section.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Title level={4} style={{ color: section.color, margin: 0 }}>
              {section.name}
            </Title>
            <Tag color={section.color}>{section.dashboards.length} dashboards</Tag>
          </div>
          <Paragraph style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>
            {section.description}
          </Paragraph>
          <Row gutter={[12, 12]}>
            {section.dashboards.map((d) => (
              <Col xs={24} sm={12} key={d.key}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => onNavigate?.(d.key)}
                  style={{ cursor: onNavigate ? 'pointer' : 'default', height: '100%' }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: section.color, fontSize: 16 }}>{d.icon}</span>
                    <Text strong style={{ fontSize: 13 }}>{d.label}</Text>
                    {onNavigate && <Text style={{ fontSize: 11, color: MUTED, marginLeft: 'auto' }}>→</Text>}
                  </div>
                  <Text style={{ fontSize: 12, color: '#475569' }}>{d.description}</Text>
                  <div style={{ marginTop: 6 }}>
                    {d.chartTypes.map((ct, i) => (
                      <Tag key={i} style={{ fontSize: 10, marginBottom: 2 }} color="default">{ct}</Tag>
                    ))}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      ))}

      {/* Banned Patterns */}
      <Card bordered={false} style={{ ...CARD_STYLE, borderLeft: `4px solid #eb6136` }}>
        <Title level={4} style={{ color: '#eb6136', marginTop: 0 }}>
          What You Won't Find Here
        </Title>
        <Paragraph style={{ fontSize: 13 }}>
          The following chart types are banned from this platform. They're common in dashboards but consistently
          fail to communicate data effectively:
        </Paragraph>
        <Row gutter={[12, 8]}>
          {[
            { type: 'Pie Charts', reason: 'Humans can\'t accurately compare angles. Horizontal bars are always better for part-to-whole.' },
            { type: '3D Charts', reason: 'Perspective distortion makes values unreadable. All our charts are 2D.' },
            { type: 'Gauges', reason: 'Use a tiny portion of available space. A big number + context sentence is faster and clearer.' },
            { type: 'Dual Y-Axes', reason: 'Imply correlation where none exists. Use small multiples instead.' },
            { type: 'Rainbow Palettes', reason: 'Color should encode meaning (good/bad/watch), not categories. Semantic > decorative.' },
          ].map(({ type, reason }) => (
            <Col xs={24} sm={12} key={type}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <Tag color="error" style={{ flexShrink: 0 }}>{type}</Tag>
                <Text style={{ fontSize: 12 }}>{reason}</Text>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <div style={{ textAlign: 'center', padding: '1rem 0', color: MUTED, fontSize: 12 }}>
        Federation Analytics · Jewish Federation of San Diego · Built with React, Ant Design, Plotly · March 2026
      </div>
    </Space>
  );
}
