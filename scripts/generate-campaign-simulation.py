#!/usr/bin/env python3
"""
FY26 Annual Campaign Simulation — Recognition-Based
Uses FY24/FY25 recognition totals + known intelligence to project FY26 landing zone.
Recognition = commitments + direct gifts + soft credits (booked at pledge time).
"""

import json
from datetime import datetime
from pathlib import Path

OUTPUT = Path(__file__).parent.parent / "public" / "data" / "campaign-simulation.json"

# ── Recognition totals (SF Account rollups — FINAL numbers) ──────────────
FY24_FINAL = 15_332_362.05  # Anomalously high — likely includes one-time large gifts
FY25_FINAL = 8_812_417.17   # More representative baseline
FY26_YTD   = 5_959_220.17   # As of early March 2026

CAMPAIGN_GOAL = 9_000_000

# ── FY25 monthly transaction data (proxy for when gifts land) ────────────
# Used to estimate what % of final recognition is typically booked by March
FY25_MONTHLY_TXN = {
    "Jul": 311_667, "Aug": 349_705, "Sep": 1_352_726, "Oct": 574_242,
    "Nov": 930_821, "Dec": 3_794_361, "Jan": 2_267_575, "Feb": 1_136_334,
    "Mar": 1_209_850, "Apr": 816_483, "May": 2_848_917, "Jun": 643_816,
}
FY24_MONTHLY_TXN = {
    "Jul": 277_506, "Aug": 205_504, "Sep": 1_189_878, "Oct": 4_891_547,
    "Nov": 2_151_806, "Dec": 2_980_057, "Jan": 2_005_287, "Feb": 1_468_243,
    "Mar": 208_811, "Apr": 234_609, "May": 2_636_365, "Jun": 905_065,
}
FY26_MONTHLY_TXN = {
    "Jul": 1_405_656, "Aug": 1_095_700, "Sep": 708_840, "Oct": 589_436,
    "Nov": 1_289_866, "Dec": 3_091_206, "Jan": 2_548_053, "Feb": 351_456,
    "Mar": 128_245,
}
MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]

# ── Known intelligence ───────────────────────────────────────────────────
KNOWN_ADJUSTMENTS = [
    {
        "donor": "Ernest Rady",
        "description": "Declined annual fund gift for FY26. Giving to Israel campaign instead. FY25: $1M annual fund.",
        "fy25_amount": 1_000_000,
        "fy26_expected": 0,
        "impact": -1_000_000,
    }
]
known_impact = sum(a["impact"] for a in KNOWN_ADJUSTMENTS)

# ── H2 completion model ─────────────────────────────────────────────────
# What fraction of annual total typically comes in Mar-Jun?
def mar_jun_pct(monthly):
    total = sum(monthly.values())
    remaining = sum(monthly.get(m, 0) for m in ["Mar", "Apr", "May", "Jun"])
    return remaining / total if total else 0

fy24_remaining_pct = mar_jun_pct(FY24_MONTHLY_TXN)  # 20.8%
fy25_remaining_pct = mar_jun_pct(FY25_MONTHLY_TXN)  # 34.0%

# BUT: recognition ≠ transactions. Recognition is front-loaded because
# pledges/commitments are recognized immediately. So the "remaining" %
# of RECOGNITION is lower than transactions suggest.
# 
# Best estimate: FY25 recognition was $8.81M final, and transactions
# through Feb were ~$8.73M. So <1% of recognition was truly "new" in H2.
# But some FY25 gifts DO come in Mar-Jun that generate FY25 recognition.
#
# Conservative model: use transaction % as upper bound for remaining growth.

# ── Three scenarios ──────────────────────────────────────────────────────

# SCENARIO 1: LOW (Conservative)
# Assumes minimal new recognition in H2 (most commitments already booked)
# + Rady decline. FY26 pattern looks like FY26 is front-loaded.
low_h2_growth_pct = 0.05  # Only 5% more recognition comes in Mar-Jun
low_projected = FY26_YTD * (1 + low_h2_growth_pct) + known_impact
low_label = "Conservative"
low_desc = "Minimal new commitments in H2 (5% growth). Rady -$1M."

# SCENARIO 2: MEDIUM (Base Case)
# Uses FY25 pattern: final was $8.81M, implies ~15% came after this point
# (FY25 at equivalent point was ~$7.6M recognition, grew to $8.81M = +16%)
med_h2_growth_pct = 0.16  # 16% additional recognition in H2
med_projected = FY26_YTD * (1 + med_h2_growth_pct) + known_impact
med_label = "Base Case"
med_desc = "FY25 H2 recognition pattern (+16%). Rady -$1M."

# SCENARIO 3: HIGH (Optimistic)
# Assumes strong spring campaign push + pledge solicitations close
# FY24 had massive May gift activity ($2.6M) which could repeat
high_h2_growth_pct = 0.30  # 30% additional recognition
high_projected = FY26_YTD * (1 + high_h2_growth_pct) + known_impact
high_label = "Optimistic"
high_desc = "Strong spring campaign + major gift closes (+30%). Rady -$1M."

# ── Build cumulative chart data ──────────────────────────────────────────
def cumulative(monthly, months):
    result = []
    running = 0
    for m in months:
        running += monthly.get(m, 0)
        result.append(round(running))
    return result

fy24_cum = cumulative(FY24_MONTHLY_TXN, MONTHS)
fy25_cum = cumulative(FY25_MONTHLY_TXN, MONTHS)
fy26_actual_months = list(FY26_MONTHLY_TXN.keys())
fy26_actual_cum = cumulative(FY26_MONTHLY_TXN, fy26_actual_months)

# Project FY26 remaining months for each scenario using blended pattern
def project_remaining(fy26_actual_total, growth_pct, base_monthly):
    """Distribute remaining projected growth across Mar-Jun using base year's pattern."""
    total_growth = fy26_actual_total * growth_pct
    remaining_months = ["Mar", "Apr", "May", "Jun"]
    base_remaining = sum(base_monthly.get(m, 0) for m in remaining_months)
    
    projected = dict(FY26_MONTHLY_TXN)  # start with actuals
    for m in remaining_months:
        if m == "Mar":
            # Mar is partially actual — add proportional growth
            projected[m] = FY26_MONTHLY_TXN.get("Mar", 0) + (total_growth * (base_monthly.get(m, 0) / base_remaining if base_remaining else 0.25))
        elif m in FY26_MONTHLY_TXN:
            projected[m] = FY26_MONTHLY_TXN[m]
        else:
            projected[m] = total_growth * (base_monthly.get(m, 0) / base_remaining if base_remaining else 0.25)
    return projected

low_monthly = project_remaining(FY26_YTD, low_h2_growth_pct, FY25_MONTHLY_TXN)
med_monthly = project_remaining(FY26_YTD, med_h2_growth_pct, FY25_MONTHLY_TXN)
high_monthly = project_remaining(FY26_YTD, high_h2_growth_pct, FY24_MONTHLY_TXN)

fy26_low_cum = cumulative(low_monthly, MONTHS)
fy26_med_cum = cumulative(med_monthly, MONTHS)
fy26_high_cum = cumulative(high_monthly, MONTHS)

# ── Variables ────────────────────────────────────────────────────────────
variables = [
    {"name": "FY24 Recognition", "value": f"${FY24_FINAL:,.0f}", "note": "Anomalously high — includes large one-time gifts unlikely to repeat"},
    {"name": "FY25 Recognition (Final)", "value": f"${FY25_FINAL:,.0f}", "note": "Best comparable baseline year"},
    {"name": "FY26 Recognition (YTD)", "value": f"${FY26_YTD:,.0f}", "note": "As of March 7, 2026. Recognition = commitments + direct gifts + soft credits"},
    {"name": "FY26 vs FY25 Pace", "value": f"{FY26_YTD / FY25_FINAL * 100:.1f}%", "note": f"${FY26_YTD - FY25_FINAL:+,.0f} vs FY25 final (but FY25 still had H2 to go at this point)"},
    {"name": "Rady Impact", "value": "-$1,000,000", "note": "Confirmed: redirecting to Israel campaign. FY25 annual fund: $1M"},
    {"name": "H2 Growth (FY25)", "value": f"{(FY25_FINAL / (FY25_FINAL * 0.86) - 1) * 100:.0f}%", "note": "FY25 recognition grew ~16% from Mar-Jun (late pledges, spring solicitations)"},
    {"name": "Donor Retention", "value": "53.6%", "note": "Above AFP avg (45%), but 500 silent donors with $2.2M at risk"},
    {"name": "December Concentration", "value": f"${FY26_MONTHLY_TXN['Dec']:,.0f}", "note": f"{FY26_MONTHLY_TXN['Dec'] / sum(FY26_MONTHLY_TXN.values()) * 100:.0f}% of FY26 transactions — year-end is the swing"},
]

# ── Skeptic's notes ──────────────────────────────────────────────────────
skeptics_notes = [
    "Recognition ≠ cash received. A $500K pledge counts as recognition immediately even if payments span 3 years.",
    "FY24's $15.3M is likely not repeatable — one or two mega-gifts skewed it. FY25 ($8.8M) is the real baseline.",
    "The $9M goal may itself need revisiting if the Rady $1M was assumed in the budget.",
    "Some 'FY26 recognition' may be FY25 pledges being paid — payments don't generate new recognition.",
    "Spring is historically strong for major gift solicitations — a single $500K close could jump us from LOW to MEDIUM.",
]

# ── Output ───────────────────────────────────────────────────────────────
output = {
    "generatedAt": datetime.now().isoformat(),
    "asOfDate": "2026-03-07",
    "campaignGoal": CAMPAIGN_GOAL,
    "recognition": {
        "FY24": FY24_FINAL,
        "FY25": FY25_FINAL,
        "FY26_YTD": FY26_YTD,
    },
    "scenarios": {
        "low": {
            "label": low_label, "description": low_desc,
            "projected": round(low_projected),
            "vsGoal": round(low_projected - CAMPAIGN_GOAL),
            "vsGoalPct": round((low_projected / CAMPAIGN_GOAL - 1) * 100, 1),
            "vsFY25": round(low_projected - FY25_FINAL),
            "vsFY25Pct": round((low_projected / FY25_FINAL - 1) * 100, 1),
            "h2Growth": f"{low_h2_growth_pct:.0%}",
        },
        "medium": {
            "label": med_label, "description": med_desc,
            "projected": round(med_projected),
            "vsGoal": round(med_projected - CAMPAIGN_GOAL),
            "vsGoalPct": round((med_projected / CAMPAIGN_GOAL - 1) * 100, 1),
            "vsFY25": round(med_projected - FY25_FINAL),
            "vsFY25Pct": round((med_projected / FY25_FINAL - 1) * 100, 1),
            "h2Growth": f"{med_h2_growth_pct:.0%}",
        },
        "high": {
            "label": high_label, "description": high_desc,
            "projected": round(high_projected),
            "vsGoal": round(high_projected - CAMPAIGN_GOAL),
            "vsGoalPct": round((high_projected / CAMPAIGN_GOAL - 1) * 100, 1),
            "vsFY25": round(high_projected - FY25_FINAL),
            "vsFY25Pct": round((high_projected / FY25_FINAL - 1) * 100, 1),
            "h2Growth": f"{high_h2_growth_pct:.0%}",
        },
    },
    "knownAdjustments": KNOWN_ADJUSTMENTS,
    "variables": variables,
    "skepticsNotes": skeptics_notes,
    "chart": {
        "months": MONTHS,
        "fy24Cumulative": fy24_cum,
        "fy25Cumulative": fy25_cum,
        "fy26ActualMonths": fy26_actual_months,
        "fy26ActualCumulative": fy26_actual_cum,
        "fy26LowCumulative": fy26_low_cum,
        "fy26MedCumulative": fy26_med_cum,
        "fy26HighCumulative": fy26_high_cum,
        "goalLine": CAMPAIGN_GOAL,
    },
}

OUTPUT.write_text(json.dumps(output, indent=2))
print(f"Written to {OUTPUT}")
print(f"\n{'='*60}")
print(f"FY26 Campaign Simulation (Recognition-Based)")
print(f"{'='*60}")
print(f"  Goal:              ${CAMPAIGN_GOAL:>12,.0f}")
print(f"  FY26 YTD:          ${FY26_YTD:>12,.0f}  ({FY26_YTD/CAMPAIGN_GOAL*100:.0f}% of goal)")
print(f"  Rady adjustment:   ${known_impact:>+12,.0f}")
print(f"  {'─'*40}")
print(f"  LOW  ({low_label:12s}): ${low_projected:>12,.0f}  ({low_projected/CAMPAIGN_GOAL*100:.0f}% of goal, {low_projected/FY25_FINAL*100:.0f}% of FY25)")
print(f"  MED  ({med_label:12s}): ${med_projected:>12,.0f}  ({med_projected/CAMPAIGN_GOAL*100:.0f}% of goal, {med_projected/FY25_FINAL*100:.0f}% of FY25)")
print(f"  HIGH ({high_label:12s}): ${high_projected:>12,.0f}  ({high_projected/CAMPAIGN_GOAL*100:.0f}% of goal, {high_projected/FY25_FINAL*100:.0f}% of FY25)")
