#!/usr/bin/env python3
"""Generate pledge-management.json from Salesforce (NPC).
Rebuilt to use validated fields from cash forecast analysis.
Adds: collection intelligence, payment history, action dates, campaign fulfillment.
Output: public/data/pledge-management.json
"""

import json, subprocess, sys
from datetime import datetime, date
from pathlib import Path
from collections import defaultdict

OUTPUT = Path(__file__).parent.parent / "public" / "data" / "pledge-management.json"
TODAY = date(2026, 3, 7)

def sf_query(soql):
    clean = " ".join(soql.split())
    result = subprocess.run(
        ["node", "skills/salesforce/sf-query.js", clean],
        capture_output=True, text=True, cwd=str(Path.home() / "clawd")
    )
    stdout = result.stdout
    start = stdout.find('{"')
    if start < 0:
        start = stdout.find('{\n')
    if start < 0:
        print(f"  WARN: No JSON for: {clean[:80]}...", file=sys.stderr)
        return []
    try:
        data = json.loads(stdout[start:])
        return data.get("records", [])
    except json.JSONDecodeError:
        print(f"  WARN: Parse error for: {clean[:80]}...", file=sys.stderr)
        return []

def days_since(date_str):
    if not date_str: return None
    try:
        return (TODAY - datetime.strptime(date_str, "%Y-%m-%d").date()).days
    except: return None

def month_name(n):
    return ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][n]

print("Generating Pledge Management data...", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════════
# 1. ALL ACTIVE PLEDGES
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching active pledges...", file=sys.stderr)
pledges = sf_query("""
    SELECT Id, Name, DonorId, Donor_Formal_Greeting__c,
           ExpectedTotalCmtAmount, Total_Expected_Remaining_Balance_Due__c,
           EffectiveStartDate, Status, RecurrenceType, CampaignId, Campaign_Name__c,
           OwnerId
    FROM GiftCommitment
    WHERE Status = 'Active' AND Total_Expected_Remaining_Balance_Due__c > 0
    ORDER BY Total_Expected_Remaining_Balance_Due__c DESC
""")
print(f"    {len(pledges)} active pledges", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════════
# 2. PAYMENT HISTORY ON THESE PLEDGES
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching payment history...", file=sys.stderr)
payments = sf_query("""
    SELECT GiftCommitmentId, TransactionDate, CurrentAmount, PaymentMethod
    FROM GiftTransaction
    WHERE Status = 'Paid'
      AND GiftCommitmentId IN (SELECT Id FROM GiftCommitment WHERE Status = 'Active' AND Total_Expected_Remaining_Balance_Due__c > 0)
    ORDER BY GiftCommitmentId, TransactionDate
""")
print(f"    {len(payments)} payment records", file=sys.stderr)

payments_by_cmt = defaultdict(list)
for p in payments:
    payments_by_cmt[p["GiftCommitmentId"]].append(p)

# ═══════════════════════════════════════════════════════════════════════
# 3. RECENT PAYMENTS (last 90 days, all commitments)
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching recent payments...", file=sys.stderr)
recent = sf_query("""
    SELECT GiftCommitmentId, GiftCommitment.Donor_Formal_Greeting__c,
           GiftCommitment.Campaign_Name__c, GiftCommitment.ExpectedTotalCmtAmount,
           TransactionDate, CurrentAmount, PaymentMethod
    FROM GiftTransaction
    WHERE Status = 'Paid' AND TransactionDate >= 2025-12-07
    AND GiftCommitmentId != null
    ORDER BY TransactionDate DESC
    LIMIT 50
""")
print(f"    {len(recent)} recent payments", file=sys.stderr)

# ═══════════════════════════════════════════════════════════════════════
# 4. NEW PLEDGES THIS MONTH
# ═══════════════════════════════════════════════════════════════════════
new_this_month = sf_query("""
    SELECT COUNT(Id) cnt FROM GiftCommitment
    WHERE Status = 'Active' AND EffectiveStartDate >= 2026-03-01
""")
pledges_this_month = new_this_month[0].get("cnt", 0) if new_this_month else 0

# ═══════════════════════════════════════════════════════════════════════
# 5. PROCESS PLEDGES
# ═══════════════════════════════════════════════════════════════════════
print("  Processing...", file=sys.stderr)

# Campaign classification
CAPITAL = ["Legacy of Light", "Spark", "Beit Melachah"]
EVENTS = ["FED360", "FEDERATION 360", "LOJ", "LION OF JUDAH", "CABINET", "GLOBAL SHABBAT", "EVENT", "CMNTY TRIP", "Community Trip"]

# Aging buckets
aging = {"0-90 days": {"count": 0, "amount": 0},
         "91-180 days": {"count": 0, "amount": 0},
         "181-365 days": {"count": 0, "amount": 0},
         "365+ days": {"count": 0, "amount": 0}}

# Collection priority
PRIORITY_RULES = {
    "critical": "Balance >$50K, 90+ days old, zero payments",
    "high": "Balance >$5K, 180+ days old, zero payments",
    "medium": "Balance >$1K, or any pledge with partial payments",
    "low": "Small balances or recent pledges (< 90 days)",
}

write_off_risk = []
top_open = []
campaign_map = defaultdict(lambda: {"count": 0, "pledged": 0, "paid": 0, "balances": []})
priority_buckets = {"critical": [], "high": [], "medium": [], "low": []}
total_pledged = 0
total_paid = 0
total_outstanding = 0
with_payments = 0

# Seasonality peaks for next action date
PEAK_MONTHS = {10: "Oct (High Holidays)", 12: "Dec (Year-End)", 1: "Jan (Post-Year-End)", 5: "May (Spring Push)"}

def next_collection_window():
    """Next peak collection month from today."""
    current_month = TODAY.month
    for mo in [5, 10, 12, 1]:  # Order by upcoming from March
        if mo > current_month:
            return PEAK_MONTHS.get(mo, month_name(mo))
    return PEAK_MONTHS.get(5, "May")  # Default to next May

for p in pledges:
    committed = p.get("ExpectedTotalCmtAmount", 0) or 0
    balance = p.get("Total_Expected_Remaining_Balance_Due__c", 0) or 0
    paid_amount = committed - balance
    name = p.get("Donor_Formal_Greeting__c") or p.get("Name", "Unknown")
    campaign = p.get("Campaign_Name__c") or "(none)"
    start = p.get("EffectiveStartDate", "")
    days = days_since(start)
    has_pmts = p["Id"] in payments_by_cmt
    pmt_count = len(payments_by_cmt.get(p["Id"], []))
    pmt_total = sum(pay["CurrentAmount"] for pay in payments_by_cmt.get(p["Id"], []))
    is_capital = any(c in campaign.upper() for c in [c.upper() for c in CAPITAL])
    
    total_pledged += committed
    total_paid += paid_amount
    total_outstanding += balance
    if has_pmts:
        with_payments += 1

    # Aging
    if days is not None:
        if days <= 90: bucket = "0-90 days"
        elif days <= 180: bucket = "91-180 days"
        elif days <= 365: bucket = "181-365 days"
        else: bucket = "365+ days"
    else:
        bucket = "0-90 days"
    aging[bucket]["count"] += 1
    aging[bucket]["amount"] += balance

    # Write-off risk: 18+ months, zero payments, not capital, < $10K
    if days and days > 540 and not has_pmts and not is_capital and balance < 10000:
        write_off_risk.append({
            "name": name, "pledgeAmount": committed, "paidAmount": round(paid_amount),
            "balance": balance, "startDate": start, "daysOld": days,
            "campaign": campaign, "paymentCount": 0
        })

    # Priority classification
    if balance > 50000 and days and days > 90 and not has_pmts and not is_capital:
        priority = "critical"
    elif balance > 5000 and days and days > 180 and not has_pmts:
        priority = "high"
    elif balance > 1000 or has_pmts:
        priority = "medium"
    else:
        priority = "low"

    pledge_data = {
        "name": name, "donorId": p.get("DonorId", ""),
        "pledgedAmount": committed, "paidAmount": round(paid_amount),
        "balance": balance, "startDate": start, "daysOld": days,
        "campaign": campaign, "paymentCount": pmt_count,
        "totalPaid": round(pmt_total),
        "priority": priority,
        "isCapital": is_capital,
        "nextAction": next_collection_window() if not is_capital else "Per agreement",
    }
    
    top_open.append(pledge_data)
    priority_buckets[priority].append(pledge_data)

    # Campaign rollup
    campaign_map[campaign]["count"] += 1
    campaign_map[campaign]["pledged"] += committed
    campaign_map[campaign]["paid"] += paid_amount

# Sort
write_off_risk.sort(key=lambda x: -x["balance"])
top_open.sort(key=lambda x: -x["balance"])

# Campaign breakdown
by_campaign = []
for camp, vals in sorted(campaign_map.items(), key=lambda x: -x[1]["pledged"]):
    fulfillment = round(vals["paid"] / vals["pledged"] * 100, 1) if vals["pledged"] > 0 else 0
    by_campaign.append({
        "campaign": camp,
        "pledgeCount": vals["count"],
        "pledgedAmount": round(vals["pledged"]),
        "paidAmount": round(vals["paid"]),
        "outstanding": round(vals["pledged"] - vals["paid"]),
        "fulfillmentRate": fulfillment,
    })

# Recent payments list
recent_list = []
for r in recent:
    cmt = r.get("GiftCommitment") or {}
    recent_list.append({
        "name": cmt.get("Donor_Formal_Greeting__c", "Unknown"),
        "amount": r.get("CurrentAmount", 0),
        "date": r.get("TransactionDate", ""),
        "pledgeTotal": cmt.get("ExpectedTotalCmtAmount", 0),
        "campaign": cmt.get("Campaign_Name__c", ""),
        "method": r.get("PaymentMethod", ""),
    })

# ═══════════════════════════════════════════════════════════════════════
# 6. COLLECTION PRIORITY SUMMARY
# ═══════════════════════════════════════════════════════════════════════
open_count = len(pledges)
fulfillment_rate = round(total_paid / total_pledged * 100, 1) if total_pledged > 0 else 0

priority_summary = {}
for pri, items in priority_buckets.items():
    priority_summary[pri] = {
        "count": len(items),
        "total": round(sum(i["balance"] for i in items)),
        "description": PRIORITY_RULES[pri],
        "topItems": sorted(items, key=lambda x: -x["balance"])[:10],
    }

# ═══════════════════════════════════════════════════════════════════════
# OUTPUT
# ═══════════════════════════════════════════════════════════════════════
output = {
    "asOfDate": TODAY.isoformat(),
    "summary": {
        "totalOpenPledges": open_count,
        "totalPledgedAmount": round(total_pledged),
        "totalPaidAmount": round(total_paid),
        "totalOutstanding": round(total_outstanding),
        "fulfillmentRate": fulfillment_rate,
        "avgPledgeSize": round(total_pledged / open_count) if open_count > 0 else 0,
        "pledgesWithPayments": with_payments,
        "pledgesWithZeroPayments": open_count - with_payments,
        "zeroPaymentPct": round((open_count - with_payments) / open_count * 100, 1) if open_count > 0 else 0,
    },
    "agingBuckets": [
        {"bucket": k, "count": v["count"], "amount": round(v["amount"])}
        for k, v in aging.items()
    ],
    "collectionPriority": priority_summary,
    "writeOffRisk": write_off_risk[:25],
    "topOpenPledges": top_open[:30],
    "byCampaign": by_campaign,
    "recentPayments": recent_list,
    "kpis": {
        "totalOutstanding": round(total_outstanding),
        "fulfillmentRate": fulfillment_rate,
        "writeOffRiskAmount": round(sum(w["balance"] for w in write_off_risk)),
        "writeOffRiskCount": len(write_off_risk),
        "pledgesThisMonth": pledges_this_month,
        "criticalCount": len(priority_buckets["critical"]),
        "criticalAmount": round(sum(i["balance"] for i in priority_buckets["critical"])),
        "highCount": len(priority_buckets["high"]),
        "highAmount": round(sum(i["balance"] for i in priority_buckets["high"])),
        "nextCollectionWindow": next_collection_window(),
    }
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(output, indent=2))
print(f"\nWrote {OUTPUT}", file=sys.stderr)
print(f"  {open_count} pledges, ${total_outstanding:,.0f} outstanding", file=sys.stderr)
print(f"  Fulfillment: {fulfillment_rate}%", file=sys.stderr)
print(f"  Critical: {len(priority_buckets['critical'])} (${sum(i['balance'] for i in priority_buckets['critical']):,.0f})", file=sys.stderr)
print(f"  High: {len(priority_buckets['high'])} (${sum(i['balance'] for i in priority_buckets['high']):,.0f})", file=sys.stderr)
print(f"  Write-off: {len(write_off_risk)} (${sum(w['balance'] for w in write_off_risk):,.0f})", file=sys.stderr)
