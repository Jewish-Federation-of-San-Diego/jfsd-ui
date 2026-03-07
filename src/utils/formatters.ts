type NumericValue = number | string | null | undefined;

interface NumberFormatOptions {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: Intl.NumberFormatOptions["notation"];
  fallback?: string;
}

interface CurrencyFormatOptions extends NumberFormatOptions {
  currency?: string;
}

interface PercentFormatOptions {
  decimals?: number;
  fromFraction?: boolean;
  fallback?: string;
  showSign?: boolean;
}

const DEFAULT_FALLBACK = "—";

export function toFiniteNumber(value: NumericValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]+/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function safeNumber(value: NumericValue, options: NumberFormatOptions = {}): string {
  const {
    locale = "en-US",
    minimumFractionDigits,
    maximumFractionDigits = minimumFractionDigits,
    notation = "standard",
    fallback = DEFAULT_FALLBACK,
  } = options;

  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return fallback;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
  }).format(numericValue);
}

export function safeCount(value: NumericValue, options: Omit<NumberFormatOptions, "minimumFractionDigits" | "maximumFractionDigits"> = {}): string {
  return safeNumber(value, {
    ...options,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function safeCurrency(value: NumericValue, options: CurrencyFormatOptions = {}): string {
  const {
    locale = "en-US",
    currency = "USD",
    minimumFractionDigits = 0,
    maximumFractionDigits = minimumFractionDigits,
    notation = "standard",
    fallback = DEFAULT_FALLBACK,
  } = options;

  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return fallback;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
  }).format(numericValue);
}

export function safePercent(value: NumericValue, options: PercentFormatOptions = {}): string {
  const {
    decimals = 1,
    fromFraction = false,
    fallback = DEFAULT_FALLBACK,
    showSign = false,
  } = options;
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return fallback;

  const display = fromFraction ? numericValue * 100 : numericValue;
  const sign = showSign && display > 0 ? "+" : "";
  return `${sign}${safeNumber(display, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    fallback,
  })}%`;
}
