#!/usr/bin/env python3
"""Generate prospect-research.json from Salesforce (NPC).
Output: public/data/prospect-research.json

Queries wealth/capacity fields on Account + recognition fields to identify
upgrade prospects, major donor pipeline, and giving trajectories.
"""

import json, re, subprocess, sys
from datetime import datetime
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "prospect-research.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")


def sf(soql: str) -> list:
    """Run SOQL via sf-query.js, return list of records."""
    try:
        result = subprocess.run(
            ["node", SF_QUERY, soql],
            capture_output=True, text=True, timeout=120
        )
        stdout = result.stdout
        m = re.search(r'\{["\s]*"totalSize', stdout)
        if not m:
            m = re.search(r'\{["\s]*"records', stdout)
        if not m:
            for i in range(len(stdout) - 1, -1, -1):
                if stdout[i] == '{':
                    try:
                        json.loads(stdout[i:])
                        start = i
                        m = type('M', (), {'start': lambda self, _s=start: _s})()
                        break
                    except Exception:
                        continue
        if not m:
            print(f"SF no JSON: {stdout[:200]}", file=sys.stderr)
            return []
        data = json.loads(stdout[m.start():])
        if isinstance(data, list):
            return data
        return data.get("records", [data])
    except Exception as e:
        print(f"SF error: {e}", file=sys.stderr)
        return []


def n(v):
    """Coerce to float, None→0."""
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def s(v):
    """Coerce to string, None→''."""
    return str(v) if v else ""


def main():
    today = datetime.now().strftime("%Y-%m-%d")

    # ── 1. Accounts with wealth data ────────────────────────────────────
    print("Querying accounts with wealth/capacity data...", file=sys.stderr)
    wealth_accounts = sf(
        "SELECT Id, Name, Wealth_Score__c, P2G_Score__c, Net_Worth__c, "
        "Recognition_Amount_FY26__c, Recognition_Amount_FY25__c, Recognition_Amount_FY24__c, "
        "Recognition_Amount_All_Time__c, "
        "PersonEmail, Phone "
        "FROM Account "
        "WHERE Wealth_Score__c != null OR P2G_Score__c != null OR Net_Worth__c != null "
        "ORDER BY Wealth_Score__c DESC NULLS LAST "
        "LIMIT 2000"
    )
    print(f"  Found {len(wealth_accounts)} accounts with wealth data", file=sys.stderr)

    # ── 2. All accounts with recognition (for trajectory/fallback) ──────
    print("Querying recognition data for trajectory analysis...", file=sys.stderr)
    recog_accounts = sf(
        "SELECT Id, Name, "
        "Recognition_Amount_FY26__c, Recognition_Amount_FY25__c, Recognition_Amount_FY24__c, "
        "Recognition_Amount_All_Time__c, "
        "Wealth_Score__c, P2G_Score__c, Net_Worth__c, "
        "PersonEmail, Phone "
        "FROM Account "
        "WHERE Recognition_Amount_FY26__c > 0 OR Recognition_Amount_FY25__c > 0 OR Recognition_Amount_FY24__c > 0 "
        "ORDER BY Recognition_Amount_FY26__c DESC NULLS LAST "
        "LIMIT 2000"
    )
    print(f"  Found {len(recog_accounts)} accounts with recognition data", file=sys.stderr)

    # ── Parse net worth to numeric ──────────────────────────────────────
    def parse_net_worth(nw_str):
        """Parse Net_Worth__c string like '$1M - $5M' into midpoint estimate."""
        if not nw_str:
            return 0
        nw = str(nw_str).upper().replace(",", "").replace("$", "").strip()
        # Handle ranges like "1M - 5M"
        multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
        parts = re.split(r'\s*[-–]\s*', nw)
        values = []
        for p in parts:
            p = p.strip()
            mult = 1
            for suffix, m in multipliers.items():
                if p.endswith(suffix):
                    mult = m
                    p = p[:-1]
                    break
            try:
                values.append(float(p) * mult)
            except ValueError:
                pass
        if len(values) == 2:
            return (values[0] + values[1]) / 2
        elif len(values) == 1:
            return values[0]
        return 0

    # ── Build unified account map ───────────────────────────────────────
    accounts = {}
    for a in recog_accounts:
        aid = a.get("Id", "")
        accounts[aid] = {
            "name": a.get("Name", "Unknown"),
            "fy26": n(a.get("Recognition_Amount_FY26__c")),
            "fy25": n(a.get("Recognition_Amount_FY25__c")),
            "fy24": n(a.get("Recognition_Amount_FY24__c")),
            "allTime": n(a.get("Recognition_Amount_All_Time__c")),
            "wealthScore": n(a.get("Wealth_Score__c")),
            "p2g": s(a.get("P2G_Score__c")),
            "netWorth": parse_net_worth(a.get("Net_Worth__c")),
            "netWorthRaw": s(a.get("Net_Worth__c")),
            "email": s(a.get("PersonEmail")),
            "phone": s(a.get("Phone")),
        }

    for a in wealth_accounts:
        aid = a.get("Id", "")
        if aid not in accounts:
            accounts[aid] = {
                "name": a.get("Name", "Unknown"),
                "fy26": n(a.get("Recognition_Amount_FY26__c")),
                "fy25": n(a.get("Recognition_Amount_FY25__c")),
                "fy24": n(a.get("Recognition_Amount_FY24__c")),
                "allTime": n(a.get("Recognition_Amount_All_Time__c")),
                "wealthScore": n(a.get("Wealth_Score__c")),
                "p2g": s(a.get("P2G_Score__c")),
                "netWorth": parse_net_worth(a.get("Net_Worth__c")),
                "netWorthRaw": s(a.get("Net_Worth__c")),
                "email": s(a.get("PersonEmail")),
                "phone": s(a.get("Phone")),
            }
        else:
            # Merge wealth data if missing
            acct = accounts[aid]
            if not acct["wealthScore"]:
                acct["wealthScore"] = n(a.get("Wealth_Score__c"))
            if not acct["p2g"]:
                acct["p2g"] = s(a.get("P2G_Score__c"))
            if not acct["netWorth"]:
                acct["netWorth"] = parse_net_worth(a.get("Net_Worth__c"))
                acct["netWorthRaw"] = s(a.get("Net_Worth__c"))

    all_accts = list(accounts.values())
    print(f"  Unified: {len(all_accts)} unique accounts", file=sys.stderr)

    # ── Estimate capacity ───────────────────────────────────────────────
    # Use net worth as primary capacity indicator; fall back to wealth score heuristic
    for a in all_accts:
        if a["netWorth"] > 0:
            # Rough: capacity = 1-3% of net worth
            a["estimatedCapacity"] = round(a["netWorth"] * 0.02)
        elif a["wealthScore"] > 0:
            # Wealth score 0-1000; rough heuristic
            ws = a["wealthScore"]
            if ws >= 900:
                a["estimatedCapacity"] = 100_000
            elif ws >= 700:
                a["estimatedCapacity"] = 50_000
            elif ws >= 500:
                a["estimatedCapacity"] = 25_000
            elif ws >= 300:
                a["estimatedCapacity"] = 10_000
            else:
                a["estimatedCapacity"] = 5_000
        else:
            # No wealth data — use max historical giving as proxy
            a["estimatedCapacity"] = max(a["fy24"], a["fy25"], a["fy26"], a["allTime"] * 0.3)

    # ── Determine trend ─────────────────────────────────────────────────
    for a in all_accts:
        if a["fy26"] > a["fy25"] * 1.1 and a["fy26"] > 0:
            a["trend"] = "up"
        elif a["fy26"] < a["fy25"] * 0.9 and a["fy25"] > 0:
            a["trend"] = "down"
        else:
            a["trend"] = "flat"

    # Count years giving
    for a in all_accts:
        a["yearsGiving"] = sum(1 for yr in [a["fy24"], a["fy25"], a["fy26"]] if yr > 0)

    # ── Profiled count (have wealth data) ───────────────────────────────
    profiled = [a for a in all_accts if a["wealthScore"] > 0 or a["netWorth"] > 0 or a["p2g"]]
    total_profiled = len(profiled)

    # ── Upgrade Prospects: gave $1K-4999 FY26, capacity suggests $5K+ ──
    upgrade_prospects = [
        a for a in all_accts
        if 1000 <= a["fy26"] < 5000 and a["estimatedCapacity"] >= 5000
    ]
    upgrade_prospects.sort(key=lambda a: a["estimatedCapacity"] - a["fy26"], reverse=True)

    upgrade_list = []
    for a in upgrade_prospects[:50]:
        gap = a["estimatedCapacity"] - a["fy26"]
        upgrade_list.append({
            "name": a["name"],
            "currentGiving": round(a["fy26"]),
            "estimatedCapacity": round(a["estimatedCapacity"]),
            "gap": round(gap),
            "yearsGiving": a["yearsGiving"],
            "trend": a["trend"],
        })

    # ── Major Donor Pipeline: capacity $100K+ not yet giving at that level
    major_pipeline = [
        a for a in all_accts
        if a["estimatedCapacity"] >= 100_000 and a["fy26"] < 100_000
    ]
    major_pipeline.sort(key=lambda a: a["estimatedCapacity"], reverse=True)

    major_list = []
    for a in major_pipeline[:50]:
        # Capacity tier
        cap = a["estimatedCapacity"]
        if cap >= 1_000_000:
            tier = "$1M+"
        elif cap >= 500_000:
            tier = "$500K+"
        elif cap >= 250_000:
            tier = "$250K+"
        else:
            tier = "$100K+"

        major_list.append({
            "name": a["name"],
            "capacity": round(cap),
            "capacityTier": tier,
            "currentFY26": round(a["fy26"]),
            "priorFY25": round(a["fy25"]),
            "email": a["email"],
            "phone": a["phone"],
        })

    # ── High-capacity non-donors: capacity $25K+ with $0 FY26 ──────────
    high_cap_non_donors = [
        a for a in all_accts
        if a["estimatedCapacity"] >= 25_000 and a["fy26"] == 0
    ]

    # ── Capacity gap ────────────────────────────────────────────────────
    total_capacity_gap = sum(
        max(a["estimatedCapacity"] - a["fy26"], 0)
        for a in all_accts if a["estimatedCapacity"] > a["fy26"]
    )

    # ── Giving vs Capacity by level ─────────────────────────────────────
    levels = [
        ("$0", 0, 0),
        ("$1-999", 1, 999),
        ("$1K-4,999", 1000, 4999),
        ("$5K-24,999", 5000, 24999),
        ("$25K-99,999", 25000, 99999),
        ("$100K+", 100000, float("inf")),
    ]

    giving_vs_capacity = []
    for label, lo, hi in levels:
        group = [a for a in all_accts if lo <= a["fy26"] <= hi]
        if not group:
            continue
        avg_giving = sum(a["fy26"] for a in group) / len(group)
        avg_cap = sum(a["estimatedCapacity"] for a in group) / len(group)
        giving_vs_capacity.append({
            "level": label,
            "donors": len(group),
            "avgGiving": round(avg_giving),
            "avgCapacity": round(avg_cap),
        })

    # ── Trajectory Analysis: year-over-year ─────────────────────────────
    trajectory_candidates = [
        a for a in all_accts
        if a["fy24"] > 0 or a["fy25"] > 0 or a["fy26"] > 0
    ]

    def trajectory_label(a):
        fy24, fy25, fy26 = a["fy24"], a["fy25"], a["fy26"]
        if fy26 > fy25 and fy25 > fy24:
            return "increasing"
        elif fy26 < fy25 and fy25 < fy24:
            return "decreasing"
        elif fy26 > fy25:
            return "increasing"
        elif fy26 < fy25 and fy25 > 0:
            return "decreasing"
        return "stable"

    trajectory_list = []
    for a in sorted(trajectory_candidates, key=lambda x: x["fy26"], reverse=True)[:100]:
        trajectory_list.append({
            "name": a["name"],
            "fy24": round(a["fy24"]),
            "fy25": round(a["fy25"]),
            "fy26": round(a["fy26"]),
            "trajectory": trajectory_label(a),
        })

    # ── KPIs ────────────────────────────────────────────────────────────
    kpis = {
        "totalProfiled": total_profiled,
        "totalCapacityGap": round(total_capacity_gap),
        "upgradeCount": len(upgrade_prospects),
        "avgUpgradeAmount": round(
            sum(a["estimatedCapacity"] - a["fy26"] for a in upgrade_prospects) / max(len(upgrade_prospects), 1)
        ),
        "highCapacityNonDonors": len(high_cap_non_donors),
    }

    # ── Assemble output ─────────────────────────────────────────────────
    output = {
        "asOfDate": today,
        "totalProfiled": total_profiled,
        "capacityGap": round(total_capacity_gap),
        "upgradeProspects": upgrade_list,
        "majorDonorPipeline": major_list,
        "givingVsCapacity": giving_vs_capacity,
        "trajectoryAnalysis": trajectory_list,
        "kpis": kpis,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2))
    print(f"✅ Wrote {OUTPUT} ({len(json.dumps(output)):,} bytes)", file=sys.stderr)
    print(f"   Profiled: {total_profiled}, Upgrade prospects: {len(upgrade_list)}, "
          f"Major pipeline: {len(major_list)}, Capacity gap: ${total_capacity_gap:,.0f}", file=sys.stderr)


if __name__ == "__main__":
    main()
