import { Typography, Button, Tooltip } from 'antd';
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { MUTED, WARNING } from '../theme/jfsdTheme';

const { Text } = Typography;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface DataFreshnessProps {
  asOfDate: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function DataFreshness({ asOfDate, onRefresh, refreshing }: DataFreshnessProps) {
  if (!asOfDate) return null;
  const hoursOld = (Date.now() - new Date(asOfDate).getTime()) / 3600000;
  const isStale = hoursOld > 12;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }} className="no-print">
      <ClockCircleOutlined style={{ color: isStale ? WARNING : MUTED, fontSize: 12 }} />
      <Text type="secondary" style={{ fontSize: 12, color: isStale ? WARNING : MUTED }}>
        Updated {timeAgo(asOfDate)}
        {' · '}
        {new Date(asOfDate).toLocaleString()}
      </Text>
      {onRefresh && (
        <Tooltip title="Refresh data">
          <Button 
            type="text" 
            size="small" 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={onRefresh}
            style={{ color: MUTED }}
          />
        </Tooltip>
      )}
      <Text type="secondary" style={{ fontSize: 11, color: MUTED }}>
        Daily refresh at 6:00 AM PT
      </Text>
    </div>
  );
}
