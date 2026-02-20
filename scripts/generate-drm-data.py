#!/usr/bin/env python3
"""
Generate drm-portfolio.json for the DRM Portfolio dashboard.
Queries Salesforce for each DRM's portfolio data.
Output: public/data/drm-portfolio.json
"""

import json, os, subprocess, sys, datetime, re
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "drm-portfolio.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")

# Known DRM names (used to filter Owner.Name results)
DRM_NAMES = [
    "Michael Rabkin", "Ronnie Diamond", "Dustin Biton", "Maya Steinberg",
    "Lorraine Fisher", "Heidi Gantwerk", "Deena S. Libman", "Steve Gerard",
    "Paul Sapiano", "Jessica McGregor"
]

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
    """Safely get a nested key like Owner.Name from a record dict."""
    parts = key.split(".")
    obj = rec
    for p in parts:
        if obj is None or not isinstance(obj, dict):
            return None
        obj = obj.get(p)
    return obj

def num(v):
    """Coerce to float, default 0."""
    if v is None:
        return 0.0
    try:
        return float(v)
    except:
        return 0.0

def slug(name: str) -> str:
    return name.lower().replace(" ", "-").replace(".", "")

def main():
    print("🔍 Fetching DRM User IDs...")
    # Get user IDs for DRMs
    drm_name_list = "', '".join(DRM_NAMES)
    users = sf(f"SELECT Id, Name FROM User WHERE Name IN ('{drm_name_list}') AND IsActive = true")
    drm_map = {}  # userId -> name
    for u in users:
        name = u.get("Name", "")
        uid = u.get("Id", "")
        if name and uid:
            drm_map[uid] = name
    print(f"  Found {len(drm_map)} DRM users: {list(drm_map.values())}")

    # For any DRMs not found by exact name, try partial match
    found_names = set(drm_map.values())
    missing = [n for n in DRM_NAMES if n not in found_names]
    if missing:
        print(f"  ⚠️  Missing DRMs: {missing}")

    if not drm_map:
        print("❌ No DRM users found. Check DRM_NAMES list.", file=sys.stderr)
        sys.exit(1)

    drm_ids = "', '".join(drm_map.keys())

    # ── Query 1: Portfolio summary per DRM ──
    # Only count donors with some giving history (recognition or gifts)
    print("📊 Querying portfolio summaries...")
    summary_recs = sf(
        f"SELECT OwnerId, "
        f"COUNT(Id) total_donors, "
        f"SUM(Recognition_Amount_FY26__c) total_fy26, "
        f"SUM(Recognition_Amount_FY25__c) total_fy25 "
        f"FROM Account "
        f"WHERE OwnerId IN ('{drm_ids}') AND IsPersonAccount = true "
        f"AND (Recognition_Amount_All_Time__c > 0 OR Total_Gifts_All_Time__c > 0) "
        f"GROUP BY OwnerId"
    )
    summary_by_owner = {}
    for r in summary_recs:
        oid = r.get("OwnerId", "")
        summary_by_owner[oid] = r

    # ── Query 2: LYBUNT per DRM (gave FY25, not FY26) ──
    print("📊 Querying LYBUNT counts...")
    lybunt_counts = sf(
        f"SELECT OwnerId, COUNT(Id) cnt, SUM(Recognition_Amount_FY25__c) amt "
        f"FROM Account "
        f"WHERE OwnerId IN ('{drm_ids}') AND IsPersonAccount = true "
        f"AND (Recognition_Amount_All_Time__c > 0 OR Total_Gifts_All_Time__c > 0) "
        f"AND Recognition_Amount_FY25__c > 0 "
        f"AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null) "
        f"GROUP BY OwnerId"
    )
    lybunt_by_owner = {}
    for r in lybunt_counts:
        lybunt_by_owner[r.get("OwnerId", "")] = r

    # ── Query 3: SYBUNT per DRM (gave FY24, not FY25 or FY26) ──
    print("📊 Querying SYBUNT counts...")
    sybunt_counts = sf(
        f"SELECT OwnerId, COUNT(Id) cnt "
        f"FROM Account "
        f"WHERE OwnerId IN ('{drm_ids}') AND IsPersonAccount = true "
        f"AND (Recognition_Amount_All_Time__c > 0 OR Total_Gifts_All_Time__c > 0) "
        f"AND Recognition_Amount_FY24__c > 0 "
        f"AND (Recognition_Amount_FY25__c = 0 OR Recognition_Amount_FY25__c = null) "
        f"AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null) "
        f"GROUP BY OwnerId"
    )
    sybunt_by_owner = {}
    for r in sybunt_counts:
        sybunt_by_owner[r.get("OwnerId", "")] = r

    # ── Query 4: Recent gifts (last 30 days) per DRM ──
    print("📊 Querying recent gifts...")
    recent = sf(
        f"SELECT Donor.OwnerId, Donor.Name, CurrentAmount, TransactionDate, Campaign.Name "
        f"FROM GiftTransaction "
        f"WHERE Donor.OwnerId IN ('{drm_ids}') "
        f"AND Status = 'Paid' AND TransactionDate = LAST_N_DAYS:30 "
        f"ORDER BY TransactionDate DESC LIMIT 200"
    )
    recent_by_owner = {}
    for r in recent:
        oid = val(r, "Donor.OwnerId") or ""
        recent_by_owner.setdefault(oid, []).append(r)

    # ── Query 5: Top donors per DRM (by FY26 recognition) ──
    print("📊 Querying top donors...")
    drms_data = []
    for uid, drm_name in sorted(drm_map.items(), key=lambda x: x[1]):
        print(f"  👤 {drm_name}...")
        top = sf(
            f"SELECT Name, Recognition_Amount_FY26__c, Recognition_Amount_FY25__c, "
            f"PersonEmail, Phone "
            f"FROM Account "
            f"WHERE OwnerId = '{uid}' AND IsPersonAccount = true "
            f"AND (Recognition_Amount_FY26__c > 0 OR Recognition_Amount_FY25__c > 0) "
            f"ORDER BY Recognition_Amount_FY26__c DESC NULLS LAST LIMIT 25"
        )
        top_donors = []
        for d in top:
            top_donors.append({
                "name": d.get("Name", ""),
                "fy26": num(d.get("Recognition_Amount_FY26__c")),
                "fy25": num(d.get("Recognition_Amount_FY25__c")),
                "email": d.get("PersonEmail", "") or "",
                "phone": d.get("Phone", "") or "",
            })

        # LYBUNT list
        lybunt_list_recs = sf(
            f"SELECT Name, Recognition_Amount_FY25__c, Last_Gift_Date__c, PersonEmail, Phone "
            f"FROM Account "
            f"WHERE OwnerId = '{uid}' AND IsPersonAccount = true "
            f"AND Recognition_Amount_FY25__c > 0 "
            f"AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null) "
            f"ORDER BY Recognition_Amount_FY25__c DESC NULLS LAST LIMIT 50"
        )
        lybunt_list = []
        for d in lybunt_list_recs:
            lybunt_list.append({
                "name": d.get("Name", ""),
                "fy25Amount": num(d.get("Recognition_Amount_FY25__c")),
                "lastGiftDate": d.get("Last_Gift_Date__c", "") or "",
                "email": d.get("PersonEmail", "") or "",
                "phone": d.get("Phone", "") or "",
            })

        # Recent activity
        drm_recent = recent_by_owner.get(uid, [])
        activity = []
        for r in drm_recent[:20]:
            activity.append({
                "donorName": val(r, "Donor.Name") or "",
                "amount": num(r.get("CurrentAmount")),
                "date": r.get("TransactionDate", "") or "",
                "type": val(r, "Campaign.Name") or "Gift",
            })

        s = summary_by_owner.get(uid, {})
        lb = lybunt_by_owner.get(uid, {})
        sb = sybunt_by_owner.get(uid, {})

        drms_data.append({
            "name": drm_name,
            "slug": slug(drm_name),
            "totalDonors": int(num(s.get("total_donors"))),
            "totalRecognitionFY26": num(s.get("total_fy26")),
            "totalRecognitionFY25": num(s.get("total_fy25")),
            "lybuntCount": int(num(lb.get("cnt"))),
            "lybuntAmount": num(lb.get("amt")),
            "sybuntCount": int(num(sb.get("cnt"))),
            "recentGifts30d": len(drm_recent),
            "topDonors": top_donors,
            "lybuntList": lybunt_list,
            "recentActivity": activity,
        })

    # Sort by portfolio size desc
    drms_data.sort(key=lambda d: d["totalDonors"], reverse=True)

    # KPIs
    total_donors = sum(d["totalDonors"] for d in drms_data)
    total_lybunt = sum(d["lybuntCount"] for d in drms_data)
    total_fy26 = sum(d["totalRecognitionFY26"] for d in drms_data)

    output = {
        "asOfDate": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "drms": drms_data,
        "kpis": {
            "totalPortfolioDonors": total_donors,
            "totalLYBUNT": total_lybunt,
            "totalRecognitionFY26": total_fy26,
            "avgPortfolioSize": round(total_donors / len(drms_data)) if drms_data else 0,
        }
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"✅ Written {OUTPUT} ({len(drms_data)} DRMs, {total_donors} total donors)")

if __name__ == "__main__":
    main()
