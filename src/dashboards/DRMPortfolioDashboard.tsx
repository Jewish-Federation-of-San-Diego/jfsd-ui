import { Card, Col, Row, Statistic, Table, Tag, Typography, Select, Spin, Alert, Badge, Space, Tooltip as AntTooltip } from 'antd';
import { CsvExport } from '../components/CsvExport';
import {
  UserOutlined,
  DollarOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { DefinitionTooltip } from '../components/DefinitionTooltip';

const { Text, Title } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const GOLD = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';
const MUTED = '#8C8C8C';

// ── Types ───────────────────────────────────────────────────────────────
interface TopDonor { name: string; fy26: number; fy25: number; email: string; phone: string; }
interface LybuntDonor { name: string; fy25Amount: number; lastGiftDate: string; email: string; phone: string; }
interface Activity { donorName: string; amount: number; date: string; type: string; }
interface DRM {
  name: string; slug: string; totalDonors: number;
  totalRecognitionFY26: number; totalRecognitionFY25: number;
  lybuntCount: number; lybuntAmount: number; sybuntCount: number;
  recentGifts30d: number;
  topDonors: TopDonor[]; lybuntList: LybuntDonor[]; recentActivity: Activity[];
}
interface KPIs { totalPortfolioDonors: number; totalLYBUNT: number; totalRecognitionFY26: number; avgPortfolioSize: number; }
interface PortfolioData { asOfDate: string; drms: DRM[]; kpis: KPIs; }

const fmtUSD = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function healthColor(drm: DRM): string {
  const lybuntPct = drm.totalDonors > 0 ? drm.lybuntCount / drm.totalDonors : 0;
  if (lybuntPct > 0.6) return ERROR;
  if (lybuntPct > 0.4) return WARNING;
  return SUCCESS;
}

// ── KPI Row ─────────────────────────────────────────────────────────────
function KPIRow({ items }: { items: { title: string; value: string | number; color?: string; icon: React.ReactNode }[] }) {
  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      {items.map((item, i) => (
        <Col xs={12} sm={6} key={i}>
          <Card size="small" style={{ borderTop: `3px solid ${item.color || NAVY}` }}>
            <Statistic
              title={<Text style={{ fontSize: 12 }}>{item.title}</Text>}
              value={item.value}
              prefix={item.icon}
              valueStyle={{ color: item.color || NAVY, fontSize: 20 }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

// ── Contact Cell ────────────────────────────────────────────────────────
function ContactCell({ email, phone }: { email: string; phone: string }) {
  return (
    <Space size={4}>
      {email && <AntTooltip title={email}><a href={`mailto:${email}`}><MailOutlined style={{ color: NAVY }} /></a></AntTooltip>}
      {phone && <AntTooltip title={phone}><a href={`tel:${phone}`}><PhoneOutlined style={{ color: NAVY }} /></a></AntTooltip>}
      {!email && !phone && <Text type="secondary">—</Text>}
    </Space>
  );
}

// ── Overview Card Grid ──────────────────────────────────────────────────
function OverviewGrid({ drms, onSelect }: { drms: DRM[]; onSelect: (slug: string) => void }) {
  return (
    <Row gutter={[12, 12]}>
      {drms.map(d => {
        const color = healthColor(d);
        return (
          <Col xs={24} sm={12} md={8} lg={6} key={d.slug}>
            <Card
              hoverable
              size="small"
              onClick={() => onSelect(d.slug)}
              style={{ borderLeft: `4px solid ${color}`, cursor: 'pointer' }}
            >
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 14 }}>{d.name}</Text>
              </div>
              <Row gutter={8}>
                <Col span={12}>
                  <Statistic title="Donors" value={d.totalDonors} valueStyle={{ fontSize: 16 }} />
                </Col>
                <Col span={12}>
                  <Statistic title={<DefinitionTooltip term="Recognition" dashboardKey="drm">FY26</DefinitionTooltip>} value={fmtUSD(d.totalRecognitionFY26)} valueStyle={{ fontSize: 16, color: GOLD }} />
                </Col>
              </Row>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <Badge count={d.lybuntCount} style={{ backgroundColor: d.lybuntCount > 0 ? WARNING : SUCCESS }} overflowCount={999}>
                  <Tag color={d.lybuntCount > 0 ? 'orange' : 'green'}>LYBUNT</Tag>
                </Badge>
                {d.recentGifts30d > 0 && (
                  <Tag color="blue">{d.recentGifts30d} recent</Tag>
                )}
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

// ── DRM Detail View ─────────────────────────────────────────────────────
function DRMDetail({ drm, onBack }: { drm: DRM; onBack: () => void }) {
  return (
    <div>
      <div style={{ marginBottom: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={onBack}>
        <ArrowLeftOutlined style={{ color: NAVY }} />
        <Text style={{ color: NAVY }}>Back to Overview</Text>
      </div>
      <Title level={4} style={{ color: NAVY, margin: '0 0 16px' }}>{drm.name}'s Portfolio</Title>

      <KPIRow items={[
        { title: 'Total Donors', value: drm.totalDonors, icon: <UserOutlined />, color: NAVY },
        { title: 'FY26 Recognition', value: fmtUSD(drm.totalRecognitionFY26), icon: <DollarOutlined />, color: GOLD },
        { title: 'LYBUNT', value: drm.lybuntCount, icon: <WarningOutlined />, color: drm.lybuntCount > 0 ? WARNING : SUCCESS },
        { title: 'Recent Gifts (30d)', value: drm.recentGifts30d, icon: <ClockCircleOutlined />, color: SUCCESS },
      ]} />

      <Row gutter={[16, 16]}>
        {/* LYBUNT Table */}
        <Col xs={24} lg={12}>
          <Card title={<><WarningOutlined style={{ color: WARNING, marginRight: 8 }} /><DefinitionTooltip term="LYBUNT" dashboardKey="drm">LYBUNT Donors</DefinitionTooltip> ({drm.lybuntCount})</>} size="small"
            extra={<CsvExport data={drm.lybuntList} columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'FY25', dataIndex: 'fy25Amount' },
              { title: 'Last Gift', dataIndex: 'lastGiftDate' },
            ]} filename="drm-lybunt" />}>
            <Table
              dataSource={drm.lybuntList}
              rowKey="name"
              size="small"
              pagination={{ pageSize: 10, size: 'small' }}
              scroll={{ x: 500 }}
              columns={[
                { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true, sorter: (a: LybuntDonor, b: LybuntDonor) => a.name.localeCompare(b.name) },
                { title: 'FY25', dataIndex: 'fy25Amount', key: 'fy25', render: (v: number) => fmtUSD(v), sorter: (a: LybuntDonor, b: LybuntDonor) => a.fy25Amount - b.fy25Amount, defaultSortOrder: 'descend' as const },
                { title: 'Last Gift', dataIndex: 'lastGiftDate', key: 'date', render: (v: string) => fmtDate(v), width: 100 },
                { title: 'Contact', key: 'contact', width: 60, render: (_: unknown, r: LybuntDonor) => <ContactCell email={r.email} phone={r.phone} /> },
              ]}
            />
          </Card>
        </Col>

        {/* Top Donors Table */}
        <Col xs={24} lg={12}>
          <Card title={<><DollarOutlined style={{ color: GOLD, marginRight: 8 }} />Top Donors ({drm.topDonors.length})</>} size="small"
            extra={<CsvExport data={drm.topDonors} columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'FY26', dataIndex: 'fy26' },
              { title: 'FY25', dataIndex: 'fy25' },
            ]} filename="drm-top-donors" />}>
            <Table
              dataSource={drm.topDonors}
              rowKey="name"
              size="small"
              pagination={{ pageSize: 10, size: 'small' }}
              scroll={{ x: 500 }}
              columns={[
                { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true, sorter: (a: TopDonor, b: TopDonor) => a.name.localeCompare(b.name) },
                { title: 'FY26', dataIndex: 'fy26', key: 'fy26', render: (v: number) => <Text style={{ color: v > 0 ? GOLD : MUTED }}>{fmtUSD(v)}</Text>, sorter: (a: TopDonor, b: TopDonor) => a.fy26 - b.fy26, defaultSortOrder: 'descend' as const },
                { title: 'FY25', dataIndex: 'fy25', key: 'fy25', render: (v: number) => fmtUSD(v), sorter: (a: TopDonor, b: TopDonor) => a.fy25 - b.fy25 },
                { title: 'Contact', key: 'contact', width: 60, render: (_: unknown, r: TopDonor) => <ContactCell email={r.email} phone={r.phone} /> },
              ]}
            />
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24}>
          <Card title={<><ClockCircleOutlined style={{ color: SUCCESS, marginRight: 8 }} />Recent Activity ({drm.recentActivity.length})</>} size="small"
            extra={<CsvExport data={drm.recentActivity} columns={[
              { title: 'Donor', dataIndex: 'donorName' },
              { title: 'Amount', dataIndex: 'amount' },
              { title: 'Date', dataIndex: 'date' },
              { title: 'Type', dataIndex: 'type' },
            ]} filename="drm-recent-activity" />}>
            {drm.recentActivity.length === 0 ? (
              <Text type="secondary">No gifts in the last 30 days</Text>
            ) : (
              <Table
                dataSource={drm.recentActivity}
                rowKey={(r, i) => `${r.donorName}-${i}`}
                size="small"
                pagination={{ pageSize: 10, size: 'small' }}
                columns={[
                  { title: 'Donor', dataIndex: 'donorName', key: 'donor', ellipsis: true },
                  { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v: number) => fmtUSD(v), sorter: (a: Activity, b: Activity) => a.amount - b.amount },
                  { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => fmtDate(v) },
                  { title: 'Type', dataIndex: 'type', key: 'type', ellipsis: true },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function DRMPortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch('/jfsd-ui/data/drm-portfolio.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /><br /><Text type="secondary">Loading DRM portfolios…</Text></div>;
  if (error) return <Alert type="error" message="Failed to load data" description={error} showIcon />;
  if (!data) return null;

  const selectedDRM = selectedSlug ? data.drms.find(d => d.slug === selectedSlug) : null;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={3} style={{ color: NAVY, margin: 0 }}>DRM Portfolio Dashboard</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>As of {data.asOfDate}</Text>
        </div>
        <Select
          style={{ width: 220 }}
          placeholder="Select DRM…"
          allowClear
          value={selectedSlug}
          onChange={(v) => setSelectedSlug(v || null)}
          options={[
            ...data.drms.map(d => ({ label: `${d.name} (${d.totalDonors})`, value: d.slug }))
          ]}
        />
      </div>

      {/* Overview KPIs */}
      {!selectedDRM && (
        <>
          <KPIRow items={[
            { title: 'Total Portfolio Donors', value: data.kpis.totalPortfolioDonors.toLocaleString(), icon: <UserOutlined />, color: NAVY },
            { title: 'FY26 Recognition', value: fmtUSD(data.kpis.totalRecognitionFY26), icon: <DollarOutlined />, color: GOLD },
            { title: 'Total LYBUNT', value: data.kpis.totalLYBUNT.toLocaleString(), icon: <WarningOutlined />, color: WARNING },
            { title: 'Avg Portfolio Size', value: data.kpis.avgPortfolioSize, icon: <UserOutlined />, color: NAVY },
          ]} />
          <OverviewGrid drms={data.drms} onSelect={setSelectedSlug} />
        </>
      )}

      {/* Detail view */}
      {selectedDRM && (
        <DRMDetail drm={selectedDRM} onBack={() => setSelectedSlug(null)} />
      )}
    </div>
  );
}
