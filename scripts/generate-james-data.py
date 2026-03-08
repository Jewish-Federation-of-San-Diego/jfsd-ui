#!/usr/bin/env python3
"""
Generate james-ap-expense.json for the AP & Expense dashboard.
Pulls live data from Ramp API + Sage Intacct SQLite.
"""

import json
import subprocess
import sqlite3
import os
from datetime import datetime, timedelta
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCRIPT_DIR)  # jfsd-ui root
CLAWD = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "..", ".."))  # /Users/davidfuhriman/clawd
DB_PATH = os.path.join(CLAWD, "projects/sage-intacct/data/jfsd-gl.db")
RAMP_SCRIPT = os.path.join(CLAWD, "skills/ramp/scripts/ramp.sh")
OUTPUT = os.path.join(BASE, "public/data/james-ap-expense.json")

NOW = datetime.now()
SEVEN_DAYS_AGO = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
THIRTY_DAYS_AGO = (NOW - timedelta(days=30)).strftime("%Y-%m-%d")
TODAY = NOW.strftime("%Y-%m-%d")

# FY26: Jul 2025 - Jun 2026
FY_START = "2025-07-01"


def run_ramp(args: str) -> dict:
    """Run ramp.sh and parse JSON from output."""
    cmd = f"bash {RAMP_SCRIPT} {args}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=CLAWD)
    output = result.stdout
    if result.stderr:
        print(f"  [ramp stderr]: {result.stderr[:200]}")
    # Find JSON in output (skip ANSI header lines)
    for i, line in enumerate(output.split('\n')):
        stripped = line.strip()
        if stripped.startswith('{') or stripped.startswith('['):
            json_str = '\n'.join(output.split('\n')[i:])
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"  [ramp JSON error]: {e}")
                print(f"  [ramp first 200 chars]: {json_str[:200]}")
                return {}
    print(f"  [ramp no JSON found in {len(output)} bytes, cmd: {args[:60]}]")
    return {}


def get_ramp_transactions(from_date: str, to_date: str, limit: int = 200) -> list:
    """Fetch Ramp transactions."""
    args = f"transactions --from '{from_date}T00:00:00' --to '{to_date}T23:59:59' --limit {min(limit, 100)}"
    data = run_ramp(args)
    if 'error' in data or 'error_v2' in data:
        print(f"  [warn] Ramp API error: {data.get('error_v2', {}).get('message', 'unknown')}")
    return data.get("data", [])


def get_ramp_cards() -> list:
    """Fetch active Ramp cards."""
    data = run_ramp("cards --json")
    return data.get("data", [])


def parse_txn(txn: dict) -> dict:
    """Extract useful fields from a Ramp transaction."""
    holder = txn.get("card_holder", {})
    name = f"{holder.get('first_name', '').strip()} {holder.get('last_name', '').strip()}".strip()
    dept = holder.get("department_name", "Unknown")

    # Get department from accounting_categories if available
    for cat in txn.get("accounting_categories", []):
        if cat.get("tracking_category_remote_name") == "Department":
            dept = cat.get("category_name", dept)
            break

    return {
        "id": txn.get("id", ""),
        "merchant": txn.get("merchant_name", "Unknown"),
        "amount": txn.get("amount", 0),
        "cardholder": name,
        "department": dept,
        "date": txn.get("user_transaction_time", "")[:10],
        "memo": txn.get("memo"),
        "receipts": txn.get("receipts", []),
        "policy_violations": txn.get("policy_violations", []),
        "state": txn.get("state", ""),
        "category": txn.get("sk_category_name", ""),
    }


def build_action_items(txns_7d: list) -> list:
    """Identify action items from recent transactions."""
    items = []

    for t in txns_7d:
        p = parse_txn(t)

        # Missing receipts (no receipts and amount > $25)
        if not p["receipts"] and p["amount"] > 25:
            items.append({
                "type": "missing_receipt",
                "merchant": p["merchant"],
                "amount": p["amount"],
                "cardholder": p["cardholder"],
                "date": p["date"],
                "txnId": p["id"],
            })

        # Needs review: over $500
        if p["amount"] >= 500:
            items.append({
                "type": "needs_review",
                "merchant": p["merchant"],
                "amount": p["amount"],
                "cardholder": p["cardholder"],
                "date": p["date"],
                "reason": f"High-value transaction (${p['amount']:,.2f})",
            })

        # Policy exceptions
        if p["policy_violations"]:
            items.append({
                "type": "policy_exception",
                "merchant": p["merchant"],
                "amount": p["amount"],
                "cardholder": p["cardholder"],
                "date": p["date"],
                "reason": "Policy violation flagged by Ramp",
            })

        # Weekend purchases
        if p["date"]:
            try:
                dt = datetime.strptime(p["date"], "%Y-%m-%d")
                if dt.weekday() >= 5 and p["amount"] > 50:
                    items.append({
                        "type": "policy_exception",
                        "merchant": p["merchant"],
                        "amount": p["amount"],
                        "cardholder": p["cardholder"],
                        "date": p["date"],
                        "reason": "Weekend purchase",
                    })
            except ValueError:
                pass

    # Deduplicate by txnId/merchant+date+amount
    seen = set()
    deduped = []
    for item in items:
        key = (item["type"], item.get("txnId", ""), item["merchant"], item["date"], item["amount"])
        if key not in seen:
            seen.add(key)
            deduped.append(item)

    return sorted(deduped, key=lambda x: x["amount"], reverse=True)


def build_expense_summary(txns_7d: list, txns_30d: list) -> dict:
    """Build expense summary from transactions."""
    total_7d = sum(parse_txn(t)["amount"] for t in txns_7d)
    total_30d = sum(parse_txn(t)["amount"] for t in txns_30d)

    # By department
    dept_spend = defaultdict(lambda: {"amount": 0, "txnCount": 0})
    merchant_spend = defaultdict(lambda: {"amount": 0, "txnCount": 0})

    for t in txns_30d:
        p = parse_txn(t)
        dept_spend[p["department"]]["amount"] += p["amount"]
        dept_spend[p["department"]]["txnCount"] += 1
        merchant_spend[p["merchant"]]["amount"] += p["amount"]
        merchant_spend[p["merchant"]]["txnCount"] += 1

    by_dept = sorted(
        [{"dept": k, "amount": round(v["amount"], 2), "txnCount": v["txnCount"]}
         for k, v in dept_spend.items()],
        key=lambda x: x["amount"], reverse=True
    )

    top_merchants = sorted(
        [{"merchant": k, "amount": round(v["amount"], 2), "txnCount": v["txnCount"]}
         for k, v in merchant_spend.items()],
        key=lambda x: x["amount"], reverse=True
    )[:10]

    # Receipt compliance
    total_txns = len(txns_30d)
    with_receipts = sum(1 for t in txns_30d if t.get("receipts"))
    compliance = round(with_receipts / total_txns * 100, 1) if total_txns else 0

    return {
        "totalSpend7d": round(total_7d, 2),
        "totalSpend30d": round(total_30d, 2),
        "byDepartment": by_dept,
        "topMerchants": top_merchants,
        "receiptComplianceRate": compliance,
    }


def build_budget_pace(db: sqlite3.Connection) -> list:
    """Compare actual GL spending vs budget by department for FY26 YTD."""
    # Determine which monthly budget columns to sum (Jul 2025 through current month)
    month_cols = []
    current = datetime(2025, 7, 1)
    while current <= NOW:
        col = current.strftime("%b_%Y").lower()
        month_cols.append(col)
        if current.month == 12:
            current = datetime(current.year + 1, 1, 1)
        else:
            current = datetime(current.year, current.month + 1, 1)

    # Budget by department (expense accounts 50000-69999)
    budget_sum_expr = " + ".join([f"COALESCE({c}, 0)" for c in month_cols])
    budget_query = f"""
        SELECT dept_id, SUM({budget_sum_expr}) as budget_ytd
        FROM budget
        WHERE CAST(acct_no AS INTEGER) BETWEEN 50000 AND 69999
        GROUP BY dept_id
    """

    # Actual by department (expense accounts)
    actual_query = """
        SELECT department_title, SUM(amount) as actual_ytd
        FROM gl_details
        WHERE CAST(account AS INTEGER) BETWEEN 50000 AND 69999
          AND entry_date >= '7/1/2025'
        GROUP BY department_title
    """

    # Dept mapping from budget dept_id to name
    dept_map = {
        "D10": "Admin", "D20": "Development", "D30": "Marketing",
        "D40": "Programs", "D50": "Engagement", "D60": "Grantmaking",
        "D70": "Executive", "D80": "Israel Connections", "D90": "Overseas",
    }

    budget_data = {}
    try:
        for row in db.execute(budget_query):
            dept_name = dept_map.get(row[0], row[0] or "Other")
            budget_data[dept_name] = row[1] or 0
    except Exception:
        pass

    actual_data = {}
    for row in db.execute(actual_query):
        actual_data[row[0] or "Other"] = row[1] or 0

    # Merge
    all_depts = set(list(budget_data.keys()) + list(actual_data.keys()))
    pace = []
    for dept in sorted(all_depts):
        if not dept or dept == "Other":
            continue
        b = budget_data.get(dept, 0)
        a = actual_data.get(dept, 0)
        pct = round(a / b * 100, 1) if b else 0
        # Project over/under: extrapolate remaining months
        months_elapsed = len(month_cols)
        months_total = 12
        projected = (a / months_elapsed * months_total) if months_elapsed else a
        over_under = round(projected - b, 2) if b else 0

        pace.append({
            "department": dept,
            "budgetYTD": round(b, 2),
            "actualYTD": round(a, 2),
            "pctUsed": pct,
            "projectedOverUnder": over_under,
        })

    return sorted(pace, key=lambda x: x["pctUsed"], reverse=True)


def build_card_management(cards: list, txns_30d: list) -> dict:
    """Analyze card usage."""
    # Build last-activity map from transactions
    last_activity = {}
    for t in txns_30d:
        p = parse_txn(t)
        card_id = t.get("card_id", "")
        if card_id:
            existing = last_activity.get(card_id, "")
            if p["date"] > existing:
                last_activity[card_id] = p["date"]

    active_count = 0
    dormant = []
    high_util = []

    for card in cards:
        state = card.get("state", "")
        if state not in ("ACTIVE",):
            continue
        active_count += 1

        card_id = card.get("id", "")
        holder = card.get("card_holder", card.get("cardholder", {}))
        if isinstance(holder, dict):
            name = f"{holder.get('first_name', '').strip()} {holder.get('last_name', '').strip()}".strip()
        else:
            name = str(holder)

        spending = card.get("spending_restrictions", {})
        limit_amt = spending.get("amount", 0) if spending else 0

        last_act = last_activity.get(card_id, "")

        # Dormant: no activity in 30d
        if not last_act and name:
            dormant.append({
                "cardholder": name,
                "lastActivity": "30+ days ago",
                "limit": limit_amt,
            })

        # High utilization: spent > 80% of limit
        card_spent = sum(
            parse_txn(t)["amount"]
            for t in txns_30d
            if t.get("card_id") == card_id
        )
        if limit_amt and limit_amt > 0 and card_spent / limit_amt > 0.8:
            high_util.append({
                "cardholder": name,
                "spent": round(card_spent, 2),
                "limit": limit_amt,
                "pctUsed": round(card_spent / limit_amt * 100, 1),
            })

    return {
        "activeCards": active_count,
        "dormantCards": dormant[:10],
        "highUtilization": sorted(high_util, key=lambda x: x["pctUsed"], reverse=True)[:10],
    }


def build_gl_health(db: sqlite3.Connection) -> dict:
    """GL health metrics from Sage Intacct."""
    # Manual entries in last 7 days
    manual_query = """
        SELECT COUNT(*) FROM gl_details
        WHERE entry_date >= ? AND (memo LIKE '%manual%' OR memo LIKE '%adjustment%' OR username = 'admin')
    """
    # Use approximate date matching (entry_date is M/D/YYYY)
    manual_count = 0
    try:
        # Get entries from last 7 days - dates in DB are M/D/YYYY
        seven_days = []
        for i in range(7):
            d = NOW - timedelta(days=i)
            seven_days.append(d.strftime("%-m/%-d/%Y"))
            seven_days.append(d.strftime("%m/%d/%Y"))

        placeholders = ",".join(["?" for _ in seven_days])
        q = f"""
            SELECT COUNT(*) FROM gl_details
            WHERE entry_date IN ({placeholders})
              AND (memo LIKE '%manual%' OR memo LIKE '%adjustment%' OR memo LIKE '%reclass%')
        """
        row = db.execute(q, seven_days).fetchone()
        manual_count = row[0] if row else 0
    except Exception:
        pass

    # Uncleared items (AP account 20000) in last 30 days
    uncleared = 0
    try:
        thirty_days = []
        for i in range(30):
            d = NOW - timedelta(days=i)
            thirty_days.append(d.strftime("%-m/%-d/%Y"))
            thirty_days.append(d.strftime("%m/%d/%Y"))

        placeholders = ",".join(["?" for _ in thirty_days])
        q = f"""
            SELECT COUNT(*) FROM gl_details
            WHERE account IN ('20000', '20100', '20200', '20255', '20300')
              AND entry_date IN ({placeholders})
        """
        row = db.execute(q, thirty_days).fetchone()
        uncleared = row[0] if row else 0
    except Exception:
        pass

    # AP aging buckets - based on outstanding AP entries
    # We approximate by looking at AP entries grouped by age
    buckets = [
        {"bucket": "0-30", "amount": 0, "count": 0},
        {"bucket": "31-60", "amount": 0, "count": 0},
        {"bucket": "61-90", "amount": 0, "count": 0},
        {"bucket": "90+", "amount": 0, "count": 0},
    ]
    try:
        ap_query = """
            SELECT entry_date, amount FROM gl_details
            WHERE account = '20000' AND amount < 0
            ORDER BY entry_date DESC
            LIMIT 500
        """
        for row in db.execute(ap_query):
            try:
                # Parse M/D/YYYY
                dt = datetime.strptime(row[0], "%m/%d/%Y")
            except ValueError:
                try:
                    dt = datetime.strptime(row[0], "%-m/%-d/%Y")
                except ValueError:
                    continue
            days_old = (NOW - dt).days
            amt = abs(row[1])
            if days_old <= 30:
                buckets[0]["amount"] += amt
                buckets[0]["count"] += 1
            elif days_old <= 60:
                buckets[1]["amount"] += amt
                buckets[1]["count"] += 1
            elif days_old <= 90:
                buckets[2]["amount"] += amt
                buckets[2]["count"] += 1
            else:
                buckets[3]["amount"] += amt
                buckets[3]["count"] += 1
    except Exception:
        pass

    for b in buckets:
        b["amount"] = round(b["amount"], 2)

    return {
        "manualEntries7d": manual_count,
        "unclearedItems30d": uncleared,
        "apAgingBuckets": buckets,
    }


def main():
    print("Fetching Ramp transactions (7d)...")
    txns_7d = get_ramp_transactions(SEVEN_DAYS_AGO, TODAY, 200)
    print(f"  Got {len(txns_7d)} transactions (7d)")

    print("Fetching Ramp transactions (30d)...")
    txns_30d = get_ramp_transactions(THIRTY_DAYS_AGO, TODAY, 200)
    print(f"  Got {len(txns_30d)} transactions (30d)")

    print("Fetching Ramp cards...")
    cards = get_ramp_cards()
    print(f"  Got {len(cards)} cards")

    print("Connecting to Sage Intacct SQLite...")
    db = sqlite3.connect(DB_PATH)

    print("Building action items...")
    action_items = build_action_items(txns_7d)

    print("Building expense summary...")
    expense_summary = build_expense_summary(txns_7d, txns_30d)

    print("Building budget pace...")
    budget_pace = build_budget_pace(db)

    print("Building card management...")
    card_mgmt = build_card_management(cards, txns_30d)

    print("Building GL health...")
    gl_health = build_gl_health(db)

    # KPIs
    missing_receipts = len([a for a in action_items if a["type"] == "missing_receipt"])
    ap_outstanding = sum(b["amount"] for b in gl_health["apAgingBuckets"])
    over_budget = len([p for p in budget_pace if p["pctUsed"] > 100])

    kpis = {
        "totalSpendThisWeek": expense_summary["totalSpend7d"],
        "missingReceipts": missing_receipts,
        "receiptComplianceRate": expense_summary["receiptComplianceRate"],
        "apOutstanding": round(ap_outstanding, 2),
        "overBudgetDepts": over_budget,
        "dormantCards": len(card_mgmt["dormantCards"]),
    }

    output = {
        "asOfDate": NOW.strftime("%Y-%m-%dT%H:%M:%S-08:00"),
        "actionItems": action_items,
        "expenseSummary": expense_summary,
        "budgetPace": budget_pace,
        "cardManagement": card_mgmt,
        "glHealth": gl_health,
        "kpis": kpis,
    }

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {OUTPUT}")
    print(f"  Action items: {len(action_items)}")
    print(f"  KPIs: spend=${kpis['totalSpendThisWeek']:,.2f}, missing={kpis['missingReceipts']}, compliance={kpis['receiptComplianceRate']}%")

    db.close()


if __name__ == "__main__":
    main()
