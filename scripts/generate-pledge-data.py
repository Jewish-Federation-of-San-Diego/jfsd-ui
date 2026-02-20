#!/usr/bin/env python3
"""Generate pledge-management.json from Salesforce (NPC).
Output: public/data/pledge-management.json
"""

import json, re, subprocess, sys
from datetime import datetime, date, timedelta
from pathlib import Path
from collections import defaultdict

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "pledge-management.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")


def sf(soql: str) -> list:
    """Run SOQL via sf-query.js, return list of records."""
    try:
        result = subprocess.run(
            ["node", SF_QUERY, soql],
            capture_output=True, text=True, timeout=120
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
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def s(v):
    return str(v) if v else ""


def parse_date(d):
    if not d:
        return None
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def donor_name(rec):
    """Extract donor name from nested Donor relationship."""
    donor = rec.get("Donor") or {}
    return donor.get("Name", "Unknown")


def campaign_name(rec):
    """Extract campaign name from nested Campaign relationship."""
    camp = rec.get("Campaign") or {}
    return camp.get("Name", "Unknown")


def main():
    today = date.today()
    month_start = today.replace(day=1)

    print("Querying open commitments...", file=sys.stderr)
    # Query all open/active commitments with key fields
    commitments = sf(
        "SELECT Id, DonorId, Donor.Name, ExpectedTotalCmtAmount, "
        "TotalPaidTransactionAmount, WrittenOffAmount, Status, "
        "EffectiveStartDate, ExpectedEndDate, CampaignId, Campaign.Name, "
        "LastPaidTransactionDate, NextTransactionDate, TransactionPaymentCount "
        "FROM GiftCommitment "
        "WHERE Status = 'Active' "
        "ORDER BY ExpectedTotalCmtAmount DESC NULLS LAST"
    )
    print(f"  Got {len(commitments)} open commitments", file=sys.stderr)

    # Query recent payments on commitments
    print("Querying recent payments...", file=sys.stderr)
    recent_payments = sf(
        "SELECT Id, CurrentAmount, TransactionDate, "
        "GiftCommitmentId, Donor.Name, "
        "GiftCommitment.ExpectedTotalCmtAmount "
        "FROM GiftTransaction "
        "WHERE GiftCommitmentId != null "
        "AND TransactionDate >= LAST_N_DAYS:90 "
        "AND Status = 'Paid' "
        "ORDER BY TransactionDate DESC "
        "LIMIT 50"
    )
    print(f"  Got {len(recent_payments)} recent payments", file=sys.stderr)

    # Query new pledges this month
    print("Querying new pledges this month...", file=sys.stderr)
    new_this_month = sf(
        f"SELECT COUNT(Id) cnt FROM GiftCommitment "
        f"WHERE FormalCommitmentType IN ('Written', 'Verbal') "
        f"AND EffectiveStartDate >= {month_start.isoformat()}"
    )

    # Process commitments
    total_pledged = 0
    total_paid = 0
    aging_buckets = {"0-90 days": {"count": 0, "amount": 0},
                     "91-180 days": {"count": 0, "amount": 0},
                     "181-365 days": {"count": 0, "amount": 0},
                     "365+ days": {"count": 0, "amount": 0}}
    write_off_risk = []
    top_open = []
    campaign_map = defaultdict(lambda: {"pledgeCount": 0, "pledgedAmount": 0, "paidAmount": 0})

    for c in commitments:
        pledged = n(c.get("ExpectedTotalCmtAmount"))
        paid = n(c.get("TotalPaidTransactionAmount"))
        balance = pledged - paid
        if balance <= 0:
            continue

        total_pledged += pledged
        total_paid += paid
        name = donor_name(c)
        camp = campaign_name(c)
        start_date = s(c.get("EffectiveStartDate"))
        end_date = s(c.get("ExpectedEndDate"))
        end_d = parse_date(end_date)
        start_d = parse_date(start_date)

        # Aging: days since start date
        if start_d:
            age_days = (today - start_d).days
        else:
            age_days = 0

        if age_days <= 90:
            bucket = "0-90 days"
        elif age_days <= 180:
            bucket = "91-180 days"
        elif age_days <= 365:
            bucket = "181-365 days"
        else:
            bucket = "365+ days"
        aging_buckets[bucket]["count"] += 1
        aging_buckets[bucket]["amount"] += balance

        # Write-off risk: past end date with balance
        if end_d and end_d < today and balance > 0:
            overdue = (today - end_d).days
            write_off_risk.append({
                "name": name,
                "pledgeAmount": pledged,
                "paidAmount": paid,
                "balance": balance,
                "endDate": end_date,
                "daysOverdue": overdue,
                "campaign": camp
            })

        # Top open pledges
        top_open.append({
            "name": name,
            "pledgedAmount": pledged,
            "paidAmount": paid,
            "balance": balance,
            "startDate": start_date,
            "endDate": end_date,
            "campaign": camp
        })

        # Campaign rollup
        campaign_map[camp]["pledgeCount"] += 1
        campaign_map[camp]["pledgedAmount"] += pledged
        campaign_map[camp]["paidAmount"] += paid

    # Sort and limit
    write_off_risk.sort(key=lambda x: x["balance"], reverse=True)
    top_open.sort(key=lambda x: x["balance"], reverse=True)
    top_open = top_open[:25]
    write_off_risk = write_off_risk[:25]

    total_outstanding = total_pledged - total_paid
    open_count = sum(b["count"] for b in aging_buckets.values())
    fulfillment_rate = round((total_paid / total_pledged * 100) if total_pledged > 0 else 0, 1)
    avg_pledge = round(total_pledged / open_count) if open_count > 0 else 0

    # Campaign breakdown
    by_campaign = []
    for camp, vals in sorted(campaign_map.items(), key=lambda x: x[1]["pledgedAmount"], reverse=True):
        fr = round((vals["paidAmount"] / vals["pledgedAmount"] * 100) if vals["pledgedAmount"] > 0 else 0, 1)
        by_campaign.append({
            "campaign": camp,
            "pledgeCount": vals["pledgeCount"],
            "pledgedAmount": vals["pledgedAmount"],
            "paidAmount": vals["paidAmount"],
            "fulfillmentRate": fr
        })

    # Recent payments
    recent_list = []
    for p in recent_payments[:20]:
        recent_list.append({
            "name": donor_name(p),
            "amount": n(p.get("CurrentAmount")),
            "date": s(p.get("TransactionDate")),
            "pledgeTotal": n((p.get("GiftCommitment") or {}).get("ExpectedTotalCmtAmount"))
        })

    pledges_this_month = 0
    if new_this_month:
        pledges_this_month = int(n(new_this_month[0].get("cnt", 0)))

    write_off_total = sum(r["balance"] for r in write_off_risk)

    output = {
        "asOfDate": today.isoformat(),
        "summary": {
            "totalOpenPledges": open_count,
            "totalPledgedAmount": total_pledged,
            "totalPaidAmount": total_paid,
            "totalOutstanding": total_outstanding,
            "fulfillmentRate": fulfillment_rate,
            "avgPledgeSize": avg_pledge
        },
        "agingBuckets": [
            {"bucket": k, "count": v["count"], "amount": round(v["amount"])}
            for k, v in aging_buckets.items()
        ],
        "writeOffRisk": write_off_risk,
        "topOpenPledges": top_open,
        "byCampaign": by_campaign,
        "recentPayments": recent_list,
        "kpis": {
            "totalOutstanding": total_outstanding,
            "fulfillmentRate": fulfillment_rate,
            "writeOffRiskAmount": write_off_total,
            "writeOffRiskCount": len(write_off_risk),
            "avgDaysToPayment": 0,  # Would need more complex query
            "pledgesThisMonth": pledges_this_month
        }
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, indent=2))
    print(f"Wrote {OUTPUT} ({open_count} pledges, ${total_outstanding:,.0f} outstanding)", file=sys.stderr)


if __name__ == "__main__":
    main()
