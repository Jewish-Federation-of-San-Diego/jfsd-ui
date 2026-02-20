#!/usr/bin/env python3
"""
Generate weekly-ask-list.json for the Weekly Ask List dashboard.
Queries Salesforce for LYBUNT, upgrade candidates, and lapsed donors.
Output: public/data/weekly-ask-list.json
"""

import json, os, subprocess, sys, datetime, re, math
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "weekly-ask-list.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")

ASK_LEVELS = [100, 250, 500, 1000, 2500, 5000, 10000, 18000, 25000, 50000, 100000]

def sf(soql: str) -> list:
    """Run SOQL via sf-query.js, return list of records."""
    try:
        result = subprocess.run(
            ["node", SF_QUERY, soql], capture_output=True, text=True, timeout=120
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
                        m = type('M', (), {'start': lambda s: i})()
                        break
                    except:
                        continue
        if not m:
            print(f"SF no JSON: {stdout[:300]}", file=sys.stderr)
            return []
        data = json.loads(stdout[m.start():])
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("records", data.get("data", []))
        return []
    except Exception as e:
        print(f"SF error: {e}", file=sys.stderr)
        return []


def val(rec, key):
    parts = key.split(".")
    obj = rec
    for p in parts:
        if obj is None or not isinstance(obj, dict):
            return None
        obj = obj.get(p)
    return obj


def num(v):
    if v is None:
        return 0
    try:
        return float(v)
    except:
        return 0


def round_up_ask(amount):
    """Round up to next natural ask level."""
    if amount <= 0:
        return ASK_LEVELS[0]
    for level in ASK_LEVELS:
        if level >= amount:
            return level
    return ASK_LEVELS[-1]


def score_donor(rec, category):
    """Score a donor for prioritization. Higher = more important."""
    s = 0
    fy24 = num(val(rec, "Recognition_Amount_FY24__c"))
    fy25 = num(val(rec, "Recognition_Amount_FY25__c"))
    fy26 = num(val(rec, "Recognition_Amount_FY26__c"))
    lifetime = num(val(rec, "Recognition_Amount_All_Time__c"))
    first_gift = val(rec, "First_Gift_Date__c")
    last_gift = val(rec, "Last_Gift_Date__c")

    # Amount weight (log scale)
    top_amount = max(fy24, fy25, fy26)
    if top_amount > 0:
        s += min(math.log10(top_amount) * 15, 60)

    # Years of giving
    if first_gift:
        try:
            first_dt = datetime.datetime.strptime(first_gift[:10], "%Y-%m-%d")
            years = (datetime.datetime.now() - first_dt).days / 365.25
            s += min(years * 1.5, 30)
        except:
            pass

    # Recency bonus
    if last_gift:
        try:
            last_dt = datetime.datetime.strptime(last_gift[:10], "%Y-%m-%d")
            days_ago = (datetime.datetime.now() - last_dt).days
            if days_ago < 365:
                s += 20
            elif days_ago < 730:
                s += 10
        except:
            pass

    # Category bonus
    if category == "LYBUNT":
        s += 15  # highest priority
    elif category == "Upgrade":
        s += 10
    elif category == "Lapsed":
        s += 5

    return round(s, 1)


def calc_years_giving(rec):
    first = val(rec, "First_Gift_Date__c")
    if not first:
        return 0
    try:
        first_dt = datetime.datetime.strptime(first[:10], "%Y-%m-%d")
        return max(1, round((datetime.datetime.now() - first_dt).days / 365.25))
    except:
        return 0


def calc_avg_annual(rec):
    lifetime = num(val(rec, "Recognition_Amount_All_Time__c"))
    years = calc_years_giving(rec)
    if years > 0:
        return round(lifetime / years, 2)
    return 0


def build_donor(rec, rank, category, ask_reason):
    fy24 = num(val(rec, "Recognition_Amount_FY24__c"))
    fy25 = num(val(rec, "Recognition_Amount_FY25__c"))
    fy26 = num(val(rec, "Recognition_Amount_FY26__c"))
    avg = calc_avg_annual(rec)
    base_ask = max(fy25, avg) if category != "Lapsed" else max(fy24, avg)
    suggested = round_up_ask(base_ask)

    return {
        "rank": rank,
        "name": val(rec, "Name") or "",
        "phone": val(rec, "Phone") or val(rec, "PersonMobilePhone") or "",
        "email": val(rec, "PersonEmail") or "",
        "score": score_donor(rec, category),
        "suggestedAsk": suggested,
        "askReason": ask_reason,
        "category": category,
        "lifetimeGiving": round(num(val(rec, "Recognition_Amount_All_Time__c")), 2),
        "yearsGiving": calc_years_giving(rec),
        "lastGiftDate": val(rec, "Last_Gift_Date__c") or "",
        "fy24": round(fy24, 2),
        "fy25": round(fy25, 2),
        "fy26": round(fy26, 2),
        "avgAnnual": round(avg, 2),
    }


def fmt_k(v):
    if v >= 1000:
        return f"${v/1000:.0f}K" if v % 1000 == 0 else f"${v/1000:.1f}K"
    return f"${v:,.0f}"


def main():
    print("Querying LYBUNT donors (gave FY25, not FY26)...")
    lybunt_recs = sf(
        "SELECT Id, Name, Phone, PersonMobilePhone, PersonEmail, "
        "Recognition_Amount_FY24__c, Recognition_Amount_FY25__c, Recognition_Amount_FY26__c, "
        "Recognition_Amount_All_Time__c, First_Gift_Date__c, Last_Gift_Date__c "
        "FROM Account "
        "WHERE IsPersonAccount = true "
        "AND Recognition_Amount_FY25__c > 0 "
        "AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null) "
        "ORDER BY Recognition_Amount_FY25__c DESC "
        "LIMIT 100"
    )
    print(f"  Found {len(lybunt_recs)} LYBUNT donors")

    print("Querying Upgrade candidates (gave FY26 but below average)...")
    upgrade_recs = sf(
        "SELECT Id, Name, Phone, PersonMobilePhone, PersonEmail, "
        "Recognition_Amount_FY24__c, Recognition_Amount_FY25__c, Recognition_Amount_FY26__c, "
        "Recognition_Amount_All_Time__c, First_Gift_Date__c, Last_Gift_Date__c "
        "FROM Account "
        "WHERE IsPersonAccount = true "
        "AND Recognition_Amount_FY26__c > 0 "
        "AND Recognition_Amount_All_Time__c > 0 "
        "AND First_Gift_Date__c < 2023-07-01 "
        "ORDER BY Recognition_Amount_All_Time__c DESC "
        "LIMIT 200"
    )
    # Filter to those giving below their average
    upgrade_filtered = []
    for r in upgrade_recs:
        fy26 = num(val(r, "Recognition_Amount_FY26__c"))
        avg = calc_avg_annual(r)
        if avg > 0 and fy26 < avg * 0.9:  # giving less than 90% of average
            upgrade_filtered.append(r)
    print(f"  Found {len(upgrade_filtered)} upgrade candidates (from {len(upgrade_recs)} queried)")

    print("Querying Lapsed donors (gave FY24, not FY25 or FY26)...")
    lapsed_recs = sf(
        "SELECT Id, Name, Phone, PersonMobilePhone, PersonEmail, "
        "Recognition_Amount_FY24__c, Recognition_Amount_FY25__c, Recognition_Amount_FY26__c, "
        "Recognition_Amount_All_Time__c, First_Gift_Date__c, Last_Gift_Date__c "
        "FROM Account "
        "WHERE IsPersonAccount = true "
        "AND Recognition_Amount_FY24__c > 0 "
        "AND (Recognition_Amount_FY25__c = 0 OR Recognition_Amount_FY25__c = null) "
        "AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null) "
        "ORDER BY Recognition_Amount_FY24__c DESC "
        "LIMIT 100"
    )
    print(f"  Found {len(lapsed_recs)} lapsed donors")

    # Build donor list with categories
    all_donors = []

    for r in lybunt_recs:
        fy25 = num(val(r, "Recognition_Amount_FY25__c"))
        reason = f"LYBUNT - gave {fmt_k(fy25)} FY25"
        all_donors.append(build_donor(r, 0, "LYBUNT", reason))

    for r in upgrade_filtered:
        fy26 = num(val(r, "Recognition_Amount_FY26__c"))
        avg = calc_avg_annual(r)
        reason = f"Upgrade - avg {fmt_k(avg)}, gave {fmt_k(fy26)} FY26"
        all_donors.append(build_donor(r, 0, "Upgrade", reason))

    for r in lapsed_recs:
        fy24 = num(val(r, "Recognition_Amount_FY24__c"))
        reason = f"Lapsed - gave {fmt_k(fy24)} FY24"
        all_donors.append(build_donor(r, 0, "Lapsed", reason))

    # Filter out deceased donors (Z"L / Z'L honorific)
    all_donors = [d for d in all_donors if not re.search(r"""Z["'\u201c\u201d\u2018\u2019]L""", d["name"], re.IGNORECASE)]

    # Deduplicate by name
    seen = set()
    unique = []
    for d in all_donors:
        if d["name"] not in seen:
            seen.add(d["name"])
            unique.append(d)
    all_donors = unique

    # Sort by score desc, take top 50
    all_donors.sort(key=lambda d: d["score"], reverse=True)
    all_donors = all_donors[:50]

    # Assign ranks
    for i, d in enumerate(all_donors):
        d["rank"] = i + 1

    # Build priority buckets
    top10 = all_donors[:10]
    high = [d for d in all_donors[10:] if d["score"] >= 60]
    medium = [d for d in all_donors[10:] if d["score"] < 60]

    lybunt_list = [d for d in all_donors if d["category"] == "LYBUNT"]
    upgrade_list = [d for d in all_donors if d["category"] == "Upgrade"]
    lapsed_list = [d for d in all_donors if d["category"] == "Lapsed"]

    total_potential = sum(d["suggestedAsk"] for d in all_donors)
    top10_potential = sum(d["suggestedAsk"] for d in top10)

    output = {
        "asOfDate": datetime.datetime.now().strftime("%Y-%m-%d"),
        "totalPotentialRevenue": total_potential,
        "totalProspects": len(all_donors),
        "byPriority": [
            {"priority": "Top 10", "count": len(top10), "potential": top10_potential},
            {"priority": "High", "count": len(high), "potential": sum(d["suggestedAsk"] for d in high)},
            {"priority": "Medium", "count": len(medium), "potential": sum(d["suggestedAsk"] for d in medium)},
        ],
        "donors": all_donors,
        "kpis": {
            "totalPotential": total_potential,
            "top10Potential": top10_potential,
            "lybuntCount": len(lybunt_list),
            "upgradeCount": len(upgrade_list),
            "lapsedCount": len(lapsed_list),
        },
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWrote {OUTPUT} — {len(all_donors)} donors, ${total_potential:,.0f} total potential")


if __name__ == "__main__":
    main()
