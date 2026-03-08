#!/usr/bin/env python3
"""
Generate project-tracker.json for the Federation Analytics Project Tracker dashboard.

Sources:
  - projects/PROJECTS.md (master project list)
  - projects/templates/jfsd-ui/public/data/project-tracker.json (existing state — preserve columns/priorities)

The script preserves manually-set columns and priorities from the existing JSON,
and updates lastTouched dates based on git activity or file modification times.
New items from PROJECTS.md are added to backlog with P3.
Items in existing JSON that no longer appear are kept (manual items).
"""

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parent.parent.parent.parent  # /Users/davidfuhriman/clawd
DATA_FILE = Path(__file__).resolve().parent.parent / "public" / "data" / "project-tracker.json"

def load_existing():
    """Load existing tracker data to preserve manual edits."""
    if DATA_FILE.exists():
        with open(DATA_FILE) as f:
            return json.load(f)
    return None

def git_last_touched(path_pattern):
    """Get last git commit date for files matching a pattern."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%aI", "--", path_pattern],
            capture_output=True, text=True, cwd=WORKSPACE, timeout=5
        )
        if result.stdout.strip():
            return result.stdout.strip()[:10]
    except:
        pass
    return None

def now_str():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

def today_str():
    return datetime.now().strftime("%Y-%m-%d")

def build_tracker():
    existing = load_existing()
    existing_items = {}
    if existing:
        for item in existing.get("items", []):
            if "id" in item:
                existing_items[item["id"]] = item

    items = []

    def add(id, title, description, column, swimLane, priority, effort, owner, 
            blocker=None, source="", tags=None):
        """Add or update an item, preserving existing column/priority if set."""
        if id in existing_items:
            old = existing_items[id]
            # Preserve manually-set fields
            item = {
                "id": id,
                "title": title,
                "description": description,
                "column": old.get("column", column),
                "swimLane": swimLane,
                "priority": old.get("priority", priority),
                "effort": effort,
                "owner": owner,
                "blocker": blocker,
                "lastTouched": old.get("lastTouched", today_str()),
                "source": source,
                "tags": tags or old.get("tags", [])
            }
        else:
            item = {
                "id": id,
                "title": title,
                "description": description,
                "column": column,
                "swimLane": swimLane,
                "priority": priority,
                "effort": effort,
                "owner": owner,
                "blocker": blocker,
                "lastTouched": today_str(),
                "source": source,
                "tags": tags or []
            }
        items.append(item)

    # ═══════════════════════════════════════════════════════════════
    # McKinsey v1 completed items (Feb 20, 2026)
    # ═══════════════════════════════════════════════════════════════
    done_items = [
        ("mk1-1.1", "Sidebar group labels", "Added FUNDRAISING/FINANCE/OPERATIONS headers to menu", "McKinsey v1 1.1"),
        ("mk1-1.2", "Overview Quick Links navigation", "Wired clickable navigation from Overview cards to dashboards", "McKinsey v1 1.2"),
        ("mk1-1.3", "CSV export on all tables", "Added CSV download button to 25+ tables across 13 dashboards", "McKinsey v1 1.3"),
        ("mk1-1.4", "Deceased donor filter", "Filter Z\"L donors from Ask List (data pipeline + client-side)", "McKinsey v1 1.4"),
        ("mk1-1.5", "Relative timestamps (Facilities)", "Added 'Xh ago' display with stale data warning when >4h old", "McKinsey v1 1.5"),
        ("mk1-1.6", "Color constants DRY refactor", "Centralized 88 local color declarations into theme imports", "McKinsey v1 1.6"),
        ("mk1-2.2", "Merge Silence Alerts → Outreach", "Combined Ask List + Risk Alerts into tabbed Outreach dashboard", "McKinsey v1 2.2"),
        ("mk1-2.3", "Date range selector (Campaign)", "Added Week/Month/Quarter/YTD filter on Campaign Tracker", "McKinsey v1 2.3"),
        ("mk1-2.4", "Print CSS + Print button", "Print stylesheet for Board Reporting + Financial Statements", "McKinsey v1 2.4"),
        ("mk1-2.5", "Rabkin 'Unassigned Pool' flag", "Flagged 30K-donor portfolio as unassigned, excluded from averages", "McKinsey v1 2.5"),
        ("mk1-2.6", "Skeleton loading states", "Replaced blank spinners with card/chart/table skeletons on all dashboards", "McKinsey v1 2.6"),
        ("mk1-2.7", "Pledge aging context", "Distinguished 'not yet due' vs 'past due' with status tags and info alert", "McKinsey v1 2.7"),
        ("mk1-3.3", "Cross-dashboard global search", "Search bar in header indexing donors across 11 data files", "McKinsey v1 3.3"),
        ("mk1-3.4", "Enhanced Facilities", "Expandable 24h trend charts, server room gauges, building summaries", "McKinsey v1 3.4"),
        ("mk1-3.6", "PDF export", "html2canvas + jsPDF export on Board Reporting + Financial Statements", "McKinsey v1 3.6"),
        ("mk2-1.1", "Remove dead SilenceAlerts file", "Deleted orphaned SilenceAlertsDashboard.tsx", "McKinsey v2 1.1"),
        ("mk2-1.2", "Fix GlobalSearch fetch paths", "Changed /data/ to /jfsd-ui/data/ for correct deployment paths", "McKinsey v2 1.2"),
        ("mk2-1.3", "Expand GlobalSearch index", "Extended search from 8 to 11 data files including board, ramp, AP", "McKinsey v2 1.3"),
        ("mk2-1.5", "Normalize maxWidth", "Standardized all dashboards to 1400px content width", "McKinsey v2 1.5"),
        ("mk2-2.6", "Stripe insights upgrade", "Added rule-based insights, recommendations, and month-over-month arrows", "McKinsey v2 2.6"),
        ("mk2-2.7", "Data refresh indicators", "DataFreshness component with relative time, refresh button on all 15 dashboards", "McKinsey v2 2.7"),
        ("proj-tracker", "Project Tracker dashboard", "Kanban board tracking all work items across 6 swim lanes", "Custom"),
    ]
    for id, title, desc, source in done_items:
        add(id, title, desc, "done", "Federation Analytics", "P1", "done", "H2",
            source=source, tags=["jfsd-ui"])

    # ═══════════════════════════════════════════════════════════════
    # Blocked items
    # ═══════════════════════════════════════════════════════════════
    add("blocked-greeting", "Household Greeting Fix", 
        "Z\"L households not getting correct greetings — flow logic needs update",
        "blocked", "Advancement Services", "P2", "2-3d", "Paul",
        blocker="Waiting on Paul for Salesforce flow logic changes",
        source="PROJECTS.md", tags=["salesforce"])

    add("blocked-drm-users", "DRM data: missing users",
        "Ronnie Diamond and Lorraine Fisher not found as active SF users",
        "blocked", "Federation Analytics", "P3", "1h", "H2+David",
        blocker="May have left org — need David to confirm",
        source="Data issue", tags=["salesforce", "jfsd-ui"])

    add("blocked-givecloud-recurring", "GiveCloud is_recurring always false",
        "API returns is_recurring=false for all contributions",
        "blocked", "System Integrations", "P2", "2-3h", "H2",
        blocker="API issue — recurring data may flow differently",
        source="Data issue", tags=["givecloud"])

    # ═══════════════════════════════════════════════════════════════
    # McKinsey v2 — Tier 1 remaining
    # ═══════════════════════════════════════════════════════════════
    add("mk2-1.4", "Search by amount and campaign name",
        "GlobalSearch only matches donor names — add amount ranges and campaign indexing",
        "thisWeek", "Federation Analytics", "P2", "2-3h", "H2",
        source="McKinsey v2 1.4", tags=["jfsd-ui"])

    add("mk2-1.6", "Cache silence-alerts.json fetch",
        "Outreach fetches silence-alerts.json 3 times — use shared cache or context",
        "thisWeek", "Federation Analytics", "P3", "1-2h", "H2",
        source="McKinsey v2 1.6", tags=["jfsd-ui"])

    add("mk2-1.7", "CSV export on Facilities",
        "Thermostat list should be exportable to CSV",
        "thisWeek", "Federation Analytics", "P3", "1h", "H2",
        source="McKinsey v2 1.7", tags=["jfsd-ui"])

    # ═══════════════════════════════════════════════════════════════
    # McKinsey v2 — Tier 2
    # ═══════════════════════════════════════════════════════════════
    add("mk2-2.1", "Authentication (Azure AD OAuth)",
        "Required for org rollout — Graph API creds already exist",
        "upNext", "Federation Analytics", "P1", "1-2w", "H2+David",
        source="McKinsey v2 2.1", tags=["jfsd-ui", "auth"])

    add("mk2-2.2", "Role-based sidebar filtering",
        "Map roles to visible dashboards after auth is implemented",
        "upNext", "Federation Analytics", "P1", "2-3d", "H2",
        source="McKinsey v2 2.2", tags=["jfsd-ui", "auth"])

    add("mk2-2.3", "Comprehensive Campaign date filter",
        "Extend date filter to giving levels, donor breakdown, pipeline, sub-campaigns",
        "upNext", "Federation Analytics", "P2", "3-5d", "H2",
        source="McKinsey v2 2.3", tags=["jfsd-ui"])

    add("mk2-2.4", "Date range on Donor Health + DRM",
        "Apply Campaign Tracker date filter pattern to next-highest-value dashboards",
        "upNext", "Federation Analytics", "P2", "3-5d", "H2",
        source="McKinsey v2 2.4", tags=["jfsd-ui"])

    add("mk2-2.5", "Merge Prospect Research into DRM",
        "Add Prospects tab to DRM detail view with upgrade opportunities",
        "upNext", "Federation Analytics", "P2", "3-5d", "H2",
        source="McKinsey v2 2.5", tags=["jfsd-ui"])

    # ═══════════════════════════════════════════════════════════════
    # McKinsey v2 — Tier 3
    # ═══════════════════════════════════════════════════════════════
    add("mk2-3.1", "Notification system",
        "Push alerts for failed charges, temp spikes, pledge defaults, major gifts",
        "backlog", "Federation Analytics", "P1", "1-2w", "H2",
        source="McKinsey v2 3.1", tags=["jfsd-ui", "notifications"])

    add("mk2-3.2", "Embedded Salesforce actions",
        "Create Task, Log Call, Send Email buttons in Outreach and DRM dashboards",
        "backlog", "Federation Analytics", "P1", "2-3w", "H2",
        source="McKinsey v2 3.2", tags=["jfsd-ui", "salesforce"])

    add("mk2-3.3", "Live API migration",
        "Phase 1: Campaign + Donor Health via SOQL. Phase 2: Stripe + GiveCloud. Phase 3: Full",
        "backlog", "Federation Analytics", "P2", "4-6w", "H2",
        source="McKinsey v2 3.3", tags=["jfsd-ui", "api"])

    add("mk2-3.4", "Donor 360 profile view",
        "Click any donor name → slide-out panel with complete cross-dashboard profile",
        "backlog", "Federation Analytics", "P2", "2-3w", "H2",
        source="McKinsey v2 3.4", tags=["jfsd-ui"])

    add("mk2-3.5", "True PDF rendering",
        "Replace html2canvas with server-side Puppeteer or @react-pdf/renderer",
        "backlog", "Federation Analytics", "P3", "1-2w", "H2",
        source="McKinsey v2 3.5", tags=["jfsd-ui"])

    add("mk2-3.6", "Predictive analytics",
        "ML-based churn prediction, optimal ask modeling, campaign forecasting",
        "backlog", "Federation Analytics", "P3", "3-4w", "H2",
        source="McKinsey v2 3.6", tags=["jfsd-ui", "ml"])

    add("mk2-3.7", "Mobile-first DRM view",
        "Simplified 3-dashboard mobile experience for DRMs in the field",
        "backlog", "Federation Analytics", "P3", "3-4w", "H2",
        source="McKinsey v2 3.7", tags=["jfsd-ui", "mobile"])

    # ═══════════════════════════════════════════════════════════════
    # PROJECTS.md items
    # ═══════════════════════════════════════════════════════════════
    add("proj-gift-entry", "Gift Entry Automation Pipeline",
        "End-to-end: scan check → OCR → donor match → GiftTransaction → acknowledgment → mail/call. All 7 APIs live.",
        "upNext", "Advancement Services", "P1", "3-4w", "H2+David",
        source="PROJECTS.md", tags=["salesforce", "automation", "lob", "ocr"])

    add("gift-email-watcher", "Gift Entry: Email Watcher Cron",
        "Poll H2 inbox every 15 min for check image attachments via Graph API",
        "upNext", "Advancement Services", "P1", "3-4h", "H2",
        source="Gift Entry Pipeline", tags=["graph", "automation"])

    add("gift-ocr-extract", "Gift Entry: OCR Extraction Script",
        "Claude Vision reads check image → structured JSON (donor name, amount, check #, date, memo, address)",
        "upNext", "Advancement Services", "P1", "1d", "H2",
        source="Gift Entry Pipeline", tags=["ocr", "vision"])

    add("gift-fuzzy-match", "Gift Entry: Fuzzy Donor Matching",
        "SOSL + scoring: name match, address boost (+15), prior gifts (+10), active pledge (+20). Confidence gate: ≥90% auto, 70-89% top 3, <70% manual",
        "upNext", "Advancement Services", "P1", "1-2d", "H2",
        source="Gift Entry Pipeline", tags=["salesforce", "matching"])

    add("gift-dupe-check", "Gift Entry: Duplicate Detection",
        "Same donor + amount + date ±30 days = flag potential duplicate before creating gift",
        "upNext", "Advancement Services", "P1", "3-4h", "H2",
        source="Gift Entry Pipeline", tags=["salesforce"])

    add("gift-sf-write", "Gift Entry: Salesforce GiftTransaction Create",
        "Create GiftTransaction with amount, donor, campaign, check #, payment method. Update recognition totals.",
        "upNext", "Advancement Services", "P1", "1d", "H2",
        source="Gift Entry Pipeline", tags=["salesforce"])

    add("gift-queue-dashboard", "Gift Entry: Review Queue Dashboard (#17)",
        "jfsd-ui dashboard showing OCR data + top matches + check image. Approve/reject/override for low-confidence matches",
        "upNext", "Federation Analytics", "P1", "2-3d", "H2",
        source="Gift Entry Pipeline", tags=["jfsd-ui"])

    add("gift-ack-pdf", "Gift Entry: Acknowledgment Letter PDF",
        "Puppeteer generates tax receipt + thank-you from JFSD branded template. Tiered: base, $250+, $1K+, $5K+, $25K+",
        "upNext", "Advancement Services", "P1", "1-2d", "H2",
        source="Gift Entry Pipeline", tags=["puppeteer", "pdf"])

    add("gift-lob-mail", "Gift Entry: Lob Physical Mail",
        "Send PDF acknowledgment via Lob print+mail API. Address verification before sending. Free tier: 300/mo",
        "upNext", "Advancement Services", "P1", "1d", "H2",
        source="Gift Entry Pipeline", tags=["lob", "mail"])

    add("gift-lob-verify", "Address Verification via Lob",
        "Bulk verify donor mailing addresses in Salesforce. Flag bad addresses before mailing. Can run proactively on full database",
        "upNext", "Advancement Services", "P2", "3-4h", "H2",
        source="Gift Entry Pipeline", tags=["lob", "salesforce"])

    add("gift-voice-call", "Gift Entry: Thank-You Voice Call",
        "Dalia calls donor for gifts ≥$1K within 48h. Personalized script from SF data. Already wired via ElevenLabs+Twilio",
        "upNext", "Advancement Services", "P1", "3-4h", "H2",
        source="Gift Entry Pipeline", tags=["elevenlabs", "twilio", "voice"])

    add("gift-drm-notify", "Gift Entry: DRM Notification",
        "Telegram/email to portfolio manager: '$X gift from [Donor]' with context. Handwritten note queue for $5K+",
        "upNext", "Advancement Services", "P1", "2-3h", "H2",
        source="Gift Entry Pipeline", tags=["telegram", "graph"])

    add("gift-campaign-match", "Gift Entry: Campaign/Fund Matching",
        "Parse memo line for fund designations and campaign codes. Default to Annual Campaign FY26 if no match",
        "upNext", "Advancement Services", "P1", "3-4h", "H2",
        source="Gift Entry Pipeline", tags=["salesforce"])

    add("proj-sage-api", "Sage Intacct Direct API",
        "Real-time GL access, cash position, budget variance",
        "backlog", "Finance & Accounting", "P2", "1-2w", "H2",
        source="PROJECTS.md", tags=["sage", "api"])

    add("proj-verkada", "Verkada API Integration",
        "Occupancy dashboard, smart HVAC integration, after-hours alerts",
        "backlog", "Facilities & Ops", "P2", "1w", "H2",
        source="PROJECTS.md", tags=["verkada", "api"])

    add("proj-paylocity", "Paylocity API Exploration",
        "People analytics, department costs, PTO coverage",
        "backlog", "Agent Architecture", "P3", "1w", "H2",
        source="PROJECTS.md", tags=["paylocity", "api"])

    add("proj-gc-sf-sync", "GiveCloud ↔ Salesforce Sync",
        "Match by email, map fields, build sync tool — 30 accounts ready",
        "backlog", "System Integrations", "P2", "1-2w", "H2",
        source="PROJECTS.md", tags=["givecloud", "salesforce"])

    add("proj-fec", "FEC Political Giving Integration",
        "Enrich donor research profiles with political contribution data",
        "backlog", "Advancement Services", "P3", "slow burn", "H2",
        source="PROJECTS.md", tags=["fec", "research"])

    add("proj-sf-data-quality", "Salesforce Data Quality Cleanup",
        "Addresses, phone numbers, names, capitalizations, report folders",
        "backlog", "Advancement Services", "P2", "ongoing", "H2+Sharon",
        source="PROJECTS.md", tags=["salesforce"])

    add("proj-accounting-policy", "Updated Accounting Policy",
        "Policy manual, documentation, spend policy updates",
        "backlog", "Finance & Accounting", "P2", "1-2w", "David",
        source="PROJECTS.md", tags=["accounting"])

    add("proj-board-packets", "Auto Board Packets",
        "Monthly assembly: Salesforce giving + Sage financials → formatted packet",
        "backlog", "Finance & Accounting", "P2", "2-3w", "H2",
        source="PROJECTS.md", tags=["automation"])

    add("proj-campaign-roi", "Campaign ROI Dashboard",
        "Salesforce campaigns + Ramp expenses = true cost per dollar raised",
        "backlog", "Finance & Accounting", "P2", "1-2w", "H2",
        source="PROJECTS.md", tags=["jfsd-ui", "ramp", "salesforce"])

    add("proj-numeric", "Month-end Close in Numeric",
        "Integration with Numeric for month-end close process",
        "backlog", "Finance & Accounting", "P3", "research", "David",
        source="PROJECTS.md", tags=["numeric", "accounting"])

    add("proj-docgen-templates", "Document Generation Templates",
        "IRS substantiation, year-end statements, more pledge templates",
        "backlog", "Advancement Services", "P2", "1w", "H2",
        source="PROJECTS.md", tags=["docuseal"])

    add("proj-hubspot", "HubSpot Integration",
        "Marketing dashboard data source for Operations Hub",
        "backlog", "System Integrations", "P3", "1-2w", "H2",
        source="PROJECTS.md", tags=["hubspot", "api"])

    # ═══════════════════════════════════════════════════════════════
    # Level 1: Automate What You Already Do Manually
    # ═══════════════════════════════════════════════════════════════
    add("auto-gift-scanner", "Gift Entry: Check Scanner OCR",
        "OCR scanned checks → extract donor/amount/check#/date → fuzzy match Account → create GiftTransaction",
        "backlog", "Advancement Services", "P1", "2-3w", "H2",
        source="Automation L1", tags=["salesforce", "ocr", "automation"])

    add("auto-gift-import", "Gift Entry: Online Import Parser",
        "Parse Excel dumps from online giving → map to SF fields → book with designation + campaign",
        "backlog", "Advancement Services", "P1", "1-2w", "H2",
        source="Automation L1", tags=["salesforce", "automation"])

    add("auto-month-end", "Month-End Close Copilot",
        "Sage GL pulls → auto trial balance → flag unusual entries → draft journal entries for review",
        "upNext", "Finance & Accounting", "P1", "2-3w", "H2+James",
        source="Automation L1", tags=["sage", "automation"])

    add("auto-three-way-match", "Three-Way Reconciliation",
        "Auto-reconcile Stripe payouts ↔ bank deposits ↔ GiveCloud contributions",
        "backlog", "Finance & Accounting", "P1", "2w", "H2",
        source="Automation L1", tags=["stripe", "givecloud", "reconciliation"])

    add("auto-board-packet", "Auto Board Packet Assembly",
        "Pull campaign + financials + program highlights → branded PDF → email to board",
        "backlog", "Finance & Accounting", "P1", "2-3w", "H2",
        source="Automation L1", tags=["automation", "pdf"])

    add("auto-pledge-reminders", "Pledge Reminder Automation",
        "Identify pledges approaching due → generate personalized letter via DocuSeal → queue → send",
        "backlog", "Advancement Services", "P1", "1-2w", "H2",
        source="Automation L1", tags=["docuseal", "salesforce", "automation"])

    # ═══════════════════════════════════════════════════════════════
    # Level 2: Proactive Intelligence
    # ═══════════════════════════════════════════════════════════════
    add("auto-morning-brief", "Morning CFO Brief",
        "7 AM daily: overnight Stripe charges, failed payments, Ramp anomalies, calendar, emails, building alerts → one Telegram message",
        "thisWeek", "Finance & Accounting", "P0", "1d", "H2",
        source="Automation L2", tags=["cron", "automation", "telegram"])

    # ═══════════════════════════════════════════════════════════════
    # Monday Feb 24 sprint
    # ═══════════════════════════════════════════════════════════════
    add("mon-firewall", "Enable macOS Firewall",
        "Security audit flagged firewall OFF. Run socketfilterfw --setglobalstate on",
        "thisWeek", "Facilities & Ops", "P1", "5min", "H2",
        source="Security Audit Feb 20", tags=["security"])

    add("mon-timemachine", "Verify Time Machine Backups",
        "Security audit: no recent backup path returned. Confirm backups completing to target disk",
        "thisWeek", "Facilities & Ops", "P1", "15min", "David",
        source="Security Audit Feb 20", tags=["security", "backup"])

    add("mon-openclaw-update", "OpenClaw Update (2026.2.19-2)",
        "Update available via pnpm. Run openclaw update when convenient",
        "thisWeek", "System Integrations", "P2", "10min", "H2+David",
        source="Security Audit Feb 20", tags=["openclaw"])

    add("mon-schedule-audit", "Schedule Periodic Security Audits",
        "Set up weekly openclaw security audit --deep via cron. Store results, alert on changes",
        "thisWeek", "System Integrations", "P2", "30min", "H2",
        source="Security Audit Feb 20", tags=["security", "cron"])

    add("auto-donor-triggers-gift", "Donor Trigger: New Major Gift Thank-You Call",
        "SF gift detected → pre-bake donor context markdown → Dalia calls within 24h → logs result to SF. Start with gifts >$1K. APIs and numbers already working.",
        "thisWeek", "Advancement Services", "P0", "half day", "H2",
        source="Automation L2", tags=["salesforce", "elevenlabs", "twilio", "voice", "automation"])

    add("auto-donor-triggers-fail", "Donor Trigger: Recurring Gift Failure",
        "Watch for recurring gift failure → auto-retry logic → escalate to Sharon after 3 fails",
        "upNext", "Advancement Services", "P1", "1w", "H2",
        source="Automation L2", tags=["stripe", "salesforce", "automation"])

    add("auto-donor-triggers-lybunt", "Donor Trigger: LYBUNT 365-Day Alert",
        "LYBUNT hitting 365 days → auto-generate outreach script → assign to DRM portfolio",
        "backlog", "Advancement Services", "P2", "1w", "H2",
        source="Automation L2", tags=["salesforce", "automation"])

    add("auto-anomaly-ramp", "Anomaly Detection: Ramp Spend",
        "Ramp charge >$5K without PO → flag James. Unusual vendor or category → alert",
        "backlog", "Finance & Accounting", "P2", "1w", "H2",
        source="Automation L2", tags=["ramp", "anomaly", "automation"])

    add("auto-anomaly-gl", "Anomaly Detection: GL Entries",
        "GL entry posted to wrong department (based on historical patterns) → flag for review",
        "backlog", "Finance & Accounting", "P2", "1-2w", "H2",
        source="Automation L2", tags=["sage", "anomaly", "automation"])

    add("auto-anomaly-building", "Anomaly Detection: Building Temp",
        "Temp deviation >5°F from setpoint for >2h → escalate. Already partial in HEARTBEAT.md",
        "backlog", "Facilities & Ops", "P2", "2-3d", "H2",
        source="Automation L2", tags=["ecobee", "anomaly", "automation"])

    add("auto-anomaly-stripe", "Anomaly Detection: Stripe Fee Spike",
        "Stripe fee rate spike on a single day → investigate and alert",
        "backlog", "Finance & Accounting", "P3", "1d", "H2",
        source="Automation L2", tags=["stripe", "anomaly", "automation"])

    add("auto-weekly-intel", "Weekly Competitive Intelligence",
        "Scrape other Federation annual reports, major gift announcements, leadership changes → digest",
        "backlog", "Advancement Services", "P3", "1-2w", "H2",
        source="Automation L2", tags=["research", "automation"])

    # ═══════════════════════════════════════════════════════════════
    # Level 3: Autonomous Agents
    # ═══════════════════════════════════════════════════════════════
    add("agent-finance", "Finance Agent",
        "Overnight: pull GL, reconcile bank, flag discrepancies, draft JEs. Morning: 'Here's what I found, 3 items need approval'",
        "backlog", "Agent Architecture", "P1", "3-4w", "H2",
        source="Automation L3", tags=["sage", "ramp", "agent"])

    add("agent-advancement", "Advancement Services Agent",
        "Daily SF monitoring: new gifts, pledge payments, lapsed donors. Auto-generate ack letters, update recognition, prep DRM briefings",
        "backlog", "Agent Architecture", "P1", "3-4w", "H2",
        source="Automation L3", tags=["salesforce", "agent"])

    add("agent-facilities", "Facilities Agent",
        "Ecobee + Verkada: occupancy-based HVAC optimization, auto-setback when empty, maintenance scheduling",
        "backlog", "Agent Architecture", "P2", "2-3w", "H2",
        source="Automation L3", tags=["ecobee", "verkada", "agent"])

    add("agent-digital-cfo", "Digital CFO Office",
        "Always-on agent monitoring ALL systems 24/7. Escalation tiers: handle silently → daily brief → Telegram → phone call",
        "backlog", "Agent Architecture", "P2", "6-8w", "H2",
        source="Automation L3", tags=["agent", "automation"])

    # ═══════════════════════════════════════════════════════════════
    # Level 4: Genuinely Wild
    # ═══════════════════════════════════════════════════════════════
    add("wild-voice-network", "Voice Agent Network",
        "Dalia auto-calls donors for thank-yous. Mira handles inbound DRM questions. H2 takes calls when David's busy",
        "backlog", "Agent Architecture", "P2", "4-6w", "H2",
        source="Automation L4", tags=["elevenlabs", "twilio", "voice"])

    add("wild-voice-experiments", "ElevenAgents A/B Experiments",
        "Use ElevenLabs Experiments to A/B test voice agent variants — different scripts, voices, guardrails. Measure CSAT, containment, conversion on live calls. Start with Dalia thank-you scripts.",
        "backlog", "Agent Architecture", "P2", "1-2w", "H2",
        source="ElevenLabs blog Feb 19 2026", tags=["elevenlabs", "voice", "experiments"])

    add("wild-voice-latency", "Voice Agent Latency Optimization",
        "Pre-load markdown knowledge bases, cache donor profiles, optimize prompt chains. Target <500ms first response. Test precomputed context vs live lookup.",
        "backlog", "Agent Architecture", "P1", "1-2w", "H2",
        source="Voice optimization", tags=["elevenlabs", "voice", "performance"])

    add("auto-sms-outreach", "SMS/Text Outreach Automation",
        "Twilio SMS for donor touchpoints: pledge reminders, thank-yous, event invites, receipt confirmations. Personalized templates from SF data. Opt-in/opt-out compliance.",
        "backlog", "Advancement Services", "P1", "2-3w", "H2",
        source="Automation L2", tags=["twilio", "sms", "salesforce", "automation"])

    add("wild-predictive-budget", "Predictive Budgeting",
        "ML model on 3 years GL data → predict monthly spend by dept → flag before overruns. 'Marketing will exceed budget by March 15'",
        "backlog", "Finance & Accounting", "P2", "3-4w", "H2",
        source="Automation L4", tags=["ml", "sage", "prediction"])

    add("wild-auto-grants", "Auto-Grant Writer",
        "Pull program data from SF → match to foundation RFPs → draft grant applications for review",
        "backlog", "Advancement Services", "P3", "4-6w", "H2",
        source="Automation L4", tags=["salesforce", "ai", "grants"])

    add("wild-self-healing-dq", "Self-Healing Data Quality",
        "Agent continuously scans SF for issues → auto-fix obvious ones → queue ambiguous for Sharon → score trends toward 80+",
        "backlog", "Advancement Services", "P1", "2-3w", "H2",
        source="Automation L4", tags=["salesforce", "data-quality", "agent"])

    # Also preserve any existing items not in our list (manual additions)
    known_ids = {item["id"] for item in items}
    for id, old_item in existing_items.items():
        if id not in known_ids:
            items.append(old_item)

    # ── Compute KPIs ──
    this_week = sum(1 for i in items if i["column"] == "thisWeek")
    blocked = sum(1 for i in items if i["column"] == "blocked")
    done = sum(1 for i in items if i["column"] == "done")

    return {
        "asOfDate": now_str(),
        "kpis": {
            "totalItems": len(items),
            "thisWeek": this_week,
            "blocked": blocked,
            "completedThisMonth": done
        },
        "columns": ["thisWeek", "upNext", "backlog", "blocked", "done"],
        "columnLabels": {
            "thisWeek": "🔥 This Week",
            "upNext": "🟡 Up Next",
            "backlog": "📋 Backlog",
            "blocked": "⏸️ Blocked",
            "done": "✅ Done"
        },
        "swimLanes": [
            "Federation Analytics",
            "Finance & Accounting",
            "Facilities & Ops",
            "Advancement Services",
            "System Integrations",
            "Agent Architecture"
        ],
        "items": items
    }

if __name__ == "__main__":
    data = build_tracker()
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Generated project-tracker.json: {len(data['items'])} items "
          f"({data['kpis']['thisWeek']} this week, {data['kpis']['blocked']} blocked, "
          f"{data['kpis']['completedThisMonth']} done)")
