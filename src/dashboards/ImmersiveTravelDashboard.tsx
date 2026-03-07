import { Card, Col, Row, Statistic, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import { DashboardErrorState } from "../components/DashboardErrorState";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { DataFreshness } from "../components/DataFreshness";
import { NAVY, GOLD, SUCCESS } from "../theme/jfsdTheme";
import { fetchJson } from "../utils/dataFetch";
import { safeCount, safeCurrency } from "../utils/formatters";

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
    <div style={{ padding: 4 }}>
      <Title level={3} style={{ color: NAVY, marginTop: 0 }}>
        Immersive Travel
      </Title>
      <DataFreshness
        asOfDate={trips?.last_updated ?? registrations?.last_updated ?? payments?.last_updated ?? ""}
      />

      <Row gutter={[12, 12]} style={{ marginTop: 8, marginBottom: 12 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="Total Trips" value={safeCount(kpis?.totalTrips ?? 0)} valueStyle={{ color: NAVY }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Total Registrants"
              value={safeCount(kpis?.totalRegistrants ?? 0)}
              valueStyle={{ color: SUCCESS }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Total Revenue"
              value={safeCurrency(kpis?.totalRevenue ?? 0, { maximumFractionDigits: 0 })}
              valueStyle={{ color: GOLD }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Avg Trip Revenue"
              value={safeCurrency(kpis?.avgTripRevenue ?? 0, { maximumFractionDigits: 0 })}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {tripRows.map((trip) => {
          const tripId = trip?.id ?? "";
          const registered = registrationsByTrip.get(tripId) ?? 0;
          const revenue = revenueByTrip.get(tripId) ?? 0;
          const capacity = trip?.capacity ?? 0;
          return (
            <Col xs={24} md={12} lg={8} key={tripId || trip?.name || "trip-row"}>
              <Card
                size="small"
                title={trip?.name ?? "Unnamed Trip"}
                extra={<Tag color={trip?.status === "active" ? "green" : trip?.status === "planning" ? "gold" : "default"}>{trip?.status ?? "unknown"}</Tag>}
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

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Registration Timeline">
            <Plot
              data={[
                {
                  type: "scatter",
                  mode: "lines+markers",
                  x: registrationTimeline.map(([x]) => x),
                  y: registrationTimeline.map(([, y]) => y),
                  line: { color: "#1c88ed", width: 2 },
                },
              ]}
              layout={{
                autosize: true,
                height: 300,
                margin: { l: 45, r: 10, t: 10, b: 45 },
                yaxis: { title: "Registrations" },
                xaxis: { title: "Date" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Revenue by Trip">
            <Plot
              data={[
                {
                  type: "bar",
                  x: tripRows.map((trip) => trip?.name ?? "Unnamed"),
                  y: tripRows.map((trip) => revenueByTrip.get(trip?.id ?? "") ?? 0),
                  marker: { color: "#236B4A" },
                },
              ]}
              layout={{
                autosize: true,
                height: 300,
                margin: { l: 55, r: 10, t: 10, b: 65 },
                yaxis: { title: "Revenue ($)" },
              }}
              style={{ width: "100%" }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
