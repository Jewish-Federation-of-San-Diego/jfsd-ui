#!/usr/bin/env python3
"""
Generate data-quality.json for the Data Quality dashboard.
Queries Salesforce for comprehensive data quality metrics.
Output: public/data/data-quality.json
"""

import json, os, subprocess, sys, datetime, re
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "data-quality.json"
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
                        m = type('M', (), {'start': lambda s: i})()
                        break
                    except:
                        continue
        if not m:
            print(f"SF no JSON: {stdout[:300]}", file=sys.stderr)
            return []
        data = json.loads(stdout[m.start():])
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("records", data.get("data", []))
        return []
    except Exception as e:
        print(f"SF query error: {e}", file=sys.stderr)
        return []


def safe_num(v):
    if v is None:
        return 0
    try:
        return float(v)
    except:
        return 0


def strip_attrs(rec):
    """Remove Salesforce 'attributes' key from a record dict."""
    if isinstance(rec, dict):
        return {k: v for k, v in rec.items() if k != "attributes"}
    return rec


# ── Queries ──────────────────────────────────────────────────────────────

print("Querying Salesforce for data quality metrics...", file=sys.stderr)

# 1. Duplicate person accounts
print("  → Duplicate accounts...", file=sys.stderr)
dupes = sf("SELECT Name, COUNT(Id) cnt FROM Account WHERE IsPersonAccount = true GROUP BY Name HAVING COUNT(Id) > 1 ORDER BY COUNT(Id) DESC LIMIT 50")
dupe_details = [{"name": r.get("Name", ""), "count": int(safe_num(r.get("cnt", r.get("expr0", 0))))} for r in dupes]
dupe_count = len(dupe_details)
total_dupe_records = sum(d["count"] for d in dupe_details)

# 2. Missing email on major donors ($1K+ FY26)
print("  → Missing email (major donors)...", file=sys.stderr)
missing_email = sf(
    "SELECT Id, Name, Recognition_Amount_FY26__c FROM Account "
    "WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c >= 1000 AND PersonEmail = null "
    "ORDER BY Recognition_Amount_FY26__c DESC LIMIT 50"
)
missing_email_details = [{"name": r.get("Name", ""), "id": r.get("Id", ""), "fy26": safe_num(r.get("Recognition_Amount_FY26__c"))} for r in missing_email]

# 3. Missing address on major donors
print("  → Missing address (major donors)...", file=sys.stderr)
missing_addr = sf(
    "SELECT Id, Name, Recognition_Amount_FY26__c FROM Account "
    "WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c >= 1000 "
    "AND PersonMailingStreet = null "
    "ORDER BY Recognition_Amount_FY26__c DESC LIMIT 50"
)
missing_addr_details = [{"name": r.get("Name", ""), "id": r.get("Id", ""), "fy26": safe_num(r.get("Recognition_Amount_FY26__c"))} for r in missing_addr]

# 4. Missing phone on major donors
print("  → Missing phone (major donors)...", file=sys.stderr)
missing_phone = sf(
    "SELECT Id, Name, Recognition_Amount_FY26__c FROM Account "
    "WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c >= 1000 AND Phone = null AND PersonMobilePhone = null "
    "ORDER BY Recognition_Amount_FY26__c DESC LIMIT 50"
)
missing_phone_details = [{"name": r.get("Name", ""), "id": r.get("Id", ""), "fy26": safe_num(r.get("Recognition_Amount_FY26__c"))} for r in missing_phone]

# 5. Gifts without campaign attribution
print("  → Gifts without campaign...", file=sys.stderr)
no_campaign_gifts = sf(
    "SELECT COUNT(Id) cnt, SUM(CurrentAmount) total FROM GiftTransaction "
    "WHERE Status = 'Paid' AND CampaignId = null AND TransactionDate = THIS_FISCAL_YEAR"
)
no_campaign_count = int(safe_num(no_campaign_gifts[0].get("cnt", no_campaign_gifts[0].get("expr0", 0)))) if no_campaign_gifts else 0
no_campaign_amount = safe_num(no_campaign_gifts[0].get("total", no_campaign_gifts[0].get("expr1", 0))) if no_campaign_gifts else 0

# 6. Overdue open opportunities (past close date, still open)
print("  → Overdue opportunities...", file=sys.stderr)
overdue_opps = sf(
    "SELECT Id, Name, Amount, CloseDate, StageName FROM Opportunity "
    "WHERE IsClosed = false AND CloseDate < TODAY "
    "ORDER BY CloseDate ASC LIMIT 50"
)
overdue_details = [{"name": r.get("Name", ""), "id": r.get("Id", ""), "amount": safe_num(r.get("Amount")), "closeDate": r.get("CloseDate", "")} for r in overdue_opps]

# 7. Opportunities missing amount
print("  → Opps missing amount...", file=sys.stderr)
missing_amt = sf(
    "SELECT COUNT(Id) cnt FROM Opportunity WHERE Amount = null AND IsClosed = false"
)
missing_amt_count = int(safe_num(missing_amt[0].get("cnt", missing_amt[0].get("expr0", 0)))) if missing_amt else 0

# 8. Zero recognition with gifts (has FY26 gifts but recognition = 0)
print("  → Zero recognition with gifts...", file=sys.stderr)
zero_recog = sf(
    "SELECT Id, Name, Giving_this_Fiscal_Year__c, Recognition_Amount_FY26__c FROM Account "
    "WHERE IsPersonAccount = true AND Giving_this_Fiscal_Year__c > 0 "
    "AND (Recognition_Amount_FY26__c = 0 OR Recognition_Amount_FY26__c = null) "
    "ORDER BY Giving_this_Fiscal_Year__c DESC LIMIT 50"
)
zero_recog_details = [{"name": r.get("Name", ""), "id": r.get("Id", ""), "giving": safe_num(r.get("Giving_this_Fiscal_Year__c"))} for r in zero_recog]

# 9. Deceased accounts with active recurring
print("  → Deceased with active recurring...", file=sys.stderr)
deceased_recurring = sf(
    "SELECT Id, Donor.Name, Donor.Id, Status, ExpectedTotalCmtAmount FROM GiftCommitment "
    "WHERE Donor.IsDeceased = true AND Status = 'Active' AND RecurrenceType != null "
    "LIMIT 50"
)
deceased_details = []
for r in deceased_recurring:
    donor = r.get("Donor") or {}
    deceased_details.append({
        "name": donor.get("Name", "Unknown"),
        "id": donor.get("Id", r.get("Id", "")),
        "amount": safe_num(r.get("ExpectedTotalCmtAmount"))
    })

# 10. Orphaned campaigns (no parent, have gifts)
print("  → Orphaned campaigns...", file=sys.stderr)
orphaned_campaigns = sf(
    "SELECT Id, Name, Total_Gift_Transactions__c FROM Campaign "
    "WHERE ParentId = null AND Total_Gift_Transactions__c > 0 AND IsActive = true "
    "AND Type != 'Fundraising' "
    "ORDER BY Total_Gift_Transactions__c DESC LIMIT 50"
)
orphaned_details = [{"name": r.get("Name", ""), "id": r.get("Id", ""), "gifts": safe_num(r.get("Total_Gift_Transactions__c"))} for r in orphaned_campaigns]

# 11. Total major donors (for scoring)
print("  → Total major donors (baseline)...", file=sys.stderr)
total_major = sf(
    "SELECT COUNT(Id) cnt FROM Account WHERE IsPersonAccount = true AND Recognition_Amount_FY26__c >= 1000"
)
total_major_count = int(safe_num(total_major[0].get("cnt", total_major[0].get("expr0", 0)))) if total_major else 1

# ── Scoring ──────────────────────────────────────────────────────────────

def category_score(issues):
    """Score 0-100 based on issue severity and counts."""
    penalty = 0
    for issue in issues:
        sev = issue.get("severity", "low")
        cnt = issue.get("count", 0)
        if sev == "critical":
            penalty += cnt * 10
        elif sev == "high":
            penalty += cnt * 3
        elif sev == "medium":
            penalty += cnt * 1
        else:
            penalty += cnt * 0.3
    # Cap penalty at 100
    return max(0, round(100 - min(penalty, 100)))


# ── Build output ─────────────────────────────────────────────────────────

contact_issues = [
    {"metric": "Major donors missing email", "count": len(missing_email_details), "severity": "high", "details": missing_email_details[:20]},
    {"metric": "Major donors missing address", "count": len(missing_addr_details), "severity": "medium", "details": missing_addr_details[:20]},
    {"metric": "Major donors missing phone", "count": len(missing_phone_details), "severity": "low", "details": missing_phone_details[:20]},
]

duplicate_issues = [
    {"metric": "Duplicate person accounts", "count": dupe_count, "severity": "high", "details": dupe_details[:20],
     "totalAffectedRecords": total_dupe_records},
]

campaign_issues = [
    {"metric": "Orphaned campaigns", "count": len(orphaned_details), "severity": "medium", "details": orphaned_details[:20]},
    {"metric": "Gifts without campaign", "count": no_campaign_count, "severity": "high", "dollarAmount": no_campaign_amount},
]

pipeline_issues = [
    {"metric": "Overdue open opportunities", "count": len(overdue_details), "severity": "high", "details": overdue_details[:20]},
    {"metric": "Opportunities missing amount", "count": missing_amt_count, "severity": "medium"},
]

recognition_issues = [
    {"metric": "Zero recognition with gifts", "count": len(zero_recog_details), "severity": "high", "details": zero_recog_details[:20]},
    {"metric": "Deceased with active recurring", "count": len(deceased_details), "severity": "critical", "details": deceased_details[:20]},
]

categories = [
    {"name": "Contact Completeness", "score": category_score(contact_issues), "issues": contact_issues},
    {"name": "Duplicate Records", "score": category_score(duplicate_issues), "issues": duplicate_issues},
    {"name": "Campaign Health", "score": category_score(campaign_issues), "issues": campaign_issues},
    {"name": "Pipeline Hygiene", "score": category_score(pipeline_issues), "issues": pipeline_issues},
    {"name": "Recognition Integrity", "score": category_score(recognition_issues), "issues": recognition_issues},
]

overall_score = round(sum(c["score"] for c in categories) / len(categories))

# Count by severity
all_issues = contact_issues + duplicate_issues + campaign_issues + pipeline_issues + recognition_issues
critical_count = sum(i["count"] for i in all_issues if i["severity"] == "critical")
high_count = sum(i["count"] for i in all_issues if i["severity"] == "high")
medium_count = sum(i["count"] for i in all_issues if i["severity"] == "medium")
low_count = sum(i["count"] for i in all_issues if i["severity"] == "low")
total_affected = sum(i["count"] for i in all_issues)

output = {
    "asOfDate": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    "overallScore": overall_score,
    "categories": categories,
    "trends": [],
    "kpis": {
        "overallScore": overall_score,
        "criticalIssues": critical_count,
        "highIssues": high_count,
        "mediumIssues": medium_count,
        "lowIssues": low_count,
        "totalRecordsAffected": total_affected,
        "totalMajorDonors": total_major_count,
    }
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(output, indent=2))
print(f"✅ Wrote {OUTPUT} ({len(json.dumps(output))} bytes)", file=sys.stderr)
print(f"   Overall score: {overall_score}/100", file=sys.stderr)
print(f"   Critical: {critical_count} | High: {high_count} | Medium: {medium_count} | Low: {low_count}", file=sys.stderr)
