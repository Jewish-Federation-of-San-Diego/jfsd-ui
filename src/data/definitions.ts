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
};
