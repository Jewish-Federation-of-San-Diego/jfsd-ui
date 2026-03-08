#!/usr/bin/env python3
"""Generate silence-alerts.json — LYBUNT donors at risk of lapsing."""

import json, subprocess, sys
from datetime import datetime, date
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "silence-alerts.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")


def sf(soql: str) -> list:
    result = subprocess.run(["node", SF_QUERY, soql], capture_output=True, text=True, timeout=120)
    stdout = result.stdout
    # Find first { that starts valid JSON (skip dotenvx noise)
    import re
    brace = -1
    for i, ch in enumerate(stdout):
        if ch == '{':
            try:
                json.loads(stdout[i:])
                brace = i
                break
            except:
                continue
    if brace == -1:
        print(f"No JSON in output:\n{stdout[:500]}", file=sys.stderr)
        sys.exit(1)
    text = stdout[brace:]
    depth = 0
    end = 0
    for i, ch in enumerate(text):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        if depth == 0:
            end = i + 1
            break
    data = json.loads(text[:end])
    return data.get("records", [])


def main():
    soql = "SELECT Id, Name, PersonEmail, PersonMobilePhone, Recognition_Amount_FY25__c, Recognition_Amount_FY26__c, Recognition_Amount_All_Time__c, Last_Gift_Date__c, First_Gift_Date__c FROM Account WHERE IsPersonAccount = true AND Recognition_Amount_FY25__c > 0 AND (Recognition_Amount_FY26__c = null OR Recognition_Amount_FY26__c = 0) AND Deceased__pc = false ORDER BY Recognition_Amount_FY25__c DESC LIMIT 500"

    records = sf(soql)
    today = date.today()
    donors = []

    for r in records:
        fy25 = float(r.get("Recognition_Amount_FY25__c") or 0)
        lifetime = float(r.get("Recognition_Amount_All_Time__c") or 0)
        last_gift_str = r.get("Last_Gift_Date__c")
        first_gift_str = r.get("First_Gift_Date__c")

        years = 0
        if first_gift_str:
            try:
                first_dt = datetime.strptime(first_gift_str[:10], "%Y-%m-%d").date()
                years = max(1, (today - first_dt).days // 365)
            except Exception:
                pass

        avg_annual = lifetime / years if years > 0 else fy25

        days_since = 365
        if last_gift_str:
            try:
                last_dt = datetime.strptime(last_gift_str[:10], "%Y-%m-%d").date()
                days_since = (today - last_dt).days
            except Exception:
                pass

        if fy25 >= 5000:
            tier = "Critical"
        elif fy25 >= 1000:
            tier = "High"
        elif fy25 >= 500:
            tier = "Medium"
        elif fy25 >= 100:
            tier = "Watch"
        else:
            continue

        score = 0
        score += min(30, fy25 / 500)
        score += min(25, years * 1.5)
        score += min(25, days_since / 15)
        score += min(20, lifetime / 5000)
        score = min(100, round(score))

        factors = []
        if years >= 5:
            factors.append(f"{years} year relationship at risk")
        if avg_annual >= 500:
            factors.append(f"${avg_annual:,.0f}/yr avg at risk")
        if lifetime >= 10000:
            factors.append(f"${lifetime:,.0f} lifetime donor")
        if days_since > 365:
            factors.append(f"{days_since} days since last gift")
        if fy25 >= 5000:
            factors.append("Major donor — immediate outreach needed")

        donors.append({
            "name": r.get("Name", ""),
            "phone": r.get("PersonMobilePhone") or "",
            "email": r.get("PersonEmail") or "",
            "fy25Amount": fy25,
            "lifetimeGiving": lifetime,
            "avgAnnual": round(avg_annual, 2),
            "lastGiftDate": last_gift_str or "",
            "riskScore": score,
            "riskTier": tier,
            "riskFactors": factors,
            "daysSinceGift": days_since,
        })

    donors.sort(key=lambda d: d["riskScore"], reverse=True)

    tier_map = {
        "Critical": {"tier": "Critical", "count": 0, "revenueAtRisk": 0, "color": "#C4314B"},
        "High": {"tier": "High", "count": 0, "revenueAtRisk": 0, "color": "#D4880F"},
        "Medium": {"tier": "Medium", "count": 0, "revenueAtRisk": 0, "color": "#C5A258"},
        "Watch": {"tier": "Watch", "count": 0, "revenueAtRisk": 0, "color": "#3D8B37"},
    }
    for d in donors:
        t = tier_map[d["riskTier"]]
        t["count"] += 1
        t["revenueAtRisk"] += d["fy25Amount"]

    total_risk = sum(d["fy25Amount"] for d in donors)
    crit = tier_map["Critical"]
    avg_days = round(sum(d["daysSinceGift"] for d in donors) / len(donors)) if donors else 0

    output = {
        "asOfDate": datetime.now().isoformat(),
        "count": len(donors),
        "revenueAtRisk": round(total_risk, 2),
        "byTier": [tier_map["Critical"], tier_map["High"], tier_map["Medium"], tier_map["Watch"]],
        "donors": donors,
        "kpis": {
            "totalAtRisk": len(donors),
            "revenueAtRisk": round(total_risk, 2),
            "criticalCount": crit["count"],
            "criticalRevenue": round(crit["revenueAtRisk"], 2),
            "avgDaysSinceGift": avg_days,
        }
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Generated {len(donors)} silence alerts → {OUTPUT}")
    print(f"   Revenue at risk: ${total_risk:,.2f}")
    for t in tier_map.values():
        print(f"   {t['tier']}: {t['count']} donors, ${t['revenueAtRisk']:,.2f}")


if __name__ == "__main__":
    main()
