#!/usr/bin/env python3
"""
Validate dashboard data JSON files against expected schemas.
Run: python3 scripts/validate-data.py [--fix]

With --fix: adds missing fields with safe defaults.
Without --fix: reports errors and exits non-zero if any found.
"""
import json
import sys
import os
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "public" / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path(__file__).parent.parent / "data"

FIX_MODE = "--fix" in sys.argv

# Schema definitions: { filename: { required_kpi_fields: {field: default}, required_top_fields: {field: default} } }
SCHEMAS = {
    "campaign-tracker": {
        "top": {
            "annualCampaign": {"raised": 0, "goal": 0, "pctOfGoal": 0, "donorCount": 0, "avgGift": 0},
            "topGiftsThisWeek": [],
            "asOfDate": "",
        },
        "kpis": {}  # nested under annualCampaign
    },
    "sharon-donor-health": {
        "top": {
            "failedRecurring": [],
            "refundsOver100": [],
            "newDonorsBySource": [],
            "firstToSecondConversions": [],
            "lapsedReactivated": [],
            "milestoneApproaching": [],
            "newRecurring": [],
            "cancelledRecurring": [],
            "dataQuality": {"score": 0, "overdueOpps": 0, "missingEmails": 0, "missingPhones": 0, "missingAddresses": 0, "duplicateSuspects": 0, "issues": []},
            "asOfDate": "",
            "newDonorsThisWeek": 0,
        },
        "kpis": {
            "failedChargesAmount": 0,
            "failedChargesCount": 0,
            "recurringRevenue": 0,
            "dataQualityScore": 0,
            "retentionRate": 0,
            "newDonorsThisWeek": 0,
        }
    },
    "stripe": {
        "top": {
            "monthlyData": [],
            "recentCharges": [],
            "asOfDate": "",
        },
        "kpis": {
            "grossVolume": 0,
            "netVolume": 0,
            "totalFees": 0,
            "feeRate": 0,
            "chargeCount": 0,
            "avgCharge": 0,
            "refundCount": 0,
            "refundAmount": 0,
        }
    },
    "givecloud": {
        "top": {
            "asOfDate": "",
        },
        "kpis": {
            "totalOnlineRevenue": 0,
            "totalContributions": 0,
            "totalSupporters": 0,
            "avgContribution": 0,
            "recurringRevenue": 0,
            "recurringCount": 0,
        }
    },
    "ramp-analytics": {
        "top": {
            "asOfDate": "",
        },
        "kpis": {
            "totalSpendFY26": 0,
            "totalTransactions": 0,
            "uniqueVendors": 0,
            "missingReceipts": 0,
        }
    },
    "james-ap-expense": {
        "top": {
            "asOfDate": "",
        },
        "kpis": {
            "totalSpendThisWeek": 0,
            "missingReceipts": 0,
            "receiptComplianceRate": 0,
            "policyExceptions": 0,
        }
    },
    "facilities": {
        "top": {
            "thermostats": [],
            "asOfDate": "",
        },
        "kpis": {
            "alertCount": 0,
            "online": 0,
            "offline": 0,
            "avgTemp": 0,
        }
    },
    "board-reporting": {
        "top": {
            "asOfDate": "",
        },
        "kpis": {
            "overallBoardParticipation": 0,
            "totalBoardMembers": 0,
            "totalGiving": 0,
        }
    },
    "drm-portfolio": {
        "top": {
            "asOfDate": "",
        },
        "kpis": {
            "totalPortfolioDonors": 0,
        }
    },
}

errors = []
fixes = []

for filename, schema in SCHEMAS.items():
    filepath = DATA_DIR / f"{filename}.json"
    if not filepath.exists():
        errors.append(f"MISSING FILE: {filepath}")
        continue

    try:
        data = json.loads(filepath.read_text())
    except json.JSONDecodeError as e:
        errors.append(f"INVALID JSON: {filepath}: {e}")
        continue

    modified = False

    # Check top-level fields
    for field, default in schema.get("top", {}).items():
        if field not in data:
            errors.append(f"{filename}: missing top-level field '{field}'")
            if FIX_MODE:
                data[field] = default
                modified = True
                fixes.append(f"{filename}: added '{field}' = {json.dumps(default)[:60]}")
        elif isinstance(default, dict) and isinstance(data[field], dict):
            # Check nested fields
            for subfield, subdefault in default.items():
                if subfield not in data[field]:
                    errors.append(f"{filename}: missing '{field}.{subfield}'")
                    if FIX_MODE:
                        data[field][subfield] = subdefault
                        modified = True
                        fixes.append(f"{filename}: added '{field}.{subfield}' = {json.dumps(subdefault)[:40]}")

    # Check kpis
    if schema.get("kpis"):
        if "kpis" not in data:
            errors.append(f"{filename}: missing 'kpis' object")
            if FIX_MODE:
                data["kpis"] = {}
                modified = True
        kpis = data.get("kpis", {})
        for field, default in schema["kpis"].items():
            if field not in kpis:
                errors.append(f"{filename}: missing 'kpis.{field}'")
                if FIX_MODE:
                    kpis[field] = default
                    modified = True
                    fixes.append(f"{filename}: added 'kpis.{field}' = {default}")
        if modified:
            data["kpis"] = kpis

    if modified:
        filepath.write_text(json.dumps(data, indent=2) + "\n")

# Summary
if fixes:
    print(f"\n✓ Fixed {len(fixes)} issues:")
    for f in fixes:
        print(f"  + {f}")

if errors:
    print(f"\n{'⚠' if FIX_MODE else '✗'} {len(errors)} schema issues found:")
    for e in errors:
        print(f"  - {e}")
    if not FIX_MODE:
        print("\nRun with --fix to auto-add missing fields with defaults.")
        sys.exit(1)
else:
    print("✓ All data files pass schema validation.")
