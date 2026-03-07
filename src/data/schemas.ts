export interface WealthEngineDataSchema {
  asOfDate: string;
  kpis: { totalScreened: number; matched: number; avgAge: number };
  netWorthDistribution: Array<{ label: string; count: number }>;
  giftCapacityDistribution: Array<{ label: string; count: number }>;
  p2gDistribution: Array<{ score: string; count: number }>;
  topProspects: Array<{ name: string }>;
}

export interface ProjectTrackerDataSchema {
  asOfDate: string;
  kpis: { totalItems: number; thisWeek: number; blocked: number; completedThisMonth: number };
  columns: string[];
  columnLabels: Record<string, string>;
  swimLanes: string[];
  items: Array<{ id: string; title: string; column: string; swimLane: string; priority: string; owner: string }>;
}

export interface SilenceAlertsDataSchema {
  asOfDate: string;
  count: number;
  kpis: { totalAtRisk: number; revenueAtRisk: number; criticalCount: number; avgDaysSinceGift: number };
  byTier: Array<{ tier: string; count: number; revenueAtRisk: number }>;
  donors: Array<{ name: string; riskTier: string; riskScore: number; daysSinceGift: number }>;
}

export interface RampAnalyticsDataSchema {
  asOfDate: string;
  kpis: { totalSpendFY26: number; monthlyAvg: number; activeCards: number };
  monthlyTrend: Array<{ month: string; amount: number }>;
  departmentSpend: Array<{ dept: string; amount: number; budget: number; pctOfBudget: number }>;
  categoryBreakdown: Array<{ category: string; amount: number; txnCount: number }>;
}

export interface ProspectResearchDataSchema {
  asOfDate: string;
  kpis: { totalProfiled: number; totalCapacityGap: number; upgradeCount: number; highCapacityNonDonors: number };
  upgradeProspects: Array<{ name: string; currentGiving: number; estimatedCapacity: number; gap: number }>;
  majorDonorPipeline: Array<{ name: string; capacityTier: string; capacity: number }>;
}

export interface WeeklyAskListDataSchema {
  asOfDate: string;
  totalPotentialRevenue: number;
  totalProspects: number;
  kpis: { totalPotential: number; top10Potential: number; lybuntCount: number; upgradeCount: number; lapsedCount: number };
  byPriority: Array<{ priority: string; count: number; potential: number }>;
  donors: Array<{ rank: number; name: string; suggestedAsk: number; category: string }>;
}

export interface StripeDataSchema {
  kpis: { grossVolume: number; netAfterFees: number; totalFees: number; avgFeeRate: number; totalCharges: number; avgPerCharge: number; asOfDate: string };
  monthlyData: Array<{ month: string; charges: number; amount: number; fees: number; feeRate: number }>;
  cardBrandData: Array<{ brand: string; amount: number; charges: number }>;
  sourceData: Array<{ source: string; charges: number; amount: number; pct: number }>;
}

export interface ChartGalleryDataSchema {
  charts: Array<{ file: string; name: string; cat: string }>;
}

export interface FacilitiesDataSchema {
  asOfDate: string;
  kpis: { totalThermostats: number; online: number; offline: number; avgTemp: number; alertCount: number };
  buildings: Array<{ name: string; thermostats: Array<{ id: string; name: string }> }>;
  alerts: Array<{ thermostat: string; type: string; timestamp: string }>;
}

export interface EcobeeTrendsDataSchema {
  asOfDate: string;
  buildingDaily: Array<{ date: string; avgTemp: number; minTemp: number; maxTemp: number; totalHeatingMin: number; totalCoolingMin: number }>;
  zones: Array<{ name: string; group: string; avgTemp7d: number; avgHumidity7d: number; readings7d: number }>;
  serverRoom?: Array<{ name: string; group: string; avgTemp7d: number; avgHumidity7d: number; readings7d: number }>;
}

export interface BoardReportingDataSchema {
  asOfDate: string;
  kpis: { overallBoardParticipation: number; totalBoardGiving: number; yoyChange: number };
  campaignSummary: { goal: number; raised: number; pctOfGoal: number; donorCount: number; priorYearComparison: number };
  boards: Array<{ name: string; shortName: string; totalMembers: number; members: Array<{ name: string; status: string; fy26Amount: number; fy25Amount: number }> }>;
  givingLevels: Array<{ level: string; donors: number; amount: number }>;
}

export interface MondayDataSchema {
  asOfDate: string;
  kpis: { totalBoards: number; totalItems: number };
  boards: Array<{ id: string; name: string; totalItems: number }>;
}

export interface FinancialStatementsDataSchema {
  period: string;
  monthsElapsed: number;
  kpis: { totalRevenue: number; totalExpenses: number; netSurplusDeficit: number; operatingMargin: number; cashPosition: number; monthsOfReserves: number };
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number }>;
  balanceSheet: { asOfDate: string };
}

export interface NonprofitBoardsDataSchema {
  asOfDate: string;
  kpis: { totalOrgs: number; totalMembers: number; matchedToSF: number; matchRate: number };
  organizations: Array<{ name: string; boardMembers: number; revenue: number; city: string }>;
  matchedContacts: Array<{ name: string; title: string; org: string }>;
}

export interface HubspotEngagementSchema {
  summary: { total_contacts: number; generated_at: string; segments: Record<string, { count: number; pct: number }> };
}

export type HubspotEmailsSchema = Array<{ id: string; name: string; subject: string; state: string; type: string; created: string }>;

export interface PledgeManagementDataSchema {
  asOfDate: string;
  summary: { totalOpenPledges: number; avgPledgeSize: number };
  kpis: { totalOutstanding: number; fulfillmentRate: number; writeOffRiskAmount: number; writeOffRiskCount: number; pledgesThisMonth: number };
  agingBuckets: Array<{ bucket: string; count: number; amount: number }>;
  topOpenPledges: Array<{ name: string; pledgedAmount: number; paidAmount: number; balance: number; endDate: string }>;
}

export interface CampaignTrackerDataSchema {
  asOfDate: string;
  annualCampaign: { goal: number; raised: number; pctOfGoal: number; donorCount: number; avgGift: number; priorYearSamePoint: number };
  momentum: { amountThisWeek: number; amountLastWeek: number; weekOverWeekPct: number };
  weeklyMomentum: Array<{ weekOf: string; amount: number }>;
  donorBreakdown: { newDonors: number; returningDonors: number; lybuntRecovered: number; retentionRate: number };
}

export interface DRMPortfolioDataSchema {
  asOfDate: string;
  kpis: { totalPortfolioDonors: number; totalRecognitionFY26: number; totalLYBUNT: number; avgPortfolioSize: number };
  drms: Array<{ name: string; slug: string; totalDonors: number; totalRecognitionFY26: number; lybuntCount: number; topDonors: Array<{ name: string }>; lybuntList: Array<{ name: string }> }>;
}

export interface DataQualityDataSchema {
  asOfDate: string;
  overallScore: number;
  kpis: { criticalIssues: number; highIssues: number; mediumIssues: number; lowIssues: number; totalRecordsAffected: number; totalMajorDonors: number };
  categories: Array<{ name: string; score: number; issues: Array<{ metric: string; count: number; severity: string }> }>;
}

export interface GiveCloudDataSchema {
  asOfDate: string;
  kpis: { totalOnlineRevenue: number; activeRecurring: number; newDonorsOnline: number };
  onlineGiving: { totalContributions: number; avgGift: number; medianGift: number };
  monthlyTrend: Array<{ month: string; amount: number; recurringAmount: number; contributions: number }>;
  recurring: { activeProfiles: number; monthlyRecurringRevenue: number; newThisMonth: number; cancelledThisMonth: number; churnRate: number; avgRecurringAmount: number };
}

export interface APExpenseDataSchema {
  asOfDate: string;
  kpis: { totalSpendThisWeek: number; missingReceipts: number; receiptComplianceRate: number; apOutstanding: number; overBudgetDepts: number; dormantCards: number };
  actionItems: Array<{ type: string; merchant: string; amount: number; date: string }>;
  expenseSummary: { byDepartment: Array<{ dept: string; amount: number }>; topMerchants: Array<{ merchant: string; amount: number }> };
  budgetPace: Array<{ department: string; budgetYTD: number; actualYTD: number; pctUsed: number }>;
}

export interface DataDuelDataSchema {
  asOfDate: string;
  kpis: { totalRuns: number; totalFindings: number; totalImpact: number; openQuestions: number };
  analysts: Record<string, { wins: number; runs: number; avgScore: number; bestScore: number }>;
  runs: Array<{ date: string; winner: string }>;
  topFindings: Array<{ date: string; title: string; analyst: string; impact: number; severity: string }>;
}

export interface DonorHealthDataSchema {
  asOfDate: string;
  kpis: { totalDonorsThisWeek: number; recurringRevenue: number; failedChargesCount: number; failedChargesAmount: number; dataQualityScore: number; retentionRate: number };
  newDonorsThisWeek: number;
  failedRecurring: Array<{ name: string; amount: number; reason: string; date: string }>;
  refundsOver100: Array<{ name: string; amount: number; reason: string; date: string }>;
  newDonorsBySource: Array<{ source: string; count: number; totalAmount: number }>;
}

type ExpectedType = "number" | "string" | "boolean" | "object" | "array";

interface FieldRule {
  path: string;
  type: ExpectedType;
  optional?: boolean;
}

export interface ValidationIssue {
  file: string;
  path: string;
  message: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeMatches(value: unknown, expected: ExpectedType): boolean {
  switch (expected) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return isObject(value);
    default:
      return false;
  }
}

function validatePath(file: string, data: unknown, path: string, expectedType: ExpectedType, optional: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const segments = path.split(".");

  const visit = (node: unknown, idx: number, currentPath: string) => {
    const segment = segments[idx];
    const atLeaf = idx === segments.length - 1;

    if (segment === "*") {
      if (!Array.isArray(node)) {
        issues.push({ file, path: currentPath || path, message: `Expected array before wildcard in "${path}"` });
        return;
      }
      if (atLeaf) {
        node.forEach((item, itemIndex) => {
          if (!typeMatches(item, expectedType)) {
            issues.push({
              file,
              path: `${currentPath}[${itemIndex}]`,
              message: `Expected ${expectedType}, received ${Array.isArray(item) ? "array" : typeof item}`,
            });
          }
        });
        return;
      }
      node.forEach((item, itemIndex) => {
        visit(item, idx + 1, `${currentPath}[${itemIndex}]`);
      });
      return;
    }

    if (!isObject(node)) {
      if (!optional) {
        issues.push({ file, path: currentPath || path, message: `Expected object while resolving "${path}"` });
      }
      return;
    }

    const next = node[segment];
    const nextPath = currentPath ? `${currentPath}.${segment}` : segment;

    if (next == null) {
      if (!optional) {
        issues.push({ file, path: nextPath, message: "Missing required field" });
      }
      return;
    }

    if (atLeaf) {
      if (!typeMatches(next, expectedType)) {
        issues.push({
          file,
          path: nextPath,
          message: `Expected ${expectedType}, received ${Array.isArray(next) ? "array" : typeof next}`,
        });
      }
      return;
    }

    visit(next, idx + 1, nextPath);
  };

  visit(data, 0, "");
  return issues;
}

function validateWithRules(file: string, data: unknown, rules: FieldRule[]): ValidationIssue[] {
  return rules.flatMap((rule) => validatePath(file, data, rule.path, rule.type, Boolean(rule.optional)));
}

const rulesByFile: Record<string, FieldRule[]> = {
  "wealthengine.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalScreened", type: "number" },
    { path: "kpis.matched", type: "number" },
    { path: "kpis.avgAge", type: "number" },
    { path: "netWorthDistribution", type: "array" },
    { path: "netWorthDistribution.*.label", type: "string" },
    { path: "netWorthDistribution.*.count", type: "number" },
    { path: "topProspects", type: "array" },
  ],
  "project-tracker.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalItems", type: "number" },
    { path: "columns", type: "array" },
    { path: "columnLabels", type: "object" },
    { path: "items", type: "array" },
    { path: "items.*.id", type: "string" },
    { path: "items.*.title", type: "string" },
    { path: "items.*.column", type: "string" },
  ],
  "silence-alerts.json": [
    { path: "asOfDate", type: "string" },
    { path: "count", type: "number" },
    { path: "kpis.totalAtRisk", type: "number" },
    { path: "kpis.revenueAtRisk", type: "number" },
    { path: "kpis.criticalCount", type: "number" },
    { path: "byTier", type: "array" },
    { path: "byTier.*.tier", type: "string" },
    { path: "byTier.*.count", type: "number" },
    { path: "donors", type: "array" },
    { path: "donors.*.name", type: "string" },
  ],
  "ramp-analytics.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalSpendFY26", type: "number" },
    { path: "kpis.monthlyAvg", type: "number" },
    { path: "monthlyTrend", type: "array" },
    { path: "monthlyTrend.*.month", type: "string" },
    { path: "monthlyTrend.*.amount", type: "number" },
    { path: "departmentSpend", type: "array" },
    { path: "departmentSpend.*.dept", type: "string" },
    { path: "departmentSpend.*.pctOfBudget", type: "number" },
  ],
  "prospect-research.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalProfiled", type: "number" },
    { path: "kpis.totalCapacityGap", type: "number" },
    { path: "upgradeProspects", type: "array" },
    { path: "upgradeProspects.*.name", type: "string" },
    { path: "upgradeProspects.*.gap", type: "number" },
    { path: "majorDonorPipeline", type: "array" },
    { path: "majorDonorPipeline.*.capacityTier", type: "string" },
    { path: "givingVsCapacity", type: "array" },
  ],
  "weekly-ask-list.json": [
    { path: "asOfDate", type: "string" },
    { path: "totalPotentialRevenue", type: "number" },
    { path: "totalProspects", type: "number" },
    { path: "kpis.totalPotential", type: "number" },
    { path: "byPriority", type: "array" },
    { path: "byPriority.*.priority", type: "string" },
    { path: "donors", type: "array" },
    { path: "donors.*.name", type: "string" },
    { path: "donors.*.suggestedAsk", type: "number" },
  ],
  "stripe.json": [
    { path: "kpis.grossVolume", type: "number" },
    { path: "kpis.totalFees", type: "number" },
    { path: "kpis.avgFeeRate", type: "number" },
    { path: "kpis.totalCharges", type: "number" },
    { path: "kpis.asOfDate", type: "string" },
    { path: "monthlyData", type: "array" },
    { path: "monthlyData.*.month", type: "string" },
    { path: "monthlyData.*.feeRate", type: "number" },
    { path: "cardBrandData", type: "array" },
    { path: "sourceData", type: "array" },
  ],
  "facilities.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalThermostats", type: "number" },
    { path: "kpis.online", type: "number" },
    { path: "kpis.offline", type: "number" },
    { path: "buildings", type: "array" },
    { path: "buildings.*.name", type: "string" },
    { path: "buildings.*.thermostats", type: "array" },
    { path: "alerts", type: "array" },
  ],
  "ecobee-trends.json": [
    { path: "asOfDate", type: "string" },
    { path: "buildingDaily", type: "array" },
    { path: "buildingDaily.*.date", type: "string" },
    { path: "buildingDaily.*.avgTemp", type: "number" },
    { path: "buildingDaily.*.totalHeatingMin", type: "number" },
    { path: "zones", type: "array" },
    { path: "zones.*.name", type: "string" },
    { path: "zones.*.avgTemp7d", type: "number" },
    { path: "serverRoom", type: "array", optional: true },
  ],
  "board-reporting.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.overallBoardParticipation", type: "number" },
    { path: "kpis.totalBoardGiving", type: "number" },
    { path: "campaignSummary.goal", type: "number" },
    { path: "campaignSummary.raised", type: "number" },
    { path: "boards", type: "array" },
    { path: "boards.*.name", type: "string" },
    { path: "boards.*.members", type: "array" },
  ],
  "monday.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalBoards", type: "number" },
    { path: "kpis.totalItems", type: "number" },
    { path: "boards", type: "array" },
    { path: "boards.*.id", type: "string" },
    { path: "boards.*.name", type: "string" },
  ],
  "financial-statements.json": [
    { path: "period", type: "string" },
    { path: "monthsElapsed", type: "number" },
    { path: "kpis.totalRevenue", type: "number" },
    { path: "kpis.totalExpenses", type: "number" },
    { path: "kpis.netSurplusDeficit", type: "number" },
    { path: "kpis.operatingMargin", type: "number" },
    { path: "monthlyTrend", type: "array" },
    { path: "balanceSheet.asOfDate", type: "string" },
    { path: "activities", type: "object" },
    { path: "functionalExpenses", type: "object" },
    { path: "budgetVsActual", type: "object" },
  ],
  "nonprofit-boards.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalOrgs", type: "number" },
    { path: "kpis.totalMembers", type: "number" },
    { path: "kpis.matchedToSF", type: "number" },
    { path: "organizations", type: "array" },
    { path: "organizations.*.name", type: "string" },
    { path: "matchedContacts", type: "array", optional: true },
  ],
  "hubspot-engagement.json": [
    { path: "summary.total_contacts", type: "number" },
    { path: "summary.generated_at", type: "string" },
    { path: "summary.segments", type: "object" },
  ],
  "hubspot-emails.json": [
    { path: "*", type: "object" },
    { path: "*.id", type: "string" },
    { path: "*.name", type: "string" },
    { path: "*.subject", type: "string" },
    { path: "*.state", type: "string" },
  ],
  "pledge-management.json": [
    { path: "asOfDate", type: "string" },
    { path: "summary.totalOpenPledges", type: "number" },
    { path: "summary.avgPledgeSize", type: "number" },
    { path: "kpis.totalOutstanding", type: "number" },
    { path: "kpis.fulfillmentRate", type: "number" },
    { path: "agingBuckets", type: "array" },
    { path: "topOpenPledges", type: "array" },
    { path: "byCampaign", type: "array" },
    { path: "recentPayments", type: "array" },
  ],
  "campaign-tracker.json": [
    { path: "asOfDate", type: "string" },
    { path: "annualCampaign.goal", type: "number" },
    { path: "annualCampaign.raised", type: "number" },
    { path: "annualCampaign.pctOfGoal", type: "number" },
    { path: "momentum.amountThisWeek", type: "number" },
    { path: "weeklyMomentum", type: "array" },
    { path: "donorBreakdown.newDonors", type: "number" },
    { path: "topGiftsThisWeek", type: "array" },
  ],
  "drm-portfolio.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalPortfolioDonors", type: "number" },
    { path: "kpis.totalRecognitionFY26", type: "number" },
    { path: "kpis.totalLYBUNT", type: "number" },
    { path: "drms", type: "array" },
    { path: "drms.*.name", type: "string" },
    { path: "drms.*.slug", type: "string" },
    { path: "drms.*.topDonors", type: "array" },
    { path: "drms.*.lybuntList", type: "array" },
  ],
  "data-quality.json": [
    { path: "asOfDate", type: "string" },
    { path: "overallScore", type: "number" },
    { path: "kpis.criticalIssues", type: "number" },
    { path: "kpis.totalRecordsAffected", type: "number" },
    { path: "categories", type: "array" },
    { path: "categories.*.name", type: "string" },
    { path: "categories.*.score", type: "number" },
    { path: "categories.*.issues", type: "array" },
  ],
  "givecloud.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalOnlineRevenue", type: "number" },
    { path: "kpis.activeRecurring", type: "number" },
    { path: "onlineGiving.totalContributions", type: "number" },
    { path: "monthlyTrend", type: "array" },
    { path: "recurring.monthlyRecurringRevenue", type: "number" },
    { path: "topProducts", type: "array" },
    { path: "conversionBySource", type: "array" },
  ],
  "james-ap-expense.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalSpendThisWeek", type: "number" },
    { path: "kpis.missingReceipts", type: "number" },
    { path: "kpis.receiptComplianceRate", type: "number" },
    { path: "actionItems", type: "array" },
    { path: "expenseSummary.byDepartment", type: "array" },
    { path: "expenseSummary.topMerchants", type: "array" },
    { path: "budgetPace", type: "array" },
    { path: "cardManagement", type: "object" },
    { path: "glHealth.apAgingBuckets", type: "array" },
  ],
  "data-duel.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalRuns", type: "number" },
    { path: "kpis.totalFindings", type: "number" },
    { path: "kpis.totalImpact", type: "number" },
    { path: "analysts", type: "object" },
    { path: "runs", type: "array" },
    { path: "topFindings", type: "array" },
    { path: "trends", type: "array" },
  ],
  "sharon-donor-health.json": [
    { path: "asOfDate", type: "string" },
    { path: "kpis.totalDonorsThisWeek", type: "number" },
    { path: "kpis.failedChargesCount", type: "number" },
    { path: "kpis.failedChargesAmount", type: "number" },
    { path: "kpis.dataQualityScore", type: "number" },
    { path: "newDonorsThisWeek", type: "number" },
    { path: "failedRecurring", type: "array" },
    { path: "refundsOver100", type: "array" },
    { path: "newDonorsBySource", type: "array" },
  ],
};

export const KNOWN_DATA_FILES = Object.keys(rulesByFile);

export function validateDataFile(fileName: string, data: unknown): ValidationIssue[] {
  const rules = rulesByFile[fileName];
  if (!rules) {
    return [{ file: fileName, path: fileName, message: "No schema rules registered for this data file" }];
  }
  return validateWithRules(fileName, data, rules);
}
