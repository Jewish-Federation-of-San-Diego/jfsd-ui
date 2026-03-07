import { toFiniteNumber } from "./formatters";

export interface DonorRecord {
  Id?: string | null;
  Name?: string | null;
  PersonEmail?: string | null;
  Net_Worth__c?: string | null;
  Recognition_Amount_All_Time__c?: number | string | null;
  Recognition_Amount_FY24__c?: number | string | null;
  Recognition_Amount_FY25__c?: number | string | null;
  Recognition_Amount_FY26__c?: number | string | null;
  attributes?: { type?: string; url?: string } | null;
}

export interface DonorDataResponse {
  totalSize?: number;
  done?: boolean;
  records?: DonorRecord[] | null;
}

export interface ParsedDonor {
  id: string;
  name: string;
  email: string;
  netWorth: string;
  fy24: number;
  fy25: number;
  fy26: number;
  allTime: number;
  annualCapacity: number;
  fiveYearCapacity: number;
  inferredCohortYear: number;
}

const NET_WORTH_TO_ANNUAL_CAPACITY: Record<string, number> = {
  "$25K-$50K": 300,
  "$50K-$100K": 750,
  "$100K-$500K": 2500,
  "$500K-$1MM": 7500,
  "$1MM-$5MM": 20000,
  "$5MM-$10MM": 50000,
  "$10MM-$25MM": 100000,
  "$25MM-$50MM": 250000,
  "$100MM-$500MM": 1000000,
  "$500MM+": 3000000,
};

function toNumberOrZero(value: number | string | null | undefined): number {
  return toFiniteNumber(value) ?? 0;
}

export function estimateAnnualCapacityFromNetWorth(netWorth: string | null | undefined): number {
  const key = (netWorth ?? "").trim();
  return NET_WORTH_TO_ANNUAL_CAPACITY[key] ?? 0;
}

export function inferCohortYear(
  allTimeRecognition: number,
  fy24: number,
  fy25: number,
  fy26: number,
  currentFiscalYear = 2026,
): number {
  const recentNonZero = [fy24, fy25, fy26].filter((v) => v > 0);
  const recentAverage =
    recentNonZero.length > 0
      ? recentNonZero.reduce((sum, value) => sum + value, 0) / recentNonZero.length
      : 250;
  const denominator = Math.max(recentAverage, 250);
  const estimatedYears = Math.round(allTimeRecognition > 0 ? allTimeRecognition / denominator : 1);
  const clampedYears = Math.max(1, Math.min(40, estimatedYears));
  return currentFiscalYear - clampedYears + 1;
}

export function parseDonorRecords(payload: DonorDataResponse | null | undefined): ParsedDonor[] {
  const records = Array.isArray(payload?.records) ? payload?.records : [];
  return records.map((record): ParsedDonor => {
    const fy24 = toNumberOrZero(record?.Recognition_Amount_FY24__c);
    const fy25 = toNumberOrZero(record?.Recognition_Amount_FY25__c);
    const fy26 = toNumberOrZero(record?.Recognition_Amount_FY26__c);
    const allTime = toNumberOrZero(record?.Recognition_Amount_All_Time__c);
    const annualCapacity = estimateAnnualCapacityFromNetWorth(record?.Net_Worth__c);
    const fiveYearCapacity = annualCapacity * 5;
    return {
      id: record?.Id ?? "",
      name: record?.Name ?? "Unknown Donor",
      email: record?.PersonEmail ?? "",
      netWorth: record?.Net_Worth__c ?? "Unknown",
      fy24,
      fy25,
      fy26,
      allTime,
      annualCapacity,
      fiveYearCapacity,
      inferredCohortYear: inferCohortYear(allTime, fy24, fy25, fy26),
    };
  });
}

export function calculateSowPercent(fy26Recognition: number, fiveYearCapacity: number): number {
  if (fiveYearCapacity <= 0) return 0;
  const annualCapacity = fiveYearCapacity / 5;
  if (annualCapacity <= 0) return 0;
  return (fy26Recognition / annualCapacity) * 100;
}

export type LifecycleSegment =
  | "New"
  | "Retained"
  | "Upgraded"
  | "Downgraded"
  | "Lapsed"
  | "Reactivated";

export function classifyLifecycleSegment(donor: ParsedDonor): LifecycleSegment | null {
  const fy24 = donor?.fy24 ?? 0;
  const fy25 = donor?.fy25 ?? 0;
  const fy26 = donor?.fy26 ?? 0;

  if (fy26 > 0 && fy25 === 0 && fy24 === 0) return "New";
  if (fy26 > 0 && fy25 === 0 && fy24 > 0) return "Reactivated";
  if (fy26 === 0 && fy25 > 0) return "Lapsed";
  if (fy26 > fy25 && fy25 > 0) return "Upgraded";
  if (fy26 > 0 && fy25 > 0 && fy26 < fy25) return "Downgraded";
  if (fy26 > 0 && fy25 > 0) return "Retained";
  return null;
}
