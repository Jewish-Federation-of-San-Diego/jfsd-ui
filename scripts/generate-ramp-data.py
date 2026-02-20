#!/usr/bin/env python3
"""
generate-ramp-data.py — Generate ramp-analytics.json for the Ramp Spend Analytics Dashboard.

Pulls from Ramp API (transactions, cards) + Sage Intacct SQLite (budget).
Outputs public/data/ramp-analytics.json.
"""

import json
import subprocess
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

CLAWD = Path.home() / "clawd"
RAMP_SH = CLAWD / "skills" / "ramp" / "scripts" / "ramp.sh"
SAGE_DB = CLAWD / "projects" / "sage-intacct" / "data" / "jfsd-gl.db"
OUTPUT = Path(__file__).parent.parent / "public" / "data" / "ramp-analytics.json"

FY26_START = "2025-07-01"
NOW = datetime.now(timezone.utc)

# Ramp dept_id → Sage dept_id mapping
RAMP_DEPT_TO_SAGE = {
    "Admin": "D10",
    "Administration": "D10",
    "Development": "D20",
    "Programs": "D30",
    "Marketing": "D40",
    "Shinshinim": "D30",
    "Grantmaking": "D30",
    "Executive": "D10",
    "Legacy of Light": "D30",
    "Engagement": "D30",
    "Global Relations": "D30",
    "Israel Connections": "D30",
    "Mission": "D30",
    "Overseas": "D30",
    "Community Chaplain": "D30",
}

SAGE_DEPT_NAMES = {
    "D10": "Administration",
    "D20": "Development",
    "D30": "Programs",
    "D40": "Marketing",
    "D50": "Other",
}


def ramp_cmd(command, *args):
    """Run ramp.sh and return parsed JSON."""
    extra = ["--json"] if command != "api" else []
    cmd = ["bash", str(RAMP_SH), command] + list(args) + extra
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(CLAWD))
    if result.returncode != 0:
        print(f"Warning: ramp.sh {command} failed: {result.stderr[:200]}")
        return {"data": []}
    return json.loads(result.stdout)


def fetch_all_transactions():
    """Paginate through all FY26 transactions."""
    all_txns = []
    from_iso = f"{FY26_START}T00:00:00Z"
    
    # First page — use raw API with ISO dates (Ramp requires ISO 8601, no to_date)
    endpoint = f"/developer/v1/transactions?page_size=100&from_date={from_iso}"
    data = ramp_cmd("api", "GET", endpoint)
    all_txns.extend(data.get("data", []))
    
    # Paginate
    while data.get("page", {}).get("next"):
        next_url = data["page"]["next"]
        import urllib.parse
        parsed = urllib.parse.urlparse(next_url)
        params = urllib.parse.parse_qs(parsed.query)
        start = params.get("start", [None])[0]
        if not start:
            break
        data = ramp_cmd("api", "GET", f"/developer/v1/transactions?from_date={from_iso}&page_size=100&start={start}")
        new_data = data.get("data", [])
        if not new_data:
            break
        all_txns.extend(new_data)
        print(f"  Fetched {len(all_txns)} transactions so far...")
    
    return all_txns


def get_dept(txn):
    """Extract department name from transaction."""
    # Try card_holder department first
    ch = txn.get("card_holder", {})
    if ch and ch.get("department_name"):
        return ch["department_name"]
    # Fall back to accounting_categories
    for cat in txn.get("accounting_categories", []):
        if cat.get("tracking_category_remote_id") == "Department":
            return cat.get("category_name", "Unknown")
    return "Unknown"


def get_category(txn):
    """Get spending category."""
    return txn.get("sk_category_name") or txn.get("merchant_category_code_description") or "Other"


def get_cardholder_name(txn):
    ch = txn.get("card_holder", {})
    if ch:
        return f"{ch.get('first_name', '')} {ch.get('last_name', '')}".strip()
    return "Unknown"


def get_budget_by_dept():
    """Get FY26 expense budget by Sage department."""
    if not SAGE_DB.exists():
        print("Warning: Sage DB not found, skipping budget data")
        return {}
    
    conn = sqlite3.connect(str(SAGE_DB))
    cur = conn.cursor()
    
    # Sum all expense accounts (5xxxx, 6xxxx) by department
    cur.execute("""
        SELECT dept_id,
               sum(jul_2025+aug_2025+sep_2025+oct_2025+nov_2025+dec_2025+
                   jan_2026+feb_2026+mar_2026+apr_2026+may_2026+jun_2026) as total
        FROM budget
        WHERE acct_no LIKE '5%' OR acct_no LIKE '6%'
        GROUP BY dept_id
    """)
    
    result = {}
    for row in cur.fetchall():
        dept_id, total = row
        result[dept_id] = total or 0
    
    conn.close()
    return result


def build_analytics(txns, cards_data):
    """Build the analytics JSON from raw data."""
    now = datetime.now(timezone.utc)
    
    # ── Monthly Trend ──
    monthly = defaultdict(lambda: {"amount": 0.0, "txnCount": 0})
    month_names = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    fy_month_map = {}
    for i, m in enumerate(month_names):
        year = 2025 if i < 6 else 2026
        month_num = 7 + i if i < 6 else i - 5
        fy_month_map[(year, month_num)] = m

    for txn in txns:
        amt = txn.get("amount", 0)
        if amt <= 0:
            continue
        ts = txn.get("user_transaction_time", "")
        if not ts:
            continue
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        key = (dt.year, dt.month)
        label = fy_month_map.get(key)
        if label:
            monthly[label]["amount"] += amt
            monthly[label]["txnCount"] += 1

    monthly_trend = []
    for m in month_names:
        if m in monthly:
            monthly_trend.append({"month": m, "amount": round(monthly[m]["amount"], 2), "txnCount": monthly[m]["txnCount"]})
        else:
            # Only include months up to now
            break

    # ── Department Spend ──
    dept_spend = defaultdict(lambda: {"amount": 0.0, "txnCount": 0})
    for txn in txns:
        amt = txn.get("amount", 0)
        if amt <= 0:
            continue
        dept = get_dept(txn)
        dept_spend[dept]["amount"] += amt
        dept_spend[dept]["txnCount"] += 1

    budget_by_dept = get_budget_by_dept()
    
    department_spend = []
    for dept, data in sorted(dept_spend.items(), key=lambda x: -x[1]["amount"]):
        sage_id = RAMP_DEPT_TO_SAGE.get(dept, "")
        budget = budget_by_dept.get(sage_id, 0)
        pct = round(data["amount"] / budget * 100, 1) if budget > 0 else 0
        department_spend.append({
            "dept": dept,
            "amount": round(data["amount"], 2),
            "txnCount": data["txnCount"],
            "budget": round(budget, 2),
            "pctOfBudget": pct,
        })

    # ── Category Breakdown ──
    cat_spend = defaultdict(lambda: {"amount": 0.0, "txnCount": 0})
    for txn in txns:
        amt = txn.get("amount", 0)
        if amt <= 0:
            continue
        cat = get_category(txn)
        cat_spend[cat]["amount"] += amt
        cat_spend[cat]["txnCount"] += 1

    category_breakdown = [
        {"category": cat, "amount": round(d["amount"], 2), "txnCount": d["txnCount"]}
        for cat, d in sorted(cat_spend.items(), key=lambda x: -x[1]["amount"])
    ][:15]

    # ── Top Merchants ──
    merch_spend = defaultdict(lambda: {"amount": 0.0, "txnCount": 0})
    for txn in txns:
        amt = txn.get("amount", 0)
        if amt <= 0:
            continue
        merch = txn.get("merchant_name", "Unknown")
        merch_spend[merch]["amount"] += amt
        merch_spend[merch]["txnCount"] += 1

    top_merchants = [
        {"merchant": m, "amount": round(d["amount"], 2), "txnCount": d["txnCount"]}
        for m, d in sorted(merch_spend.items(), key=lambda x: -x[1]["amount"])
    ][:15]

    # ── Top Spenders ──
    spender_spend = defaultdict(lambda: {"amount": 0.0, "txnCount": 0, "dept": ""})
    for txn in txns:
        amt = txn.get("amount", 0)
        if amt <= 0:
            continue
        name = get_cardholder_name(txn)
        spender_spend[name]["amount"] += amt
        spender_spend[name]["txnCount"] += 1
        if not spender_spend[name]["dept"]:
            spender_spend[name]["dept"] = get_dept(txn)

    top_spenders = [
        {"name": n, "amount": round(d["amount"], 2), "txnCount": d["txnCount"], "dept": d["dept"]}
        for n, d in sorted(spender_spend.items(), key=lambda x: -x[1]["amount"])
    ][:15]

    # ── Card Utilization ──
    cards = cards_data.get("data", [])
    active_cards = [c for c in cards if c.get("state") == "ACTIVE"]
    
    # Find dormant cards (no txn in 30 days)
    card_last_txn = {}
    for txn in txns:
        cid = txn.get("card_id", "")
        ts = txn.get("user_transaction_time", "")
        if cid and ts:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if cid not in card_last_txn or dt > card_last_txn[cid]:
                card_last_txn[cid] = dt
    
    thirty_days_ago = now - timedelta(days=30)
    dormant = sum(1 for c in active_cards if card_last_txn.get(c["id"], datetime.min.replace(tzinfo=timezone.utc)) < thirty_days_ago)
    
    total_limit = sum((c.get("spending_restrictions") or {}).get("amount", 0) or 0 for c in active_cards)
    total_spent = sum(d["amount"] for d in dept_spend.values())
    util_pct = round(total_spent / total_limit * 100, 1) if total_limit > 0 else 0

    card_utilization = {
        "active": len(active_cards),
        "dormant30d": dormant,
        "totalLimit": round(total_limit, 2),
        "totalSpent": round(total_spent, 2),
        "utilizationPct": util_pct,
    }

    # ── Week over Week ──
    this_week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    last_week_start = this_week_start - timedelta(days=7)
    
    this_week = 0.0
    last_week = 0.0
    for txn in txns:
        amt = txn.get("amount", 0)
        if amt <= 0:
            continue
        ts = txn.get("user_transaction_time", "")
        if not ts:
            continue
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt >= this_week_start:
            this_week += amt
        elif dt >= last_week_start:
            last_week += amt

    wow_change = round((this_week - last_week) / last_week * 100, 1) if last_week > 0 else 0

    week_over_week = {
        "thisWeek": round(this_week, 2),
        "lastWeek": round(last_week, 2),
        "changePct": wow_change,
    }

    # ── KPIs ──
    total_spend = round(total_spent, 2)
    months_with_data = len(monthly_trend) or 1
    monthly_avg = round(total_spend / months_with_data, 2)
    top_dept = department_spend[0] if department_spend else {"dept": "", "amount": 0}

    kpis = {
        "totalSpendFY26": total_spend,
        "monthlyAvg": monthly_avg,
        "activeCards": len(active_cards),
        "topDepartment": top_dept["dept"],
        "topDepartmentAmount": top_dept.get("amount", 0),
        "weekOverWeekChange": wow_change,
    }

    return {
        "asOfDate": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "monthlyTrend": monthly_trend,
        "departmentSpend": department_spend,
        "categoryBreakdown": category_breakdown,
        "topMerchants": top_merchants,
        "topSpenders": top_spenders,
        "cardUtilization": card_utilization,
        "weekOverWeek": week_over_week,
        "kpis": kpis,
    }


def main():
    print("Fetching Ramp transactions...")
    txns = fetch_all_transactions()
    print(f"  Got {len(txns)} transactions")

    print("Fetching Ramp cards...")
    cards = ramp_cmd("cards")
    print(f"  Got {len(cards.get('data', []))} cards")

    print("Building analytics...")
    analytics = build_analytics(txns, cards)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(analytics, f, indent=2)
    print(f"Written to {OUTPUT}")
    
    # Summary
    k = analytics["kpis"]
    print(f"\n📊 FY26 Total: ${k['totalSpendFY26']:,.2f}")
    print(f"📊 Monthly Avg: ${k['monthlyAvg']:,.2f}")
    print(f"📊 Active Cards: {k['activeCards']}")
    print(f"📊 Top Dept: {k['topDepartment']} (${k['topDepartmentAmount']:,.2f})")
    print(f"📊 WoW Change: {k['weekOverWeekChange']:+.1f}%")


if __name__ == "__main__":
    main()
