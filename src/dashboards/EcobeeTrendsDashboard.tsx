import { Card, Col, Row, Statistic, Table, Space, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { DataFreshness } from '../components/DataFreshness';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { NAVY, GOLD, SUCCESS, ERROR, MUTED } from '../theme/jfsdTheme';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { DashboardErrorState } from '../components/DashboardErrorState';
import { fetchJson } from '../utils/dataFetch';
import { safeCount, safeNumber } from '../utils/formatters';

interface DailyRow {
  date: string; avgTemp: number; minTemp: number; maxTemp: number;
  zonesActive: number; totalHeatingMin: number; totalCoolingMin: number;
}
interface Zone {
  name: string; group: string; avgTemp7d: number; readings7d: number;
  lastReading: string; avgHumidity7d: number;
}
interface EcobeeData {
  asOfDate: string;
  dateRange: { start: string; end: string };
  buildingDaily: DailyRow[];
  zones: Zone[];
  serverRoom?: Zone[];
}

export function EcobeeTrendsDashboard() {
  const [data, setData] = useState<EcobeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const json = await fetchJson<EcobeeData>(`${import.meta.env.BASE_URL}data/ecobee-trends.json`);
        setData(json);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardErrorState message="Failed to load Ecobee trends data" description={error} />;
  if (!data) return <DashboardErrorState message="Missing Ecobee trends data" />;

  const buildingDaily = data.buildingDaily ?? [];
  const zones = data.zones ?? [];
  const serverRoom = data.serverRoom ?? [];
  const avgTempValue = buildingDaily.length > 0 ? (buildingDaily.reduce((s, d) => s + (d?.avgTemp ?? 0), 0) / buildingDaily.length) : 0;
  const avgTemp = safeNumber(avgTempValue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const totalHeating = buildingDaily.reduce((s, d) => s + (d?.totalHeatingMin ?? 0), 0);
  const totalCooling = buildingDaily.reduce((s, d) => s + (d?.totalCoolingMin ?? 0), 0);

  const tempColor = (v: number) => v > 80 ? ERROR : v > 75 ? GOLD : v < 60 ? '#5B8DB8' : SUCCESS;

  const dailyCols = [
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
    { title: 'Avg °F', dataIndex: 'avgTemp', key: 'avg', render: (v: number) => <span style={{ color: tempColor(v), fontWeight: 600 }}>{safeNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> },
    { title: 'Min °F', dataIndex: 'minTemp', key: 'min', render: (v: number) => safeNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
    { title: 'Max °F', dataIndex: 'maxTemp', key: 'max', render: (v: number) => <span style={{ color: tempColor(v) }}>{safeNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> },
    { title: 'Zones', dataIndex: 'zonesActive', key: 'zones' },
    { title: 'Heat (min)', dataIndex: 'totalHeatingMin', key: 'heat' },
    { title: 'Cool (min)', dataIndex: 'totalCoolingMin', key: 'cool' },
  ];

  const zoneCols = [
    { title: 'Zone', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Group', dataIndex: 'group', key: 'group', render: (v: string) => <Tag>{v}</Tag> },
    { title: '7d Avg °F', dataIndex: 'avgTemp7d', key: 'avg', sorter: (a: Zone, b: Zone) => a.avgTemp7d - b.avgTemp7d,
      render: (v: number) => <span style={{ color: tempColor(v), fontWeight: 500 }}>{safeNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span> },
    { title: 'Humidity %', dataIndex: 'avgHumidity7d', key: 'hum', render: (v: number) => safeNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '—' },
    { title: 'Readings', dataIndex: 'readings7d', key: 'readings' },
  ];

  // Simple inline "sparkline" for daily temps
  const tempRange = { min: Math.min(...buildingDaily.map(d => d.minTemp), 0), max: Math.max(...buildingDaily.map(d => d.maxTemp), 1) };
  const barH = 60;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DataFreshness asOfDate={data.asOfDate ?? ''} />
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Zone" dashboardKey="ecobee-trends">Total Zones</DefinitionTooltip>} value={safeCount(zones.length)} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Days of Data" value={safeCount(buildingDaily.length)} valueStyle={{ color: NAVY }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Avg Temp" value={`${avgTemp}°F`} valueStyle={{ color: SUCCESS }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={<DefinitionTooltip term="Heating Hours" dashboardKey="ecobee-trends">HVAC Hours</DefinitionTooltip>} value={`${safeNumber((totalHeating + totalCooling) / 60, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}h`} valueStyle={{ color: GOLD }} /></Card></Col>
      </Row>

      <Card title={buildingDaily.length > 0 
        ? `${buildingDaily.length}-day trend — Current avg ${avgTemp}°F, ${zones.filter(z => z.avgTemp7d > 78).length} zones warm`
        : "28-Day Temperature Trend"
      }>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: barH + 20, overflow: 'auto' }}>
          {buildingDaily.map(d => {
            const h = ((d.avgTemp - tempRange.min) / ((tempRange.max - tempRange.min) || 1)) * barH + 10;
            return (
              <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
                <span style={{ fontSize: 9, color: MUTED }}>{safeNumber(d.avgTemp, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <div style={{ width: 16, height: h, background: tempColor(d.avgTemp), borderRadius: 2 }} />
                <span style={{ fontSize: 8, color: MUTED }}>{new Date(d.date).getDate()}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={buildingDaily.length > 0 
        ? `${buildingDaily.length} days of readings — Range ${safeNumber(Math.min(...buildingDaily.map(d => d.minTemp)), { maximumFractionDigits: 1 })}°F to ${safeNumber(Math.max(...buildingDaily.map(d => d.maxTemp)), { maximumFractionDigits: 1 })}°F`
        : "Daily Averages"
      }>
        <Table dataSource={buildingDaily} columns={dailyCols} rowKey="date"
          size="small" pagination={false} scroll={{ x: 600 }} />
      </Card>

      {serverRoom.length > 0 && (
        <Card title={
          <DefinitionTooltip term="Server Room" dashboardKey="ecobee-trends">
            {`${serverRoom.length} server zones — Avg ${safeNumber(serverRoom.reduce((sum, z) => sum + z.avgTemp7d, 0) / serverRoom.length, { maximumFractionDigits: 1 })}°F, ${serverRoom.filter(z => z.avgTemp7d > 75).length > 0 ? `${serverRoom.filter(z => z.avgTemp7d > 75).length} alert` : 'all normal'}`}
          </DefinitionTooltip>
        }>
          <Table dataSource={serverRoom} columns={zoneCols} rowKey="name"
            size="small" pagination={false} />
        </Card>
      )}

      <Card title={`All Zones (${safeCount(zones.length)})`}>
        <Table dataSource={zones} columns={zoneCols} rowKey="name"
          size="small" pagination={{ pageSize: 15 }} scroll={{ x: 600 }} />
      </Card>
    </Space>
  );
}
