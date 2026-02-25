import { Card, Col, Row, Statistic, Tag, Typography, Alert, Space, Badge, Tooltip as AntTooltip, Modal } from 'antd';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { useEffect, useState, useCallback, useId } from 'react';

import { DataFreshness } from '../components/DataFreshness';
import { DefinitionTooltip } from '../components/DefinitionTooltip';
import { NAVY, GOLD, SUCCESS, ERROR, WARNING, MUTED } from '../theme/jfsdTheme';

const { Title, Text } = Typography;

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
  return '#3B82F6';
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

// ── Expanded Trend Chart (Modal) ────────────────────────────────────────
function ExpandedTrendChart({ thermostat }: { thermostat: Thermostat }) {
  const temps = thermostat.trend24h.map(d => d.avgTemp).filter((t): t is number => t != null);
  if (temps.length < 2) return <Text type="secondary">Insufficient trend data</Text>;

  const chartW = 600;
  const chartH = 200;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const desiredCool = thermostat.desiredCool;
  const desiredHeat = thermostat.desiredHeat;

  const allVals = [...temps];
  if (desiredCool != null) allVals.push(desiredCool);
  if (desiredHeat != null) allVals.push(desiredHeat);
  const minT = Math.floor(Math.min(...allVals) - 1);
  const maxT = Math.ceil(Math.max(...allVals) + 1);
  const rangeT = maxT - minT || 1;

  const toX = (i: number) => padL + (i / (temps.length - 1)) * plotW;
  const toY = (t: number) => padT + (1 - (t - minT) / rangeT) * plotH;

  // Build colored segments: green if within setpoints, red otherwise
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 0; i < temps.length - 1; i++) {
    const midTemp = (temps[i] + temps[i + 1]) / 2;
    const inRange =
      (desiredHeat == null || midTemp >= desiredHeat) &&
      (desiredCool == null || midTemp <= desiredCool);
    segments.push({
      x1: toX(i), y1: toY(temps[i]),
      x2: toX(i + 1), y2: toY(temps[i + 1]),
      color: inRange ? SUCCESS : ERROR,
    });
  }

  // Time labels: every 4 hours
  const timeLabels = ['12am', '4am', '8am', '12pm', '4pm', '8pm'];

  // Y-axis labels: ~5 ticks
  const yTicks: number[] = [];
  const yStep = Math.max(1, Math.round(rangeT / 5));
  for (let v = minT; v <= maxT; v += yStep) yTicks.push(v);

  const avg = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10;
  const min2 = Math.min(...temps);
  const max2 = Math.max(...temps);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block' }}>
        {/* Grid + Y labels */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={padL} y1={toY(v)} x2={chartW - padR} y2={toY(v)} stroke="#e8e8e8" strokeWidth={1} />
            <text x={padL - 4} y={toY(v) + 4} textAnchor="end" fontSize={10} fill={MUTED}>{v}°</text>
          </g>
        ))}

        {/* X labels */}
        {timeLabels.map((label, i) => {
          const x = padL + (i / (timeLabels.length - 1)) * plotW;
          return <text key={label} x={x} y={chartH - 4} textAnchor="middle" fontSize={10} fill={MUTED}>{label}</text>;
        })}

        {/* Setpoint lines */}
        {desiredCool != null && (
          <line
            x1={padL} y1={toY(desiredCool)} x2={chartW - padR} y2={toY(desiredCool)}
            stroke="#3B82F6" strokeWidth={1} strokeDasharray="6,3"
          />
        )}
        {desiredHeat != null && (
          <line
            x1={padL} y1={toY(desiredHeat)} x2={chartW - padR} y2={toY(desiredHeat)}
            stroke={ERROR} strokeWidth={1} strokeDasharray="6,3"
          />
        )}

        {/* Colored line segments */}
        {segments.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11, color: MUTED }}>
        {desiredCool != null && <span><span style={{ color: '#3B82F6' }}>- -</span> Cool setpoint ({desiredCool}°)</span>}
        {desiredHeat != null && <span><span style={{ color: ERROR }}>- -</span> Heat setpoint ({desiredHeat}°)</span>}
        <span><span style={{ color: SUCCESS }}>━</span> In range</span>
        <span><span style={{ color: ERROR }}>━</span> Out of range</span>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginTop: 12, textAlign: 'center' }}>
        <Col span={8}>
          <Statistic title={<span style={{ fontSize: 11 }}>Min</span>} value={min2} suffix="°F" valueStyle={{ fontSize: 18, color: '#3B82F6' }} />
        </Col>
        <Col span={8}>
          <Statistic title={<span style={{ fontSize: 11 }}>Avg</span>} value={avg} suffix="°F" valueStyle={{ fontSize: 18, color: NAVY }} />
        </Col>
        <Col span={8}>
          <Statistic title={<span style={{ fontSize: 11 }}>Max</span>} value={max2} suffix="°F" valueStyle={{ fontSize: 18, color: ERROR }} />
        </Col>
      </Row>
    </div>
  );
}

// ── Server Room Temperature Gauge ───────────────────────────────────────
function TempGauge({ temp }: { temp: number | null }) {
  const clipId = useId();
  if (temp == null) return <span style={{ color: MUTED }}>—</span>;

  const minG = 60;
  const maxG = 85;
  const range = maxG - minG;
  const pct = Math.max(0, Math.min(1, (temp - minG) / range));
  const barH = 80;
  const fillH = pct * barH;

  let color = SUCCESS;
  if (temp >= 78) color = ERROR;
  else if (temp >= 74) color = WARNING;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <svg width={20} height={barH + 4} style={{ display: 'block' }}>
        {/* Background */}
        <rect x={4} y={2} width={12} height={barH} rx={3} fill="#f0f0f0" stroke="#d9d9d9" strokeWidth={1} />
        {/* Zones (bottom to top): green, yellow, red */}
        <clipPath id={clipId}>
          <rect x={4} y={2} width={12} height={barH} rx={3} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {/* Green zone: 60-74 → bottom portion */}
          <rect x={4} y={2 + barH * (1 - (74 - minG) / range)} width={12} height={barH * ((74 - minG) / range)} fill={`${SUCCESS}30`} />
          {/* Yellow zone: 74-78 */}
          <rect x={4} y={2 + barH * (1 - (78 - minG) / range)} width={12} height={barH * (4 / range)} fill={`${WARNING}30`} />
          {/* Red zone: 78+ */}
          <rect x={4} y={2} width={12} height={barH * (1 - (78 - minG) / range)} fill={`${ERROR}30`} />
        </g>
        {/* Fill indicator */}
        <rect x={6} y={2 + barH - fillH} width={8} height={fillH} rx={2} fill={color} />
      </svg>
      <div style={{ fontSize: 11, color: MUTED, lineHeight: '14px' }}>
        <div style={{ color }}>{temp}°F</div>
        <div>{temp < 74 ? '✓ OK' : temp < 78 ? '⚠ Warm' : '🔴 Hot'}</div>
      </div>
    </div>
  );
}

// ── Building Summary ────────────────────────────────────────────────────
function BuildingSummary({ building, alerts }: { building: Building; alerts: FacAlert[] }) {
  const temps = building.thermostats.map(t => t.temperature).filter((t): t is number => t != null);
  const avg = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10 : null;
  const cooling = building.thermostats.filter(t => t.isCooling).length;
  const heating = building.thermostats.filter(t => t.isHeating).length;
  const idle = building.thermostats.length - cooling - heating;
  const buildingAlerts = alerts.filter(a =>
    building.thermostats.some(t => t.name === a.thermostat)
  );

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', padding: '4px 0 8px', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>
      <span style={{ fontSize: 13 }}>
        Avg: <strong style={{ color: NAVY }}>{avg != null ? `${avg}°F` : '—'}</strong>
      </span>
      <Space size={8}>
        {cooling > 0 && <Tag color="blue">❄️ {cooling} cooling</Tag>}
        {heating > 0 && <Tag color="red">🔥 {heating} heating</Tag>}
        {idle > 0 && <Tag>⏸️ {idle} idle</Tag>}
      </Space>
      {buildingAlerts.length > 0 && (
        <Tag color="red">⚠️ {buildingAlerts.length} alert{buildingAlerts.length > 1 ? 's' : ''}</Tag>
      )}
    </div>
  );
}

// ── Thermostat Card ─────────────────────────────────────────────────────
function ThermostatCard({ t, onClick }: { t: Thermostat; onClick: () => void }) {
  const color = tempColor(t.temperature, t.isServerRoom);
  return (
    <Card
      size="small"
      style={{ borderLeft: `3px solid ${color}`, marginBottom: 8, cursor: 'pointer' }}
      bodyStyle={{ padding: '8px 12px' }}
      onClick={onClick}
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
  const [selectedThermostat, setSelectedThermostat] = useState<Thermostat | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch('/jfsd-ui/data/facilities.json')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetch('/jfsd-ui/data/facilities.json')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
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
          {kpis.totalThermostats} thermostats
        </Text>
        <DataFreshness asOfDate={data.asOfDate} onRefresh={refresh} refreshing={refreshing} />
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

      {/* Server Room Spotlight (Enhanced) */}
      {serverThermostats.length > 0 && (
        <Card
          title={<span style={{ color: NAVY, fontSize: 16 }}>🖥️ Server Room Spotlight</span>}
          size="small"
          style={{ marginBottom: 20, borderTop: `3px solid ${NAVY}` }}
        >
          <Row gutter={[16, 16]}>
            {serverThermostats.map(t => (
              <Col key={t.id} xs={24} sm={12} md={8}>
                <Card
                  size="small"
                  style={{
                    borderLeft: `4px solid ${tempColor(t.temperature, true)}`,
                    cursor: 'pointer',
                    background: t.temperature != null && t.temperature >= 78 ? '#fff1f0' : undefined,
                  }}
                  bodyStyle={{ padding: '12px 16px' }}
                  onClick={() => setSelectedThermostat(t)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Badge color={t.isConnected ? SUCCESS : ERROR} />
                        <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                        <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>SERVER</Tag>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 28, fontWeight: 700, color: tempColor(t.temperature, true), lineHeight: 1 }}>
                          {t.temperature != null ? `${t.temperature}°` : '—'}
                        </span>
                        <span style={{ fontSize: 16 }}>{hvacIcon(t.hvacMode, t.isCooling, t.isHeating)}</span>
                      </div>
                      <Sparkline data={t.trend24h} width={100} height={28} />
                    </div>
                    <TempGauge temp={t.temperature} />
                  </div>
                  {t.lastReading && (
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>
                      Last reading: {timeAgo(t.lastReading)}
                    </div>
                  )}
                </Card>
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

      {/* Building Grid (with summaries) */}
      {buildings.map(building => (
        <Card
          key={building.name}
          title={<span style={{ color: NAVY }}>🏗️ {building.name}</span>}
          extra={<Tag>{building.thermostats.length} units</Tag>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <BuildingSummary building={building} alerts={alerts} />
          <Row gutter={[12, 8]}>
            {building.thermostats.map(t => (
              <Col key={t.id} xs={24} sm={12} md={8} lg={6}>
                <ThermostatCard t={t} onClick={() => setSelectedThermostat(t)} />
              </Col>
            ))}
          </Row>
        </Card>
      ))}

      {/* Expanded Trend Modal */}
      <Modal
        open={selectedThermostat != null}
        onCancel={() => setSelectedThermostat(null)}
        footer={null}
        title={selectedThermostat ? `📈 ${selectedThermostat.name} — 24h Trend` : ''}
        width={680}
        destroyOnClose
      >
        {selectedThermostat && <ExpandedTrendChart thermostat={selectedThermostat} />}
      </Modal>
    </div>
  );
}
