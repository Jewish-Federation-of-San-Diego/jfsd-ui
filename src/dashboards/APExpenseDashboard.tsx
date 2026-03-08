import { Card, Col, Row, Statistic, Table, Tag, Typography, Space, Progress, Alert } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { CsvExport } from '../components/CsvExport';
import { useEffect, useState, useCallback } from 'react';
import Plot from 'react-plotly.js';

const { Text } = Typography;
import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from "../components/DefinitionTooltip";
import { NAVY, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency, safePercent } from '../utils/formatters';

// ── Brand tokens ────────────────────────────────────────────────────────
// ── Types ───────────────────────────────────────────────────────────────
interface ActionItem {
  type: 'missing_receipt' | 'needs_review' | 'policy_exception';
  merchant: string;
  amount: number;
  cardholder: string;
  date: string;
  txnId?: string;
  reason?: string;
}

interface DeptSpend {
  dept: string;
  amount: number;
  txnCount: number;
}

interface MerchantSpend {
  merchant: string;
  amount: number;
  txnCount: number;
}

interface BudgetRow {
  department: string;
  budgetYTD: number;
  actualYTD: number;
  pctUsed: number;
  projectedOverUnder: number;
}

interface DormantCard {
  cardholder: string;
  lastActivity: string;
  limit: number;
}

interface HighUtilCard {
  cardholder: string;
  spent: number;
  limit: number;
  pctUsed: number;
}

interface AgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

interface APExpenseData {
  asOfDate: string;
  actionItems: ActionItem[];
  expenseSummary: {
    totalSpend7d: number;
    totalSpend30d: number;
    byDepartment: DeptSpend[];
    topMerchants: MerchantSpend[];
    receiptComplianceRate: number;
  };
  budgetPace: BudgetRow[];
  cardManagement: {
    activeCards: number;
    dormantCards: DormantCard[];
    highUtilization: HighUtilCard[];
  };
  glHealth: {
    manualEntries7d: number;
    unclearedItems30d: number;
    apAgingBuckets: AgingBucket[];
  };
  kpis: {
    totalSpendThisWeek: number;
    missingReceipts: number;
    receiptComplianceRate: number;
    apOutstanding: number;
    overBudgetDepts: number;
    dormantCards: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────
const fmtUSD = (v: number) => safeCurrency(v, { maximumFractionDigits: 0 });
const fmtK = (v: number) => safeCurrency(v, { notation: 'compact', maximumFractionDigits: 1 });

const typeTag = (type: string): { color: string; label: string } => {
  switch (type) {
    case 'missing_receipt': return { color: ERROR, label: 'Missing Receipt' };
    case 'needs_review': return { color: WARNING, label: 'Needs Review' };
    case 'policy_exception': return { color: '#722ED1', label: 'Policy Exception' };
    default: return { color: MUTED, label: type };
  }
};

const paceColor = (pct: number) => pct > 100 ? ERROR : pct > 80 ? WARNING : SUCCESS;



// ── KPI Cards ───────────────────────────────────────────────────────────
function KPICards({ kpis }: { kpis: APExpenseData['kpis'] }) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} lg={4}>
        <Card className="kpi-card" size="small">
          <Statistic title="WEEKLY SPEND" value={kpis.totalSpendThisWeek} precision={0} prefix="$" valueStyle={{ color: NAVY }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Last 7 days</Text>
        </Card>
      </Col>
      <Col xs={12} lg={4}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Missing Receipt" dashboardKey="ap-expense">MISSING RECEIPTS</DefinitionTooltip>} value={kpis.missingReceipts} valueStyle={{ color: kpis.missingReceipts > 5 ? ERROR : WARNING }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Action required</Text>
        </Card>
      </Col>
      <Col xs={12} lg={4}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Receipt Compliance" dashboardKey="ap-expense">RECEIPT COMPLIANCE</DefinitionTooltip>} value={kpis.receiptComplianceRate} precision={1} suffix="%" valueStyle={{ color: kpis.receiptComplianceRate >= 90 ? SUCCESS : kpis.receiptComplianceRate >= 75 ? WARNING : ERROR }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Target: 95%</Text>
        </Card>
      </Col>
      <Col xs={12} lg={4}>
        <Card className="kpi-card" size="small">
          <Statistic title="AP OUTSTANDING" value={kpis.apOutstanding} precision={0} prefix="$" valueStyle={{ color: NAVY }} />
          <Text type="secondary" style={{ fontSize: 11 }}>All aging buckets</Text>
        </Card>
      </Col>
      <Col xs={12} lg={4}>
        <Card className="kpi-card" size="small">
          <Statistic title="OVER BUDGET" value={kpis.overBudgetDepts} valueStyle={{ color: kpis.overBudgetDepts > 0 ? ERROR : SUCCESS }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Departments &gt;100%</Text>
        </Card>
      </Col>
      <Col xs={12} lg={4}>
        <Card className="kpi-card" size="small">
          <Statistic title={<DefinitionTooltip term="Dormant Cards" dashboardKey="ap-expense">DORMANT CARDS</DefinitionTooltip>} value={kpis.dormantCards} valueStyle={{ color: kpis.dormantCards > 3 ? WARNING : MUTED }} />
          <Text type="secondary" style={{ fontSize: 11 }}>No activity 30d</Text>
        </Card>
      </Col>
    </Row>
  );
}

// ── Action Items Table ──────────────────────────────────────────────────
function ActionItemsTable({ items }: { items: ActionItem[] }) {
  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (t: string) => {
        const { color, label } = typeTag(t);
        return <Tag color={color} style={{ fontWeight: 600 }}>{label}</Tag>;
      },
      filters: [
        { text: 'Missing Receipt', value: 'missing_receipt' },
        { text: 'Needs Review', value: 'needs_review' },
        { text: 'Policy Exception', value: 'policy_exception' },
      ],
      onFilter: (value: React.Key | boolean, record: ActionItem) => record.type === value,
    },
    {
      title: 'Merchant',
      dataIndex: 'merchant',
      key: 'merchant',
      ellipsis: true,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      sorter: (a: ActionItem, b: ActionItem) => a.amount - b.amount,
      defaultSortOrder: 'descend' as const,
      render: (v: number) => <Text strong>{safeCurrency(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>,
    },
    {
      title: 'Cardholder',
      dataIndex: 'cardholder',
      key: 'cardholder',
      ellipsis: true,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      sorter: (a: ActionItem, b: ActionItem) => a.date.localeCompare(b.date),
    },
    {
      title: 'Detail',
      key: 'detail',
      ellipsis: true,
      render: (_: unknown, r: ActionItem) => r.reason || r.txnId?.slice(0, 8) || '—',
    },
  ];

  const actionCount = items.length;
  const totalActionAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const title = actionCount > 0 
    ? `${actionCount} action items need attention — ${fmtK(totalActionAmount)} total value`
    : `All caught up — no action items this week`;

  return (
    <Card title={title} size="small"
      extra={<CsvExport data={items} columns={[
        { title: 'Type', dataIndex: 'type' },
        { title: 'Merchant', dataIndex: 'merchant' },
        { title: 'Amount', dataIndex: 'amount' },
        { title: 'Cardholder', dataIndex: 'cardholder' },
        { title: 'Date', dataIndex: 'date' },
      ]} filename="ap-action-items" />}>
      <Table
        dataSource={items}
        columns={columns}
        rowKey={(r) => `${r.type}-${r.merchant}-${r.date}-${r.amount}`}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 700 }}
      />
    </Card>
  );
}

// ── Department Spend Bar Chart (Plotly) ─────────────────────────────────
function DeptSpendChart({ data }: { data: DeptSpend[] }) {
  const topDept = data[0];
  const totalSpend = data.reduce((sum, dept) => sum + dept.amount, 0);
  const title = topDept 
    ? `Top spender: ${topDept.dept} at ${fmtK(topDept.amount)} — ${safePercent(topDept.amount / totalSpend)} of ${fmtK(totalSpend)} total`
    : "Department spending (30d)";
  
  if (!data.length) {
    return (
      <Card title={title} size="small">
        <div style={{ textAlign: 'center', padding: '20px', color: MUTED }}>
          No department spending data available
        </div>
      </Card>
    );
  }

  const plotData = [{
    type: 'bar' as const,
    orientation: 'h' as const,
    x: data.map(d => isNaN(d.amount) ? 0 : d.amount),
    y: data.map(d => d.dept),
    marker: {
      color: NAVY,
      opacity: 0.85,
    },
    text: data.map(d => fmtK(isNaN(d.amount) ? 0 : d.amount)),
    textposition: 'outside' as const,
    textfont: { size: 11, color: MUTED },
    hovertemplate: '<b>%{y}</b><br>Amount: %{text}<extra></extra>',
  }];

  const layout = {
    margin: { l: 120, r: 60, t: 20, b: 40 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    showlegend: false,
    xaxis: {
      showgrid: false,
      showline: false,
      showticklabels: false,
      zeroline: false,
    },
    yaxis: {
      showgrid: false,
      showline: false,
      tickfont: { size: 12, color: NAVY },
      categoryorder: 'total ascending' as const,
    },
    height: Math.max(data.length * 50 + 80, 200),
  };
  
  return (
    <Card title={title} size="small">
      <Plot
        data={plotData}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
      />
    </Card>
  );
}

// ── Top Merchants ───────────────────────────────────────────────────────
function TopMerchants({ data }: { data: MerchantSpend[] }) {
  const columns = [
    { title: 'Merchant', dataIndex: 'merchant', key: 'merchant', ellipsis: true },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      render: (v: number) => fmtUSD(v),
      sorter: (a: MerchantSpend, b: MerchantSpend) => a.amount - b.amount,
      defaultSortOrder: 'descend' as const,
    },
    { title: 'Txns', dataIndex: 'txnCount', key: 'txnCount', width: 60 },
  ];
  return (
    <Card title="Top Merchants (30d)" size="small"
      extra={<CsvExport data={data} columns={[
        { title: 'Merchant', dataIndex: 'merchant' },
        { title: 'Amount', dataIndex: 'amount' },
        { title: 'Txns', dataIndex: 'txnCount' },
      ]} filename="ap-top-merchants" />}>
      <Table dataSource={data} columns={columns} rowKey="merchant" size="small" pagination={false} />
    </Card>
  );
}

// ── Budget Pace ─────────────────────────────────────────────────────────
function BudgetPace({ data }: { data: BudgetRow[] }) {
  return (
    <Card title="Budget Pace — FY26 YTD" size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {data.map((d) => (
          <div key={d.department}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text strong style={{ fontSize: 13 }}>{d.department}</Text>
              <Text style={{ fontSize: 12, color: paceColor(d.pctUsed) }}>
                {safePercent(d.pctUsed, { decimals: 0 })} — {fmtK(d.actualYTD)} / {fmtK(d.budgetYTD)}
              </Text>
            </div>
            <Progress
              percent={Math.min(d.pctUsed, 120)}
              showInfo={false}
              strokeColor={paceColor(d.pctUsed)}
              trailColor={GRID}
              size="small"
            />
            {d.projectedOverUnder > 0 && (
              <Text style={{ fontSize: 11, color: ERROR }}>
                Projected over by {fmtK(d.projectedOverUnder)}
              </Text>
            )}
          </div>
        ))}
      </Space>
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: SUCCESS, marginRight: 4 }} />&lt;80%
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: WARNING, margin: '0 4px 0 12px' }} />80–100%
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: ERROR, margin: '0 4px 0 12px' }} />&gt;100%
        </Text>
      </div>
    </Card>
  );
}

// ── Card Management ─────────────────────────────────────────────────────
function CardManagement({ data }: { data: APExpenseData['cardManagement'] }) {
  const dormantCols = [
    { title: 'Cardholder', dataIndex: 'cardholder', key: 'cardholder' },
    { title: 'Last Activity', dataIndex: 'lastActivity', key: 'lastActivity', width: 130 },
    { title: 'Limit', dataIndex: 'limit', key: 'limit', width: 100, render: (v: number) => v ? fmtUSD(v) : '—' },
  ];
  const highUtilCols = [
    { title: 'Cardholder', dataIndex: 'cardholder', key: 'cardholder' },
    { title: 'Spent', dataIndex: 'spent', key: 'spent', width: 100, render: (v: number) => fmtUSD(v) },
    { title: 'Limit', dataIndex: 'limit', key: 'limit', width: 100, render: (v: number) => fmtUSD(v) },
    {
      title: '% Used',
      dataIndex: 'pctUsed',
      key: 'pctUsed',
      width: 90,
      render: (v: number) => <Tag color={v > 90 ? ERROR : WARNING}>{safePercent(v, { decimals: 0 })}</Tag>,
    },
  ];

  return (
    <Card title={`Card Management — ${data.activeCards} Active Cards`} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {data.dormantCards.length > 0 && (
          <>
            <Text strong style={{ color: WARNING }}>Dormant Cards (no activity 30d)</Text>
            <Table dataSource={data.dormantCards} columns={dormantCols} rowKey="cardholder" size="small" pagination={false} />
          </>
        )}
        {data.dormantCards.length === 0 && (
          <Text type="secondary">No dormant cards detected</Text>
        )}
        {data.highUtilization.length > 0 && (
          <>
            <Text strong style={{ color: ERROR }}>High Utilization (&gt;80%)</Text>
            <Table dataSource={data.highUtilization} columns={highUtilCols} rowKey="cardholder" size="small" pagination={false} />
          </>
        )}
        {data.highUtilization.length === 0 && (
          <Text type="secondary">No high-utilization cards detected</Text>
        )}
      </Space>
    </Card>
  );
}

// ── GL Health ───────────────────────────────────────────────────────────
function GLHealth({ data }: { data: APExpenseData['glHealth'] }) {
  const agingCols = [
    { title: 'Aging Bucket', dataIndex: 'bucket', key: 'bucket', render: (v: string) => `${v} days` },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (v: number) => fmtUSD(v) },
    { title: 'Count', dataIndex: 'count', key: 'count', width: 80 },
  ];
  const totalAP = data.apAgingBuckets.reduce((s, b) => s + b.amount, 0);

  const healthScore = data.manualEntries7d <= 10 && data.unclearedItems30d <= 20 ? "Good" : "Needs attention";
  const title = `GL Health: ${healthScore} — ${data.manualEntries7d} manual entries, ${data.unclearedItems30d} uncleared items`;
  
  return (
    <Card title={title} size="small">
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Row gutter={16}>
          <Col span={12}>
            <Statistic title="Manual Entries (7d)" value={data.manualEntries7d} valueStyle={{ color: data.manualEntries7d > 10 ? WARNING : NAVY, fontSize: 20 }} />
          </Col>
          <Col span={12}>
            <Statistic title="Uncleared Items (30d)" value={data.unclearedItems30d} valueStyle={{ color: data.unclearedItems30d > 20 ? WARNING : NAVY, fontSize: 20 }} />
          </Col>
        </Row>
        <div>
          <Text strong>AP Aging — {fmtUSD(totalAP)} Total</Text>
          <Table dataSource={data.apAgingBuckets} columns={agingCols} rowKey="bucket" size="small" pagination={false} style={{ marginTop: 8 }} />
        </div>
      </Space>
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export default function APExpenseDashboard() {
  const [data, setData] = useState<APExpenseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJson<APExpenseData>(`${import.meta.env.BASE_URL}data/james-ap-expense.json`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchJson<APExpenseData>(`${import.meta.env.BASE_URL}data/james-ap-expense.json`)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setRefreshing(false));
  }, []);

  if (error) return <Alert type="error" message="Failed to load AP & Expense data" description={error} showIcon style={{ margin: 24 }} />;
  if (!data) return <DashboardSkeleton />;

  const kpis = data.kpis ?? { totalSpendThisWeek: 0, missingReceipts: 0, receiptComplianceRate: 0, apOutstanding: 0, overBudgetDepts: 0, dormantCards: 0 };
  const actionItems = data.actionItems ?? [];
  const expenseSummary = data.expenseSummary ?? { totalSpend7d: 0, totalSpend30d: 0, byDepartment: [], topMerchants: [], receiptComplianceRate: 0 };
  const budgetPace = data.budgetPace ?? [];
  const glHealth = data.glHealth ?? { manualEntries7d: 0, unclearedItems30d: 0, apAgingBuckets: [] };
  const cardManagement = data.cardManagement ?? { activeCards: 0, dormantCards: [], highUtilization: [] };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text strong style={{ fontSize: 20, color: NAVY }}>AP &amp; Expense Dashboard</Text>
      </div>
      <DataFreshness asOfDate={data.asOfDate ?? ''} onRefresh={refresh} refreshing={refreshing} />

      <KPICards kpis={kpis} />

      <ActionItemsTable items={actionItems} />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <DeptSpendChart data={expenseSummary.byDepartment} />
        </Col>
        <Col xs={24} lg={10}>
          <TopMerchants data={expenseSummary.topMerchants} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <BudgetPace data={budgetPace} />
        </Col>
        <Col xs={24} lg={12}>
          <GLHealth data={glHealth} />
        </Col>
      </Row>

      <CardManagement data={cardManagement} />

      <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
        Data: Ramp API (transactions, cards) · Sage Intacct GL (budget, AP aging) · FY26 Jul 2025–Jun 2026
      </Text>
    </Space>
  );
}
