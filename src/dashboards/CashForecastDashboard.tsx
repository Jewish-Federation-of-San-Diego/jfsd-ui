import { useState, useEffect } from 'react';
import { Card, Col, Row, Statistic, Table, Typography } from 'antd';
import Plot from 'react-plotly.js';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCurrency, safePercent, safeCount } from '../utils/formatters';
import { NAVY, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

const { Title } = Typography;

interface CashForecastData {
  asOfDate: string;
  kpis: {
    totalReceivable: number;
    cashReceivedYTD: number;
    collectionRate: number;
    avgDaysToPayment: number;
  };
  monthlyInflow: {
    labels: string[];
    fy25Data: number[];
    fy26Data: number[];
  };
  agingReceivables: Array<{
    bucket: string;
    amount: number;
  }>;
  topPledges: Array<{
    donorName: string;
    committedAmount: number;
    balanceDue: number;
    startDate: string;
    daysOutstanding: number;
  }>;
  cashVsRecognition: Array<{
    label: string;
    value: number;
  }>;
  paymentMethodMix: Array<{
    method: string;
    amount: number;
  }>;
}

export default function CashForecastDashboard() {
  const [data, setData] = useState<CashForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<CashForecastData>('/jfsd-ui/data/cash-forecast.json')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error || !data) return <DashboardErrorState message={error ?? 'No data available'} />;

  // Standard Plotly layout config
  const plotlyLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'Inter, system-ui, sans-serif', size: 12 },
    margin: { l: 40, r: 20, t: 40, b: 40 },
    showlegend: true,
    legend: { orientation: 'h', y: -0.15 },
  };

  const plotlyConfig = { displayModeBar: false, responsive: true };

  // Monthly cash inflow chart
  const monthlyInflowChart = {
    data: [
      {
        x: data.monthlyInflow.labels,
        y: data.monthlyInflow.fy25Data,
        type: 'bar' as const,
        name: 'FY25',
        marker: { color: MUTED },
      },
      {
        x: data.monthlyInflow.labels,
        y: data.monthlyInflow.fy26Data,
        type: 'bar' as const,
        name: 'FY26',
        marker: { color: NAVY },
      },
    ],
    layout: {
      ...plotlyLayout,
      title: 'Monthly Cash Inflow Comparison',
      xaxis: { title: 'Month' },
      yaxis: { title: 'Cash Received ($)', tickformat: '$,.0f' },
    },
  };

  // Aging receivables chart with color gradient
  const agingColors = ['#236B4A', '#7cb342', '#d98000', '#ff9800', '#eb6136', '#d32f2f'];
  const agingReceivablesChart = {
    data: [
      {
        y: data.agingReceivables.map(item => item.bucket),
        x: data.agingReceivables.map(item => item.amount),
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: { color: agingColors },
        name: 'Outstanding Amount',
      },
    ],
    layout: {
      ...plotlyLayout,
      title: 'Aging Receivables Analysis',
      xaxis: { title: 'Outstanding Amount ($)', tickformat: '$,.0f' },
      yaxis: { title: 'Age Bucket' },
      showlegend: false,
    },
  };

  // Cash vs Recognition bridge (waterfall chart)
  const bridgeChart = {
    data: [
      {
        x: data.cashVsRecognition.map(item => item.label),
        y: data.cashVsRecognition.map(item => item.value),
        type: 'waterfall' as const,
        connector: { line: { color: MUTED } },
        decreasing: { marker: { color: ERROR } },
        increasing: { marker: { color: SUCCESS } },
        totals: { marker: { color: NAVY } },
      },
    ],
    layout: {
      ...plotlyLayout,
      title: 'Cash vs Recognition Bridge',
      yaxis: { title: 'Amount ($)', tickformat: '$,.0f' },
    },
  };

  // Payment method mix chart
  const paymentMethodChart = {
    data: [
      {
        y: data.paymentMethodMix.map(item => item.method),
        x: data.paymentMethodMix.map(item => item.amount),
        type: 'bar' as const,
        orientation: 'h' as const,
        marker: { color: [NAVY, SUCCESS, WARNING, ERROR] },
        name: 'Amount',
      },
    ],
    layout: {
      ...plotlyLayout,
      title: 'Payment Method Mix',
      xaxis: { title: 'Amount ($)', tickformat: '$,.0f' },
      yaxis: { title: 'Payment Method' },
      showlegend: false,
    },
  };

  // Top pledges table columns
  const pledgeColumns = [
    {
      title: 'Donor Name',
      dataIndex: 'donorName',
      key: 'donorName',
      width: '30%',
    },
    {
      title: 'Committed Amount',
      dataIndex: 'committedAmount',
      key: 'committedAmount',
      render: (value: number) => safeCurrency(value),
      align: 'right' as const,
      width: '20%',
    },
    {
      title: 'Balance Due',
      dataIndex: 'balanceDue',
      key: 'balanceDue',
      render: (value: number) => safeCurrency(value),
      align: 'right' as const,
      width: '20%',
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (value: string) => {
        try {
          return new Date(value).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });
        } catch {
          return value;
        }
      },
      width: '15%',
    },
    {
      title: 'Days Outstanding',
      dataIndex: 'daysOutstanding',
      key: 'daysOutstanding',
      render: (value: number) => safeCount(value),
      align: 'right' as const,
      width: '15%',
    },
  ];

  return (
    <div>
      {/* KPI Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic 
              title="Total Receivable" 
              value={safeCurrency(data.kpis.totalReceivable)}
              valueStyle={{ color: ERROR }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic 
              title="Cash Received YTD" 
              value={safeCurrency(data.kpis.cashReceivedYTD)}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic 
              title="Collection Rate" 
              value={safePercent(data.kpis.collectionRate)}
              valueStyle={{ color: NAVY }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false}>
            <Statistic 
              title="Avg Days to Payment" 
              value={safeCount(data.kpis.avgDaysToPayment)}
              suffix="days"
              valueStyle={{ color: WARNING }}
            />
          </Card>
        </Col>
      </Row>

      {/* Monthly Cash Inflow Chart */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Plot
          data={monthlyInflowChart.data}
          layout={monthlyInflowChart.layout}
          config={plotlyConfig}
          style={{ width: '100%', height: '400px' }}
        />
      </Card>

      {/* Aging Receivables and Payment Method Mix - Side by Side */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card bordered={false}>
            <Plot
              data={agingReceivablesChart.data}
              layout={agingReceivablesChart.layout}
              config={plotlyConfig}
              style={{ width: '100%', height: '350px' }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card bordered={false}>
            <Plot
              data={paymentMethodChart.data}
              layout={paymentMethodChart.layout}
              config={plotlyConfig}
              style={{ width: '100%', height: '350px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Cash vs Recognition Bridge */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Plot
          data={bridgeChart.data}
          layout={bridgeChart.layout}
          config={plotlyConfig}
          style={{ width: '100%', height: '400px' }}
        />
      </Card>

      {/* Top Outstanding Pledges Table */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Title level={5}>Top 15 Outstanding Pledges</Title>
        <Table 
          dataSource={data.topPledges}
          columns={pledgeColumns}
          pagination={false}
          rowKey="donorName"
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Footer */}
      <DataFreshness asOfDate={data.asOfDate} />
    </div>
  );
}