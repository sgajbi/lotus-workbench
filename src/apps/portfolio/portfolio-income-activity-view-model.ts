import type {
  PortfolioActivitySummaryView,
  PortfolioIncomePeriodSummary,
  PortfolioIncomeSummaryView,
  PortfolioWorkspace,
} from "./types";

export type PortfolioActivityDirection = "inflow" | "outflow" | "unclassified";

export type PortfolioIncomePeriodReview = {
  gross: number;
  withholdingTax: number;
  otherDeductions: number;
  net: number;
  bookingCount: number;
};

export type PortfolioIncomeReviewRow = {
  key: string;
  label: string;
  requestedWindow: PortfolioIncomePeriodReview;
  yearToDate: PortfolioIncomePeriodReview;
};

export type PortfolioIncomeReview = {
  reportingCurrency: string;
  windowStartDate: string;
  windowEndDate: string;
  requestedWindow: PortfolioIncomePeriodReview;
  yearToDate: PortfolioIncomePeriodReview;
  rows: PortfolioIncomeReviewRow[];
};

export type PortfolioActivityReviewRow = {
  key: string;
  label: string;
  direction: PortfolioActivityDirection;
  requestedWindowAmount: number;
  yearToDateAmount: number;
  requestedWindowBookingCount: number;
  yearToDateBookingCount: number;
  shareOfWindowActivityPct: number;
};

export type PortfolioActivityMovementSummary = {
  grossInflows: number;
  grossOutflows: number;
  netMovement: number;
  unclassifiedMovement: number;
  bookingCount: number;
  classifiedBookingCount: number;
  unclassifiedBookingCount: number;
};

export type PortfolioActivityReview = {
  reportingCurrency: string;
  windowStartDate: string;
  windowEndDate: string;
  requestedWindow: PortfolioActivityMovementSummary;
  yearToDate: PortfolioActivityMovementSummary;
  rows: PortfolioActivityReviewRow[];
};

export type PortfolioIncomeActivityReview = {
  income: PortfolioIncomeReview | null;
  activity: PortfolioActivityReview | null;
  cashWeightPct: number | null;
  asOfDate: string;
};

const ACTIVITY_DIRECTION: Record<string, PortfolioActivityDirection> = {
  INFLOWS: "inflow",
  OUTFLOWS: "outflow",
  FEES: "outflow",
  TAXES: "outflow",
};

const ACTIVITY_LABELS: Record<string, string> = {
  INFLOWS: "Subscriptions and transfers in",
  OUTFLOWS: "Withdrawals and transfers out",
  FEES: "Fees",
  TAXES: "Taxes",
};

const INCOME_LABELS: Record<string, string> = {
  DIVIDEND: "Dividend income",
  DIVIDENDS: "Dividend income",
  INTEREST: "Interest income",
  COUPON: "Coupon income",
  FIXED_INCOME_COUPONS: "Coupon income",
};

const ACTIVITY_SORT_ORDER = ["INFLOWS", "OUTFLOWS", "FEES", "TAXES"];

export function buildPortfolioIncomeActivityReview(
  workspace: PortfolioWorkspace,
): PortfolioIncomeActivityReview {
  return {
    income: buildIncomeReview(workspace.income_summary),
    activity: buildActivityReview(workspace.activity_summary),
    cashWeightPct: workspace.summary.cash_weight_pct,
    asOfDate: workspace.as_of_date,
  };
}

export function buildActivityMovementSummary(
  summary: PortfolioActivitySummaryView | null | undefined,
  period: "requested_window" | "year_to_date" = "requested_window",
): PortfolioActivityMovementSummary | null {
  if (!summary) {
    return null;
  }

  return summary.buckets.reduce<PortfolioActivityMovementSummary>(
    (totals, bucket) => {
      const direction = getPortfolioActivityDirection(bucket.bucket);
      const measure = bucket[period];
      const magnitude = Math.abs(measure.reporting_currency_amount);

      if (direction === "inflow") {
        totals.grossInflows += magnitude;
        totals.classifiedBookingCount += measure.transaction_count;
      } else if (direction === "outflow") {
        totals.grossOutflows += magnitude;
        totals.classifiedBookingCount += measure.transaction_count;
      } else {
        totals.unclassifiedMovement += magnitude;
        totals.unclassifiedBookingCount += measure.transaction_count;
      }

      totals.netMovement = totals.grossInflows - totals.grossOutflows;
      totals.bookingCount += measure.transaction_count;
      return totals;
    },
    {
      grossInflows: 0,
      grossOutflows: 0,
      netMovement: 0,
      unclassifiedMovement: 0,
      bookingCount: 0,
      classifiedBookingCount: 0,
      unclassifiedBookingCount: 0,
    },
  );
}

export function getPortfolioActivityDirection(bucket: string): PortfolioActivityDirection {
  return ACTIVITY_DIRECTION[normalizeCode(bucket)] ?? "unclassified";
}

export function getSignedPortfolioActivityAmount(bucket: string, amount: number): number | null {
  const direction = getPortfolioActivityDirection(bucket);
  if (direction === "unclassified") {
    return null;
  }
  const magnitude = Math.abs(amount);
  return direction === "inflow" ? magnitude : -magnitude;
}

export function formatPortfolioIncomeTypeLabel(incomeType: string): string {
  const normalized = normalizeCode(incomeType);
  return INCOME_LABELS[normalized] ?? formatCode(normalized);
}

export function formatPortfolioActivityLabel(bucket: string): string {
  const normalized = normalizeCode(bucket);
  return ACTIVITY_LABELS[normalized] ?? `Other activity · ${formatCode(normalized)}`;
}

function buildIncomeReview(
  summary: PortfolioIncomeSummaryView | null | undefined,
): PortfolioIncomeReview | null {
  if (!summary) {
    return null;
  }

  return {
    reportingCurrency: summary.reporting_currency,
    windowStartDate: summary.window_start_date,
    windowEndDate: summary.window_end_date,
    requestedWindow: buildIncomePeriodReview(summary.totals_requested_window),
    yearToDate: buildIncomePeriodReview(summary.totals_year_to_date),
    rows: summary.income_types.map((item) => ({
      key: item.income_type,
      label: formatPortfolioIncomeTypeLabel(item.income_type),
      requestedWindow: buildIncomePeriodReview(item.requested_window),
      yearToDate: buildIncomePeriodReview(item.year_to_date),
    })),
  };
}

function buildActivityReview(
  summary: PortfolioActivitySummaryView | null | undefined,
): PortfolioActivityReview | null {
  if (!summary) {
    return null;
  }

  const requestedWindow = buildActivityMovementSummary(summary, "requested_window");
  const yearToDate = buildActivityMovementSummary(summary, "year_to_date");
  const grossWindowActivity = summary.buckets.reduce(
    (total, bucket) => total + Math.abs(bucket.requested_window.reporting_currency_amount),
    0,
  );

  const rows = summary.buckets
    .map<PortfolioActivityReviewRow>((bucket) => {
      const direction = getPortfolioActivityDirection(bucket.bucket);
      const requestedMagnitude = Math.abs(bucket.requested_window.reporting_currency_amount);
      const yearToDateMagnitude = Math.abs(bucket.year_to_date.reporting_currency_amount);
      return {
        key: bucket.bucket,
        label: formatPortfolioActivityLabel(bucket.bucket),
        direction,
        requestedWindowAmount:
          getSignedPortfolioActivityAmount(bucket.bucket, requestedMagnitude) ?? requestedMagnitude,
        yearToDateAmount:
          getSignedPortfolioActivityAmount(bucket.bucket, yearToDateMagnitude) ?? yearToDateMagnitude,
        requestedWindowBookingCount: bucket.requested_window.transaction_count,
        yearToDateBookingCount: bucket.year_to_date.transaction_count,
        shareOfWindowActivityPct:
          grossWindowActivity > 0 ? (requestedMagnitude / grossWindowActivity) * 100 : 0,
      };
    })
    .sort((left, right) => getActivitySortRank(left.key) - getActivitySortRank(right.key));

  return {
    reportingCurrency: summary.reporting_currency,
    windowStartDate: summary.window_start_date,
    windowEndDate: summary.window_end_date,
    requestedWindow: requestedWindow ?? emptyActivityMovementSummary(),
    yearToDate: yearToDate ?? emptyActivityMovementSummary(),
    rows,
  };
}

function buildIncomePeriodReview(period: PortfolioIncomePeriodSummary): PortfolioIncomePeriodReview {
  return {
    gross: period.gross.reporting_currency_amount,
    withholdingTax: period.withholding_tax.reporting_currency_amount,
    otherDeductions: period.other_deductions.reporting_currency_amount,
    net: period.net.reporting_currency_amount,
    bookingCount: period.net.transaction_count,
  };
}

function emptyActivityMovementSummary(): PortfolioActivityMovementSummary {
  return {
    grossInflows: 0,
    grossOutflows: 0,
    netMovement: 0,
    unclassifiedMovement: 0,
    bookingCount: 0,
    classifiedBookingCount: 0,
    unclassifiedBookingCount: 0,
  };
}

function getActivitySortRank(bucket: string): number {
  const rank = ACTIVITY_SORT_ORDER.indexOf(normalizeCode(bucket));
  return rank === -1 ? ACTIVITY_SORT_ORDER.length : rank;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function formatCode(value: string): string {
  if (!value) {
    return "Unclassified";
  }
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}
