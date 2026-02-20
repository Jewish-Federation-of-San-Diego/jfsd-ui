import { Card, Col, Row, Statistic, Tag, Typography, Spin, Alert, Space, Badge, Tooltip as AntTooltip } from 'antd';
import { useEffect, useState } from 'react';

import { DefinitionTooltip } from '../components/DefinitionTooltip';

const { Title, Text } = Typography;

// ── Brand tokens ────────────────────────────────────────────────────────
const NAVY = '#1B365D';
const GOLD = '#C5A258';
const SUCCESS = '#3D8B37';
const ERROR = '#C4314B';
const WARNING = '#D4880F';
const MUTED = '#8C8C8C';

// ── Types ───────────────────────────────────────────────────────────────
interface TrendPoint { hour: string; avgTemp: number | null }

interface Thermostat {
  id: string; name: string; temperature: number | null; humidity: number | null;
  hvacMode: string | null; desiredCool: number | null; desiredHeat: number | null;
  isConnected: boolean; isCooling: boolean; isHeating: boolean;
  isServerRoom: boolean; lastReading: string | null;
  trend24h: TrendPoint[];
  coolingHours24h: number; heatingHours24h: number;
}

interface Building { name: string; thermostats: Thermostat[] }

interface FacAlert { thermostat: string; type: string; message: string; timestamp: string }

interface KPIs {
  totalThermostats: number; online: number; offline: number;
  avgTemp: number; alertCount: number; serverRoomTemp: number;
  coolingHours24h: number; heatingHours24h: number;
}

interface FacilitiesData {
  asOfDate: string; buildings: Building[]; alerts: FacAlert[]; kpis: KPIs;
}

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

// ── Helpers ─────────────────────────────────────────────────────────────
function tempColor(t: number | null, isServer = false): string {
  if (t == null) return MUTED;
  if (isServer) {
    if (t >= 78) return ERROR;
    if (t >= 76) return WARNING;
    return SUCCESS;
  }
  if (t > 80) return ERROR;
  if (t > 76) return WARNING;
  if (t >= 68) return SUCCESS;
  return '#3B82F6'; // blue for cool
}

function hvacIcon(mode: string | null, cooling: boolean, heating: boolean): string {
  if (cooling) return '❄️';
  if (heating) return '🔥';
  if (mode === 'cool') return '❄️';
  if (mode === 'heat') return '🔥';
  if (mode === 'auto') return '🔄';
  return '⏸️';
}

// ── Mini Sparkline SVG ──────────────────────────────────────────────────
function Sparkline({ data, width = 80, height = 24 }: { data: TrendPoint[]; width?: number; height?: number }) {
  const temps = data.map(d => d.avgTemp).filter((t): t is number => t != null);
  if (temps.length < 2) return <span style={{ color: MUTED, fontSize: 11 }}>—</span>;

  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const pad = 2;

  const points = temps.map((t, i) => {
    const x = pad + (i / (temps.length - 1)) * (width - 2 * pad);
    const y = pad + (1 - (t - min) / range) * (height - 2 * pad);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={GOLD} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

// ── Thermostat Card ─────────────────────────────────────────────────────
function ThermostatCard({ t }: { t: Thermostat }) {
  const color = tempColor(t.temperature, t.isServerRoom);
  return (
    <Card
      size="small"
      style={{ borderLeft: `3px solid ${color}`, marginBottom: 8 }}
      bodyStyle={{ padding: '8px 12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Badge color={t.isConnected ? SUCCESS : ERROR} />
            <Text strong style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.name}
            </Text>
            {t.isServerRoom && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>SERVER</Tag>}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>
              {t.temperature != null ? `${t.temperature}°` : '—'}
            </span>
            <span style={{ fontSize: 16 }}>{hvacIcon(t.hvacMode, t.isCooling, t.isHeating)}</span>
            {t.humidity != null && (
              <AntTooltip title="Humidity">
                <span style={{ fontSize: 11, color: MUTED }}>💧{t.humidity}%</span>
              </AntTooltip>
            )}
          </div>
        </div>
        <div style={{ marginLeft: 8 }}>
          <Sparkline data={t.trend24h} />
        </div>
      </div>
    </Card>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────
function KPI({ title, value, suffix, color }: { title: React.ReactNode; value: string | number; suffix?: string; color?: string }) {
  return (
    <Card size="small" bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}>
      <Statistic
        title={<span style={{ fontSize: 11, color: MUTED }}>{title}</span>}
        value={value}
        suffix={suffix}
        valueStyle={{ fontSize: 22, fontWeight: 700, color: color || NAVY }}
      />
    </Card>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────
export function FacilitiesDashboard() {
  const [data, setData] = useState<FacilitiesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/jfsd-ui/data/facilities.json')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="Failed to load facilities data" description={error} />;
  if (!data) return null;

  const { kpis, buildings, alerts } = data;
  const serverThermostats = buildings.flatMap(b => b.thermostats).filter(t => t.isServerRoom);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: NAVY }}>🏢 Facilities & HVAC</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          As of {new Date(data.asOfDate).toLocaleString()}{' '}
          <span style={{ color: (Date.now() - new Date(data.asOfDate).getTime()) / 3600000 > 4 ? WARNING : undefined }}>
            ({timeAgo(data.asOfDate)})
          </span>
          {' '}· {kpis.totalThermostats} thermostats
        </Text>
      </div>

      {/* KPI Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={4}><KPI title="Online" value={kpis.online} color={SUCCESS} /></Col>
        <Col xs={12} sm={8} md={4}><KPI title="Offline" value={kpis.offline} color={kpis.offline > 0 ? ERROR : SUCCESS} /></Col>
        <Col xs={12} sm={8} md={4}><KPI title={<DefinitionTooltip term="Current Temp" dashboardKey="facilities">Avg Temp</DefinitionTooltip>} value={kpis.avgTemp} suffix="°F" /></Col>
        <Col xs={12} sm={8} md={4}><KPI title="Alerts" value={kpis.alertCount} color={kpis.alertCount > 0 ? ERROR : SUCCESS} /></Col>
        <Col xs={12} sm={8} md={4}><KPI title={<DefinitionTooltip term="Server Room Thresholds" dashboardKey="facilities">Server Room</DefinitionTooltip>} value={kpis.serverRoomTemp} suffix="°F" color={tempColor(kpis.serverRoomTemp, true)} /></Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>24h Runtime</div>
            <Space size={12}>
              <span style={{ fontSize: 14 }}>❄️ <strong>{kpis.coolingHours24h}h</strong></span>
              <span style={{ fontSize: 14 }}>🔥 <strong>{kpis.heatingHours24h}h</strong></span>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Server Room Spotlight */}
      {serverThermostats.length > 0 && (
        <Card
          title={<span style={{ color: NAVY }}>🖥️ Server Room Spotlight</span>}
          size="small"
          style={{ marginBottom: 20, borderTop: `2px solid ${NAVY}` }}
        >
          <Row gutter={[12, 12]}>
            {serverThermostats.map(t => (
              <Col key={t.id} xs={24} sm={12} md={8}>
                <ThermostatCard t={t} />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <Card
          title={<span style={{ color: ERROR }}>⚠️ Active Alerts ({alerts.length})</span>}
          size="small"
          style={{ marginBottom: 20, borderTop: `2px solid ${ERROR}` }}
        >
          {alerts.map((a, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: i < alerts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              <Tag color={a.type === 'extreme_temp' ? 'red' : a.type === 'server_hot' ? 'orange' : 'gold'}>
                {a.type}
              </Tag>
              <Text strong>{a.thermostat}</Text>
              <Text style={{ marginLeft: 8 }}>{a.message}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                {new Date(a.timestamp).toLocaleString()} ({timeAgo(a.timestamp)})
              </Text>
            </div>
          ))}
        </Card>
      )}

      {/* Building Grid */}
      {buildings.map(building => (
        <Card
          key={building.name}
          title={<span style={{ color: NAVY }}>🏗️ {building.name}</span>}
          extra={<Tag>{building.thermostats.length} units</Tag>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[12, 8]}>
            {building.thermostats.map(t => (
              <Col key={t.id} xs={24} sm={12} md={8} lg={6}>
                <ThermostatCard t={t} />
              </Col>
            ))}
          </Row>
        </Card>
      ))}
    </div>
  );
}
