#!/usr/bin/env python3
"""Generate facilities.json from Ecobee SQLite DB for JFSD-UI dashboard."""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
WORKSPACE = PROJECT_DIR.parent.parent.parent  # clawd/
DB_PATH = WORKSPACE / "projects" / "ecobee-dashboard" / "data" / "ecobee.db"
OUT_PATH = PROJECT_DIR / "public" / "data" / "facilities.json"

SERVER_ROOM_MAX = 76
OFFLINE_THRESHOLD_MIN = 30


def main():
    if not DB_PATH.exists():
        print(f"DB not found: {DB_PATH}")
        return

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    now = datetime.now()
    cutoff_24h = (now - timedelta(hours=24)).isoformat()
    offline_cutoff = (now - timedelta(minutes=OFFLINE_THRESHOLD_MIN)).isoformat()

    # Latest reading: use max timestamp batch
    max_ts = conn.execute("SELECT MAX(timestamp) FROM readings").fetchone()[0]
    rows = conn.execute("""
        SELECT thermostat_id, name, group_name, temperature, humidity,
               hvac_mode, desired_cool, desired_heat, is_connected,
               cooling_running, heating_running, timestamp
        FROM readings WHERE timestamp = ?
    """, (max_ts,)).fetchall()

    # Deduplicate: keep named version over "Thermostat XXXX"
    thermostat_map = {}
    for r in rows:
        tid = r["thermostat_id"]
        name = r["name"] or ""
        existing = thermostat_map.get(tid)
        if not existing or (not name.startswith("Thermostat ") and (existing["name"] or "").startswith("Thermostat ")):
            thermostat_map[tid] = dict(r)

    # 24h trends - use a single query, limit to hourly samples
    print("  Querying 24h trends...")
    trends_raw = conn.execute("""
        SELECT thermostat_id,
               strftime('%Y-%m-%dT%H:00', timestamp) as hour,
               AVG(temperature) as avg_temp
        FROM readings
        WHERE timestamp > ?
        GROUP BY thermostat_id, strftime('%H', timestamp)
        ORDER BY thermostat_id, hour
    """, (cutoff_24h,)).fetchall()

    trends = {}
    for row in trends_raw:
        tid = row["thermostat_id"]
        if tid not in trends:
            trends[tid] = []
        trends[tid].append({"hour": row["hour"], "avgTemp": round(row["avg_temp"], 1) if row["avg_temp"] else None})

    # Alerts
    alerts_raw = conn.execute("""
        SELECT thermostat_id, name, alert_type, message, timestamp
        FROM alerts WHERE acknowledged = 0 ORDER BY timestamp DESC LIMIT 50
    """).fetchall()
    alerts = [{"thermostat": r["name"] or r["thermostat_id"],
               "type": r["alert_type"], "message": r["message"],
               "timestamp": r["timestamp"]} for r in alerts_raw]

    # Energy: cooling/heating reading counts in 24h
    print("  Querying energy usage...")
    energy_raw = conn.execute("""
        SELECT thermostat_id,
               SUM(CASE WHEN cooling_running = 1 THEN 1 ELSE 0 END) as cool_ct,
               SUM(CASE WHEN heating_running = 1 THEN 1 ELSE 0 END) as heat_ct,
               COUNT(*) as total
        FROM readings WHERE timestamp > ?
        GROUP BY thermostat_id
    """, (cutoff_24h,)).fetchall()

    energy_map = {}
    for row in energy_raw:
        total = row["total"] or 1
        readings_per_hr = total / 24.0
        rph = max(readings_per_hr, 1)
        energy_map[row["thermostat_id"]] = {
            "cooling": round((row["cool_ct"] or 0) / rph, 1),
            "heating": round((row["heat_ct"] or 0) / rph, 1),
        }

    # Build output
    buildings_map = {}
    total_temp = 0; temp_count = 0; online = 0; offline = 0
    server_temps = []; total_cooling = 0; total_heating = 0

    for tid, r in thermostat_map.items():
        group = r["group_name"] or "Unknown"
        name = r["name"] or tid
        temp = r["temperature"]
        is_connected = bool(r["is_connected"])

        if r["timestamp"] and r["timestamp"] < offline_cutoff:
            is_connected = False

        if is_connected: online += 1
        else: offline += 1

        if temp:
            total_temp += temp
            temp_count += 1

        is_server = "Server" in name or "Data" in name
        if is_server and temp:
            server_temps.append(temp)

        e = energy_map.get(tid, {"cooling": 0, "heating": 0})
        total_cooling += e["cooling"]
        total_heating += e["heating"]

        obj = {
            "id": tid, "name": name,
            "temperature": round(temp, 1) if temp else None,
            "humidity": r["humidity"],
            "hvacMode": r["hvac_mode"],
            "desiredCool": r["desired_cool"],
            "desiredHeat": r["desired_heat"],
            "isConnected": is_connected,
            "isCooling": bool(r["cooling_running"]),
            "isHeating": bool(r["heating_running"]),
            "isServerRoom": is_server,
            "lastReading": r["timestamp"],
            "trend24h": trends.get(tid, []),
            "coolingHours24h": e["cooling"],
            "heatingHours24h": e["heating"],
        }

        buildings_map.setdefault(group, []).append(obj)

    buildings = [{"name": k, "thermostats": sorted(v, key=lambda t: t["name"])}
                 for k, v in sorted(buildings_map.items())]

    result = {
        "asOfDate": max_ts or now.isoformat(),
        "buildings": buildings,
        "alerts": alerts,
        "kpis": {
            "totalThermostats": len(thermostat_map),
            "online": online, "offline": offline,
            "avgTemp": round(total_temp / temp_count, 1) if temp_count else 0,
            "alertCount": len(alerts),
            "serverRoomTemp": round(max(server_temps) if server_temps else 0, 1),
            "coolingHours24h": round(total_cooling, 1),
            "heatingHours24h": round(total_heating, 1),
        }
    }

    conn.close()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, indent=2)

    print(f"✅ Wrote {OUT_PATH} ({len(thermostat_map)} thermostats, {len(buildings)} buildings)")


if __name__ == "__main__":
    main()
