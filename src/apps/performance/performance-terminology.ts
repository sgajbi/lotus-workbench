export const PERFORMANCE_RETURN_LABELS = {
  timeWeightedReturn: "Time-weighted return (TWR)",
  portfolioTwr: "Portfolio TWR",
  benchmarkTwr: "Benchmark TWR",
  activeReturn: "Active return",
  moneyWeightedReturn: "Money-weighted return (MWR)",
} as const;

export const PERFORMANCE_RETURN_TABLE_LABELS = {
  segmentTwr: "TWR",
  netTwr: "Net TWR",
  grossTwr: "Gross TWR",
  cumulativePortfolioTwr: "Cumulative portfolio TWR",
  cumulativeBenchmarkTwr: "Cumulative benchmark TWR",
  cumulativeActiveReturn: "Cumulative active return",
  cumulativeNetTwr: "Cumulative net TWR",
  cumulativeGrossTwr: "Cumulative gross TWR",
  annualisedNetTwr: "Annualised net TWR",
  annualisedGrossTwr: "Annualised gross TWR",
} as const;

export const PERFORMANCE_ECONOMICS_LABELS = {
  openingMarketValue: "Opening market value",
  endingMarketValue: "Ending market value",
  flowAdjustedMarketValue: "Flow-adjusted market value",
  openingCashFlow: "Opening cash flow",
  closingCashFlow: "Closing cash flow",
  netCashFlow: "Net cash flow",
} as const;

export const PERFORMANCE_RETURN_DEFINITIONS = {
  timeWeightedReturn:
    "Time-weighted return (TWR) measures portfolio performance while removing the effect of the timing and size of external cash flows.",
  activeReturn:
    "Portfolio time-weighted return less benchmark time-weighted return for the selected period.",
  moneyWeightedReturn:
    "Money-weighted return (MWR) reflects the timing and size of external cash flows during the selected period.",
} as const;

export const PERFORMANCE_FEE_BASIS_LABELS = {
  net: "Net of fees",
  gross: "Gross of fees",
  unavailable: "Fee basis not confirmed",
} as const;

export const PERFORMANCE_WORKFLOW_LABELS = {
  overview: "Performance overview",
  analysis: "Performance analysis",
  adviserBrief: "Adviser brief",
  riskReview: "Risk review",
} as const;

export const PERFORMANCE_REFRESH_COPY = {
  recheckAction: "Recheck performance",
  recheckingAction: "Rechecking…",
  recheck: {
    pending: {
      eyebrow: "Checking source evidence",
      title: "Rechecking performance evidence",
      message:
        "The previously confirmed performance view remains available while its complete evidence set is rechecked.",
    },
    confirmed: {
      eyebrow: "Source evidence checked",
      title: "Performance evidence rechecked",
    },
    failed: {
      eyebrow: "Recheck incomplete",
      title: "Performance evidence could not be rechecked",
      message:
        "The complete performance view was not rechecked. The previously confirmed view remains in place.",
    },
  },
} as const;

export const PERFORMANCE_CONTEXT_LABELS = {
  reviewWindow: "Review window",
  feeBasis: "Fee basis",
  asOfDate: "As-of date",
} as const;

export const PERFORMANCE_EVIDENCE_LABELS = {
  needsAttention: "Needs attention",
} as const;

export { PERFORMANCE_EVIDENCE_COPY } from "@/copy/performance-evidence-copy";

export function getPerformanceFeeBasisLabel(basis: string | null | undefined): string {
  if (basis?.trim().toUpperCase() === "NET") {
    return PERFORMANCE_FEE_BASIS_LABELS.net;
  }
  if (basis?.trim().toUpperCase() === "GROSS") {
    return PERFORMANCE_FEE_BASIS_LABELS.gross;
  }
  return PERFORMANCE_FEE_BASIS_LABELS.unavailable;
}

export function getPerformanceReturnPathTitle(basis: string | null | undefined): string {
  return `Time-weighted return path · ${getPerformanceFeeBasisLabel(basis)}`;
}

const PERFORMANCE_METRIC_LABEL_ALIASES: Readonly<Record<string, string>> = {
  "portfolio return": PERFORMANCE_RETURN_LABELS.portfolioTwr,
  "portfolio twr": PERFORMANCE_RETURN_LABELS.portfolioTwr,
  "time-weighted return": PERFORMANCE_RETURN_LABELS.portfolioTwr,
  "time-weighted return (twr)": PERFORMANCE_RETURN_LABELS.portfolioTwr,
  "benchmark return": PERFORMANCE_RETURN_LABELS.benchmarkTwr,
  "benchmark twr": PERFORMANCE_RETURN_LABELS.benchmarkTwr,
  "active return": PERFORMANCE_RETURN_LABELS.activeReturn,
  "money-weighted return": PERFORMANCE_RETURN_LABELS.moneyWeightedReturn,
  "money-weighted return (mwr)": PERFORMANCE_RETURN_LABELS.moneyWeightedReturn,
  mwr: PERFORMANCE_RETURN_LABELS.moneyWeightedReturn,
  "opening mv": PERFORMANCE_ECONOMICS_LABELS.openingMarketValue,
  "opening market value": PERFORMANCE_ECONOMICS_LABELS.openingMarketValue,
  "ending mv": PERFORMANCE_ECONOMICS_LABELS.endingMarketValue,
  "ending market value": PERFORMANCE_ECONOMICS_LABELS.endingMarketValue,
  "flow-adjusted mv": PERFORMANCE_ECONOMICS_LABELS.flowAdjustedMarketValue,
  "flow-adjusted market value": PERFORMANCE_ECONOMICS_LABELS.flowAdjustedMarketValue,
  "net flow": PERFORMANCE_ECONOMICS_LABELS.netCashFlow,
  "net cash flow": PERFORMANCE_ECONOMICS_LABELS.netCashFlow,
};

export function normalizePerformanceMetricLabel(label: string): string {
  const trimmed = label.trim();
  const normalizedKey = trimmed.toLowerCase().replace(/\s+/g, " ");
  return PERFORMANCE_METRIC_LABEL_ALIASES[normalizedKey] ?? trimmed;
}

export const PERFORMANCE_ACTION_LABELS = {
  openReturnPath: "Open return path",
  reviewContribution: "Review contribution",
  inspectAttribution: "Inspect attribution",
  openAnalysis: "Open analysis",
  draftAdviserBrief: "Draft adviser brief",
  openAdviserBrief: "Open adviser brief",
  reviewRisk: "Review risk",
  returnToOverview: "Return to performance overview",
} as const;

const PERFORMANCE_ACTION_LABEL_ALIASES: Readonly<Record<string, string>> = {
  "open return path": PERFORMANCE_ACTION_LABELS.openReturnPath,
  "review contribution": PERFORMANCE_ACTION_LABELS.reviewContribution,
  "inspect attribution": PERFORMANCE_ACTION_LABELS.inspectAttribution,
  "open analysis": PERFORMANCE_ACTION_LABELS.openAnalysis,
  "draft advisor brief": PERFORMANCE_ACTION_LABELS.draftAdviserBrief,
  "draft adviser brief": PERFORMANCE_ACTION_LABELS.draftAdviserBrief,
  "open advisor brief": PERFORMANCE_ACTION_LABELS.openAdviserBrief,
  "open adviser brief": PERFORMANCE_ACTION_LABELS.openAdviserBrief,
  "review risk surface": PERFORMANCE_ACTION_LABELS.reviewRisk,
  "review risk": PERFORMANCE_ACTION_LABELS.reviewRisk,
  "return to summary": PERFORMANCE_ACTION_LABELS.returnToOverview,
  "return to performance overview": PERFORMANCE_ACTION_LABELS.returnToOverview,
};

export function normalizePerformanceActionLabel(label: string): string {
  const trimmed = label.trim();
  const normalizedKey = trimmed.toLowerCase().replace(/\s+/g, " ");
  return PERFORMANCE_ACTION_LABEL_ALIASES[normalizedKey] ?? trimmed;
}
