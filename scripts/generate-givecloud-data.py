#!/usr/bin/env python3
"""Generate givecloud.json for the GiveCloud Online Giving dashboard."""

import json, os, subprocess, sys, statistics
from datetime import datetime
from collections import defaultdict

# ── Config ───────────────────────────────────────────────────────────────
API_KEY = os.environ.get("GIVECLOUD_API_KEY", "")
if not API_KEY:
    env_file = os.path.expanduser("~/.secrets/givecloud.env")
    if os.path.exists(env_file):
        for line in open(env_file):
            if line.startswith("GIVECLOUD_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")

BASE = "https://jewishinsandiego.givecloud.co/admin/api/v2"
FY26_START = "2025-07-01"
NOW = datetime.now()
TODAY = NOW.strftime("%Y-%m-%d")

# Test data filtering
TEST_NAMES = {
    'dwight schrute', 'michael scott', 'leslie knope', 'ron burgundy',
    'harry potter', 'john smith', 'jane doe', 'test user', 'space x',
    'the daily bugle'
}

def is_test(c):
    name = (c.get("supporter") or {}).get("display_name", "").strip().lower()
    if name in TEST_NAMES:
        return True
    email = (c.get("supporter") or {}).get("email", "") or ""
    if "test" in email.lower():
        return True
    ref = c.get("http_referer") or ""
    if "testmode_token" in ref:
        return True
    return False

def api_get(url):
    r = subprocess.run(
        ["curl", "-s", "-g", "-H", f"Authorization: Bearer {API_KEY}",
         "-H", "Accept: application/json", url],
        capture_output=True, text=True, timeout=30
    )
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"data": []}

def fetch_all(endpoint, params=""):
    items, page = [], 1
    while page <= 300:
        url = f"{BASE}{endpoint}?per_page=15&page={page}"
        if params:
            url += f"&{params}"
        data = api_get(url)
        batch = data.get("data", [])
        if not batch:
            break
        items.extend(batch)
        print(f"    page {page}: {len(batch)} records", end="\r")
        if len(batch) < 15:
            break
        page += 1
    print()
    return items

notes = []

# ── Fetch contributions ─────────────────────────────────────────────────
print("Fetching FY26 contributions...")
contribs_raw = fetch_all("/contributions", f"filter%5Bordered_after%5D={FY26_START}")
contribs = [c for c in contribs_raw if not is_test(c)]
print(f"  {len(contribs_raw)} raw, {len(contribs)} after test filter")
if not contribs:
    notes.append("No contributions returned from API")

# ── Fetch products ───────────────────────────────────────────────────────
print("Fetching products...")
products = fetch_all("/products")
print(f"  {len(products)} products")

# ── Fetch supporters ────────────────────────────────────────────────────
print("Fetching supporters...")
supporters = fetch_all("/supporters")
print(f"  {len(supporters)} supporters")

# ── Process contributions ───────────────────────────────────────────────
amounts = []
monthly = defaultdict(lambda: {"amount": 0.0, "contributions": 0, "recurring_amount": 0.0})
product_stats = defaultdict(lambda: {"amount": 0.0, "count": 0})
source_stats = defaultdict(lambda: {"contributions": 0, "amount": 0.0})
recent = []
recurring_contribs = []

for c in contribs:
    total = float(c.get("total_amount", 0) or 0)
    amounts.append(total)

    ordered = c.get("ordered_at", "")
    ym = ""
    if ordered:
        try:
            dt = datetime.fromisoformat(ordered.replace("Z", "+00:00"))
            ym = dt.strftime("%Y-%m")
            monthly[ym]["amount"] += total
            monthly[ym]["contributions"] += 1
        except Exception:
            pass

    is_rec = bool(c.get("is_recurring"))
    if is_rec:
        recurring_contribs.append(c)
        if ym:
            monthly[ym]["recurring_amount"] += total

    # Line items for product attribution
    for item in c.get("line_items", []):
        pname = item.get("description") or "General"
        amt = float(item.get("total", 0) or 0)
        product_stats[pname]["amount"] += amt
        product_stats[pname]["count"] += 1

    # Source
    src = c.get("source", "Unknown") or c.get("payment_type", "Unknown") or "Unknown"
    source_stats[src]["contributions"] += 1
    source_stats[src]["amount"] += total

    # Recent
    supporter = c.get("supporter") or {}
    name = supporter.get("display_name", "").strip()
    product_name = ""
    if c.get("line_items"):
        product_name = c["line_items"][0].get("description", "")

    recent.append({
        "name": name or "Anonymous",
        "amount": total,
        "product": product_name,
        "date": ordered[:10] if ordered else "",
        "recurring": is_rec
    })

# Sort recent by date desc
recent.sort(key=lambda x: x["date"], reverse=True)
recent = recent[:20]

# Monthly trend sorted
month_labels = {
    "2025-07": "Jul", "2025-08": "Aug", "2025-09": "Sep", "2025-10": "Oct",
    "2025-11": "Nov", "2025-12": "Dec", "2026-01": "Jan", "2026-02": "Feb",
    "2026-03": "Mar", "2026-04": "Apr", "2026-05": "May", "2026-06": "Jun"
}
monthly_trend = []
for ym in sorted(monthly.keys()):
    monthly_trend.append({
        "month": month_labels.get(ym, ym),
        "amount": round(monthly[ym]["amount"], 2),
        "recurringAmount": round(monthly[ym]["recurring_amount"], 2),
        "contributions": monthly[ym]["contributions"]
    })

# Top products
top_products = sorted(product_stats.items(), key=lambda x: x[1]["amount"], reverse=True)[:10]
top_products = [{"name": k, "amount": round(v["amount"], 2), "count": v["count"]} for k, v in top_products]

# Conversion by source
conv_source = [{"source": k, "contributions": v["contributions"], "amount": round(v["amount"], 2)}
               for k, v in sorted(source_stats.items(), key=lambda x: x[1]["amount"], reverse=True)]

# ── Recurring estimates ─────────────────────────────────────────────────
recurring_amounts = [float(c.get("total_amount", 0) or 0) for c in recurring_contribs]
unique_recurring_emails = set(
    (c.get("supporter") or {}).get("email", "") for c in recurring_contribs
) - {""}
# MRR: avg monthly recurring revenue
months_with_recurring = len(set(
    c.get("ordered_at", "")[:7] for c in recurring_contribs if c.get("ordered_at")
))
mrr = sum(recurring_amounts) / max(months_with_recurring, 1)

# New supporters this month
current_ym = NOW.strftime("%Y-%m")
new_this_month = sum(1 for s in supporters if (s.get("created_at") or "")[:7] == current_ym)

# ── KPIs ────────────────────────────────────────────────────────────────
total_rev = sum(amounts)
avg_gift = total_rev / len(amounts) if amounts else 0
median_gift = statistics.median(amounts) if amounts else 0

result = {
    "asOfDate": TODAY,
    "notes": notes if notes else None,
    "onlineGiving": {
        "totalFY26": round(total_rev, 2),
        "totalContributions": len(contribs),
        "avgGift": round(avg_gift, 2),
        "medianGift": round(median_gift, 2)
    },
    "monthlyTrend": monthly_trend,
    "recurring": {
        "activeProfiles": len(unique_recurring_emails),
        "monthlyRecurringRevenue": round(mrr, 2),
        "newThisMonth": new_this_month,
        "cancelledThisMonth": 0,
        "churnRate": 0,
        "avgRecurringAmount": round(statistics.mean(recurring_amounts), 2) if recurring_amounts else 0
    },
    "topProducts": top_products,
    "conversionBySource": conv_source,
    "recentContributions": recent,
    "failedPayments": [],
    "kpis": {
        "totalOnlineRevenue": round(total_rev, 2),
        "recurringRevenue": round(sum(recurring_amounts), 2),
        "activeRecurring": len(unique_recurring_emails),
        "newDonorsOnline": new_this_month,
        "conversionRate": 0,
        "churnRate": 0
    }
}

# ── Write output ────────────────────────────────────────────────────────
out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "givecloud.json")
with open(out_path, "w") as f:
    json.dump(result, f, indent=2)
print(f"\nWrote {out_path}")
print(f"Total FY26 revenue: ${total_rev:,.2f} from {len(contribs)} contributions")
if recurring_amounts:
    print(f"Recurring: {len(unique_recurring_emails)} donors, MRR ${mrr:,.2f}")
