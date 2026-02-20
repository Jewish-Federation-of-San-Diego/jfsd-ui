#!/usr/bin/env python3
"""
Generate financial-statements.json for the JFSD Financial Statements Dashboard.
Queries Sage Intacct SQLite database with account groupings from the PDF generator.
"""

import sqlite3
import json
import os
from datetime import datetime
from collections import defaultdict

# ─── Paths ───────────────────────────────────────────────────────────────────
DB_PATH = os.path.expanduser('~/clawd/projects/sage-intacct/data/jfsd-gl.db')
OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'financial-statements.json')

# ─── FY26 boundaries ────────────────────────────────────────────────────────
FY26_START = datetime(2025, 7, 1)
FY26_END = datetime(2026, 6, 30)

# Prior year boundaries (same relative period)
PY_BS_END = None  # set dynamically
PY_START = None
PY_END = None

MONTH_NAMES = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
BUDGET_COLS = ['jul_2025', 'aug_2025', 'sep_2025', 'oct_2025', 'nov_2025', 'dec_2025',
               'jan_2026', 'feb_2026', 'mar_2026', 'apr_2026', 'may_2026', 'jun_2026']

# ─── Department → Functional Mapping ────────────────────────────────────────
DEPT_TO_FUNC = {
    'Programs': 'Grant Making and Related',
    'Engagement': 'Grant Making and Related',
    'Global Relations': 'Grant Making and Related',
    'Grantmaking': 'Grant Making and Related',
    'Israel Connections': 'Grant Making and Related',
    'Mission': 'Grant Making and Related',
    'Overseas': 'Grant Making and Related',
    'Community Chaplain': 'Grant Making and Related',
    'Admin': 'Management and General',
    'Marketing': 'Management and General',
    'Development': 'Fundraising',
}
GRANT_ACCOUNTS = {'60000', '60005', '60007', '60010', '62255'}

# ─── Account groupings (from generate_financial_statements.py) ───────────────

# Balance Sheet
CASH_ACCTS = ['10000', '10001', '10003', '10004', '10050', '10200', '10900', '11998', '11999']
INVESTMENTS_ACCTS = ['10320']
PLEDGES_RECV_ACCTS = ['12050', '12200', '12299']
OTHER_CURRENT_ACCTS = ['12000', '12105']
PREPAID_ACCTS = ['14000']
INVENTORY_ACCTS = ['14100']
ENDOWMENT_ACCTS = [f'123{str(i).zfill(2)}' for i in range(0, 26)]
FIXED_ASSET_ACCTS = ['15200', '15300', '15400', '15500', '15600', '15800', '15900', '15999']
ROU_ASSET_ACCTS = ['18100']
BOARD_RESERVE_ACCTS = ['19000', '19070', '19080', '19091']
INTERCO_ACCTS = ['12500']
OTHER_ASSET_ACCTS = ['17100', '18300', '19200']

AP_ACCTS = ['20000', '20010', '20015', '20099', '21000']
GRANTS_PAY_ACCTS = ['20100']
CC_ACCTS = ['20200', '20205', '20255', '20300']
DEFERRED_REV_ACCTS = ['27000']
LEASE_CURRENT_ACCTS = ['23200']
LEASE_LT_ACCTS = ['23250']
HFL_ACCTS = ['22000']
TRUST_ACCTS = ['23070', '23100', '23300', '23400', '23450', '24000']

# Revenue groupings
CONTRIB_ACCTS = ['40000', '40015', '40300', '40501']
PROGRAM_REV_ACCTS = ['42000']
UNREALIZED_BENEF_ACCTS = ['49200']
RELEASE_ACCTS = ['49990']
INT_DIV_ACCTS = ['49000', '49025']
REALIZED_GAIN_ACCTS = ['49100']
UNREALIZED_GAIN_ACCTS = ['49075']
INV_EXPENSE_ACCTS = ['63500']
GRANT_REV_ACCTS = ['41000']
MGMT_FEE_ACCTS = ['45000']
MISSION_REV_ACCTS = ['47000']
SPECIAL_EVENTS_ACCTS = ['43000', '43005']
OTHER_REV_ACCTS = ['40005', '40100', '46000', '48000', '48005', '48010', '48999']

# Expense groupings
GRANT_LOCAL_ACCTS = ['60000']
GRANT_DESIGNATED_ACCTS = ['60005', '60007', '62255']
GRANT_STIPEND_ACCTS = ['60010']

# Functional expense categories
FE_GRANTS = ['60000', '60005', '60007', '60010', '62255']
FE_SALARIES = ['50000', '50010', '50025', '50050', '50075', '50100', '50125', '50150', '50155', '50175']
FE_TRAVEL = ['61200', '64200', '75000', '75025', '75050', '75075', '75100', '75125']
FE_PROFESS = ['61000', '61025', '61050', '61075', '61900']
FE_EVENTS = ['61800', '63000', '63100', '62100', '62200']
FE_FACILITIES = ['62000', '62025', '62048', '62060', '62075', '65650']
FE_OTHER = ['64000', '64010', '64100', '65050', '65300', '70000', '70020', '70025',
            '70050', '70080', '71000', '76000', '76025', '79000', '79100', '63150']
FE_BANK = ['70075']
FE_SECURITY = ['66050']

ALL_EXPENSE_ACCTS = FE_GRANTS + FE_SALARIES + FE_TRAVEL + FE_PROFESS + FE_EVENTS + FE_FACILITIES + FE_OTHER + FE_BANK + FE_SECURITY
ALL_REV_ACCTS = (CONTRIB_ACCTS + PROGRAM_REV_ACCTS + UNREALIZED_BENEF_ACCTS + RELEASE_ACCTS +
                 INT_DIV_ACCTS + REALIZED_GAIN_ACCTS + UNREALIZED_GAIN_ACCTS + INV_EXPENSE_ACCTS +
                 GRANT_REV_ACCTS + MGMT_FEE_ACCTS + MISSION_REV_ACCTS + SPECIAL_EVENTS_ACCTS + OTHER_REV_ACCTS)


def parse_date(d):
    try:
        parts = d.split('/')
        return datetime(int(parts[2]), int(parts[0]), int(parts[1]))
    except:
        return None


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    rows = cur.execute(
        "SELECT entry_date, account, account_title, department_title, "
        "restriction_id, project_name, amount FROM gl_details"
    ).fetchall()

    # Find latest FY26 date to determine period
    latest_fy26 = None
    for row in rows:
        dt = parse_date(row['entry_date'])
        if dt and FY26_START <= dt <= FY26_END:
            if latest_fy26 is None or dt > latest_fy26:
                latest_fy26 = dt

    if not latest_fy26:
        print("No FY26 data found!")
        return

    # Determine how many months of data we have
    months_elapsed = (latest_fy26.month - 7) % 12 + 1  # Jul=1, Aug=2, etc.
    
    # Prior year boundaries
    py_bs_end = latest_fy26.replace(year=latest_fy26.year - 1)
    py_start = datetime(2024, 7, 1)
    py_end = py_bs_end

    # ── Accumulators ─────────────────────────────────────────────────────
    bal = defaultdict(float)           # all-time balance
    fy26 = defaultdict(float)          # FY26 YTD
    fy26_r = defaultdict(lambda: defaultdict(float))  # FY26 by acct×restriction
    fy26_d = defaultdict(lambda: defaultdict(float))  # FY26 by acct×dept
    py_balance = defaultdict(float)    # cumulative through prior year BS date
    py_activity = defaultdict(float)   # prior year same-period activity
    monthly = defaultdict(lambda: defaultdict(float))  # month_idx -> acct -> amount

    for row in rows:
        ds = row['entry_date']
        acct = row['account']
        dept = row['department_title'] or ''
        restr = str(row['restriction_id']) if row['restriction_id'] else ''
        amt = row['amount'] or 0

        dt = parse_date(ds)
        if not dt:
            continue

        bal[acct] += amt

        if dt <= py_bs_end:
            py_balance[acct] += amt
        if py_start <= dt <= py_end:
            py_activity[acct] += amt

        if FY26_START <= dt <= latest_fy26:
            fy26[acct] += amt
            fy26_r[acct][restr] += amt
            fy26_d[acct][dept] += amt
            # Monthly bucket (0=Jul, 1=Aug, etc.)
            mi = (dt.month - 7) % 12
            monthly[mi][acct] += amt

    # ── Budget ───────────────────────────────────────────────────────────
    budget_full = defaultdict(float)  # full year
    budget_ytd = defaultdict(float)   # YTD (months with data)

    brows = cur.execute("SELECT acct_no, " + ", ".join(BUDGET_COLS) + " FROM budget").fetchall()
    for r in brows:
        acct = r['acct_no']
        for i in range(12):
            v = r[BUDGET_COLS[i]] or 0
            budget_full[acct] += v
            if i < months_elapsed:
                budget_ytd[acct] += v

    conn.close()

    # ── Helper functions ─────────────────────────────────────────────────
    def s(accts, src=None):
        if src is None: src = bal
        return sum(src.get(a, 0) for a in accts)

    def sr(accts, restr):
        return sum(fy26_r[a].get(restr, 0) for a in accts)

    def sf(accts, func):
        """Sum by functional category."""
        total = 0
        for a in accts:
            for dept, amt in fy26_d[a].items():
                if a in GRANT_ACCOUNTS:
                    mapped = 'Grant Making and Related'
                else:
                    mapped = DEPT_TO_FUNC.get(dept, 'Management and General')
                if mapped == func:
                    total += amt
        return total

    def neg(v):
        """Negate for revenue (GL stores as negative credits)."""
        return -v

    def r2(v):
        return round(v, 2)

    # ── A. Balance Sheet ─────────────────────────────────────────────────
    def bs_line(name, accts, negate=False):
        v = s(accts)
        pv = s(accts, py_balance)
        if negate:
            v, pv = -v, -pv
        return {"name": name, "amount": r2(v), "priorYear": r2(pv)}

    cash_val = s(CASH_ACCTS)
    cash_py = s(CASH_ACCTS, py_balance)

    balance_sheet = {
        "asOfDate": latest_fy26.strftime("%B %d, %Y"),
        "assets": {
            "current": [
                bs_line("Cash & cash equivalents", CASH_ACCTS),
                bs_line("Investments", INVESTMENTS_ACCTS),
                bs_line("Pledges receivable", PLEDGES_RECV_ACCTS),
                bs_line("Other receivables", OTHER_CURRENT_ACCTS),
                bs_line("Prepaid expenses", PREPAID_ACCTS),
                bs_line("Inventory", INVENTORY_ACCTS),
            ],
            "totalCurrent": r2(s(CASH_ACCTS + INVESTMENTS_ACCTS + PLEDGES_RECV_ACCTS + OTHER_CURRENT_ACCTS + PREPAID_ACCTS + INVENTORY_ACCTS)),
            "totalCurrentPriorYear": r2(s(CASH_ACCTS + INVESTMENTS_ACCTS + PLEDGES_RECV_ACCTS + OTHER_CURRENT_ACCTS + PREPAID_ACCTS + INVENTORY_ACCTS, py_balance)),
            "fixed": [
                bs_line("Property & equipment, net", FIXED_ASSET_ACCTS),
                bs_line("Right-of-use assets", ROU_ASSET_ACCTS),
            ],
            "totalFixed": r2(s(FIXED_ASSET_ACCTS + ROU_ASSET_ACCTS)),
            "totalFixedPriorYear": r2(s(FIXED_ASSET_ACCTS + ROU_ASSET_ACCTS, py_balance)),
            "other": [
                bs_line("Endowment investments", ENDOWMENT_ACCTS),
                bs_line("Board-designated reserves", BOARD_RESERVE_ACCTS),
                bs_line("Intercompany", INTERCO_ACCTS),
                bs_line("Other assets", OTHER_ASSET_ACCTS),
            ],
            "totalOther": r2(s(ENDOWMENT_ACCTS + BOARD_RESERVE_ACCTS + INTERCO_ACCTS + OTHER_ASSET_ACCTS)),
            "totalOtherPriorYear": r2(s(ENDOWMENT_ACCTS + BOARD_RESERVE_ACCTS + INTERCO_ACCTS + OTHER_ASSET_ACCTS, py_balance)),
            "totalAssets": r2(s(CASH_ACCTS + INVESTMENTS_ACCTS + PLEDGES_RECV_ACCTS + OTHER_CURRENT_ACCTS + PREPAID_ACCTS + INVENTORY_ACCTS +
                               FIXED_ASSET_ACCTS + ROU_ASSET_ACCTS + ENDOWMENT_ACCTS + BOARD_RESERVE_ACCTS + INTERCO_ACCTS + OTHER_ASSET_ACCTS)),
            "totalAssetsPriorYear": r2(s(CASH_ACCTS + INVESTMENTS_ACCTS + PLEDGES_RECV_ACCTS + OTHER_CURRENT_ACCTS + PREPAID_ACCTS + INVENTORY_ACCTS +
                               FIXED_ASSET_ACCTS + ROU_ASSET_ACCTS + ENDOWMENT_ACCTS + BOARD_RESERVE_ACCTS + INTERCO_ACCTS + OTHER_ASSET_ACCTS, py_balance)),
        },
        "liabilities": {
            "current": [
                {"name": "Accounts payable", "amount": r2(-s(AP_ACCTS)), "priorYear": r2(-s(AP_ACCTS, py_balance))},
                {"name": "Grants payable", "amount": r2(-s(GRANTS_PAY_ACCTS)), "priorYear": r2(-s(GRANTS_PAY_ACCTS, py_balance))},
                {"name": "Credit cards payable", "amount": r2(-s(CC_ACCTS)), "priorYear": r2(-s(CC_ACCTS, py_balance))},
                {"name": "Deferred revenue", "amount": r2(-s(DEFERRED_REV_ACCTS)), "priorYear": r2(-s(DEFERRED_REV_ACCTS, py_balance))},
                {"name": "Lease liability — current", "amount": r2(-s(LEASE_CURRENT_ACCTS)), "priorYear": r2(-s(LEASE_CURRENT_ACCTS, py_balance))},
            ],
            "totalCurrent": r2(-s(AP_ACCTS + GRANTS_PAY_ACCTS + CC_ACCTS + DEFERRED_REV_ACCTS + LEASE_CURRENT_ACCTS)),
            "totalCurrentPriorYear": r2(-s(AP_ACCTS + GRANTS_PAY_ACCTS + CC_ACCTS + DEFERRED_REV_ACCTS + LEASE_CURRENT_ACCTS, py_balance)),
            "longTerm": [
                {"name": "Lease liability — long-term", "amount": r2(-s(LEASE_LT_ACCTS)), "priorYear": r2(-s(LEASE_LT_ACCTS, py_balance))},
                {"name": "Held-for-life trusts", "amount": r2(-s(HFL_ACCTS)), "priorYear": r2(-s(HFL_ACCTS, py_balance))},
                {"name": "Trust & custodial liabilities", "amount": r2(-s(TRUST_ACCTS)), "priorYear": r2(-s(TRUST_ACCTS, py_balance))},
            ],
            "totalLongTerm": r2(-s(LEASE_LT_ACCTS + HFL_ACCTS + TRUST_ACCTS)),
            "totalLongTermPriorYear": r2(-s(LEASE_LT_ACCTS + HFL_ACCTS + TRUST_ACCTS, py_balance)),
            "totalLiabilities": r2(-s(AP_ACCTS + GRANTS_PAY_ACCTS + CC_ACCTS + DEFERRED_REV_ACCTS + LEASE_CURRENT_ACCTS + LEASE_LT_ACCTS + HFL_ACCTS + TRUST_ACCTS)),
            "totalLiabilitiesPriorYear": r2(-s(AP_ACCTS + GRANTS_PAY_ACCTS + CC_ACCTS + DEFERRED_REV_ACCTS + LEASE_CURRENT_ACCTS + LEASE_LT_ACCTS + HFL_ACCTS + TRUST_ACCTS, py_balance)),
        },
        "netAssets": {
            "withoutRestriction": r2(-s(['30000', '30050', '30100', '30200', '30300'])),
            "withRestriction": r2(-s(['35000', '35050', '35100'])),
            "totalNetAssets": r2(-s(['30000', '30050', '30100', '30200', '30300', '35000', '35050', '35100'])),
            "priorYear": {
                "withoutRestriction": r2(-s(['30000', '30050', '30100', '30200', '30300'], py_balance)),
                "withRestriction": r2(-s(['35000', '35050', '35100'], py_balance)),
                "totalNetAssets": r2(-s(['30000', '30050', '30100', '30200', '30300', '35000', '35050', '35100'], py_balance)),
            }
        }
    }

    # ── B. Statement of Activities ───────────────────────────────────────
    def rev_line(name, accts):
        unrestr = neg(sr(accts, '1000'))
        restr = neg(sr(accts, '2000'))
        total = neg(s(accts, fy26))
        prior = neg(s(accts, py_activity))
        bdg = s(accts, budget_ytd)
        return {"name": name, "unrestricted": r2(unrestr), "restricted": r2(restr),
                "total": r2(total), "priorYear": r2(prior), "budget": r2(bdg)}

    def exp_line(name, accts):
        amt = s(accts, fy26)
        prior = s(accts, py_activity)
        bdg = s(accts, budget_ytd)
        return {"name": name, "amount": r2(amt), "priorYear": r2(prior), "budget": r2(bdg)}

    revenue = [
        rev_line("Contributions", CONTRIB_ACCTS),
        rev_line("Grants", GRANT_REV_ACCTS),
        rev_line("Special events", SPECIAL_EVENTS_ACCTS),
        rev_line("Program revenue", PROGRAM_REV_ACCTS),
        rev_line("Management fees", MGMT_FEE_ACCTS),
        rev_line("Mission revenue", MISSION_REV_ACCTS),
        rev_line("Interest & dividends", INT_DIV_ACCTS),
        rev_line("Realized gains", REALIZED_GAIN_ACCTS),
        rev_line("Unrealized gains", UNREALIZED_GAIN_ACCTS),
        rev_line("Investment expense", INV_EXPENSE_ACCTS),
        rev_line("Beneficial interest changes", UNREALIZED_BENEF_ACCTS),
        rev_line("Net assets released", RELEASE_ACCTS),
        rev_line("Other revenue", OTHER_REV_ACCTS),
    ]

    total_rev_unrestr = sum(r["unrestricted"] for r in revenue)
    total_rev_restr = sum(r["restricted"] for r in revenue)
    total_rev = sum(r["total"] for r in revenue)
    total_rev_py = sum(r["priorYear"] for r in revenue)
    total_rev_bdg = sum(r["budget"] for r in revenue)

    expenses = [
        exp_line("Grants — local agencies", GRANT_LOCAL_ACCTS),
        exp_line("Grants — designated", GRANT_DESIGNATED_ACCTS),
        exp_line("Grants — stipends", GRANT_STIPEND_ACCTS),
        exp_line("Salaries & benefits", FE_SALARIES),
        exp_line("Travel & meetings", FE_TRAVEL),
        exp_line("Professional fees", FE_PROFESS),
        exp_line("Events & programs", FE_EVENTS),
        exp_line("Facilities & equipment", FE_FACILITIES),
        exp_line("Bank & finance fees", FE_BANK),
        exp_line("Security", FE_SECURITY),
        exp_line("Other operating", FE_OTHER),
    ]

    total_exp = sum(e["amount"] for e in expenses)
    total_exp_py = sum(e["priorYear"] for e in expenses)
    total_exp_bdg = sum(e["budget"] for e in expenses)

    activities = {
        "period": f"Jul 1, 2025 – {latest_fy26.strftime('%b %d, %Y')}",
        "revenue": revenue,
        "totalRevenue": {
            "unrestricted": r2(total_rev_unrestr), "restricted": r2(total_rev_restr),
            "total": r2(total_rev), "priorYear": r2(total_rev_py), "budget": r2(total_rev_bdg)
        },
        "expenses": expenses,
        "totalExpenses": {"amount": r2(total_exp), "priorYear": r2(total_exp_py), "budget": r2(total_exp_bdg)},
        "changeInNetAssets": {
            "total": r2(total_rev - total_exp),
            "priorYear": r2(total_rev_py - total_exp_py),
            "budget": r2(total_rev_bdg - total_exp_bdg),
        }
    }

    # ── C. Functional Expenses ───────────────────────────────────────────
    func_categories = ["Program Services", "Management & General", "Fundraising"]
    # Map internal names to display
    func_map_display = {
        'Grant Making and Related': 'Program Services',
        'Management and General': 'Management & General',
        'Fundraising': 'Fundraising',
    }

    fe_groups = [
        ("Grants", FE_GRANTS),
        ("Salaries & benefits", FE_SALARIES),
        ("Travel & meetings", FE_TRAVEL),
        ("Professional fees", FE_PROFESS),
        ("Events & programs", FE_EVENTS),
        ("Facilities & equipment", FE_FACILITIES),
        ("Other operating", FE_OTHER),
        ("Bank & finance fees", FE_BANK),
        ("Security", FE_SECURITY),
    ]

    fe_rows = []
    fe_totals = {"programServices": 0, "managementGeneral": 0, "fundraising": 0, "total": 0}
    for name, accts in fe_groups:
        ps = sf(accts, 'Grant Making and Related')
        mg = sf(accts, 'Management and General')
        fr = sf(accts, 'Fundraising')
        t = ps + mg + fr
        fe_rows.append({
            "name": name,
            "programServices": r2(ps), "managementGeneral": r2(mg),
            "fundraising": r2(fr), "total": r2(t)
        })
        fe_totals["programServices"] += ps
        fe_totals["managementGeneral"] += mg
        fe_totals["fundraising"] += fr
        fe_totals["total"] += t

    fe_totals = {k: r2(v) for k, v in fe_totals.items()}

    functional_expenses = {
        "categories": func_categories + ["Total"],
        "rows": fe_rows,
        "totals": fe_totals,
    }

    # ── D. Budget vs Actual ──────────────────────────────────────────────
    bva_rev = []
    rev_groups = [
        ("Contributions", CONTRIB_ACCTS),
        ("Grants", GRANT_REV_ACCTS),
        ("Special events", SPECIAL_EVENTS_ACCTS),
        ("Program revenue", PROGRAM_REV_ACCTS),
        ("Management fees", MGMT_FEE_ACCTS),
        ("Mission revenue", MISSION_REV_ACCTS),
        ("Investment income", INT_DIV_ACCTS + REALIZED_GAIN_ACCTS + UNREALIZED_GAIN_ACCTS + INV_EXPENSE_ACCTS),
        ("Other revenue", OTHER_REV_ACCTS + UNREALIZED_BENEF_ACCTS + RELEASE_ACCTS),
    ]
    for name, accts in rev_groups:
        bdg = s(accts, budget_ytd)
        actual = neg(s(accts, fy26))
        var = actual - bdg
        pct = (var / bdg * 100) if bdg else 0
        bva_rev.append({"name": name, "budget": r2(bdg), "actual": r2(actual),
                        "variance": r2(var), "variancePct": r2(pct)})

    bva_exp = []
    exp_groups = [
        ("Grants", FE_GRANTS),
        ("Salaries & benefits", FE_SALARIES),
        ("Travel & meetings", FE_TRAVEL),
        ("Professional fees", FE_PROFESS),
        ("Events & programs", FE_EVENTS),
        ("Facilities & equipment", FE_FACILITIES),
        ("Bank & finance fees", FE_BANK),
        ("Security", FE_SECURITY),
        ("Other operating", FE_OTHER),
    ]
    for name, accts in exp_groups:
        bdg = s(accts, budget_ytd)
        actual = s(accts, fy26)
        var = bdg - actual  # positive = favorable (under budget)
        pct = (var / bdg * 100) if bdg else 0
        bva_exp.append({"name": name, "budget": r2(bdg), "actual": r2(actual),
                        "variance": r2(var), "variancePct": r2(pct)})

    total_bva_rev_bdg = sum(r["budget"] for r in bva_rev)
    total_bva_rev_act = sum(r["actual"] for r in bva_rev)
    total_bva_exp_bdg = sum(r["budget"] for r in bva_exp)
    total_bva_exp_act = sum(r["actual"] for r in bva_exp)

    budget_vs_actual = {
        "revenue": bva_rev,
        "expenses": bva_exp,
        "totalRevenue": {
            "budget": r2(total_bva_rev_bdg), "actual": r2(total_bva_rev_act),
            "variance": r2(total_bva_rev_act - total_bva_rev_bdg),
            "variancePct": r2((total_bva_rev_act - total_bva_rev_bdg) / total_bva_rev_bdg * 100) if total_bva_rev_bdg else 0,
        },
        "totalExpenses": {
            "budget": r2(total_bva_exp_bdg), "actual": r2(total_bva_exp_act),
            "variance": r2(total_bva_exp_bdg - total_bva_exp_act),
            "variancePct": r2((total_bva_exp_bdg - total_bva_exp_act) / total_bva_exp_bdg * 100) if total_bva_exp_bdg else 0,
        },
        "netSurplusDeficit": {
            "budget": r2(total_bva_rev_bdg - total_bva_exp_bdg),
            "actual": r2(total_bva_rev_act - total_bva_exp_act),
            "variance": r2((total_bva_rev_act - total_bva_exp_act) - (total_bva_rev_bdg - total_bva_exp_bdg)),
        }
    }

    # ── E. Monthly Trend ─────────────────────────────────────────────────
    monthly_trend = []
    for mi in range(months_elapsed):
        m_rev = neg(sum(monthly[mi].get(a, 0) for a in ALL_REV_ACCTS))
        m_exp = sum(monthly[mi].get(a, 0) for a in ALL_EXPENSE_ACCTS)
        monthly_trend.append({
            "month": MONTH_NAMES[mi],
            "revenue": r2(m_rev),
            "expenses": r2(m_exp),
            "net": r2(m_rev - m_exp),
        })

    # ── F. KPIs ──────────────────────────────────────────────────────────
    avg_monthly_exp = total_exp / months_elapsed if months_elapsed else 0
    cash_position = s(CASH_ACCTS)
    months_of_reserves = cash_position / avg_monthly_exp if avg_monthly_exp else 0
    op_margin = ((total_rev - total_exp) / total_rev * 100) if total_rev else 0
    bva_pct = ((total_bva_rev_act - total_bva_exp_act) / (total_bva_rev_bdg - total_bva_exp_bdg) * 100) if (total_bva_rev_bdg - total_bva_exp_bdg) else 0

    kpis = {
        "totalRevenue": r2(total_rev),
        "totalExpenses": r2(total_exp),
        "netSurplusDeficit": r2(total_rev - total_exp),
        "operatingMargin": r2(op_margin),
        "budgetVariancePct": r2(bva_pct),
        "cashPosition": r2(cash_position),
        "monthsOfReserves": r2(months_of_reserves),
    }

    # ── Output ───────────────────────────────────────────────────────────
    output = {
        "generatedAt": datetime.now().isoformat(),
        "period": activities["period"],
        "monthsElapsed": months_elapsed,
        "balanceSheet": balance_sheet,
        "activities": activities,
        "functionalExpenses": functional_expenses,
        "budgetVsActual": budget_vs_actual,
        "monthlyTrend": monthly_trend,
        "kpis": kpis,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"✅ Generated {OUT_PATH}")
    print(f"   Period: {activities['period']} ({months_elapsed} months)")
    print(f"   Revenue: ${total_rev:,.0f} | Expenses: ${total_exp:,.0f} | Net: ${total_rev - total_exp:,.0f}")


if __name__ == '__main__':
    main()
