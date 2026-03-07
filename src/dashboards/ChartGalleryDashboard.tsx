import { Card, Col, Row, Tag, Space, Modal, Button, Typography } from 'antd';
import { useState } from 'react';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
// Chart gallery - no theme imports needed

const CHARTS = [
  { file: '01-line-campaign-progress.html', name: 'Campaign Progress', cat: 'Basic' },
  { file: '02-bar-department-spending.html', name: 'Department Spending', cat: 'Basic' },
  { file: '03-scatter-donor-capacity.html', name: 'Donor Capacity', cat: 'Basic' },
  { file: '04-area-cumulative.html', name: 'Cumulative Area', cat: 'Basic' },
  // { file: '05-pie-spend-breakdown.html', name: 'Spend Breakdown', cat: 'Basic' },
  // ↑ REMOVED: Pie charts violate viz standards. Use horizontal bar instead.
  { file: '06-funnel-donor-pipeline.html', name: 'Donor Pipeline', cat: 'Financial' },
  { file: '07-timeline-events.html', name: 'Timeline Events', cat: 'Financial' },
  { file: '08-sunburst-giving.html', name: 'Giving Sunburst', cat: 'Financial' },
  { file: '09-treemap-spending.html', name: 'Spending Treemap', cat: 'Financial' },
  { file: '10-icicle-designations.html', name: 'Designations Icicle', cat: 'Financial' },
  { file: '11-funnel-area-email.html', name: 'Email Funnel', cat: 'Financial' },
  { file: '12-histogram-gifts.html', name: 'Gift Histogram', cat: 'Statistical' },
  { file: '13-box-temperature.html', name: 'Temperature Box', cat: 'Statistical' },
  { file: '14-violin-societies.html', name: 'Societies Violin', cat: 'Statistical' },
  { file: '15-strip-gifts.html', name: 'Gift Strip', cat: 'Statistical' },
  { file: '16-ecdf-donors.html', name: 'Donor ECDF', cat: 'Statistical' },
  { file: '17-density-heatmap-email.html', name: 'Email Heatmap', cat: 'Statistical' },
  { file: '18-density-contour-gifts.html', name: 'Gift Density', cat: 'Statistical' },
  { file: '19-imshow-building.html', name: 'Building Heatmap', cat: '3D' },
  // { file: '20-scatter3d-rfm.html', name: 'RFM 3D Scatter', cat: '3D' },
  // ↑ REMOVED: 3D charts distort perception and violate viz standards.
  // { file: '21-line3d-trends.html', name: '3D Trends', cat: '3D' },
  // ↑ REMOVED: 3D charts distort perception and violate viz standards.
  { file: '22-scatter-matrix.html', name: 'Scatter Matrix', cat: 'Multi-dimensional' },
  { file: '23-parallel-coords.html', name: 'Parallel Coordinates', cat: 'Multi-dimensional' },
  { file: '24-parallel-categories.html', name: 'Parallel Categories', cat: 'Multi-dimensional' },
  { file: '25-choropleth-zip.html', name: 'ZIP Choropleth', cat: 'Maps' },
  { file: '26-scatter-geo-donors.html', name: 'Donor Geo Scatter', cat: 'Maps' },
  { file: '27-line-geo.html', name: 'Geo Lines', cat: 'Maps' },
  { file: '28-density-map.html', name: 'Density Map', cat: 'Maps' },
  // { file: '29-scatter-polar.html', name: 'Polar Scatter', cat: 'Specialized' },
  // ↑ REMOVED: Polar charts are difficult to read and violate viz standards.
  // { file: '30-bar-polar-seasonal.html', name: 'Seasonal Polar', cat: 'Specialized' },
  // ↑ REMOVED: Polar charts are difficult to read and violate viz standards.
  { file: '31-ternary-budget.html', name: 'Budget Ternary', cat: 'Specialized' },
  { file: '32-waterfall-variance.html', name: 'Variance Waterfall', cat: 'Dashboard' },
  // { file: '33-gauge-campaign.html', name: 'Campaign Gauge', cat: 'Dashboard' },
  // ↑ REMOVED: Gauges violate viz standards. Use big number + progress bar instead.
  { file: '34-sankey-funds.html', name: 'Funds Sankey', cat: 'Dashboard' },
  { file: '35-table-board.html', name: 'Board Table', cat: 'Dashboard' },
];

const CATEGORIES = ['All', 'Basic', 'Financial', 'Statistical', '3D', 'Multi-dimensional', 'Maps', 'Specialized', 'Dashboard'];
const CAT_COLORS: Record<string, string> = {
  Basic: 'blue', Financial: 'gold', Statistical: 'green', '3D': 'purple',
  'Multi-dimensional': 'cyan', Maps: 'geekblue', Specialized: 'magenta', Dashboard: 'orange',
};

export function ChartGalleryDashboard() {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<typeof CHARTS[0] | null>(null);

  const filtered = filter === 'All' ? CHARTS : CHARTS.filter(c => c.cat === filter);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Text type="secondary">
        Built with <DefinitionTooltip term="Plotly" dashboardKey="chart-gallery">Plotly.js</DefinitionTooltip> — {CHARTS.length} interactive charts using real JFSD data.
      </Typography.Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map(cat => (
          <Button key={cat} type={filter === cat ? 'primary' : 'default'} size="small"
            onClick={() => setFilter(cat)}>{cat}</Button>
        ))}
      </div>

      <Row gutter={[12, 12]}>
        {filtered.map(chart => (
          <Col xs={24} sm={12} md={8} key={chart.file}>
            <Card hoverable size="small" onClick={() => setSelected(chart)}
              style={{ cursor: 'pointer' }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{chart.name}</div>
              <Tag color={CAT_COLORS[chart.cat]}>{chart.cat}</Tag>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal open={!!selected} onCancel={() => setSelected(null)} footer={null}
        title={selected?.name} width="90%" style={{ top: 20 }}
        styles={{ body: { padding: 0, height: '70vh' } }}>
        {selected && (
          <iframe src={`${import.meta.env.BASE_URL}charts/${selected.file}`} style={{ width: '100%', height: '100%', border: 'none' }} />
        )}
      </Modal>
    </Space>
  );
}
