#!/usr/bin/env python3
"""Generate board-reporting.json from Salesforce (NPC) + existing board data.
Output: public/data/board-reporting.json
"""

import json, re, subprocess, sys
from datetime import datetime
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[4]  # /Users/davidfuhriman/clawd
OUTPUT = Path(__file__).resolve().parent.parent / "public" / "data" / "board-reporting.json"
SF_QUERY = str(WORKSPACE / "skills" / "salesforce" / "sf-query.js")
EXISTING = WORKSPACE / "projects" / "dashboards" / "donor" / "board-giving-report.json"


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
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


# Board member lists from existing report
BOARD_SHORT = {
    "Jewish Community Foundation of San Diego": "JCF",
    "Lawrence Family Jewish Community Center": "JCC",
    "AJC San Diego": "AJC",
}


def load_existing():
    """Load existing board giving report."""
    with open(EXISTING) as f:
        return json.load(f)


def build_board(board_data: dict) -> dict:
    """Transform existing board data into new format."""
    name = board_data["board"]
    short = BOARD_SHORT.get(name, name[:3].upper())

    members = []
    gave_count = 0
    total_given = 0.0

    for m in board_data.get("gave_fy26", []):
        amt = n(m.get("amount"))
        total_given += amt
        gave_count += 1
        members.append({
            "name": m["name"],
            "role": m.get("role", ""),
            "status": "gave",
            "fy26Amount": amt,
            "fy25Amount": 0,
        })

    for m in board_data.get("gave_fy25_only", []):
        gave_count += 1  # counts toward participation (they gave, just last year)
        members.append({
            "name": m["name"],
            "role": m.get("role", ""),
            "status": "lybunt",
            "fy26Amount": 0,
            "fy25Amount": n(m.get("amount")),
        })

    for m in board_data.get("not_given", []):
        members.append({
            "name": m["name"],
            "role": m.get("role", ""),
            "status": "no-record",
            "fy26Amount": 0,
            "fy25Amount": 0,
        })

    for m in board_data.get("not_matched", []):
        members.append({
            "name": m["name"],
            "role": m.get("role", ""),
            "status": "not-matched",
            "fy26Amount": 0,
            "fy25Amount": 0,
        })

    total = board_data.get("total_members", len(members))
    matched = board_data.get("matched_in_sf", 0)
    fy26_gave = len(board_data.get("gave_fy26", []))

    return {
        "name": name,
        "shortName": short,
        "totalMembers": total,
        "matchedInSF": matched,
        "gaveFY26": fy26_gave,
        "participationRate": round(n(board_data.get("participation_rate")), 1),
        "totalGiven": total_given,
        "totalFY25": n(board_data.get("total_fy25")),
        "members": members,
    }


def get_campaign_summary() -> dict:
    """Get Annual Campaign FY26 progress from Salesforce."""
    goal = 9_000_000

    # Get campaign raised amount
    recs = sf(
        "SELECT Id, Name, Total_Gift_Transactions__c, Gift_Commitments_All_Time__c "
        "FROM Campaign WHERE Name = 'Annual - FY26' LIMIT 1"
    )

    raised = 0
    if recs:
        r = recs[0]
        raised = n(r.get("Total_Gift_Transactions__c")) + n(r.get("Gift_Commitments_All_Time__c", 0))

    # Donor count
    donor_recs = sf(
        "SELECT COUNT(Id) cnt FROM GiftTransaction "
        "WHERE Campaign.Name = 'Annual - FY26' OR Campaign.Parent.Name = 'Annual - FY26' "
        "AND Status = 'Paid'"
    )
    donor_count = 0
    if donor_recs:
        donor_count = int(n(donor_recs[0].get("cnt", 0)))

    # Prior year for comparison
    prior_recs = sf(
        "SELECT Id, Total_Gift_Transactions__c, Gift_Commitments_All_Time__c "
        "FROM Campaign WHERE Name = 'Annual 2025' LIMIT 1"
    )
    prior_raised = 0
    if prior_recs:
        r = prior_recs[0]
        prior_raised = n(r.get("Total_Gift_Transactions__c")) + n(r.get("Gift_Commitments_All_Time__c", 0))

    yoy = ((raised - prior_raised) / prior_raised * 100) if prior_raised > 0 else 0

    return {
        "goal": goal,
        "raised": round(raised, 2),
        "pctOfGoal": round(raised / goal * 100, 1) if goal else 0,
        "donorCount": donor_count,
        "priorYearComparison": round(yoy, 1),
    }


def get_giving_levels() -> list:
    """Aggregate giving levels from board member data."""
    levels = [
        {"level": "$100K+", "min": 100000},
        {"level": "$25K–$99K", "min": 25000},
        {"level": "$10K–$24K", "min": 10000},
        {"level": "$5K–$9K", "min": 5000},
        {"level": "$1K–$4K", "min": 1000},
        {"level": "Under $1K", "min": 0},
    ]
    return levels


def classify_giving_levels(boards: list) -> list:
    """Build giving level distribution from all board members."""
    buckets = [
        {"level": "$100K+", "min": 100000, "donors": 0, "amount": 0},
        {"level": "$25K–$99K", "min": 25000, "donors": 0, "amount": 0},
        {"level": "$10K–$24K", "min": 10000, "donors": 0, "amount": 0},
        {"level": "$5K–$9K", "min": 5000, "donors": 0, "amount": 0},
        {"level": "$1K–$4K", "min": 1000, "donors": 0, "amount": 0},
        {"level": "Under $1K", "min": 0, "donors": 0, "amount": 0},
    ]

    for board in boards:
        for m in board["members"]:
            amt = m["fy26Amount"]
            if amt <= 0:
                continue
            for b in buckets:
                if amt >= b["min"]:
                    b["donors"] += 1
                    b["amount"] += amt
                    break

    return [{"level": b["level"], "donors": b["donors"], "amount": round(b["amount"], 2)} for b in buckets]


def main():
    existing = load_existing()

    # Build boards
    boards = [build_board(b) for b in existing["boards"]]

    # Refresh individual member amounts from Salesforce where possible
    # Query FY26 recognition for matched board members
    all_names = []
    for board in boards:
        for m in board["members"]:
            if m["status"] != "not-matched":
                all_names.append(m["name"])

    if all_names:
        # Query in batches
        name_amounts = {}
        batch_size = 30
        for i in range(0, len(all_names), batch_size):
            batch = all_names[i:i+batch_size]
            names_str = "', '".join(n.replace("'", "\\'") for n in batch)
            recs = sf(
                f"SELECT Name, Recognition_Amount_FY26__c, Recognition_Amount_FY25__c "
                f"FROM Account WHERE Name IN ('{names_str}') AND IsPersonAccount = true"
            )
            for r in recs:
                nm = r.get("Name", "")
                name_amounts[nm] = {
                    "fy26": n(r.get("Recognition_Amount_FY26__c")),
                    "fy25": n(r.get("Recognition_Amount_FY25__c")),
                }

        # Update board members with fresh SF data
        for board in boards:
            total_given = 0
            gave_count = 0
            for m in board["members"]:
                if m["name"] in name_amounts:
                    sf_data = name_amounts[m["name"]]
                    m["fy26Amount"] = sf_data["fy26"]
                    m["fy25Amount"] = sf_data["fy25"]
                    if sf_data["fy26"] > 0:
                        m["status"] = "gave"
                    elif sf_data["fy25"] > 0:
                        m["status"] = "lybunt"
                    else:
                        m["status"] = "no-record"

                if m["status"] == "gave":
                    gave_count += 1
                    total_given += m["fy26Amount"]

            board["gaveFY26"] = gave_count
            board["totalGiven"] = round(total_given, 2)
            board["participationRate"] = round(
                gave_count / board["totalMembers"] * 100, 1
            ) if board["totalMembers"] > 0 else 0

    # Campaign summary
    campaign = get_campaign_summary()

    # Giving levels
    giving_levels = classify_giving_levels(boards)

    # KPIs
    total_members = sum(b["totalMembers"] for b in boards)
    total_gave = sum(b["gaveFY26"] for b in boards)
    total_board_giving = sum(b["totalGiven"] for b in boards)
    total_fy25 = sum(b.get("totalFY25", 0) for b in boards)
    yoy_change = ((total_board_giving - total_fy25) / total_fy25 * 100) if total_fy25 > 0 else 0

    kpis = {
        "overallBoardParticipation": round(total_gave / total_members * 100, 1) if total_members else 0,
        "campaignPctOfGoal": campaign["pctOfGoal"],
        "totalBoardGiving": round(total_board_giving, 2),
        "yoyChange": round(yoy_change, 1),
    }

    # Highlights
    highlights = [
        {
            "metric": "Board Participation",
            "value": f"{kpis['overallBoardParticipation']}%",
            "trend": "up" if kpis["overallBoardParticipation"] > 25 else "down",
        },
        {
            "metric": "Campaign Progress",
            "value": f"{campaign['pctOfGoal']}%",
            "trend": "up" if campaign["pctOfGoal"] > 50 else "flat",
        },
        {
            "metric": "Board Giving Total",
            "value": f"${total_board_giving:,.0f}",
            "trend": "up" if yoy_change > 0 else "down",
        },
        {
            "metric": "YoY Change",
            "value": f"{yoy_change:+.1f}%",
            "trend": "up" if yoy_change > 0 else "down",
        },
    ]

    output = {
        "asOfDate": datetime.now().strftime("%Y-%m-%d"),
        "boards": boards,
        "campaignSummary": campaign,
        "givingLevels": giving_levels,
        "highlights": highlights,
        "kpis": kpis,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Board reporting data written to {OUTPUT}")
    print(f"   Boards: {len(boards)}")
    for b in boards:
        print(f"   - {b['shortName']}: {b['gaveFY26']}/{b['totalMembers']} ({b['participationRate']}%)")
    print(f"   Campaign: ${campaign['raised']:,.0f} / ${campaign['goal']:,.0f} ({campaign['pctOfGoal']}%)")


if __name__ == "__main__":
    main()
