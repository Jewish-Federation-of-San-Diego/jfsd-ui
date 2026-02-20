#!/usr/bin/env python3
"""
generate-stripe-data.py — Generate stripe.json for the JFSD Stripe Dashboard.

Queries Stripe API for FY26 data (Jul 1 2025 → now) and outputs JSON
to public/data/stripe.json for the React dashboard to consume.
"""

import json
import os
import sys
import base64
import urllib.request
import urllib.parse
from collections import defaultdict
from datetime import datetime, date, timezone
from pathlib import Path

ENV_FILE = Path.home() / ".secrets" / "stripe.env"
API_BASE = "https://api.stripe.com/v1"
GIVECLOUD_APP = "ca_BU1G6kvp8bkQJDv9TP7UAnzk6w9El1TC"
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "stripe.json"

FY26_START = "2025-07-01"
# FY26_END = "2026-06-30"  # we query up to now


def load_key():
    env = {}
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k] = v
    return env.get('STRIPE_API_KEY', '')


def api_get(endpoint, api_key):
    url = f"{API_BASE}{endpoint}"
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def paginate(endpoint, api_key, max_items=10000):
    all_items = []
    cursor = None
    while len(all_items) < max_items:
        sep = '&' if '?' in endpoint else '?'
        url = f"{endpoint}{sep}limit=100"
        if cursor:
            url += f"&starting_after={cursor}"
        data = api_get(url, api_key)
        items = data.get('data', [])
        if not items:
            break
        all_items.extend(items)
        if not data.get('has_more', False):
            break
        cursor = items[-1]['id']
    return all_items


def date_to_ts(date_str):
    return int(datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())


def main():
    api_key = load_key()
    if not api_key:
        print("Error: STRIPE_API_KEY not found in ~/.secrets/stripe.env", file=sys.stderr)
        sys.exit(1)

    start_ts = date_to_ts(FY26_START)
    print(f"Fetching charges from {FY26_START} to now...")

    # ── Fetch all succeeded charges ──
    charges = paginate(
        f"/charges?status=succeeded&created%5Bgte%5D={start_ts}",
        api_key
    )
    print(f"  Found {len(charges)} charges")

    # ── Fetch balance transactions for fee data ──
    print("Fetching balance transactions for fees...")
    bal_txns = paginate(
        f"/balance_transactions?type=charge&created%5Bgte%5D={start_ts}",
        api_key
    )
    print(f"  Found {len(bal_txns)} balance transactions")

    # Index balance transactions by source (charge ID)
    fee_by_charge = {}
    for bt in bal_txns:
        src = bt.get('source', '')
        fee_by_charge[src] = {
            'fee': bt.get('fee', 0),
            'net': bt.get('net', 0),
            'amount': bt.get('amount', 0),
        }

    # ── Aggregate monthly data ──
    MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    # FY26 order: Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun
    FY_ORDER = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

    by_month = defaultdict(lambda: {'charges': 0, 'amount': 0, 'fees': 0})
    by_card = defaultdict(lambda: {'charges': 0, 'amount': 0})
    by_source = defaultdict(lambda: {'charges': 0, 'amount': 0})
    total_amount = 0
    total_fees = 0

    for c in charges:
        amt_dollars = c['amount'] / 100
        dt = datetime.fromtimestamp(c['created'])
        month_key = dt.month  # 1-12
        
        by_month[month_key]['charges'] += 1
        by_month[month_key]['amount'] += c['amount']  # keep in cents for now

        # Fee data from balance transaction
        fee_info = fee_by_charge.get(c['id'], {})
        by_month[month_key]['fees'] += fee_info.get('fee', 0)

        # Card brand
        card = (c.get('payment_method_details', {}).get('card') or {}).get('brand', 'other')
        brand = card.capitalize() if card != 'amex' else 'Amex'
        by_card[brand]['charges'] += 1
        by_card[brand]['amount'] += c['amount']

        # Source (GiveCloud vs Direct)
        src = 'GiveCloud' if c.get('application') == GIVECLOUD_APP else 'Direct'
        by_source[src]['charges'] += 1
        by_source[src]['amount'] += c['amount']

        total_amount += c['amount']
        total_fees += fee_info.get('fee', 0)

    # ── Build monthlyData ──
    monthly_data = []
    for m in FY_ORDER:
        if m not in by_month:
            continue
        d = by_month[m]
        amt = round(d['amount'] / 100)
        fees = round(d['fees'] / 100)
        fee_rate = round(d['fees'] / d['amount'] * 100, 2) if d['amount'] else 0
        monthly_data.append({
            'month': MONTH_NAMES[m - 1],
            'charges': d['charges'],
            'amount': amt,
            'fees': fees,
            'feeRate': fee_rate,
        })

    # ── Build cardBrandData ──
    card_brand_data = []
    for brand, v in sorted(by_card.items(), key=lambda x: -x[1]['amount']):
        card_brand_data.append({
            'brand': brand,
            'amount': round(v['amount'] / 100),
            'charges': v['charges'],
        })

    # ── Build sourceData ──
    total_dollars = total_amount / 100
    source_data = []
    for src, v in sorted(by_source.items(), key=lambda x: -x[1]['amount']):
        amt = round(v['amount'] / 100)
        pct = round(amt / total_dollars * 100, 1) if total_dollars else 0
        source_data.append({
            'source': src,
            'charges': v['charges'],
            'amount': amt,
            'pct': pct,
        })

    # ── Build KPIs ──
    gross = round(total_amount / 100)
    fees = round(total_fees / 100)
    net = gross - fees
    avg_fee = round(total_fees / total_amount * 100, 2) if total_amount else 0
    total_charges = len(charges)
    avg_per = round(gross / total_charges) if total_charges else 0
    as_of = datetime.now().strftime('%b %d, %Y')

    kpis = {
        'grossVolume': gross,
        'netAfterFees': net,
        'totalFees': fees,
        'avgFeeRate': avg_fee,
        'totalCharges': total_charges,
        'avgPerCharge': avg_per,
        'asOfDate': as_of,
    }

    # ── Write output ──
    output = {
        'monthlyData': monthly_data,
        'cardBrandData': card_brand_data,
        'sourceData': source_data,
        'kpis': kpis,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {OUTPUT_FILE}")
    print(f"  Gross: ${gross:,}")
    print(f"  Fees: ${fees:,} ({avg_fee:.2f}%)")
    print(f"  Charges: {total_charges}")
    print(f"  Months: {len(monthly_data)}")
    print(f"  Card brands: {len(card_brand_data)}")
    print(f"  Sources: {len(source_data)}")


if __name__ == "__main__":
    main()
