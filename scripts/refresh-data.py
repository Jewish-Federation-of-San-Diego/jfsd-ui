#!/usr/bin/env python3
"""
JFSD Dashboard Data Refresh
Pulls fresh data from all source systems and writes JSON files to data/.

Each data source is a separate function that catches its own errors so
one failure doesn't block the rest.

Usage: python3 scripts/refresh-data.py [--source NAME] [--dry-run]
"""

import json
import os
import subprocess
import sqlite3
import sys
import traceback
import re
from datetime import datetime, timedelta
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
CLAWD_DIR = Path.home() / "clawd"

SF_QUERY = CLAWD_DIR / "projects" / "salesforce" / "sf-query.js"
STRIPE_QUERY = CLAWD_DIR / "skills" / "stripe" / "scripts" / "stripe-query.py"
SAGE_DB = CLAWD_DIR / "projects" / "sage-intacct" / "data" / "jfsd-gl.db"
ECOBEE_DB = CLAWD_DIR / "projects" / "ecobee-dashboard" / "data" / "ecobee.db"
RESEARCH_DB = CLAWD_DIR / "research" / "prototype" / "data" / "research.db"
DATA_DUEL_DB = CLAWD_DIR / "projects" / "daily-data-duel" / "state" / "analytics.db"
PROJECTS_MD = CLAWD_DIR / "projects" / "PROJECTS.md"

RAMP_TOKEN_FILE = Path.home() / ".clawdbot" / "ramp_token.json"
RAMP_CREDS_FILE = Path.home() / ".clawdbot" / "ramp.json"
GIVECLOUD_ENV = Path.home() / ".secrets" / "givecloud.env"
STRIPE_ENV = Path.home() / ".secrets" / "stripe.env"

NOW = datetime.now().isoformat(timespec="seconds")
TODAY = datetime.now().strftime("%Y-%m-%d")

# Fiscal year helpers
def current_fy():
    """Return current FY number (e.g. 26 for Jul 2025 - Jun 2026)."""
    now = datetime.now()
    return (now.year % 100) + (1 if now.month >= 7 else 0)

FY = current_fy()
FY_START = f"{2000 + FY - 1}-07-01"
FY_END = f"{2000 + FY}-06-30"
PRIOR_FY_START = f"{2000 + FY - 2}-07-01"

# ── Helpers ────────────────────────────────────────────────────────────────
errors = []

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def write_json(filename, data):
    """Write data dict to DATA_DIR/filename with asOfDate."""
    if "asOfDate" not in data:
        data["asOfDate"] = NOW
    path = DATA_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    log(f"  ✓ Wrote {filename} ({path.stat().st_size:,} bytes)")

def sf_query(soql):
    """Run a SOQL query via sf-query.js, return list of records."""
    result = subprocess.run(
        ["node", str(SF_QUERY), soql],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"sf-query failed: {result.stderr[:500]}")
    output = result.stdout.strip()
    # sf-query.js outputs JSON but dotenv@17.2.3 pollutes stdout with
    # "[dotenv@17.2.3] ..." line before the JSON. Find the first line
    # that starts with { to skip it.
    lines = output.split('\n')
    json_start = 0
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('{') or (stripped.startswith('[') and not stripped.startswith('[dotenv')):
            json_start = idx
            break
    output = '\n'.join(lines[json_start:])
    data = json.loads(output)
    if isinstance(data, dict) and "records" in data:
        return data["records"]
    if isinstance(data, list):
        return data
    return [data] if data else []

def run_stripe(args):
    """Run stripe-query.py with given args, return parsed JSON."""
    cmd = ["python3", str(STRIPE_QUERY)] + args + ["--json"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"stripe-query failed: {result.stderr[:500]}")
    output = result.stdout.strip()
    for i, c in enumerate(output):
        if c in '[{':
            output = output[i:]
            break
    return json.loads(output)

def query_sqlite(db_path, sql, params=None):
    """Run SQL against a SQLite database, return list of dicts."""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(sql, params or []).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def load_env(env_file):
    """Load KEY=VALUE from an env file, return dict."""
    result = {}
    if not env_file.exists():
        return result
    for line in open(env_file):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            result[k.strip()] = v.strip().strip('"').strip("'")
    return result

def ramp_api(endpoint, params=None):
    """Call Ramp API, return JSON. Handles token refresh."""
    import urllib.request
    import urllib.parse
    
    token_data = json.load(open(RAMP_TOKEN_FILE))
    access_token = token_data.get("access_token", "")
    
    url = f"https://api.ramp.com/developer/v1{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "User-Agent": "JFSD-Dashboard/1.0"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        # Ramp sometimes has ANSI escape codes
        raw = re.sub(r'\x1b\[[0-9;]*m', '', raw)
        return json.loads(raw)

def givecloud_api(endpoint, params=None):
    """Call GiveCloud API, return JSON."""
    import urllib.request
    import urllib.parse
    
    env = load_env(GIVECLOUD_ENV)
    token = env.get("GIVECLOUD_API_KEY", "")
    base = "https://jewishfederationofsandiego.givecloud.co/api/v1"
    url = f"{base}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "JFSD-Dashboard/1.0"
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        if raw.strip().startswith('<'):
            raise RuntimeError("GiveCloud returned HTML (maintenance mode?)")
        return json.loads(raw)

def safe_run(name, func):
    """Run a data refresh function, catching and logging errors."""
    try:
        log(f"→ {name}")
        func()
    except Exception as e:
        msg = f"✗ {name}: {e}"
        log(msg)
        errors.append(msg)
        traceback.print_exc()


# ══════════════════════════════════════════════════════════════════════════
# DATA SOURCE FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════

# ── Salesforce Sources ─────────────────────────────────────────────────────

def refresh_campaign_tracker():
    """Annual Campaign recognition, weekly momentum, top donors."""
    fy = FY
    
    # Overall campaign totals from recognition
    recs = sf_query(f"""
        SELECT COUNT(Id) donorCount,
               SUM(Recognition_Amount_FY{fy}__c) raised,
               AVG(Recognition_Amount_FY{fy}__c) avgGift
        FROM Account
        WHERE Recognition_Amount_FY{fy}__c > 0
          AND IsPersonAccount = true
    """)
    summary = recs[0] if recs else {}
    
    # Prior year same field for comparison
    prior = sf_query(f"""
        SELECT SUM(Recognition_Amount_FY{fy-1}__c) raised
        FROM Account
        WHERE Recognition_Amount_FY{fy-1}__c > 0
          AND IsPersonAccount = true
    """)
    
    # Giving levels breakdown — SOQL doesn't support CASE WHEN, use separate range queries
    level_ranges = [
        ("Lion of Judah / King David ($100K+)", 100000, None),
        ("Pacesetters ($25K-$99K)", 25000, 100000),
        ("Builders ($10K-$24K)", 10000, 25000),
        ("Pillars ($5K-$9K)", 5000, 10000),
        ("Community ($1K-$4K)", 1000, 5000),
        ("Friends (Under $1K)", 0.01, 1000),
    ]
    levels = []
    for label, lo, hi in level_ranges:
        hi_clause = f" AND Recognition_Amount_FY{fy}__c < {hi}" if hi else ""
        row = sf_query(f"""
            SELECT COUNT(Id) donorCount, SUM(Recognition_Amount_FY{fy}__c) total
            FROM Account
            WHERE Recognition_Amount_FY{fy}__c >= {lo}{hi_clause}
              AND IsPersonAccount = true
        """)
        if row and (row[0].get("donorCount") or 0) > 0:
            levels.append({"level": label, "donorCount": row[0]["donorCount"], "total": row[0]["total"]})
    
    # Top gifts this week (by transaction date)
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    top_gifts = sf_query(f"""
        SELECT Donor.Name, CurrentAmount, TransactionDate, Campaign.Name
        FROM GiftTransaction
        WHERE TransactionDate >= {week_ago}
          AND CurrentAmount > 0
        ORDER BY CurrentAmount DESC
        LIMIT 10
    """)
    
    # Weekly momentum (last 8 weeks of new transactions)
    momentum = []
    for w in range(8):
        start = (datetime.now() - timedelta(weeks=w+1)).strftime("%Y-%m-%d")
        end = (datetime.now() - timedelta(weeks=w)).strftime("%Y-%m-%d")
        wk = sf_query(f"""
            SELECT COUNT(Id) cnt, SUM(CurrentAmount) total
            FROM GiftTransaction
            WHERE TransactionDate >= {start}
              AND TransactionDate < {end}
              AND CurrentAmount > 0
        """)
        if wk:
            momentum.append({
                "weekEnding": end,
                "gifts": wk[0].get("cnt", 0),
                "amount": wk[0].get("total", 0)
            })
    
    # Campaigns
    campaigns = sf_query(f"""
        SELECT Name, AmountWonOpportunities, NumberOfContacts,
               Status, StartDate, EndDate
        FROM Campaign
        WHERE IsActive = true
        ORDER BY AmountWonOpportunities DESC NULLS LAST
        LIMIT 20
    """)
    
    raised = float(summary.get("raised") or 0)
    goal = 9000000  # Annual Campaign goal
    
    write_json("campaign-tracker.json", {
        "annualCampaign": {
            "name": f"Annual Campaign {fy}",
            "goal": goal,
            "raised": raised,
            "pctOfGoal": round(raised / goal * 100, 1) if goal else 0,
            "donorCount": int(summary.get("donorCount") or 0),
            "avgGift": round(float(summary.get("avgGift") or 0), 0),
            "priorYearSamePoint": float(prior[0].get("raised") or 0) if prior else 0
        },
        "momentum": {
            "thisWeek": momentum[0] if momentum else {},
            "lastWeek": momentum[1] if len(momentum) > 1 else {}
        },
        "weeklyMomentum": list(reversed(momentum)),
        "donorBreakdown": {
            "new": 0,  # Would need more complex query
            "returning": 0,
            "upgraded": 0,
            "downgraded": 0
        },
        "givingLevels": levels,
        "topGiftsThisWeek": top_gifts,
        "pipeline": {},
        "campaigns": campaigns
    })


def refresh_drm_portfolio():
    """DRM portfolio assignments and recognition."""
    fy = FY
    drms = sf_query(f"""
        SELECT OwnerId, Owner.Name,
               COUNT(Id) portfolioSize,
               SUM(Recognition_Amount_FY{fy}__c) totalRaised,
               SUM(Recognition_Amount_FY{fy-1}__c) priorYear
        FROM Account
        WHERE Owner.Profile.Name = 'Fundraiser'
          AND IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c > 0
        GROUP BY OwnerId, Owner.Name
        ORDER BY SUM(Recognition_Amount_FY{fy}__c) DESC
    """)
    
    # If the profile filter doesn't work, fall back to a simpler query
    if not drms:
        drms = sf_query(f"""
            SELECT OwnerId, Owner.Name,
                   COUNT(Id) portfolioSize,
                   SUM(Recognition_Amount_FY{fy}__c) totalRaised,
                   SUM(Recognition_Amount_FY{fy-1}__c) priorYear
            FROM Account
            WHERE IsPersonAccount = true
              AND Recognition_Amount_FY{fy}__c >= 1000
            GROUP BY OwnerId, Owner.Name
            ORDER BY SUM(Recognition_Amount_FY{fy}__c) DESC
            LIMIT 15
        """)
    
    total_raised = sum(float(d.get("totalRaised") or 0) for d in drms)
    
    write_json("drm-portfolio.json", {
        "drms": drms,
        "kpis": {
            "totalDRMs": len(drms),
            "totalRaised": total_raised,
            "avgPerDRM": round(total_raised / len(drms), 0) if drms else 0
        }
    })


def refresh_pledge_management():
    """GiftCommitment pledges — open, aging, payments."""
    pledges = sf_query(f"""
        SELECT Id, Donor.Name, ExpectedTotalCmtAmount, TotalPaidTransactionAmount,
               Total_Expected_Remaining_Balance_Due__c, EffectiveStartDate, ExpectedEndDate,
               Status, Campaign.Name
        FROM GiftCommitment
        WHERE Status IN ('Active', 'PartiallyPaid')
        ORDER BY Total_Expected_Remaining_Balance_Due__c DESC NULLS LAST
        LIMIT 100
    """)
    
    # Summary stats
    total_committed = sum(float(p.get("ExpectedTotalCmtAmount") or 0) for p in pledges)
    total_paid = sum(float(p.get("TotalPaidTransactionAmount") or 0) for p in pledges)
    total_balance = sum(float(p.get("Total_Expected_Remaining_Balance_Due__c") or 0) for p in pledges)
    
    # Aging buckets
    buckets = {"current": 0, "30_60": 0, "60_90": 0, "over_90": 0}
    now = datetime.now()
    for p in pledges:
        end = p.get("ExpectedEndDate")
        if not end:
            continue
        try:
            end_dt = datetime.strptime(end[:10], "%Y-%m-%d")
            days_past = (now - end_dt).days
            bal = float(p.get("Total_Expected_Remaining_Balance_Due__c") or 0)
            if days_past <= 0:
                buckets["current"] += bal
            elif days_past <= 60:
                buckets["30_60"] += bal
            elif days_past <= 90:
                buckets["60_90"] += bal
            else:
                buckets["over_90"] += bal
        except:
            pass
    
    # Recent payments
    payments = sf_query(f"""
        SELECT Donor.Name, CurrentAmount, TransactionDate,
               GiftCommitment.ExpectedTotalCmtAmount
        FROM GiftTransaction
        WHERE GiftCommitmentId != null
          AND TransactionDate >= {(datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')}
        ORDER BY TransactionDate DESC
        LIMIT 20
    """)
    
    # By campaign
    by_campaign = sf_query("""
        SELECT Campaign.Name campaignName,
               COUNT(Id) cnt,
               SUM(ExpectedTotalCmtAmount) committed,
               SUM(TotalPaidTransactionAmount) paid,
               SUM(Total_Expected_Remaining_Balance_Due__c) balance
        FROM GiftCommitment
        WHERE Status IN ('Active', 'PartiallyPaid')
        GROUP BY Campaign.Name
        ORDER BY SUM(ExpectedTotalCmtAmount) DESC
    """)
    
    aging_list = [
        {"label": "Current", "amount": buckets["current"]},
        {"label": "30-60 Days", "amount": buckets["30_60"]},
        {"label": "60-90 Days", "amount": buckets["60_90"]},
        {"label": "90+ Days", "amount": buckets["over_90"]}
    ]
    
    # Write-off risk: top pledges with oldest balances
    write_off = [p for p in pledges if float(p.get("Total_Expected_Remaining_Balance_Due__c") or 0) > 5000][:9]
    
    write_json("pledge-management.json", {
        "summary": {
            "totalCommitted": total_committed,
            "totalPaid": total_paid,
            "totalBalance": total_balance,
            "pledgeCount": len(pledges),
            "collectionRate": round(total_paid / total_committed * 100, 1) if total_committed else 0
        },
        "agingBuckets": aging_list,
        "writeOffRisk": write_off,
        "topOpenPledges": pledges[:25],
        "byCampaign": by_campaign,
        "recentPayments": payments,
        "kpis": {
            "totalBalance": total_balance,
            "pledgeCount": len(pledges),
            "collectionRate": round(total_paid / total_committed * 100, 1) if total_committed else 0,
            "over90Amount": buckets["over_90"]
        }
    })


def refresh_data_quality():
    """Record completeness metrics."""
    # SOQL doesn't support SUM(CASE WHEN) — use separate COUNT queries with filters
    total_q = sf_query("""
        SELECT COUNT(Id) total FROM Account
        WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c > 0
    """)
    total_count = int(total_q[0].get("total") or 0) if total_q else 0
    
    email_q = sf_query("""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c > 0 AND PersonEmail != null
    """)
    phone_q = sf_query("""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c > 0
          AND (PersonHomePhone != null OR PersonMobilePhone != null OR Phone != null)
    """)
    addr_q = sf_query("""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c > 0 AND PersonMailingStreet != null
    """)
    bday_q = sf_query("""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c > 0 AND PersonBirthdate != null
    """)
    
    def pct(recs):
        if not total_count or not recs:
            return 0
        return round(int(recs[0].get("cnt") or 0) / total_count * 100)
    
    categories = [
        {"name": "Email", "score": pct(email_q), "icon": "📧"},
        {"name": "Phone", "score": pct(phone_q), "icon": "📱"},
        {"name": "Address", "score": pct(addr_q), "icon": "📍"},
        {"name": "Birthday", "score": pct(bday_q), "icon": "🎂"},
        {"name": "Overall", "score": 0, "icon": "📊"}
    ]
    overall = round(sum(c["score"] for c in categories[:4]) / 4)
    categories[4]["score"] = overall
    
    write_json("data-quality.json", {
        "overallScore": overall,
        "categories": categories,
        "trends": [],
        "kpis": {
            "overallScore": overall,
            "emailPct": categories[0]["score"],
            "phonePct": categories[1]["score"],
            "addressPct": categories[2]["score"]
        }
    })


def refresh_sharon_donor_health():
    """Donor health metrics for Sharon's dashboard."""
    fy = FY
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # New donors this week
    new_donors = sf_query(f"""
        SELECT Donor.Name, CurrentAmount, TransactionDate, Campaign.Name
        FROM GiftTransaction
        WHERE TransactionDate >= {week_ago}
          AND CurrentAmount > 0
        ORDER BY CurrentAmount DESC
        LIMIT 20
    """)
    
    # New donors by source (last 30 days)
    by_source = sf_query(f"""
        SELECT Campaign.Name source, COUNT(Id) cnt, SUM(CurrentAmount) total
        FROM GiftTransaction
        WHERE TransactionDate >= {month_ago}
          AND CurrentAmount > 0
        GROUP BY Campaign.Name
        ORDER BY SUM(CurrentAmount) DESC
        LIMIT 10
    """)
    
    # Failed recurring (GiftCommitment with status issues)
    failed_recurring = sf_query("""
        SELECT Donor.Name, ExpectedTotalCmtAmount, Status, LastModifiedDate
        FROM GiftCommitment
        WHERE Status = 'Failed'
        ORDER BY LastModifiedDate DESC
        LIMIT 20
    """)
    
    # Cancelled recurring
    cancelled = sf_query(f"""
        SELECT Donor.Name, ExpectedTotalCmtAmount, LastModifiedDate
        FROM GiftCommitment
        WHERE Status = 'Cancelled'
          AND LastModifiedDate >= {month_ago}T00:00:00Z

        ORDER BY LastModifiedDate DESC
        LIMIT 50
    """)
    
    # New recurring
    new_recurring = sf_query(f"""
        SELECT Donor.Name, ExpectedTotalCmtAmount, EffectiveStartDate
        FROM GiftCommitment
        WHERE EffectiveStartDate >= {month_ago}
          AND Status = 'Active'
        ORDER BY EffectiveStartDate DESC
        LIMIT 50
    """)
    
    # Milestone approaching (donors near round numbers)
    milestones = sf_query(f"""
        SELECT Name, Recognition_Amount_FY{fy}__c
        FROM Account
        WHERE IsPersonAccount = true
          AND (
            (Recognition_Amount_FY{fy}__c >= 900 AND Recognition_Amount_FY{fy}__c < 1000)
            OR (Recognition_Amount_FY{fy}__c >= 4500 AND Recognition_Amount_FY{fy}__c < 5000)
            OR (Recognition_Amount_FY{fy}__c >= 9000 AND Recognition_Amount_FY{fy}__c < 10000)
            OR (Recognition_Amount_FY{fy}__c >= 23000 AND Recognition_Amount_FY{fy}__c < 25000)
          )
        ORDER BY Recognition_Amount_FY{fy}__c DESC
        LIMIT 30
    """)
    
    # Lapsed reactivated (gave this FY, didn't give last FY, gave FY before)
    reactivated = sf_query(f"""
        SELECT Name, Recognition_Amount_FY{fy}__c,
               Recognition_Amount_FY{fy-2}__c
        FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c > 0
          AND Recognition_Amount_FY{fy-1}__c = 0
          AND Recognition_Amount_FY{fy-2}__c > 0
        ORDER BY Recognition_Amount_FY{fy}__c DESC
        LIMIT 20
    """)
    
    write_json("sharon-donor-health.json", {
        "failedRecurring": failed_recurring,
        "refundsOver100": [],  # Would need Stripe refund data
        "newDonorsBySource": by_source[:5],
        "newDonorsThisWeek": len(new_donors),
        "firstToSecondConversions": [],
        "newRecurring": new_recurring,
        "cancelledRecurring": cancelled,
        "lapsedReactivated": reactivated,
        "milestoneApproaching": milestones,
        "dataQuality": {},
        "kpis": {
            "newDonorsThisWeek": len(new_donors),
            "failedRecurring": len(failed_recurring),
            "cancelledRecurring": len(cancelled),
            "newRecurring": len(new_recurring),
            "reactivated": len(reactivated)
        }
    })


def refresh_silence_alerts():
    """Donors who have gone silent — gave in prior years but not this year."""
    fy = FY
    donors = sf_query(f"""
        SELECT Name, Recognition_Amount_FY{fy-1}__c,
               Recognition_Amount_FY{fy-2}__c,
               PersonEmail, Phone, OwnerId, Owner.Name
        FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c = 0
          AND Recognition_Amount_FY{fy-1}__c > 0
        ORDER BY Recognition_Amount_FY{fy-1}__c DESC
        LIMIT 500
    """)
    
    revenue_at_risk = sum(float(d.get(f"Recognition_Amount_FY{FY-1}__c") or 0) for d in donors)
    
    # Tier breakdown
    tiers = {}
    for d in donors:
        amt = float(d.get(f"Recognition_Amount_FY{FY-1}__c") or 0)
        if amt >= 25000:
            tier = "Major ($25K+)"
        elif amt >= 5000:
            tier = "Mid-Level ($5K-$25K)"
        elif amt >= 1000:
            tier = "Core ($1K-$5K)"
        else:
            tier = "Community (<$1K)"
        if tier not in tiers:
            tiers[tier] = {"tier": tier, "count": 0, "amount": 0}
        tiers[tier]["count"] += 1
        tiers[tier]["amount"] += amt
    
    write_json("silence-alerts.json", {
        "count": len(donors),
        "revenueAtRisk": revenue_at_risk,
        "byTier": list(tiers.values()),
        "donors": donors,
        "kpis": {
            "silentDonors": len(donors),
            "revenueAtRisk": revenue_at_risk,
            "majorSilent": tiers.get("Major ($25K+)", {}).get("count", 0)
        }
    })


def refresh_weekly_ask_list():
    """Ask list prospects — donors with capacity to upgrade."""
    fy = FY
    # SOQL can't compare two fields — pull prior year donors and filter in Python
    donors_raw = sf_query(f"""
        SELECT Name, Recognition_Amount_FY{fy}__c,
               Recognition_Amount_FY{fy-1}__c,
               P2G_Score__c, Gift_Capacity_Range__c,
               PersonEmail, Phone, OwnerId, Owner.Name
        FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy-1}__c > 1000
        ORDER BY Recognition_Amount_FY{fy-1}__c DESC
        LIMIT 200
    """)
    # Filter to those who gave less this year than last (upgrade potential)
    donors = [d for d in donors_raw
              if float(d.get(f"Recognition_Amount_FY{fy-1}__c") or 0) >
                 float(d.get(f"Recognition_Amount_FY{fy}__c") or 0)][:50]
    
    cap_field = f"Recognition_Amount_FY{FY-1}__c"
    cur_field = f"Recognition_Amount_FY{FY}__c"
    total_potential = sum(
        float(d.get(cap_field) or 0) - float(d.get(cur_field) or 0)
        for d in donors
    )
    
    # Priority bucketing
    high = [d for d in donors if float(d.get(cap_field) or 0) >= 25000]
    med = [d for d in donors if 5000 <= float(d.get(cap_field) or 0) < 25000]
    low = [d for d in donors if float(d.get(cap_field) or 0) < 5000]
    
    write_json("weekly-ask-list.json", {
        "totalPotentialRevenue": int(total_potential),
        "totalProspects": len(donors),
        "byPriority": [
            {"priority": "High", "count": len(high), "potential": sum(float(d.get(cap_field) or 0) for d in high)},
            {"priority": "Medium", "count": len(med), "potential": sum(float(d.get(cap_field) or 0) for d in med)},
            {"priority": "Low", "count": len(low), "potential": sum(float(d.get(cap_field) or 0) for d in low)}
        ],
        "donors": donors,
        "kpis": {
            "totalProspects": len(donors),
            "totalPotentialRevenue": int(total_potential),
            "highPriority": len(high)
        }
    })


def refresh_board_reporting():
    """Board member giving and campaign summary."""
    fy = FY
    
    # Board members — assumes a tag or record type
    boards = sf_query(f"""
        SELECT Name, Recognition_Amount_FY{fy}__c,
               Recognition_Amount_FY{fy-1}__c,
               JFSD_Board_Active__c
        FROM Account
        WHERE IsPersonAccount = true
          AND JFSD_Board_Active__c = true
        ORDER BY Recognition_Amount_FY{fy}__c DESC NULLS LAST
    """)
    
    # If JFSD_Board_Active__c doesn't exist, try a Campaign membership approach
    if not boards:
        boards = sf_query(f"""
            SELECT Name, Recognition_Amount_FY{fy}__c,
                   Recognition_Amount_FY{fy-1}__c
            FROM Account
            WHERE IsPersonAccount = true
              AND Id IN (
                  SELECT ContactId FROM CampaignMember
                  WHERE Campaign.Name LIKE '%Board%'
              )
            ORDER BY Recognition_Amount_FY{fy}__c DESC NULLS LAST
        """)
    
    total_giving = sum(float(b.get(f"Recognition_Amount_FY{FY}__c") or 0) for b in boards)
    participation = len([b for b in boards if float(b.get(f"Recognition_Amount_FY{FY}__c") or 0) > 0])
    
    campaign_summary = {
        "raised": sum(float(b.get(f"Recognition_Amount_FY{FY}__c") or 0) for b in boards),
        "participationRate": round(participation / len(boards) * 100, 1) if boards else 0,
        "totalMembers": len(boards),
        "donors": participation
    }
    
    # Giving levels for board
    level_thresholds = [100000, 25000, 10000, 5000, 1000, 0]
    level_names = ["$100K+", "$25K-$99K", "$10K-$24K", "$5K-$9K", "$1K-$4K", "Under $1K"]
    giving_levels = []
    for i, (threshold, name) in enumerate(zip(level_thresholds, level_names)):
        upper = level_thresholds[i-1] if i > 0 else float('inf')
        count = len([b for b in boards if threshold <= float(b.get(f"Recognition_Amount_FY{FY}__c") or 0) < upper])
        if count > 0:
            giving_levels.append({"level": name, "count": count})
    
    write_json("board-reporting.json", {
        "boards": [
            {"name": "Board of Directors", "members": boards[:50]},
            {"name": "Foundation Board", "members": []},
            {"name": "Young Adult Division", "members": []}
        ],
        "campaignSummary": campaign_summary,
        "givingLevels": giving_levels,
        "highlights": [],
        "kpis": {
            "boardMembers": len(boards),
            "participationRate": campaign_summary["participationRate"],
            "totalGiving": total_giving
        }
    })


def refresh_donor_lifecycle():
    """Donor lifecycle distribution and LYBUNT risk."""
    fy = FY
    
    # Count donors by lifecycle stage
    # New: gave FY26, not FY25
    new = sf_query(f"""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c > 0
          AND Recognition_Amount_FY{fy-1}__c = 0
    """)
    
    # Retained: gave both years
    retained = sf_query(f"""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c > 0
          AND Recognition_Amount_FY{fy-1}__c > 0
    """)
    
    # LYBUNT: gave last year, not this year
    lybunt = sf_query(f"""
        SELECT COUNT(Id) cnt, SUM(Recognition_Amount_FY{fy-1}__c) atRisk
        FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c = 0
          AND Recognition_Amount_FY{fy-1}__c > 0
    """)
    
    # Reactivated: gave this year, skipped last, gave 2 years ago
    reactivated = sf_query(f"""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c > 0
          AND Recognition_Amount_FY{fy-1}__c = 0
          AND Recognition_Amount_FY{fy-2}__c > 0
    """)
    
    # Deep lapsed: no gift in 2+ years
    deep_lapsed = sf_query(f"""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c = 0
          AND Recognition_Amount_FY{fy-1}__c = 0
          AND Recognition_Amount_FY{fy-2}__c > 0
    """)
    
    def val(recs, field="cnt"):
        return int(recs[0].get(field) or 0) if recs else 0
    
    distribution = [
        {"stage": "New", "count": val(new)},
        {"stage": "Retained", "count": val(retained)},
        {"stage": "LYBUNT", "count": val(lybunt)},
        {"stage": "Reactivated", "count": val(reactivated)},
        {"stage": "Deep Lapsed", "count": val(deep_lapsed)}
    ]
    
    total_active = val(new) + val(retained) + val(reactivated)
    
    write_json("donor-lifecycle.json", {
        "summary": {
            "totalActive": total_active,
            "newDonors": val(new),
            "retainedDonors": val(retained),
            "lybuntCount": val(lybunt),
            "lybuntRevenue": float(lybunt[0].get("atRisk") or 0) if lybunt else 0
        },
        "lifecycleDistribution": distribution,
        "lybuntRisk": {
            "count": val(lybunt),
            "revenueAtRisk": float(lybunt[0].get("atRisk") or 0) if lybunt else 0
        },
        "migrationPatterns": {},
        "prospectSegmentation": {},
        "fy27Scenarios": {}
    })


def refresh_retention_analysis():
    """Retention flows and segment retention rates."""
    fy = FY
    
    # Overall retention rate
    gave_last = sf_query(f"""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true AND Recognition_Amount_FY{fy-1}__c > 0
    """)
    gave_both = sf_query(f"""
        SELECT COUNT(Id) cnt FROM Account
        WHERE IsPersonAccount = true
          AND Recognition_Amount_FY{fy}__c > 0
          AND Recognition_Amount_FY{fy-1}__c > 0
    """)
    
    def val(r):
        return int(r[0].get("cnt") or 0) if r else 0
    
    retention_rate = round(val(gave_both) / val(gave_last) * 100, 1) if val(gave_last) else 0
    
    write_json("retention-analysis.json", {
        "summary": {
            "overallRetention": retention_rate,
            "priorYearDonors": val(gave_last),
            "retained": val(gave_both),
            "lapsed": val(gave_last) - val(gave_both)
        },
        "sankeyData": {
            "nodes": ["FY{} Donors".format(fy-1), "Retained", "Lapsed", "New FY{}".format(fy)],
            "links": []
        },
        "retentionFlows": [],
        "segmentRetention": {}
    })


def refresh_cohort_survival():
    """Cohort survival curves — placeholder with basic data."""
    write_json("cohort-survival.json", {
        "summary": {"note": "Cohort analysis requires historical transaction data processing"},
        "cohortSurvivalCurves": [],
        "retentionByYear": [],
        "cohortComparison": [],
        "heatmapData": {},
        "scenarioModeling": {}
    })


def refresh_mortality_model():
    """Mortality model — placeholder."""
    write_json("mortality-model.json", {
        "summary": {"note": "Mortality model requires actuarial data and age demographics"},
        "ageDistribution": [],
        "attritionProjections": [],
        "revenueImpact": [],
        "demographicCliff": {},
        "plannedGivingOpportunities": {},
        "acquisitionNeeded": {}
    })


# ── Research DB Sources ────────────────────────────────────────────────────

def refresh_prospect_research():
    """Prospect profiles from research.db."""
    if not RESEARCH_DB.exists():
        log("  ⚠ research.db not found, skipping")
        return
    
    profiles = query_sqlite(RESEARCH_DB, """
        SELECT p.name, p.sf_account_id, p.we_gift_capacity_max AS estimated_capacity,
               p.recognition_fy26 AS current_giving, p.we_p2g_score AS p2g_score,
               p.segment AS research_status, p.created_at AS last_updated
        FROM prospect_master p
        ORDER BY p.we_gift_capacity_max DESC
        LIMIT 100
    """)
    
    # Capacity gap analysis
    giving_vs_capacity = []
    for p in profiles:
        cap = float(p.get("estimated_capacity") or 0)
        giving = float(p.get("current_giving") or 0)
        if cap > 0:
            ratio = giving / cap if cap else 0
            bucket = (
                "0-10%" if ratio < 0.1 else
                "10-25%" if ratio < 0.25 else
                "25-50%" if ratio < 0.5 else
                "50-75%" if ratio < 0.75 else
                "75-100%" if ratio < 1.0 else
                "100%+"
            )
            for b in giving_vs_capacity:
                if b["bucket"] == bucket:
                    b["count"] += 1
                    break
            else:
                giving_vs_capacity.append({"bucket": bucket, "count": 1})
    
    upgrade_prospects = [p for p in profiles if float(p.get("estimated_capacity") or 0) > float(p.get("current_giving") or 0) * 2][:50]
    major_pipeline = [p for p in profiles if float(p.get("estimated_capacity") or 0) >= 25000][:47]
    
    total_capacity_gap = sum(
        float(p.get("estimated_capacity") or 0) - float(p.get("current_giving") or 0)
        for p in profiles
        if float(p.get("estimated_capacity") or 0) > float(p.get("current_giving") or 0)
    )
    
    write_json("prospect-research.json", {
        "totalProfiled": len(profiles),
        "capacityGap": int(total_capacity_gap),
        "upgradeProspects": upgrade_prospects,
        "majorDonorPipeline": major_pipeline,
        "givingVsCapacity": giving_vs_capacity,
        "trajectoryAnalysis": profiles,
        "kpis": {
            "totalProfiled": len(profiles),
            "capacityGap": int(total_capacity_gap),
            "majorPipeline": len(major_pipeline)
        }
    })


def refresh_wealthengine():
    """WealthEngine data from research.db."""
    if not RESEARCH_DB.exists():
        log("  ⚠ research.db not found, skipping")
        return
    
    # Check if wealth_engine table exists
    tables = query_sqlite(RESEARCH_DB, "SELECT name FROM sqlite_master WHERE type='table'")
    table_names = [t["name"] for t in tables]
    
    if "wealth_engine" not in table_names:
        log("  ⚠ wealth_engine table not found")
        write_json("wealthengine.json", {"kpis": {}, "netWorthDistribution": [], "giftCapacityDistribution": [], "p2gDistribution": [], "topProspects": []})
        return
    
    # Net worth distribution
    nw_dist = query_sqlite(RESEARCH_DB, """
        SELECT net_worth AS range, COUNT(*) AS count
        FROM wealth_engine
        WHERE net_worth IS NOT NULL
        GROUP BY net_worth
        ORDER BY count DESC
    """)
    
    # Gift capacity
    gc_dist = query_sqlite(RESEARCH_DB, """
        SELECT gift_capacity AS range, COUNT(*) AS count
        FROM wealth_engine
        WHERE gift_capacity IS NOT NULL
        GROUP BY gift_capacity
        ORDER BY count DESC
    """)
    
    # P2G scores
    p2g_dist = query_sqlite(RESEARCH_DB, """
        SELECT p2g_score as score, COUNT(*) as count
        FROM wealth_engine
        WHERE p2g_score IS NOT NULL
        GROUP BY p2g_score
        ORDER BY count DESC
    """)
    
    # Top prospects
    top = query_sqlite(RESEARCH_DB, """
        SELECT full_name AS name, net_worth, gift_capacity, p2g_score,
               gift_capacity_max AS estimated_capacity
        FROM wealth_engine
        ORDER BY gift_capacity_max DESC
        LIMIT 50
    """)
    
    write_json("wealthengine.json", {
        "kpis": {
            "totalScreened": sum(d["count"] for d in nw_dist) if nw_dist else 0,
            "highCapacity": len([t for t in top if float(t.get("estimated_capacity") or 0) >= 100000])
        },
        "netWorthDistribution": nw_dist,
        "giftCapacityDistribution": gc_dist,
        "p2gDistribution": p2g_dist,
        "topProspects": top
    })


def refresh_nonprofit_boards():
    """Nonprofit board affiliations from research.db."""
    if not RESEARCH_DB.exists():
        log("  ⚠ research.db not found, skipping")
        return
    
    tables = query_sqlite(RESEARCH_DB, "SELECT name FROM sqlite_master WHERE type='table'")
    table_names = [t["name"] for t in tables]
    
    orgs = []
    sf_matches = []
    
    if "nonprofits" in table_names and "nonprofit_people" in table_names:
        orgs = query_sqlite(RESEARCH_DB, """
            SELECT n.name, n.ein, n.total_revenue AS revenue, n.total_assets AS assets,
                   COUNT(np.id) AS board_members
            FROM nonprofits n
            LEFT JOIN nonprofit_people np ON np.org_ein = n.ein
            GROUP BY n.ein
            ORDER BY n.total_revenue DESC
            LIMIT 30
        """)
        sf_matches = query_sqlite(RESEARCH_DB, """
            SELECT np.name, np.title AS role, n.name AS org_name,
                   np.sf_contact_id AS sf_account_id
            FROM nonprofit_people np
            JOIN nonprofits n ON np.org_ein = n.ein
            WHERE np.sf_contact_id IS NOT NULL
            ORDER BY n.total_revenue DESC
            LIMIT 50
        """)
    
    write_json("nonprofit-boards.json", {
        "kpis": {
            "organizations": len(orgs),
            "sfMatches": len(sf_matches)
        },
        "organizations": orgs,
        "sfMatches": sf_matches
    })


# ── Ecobee / Facilities ───────────────────────────────────────────────────

def refresh_facilities():
    """Current thermostat status from Ecobee."""
    if not ECOBEE_DB.exists():
        log("  ⚠ ecobee.db not found, skipping")
        return
    
    # Get latest readings per thermostat
    buildings = query_sqlite(ECOBEE_DB, """
        SELECT group_name as building,
               name,
               temperature / 10.0 as temp_f,
               humidity,
               hvac_mode,
               fan_running,
               timestamp
        FROM readings
        WHERE timestamp = (SELECT MAX(timestamp) FROM readings)
        OR timestamp >= datetime('now', '-1 hour')
        GROUP BY thermostat_id
        ORDER BY group_name, name
    """)
    
    # Group by building
    building_map = {}
    for r in buildings:
        bldg = r.get("building", "Unknown")
        if bldg not in building_map:
            building_map[bldg] = {"name": bldg, "zones": [], "alerts": []}
        building_map[bldg]["zones"].append(r)
    
    write_json("facilities.json", {
        "buildings": list(building_map.values()),
        "alerts": [],
        "kpis": {
            "buildings": len(building_map),
            "zones": len(buildings),
            "alerts": 0
        }
    })


def refresh_ecobee_trends():
    """Historical ecobee data for trends."""
    if not ECOBEE_DB.exists():
        log("  ⚠ ecobee.db not found, skipping")
        return
    
    # Daily averages by building for last 28 days
    daily = query_sqlite(ECOBEE_DB, """
        SELECT group_name as building,
               DATE(timestamp) as date,
               AVG(temperature / 10.0) as avg_temp,
               AVG(humidity) as avg_humidity,
               COUNT(*) as readings
        FROM readings
        WHERE timestamp >= datetime('now', '-28 days')
        GROUP BY group_name, DATE(timestamp)
        ORDER BY date
    """)
    
    # Server room readings (if applicable)
    server_rooms = query_sqlite(ECOBEE_DB, """
        SELECT name,
               DATE(timestamp) as date,
               AVG(temperature / 10.0) as avg_temp,
               MAX(temperature / 10.0) as max_temp,
               MIN(temperature / 10.0) as min_temp
        FROM readings
        WHERE name LIKE '%Server%' OR name LIKE '%IT%'
          AND timestamp >= datetime('now', '-28 days')
        GROUP BY name, DATE(timestamp)
        ORDER BY date
    """)
    
    write_json("ecobee-trends.json", {
        "dateRange": {
            "start": (datetime.now() - timedelta(days=28)).strftime("%Y-%m-%dT00:00:00"),
            "end": TODAY
        },
        "buildingDaily": daily,
        "serverRooms": server_rooms,
        "zones": [],
        "totalReadings": sum(d.get("readings", 0) for d in daily),
        "kpis": {
            "daysTracked": 28,
            "buildings": len(set(d.get("building") for d in daily)),
            "totalReadings": sum(d.get("readings", 0) for d in daily)
        }
    })


# ── Ramp ───────────────────────────────────────────────────────────────────

def refresh_ramp_analytics():
    """Ramp spending analytics."""
    # Get transactions for current FY
    # Ramp pagination: page.next is a full URL, not a cursor
    import urllib.request
    all_txns = []
    next_url = None
    for _ in range(20):  # Max 20 pages
        if next_url:
            # Use the full next URL directly
            req = urllib.request.Request(next_url, headers={
                "Authorization": f"Bearer {json.load(open(RAMP_TOKEN_FILE)).get('access_token', '')}",
                "Accept": "application/json",
                "User-Agent": "JFSD-Dashboard/1.0"
            })
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode()
                raw = re.sub(r'\x1b\[[0-9;]*m', '', raw)
                data = json.loads(raw)
        else:
            params = {"page_size": 100, "from_date": f"{FY_START}T00:00:00"}
            data = ramp_api("/transactions", params)
        txns = data.get("data", [])
        all_txns.extend(txns)
        next_url = data.get("page", {}).get("next")
        if not next_url or not txns:
            break
    
    # Monthly trend
    monthly = {}
    for t in all_txns:
        date = t.get("user_transaction_time", t.get("created_at", ""))[:7]
        if date:
            if date not in monthly:
                monthly[date] = {"month": date, "amount": 0, "count": 0}
            monthly[date]["amount"] += abs(float(t.get("amount", 0)))
            monthly[date]["count"] += 1
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])[-8:]
    
    # Department spend
    dept_spend = {}
    for t in all_txns:
        acct_cats_r = t.get("accounting_categories") or {}
        if isinstance(acct_cats_r, list):
            acct_cats_r = acct_cats_r[0] if acct_cats_r else {}
        dept = t.get("department_name") or acct_cats_r.get("department_name", "Uncategorized")
        if dept not in dept_spend:
            dept_spend[dept] = {"department": dept, "amount": 0, "count": 0}
        dept_spend[dept]["amount"] += abs(float(t.get("amount", 0)))
        dept_spend[dept]["count"] += 1
    
    # Category breakdown
    cat_spend = {}
    for t in all_txns:
        cat = t.get("merchant_category_code_description") or t.get("sk_category_name", "Other")
        if cat not in cat_spend:
            cat_spend[cat] = {"category": cat, "amount": 0, "count": 0}
        cat_spend[cat]["amount"] += abs(float(t.get("amount", 0)))
        cat_spend[cat]["count"] += 1
    
    # Top merchants
    merch_spend = {}
    for t in all_txns:
        m = t.get("merchant_name") or t.get("merchant_descriptor", "Unknown")
        if m not in merch_spend:
            merch_spend[m] = {"merchant": m, "amount": 0, "count": 0}
        merch_spend[m]["amount"] += abs(float(t.get("amount", 0)))
        merch_spend[m]["count"] += 1
    
    # Top spenders
    user_spend = {}
    for t in all_txns:
        u = t.get("card_holder", {}).get("first_name", "") + " " + t.get("card_holder", {}).get("last_name", "")
        u = u.strip() or "Unknown"
        if u not in user_spend:
            user_spend[u] = {"name": u, "amount": 0, "count": 0}
        user_spend[u]["amount"] += abs(float(t.get("amount", 0)))
        user_spend[u]["count"] += 1
    
    total_spend = sum(m["amount"] for m in monthly_trend)
    
    write_json("ramp-analytics.json", {
        "monthlyTrend": monthly_trend,
        "departmentSpend": sorted(dept_spend.values(), key=lambda x: -x["amount"])[:7],
        "categoryBreakdown": sorted(cat_spend.values(), key=lambda x: -x["amount"])[:15],
        "topMerchants": sorted(merch_spend.values(), key=lambda x: -x["amount"])[:15],
        "topSpenders": sorted(user_spend.values(), key=lambda x: -x["amount"])[:15],
        "cardUtilization": {"totalCards": 0, "activeCards": 0},
        "weekOverWeek": {},
        "kpis": {
            "totalSpend": total_spend,
            "transactionCount": len(all_txns),
            "departments": len(dept_spend),
            "avgTransaction": round(total_spend / len(all_txns), 2) if all_txns else 0
        }
    })


def refresh_james_ap_expense():
    """AP/expense view for James from Ramp."""
    # Recent transactions needing attention
    params = {"page_size": 100, "from_date": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00")}
    data = ramp_api("/transactions", params)
    txns = data.get("data", [])
    
    # Action items: transactions missing receipts or GL coding
    action_items = []
    for t in txns:
        issues = []
        if not t.get("receipts"):
            issues.append("Missing receipt")
        acct_cats = t.get("accounting_categories") or {}
        if isinstance(acct_cats, list):
            acct_cats = acct_cats[0] if acct_cats else {}
        if not acct_cats.get("gl_account"):
            issues.append("Missing GL code")
        if issues:
            action_items.append({
                "name": (t.get("card_holder", {}).get("first_name", "") + " " + t.get("card_holder", {}).get("last_name", "")).strip(),
                "merchant": t.get("merchant_name", "Unknown"),
                "amount": abs(float(t.get("amount", 0))),
                "date": t.get("user_transaction_time", "")[:10],
                "issues": issues
            })
    
    # Monthly budget pace
    monthly_totals = {}
    for t in txns:
        month = t.get("user_transaction_time", "")[:7]
        if month:
            monthly_totals[month] = monthly_totals.get(month, 0) + abs(float(t.get("amount", 0)))
    
    budget_pace = [{"month": k, "actual": v} for k, v in sorted(monthly_totals.items())]
    
    total_expense = sum(abs(float(t.get("amount", 0))) for t in txns)
    
    write_json("james-ap-expense.json", {
        "actionItems": action_items[:28],
        "expenseSummary": {
            "last30Days": total_expense,
            "transactionCount": len(txns),
            "avgTransaction": round(total_expense / len(txns), 2) if txns else 0
        },
        "budgetPace": budget_pace,
        "cardManagement": {},
        "glHealth": {
            "missingReceipts": len([a for a in action_items if "Missing receipt" in a.get("issues", [])]),
            "missingGLCode": len([a for a in action_items if "Missing GL code" in a.get("issues", [])])
        },
        "kpis": {
            "actionItems": len(action_items),
            "last30DaysSpend": total_expense,
            "missingReceipts": len([a for a in action_items if "Missing receipt" in a.get("issues", [])])
        }
    })


# ── Stripe ─────────────────────────────────────────────────────────────────

def refresh_stripe():
    """Stripe payment data."""
    env = load_env(STRIPE_ENV)
    stripe_key = env.get("STRIPE_API_KEY", "")
    
    if not stripe_key:
        log("  ⚠ No Stripe API key found")
        return
    
    # Use stripe-query.py for summary
    try:
        result = subprocess.run(
            ["python3", str(STRIPE_QUERY), "summary", "--from", FY_START, "--to", TODAY, "--json"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            output = result.stdout.strip()
            for i, c in enumerate(output):
                if c in '[{':
                    output = output[i:]
                    break
            data = json.loads(output)
            if "kpis" not in data:
                data["kpis"] = {}
            write_json("stripe.json", data)
            return
    except:
        pass
    
    # Fallback: manual API calls
    import urllib.request
    import base64
    
    auth = base64.b64encode(f"{stripe_key}:".encode()).decode()
    
    def stripe_get(endpoint):
        url = f"https://api.stripe.com/v1{endpoint}"
        req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    
    # Monthly charge data
    monthly_data = []
    now = datetime.now()
    for m in range(8):
        dt = now.replace(day=1) - timedelta(days=30*m)
        start = int(dt.replace(day=1).timestamp())
        if dt.month == 12:
            end_dt = dt.replace(year=dt.year+1, month=1, day=1)
        else:
            end_dt = dt.replace(month=dt.month+1, day=1)
        end = int(end_dt.timestamp())
        
        charges = stripe_get(f"/charges?limit=100&created[gte]={start}&created[lt]={end}")
        items = charges.get("data", [])
        total = sum(c.get("amount", 0) for c in items if c.get("paid")) / 100
        fees = sum(c.get("application_fee_amount", 0) or 0 for c in items) / 100
        monthly_data.append({
            "month": dt.strftime("%Y-%m"),
            "gross": total,
            "fees": fees,
            "net": total - fees,
            "count": len(items)
        })
    
    monthly_data.reverse()
    total_gross = sum(m["gross"] for m in monthly_data)
    
    write_json("stripe.json", {
        "monthlyData": monthly_data,
        "cardBrandData": [],
        "sourceData": [],
        "kpis": {
            "totalGross": total_gross,
            "totalTransactions": sum(m["count"] for m in monthly_data),
            "avgTransaction": round(total_gross / sum(m["count"] for m in monthly_data), 2) if sum(m["count"] for m in monthly_data) else 0
        }
    })


# ── GiveCloud ──────────────────────────────────────────────────────────────

def refresh_givecloud():
    """GiveCloud online giving data."""
    # Recent contributions
    contribs = givecloud_api("/contributions", {"per_page": 15, "page": 1})
    items = contribs.get("data", [])
    
    # Get a few pages for monthly trend
    all_contribs = list(items)
    for page in range(2, 6):
        more = givecloud_api("/contributions", {"per_page": 15, "page": page})
        page_items = more.get("data", [])
        if not page_items:
            break
        all_contribs.extend(page_items)
    
    # Monthly trend
    monthly = {}
    for c in all_contribs:
        month = (c.get("ordered_at") or "")[:7]
        if month:
            if month not in monthly:
                monthly[month] = {"month": month, "amount": 0, "count": 0}
            monthly[month]["amount"] += float(c.get("total") or 0)
            monthly[month]["count"] += 1
    monthly_trend = sorted(monthly.values(), key=lambda x: x["month"])[-8:]
    
    # Recurring gifts
    recurring = [c for c in all_contribs if c.get("is_recurring")]
    
    # Top products
    products = givecloud_api("/products", {"per_page": 15})
    top_products = products.get("data", [])[:10]
    
    # Failed payments
    failed = [c for c in all_contribs if c.get("payment_status") == "failed"]
    
    total_online = sum(m["amount"] for m in monthly_trend)
    
    write_json("givecloud.json", {
        "notes": None,
        "onlineGiving": {
            "totalFY": total_online,
            "contributionCount": len(all_contribs),
            "avgGift": round(total_online / len(all_contribs), 2) if all_contribs else 0
        },
        "monthlyTrend": monthly_trend,
        "recurring": {
            "active": len(recurring),
            "monthlyRevenue": sum(float(r.get("total") or 0) for r in recurring)
        },
        "topProducts": [{"name": p.get("name"), "id": p.get("id")} for p in top_products],
        "conversionBySource": [],
        "recentContributions": [{
            "name": f"{c.get('billing_first_name', '')} {c.get('billing_last_name', '')}".strip(),
            "amount": float(c.get("total") or 0),
            "date": c.get("ordered_at", "")[:10],
            "product": (c.get("items") or [{}])[0].get("name", "") if c.get("items") else ""
        } for c in items[:20]],
        "failedPayments": failed,
        "kpis": {
            "totalOnline": total_online,
            "contributions": len(all_contribs),
            "recurringActive": len(recurring),
            "failedPayments": len(failed)
        }
    })


# ── Sage Intacct (GL) ─────────────────────────────────────────────────────

def refresh_financial_statements():
    """Financial statements from Sage GL SQLite."""
    if not SAGE_DB.exists():
        log("  ⚠ Sage GL database not found")
        return
    
    # Revenue (negative credits → negate for display)
    revenue = query_sqlite(SAGE_DB, """
        SELECT account_title, SUM(amount) as total
        FROM gl_details
        WHERE account LIKE '4%'
          AND entry_date >= ?
        GROUP BY account_title
        ORDER BY SUM(amount)
    """, [FY_START])
    
    # Expenses (positive debits)
    expenses = query_sqlite(SAGE_DB, """
        SELECT account_title, SUM(amount) as total
        FROM gl_details
        WHERE account LIKE '5%' OR account LIKE '6%' OR account LIKE '7%'
          AND entry_date >= ?
        GROUP BY account_title
        ORDER BY SUM(amount) DESC
    """, [FY_START])
    
    # Assets
    assets = query_sqlite(SAGE_DB, """
        SELECT account_title, SUM(amount) as total
        FROM gl_details
        WHERE account LIKE '1%'
        GROUP BY account_title
    """)
    
    # Liabilities
    liabilities = query_sqlite(SAGE_DB, """
        SELECT account_title, SUM(amount) as total
        FROM gl_details
        WHERE account LIKE '2%'
        GROUP BY account_title
    """)
    
    # Budget vs Actual (budget table has monthly columns, join chart_of_accounts for titles)
    budget = query_sqlite(SAGE_DB, """
        SELECT c.account_title,
               SUM(COALESCE(b.jul_2025,0)+COALESCE(b.aug_2025,0)+COALESCE(b.sep_2025,0)+
                   COALESCE(b.oct_2025,0)+COALESCE(b.nov_2025,0)+COALESCE(b.dec_2025,0)+
                   COALESCE(b.jan_2026,0)+COALESCE(b.feb_2026,0)+COALESCE(b.mar_2026,0)+
                   COALESCE(b.apr_2026,0)+COALESCE(b.may_2026,0)+COALESCE(b.jun_2026,0)) AS budget_amount
        FROM budget b
        JOIN chart_of_accounts c ON b.acct_no = c.account
        GROUP BY c.account_title
    """)
    
    # Monthly trend
    monthly = query_sqlite(SAGE_DB, f"""
        SELECT strftime('%Y-%m', entry_date) as month,
               SUM(CASE WHEN account LIKE '4%' THEN -amount ELSE 0 END) as revenue,
               SUM(CASE WHEN account LIKE '5%' OR account LIKE '6%' OR account LIKE '7%' THEN amount ELSE 0 END) as expenses
        FROM gl_details
        WHERE entry_date >= '{FY_START}'
        GROUP BY strftime('%Y-%m', entry_date)
        ORDER BY month
    """)
    
    total_revenue = -sum(float(r.get("total") or 0) for r in revenue)  # Negate GL credits
    total_expenses = sum(float(e.get("total") or 0) for e in expenses)
    total_assets = sum(float(a.get("total") or 0) for a in assets)
    total_liabilities = -sum(float(l.get("total") or 0) for l in liabilities)
    
    months_elapsed = (datetime.now().month - 7) % 12 + 1
    
    write_json("financial-statements.json", {
        "generatedAt": NOW,
        "period": f"FY{FY} YTD",
        "monthsElapsed": months_elapsed,
        "balanceSheet": {
            "totalAssets": total_assets,
            "totalLiabilities": total_liabilities,
            "netAssets": total_assets - total_liabilities
        },
        "activities": {
            "totalRevenue": total_revenue,
            "totalExpenses": total_expenses,
            "changeInNetAssets": total_revenue - total_expenses,
            "revenueLines": [{"name": r["account_title"], "amount": -float(r["total"])} for r in revenue[:20]],
            "expenseLines": [{"name": e["account_title"], "amount": float(e["total"])} for e in expenses[:20]]
        },
        "functionalExpenses": {},
        "budgetVsActual": {
            "budgetLines": budget[:20],
            "totalBudget": sum(float(b.get("budget_amount") or 0) for b in budget)
        },
        "monthlyTrend": monthly,
        "kpis": {
            "totalRevenue": total_revenue,
            "totalExpenses": total_expenses,
            "surplus": total_revenue - total_expenses,
            "monthsElapsed": months_elapsed
        }
    })


# ── Data Duel ──────────────────────────────────────────────────────────────

def refresh_data_duel():
    """Data duel analytics from SQLite."""
    if not DATA_DUEL_DB.exists():
        log("  ⚠ data-duel analytics.db not found, writing empty")
        write_json("data-duel.json", {
            "runs": [], "topFindings": [], "trends": [],
            "analysts": {}, "kpis": {}
        })
        return
    
    runs = query_sqlite(DATA_DUEL_DB, """
        SELECT * FROM duel_runs ORDER BY created_at DESC LIMIT 10
    """)
    findings = query_sqlite(DATA_DUEL_DB, """
        SELECT * FROM findings ORDER BY dollar_impact DESC LIMIT 30
    """)
    
    write_json("data-duel.json", {
        "runs": runs,
        "topFindings": findings,
        "trends": [],
        "analysts": {},
        "kpis": {
            "totalRuns": len(runs),
            "totalFindings": len(findings)
        }
    })


# ── Project Tracker ────────────────────────────────────────────────────────

def refresh_project_tracker():
    """Parse PROJECTS.md into structured data."""
    if not PROJECTS_MD.exists():
        log("  ⚠ PROJECTS.md not found")
        return
    
    content = PROJECTS_MD.read_text()
    items = []
    current_section = "Backlog"
    
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("## "):
            current_section = line[3:].strip()
        elif line.startswith("- ") or line.startswith("* "):
            text = line[2:].strip()
            # Parse checkbox format: - [x] or - [ ]
            done = False
            if text.startswith("[x]") or text.startswith("[X]"):
                done = True
                text = text[3:].strip()
            elif text.startswith("[ ]"):
                text = text[3:].strip()
            
            items.append({
                "title": text[:100],
                "section": current_section,
                "done": done,
                "column": "Done" if done else current_section
            })
    
    # Derive columns
    columns = list(dict.fromkeys(i["column"] for i in items))
    
    write_json("project-tracker.json", {
        "kpis": {
            "total": len(items),
            "done": len([i for i in items if i["done"]]),
            "inProgress": len([i for i in items if not i["done"]])
        },
        "columns": columns[:5],
        "columnLabels": {c: c for c in columns[:5]},
        "swimLanes": list(dict.fromkeys(i["section"] for i in items))[:6],
        "items": items[:95]
    })


# ── TODO / Stubs ───────────────────────────────────────────────────────────

def refresh_hubspot_emails():
    """TODO: HubSpot email data — not yet implemented."""
    log("  ⚠ HubSpot emails: TODO — skipping")
    # Don't overwrite existing data


def refresh_hubspot_engagement():
    """TODO: HubSpot engagement data — not yet implemented."""
    log("  ⚠ HubSpot engagement: TODO — skipping")


def refresh_monday():
    """TODO: Monday.com boards — not yet implemented."""
    log("  ⚠ Monday.com: TODO — skipping")


# ══════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════

ALL_SOURCES = {
    # Salesforce
    "campaign-tracker": refresh_campaign_tracker,
    "drm-portfolio": refresh_drm_portfolio,
    "pledge-management": refresh_pledge_management,
    "data-quality": refresh_data_quality,
    "sharon-donor-health": refresh_sharon_donor_health,
    "silence-alerts": refresh_silence_alerts,
    "weekly-ask-list": refresh_weekly_ask_list,
    "board-reporting": refresh_board_reporting,
    "donor-lifecycle": refresh_donor_lifecycle,
    "retention-analysis": refresh_retention_analysis,
    "cohort-survival": refresh_cohort_survival,
    "mortality-model": refresh_mortality_model,
    # Research DB
    "prospect-research": refresh_prospect_research,
    "wealthengine": refresh_wealthengine,
    "nonprofit-boards": refresh_nonprofit_boards,
    # Facilities
    "facilities": refresh_facilities,
    "ecobee-trends": refresh_ecobee_trends,
    # Ramp
    "ramp-analytics": refresh_ramp_analytics,
    "james-ap-expense": refresh_james_ap_expense,
    # Stripe
    "stripe": refresh_stripe,
    # GiveCloud
    "givecloud": refresh_givecloud,
    # Sage
    "financial-statements": refresh_financial_statements,
    # Other
    "data-duel": refresh_data_duel,
    "project-tracker": refresh_project_tracker,
    # TODO
    "hubspot-emails": refresh_hubspot_emails,
    "hubspot-engagement": refresh_hubspot_engagement,
    "monday": refresh_monday,
}

def main():
    import argparse
    parser = argparse.ArgumentParser(description="JFSD Dashboard Data Refresh")
    parser.add_argument("--source", help="Refresh a single source by name")
    parser.add_argument("--dry-run", action="store_true", help="Print sources without running")
    args = parser.parse_args()
    
    log(f"JFSD Dashboard Data Refresh — {NOW}")
    log(f"FY{FY}: {FY_START} to {FY_END}")
    log(f"Data directory: {DATA_DIR}")
    log("")
    
    if args.dry_run:
        for name in ALL_SOURCES:
            print(f"  {name}")
        return
    
    if args.source:
        if args.source not in ALL_SOURCES:
            print(f"Unknown source: {args.source}")
            print(f"Available: {', '.join(ALL_SOURCES.keys())}")
            sys.exit(1)
        safe_run(args.source, ALL_SOURCES[args.source])
    else:
        for name, func in ALL_SOURCES.items():
            safe_run(name, func)
    
    log("")
    if errors:
        log(f"⚠ Completed with {len(errors)} error(s):")
        for e in errors:
            log(f"  {e}")
        sys.exit(1 if len(errors) == len(ALL_SOURCES) else 0)  # Only fail if ALL sources failed
    else:
        log("✓ All sources refreshed successfully")


if __name__ == "__main__":
    main()
