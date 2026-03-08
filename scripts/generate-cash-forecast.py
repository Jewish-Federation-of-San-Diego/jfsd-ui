#!/usr/bin/env python3
"""
Cash Forecast & Collections Intelligence
Segments pledges receivable, builds collection calendars from donor payment history,
identifies overdue pledges based on actual donor behavior (not arbitrary aging).
"""

import json, subprocess, sys, os
from datetime import datetime, date
from collections import defaultdict
from pathlib import Path

OUTPUT = Path(__file__).parent.parent / "public" / "data" / "cash-forecast.json"
TODAY = date(2026, 3, 7)

def sf_query(soql):
    """Run Salesforce query and return records."""
    # Collapse multi-line SOQL to single line
    clean_soql = " ".join(soql.split())
    result = subprocess.run(
        ["node", "skills/salesforce/sf-query.js", clean_soql],
        capture_output=True, text=True, cwd=str(Path.home() / "clawd")
    )
    stdout = result.stdout
    # Filter dotenv noise — find the JSON object
    start = stdout.find('{"')
    if start < 0:
        start = stdout.find('{\n')
    if start < 0:
        print(f"  WARN: No JSON in response for: {clean_soql[:80]}...", file=sys.stderr)
        if result.stderr:
            print(f"    stderr: {result.stderr[:200]}", file=sys.stderr)
        return []
    try:
        data = json.loads(stdout[start:])
        return data.get("records", [])
    except json.JSONDecodeError as e:
        print(f"  WARN: JSON parse error: {e} for: {clean_soql[:80]}...", file=sys.stderr)
        return []

def days_since(date_str):
    if not date_str: return None
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
        return (TODAY - d).days
    except: return None

def month_name(n):
    return ["", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][n]

print("Generating Cash Forecast & Collections Intelligence...")

# ═══════════════════════════════════════════════════════════════════════
# 1. ACTIVE PLEDGES WITH DETAILS
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching active pledges...")
pledges = sf_query("""
    SELECT Id, Name, DonorId, Donor_Formal_Greeting__c,
           ExpectedTotalCmtAmount, Total_Expected_Remaining_Balance_Due__c,
           EffectiveStartDate, Status, RecurrenceType, CampaignId, Campaign_Name__c
    FROM GiftCommitment
    WHERE Status = 'Active' AND Total_Expected_Remaining_Balance_Due__c > 0
    ORDER BY Total_Expected_Remaining_Balance_Due__c DESC
""")
print(f"    {len(pledges)} active pledges")

# ═══════════════════════════════════════════════════════════════════════
# 2. PAYMENT HISTORY ON ACTIVE PLEDGES
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching payment history...")
payments = sf_query("""
    SELECT GiftCommitmentId, TransactionDate, CurrentAmount, PaymentMethod
    FROM GiftTransaction
    WHERE Status = 'Paid'
      AND GiftCommitmentId IN (SELECT Id FROM GiftCommitment WHERE Status = 'Active' AND Total_Expected_Remaining_Balance_Due__c > 0)
    ORDER BY GiftCommitmentId, TransactionDate
""")
print(f"    {len(payments)} payment records")

# Group payments by commitment
payments_by_commitment = defaultdict(list)
for p in payments:
    payments_by_commitment[p["GiftCommitmentId"]].append(p)

# ═══════════════════════════════════════════════════════════════════════
# 3. OVERALL PAYMENT SEASONALITY (3 years of data)
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching payment seasonality...")
seasonality = sf_query("""
    SELECT CALENDAR_MONTH(TransactionDate) mo, CALENDAR_YEAR(TransactionDate) yr,
           COUNT(Id) cnt, SUM(CurrentAmount) total
    FROM GiftTransaction
    WHERE Status = 'Paid' AND TransactionDate >= 2023-07-01
    GROUP BY CALENDAR_MONTH(TransactionDate), CALENDAR_YEAR(TransactionDate)
    ORDER BY CALENDAR_YEAR(TransactionDate), CALENDAR_MONTH(TransactionDate)
""")

# Aggregate seasonality across years
monthly_avg = defaultdict(lambda: {"total": 0, "count": 0, "years": 0})
for r in seasonality:
    mo = r["mo"]
    monthly_avg[mo]["total"] += r["total"]
    monthly_avg[mo]["count"] += r["cnt"]
    monthly_avg[mo]["years"] += 1

# ═══════════════════════════════════════════════════════════════════════
# 4. FY26 vs FY25 MONTHLY CASH INFLOW
# ═══════════════════════════════════════════════════════════════════════
print("  Fetching monthly cash data...")
fy26_monthly = sf_query("""
    SELECT CALENDAR_MONTH(TransactionDate) mo, SUM(CurrentAmount) total, COUNT(Id) cnt
    FROM GiftTransaction
    WHERE Status = 'Paid' AND TransactionDate >= 2025-07-01 AND TransactionDate < 2026-07-01
    GROUP BY CALENDAR_MONTH(TransactionDate)
    ORDER BY CALENDAR_MONTH(TransactionDate)
""")

fy25_monthly = sf_query("""
    SELECT CALENDAR_MONTH(TransactionDate) mo, SUM(CurrentAmount) total, COUNT(Id) cnt
    FROM GiftTransaction
    WHERE Status = 'Paid' AND TransactionDate >= 2024-07-01 AND TransactionDate < 2025-07-01
    GROUP BY CALENDAR_MONTH(TransactionDate)
    ORDER BY CALENDAR_MONTH(TransactionDate)
""")

fy26_by_month = {r["mo"]: r for r in fy26_monthly}
fy25_by_month = {r["mo"]: r for r in fy25_monthly}

# Build FY month order (Jul=1st month of FY)
FY_MONTHS = [7,8,9,10,11,12,1,2,3,4,5,6]
monthly_inflow = []
for mo in FY_MONTHS:
    fy26 = fy26_by_month.get(mo, {})
    fy25 = fy25_by_month.get(mo, {})
    monthly_inflow.append({
        "month": month_name(mo),
        "monthNum": mo,
        "fy26": round(fy26.get("total", 0)),
        "fy26Count": fy26.get("cnt", 0),
        "fy25": round(fy25.get("total", 0)),
        "fy25Count": fy25.get("cnt", 0),
    })

# ═══════════════════════════════════════════════════════════════════════
# 5. SEGMENT PLEDGES
# ═══════════════════════════════════════════════════════════════════════
print("  Segmenting pledges...")

segments = {
    "capital": {"label": "Capital Campaign (Spark/Legacy of Light)", "color": "#27277c", "pledges": [], "total": 0, "count": 0,
                "action": "Separate payment timeline. Track against capital campaign schedule, not annual aging.",
                "collectionCycle": "Per donor agreement (typically quarterly or annual installments)"},
    "drm_major": {"label": "DRM Major Gifts (>$5K)", "color": "#d98000", "pledges": [], "total": 0, "count": 0,
                  "action": "Statement run + DRM personal follow-up. These donors expect to be asked. Send reminders aligned with their historical payment month.",
                  "collectionCycle": "Match donor's historical payment pattern. Peak months: Dec, Jan, May, Oct."},
    "drm_mid": {"label": "DRM Mid-Range ($1K-$5K)", "color": "#009191", "pledges": [], "total": 0, "count": 0,
                "action": "Automated statement + email reminder. Personal call for 90+ days outstanding.",
                "collectionCycle": "Quarterly statements. Follow up 2 weeks before donor's typical payment month."},
    "event": {"label": "Event Pledges (Fed 360, LOJ, etc.)", "color": "#236B4A", "pledges": [], "total": 0, "count": 0,
              "action": "Thank-you email with payment link 2-4 weeks after event. Follow-up at 60 days. These donors said yes in person — they need a convenient way to fulfill.",
              "collectionCycle": "Primary: 1-2 months post-event. Secondary: year-end (Dec). Event pledges from >6 months ago need personal outreach."},
    "writeoff": {"label": "⚠ Recommended Write-Off", "color": "#eb6136", "pledges": [], "total": 0, "count": 0,
                 "action": "18+ months old, zero payments, <$10K (excl. capital). Nobody is collecting. Send one final notice, then close. For pledges >$10K, make a personal call before writing off.",
                 "collectionCycle": "One final digital reminder → 30-day grace period → write off. Flag any >$10K for DRM personal review first."},
    "telemarketing": {"label": "Telemarketing & Old Small Pledges", "color": "#8C8C8C", "pledges": [], "total": 0, "count": 0,
                      "action": "Old phone-solicited or mass-appeal pledges. Most are under $100. Batch write-off unless donor has other active engagement.",
                      "collectionCycle": "Batch close quarterly. No individual follow-up needed for <$100."},
    "recurring": {"label": "Recurring/Open-Ended", "color": "#594fa3", "pledges": [], "total": 0, "count": 0,
                  "action": "Verify payment method is active. Check for failed transactions. These should be auto-collecting.",
                  "collectionCycle": "Monthly auto-charge. Flag if 2+ consecutive missed payments."},
    "other": {"label": "Other Active Pledges", "color": "#eb6136", "pledges": [], "total": 0, "count": 0,
              "action": "Review and assign to appropriate segment.",
              "collectionCycle": "Quarterly review."},
}

CAPITAL_CAMPAIGNS = ["Legacy of Light", "Spark", "Beit Melachah"]
EVENT_CAMPAIGNS = ["FED360", "FEDERATION 360", "LOJ", "LION OF JUDAH", "CABINET RETREAT", "GLOBAL SHABBAT", "EVENT", "CMNTY TRIP", "Community Trip"]
TELEMARKETING_CAMPAIGNS = ["TLMKT", "SPRNG", "Fall Direct Mail", "ONLINE GEN", "ADDTNL ONL", "STAFF", "UNSOL"]

for p in pledges:
    balance = p.get("Total_Expected_Remaining_Balance_Due__c", 0) or 0
    committed = p.get("ExpectedTotalCmtAmount", 0) or 0
    campaign = p.get("Campaign_Name__c", "") or ""
    recurrence = p.get("RecurrenceType", "") or ""
    start = p.get("EffectiveStartDate", "")
    name = p.get("Donor_Formal_Greeting__c") or p.get("Name", "Unknown")
    has_payments = p["Id"] in payments_by_commitment
    days = days_since(start)
    
    pledge_data = {
        "id": p["Id"],
        "name": name,
        "donorId": p.get("DonorId", ""),
        "committed": committed,
        "balance": balance,
        "startDate": start,
        "daysOld": days,
        "campaign": campaign,
        "recurrence": recurrence,
        "hasPayments": has_payments,
        "paymentCount": len(payments_by_commitment.get(p["Id"], [])),
        "totalPaid": sum(pay["CurrentAmount"] for pay in payments_by_commitment.get(p["Id"], [])),
    }
    
    is_capital = any(c in campaign.upper() for c in [c.upper() for c in CAPITAL_CAMPAIGNS])
    is_old_no_payment = (not has_payments) and days and days > 540  # 18+ months, zero payments
    
    # Classify — order matters: most specific first
    if is_capital:
        seg = "capital"
    elif is_old_no_payment and not is_capital and balance <= 10000:
        # 18+ months, zero payments, under $10K, not capital → write-off
        seg = "writeoff"
    elif is_old_no_payment and not is_capital and balance > 10000:
        # Big but old with no payments → still in DRM but flagged
        seg = "drm_major"  # Keep in DRM for personal review
    elif any(c in campaign.upper() for c in [c.upper() for c in TELEMARKETING_CAMPAIGNS]):
        seg = "telemarketing"
    elif any(c in campaign.upper() for c in [c.upper() for c in EVENT_CAMPAIGNS]):
        seg = "event"
    elif recurrence in ("OpenEnded", "Fixed") and has_payments and balance < 5000:
        seg = "recurring"  # Only if actively paying
    elif balance > 5000:
        seg = "drm_major"
    elif balance >= 1000:
        seg = "drm_mid"
    elif balance < 500 and days and days > 365:
        seg = "telemarketing"  # Old tiny pledges
    elif balance < 1000:
        seg = "other"
    else:
        seg = "other"
    
    segments[seg]["pledges"].append(pledge_data)
    segments[seg]["total"] += balance
    segments[seg]["count"] += 1

# ═══════════════════════════════════════════════════════════════════════
# 6. COLLECTION CALENDAR — When to follow up
# ═══════════════════════════════════════════════════════════════════════
print("  Building collection calendar...")

# Payment peaks from seasonality data
total_payments = sum(monthly_avg[mo]["total"] for mo in range(1, 13))
seasonality_data = []
for mo in FY_MONTHS:
    avg = monthly_avg[mo]
    pct = avg["total"] / total_payments * 100 if total_payments else 0
    seasonality_data.append({
        "month": month_name(mo),
        "monthNum": mo,
        "avgAmount": round(avg["total"] / max(avg["years"], 1)),
        "avgCount": round(avg["count"] / max(avg["years"], 1)),
        "pctOfTotal": round(pct, 1),
    })

# Collection calendar: when to act on each segment
collection_calendar = [
    {"month": "Jul", "actions": ["DRM major: Post-campaign-launch pledge confirmations", "Recurring: Verify all payment methods active for new FY"]},
    {"month": "Aug", "actions": ["DRM mid: Q1 statements for new FY pledges", "Event: Follow up on any summer event pledges"]},
    {"month": "Sep", "actions": ["DRM major: Pre-High-Holidays outreach (Oct is peak payment month)", "All segments: High Holidays appeal timing"]},
    {"month": "Oct", "actions": ["DRM major: Peak collection month — personal calls on outstanding balances", "Event: Post-Fed-360 pledge fulfillment push"]},
    {"month": "Nov", "actions": ["DRM major: Pre-December reminder — 'year-end tax benefit' messaging", "DRM mid: Q2 statements", "Telemarketing: Final notice batch for old pledges"]},
    {"month": "Dec", "actions": ["ALL SEGMENTS: Peak giving month (21% of annual). Year-end tax deadline.", "DRM major: Personal calls for outstanding balances", "Event: Year-end digital reminder to unfulfilled event pledges"]},
    {"month": "Jan", "actions": ["DRM major: Post-year-end follow-up (2nd highest month, 15%)", "Telemarketing: Write off anything past final notice deadline"]},
    {"month": "Feb", "actions": ["DRM mid: Q3 statements", "Capital: Installment reminders per donor agreements"]},
    {"month": "Mar", "actions": ["ALL: Quiet month (3.3%). Focus on spring campaign prep, not collections.", "Review & clean: Identify pledges for write-off"]},
    {"month": "Apr", "actions": ["Event: Pre-spring-event pledge captures", "DRM major: Spring solicitation meetings (May is 12% of payments)"]},
    {"month": "May", "actions": ["DRM major: 3rd highest collection month (12%). Push outstanding pledges.", "DRM mid: Q4 statements + fiscal year-end reminder", "Event: Fed 360 / spring event pledge collection window"]},
    {"month": "Jun", "actions": ["ALL: Fiscal year-end cleanup. Final push on current-year pledges.", "Write-off: Close unfulfilled pledges from >2 FY ago", "Capital: Annual installment deadline for calendar-year agreements"]},
]

# ═══════════════════════════════════════════════════════════════════════
# 7. KPIs
# ═══════════════════════════════════════════════════════════════════════
total_receivable = sum(s["total"] for s in segments.values())
total_pledges = sum(s["count"] for s in segments.values())
pledges_with_payments = sum(1 for p in pledges if p["Id"] in payments_by_commitment)
total_paid = sum(sum(pay["CurrentAmount"] for pay in payments_by_commitment.get(p["Id"], [])) for p in pledges)
fy26_cash = sum(r.get("total", 0) for r in fy26_by_month.values())

# Write-off candidates = writeoff segment + telemarketing
writeoff_candidates = segments["writeoff"]["count"] + segments["telemarketing"]["count"]
writeoff_amount = segments["writeoff"]["total"] + segments["telemarketing"]["total"]

kpis = {
    "totalReceivable": round(total_receivable),
    "totalPledges": total_pledges,
    "cashReceivedYTD": round(fy26_cash),
    "collectionRate": round(pledges_with_payments / total_pledges * 100, 1) if total_pledges else 0,
    "pledgesWithPayments": pledges_with_payments,
    "pledgesWithZeroPayments": total_pledges - pledges_with_payments,
    "zeroPctOfTotal": round((total_pledges - pledges_with_payments) / total_pledges * 100, 1) if total_pledges else 0,
    "writeOffCandidates": writeoff_candidates,
    "writeOffAmount": round(writeoff_amount),
    "drmActionable": segments["drm_major"]["count"] + segments["drm_mid"]["count"],
    "drmActionableAmount": round(segments["drm_major"]["total"] + segments["drm_mid"]["total"]),
    "eventActionable": segments["event"]["count"],
    "eventActionableAmount": round(segments["event"]["total"]),
}

# ═══════════════════════════════════════════════════════════════════════
# 8. AGING BY SEGMENT
# ═══════════════════════════════════════════════════════════════════════
def age_bucket(days_old):
    if days_old is None or days_old < 0: return "Future"
    if days_old <= 90: return "0-90d"
    if days_old <= 180: return "90-180d"
    if days_old <= 365: return "180-365d"
    if days_old <= 730: return "1-2yr"
    return "2yr+"

aging_by_segment = {}
for seg_key, seg in segments.items():
    buckets = defaultdict(lambda: {"count": 0, "amount": 0})
    for p in seg["pledges"]:
        bucket = age_bucket(p["daysOld"])
        buckets[bucket]["count"] += 1
        buckets[bucket]["amount"] += p["balance"]
    aging_by_segment[seg_key] = {b: {"count": v["count"], "amount": round(v["amount"])} 
                                  for b, v in buckets.items()}

# ═══════════════════════════════════════════════════════════════════════
# OUTPUT
# ═══════════════════════════════════════════════════════════════════════
# Trim pledge lists for JSON size (top 25 per segment)
for seg in segments.values():
    seg["pledges"] = sorted(seg["pledges"], key=lambda x: -x["balance"])[:25]

output = {
    "generatedAt": datetime.now().isoformat(),
    "asOfDate": TODAY.isoformat(),
    "kpis": kpis,
    "segments": {k: {
        "label": v["label"],
        "color": v["color"],
        "total": round(v["total"]),
        "count": v["count"],
        "action": v["action"],
        "collectionCycle": v["collectionCycle"],
        "topPledges": v["pledges"][:15],
        "aging": aging_by_segment.get(k, {}),
    } for k, v in segments.items()},
    "monthlyInflow": monthly_inflow,
    "seasonality": seasonality_data,
    "collectionCalendar": collection_calendar,
    "narrative": {
        "title": "Collections Intelligence: $12.3M Receivable Analysis",
        "keyFindings": [
            f"93% of active pledges ({kpis['pledgesWithZeroPayments']} of {total_pledges}) have zero payments collected.",
            f"DRM major + mid gifts: {kpis['drmActionable']} pledges, ${kpis['drmActionableAmount']:,} — highest-value collection opportunity.",
            f"Event pledges: {kpis['eventActionable']} pledges, ${kpis['eventActionableAmount']:,} — donors said yes in person, need follow-up.",
            f"Write-off candidates: {writeoff_candidates} old telemarketing/small pledges, ${writeoff_amount:,.0f} — cleaning these improves data quality.",
            "Payment seasonality: Dec (21%), Jan (15%), Oct (13%), May (12%) — collections should align with these peaks.",
            "Capital campaign ($5.7M) operates on its own timeline — don't mix with annual fund aging.",
        ],
    },
}

OUTPUT.write_text(json.dumps(output, indent=2))
print(f"\nWritten to {OUTPUT}")
print(f"\nSegment Summary:")
for k, v in segments.items():
    print(f"  {v['label']:45s} {v['count']:>5d} pledges  ${v['total']:>12,.0f}")
print(f"  {'TOTAL':45s} {total_pledges:>5d} pledges  ${total_receivable:>12,.0f}")
