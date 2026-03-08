#!/usr/bin/env python3
"""
FY26 + FY27 Annual Campaign Simulation — Recognition-Based (ALL account types)
Person Account + Organization recognition. Not just person accounts.
"""

import json
from datetime import datetime
from pathlib import Path

OUTPUT = Path(__file__).parent.parent / "public" / "data" / "campaign-simulation.json"

# ── Recognition totals ───────────────────────────────────────────────────
# AUTHORITATIVE SOURCE: Campaign.Parent_Recognition_Amount_All_Time__c
# This is the deduplicated campaign total (no DAF double-counting).
# Person Account sum ($5.96M) is close but slightly under; campaign
# field ($6.14M) is the canonical number.
# Org accounts ($1.86M) are ~95% DAF pass-throughs — DO NOT ADD to person.
FY24_FINAL = 15_332_362.05   # TODO: pull from FY24 campaign record
FY25_FINAL =  8_812_417.17   # FY25 campaign final
FY26_YTD   =  6_142_437.00   # Campaign Parent_Recognition_Amount_All_Time__c (Mar 7, 2026)

FY26_GOAL = 9_000_000
FY27_GOAL = 9_500_000  # Placeholder

# ── Monthly transaction data (timing proxy) ──────────────────────────────
FY24_MONTHLY = {
    "Jul": 277_506, "Aug": 205_504, "Sep": 1_189_878, "Oct": 4_891_547,
    "Nov": 2_151_806, "Dec": 2_980_057, "Jan": 2_005_287, "Feb": 1_468_243,
    "Mar": 208_811, "Apr": 234_609, "May": 2_636_365, "Jun": 905_065,
}
FY25_MONTHLY = {
    "Jul": 311_667, "Aug": 349_705, "Sep": 1_352_726, "Oct": 574_242,
    "Nov": 930_821, "Dec": 3_794_361, "Jan": 2_267_575, "Feb": 1_136_334,
    "Mar": 1_209_850, "Apr": 816_483, "May": 2_848_917, "Jun": 643_816,
}
FY26_MONTHLY = {
    "Jul": 1_405_656, "Aug": 1_095_700, "Sep": 708_840, "Oct": 589_436,
    "Nov": 1_289_866, "Dec": 3_091_206, "Jan": 2_548_053, "Feb": 351_456,
    "Mar": 128_245,
}
MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]

# ── Known Intelligence ───────────────────────────────────────────────────
FY26_ADJUSTMENTS = [
    {
        "donor": "Ernest Rady",
        "description": "Declined annual fund gift for FY26. Redirecting to Israel campaign. Already reflected in YTD — no additional subtraction.",
        "fy25_amount": 1_000_000, "fy26_expected": 0, "impact": 0,
        "note": "Impact is vs FY25, not vs FY26 YTD. His absence is already in the $6.14M.",
    }
]
# Rady's absence is already in FY26 YTD — do NOT subtract again
fy26_known = 0  # Recognition can only go up from here

FY27_ADJUSTMENTS = [
    {
        "donor": "Ernest Rady",
        "description": "Israel campaign preference assumed to continue. Already absent from FY26 base — no additional subtraction. Flag for DRM: potential re-engagement opportunity.",
        "prior_amount": 1_000_000, "fy27_expected": 0, "impact": 0,
        "note": "His absence is baked into FY26 projected base. Same monotonic rule.",
    }
]
# Rady already absent from FY26 base → no additional subtraction for FY27
fy27_known = 0

# ═══════════════════════════════════════════════════════════════════════
# FY26 SIMULATION — We're at $7.81M with ~4 months left
# ═══════════════════════════════════════════════════════════════════════
# H2 growth: how much more recognition will land Mar-Jun?
# LOW = 10% (minimal new commitments, most already booked)
# MED = 17% (avg historical H2 pattern, discounted for recognition front-loading)
# HIGH = 25% (strong spring campaign push + major gift closes)

FY26_GROWTH = {"low": 0.10, "medium": 0.17, "high": 0.25}

fy26_scenarios = {}
for key, growth in FY26_GROWTH.items():
    proj = FY26_YTD * (1 + growth) + fy26_known
    fy26_scenarios[key] = {
        "label": {"low": "Conservative", "medium": "Base Case", "high": "Optimistic"}[key],
        "projected": round(proj),
        "description": {
            "low": f"Minimal new commitments (+{growth:.0%} H2). Rady -$1M.",
            "medium": f"Historical avg H2 pattern (+{growth:.0%}). Rady -$1M.",
            "high": f"Strong spring push + major gift closes (+{growth:.0%}). Rady -$1M.",
        }[key],
        "vsGoal": round(proj - FY26_GOAL),
        "vsGoalPct": round((proj / FY26_GOAL - 1) * 100, 1),
        "vsFY25": round(proj - FY25_FINAL),
        "vsFY25Pct": round((proj / FY25_FINAL - 1) * 100, 1),
        "h2Growth": f"{growth:.0%}",
    }

fy26_med_proj = FY26_YTD * (1 + FY26_GROWTH["medium"]) + fy26_known

# ═══════════════════════════════════════════════════════════════════════
# FY27 SIMULATION — Full-year projection from zero
# ═══════════════════════════════════════════════════════════════════════
# Revenue retention: major donors retain at ~95%, small donors at ~50%
# Blended revenue retention is ~85-90% (higher than donor count retention)
# Plus new donor acquisition and upgrade potential

# FY27 = FY26 base × growth factor. Rady absence already in FY26 base.
# LOW: 10% erosion (continued donor attrition, soft economy)
# MED: Flat (hold the line — retention + acquisition balance out)
# HIGH: 10% growth (strong campaign, pipeline wins, upgrades)
FY27_REV_RETENTION = {"low": 0.90, "medium": 1.00, "high": 1.10}
FY27_LABELS = {"low": "Decline", "medium": "Hold Steady", "high": "Growth"}
FY27_DESCS = {
    "low": "10% erosion — continued attrition, soft economy, no major new donors.",
    "medium": "Flat year — retention + new acquisition offset losses. Hold the line.",
    "high": "10% growth — strong spring campaign, pipeline wins, donor upgrades.",
}

fy27_scenarios = {}
for key, rev_ret in FY27_REV_RETENTION.items():
    proj = fy26_med_proj * rev_ret + fy27_known
    fy27_scenarios[key] = {
        "label": FY27_LABELS[key],
        "projected": round(proj),
        "description": FY27_DESCS[key],
        "vsGoal": round(proj - FY27_GOAL),
        "vsGoalPct": round((proj / FY27_GOAL - 1) * 100, 1),
        "vsFY26Med": round(proj - fy26_med_proj),
        "vsFY26Pct": round((proj / fy26_med_proj - 1) * 100, 1),
        "revenueRetention": f"{rev_ret:.0%}",
    }

# ── Chart data ───────────────────────────────────────────────────────────
def cumulative(monthly, months):
    result, running = [], 0
    for m in months:
        running += monthly.get(m, 0)
        result.append(round(running))
    return result

fy24_cum = cumulative(FY24_MONTHLY, MONTHS)
fy25_cum = cumulative(FY25_MONTHLY, MONTHS)
fy26_actual_months = list(FY26_MONTHLY.keys())
fy26_actual_cum = cumulative(FY26_MONTHLY, fy26_actual_months)

# Project FY26 remaining months
def project_fy26_monthly(growth_rate, base_pattern):
    actual_total = sum(FY26_MONTHLY.values())
    projected_total = FY26_YTD * (1 + growth_rate) + fy26_known
    remaining = projected_total - actual_total
    future = ["Apr", "May", "Jun"]
    base_future = sum(base_pattern.get(m, 0) for m in future)
    result = dict(FY26_MONTHLY)
    for m in future:
        pct = base_pattern.get(m, 0) / base_future if base_future else 1/3
        result[m] = max(0, remaining * pct)
    return result

fy26_low_m = project_fy26_monthly(0.10, FY25_MONTHLY)
fy26_med_m = project_fy26_monthly(0.17, FY25_MONTHLY)
fy26_high_m = project_fy26_monthly(0.25, FY24_MONTHLY)

fy26_low_cum = cumulative(fy26_low_m, MONTHS)
fy26_med_cum = cumulative(fy26_med_m, MONTHS)
fy26_high_cum = cumulative(fy26_high_m, MONTHS)

# FY27 monthly from total using FY25 pattern
def monthly_from_total(total, pattern):
    pat_total = sum(pattern.values())
    return {m: total * (pattern[m] / pat_total) for m in MONTHS}

fy27_low_proj = fy26_med_proj * 0.82 + fy27_known
fy27_med_proj = fy26_med_proj * 0.90 + fy27_known
fy27_high_proj = fy26_med_proj * 1.00 + fy27_known

fy27_low_cum = cumulative(monthly_from_total(fy27_low_proj, FY25_MONTHLY), MONTHS)
fy27_med_cum = cumulative(monthly_from_total(fy27_med_proj, FY25_MONTHLY), MONTHS)
fy27_high_cum = cumulative(monthly_from_total(fy27_high_proj, FY25_MONTHLY), MONTHS)

# ── Variables & Skeptic ──────────────────────────────────────────────────
variables = [
    {"name": "FY24 Recognition", "value": f"${FY24_FINAL:,.0f}", "note": "All accounts. Anomalously high — includes one-time major gifts."},
    {"name": "FY25 Recognition", "value": f"${FY25_FINAL:,.0f}", "note": "All accounts. Best comparable baseline (Person $8.8M + Org $2.7M)."},
    {"name": "FY26 YTD", "value": f"${FY26_YTD:,.0f}", "note": "Person $5.96M + Org $1.86M. As of March 7, 2026."},
    {"name": "FY26 % of Goal", "value": f"{FY26_YTD/FY26_GOAL*100:.0f}%", "note": f"${FY26_GOAL - FY26_YTD:,.0f} to go."},
    {"name": "Rady Impact", "value": "-$1M (both years)", "note": "FY26: confirmed. FY27: assumed continuation."},
    {"name": "Donor Retention", "value": "53.6%", "note": "Count-based. Revenue retention is higher (~85-90%) because major donors retain better."},
    {"name": "Org Gifts", "value": f"${1_855_087:,.0f}", "note": "50 organizations. Lumpy — one grant can swing ±$500K."},
    {"name": "Spring Major Gifts", "value": "Swing factor", "note": "Apr-Jun is peak solicitation. A single $500K close jumps scenarios."},
]

skeptics = [
    f"Already at ${FY26_YTD:,.0f} (87% of goal). Even conservative scenario should land above $8M.",
    "The $9M goal may have assumed Rady. Effective goal without him: $8M — which we're on track to exceed.",
    "Organization gifts ($1.86M from 50 orgs) are lumpy. One large foundation = big swing either direction.",
    "FY27 is pure projection — retention rates, economic conditions, and Israel campaign duration all uncertain.",
    "Revenue retention ≠ donor retention. Top 20 donors account for ~60% of total; they retain at 90%+.",
    "Recognition ≠ cash. $500K pledge counts now, cash arrives over years. See Cash Forecast dashboard.",
]

# ── Output ───────────────────────────────────────────────────────────────
output = {
    "generatedAt": datetime.now().isoformat(),
    "asOfDate": "2026-03-07",
    "recognition": {"FY24": FY24_FINAL, "FY25": FY25_FINAL, "FY26_YTD": FY26_YTD},
    "fy26": {
        "goal": FY26_GOAL,
        "ytd": FY26_YTD,
        "ytdPctOfGoal": round(FY26_YTD / FY26_GOAL * 100, 1),
        "scenarios": fy26_scenarios,
        "knownAdjustments": FY26_ADJUSTMENTS,
        "chart": {
            "months": MONTHS,
            "fy24Cumulative": fy24_cum, "fy25Cumulative": fy25_cum,
            "fy26ActualMonths": fy26_actual_months, "fy26ActualCumulative": fy26_actual_cum,
            "fy26LowCumulative": fy26_low_cum, "fy26MedCumulative": fy26_med_cum,
            "fy26HighCumulative": fy26_high_cum,
            "goalLine": FY26_GOAL,
        },
    },
    "fy27": {
        "goal": FY27_GOAL,
        "baseline": round(fy26_med_proj),
        "baselineNote": "FY26 base case projection used as FY27 starting point",
        "scenarios": fy27_scenarios,
        "knownAdjustments": FY27_ADJUSTMENTS,
        "chart": {
            "months": MONTHS,
            "fy25Cumulative": fy25_cum,
            "fy26MedCumulative": fy26_med_cum,
            "fy27LowCumulative": fy27_low_cum, "fy27MedCumulative": fy27_med_cum,
            "fy27HighCumulative": fy27_high_cum,
            "goalLine": FY27_GOAL,
        },
    },
    "variables": variables,
    "skepticsNotes": skeptics,
}

OUTPUT.write_text(json.dumps(output, indent=2))
print(f"Written to {OUTPUT}")
print(f"\n{'='*60}")
print(f"FY26 Annual Campaign (All Accounts)")
print(f"{'='*60}")
print(f"  Goal:          ${FY26_GOAL:>12,.0f}")
print(f"  YTD:           ${FY26_YTD:>12,.0f}  ({FY26_YTD/FY26_GOAL*100:.0f}%)")
print(f"  Rady:          ${fy26_known:>+12,.0f}")
for k in ["low", "medium", "high"]:
    s = fy26_scenarios[k]
    print(f"  {s['label']:14s}: ${s['projected']:>12,.0f}  ({s['projected']/FY26_GOAL*100:.0f}% of goal)")

print(f"\n{'='*60}")
print(f"FY27 Annual Campaign (Projected)")
print(f"{'='*60}")
print(f"  Goal:          ${FY27_GOAL:>12,.0f}")
print(f"  Baseline:      ${fy26_med_proj:>12,.0f}")
print(f"  Rady:          ${fy27_known:>+12,.0f}")
for k in ["low", "medium", "high"]:
    s = fy27_scenarios[k]
    print(f"  {s['label']:14s}: ${s['projected']:>12,.0f}  ({s['projected']/FY27_GOAL*100:.0f}% of goal)")
