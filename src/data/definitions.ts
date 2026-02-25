export interface Definition {
  term: string;
  definition: string;
  category: string;
}

export const definitions: Record<string, Definition[]> = {
  overview: [
    { term: 'Fiscal Year', definition: 'July 1 – June 30. FY26 = July 1, 2025 – June 30, 2026.', category: 'General' },
    { term: 'Recognition', definition: 'Sum of Commitments + Direct Gifts + Soft Credits. Pledge counted when MADE, not when PAID.', category: 'General' },
    { term: 'Cash', definition: 'Money actually received (payments). Field: Giving_this_Fiscal_Year__c.', category: 'General' },
    { term: 'System Health', definition: 'Status of connected data sources (Salesforce, Stripe, GiveCloud, Ramp, Ecobee).', category: 'General' },
  ],

  campaign: [
    { term: 'Recognition', definition: 'Sum of Commitments + Direct Gifts + Soft Credits. Formula: Recognition_Amount_FY26__c = Gift_Commitments_FY26__c + Total_Gifts_FY26_Non_Pledge__c + Soft_Credits_FY26__c. Key rule: Pledge counted when MADE, not when PAID.', category: 'Campaign Credit' },
    { term: 'Cash', definition: 'Money actually received. Field: Giving_this_Fiscal_Year__c.', category: 'Campaign Credit' },
    { term: 'Fiscal Year', definition: 'July 1 – June 30. FY26 = July 1, 2025 – June 30, 2026.', category: 'Campaign Credit' },
    { term: 'LYBUNT', definition: 'Last Year But Unfortunately Not This year. Campaign Credit LYBUNT = had recognition FY25, none FY26. Payment-Based LYBUNT = made payments FY25, none FY26.', category: 'Donor Metrics' },
    { term: 'SYBUNT', definition: 'Some Years But Unfortunately Not This year. Donors who gave in a prior year (not last year) but not this year.', category: 'Donor Metrics' },
    { term: 'Retention Rate', definition: 'FY26 donors who also gave FY25 ÷ total FY25 donors.', category: 'Donor Metrics' },
    { term: 'Average Gift', definition: 'Total Recognition ÷ Donor Count.', category: 'Donor Metrics' },
    { term: 'Giving Societies', definition: 'Ben Gurion $100K+, King David $50K-99K, Maimonides $25K-49K, Chai $18K-24K, Pomegranate $10K-17K, Lion of Judah $5K+ (Women), Sabra $1.8K-4.9K.', category: 'Giving Levels' },
  ],

  'donor-health': [
    { term: 'Fiscal Year', definition: 'July 1 – June 30. FY26 = July 1, 2025 – June 30, 2026.', category: 'General' },
    { term: 'Data Quality Score', definition: 'Composite of email valid (25%), phone valid (25%), address complete (25%), campaign attribution (25%).', category: 'Data Quality' },
    { term: 'Monthly Recurring', definition: 'Sum of active recurring gift amounts processed monthly.', category: 'Giving' },
    { term: 'Failed Charges', definition: 'Recurring payment attempts that were declined or failed this week.', category: 'Giving' },
    { term: 'Retention Rate', definition: 'FY26 donors who also gave FY25 ÷ total FY25 donors.', category: 'Donor Metrics' },
  ],

  drm: [
    { term: 'Recognition', definition: 'Sum of Commitments + Direct Gifts + Soft Credits. Pledge counted when MADE, not when PAID.', category: 'Campaign Credit' },
    { term: 'LYBUNT', definition: 'Last Year But Unfortunately Not This year. Donors with recognition FY25 but none FY26.', category: 'Donor Metrics' },
    { term: 'Portfolio', definition: 'Set of donors assigned to a specific DRM (Donor Relations Manager) for cultivation and stewardship.', category: 'DRM' },
    { term: 'Capacity Gap', definition: 'Estimated giving capacity minus current giving level.', category: 'DRM' },
  ],

  'ask-list': [
    { term: 'Suggested Ask', definition: 'Recommended solicitation amount based on MAX(prior year, average annual), rounded to natural giving level.', category: 'Ask Strategy' },
    { term: 'Natural Giving Levels', definition: '$100, $250, $500, $1K, $2.5K, $5K, $10K, $18K, $25K, $50K, $100K.', category: 'Ask Strategy' },
    { term: 'Score', definition: 'Priority ranking combining amount, recency, years giving, and category.', category: 'Ask Strategy' },
    { term: 'LYBUNT', definition: 'Last Year But Unfortunately Not This year. Had giving FY25, none FY26.', category: 'Donor Status' },
    { term: 'SYBUNT', definition: 'Some Years But Unfortunately Not This year. Gave in a prior year but not recently.', category: 'Donor Status' },
  ],

  silence: [
    { term: 'Risk Score', definition: 'Composite of giving level, years of giving, and time since last gift.', category: 'Risk Assessment' },
    { term: 'Risk Tiers', definition: 'Critical (≥$5K FY25), High ($1K-5K), Medium ($500-999), Watch ($100-499).', category: 'Risk Assessment' },
    { term: 'Revenue at Risk', definition: 'Sum of prior year giving for at-risk donors.', category: 'Risk Assessment' },
    { term: 'Days Since Gift', definition: 'Calendar days since the donor\'s most recent gift transaction.', category: 'Risk Assessment' },
    { term: 'Silence Period', definition: 'Number of days since a donor last made a gift or had recorded engagement.', category: 'Risk' },
    { term: 'Risk Tier', definition: 'Classification based on silence duration and giving history: Critical (180+ days, major donor), High (90-180 days), Medium (60-90 days), Low (30-60 days).', category: 'Risk' },
    { term: 'Last Gift Date', definition: 'Most recent gift transaction date for the donor.', category: 'Donor' },
    { term: 'Lifetime Value', definition: 'Total cumulative giving across all fiscal years.', category: 'Donor' },
  ],

  prospect: [
    { term: 'Capacity Gap', definition: 'Estimated giving capacity minus current giving.', category: 'Prospect Metrics' },
    { term: 'Upgrade Prospect', definition: 'Donor giving below estimated capacity with room for a larger ask.', category: 'Prospect Metrics' },
    { term: 'Trajectory', definition: 'Year-over-year giving direction: increasing, decreasing, or stable.', category: 'Prospect Metrics' },
    { term: 'High-Cap Non-Donors', definition: 'Individuals with significant estimated capacity who have not yet made a gift.', category: 'Prospect Metrics' },
  ],

  pledge: [
    { term: 'Aging', definition: 'Current (0-30 days), 30-60 Days, 60-90 Days, 90+ Days past due.', category: 'Pledge Status' },
    { term: 'Fulfillment Rate', definition: 'Total paid ÷ total pledged.', category: 'Pledge Status' },
    { term: 'Write-off Risk', definition: 'Past end date with balance remaining — may need to be written off.', category: 'Pledge Status' },
    { term: 'Open Pledges', definition: 'Pledges with remaining unpaid balance.', category: 'Pledge Status' },
  ],

  board: [
    { term: 'Board Participation', definition: '% of board members with FY26 giving (any amount).', category: 'Board Metrics' },
    { term: 'Matched in SF', definition: 'Board member found in Salesforce by name match.', category: 'Board Metrics' },
    { term: 'Recognition', definition: 'Sum of Commitments + Direct Gifts + Soft Credits for board members.', category: 'Giving' },
    { term: 'Giving Societies', definition: 'Ben Gurion $100K+, King David $50K-99K, Maimonides $25K-49K, Chai $18K-24K, Pomegranate $10K-17K, Lion of Judah $5K+ (Women), Sabra $1.8K-4.9K.', category: 'Giving' },
  ],

  stripe: [
    { term: 'Gross Volume', definition: 'Total charges before Stripe processing fees.', category: 'Revenue' },
    { term: 'Net After Fees', definition: 'Gross volume minus Stripe processing fees.', category: 'Revenue' },
    { term: 'Fee Rate', definition: 'Fees ÷ Gross × 100. Typical rate is ~2.2-2.9%.', category: 'Revenue' },
    { term: 'GiveCloud vs Direct', definition: 'GiveCloud charges come through the online giving platform; Direct charges are processed directly via Stripe.', category: 'Sources' },
  ],

  givecloud: [
    { term: 'MRR', definition: 'Monthly Recurring Revenue — sum of active recurring gift amounts.', category: 'Recurring' },
    { term: 'Churn Rate', definition: 'Cancelled recurring profiles ÷ total active profiles (monthly).', category: 'Recurring' },
    { term: 'Conversion Rate', definition: 'Completed contributions ÷ page visits.', category: 'Online Giving' },
    { term: 'Average Gift', definition: 'Total online giving ÷ number of contributions.', category: 'Online Giving' },
  ],

  ramp: [
    { term: 'Receipt Compliance', definition: '% of transactions with attached receipts.', category: 'Compliance' },
    { term: 'Budget Pace', definition: 'YTD actual spend ÷ YTD budget allocation.', category: 'Budget' },
    { term: 'Dormant Card', definition: 'No transaction activity in 30+ days.', category: 'Card Management' },
    { term: 'Card Utilization', definition: 'Amount spent ÷ card limit.', category: 'Card Management' },
  ],

  'ap-expense': [
    { term: 'Missing Receipt', definition: 'Transaction without uploaded receipt documentation.', category: 'Compliance' },
    { term: 'Policy Exception', definition: 'Transaction flagging a spend policy rule (weekend, international, over limit).', category: 'Compliance' },
    { term: 'AP Aging', definition: 'Outstanding payables grouped by days since invoice.', category: 'Accounts Payable' },
    { term: 'Receipt Compliance', definition: '% of transactions with attached receipts.', category: 'Compliance' },
    { term: 'Dormant Cards', definition: 'Cards with no transaction activity in 30+ days.', category: 'Card Management' },
  ],

  facilities: [
    { term: 'Current Temp', definition: 'Reading from thermostat sensor (°F).', category: 'Temperature' },
    { term: 'Set Point', definition: 'Target temperature for heating/cooling system.', category: 'Temperature' },
    { term: 'HVAC Modes', definition: 'heat, cool, auto, off, auxHeatOnly.', category: 'Equipment' },
    { term: 'Equipment Status', definition: 'idle, heating, cooling, fan.', category: 'Equipment' },
    { term: 'Server Room Thresholds', definition: 'High >78°F, Low <60°F, Humidity >60%.', category: 'Alerts' },
    { term: 'Alert Conditions', definition: 'Offline (not reporting), Large Deviation (>5°F from setpoint), Equipment Stuck (4+ hours continuous).', category: 'Alerts' },
  ],

  financial: [
    { term: 'Operating Margin', definition: '(Revenue − Expenses) ÷ Revenue × 100. Measures how much of each dollar raised is retained after operations.', category: 'KPIs' },
    { term: 'Months of Reserves', definition: 'Cash position ÷ average monthly expenses. Indicates how many months the organization could operate without new revenue.', category: 'KPIs' },
    { term: 'Functional Expenses', definition: 'Expenses classified by function: Program Services (mission delivery), Management & General (overhead), and Fundraising. Required by GAAP for nonprofits.', category: 'Financial Statements' },
    { term: 'Program Ratio', definition: 'Program Services expenses ÷ Total expenses. Nonprofits typically target ≥75%. Measures how much spending directly supports the mission.', category: 'Financial Statements' },
    { term: 'Net Assets Without Restriction', definition: 'Resources available for general operations, not subject to donor-imposed restrictions.', category: 'Balance Sheet' },
    { term: 'Net Assets With Restriction', definition: 'Resources subject to donor-imposed purpose or time restrictions. Released when restrictions are met.', category: 'Balance Sheet' },
    { term: 'Change in Net Assets', definition: 'Total Revenue minus Total Expenses for the period. Equivalent to net income/loss in for-profit accounting.', category: 'Income Statement' },
    { term: 'Budget Variance', definition: 'Difference between budgeted and actual amounts. For revenue: positive = favorable (over budget). For expenses: positive = favorable (under budget).', category: 'Budget' },
    { term: 'Favorable Variance', definition: 'Revenue exceeding budget OR expenses below budget. Both improve the bottom line. Shown in green.', category: 'Budget' },
    { term: 'Unfavorable Variance', definition: 'Revenue below budget OR expenses exceeding budget. Both hurt the bottom line. Shown in red.', category: 'Budget' },
  ],

  'data-quality': [
    { term: 'Overall Score', definition: 'Weighted average across 5 categories (0-100).', category: 'Scoring' },
    { term: 'Categories', definition: 'Contact Completeness, Duplicate Records, Campaign Health, Pipeline Hygiene, Recognition Integrity.', category: 'Scoring' },
    { term: 'Severity Levels', definition: 'Critical (data loss risk), High (reporting impact), Medium (best practice), Low (cosmetic).', category: 'Scoring' },
    { term: 'Data Quality Score', definition: 'Composite of email valid (25%), phone valid (25%), address complete (25%), campaign attribution (25%).', category: 'Contact Quality' },
  ],

  projects: [
    { term: 'P0', definition: 'Critical priority — actively blocking work or has an immediate deadline.', category: 'Priority' },
    { term: 'P1', definition: 'High priority — should be addressed this week or next.', category: 'Priority' },
    { term: 'P2', definition: 'Medium priority — important but not urgent, planned for this month.', category: 'Priority' },
    { term: 'P3', definition: 'Low priority — backlog item, nice to have.', category: 'Priority' },
    { term: 'Swim Lane', definition: 'Category grouping for related work items across the organization.', category: 'Organization' },
    { term: 'Owner', definition: 'Person responsible for the next action on this item.', category: 'Organization' },
    { term: 'McKinsey Review', definition: 'Strategic analysis of the Federation Analytics platform rating each dashboard on decision-orientation, data quality, and UX.', category: 'Sources' },
  ],

  hubspot: [
    { term: 'Engagement Segment', definition: 'Classification based on email interaction: Champion (high open+click), Active (regular opens), Passive (occasional), At Risk (declining), Dormant (no activity 90+ days), Ghost (never opened), New (<30 days).', category: 'Engagement' },
    { term: 'Ghost', definition: 'Contacts who have never opened a single email. 55.9% of our database. Candidates for re-engagement or cleanup.', category: 'Engagement' },
    { term: 'Champion', definition: 'Contacts with highest open and click rates. Only 27 out of 32,977 contacts (0.1%).', category: 'Engagement' },
    { term: 'Open Rate', definition: 'Percentage of delivered emails that were opened. Industry average for nonprofits: ~25%.', category: 'Email Metrics' },
    { term: 'Click Rate', definition: 'Percentage of delivered emails where a link was clicked. Industry average: ~2.5%.', category: 'Email Metrics' },
  ],

  wealth: [
    { term: 'Net Worth', definition: 'WealthEngine estimated total net worth based on real estate, investments, income, and asset data.', category: 'Wealth Indicators' },
    { term: 'Gift Capacity', definition: 'WealthEngine estimated annual giving capacity. Based on net worth, income, and giving history.', category: 'Wealth Indicators' },
    { term: 'P2G Score', definition: 'Propensity to Give score (1-99). Higher = more likely to make charitable gifts. Based on giving history, demographics, and wealth indicators.', category: 'Wealth Indicators' },
    { term: 'Share of Wallet', definition: 'FY26 Recognition ÷ (5-Year Gift Capacity ÷ 5). Shows what percentage of estimated giving capacity goes to Federation.', category: 'Analysis' },
    { term: 'Capacity Gap', definition: 'Difference between estimated gift capacity and current giving level. Represents upgrade potential.', category: 'Analysis' },
  ],

  'ecobee-trends': [
    { term: 'Zone', definition: 'Individual thermostat/area in the building complex. 48 zones across Federation, JCF, ADL, Common areas.', category: 'Facilities' },
    { term: 'Setback', definition: 'Overnight temperature reduction to save energy. Causes morning temperature swings as zones recover.', category: 'HVAC' },
    { term: 'Server Room', definition: 'Critical cooling zones (Common-Server Room, ADL-Server, Common-Data Room). Must stay below 80°F.', category: 'Critical' },
    { term: 'Heating Hours', definition: 'Total hours the heating system was active across all zones. Higher = colder period or efficiency issues.', category: 'HVAC' },
    { term: 'Cooling Hours', definition: 'Total hours the cooling system was active across all zones.', category: 'HVAC' },
  ],

  monday: [
    { term: 'Board', definition: 'A Monday.com project board containing items (tasks/records) organized in groups.', category: 'Monday.com' },
    { term: 'Items', definition: 'Individual records/tasks within a Monday.com board. Can represent grants, event tasks, onboarding steps, etc.', category: 'Monday.com' },
    { term: 'Groups', definition: 'Sections within a board that organize items by status, phase, or category.', category: 'Monday.com' },
  ],

  boards: [
    { term: 'SF Match', definition: 'A nonprofit board member whose name was found in our Salesforce database. Indicates existing relationship with Federation.', category: 'Matching' },
    { term: 'Match Rate', definition: 'Percentage of identified board members who exist in our Salesforce donor database.', category: 'Matching' },
    { term: 'EIN', definition: 'Employer Identification Number. Unique IRS identifier for nonprofit organizations.', category: 'Organization' },
    { term: 'Total Revenue', definition: 'Annual revenue from most recent IRS Form 990 filing.', category: 'Organization' },
  ],

  'data-duel': [
    { term: 'Data Detective', definition: 'AI analyst specializing in correlation hunting, statistical anomalies, and pattern spotting. Uses regression and clustering.', category: 'Analysts' },
    { term: 'Operations Oracle', definition: 'AI analyst specializing in process efficiency, cost optimization, and budget variance analysis.', category: 'Analysts' },
    { term: 'Donor Whisperer', definition: 'AI analyst specializing in behavioral psychology, giving patterns, and donor segmentation. 11 wins out of 13 runs.', category: 'Analysts' },
    { term: 'Compounding Intelligence', definition: 'Each tournament builds on prior findings, questions, and trends. The state layer means Day 10 has accumulated intelligence from all prior days.', category: 'Methodology' },
    { term: 'Novelty Score', definition: 'Points for genuinely new discoveries. Repeating a known finding from prior runs incurs a penalty.', category: 'Scoring' },
    { term: 'Dollar Impact', definition: 'Estimated financial significance of a finding. Used to prioritize action items.', category: 'Scoring' },
  ],

  'chart-gallery': [
    { term: 'Plotly', definition: 'Interactive JavaScript charting library. All 35 charts use Plotly.js with real JFSD data.', category: 'Technical' },
    { term: 'Chart Categories', definition: 'Basic (line, bar, scatter), Financial (waterfall, funnel, gauge), Statistical (histogram, box, violin), Maps (choropleth, geo), Hierarchical (sankey, treemap, sunburst).', category: 'Technical' },
  ],
};
