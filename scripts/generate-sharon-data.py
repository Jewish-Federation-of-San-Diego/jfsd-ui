#!/usr/bin/env python3
"""
Generate sharon-donor-health.json for the Donor Health dashboard.
Pulls live data from Salesforce + Stripe + GiveCloud.
Output: public/data/sharon-donor-health.json
"""

import json, os, subprocess, sys, datetime, urllib.request, urllib.parse
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "sharon-donor-health.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")

# ── Helpers ──────────────────────────────────────────────────────────────

def sf(soql: str) -> list:
    """Run SOQL via sf-query.py, return list of records."""
    try:
        result = subprocess.run(
            ["node", SF_QUERY, soql],
            capture_output=True, text=True, timeout=60
        )
        stdout = result.stdout
        # sf-query.js outputs dotenv noise before JSON — find the real JSON object
        # Look for '{"totalSize' or '{"records' patterns, or fall back to last { 
        import re
        m = re.search(r'\{["\s]*"totalSize', stdout)
        if not m:
            m = re.search(r'\{["\s]*"records', stdout)
        if not m:
            # Find last { that starts a valid JSON block
            for i in range(len(stdout) - 1, -1, -1):
                if stdout[i] == '{':
                    try:
                        json.loads(stdout[i:])
                        m = type('M', (), {'start': lambda self: i})()
                        break
                    except:
                        continue
        if not m:
            print(f"SF no JSON in output: {stdout[:300]}", file=sys.stderr)
            return []
        data = json.loads(stdout[m.start():])
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("records", data.get("data", []))
        return []
    except Exception as e:
        print(f"SF query exception: {e}", file=sys.stderr)
        return []


def stripe_get(endpoint: str, params: dict = None) -> dict:
    """Call Stripe API."""
    api_key = os.environ.get("STRIPE_API_KEY", "")
    if not api_key:
        return {}
    url = f"https://api.stripe.com/v1/{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    req = urllib.request.Request(url)
    import base64
    auth = base64.b64encode(f"{api_key}:".encode()).decode()
    req.add_header("Authorization", f"Basic {auth}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"Stripe error: {e}", file=sys.stderr)
        return {}


def stripe_list_all(endpoint: str, params: dict = None, max_pages: int = 10) -> list:
    """Paginate through Stripe list endpoint."""
    params = dict(params or {})
    params["limit"] = 100
    items = []
    for _ in range(max_pages):
        data = stripe_get(endpoint, params)
        batch = data.get("data", [])
        items.extend(batch)
        if not data.get("has_more") or not batch:
            break
        params["starting_after"] = batch[-1]["id"]
    return items


def gc_get(endpoint: str, params: dict = None) -> dict:
    """Call GiveCloud API."""
    api_key = os.environ.get("GIVECLOUD_API_KEY", "")
    if not api_key:
        return {}
    url = f"https://jewishinsandiego.givecloud.co/admin/api/v2/{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"GiveCloud error: {e}", file=sys.stderr)
        return {}


def gc_list_all(endpoint: str, params: dict = None, max_pages: int = 20) -> list:
    """Paginate through GiveCloud."""
    items = []
    for page in range(1, max_pages + 1):
        p = dict(params or {})
        p["per_page"] = 15
        p["page"] = page
        data = gc_get(endpoint, p)
        batch = data.get("data", [])
        items.extend(batch)
        if len(batch) < 15:
            break
    return items


# Test data filtering for GiveCloud
TEST_NAMES = {
    'dwight schrute', 'michael scott', 'leslie knope', 'ron burgundy',
    'harry potter', 'john smith', 'jane doe', 'test user', 'space x'
}

def is_test_gc(c):
    if (c.get('payment_gateway') or '') == 'givecloudtest':
        return True
    if (c.get('card_last4') or '') in ('1111', '0000'):
        return True
    name = f"{c.get('billing_first_name', '')} {c.get('billing_last_name', '')}".strip().lower()
    return name in TEST_NAMES


now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-8)))
today = now.strftime("%Y-%m-%d")
week_ago = (now - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
week_ago_ts = int((now - datetime.timedelta(days=7)).timestamp())

# ── Load secrets ─────────────────────────────────────────────────────────
for env_file in ["stripe.env", "givecloud.env"]:
    path = os.path.expanduser(f"~/.secrets/{env_file}")
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")

print("Collecting data...", file=sys.stderr)

# ══════════════════════════════════════════════════════════════════════════
# 1. Failed Recurring Charges (Stripe)
# ══════════════════════════════════════════════════════════════════════════
print("  → Stripe failed charges...", file=sys.stderr)
failed_charges_raw = stripe_list_all("charges", {
    "status": "failed",
    "created[gte]": week_ago_ts,
})
failed_recurring = []
for ch in failed_charges_raw:
    failed_recurring.append({
        "name": ch.get("billing_details", {}).get("name", "Unknown"),
        "amount": ch.get("amount", 0) / 100,
        "reason": ch.get("failure_message", ch.get("failure_code", "Unknown")),
        "date": datetime.datetime.fromtimestamp(ch["created"]).strftime("%Y-%m-%d"),
    })

# ══════════════════════════════════════════════════════════════════════════
# 2. Refunds Over $100 (Stripe)
# ══════════════════════════════════════════════════════════════════════════
print("  → Stripe refunds...", file=sys.stderr)
refunds_raw = stripe_list_all("refunds", {"created[gte]": week_ago_ts})
refunds_over_100 = []
for r in refunds_raw:
    amt = r.get("amount", 0) / 100
    if amt >= 100:
        # Get charge details for name
        charge = r.get("charge")
        name = "Unknown"
        if isinstance(charge, dict):
            name = charge.get("billing_details", {}).get("name", "Unknown")
        refunds_over_100.append({
            "name": name,
            "amount": amt,
            "date": datetime.datetime.fromtimestamp(r["created"]).strftime("%Y-%m-%d"),
            "reason": r.get("reason", "not_specified"),
        })

# ══════════════════════════════════════════════════════════════════════════
# 3. New Donors This Week (Salesforce)
# ══════════════════════════════════════════════════════════════════════════
print("  → New donors...", file=sys.stderr)
new_donors = sf(f"""
    SELECT Id, Name, First_Gift_Date__c, First_Gift_Amount__c
    FROM Account
    WHERE IsPersonAccount = true
      AND First_Gift_Date__c >= {week_ago}
    ORDER BY First_Gift_Date__c DESC
""")

new_donors_this_week = len(new_donors)

# Group by source — use campaign of first gift
new_donor_gifts = sf(f"""
    SELECT Donor.Name, Campaign.Name, CurrentAmount
    FROM GiftTransaction
    WHERE Status = 'Paid'
      AND Donor.First_Gift_Date__c >= {week_ago}
      AND TransactionDate >= {week_ago}
    ORDER BY TransactionDate DESC
""")

source_map = {}
for g in new_donor_gifts:
    campaign = g.get("Campaign") or {}
    src = (campaign.get("Name") if isinstance(campaign, dict) else None) or "Uncategorized"
    if src not in source_map:
        source_map[src] = {"count": 0, "totalAmount": 0}
    source_map[src]["count"] += 1
    source_map[src]["totalAmount"] += g.get("CurrentAmount", 0) or 0

new_donors_by_source = [
    {"source": k, "count": v["count"], "totalAmount": round(v["totalAmount"], 2)}
    for k, v in sorted(source_map.items(), key=lambda x: -x[1]["totalAmount"])
]

# ══════════════════════════════════════════════════════════════════════════
# 4. First-to-Second Gift Conversions
# ══════════════════════════════════════════════════════════════════════════
print("  → First-to-second conversions...", file=sys.stderr)
conversions_raw = sf("""
    SELECT Donor.Name, COUNT(Id),
           MIN(TransactionDate), MAX(TransactionDate),
           SUM(CurrentAmount)
    FROM GiftTransaction
    WHERE Status = 'Paid' AND Donor.IsPersonAccount = true
    GROUP BY Donor.Name, Donor.Id
    HAVING COUNT(Id) = 2 AND MAX(TransactionDate) = LAST_N_DAYS:7
    ORDER BY MAX(TransactionDate) DESC
""")
first_to_second = []
for r in conversions_raw:
    donor = r.get("Donor", {}) if isinstance(r.get("Donor"), dict) else {}
    first_to_second.append({
        "name": donor.get("Name", r.get("Name", "Unknown")),
        "firstGift": str(r.get("expr0", r.get("MIN(TransactionDate)", ""))),
        "secondGift": str(r.get("expr1", r.get("MAX(TransactionDate)", ""))),
        "amount": r.get("expr2", r.get("SUM(CurrentAmount)", 0)) or 0,
    })

# ══════════════════════════════════════════════════════════════════════════
# 5. New Recurring Donors (GiveCloud + Salesforce)
# ══════════════════════════════════════════════════════════════════════════
print("  → New recurring...", file=sys.stderr)
new_recurring_sf = sf(f"""
    SELECT Donor.Name, ExpectedTotalCmtAmount, RecurrenceType, EffectiveStartDate
    FROM GiftCommitment
    WHERE RecurrenceType != null
      AND Status = 'Active'
      AND EffectiveStartDate >= {week_ago}
    ORDER BY EffectiveStartDate DESC
    LIMIT 50
""")
new_recurring = []
for r in new_recurring_sf:
    donor = r.get("Donor", {}) if isinstance(r.get("Donor"), dict) else {}
    new_recurring.append({
        "name": donor.get("Name", r.get("Name", "Unknown")),
        "amount": r.get("ExpectedTotalCmtAmount", 0) or 0,
        "frequency": r.get("RecurrenceType", "Monthly"),
        "date": str(r.get("EffectiveStartDate", "")),
    })

# ══════════════════════════════════════════════════════════════════════════
# 6. Cancelled Recurring
# ══════════════════════════════════════════════════════════════════════════
print("  → Cancelled recurring...", file=sys.stderr)
cancelled_sf = sf(f"""
    SELECT Donor.Name, ExpectedTotalCmtAmount, LastModifiedDate
    FROM GiftCommitment
    WHERE RecurrenceType != null
      AND (Status = 'Closed' OR Status = 'Cancelled')
      AND LastModifiedDate >= {week_ago}T00:00:00Z
    ORDER BY LastModifiedDate DESC
    LIMIT 50
""")
cancelled_recurring = []
for r in cancelled_sf:
    donor = r.get("Donor", {}) if isinstance(r.get("Donor"), dict) else {}
    cancelled_recurring.append({
        "name": donor.get("Name", r.get("Name", "Unknown")),
        "amount": r.get("ExpectedTotalCmtAmount", 0) or 0,
        "date": str(r.get("LastModifiedDate", ""))[:10],
    })

# ══════════════════════════════════════════════════════════════════════════
# 7. Lapsed Reactivated (FY25 donors who gave again in FY26)
# ══════════════════════════════════════════════════════════════════════════
print("  → Lapsed reactivated...", file=sys.stderr)
lapsed_raw = sf("""
    SELECT Id, Name, Recognition_Amount_FY25__c, Recognition_Amount_FY26__c,
           Last_Gift_Date__c
    FROM Account
    WHERE IsPersonAccount = true
      AND Recognition_Amount_FY25__c > 0
      AND Recognition_Amount_FY26__c > 0
      AND Last_Gift_Date__c = LAST_N_DAYS:7
    ORDER BY Recognition_Amount_FY26__c DESC
    LIMIT 20
""")
lapsed_reactivated = []
for r in lapsed_raw:
    lapsed_reactivated.append({
        "name": r.get("Name", "Unknown"),
        "fy25Amount": r.get("Recognition_Amount_FY25__c", 0) or 0,
        "fy26Amount": r.get("Recognition_Amount_FY26__c", 0) or 0,
    })

# ══════════════════════════════════════════════════════════════════════════
# 8. Milestone Approaching
# ══════════════════════════════════════════════════════════════════════════
print("  → Milestone approaching...", file=sys.stderr)
milestones = [1000, 5000, 10000, 25000, 50000, 100000]
milestone_approaching = []
for m in milestones:
    lower = int(m * 0.8)
    donors = sf(f"""
        SELECT Name, Recognition_Amount_All_Time__c
        FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_All_Time__c >= {lower}
          AND Recognition_Amount_All_Time__c < {m}
        ORDER BY Recognition_Amount_All_Time__c DESC
        LIMIT 5
    """)
    for d in donors:
        milestone_approaching.append({
            "name": d.get("Name", "Unknown"),
            "currentTotal": d.get("Recognition_Amount_All_Time__c", 0) or 0,
            "nextMilestone": m,
            "yearsConsecutive": 0,  # Would need multi-year analysis
        })

# ══════════════════════════════════════════════════════════════════════════
# 9. Data Quality
# ══════════════════════════════════════════════════════════════════════════
print("  → Data quality...", file=sys.stderr)

# Missing campaign on opps
missing_campaign_raw = sf("""
    SELECT COUNT(Id) FROM Opportunity
    WHERE CampaignId = null AND IsClosed = false AND CloseDate >= 2025-07-01
""")
missing_campaign = (missing_campaign_raw[0].get("expr0", 0) if missing_campaign_raw else 0)

# Missing amount
missing_amount_raw = sf("""
    SELECT COUNT(Id) FROM Opportunity
    WHERE Amount = null AND IsClosed = false AND CreatedDate = THIS_FISCAL_YEAR
""")
missing_amount = (missing_amount_raw[0].get("expr0", 0) if missing_amount_raw else 0)

# Overdue opps
overdue_raw = sf("""
    SELECT COUNT(Id) FROM Opportunity
    WHERE IsClosed = false AND CloseDate < TODAY
""")
overdue_opps = (overdue_raw[0].get("expr0", 0) if overdue_raw else 0)

# Large gifts no campaign
large_no_campaign_raw = sf("""
    SELECT COUNT(Id) FROM Opportunity
    WHERE Amount >= 1000 AND CampaignId = null AND CloseDate >= 2025-07-01
""")
large_no_campaign = (large_no_campaign_raw[0].get("expr0", 0) if large_no_campaign_raw else 0)

# Duplicate records
# Use a simpler approach - just count via subquery pattern
dup_raw = sf("""
    SELECT Name, COUNT(Id) FROM Account
    WHERE IsPersonAccount = true AND Name != null
    GROUP BY Name HAVING COUNT(Id) > 1
    ORDER BY COUNT(Id) DESC LIMIT 200
""")
duplicates = len(dup_raw)

# Major donors missing info
major_missing_raw = sf("""
    SELECT COUNT(Id) FROM Account
    WHERE IsPersonAccount = true
      AND Recognition_Amount_FY26__c >= 1000
      AND (PersonEmail = null OR PersonMailingCity = null)
""")
major_missing = (major_missing_raw[0].get("expr0", 0) if major_missing_raw else 0)

# Zero recognition with gifts
zero_recog_raw = sf("""
    SELECT COUNT(Id) FROM Account
    WHERE IsPersonAccount = true
      AND Giving_this_Fiscal_Year__c > 0
      AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null)
""")
zero_recog = (zero_recog_raw[0].get("expr0", 0) if zero_recog_raw else 0)

data_quality = {
    "missingCampaign": missing_campaign,
    "missingAmountOpps": missing_amount,
    "overdueOpps": overdue_opps,
    "largGiftsNoCampaign": large_no_campaign,
    "duplicateRecords": duplicates,
    "majorDonorsMissingInfo": major_missing,
    "zeroRecognitionWithGifts": zero_recog,
}

# Data quality score: weighted scoring
# Each category has a weight; score = 100 * (1 - weighted_penalty)
weights = {
    "missingCampaign": 2, "missingAmountOpps": 2, "overdueOpps": 0.5,
    "largGiftsNoCampaign": 3, "duplicateRecords": 0.3,
    "majorDonorsMissingInfo": 3, "zeroRecognitionWithGifts": 0.2,
}
weighted_issues = sum(data_quality[k] * weights.get(k, 1) for k in data_quality)
# Normalize: 0 issues = 100, 500+ weighted issues = ~30
import math
dq_score = round(max(15, 100 * math.exp(-weighted_issues / 800)), 1)

# ══════════════════════════════════════════════════════════════════════════
# 10. KPIs
# ══════════════════════════════════════════════════════════════════════════
print("  → KPIs...", file=sys.stderr)

# Total donors this week (unique donors with gifts)
donors_week_raw = sf(f"""
    SELECT COUNT_DISTINCT(DonorId) FROM GiftTransaction
    WHERE Status = 'Paid' AND TransactionDate >= {week_ago}
""")
total_donors_week = (donors_week_raw[0].get("expr0", 0) if donors_week_raw else 0)

# Recurring revenue (active commitments)
recurring_rev_raw = sf("""
    SELECT SUM(NextTransactionAmount) FROM GiftCommitment
    WHERE RecurrenceType != null AND Status = 'Active'
""")
recurring_revenue = (recurring_rev_raw[0].get("expr0", 0) if recurring_rev_raw else 0) or 0

# Retention rate: FY25 donors who also gave FY26
fy25_count_raw = sf("""
    SELECT COUNT(Id) FROM Account
    WHERE IsPersonAccount = true AND Recognition_Amount_FY25__c > 0
""")
fy25_count = (fy25_count_raw[0].get("expr0", 0) if fy25_count_raw else 0) or 1

retained_raw = sf("""
    SELECT COUNT(Id) FROM Account
    WHERE IsPersonAccount = true
      AND Recognition_Amount_FY25__c > 0
      AND Recognition_Amount_FY26__c > 0
""")
retained = (retained_raw[0].get("expr0", 0) if retained_raw else 0)
retention_rate = round((retained / max(fy25_count, 1)) * 100, 1)

kpis = {
    "totalDonorsThisWeek": total_donors_week or new_donors_this_week,
    "recurringRevenue": round(recurring_revenue, 2),
    "failedChargesCount": len(failed_recurring),
    "failedChargesAmount": round(sum(f["amount"] for f in failed_recurring), 2),
    "dataQualityScore": dq_score,
    "retentionRate": retention_rate,
}

# ══════════════════════════════════════════════════════════════════════════
# Build output
# ══════════════════════════════════════════════════════════════════════════
output = {
    "asOfDate": now.isoformat(),
    "failedRecurring": failed_recurring,
    "refundsOver100": refunds_over_100,
    "newDonorsBySource": new_donors_by_source,
    "newDonorsThisWeek": new_donors_this_week,
    "firstToSecondConversions": first_to_second,
    "newRecurring": new_recurring,
    "cancelledRecurring": cancelled_recurring,
    "lapsedReactivated": lapsed_reactivated,
    "milestoneApproaching": milestone_approaching,
    "dataQuality": data_quality,
    "kpis": kpis,
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUTPUT, "w") as f:
    json.dump(output, f, indent=2, default=str)

print(f"✅ Written to {OUTPUT}", file=sys.stderr)
print(f"   KPIs: {json.dumps(kpis, indent=2)}", file=sys.stderr)
