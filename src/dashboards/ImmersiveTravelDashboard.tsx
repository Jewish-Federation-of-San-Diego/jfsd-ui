import { Card, Col, Row, Statistic, Table, Typography, Space, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { fetchJson } from "../utils/dataFetch";
import { safeCurrency, safePercent, safeNumber, safeCount } from "../utils/formatters";
import { NAVY, GOLD, SUCCESS, WARNING, MUTED, OPERATIONS } from "../theme/jfsdTheme";
import { DASHBOARD_CARD_STYLE, PLOTLY_BASE_LAYOUT, PLOTLY_COLORS } from "../utils/dashboardStyles";

const { Title, Text } = Typography;

interface Trip {
  id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  capacity?: number;
  status?: string;
}

interface Registration {
  id?: string;
  trip_id?: string;
  registration_date?: string;
}

interface Payment {
  registration_id?: string;
  amount?: number;
  date?: string;
}

interface TripsResponse {
  trips?: Trip[];
  last_updated?: string;
}

interface RegistrationsResponse {
  registrations?: Registration[];
  last_updated?: string;
}

interface PaymentsResponse {
  payments?: Payment[];
  last_updated?: string;
}

interface TripSummaryRow {
  key: string;
  trip: string;
  registered: number;
  capacity: number;
  fillRate: number;
  revenue: number;
}

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return "—";
  const s = start ? new Date(start).toLocaleDateString() : "—";
  const e = end ? new Date(end).toLocaleDateString() : "—";
  return `${s} - ${e}`;
}

export function ImmersiveTravelDashboard() {
  const [trips, setTrips] = useState<TripsResponse | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationsResponse | null>(null);
  const [payments, setPayments] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchJson<TripsResponse>(`${import.meta.env.BASE_URL}data/travel/trips.json`),
      fetchJson<RegistrationsResponse>(`${import.meta.env.BASE_URL}data/travel/registrations.json`),
      fetchJson<PaymentsResponse>(`${import.meta.env.BASE_URL}data/travel/payments.json`),
    ])
      .then(([tripData, registrationData, paymentData]) => {
        setTrips(tripData);
        setRegistrations(registrationData);
        setPayments(paymentData);
      })
      .catch((err) => setError((err as Error)?.message ?? "Failed to load immersive travel data"))
      .finally(() => setLoading(false));
  }, []);

  const tripRows = useMemo(() => (Array.isArray(trips?.trips) ? trips?.trips : []), [trips]);
  const registrationRows = useMemo(
    () => (Array.isArray(registrations?.registrations) ? registrations?.registrations : []),
    [registrations],
  );
  const paymentRows = useMemo(() => (Array.isArray(payments?.payments) ? payments?.payments : []), [payments]);

  const registrationsByTrip = useMemo(() => {
    const map = new Map<string, number>();
    registrationRows.forEach((registration) => {
      const tripId = registration?.trip_id ?? "";
      if (!tripId) return;
      map.set(tripId, (map.get(tripId) ?? 0) + 1);
    });
    return map;
  }, [registrationRows]);

  const registrationToTrip = useMemo(() => {
    const map = new Map<string, string>();
    registrationRows.forEach((registration) => {
      const id = registration?.id ?? "";
      if (!id) return;
      map.set(id, registration?.trip_id ?? "");
    });
    return map;
  }, [registrationRows]);

  const revenueByTrip = useMemo(() => {
    const map = new Map<string, number>();
    paymentRows.forEach((payment) => {
      const registrationId = payment?.registration_id ?? "";
      const tripId = registrationToTrip.get(registrationId) ?? "";
      if (!tripId) return;
      map.set(tripId, (map.get(tripId) ?? 0) + (payment?.amount ?? 0));
    });
    return map;
  }, [paymentRows, registrationToTrip]);

  const kpis = useMemo(() => {
    const totalTrips = tripRows.length;
    const totalRegistrants = registrationRows.length;
    const totalRevenue = [...revenueByTrip.values()].reduce((sum, value) => sum + value, 0);
    const avgTripRevenue = totalTrips > 0 ? totalRevenue / totalTrips : 0;
    return { totalTrips, totalRegistrants, totalRevenue, avgTripRevenue };
  }, [tripRows, registrationRows, revenueByTrip]);

  const summaryRows = useMemo<TripSummaryRow[]>(
    () =>
      tripRows.map((trip, index) => {
        const key = trip?.id ?? `trip-${index}`;
        const registered = registrationsByTrip.get(key) ?? 0;
        const capacity = trip?.capacity ?? 0;
        const revenue = revenueByTrip.get(key) ?? 0;
        const fillRate = capacity > 0 ? (registered / capacity) * 100 : 0;
        return {
          key,
          trip: trip?.name ?? "Unnamed Trip",
          registered,
          capacity,
          fillRate,
          revenue,
        };
      }),
    [tripRows, registrationsByTrip, revenueByTrip],
  );

  const registrationTimeline = useMemo(() => {
    const map = new Map<string, number>();
    registrationRows.forEach((registration) => {
      const date = registration?.registration_date ?? "";
      if (!date) return;
      map.set(date, (map.get(date) ?? 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [registrationRows]);

  if (loading) return <DashboardSkeleton kpiCount={4} />;
  if (error) return <DashboardErrorState message="Failed to load immersive travel data" description={error} />;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space align="center">
        <Tag color={OPERATIONS}>Operations</Tag>
        <Title level={4} style={{ margin: 0, color: NAVY }}>
          Immersive Travel
        </Title>
      </Space>
      <Text style={{ color: MUTED }}>Trip capacity and revenue tracking across active immersive travel programs.</Text>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic title="Total Trips" value={safeCount(kpis?.totalTrips ?? 0)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Total Registrants"
              value={safeCount(kpis?.totalRegistrants ?? 0)}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Total Revenue"
              value={safeCurrency(kpis?.totalRevenue ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Statistic
              title="Avg Trip Revenue"
              value={safeCurrency(kpis?.avgTripRevenue ?? 0, { maximumFractionDigits: 0 })}
            />
            <Text style={{ color: MUTED }}>Per-trip baseline</Text>
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        {safeCount(kpis?.totalTrips ?? 0)} trips — {safeCount(kpis?.totalRegistrants ?? 0)} registrants, {safeCurrency(kpis?.totalRevenue ?? 0, { maximumFractionDigits: 0 })} revenue
      </Title>
      <Row gutter={[12, 12]}>
        {tripRows.map((trip) => {
          const tripId = trip?.id ?? "";
          const registered = registrationsByTrip.get(tripId) ?? 0;
          const revenue = revenueByTrip.get(tripId) ?? 0;
          const capacity = trip?.capacity ?? 0;
          return (
            <Col xs={24} md={12} lg={8} key={tripId || trip?.name || "trip-row"}>
              <Card
                bordered={false}
                style={DASHBOARD_CARD_STYLE}
                title={trip?.name ?? "Unnamed Trip"}
                extra={<Tag color={trip?.status === "active" ? SUCCESS : trip?.status === "planning" ? WARNING : MUTED}>{trip?.status ?? "unknown"}</Tag>}
              >
                <div style={{ marginBottom: 6 }}>
                  <Text type="secondary">{formatDateRange(trip?.start_date, trip?.end_date)}</Text>
                </div>
                <div>Capacity: {safeCount(capacity)}</div>
                <div>Registered: {safeCount(registered)}</div>
                <div>Revenue: {safeCurrency(revenue, { maximumFractionDigits: 0 })}</div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <Title level={5} style={{ margin: 0, color: NAVY }}>
        Registration timeline — avg trip revenue {safeCurrency(kpis?.avgTripRevenue ?? 0, { maximumFractionDigits: 0 })}
      </Title>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: registrationTimeline.map(([x]) => x),
                  y: registrationTimeline.map(([, y]) => y),
                  line: { color: PLOTLY_COLORS[0], width: 2 },
                },
              ]}
              layout={{
                ...PLOTLY_BASE_LAYOUT,
                height: 300,
                yaxis: { title: "Registrations" },
                xaxis: { title: "Date" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
            <Plot
              data={[
                {
                  type: "bar",
                  x: tripRows.map((trip) => trip?.name ?? "Unnamed"),
                  y: tripRows.map((trip) => revenueByTrip.get(trip?.id ?? "") ?? 0),
                  marker: { color: PLOTLY_COLORS[1] },
                },
              ]}
              layout={{
                ...PLOTLY_BASE_LAYOUT,
                height: 300,
                yaxis: { title: "Revenue ($)" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false }}
            />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={DASHBOARD_CARD_STYLE}>
        <Table<TripSummaryRow>
          size="small"
          rowKey={(row) => row.key}
          dataSource={summaryRows}
          pagination={false}
          columns={[
            { title: "Trip", dataIndex: "trip", key: "trip", ellipsis: true },
            { title: "Registered", dataIndex: "registered", key: "registered", render: (value: number) => safeCount(value ?? 0) },
            { title: "Capacity", dataIndex: "capacity", key: "capacity", render: (value: number) => safeCount(value ?? 0) },
            { title: "Fill Rate", dataIndex: "fillRate", key: "fillRate", render: (value: number) => safePercent(value ?? 0, { decimals: 1 }) },
            { title: "Revenue", dataIndex: "revenue", key: "revenue", render: (value: number) => safeCurrency(value ?? 0) },
            {
              title: "Avg Seat Value",
              key: "seatValue",
              render: (_: unknown, row: TripSummaryRow) =>
                safeNumber(row.capacity > 0 ? row.revenue / row.capacity : 0, { maximumFractionDigits: 0 }),
            },
          ]}
        />
      </Card>

      <DataFreshness asOfDate={trips?.last_updated ?? registrations?.last_updated ?? payments?.last_updated ?? ""} />
    </Space>
  );
}
