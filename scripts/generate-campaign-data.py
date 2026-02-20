#!/usr/bin/env python3
"""Generate campaign-tracker.json from Salesforce (NPC).
Output: public/data/campaign-tracker.json
"""

import json, re, subprocess, sys
from datetime import datetime, timedelta
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "campaign-tracker.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")


def sf(soql: str) -> list:
    """Run SOQL via sf-query.js, return list of records."""
    try:
        result = subprocess.run(
            ["node", SF_QUERY, soql],
            capture_output=True, text=True, timeout=60
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
                        start = i
                        m = type('M', (), {'start': lambda self, _s=start: _s})()
                        break
                    except Exception:
                        continue
        if not m:
            print(f"SF no JSON: {stdout[:200]}", file=sys.stderr)
            return []
        data = json.loads(stdout[m.start():])
        if isinstance(data, list):
            return data
        return data.get("records", [data])
    except Exception as e:
        print(f"SF error: {e}", file=sys.stderr)
        return []


def n(v):
    """Coerce to float, None→0."""
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def main():
    today = datetime.now()
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    last_week_start = (today - timedelta(days=today.weekday() + 7)).strftime("%Y-%m-%d")
    last_week_end = (today - timedelta(days=today.weekday() + 1)).strftime("%Y-%m-%d")

    # ── Annual Campaign 26 progress ─────────────────────────────────────
    ac = (sf("SELECT COUNT(Id) cnt, SUM(Recognition_Amount_FY26__c) total, AVG(Recognition_Amount_FY26__c) avg_gift FROM Account WHERE Recognition_Amount_FY26__c > 0 AND IsPersonAccount = true") or [{}])[0]
    raised = n(ac.get("total") or ac.get("expr0"))
    donor_count = int(n(ac.get("cnt") or ac.get("expr0") or 0))
    avg_gift = n(ac.get("avg_gift") or ac.get("expr2"))

    # Prior year at same point
    py = (sf("SELECT SUM(Recognition_Amount_FY25__c) total FROM Account WHERE Recognition_Amount_FY25__c > 0 AND IsPersonAccount = true") or [{}])[0]
    prior_year = n(py.get("total") or py.get("expr0"))

    # ── Momentum ────────────────────────────────────────────────────────
    tw = (sf(f"SELECT COUNT(Id) cnt, SUM(CurrentAmount) total FROM GiftTransaction WHERE Status = 'Paid' AND TransactionDate >= {week_start}") or [{}])[0]
    gifts_this_week = int(n(tw.get("cnt") or tw.get("expr0")))
    amount_this_week = n(tw.get("total") or tw.get("expr1"))

    lw = (sf(f"SELECT COUNT(Id) cnt, SUM(CurrentAmount) total FROM GiftTransaction WHERE Status = 'Paid' AND TransactionDate >= {last_week_start} AND TransactionDate <= {last_week_end}") or [{}])[0]
    gifts_last_week = int(n(lw.get("cnt") or lw.get("expr0")))
    amount_last_week = n(lw.get("total") or lw.get("expr1"))

    wow_pct = ((amount_this_week - amount_last_week) / amount_last_week * 100) if amount_last_week else 0

    # ── Donor breakdown ─────────────────────────────────────────────────
    new_donors = int(n((sf("SELECT COUNT(Id) cnt FROM Account WHERE First_Gift_Date__c >= 2025-07-01 AND IsPersonAccount = true") or [{}])[0].get("cnt") or (sf("SELECT COUNT(Id) cnt FROM Account WHERE First_Gift_Date__c >= 2025-07-01 AND IsPersonAccount = true") or [{}])[0].get("expr0")))

    returning_donors = int(n((sf("SELECT COUNT(Id) cnt FROM Account WHERE Recognition_Amount_FY26__c > 0 AND Recognition_Amount_FY25__c > 0 AND IsPersonAccount = true") or [{}])[0].get("cnt") or 0))

    lybunt_recovered = int(n((sf("SELECT COUNT(Id) cnt FROM Account WHERE Recognition_Amount_FY26__c > 0 AND (Recognition_Amount_FY25__c = 0 OR Recognition_Amount_FY25__c = null) AND Recognition_Amount_FY24__c > 0 AND IsPersonAccount = true") or [{}])[0].get("cnt") or 0))

    fy25_total = int(n((sf("SELECT COUNT(Id) cnt FROM Account WHERE Recognition_Amount_FY25__c > 0 AND IsPersonAccount = true") or [{}])[0].get("cnt") or 0))
    retention_rate = round(returning_donors / fy25_total * 100, 1) if fy25_total else 0

    # ── Top gifts this week ─────────────────────────────────────────────
    top_rows = sf(f"SELECT Donor.Name, CurrentAmount, Campaign.Name, TransactionDate FROM GiftTransaction WHERE Status = 'Paid' AND TransactionDate >= {week_start} ORDER BY CurrentAmount DESC LIMIT 10")
    top_gifts = []
    for r in top_rows:
        dn = r.get("Donor", {}).get("Name", "") if isinstance(r.get("Donor"), dict) else str(r.get("Donor.Name", ""))
        cn = r.get("Campaign", {}).get("Name", "") if isinstance(r.get("Campaign"), dict) else str(r.get("Campaign.Name", ""))
        top_gifts.append({"name": dn or "Anonymous", "amount": n(r.get("CurrentAmount")), "campaign": cn or "Unassigned", "date": r.get("TransactionDate", "")})

    # ── Pipeline ────────────────────────────────────────────────────────
    pipe = (sf("SELECT COUNT(Id) cnt, SUM(ExpectedTotalCmtAmount) total FROM GiftCommitment WHERE Status = 'Active'") or [{}])[0]
    open_pledges = int(n(pipe.get("cnt") or pipe.get("expr0")))
    open_pledge_amount = n(pipe.get("total") or pipe.get("expr1"))
    em = (sf("SELECT SUM(NextTransactionAmount) total FROM GiftCommitment WHERE Status = 'Active' AND NextTransactionDate = NEXT_N_DAYS:30") or [{}])[0]
    expected_this_month = n(em.get("total") or em.get("expr0"))

    # ── Giving levels ───────────────────────────────────────────────────
    levels_def = [("$1-99", 1, 99), ("$100-499", 100, 499), ("$500-999", 500, 999),
                  ("$1K-4,999", 1000, 4999), ("$5K-9,999", 5000, 9999),
                  ("$10K-24,999", 10000, 24999), ("$25K+", 25000, 999999999)]
    giving_levels = []
    for label, lo, hi in levels_def:
        cond = f"Recognition_Amount_FY26__c >= {lo}" + (f" AND Recognition_Amount_FY26__c <= {hi}" if hi < 999999999 else "")
        row = (sf(f"SELECT COUNT(Id) cnt, SUM(Recognition_Amount_FY26__c) total FROM Account WHERE {cond} AND IsPersonAccount = true") or [{}])[0]
        giving_levels.append({"level": label, "donors": int(n(row.get("cnt") or row.get("expr0"))), "amount": n(row.get("total") or row.get("expr1"))})

    # ── Sub-campaigns ───────────────────────────────────────────────────
    camp_rows = sf("SELECT Id, Name, ExpectedRevenue FROM Campaign WHERE IsActive = true AND (Name LIKE '%FY26%' OR Name LIKE '%2026%') ORDER BY ExpectedRevenue DESC NULLS LAST LIMIT 20")
    cg_rows = sf("SELECT Campaign.Name cname, COUNT(Id) cnt, SUM(CurrentAmount) total FROM GiftTransaction WHERE Status = 'Paid' AND Campaign.IsActive = true AND (Campaign.Name LIKE '%FY26%' OR Campaign.Name LIKE '%2026%') GROUP BY Campaign.Name ORDER BY SUM(CurrentAmount) DESC")
    camp_lookup = {}
    for r in cg_rows:
        cn = r.get("cname") or (r.get("Campaign", {}).get("Name", "") if isinstance(r.get("Campaign"), dict) else "")
        camp_lookup[cn] = {"raised": n(r.get("total")), "donors": int(n(r.get("cnt")))}

    campaigns = []
    for c in camp_rows:
        cname = c.get("Name", "")
        goal = n(c.get("ExpectedRevenue"))
        cl = camp_lookup.get(cname, {"raised": 0, "donors": 0})
        campaigns.append({"name": cname, "raised": cl["raised"], "goal": goal, "donors": cl["donors"],
                          "pctOfGoal": round(cl["raised"] / goal * 100, 1) if goal else 0})

    # ── Weekly momentum (last 8 weeks) ──────────────────────────────────
    weekly_momentum = []
    for i in range(7, -1, -1):
        ws = (today - timedelta(days=today.weekday() + 7 * i)).strftime("%Y-%m-%d")
        we = (today - timedelta(days=today.weekday() + 7 * i - 6)).strftime("%Y-%m-%d")
        wr = (sf(f"SELECT COUNT(Id) cnt, SUM(CurrentAmount) total FROM GiftTransaction WHERE Status = 'Paid' AND TransactionDate >= {ws} AND TransactionDate <= {we}") or [{}])[0]
        weekly_momentum.append({"weekOf": ws, "gifts": int(n(wr.get("cnt") or wr.get("expr0"))), "amount": n(wr.get("total") or wr.get("expr1"))})

    # ── Assemble ────────────────────────────────────────────────────────
    goal = 9000000
    output = {
        "asOfDate": today.strftime("%Y-%m-%d %H:%M"),
        "annualCampaign": {"name": "Annual Campaign 26", "goal": goal, "raised": raised,
                           "pctOfGoal": round(raised / goal * 100, 1) if goal else 0,
                           "donorCount": donor_count, "avgGift": round(avg_gift, 0), "priorYearSamePoint": prior_year},
        "momentum": {"giftsThisWeek": gifts_this_week, "amountThisWeek": amount_this_week,
                     "giftsLastWeek": gifts_last_week, "amountLastWeek": amount_last_week,
                     "weekOverWeekPct": round(wow_pct, 1)},
        "weeklyMomentum": weekly_momentum,
        "donorBreakdown": {"newDonors": new_donors, "returningDonors": returning_donors,
                           "lybuntRecovered": lybunt_recovered, "retentionRate": retention_rate},
        "givingLevels": giving_levels,
        "topGiftsThisWeek": top_gifts,
        "pipeline": {"openPledges": open_pledges, "openPledgeAmount": open_pledge_amount,
                     "expectedThisMonth": expected_this_month},
        "campaigns": campaigns,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2))
    print(f"✅ Wrote {OUTPUT} ({len(json.dumps(output))} bytes)")


if __name__ == "__main__":
    main()
