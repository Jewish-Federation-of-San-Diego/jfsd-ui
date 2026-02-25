import { Card, Col, Row, Skeleton } from 'antd';

interface DashboardSkeletonProps {
  kpiCount?: number;
  hasChart?: boolean;
  hasTable?: boolean;
}

export function DashboardSkeleton({ kpiCount = 4, hasChart = true, hasTable = true }: DashboardSkeletonProps) {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <Skeleton title={{ width: 200 }} paragraph={false} active style={{ marginBottom: 16 }} />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <Col xs={12} sm={12} md={6} key={i}>
            <Card size="small" style={{ borderTop: '3px solid #E8E8ED' }}>
              <Skeleton title={{ width: '60%' }} paragraph={{ rows: 1, width: '40%' }} active />
            </Card>
          </Col>
        ))}
      </Row>
      {hasChart && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Skeleton title={{ width: 150 }} paragraph={false} active />
          <div style={{ height: 200, background: '#F5F5F7', borderRadius: 6, marginTop: 12 }} />
        </Card>
      )}
      {hasTable && (
        <Card size="small">
          <Skeleton title={{ width: 150 }} paragraph={false} active />
          <Skeleton paragraph={{ rows: 8 }} active style={{ marginTop: 12 }} />
        </Card>
      )}
    </div>
  );
}
