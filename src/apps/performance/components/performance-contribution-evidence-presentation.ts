import type { ContributionSummaryView } from "@/features/workbench/types";

import { formatPct } from "../formatters";
import { PERFORMANCE_RETURN_LABELS } from "../performance-terminology";
import {
  getContributionEvidenceInconsistency,
  type ContributionEvidenceInconsistency,
} from "./performance-contribution-evidence-consistency";
import {
  DEGRADED_ECONOMICS_VOCABULARY,
  UNSUPPORTED_ECONOMICS_VOCABULARY,
} from "./performance-contribution-evidence-vocabulary";
import {
  getContributionCoverageAssessment,
  getContributionReconciliationAssessment,
} from "./performance-workspace-view-helpers";

export type ContributionEvidenceTone = "confirmed" | "limited" | "review";

export type ContributionEvidenceItem = {
  label: string;
  value: string;
};

export type ContributionEvidencePresentation = {
  tone: ContributionEvidenceTone;
  title: string;
  body: string;
  context: string;
  limitations: string[];
  evidenceItems: ContributionEvidenceItem[];
};

type ContributionCoveragePosture = "adequate" | "limited" | "unconfirmed";

const SOURCE_STATUSES = ["SOURCE_BACKED", "SOURCE_LIMITED", "CALLER_SUPPLIED"] as const;
const COMPONENT_DETAIL_STATUSES = ["COMPLETE", "LIMITED"] as const;
const SMOOTHING_STATUSES = [
  "APPLIED",
  "NOT_REQUESTED",
  "INVALID_DOMAIN_FALLBACK",
  "NO_CONTRIBUTION_ROWS",
] as const;
const SOURCE_REASON_CODES = [
  "STATELESS_CALLER_SUPPLIED_SOURCE_ECONOMICS",
  "LOTUS_CORE_ANALYTICS_INPUTS_USED",
  "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
  "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE_VIA_EXECUTION_ONLY",
  "PERFORMANCE_COMPONENT_ECONOMICS_SOURCE_USED",
  "COMPONENT_PNL_NOT_SOURCE_AUTHORED",
  "PERFORMANCE_COMPONENT_ECONOMICS_UNAVAILABLE",
  "UNSUPPORTED_SOURCE_CASH_FLOW_TYPES_PRESENT",
  "UNCLASSIFIED_POSITION_ECONOMICS_PRESENT",
  "MISSING_FX",
  "MISSING_LOCAL_ECONOMICS",
] as const;
const SMOOTHING_REASON_CODES = [
  "CARINO_FACTOR_APPLIED",
  "SMOOTHING_NOT_REQUESTED",
  "CARINO_INVALID_DAILY_LOG_DOMAIN",
  "RAW_CONTRIBUTION_DIFFERS_FROM_LINKED_RETURN",
  "SMOOTHED_CONTRIBUTION_RECONCILES",
  "RESIDUAL_ALLOCATED_TO_RECONCILE_PERIOD",
  "NO_CONTRIBUTION_ROWS",
] as const;

export function getContributionEvidencePresentation(
  contribution: ContributionSummaryView,
): ContributionEvidencePresentation {
  const sourceEvidence = contribution.source_economics_evidence;
  const smoothingEvidence = contribution.smoothing_evidence;
  const sourceStatus = getPublishedEvidenceValue(sourceEvidence?.status);
  const componentDetailStatus = getPublishedEvidenceValue(
    sourceEvidence?.component_detail_status,
  );
  const smoothingStatus = getPublishedEvidenceValue(smoothingEvidence?.status);
  const hasIncompleteEvidence = sourceStatus === null || smoothingStatus === null;
  const unknownSourceCodes = getUnknownValues(sourceEvidence?.reason_codes, SOURCE_REASON_CODES);
  const unknownSmoothingCodes = getUnknownValues(
    smoothingEvidence?.reason_codes,
    SMOOTHING_REASON_CODES,
  );
  const hasUnknownStatus =
    (sourceStatus !== null && !includesEvidenceValue(SOURCE_STATUSES, sourceStatus)) ||
    (componentDetailStatus !== null &&
      !includesEvidenceValue(COMPONENT_DETAIL_STATUSES, componentDetailStatus)) ||
    (smoothingStatus !== null && !includesEvidenceValue(SMOOTHING_STATUSES, smoothingStatus));
  const hasUnknownEvidence =
    hasUnknownStatus || unknownSourceCodes.length > 0 || unknownSmoothingCodes.length > 0;
  const evidenceInconsistency =
    !hasIncompleteEvidence &&
    sourceStatus !== null &&
    smoothingStatus !== null
      ? getContributionEvidenceInconsistency(contribution, {
          sourceStatus,
          smoothingStatus,
        })
      : null;
  const limitations = getContributionLimitations(contribution, {
    hasUnknownEvidence,
    evidenceInconsistency,
    smoothingStatus,
  });
  const decision = getContributionEvidenceDecision({
    hasSourceEvidence: sourceEvidence !== null && sourceEvidence !== undefined,
    hasIncompleteEvidence,
    sourceStatus,
    smoothingStatus,
    hasUnknownEvidence,
    evidenceInconsistency,
    coveragePosture: getContributionCoveragePosture(contribution.coverage_mv_pct),
    hasBlockingSourceLimitations: Boolean(sourceEvidence?.degraded_economics.length),
    componentDetailStatus,
  });

  return {
    ...decision,
    context: buildContributionContext(contribution, evidenceInconsistency),
    limitations,
    evidenceItems: buildContributionEvidenceItems(contribution),
  };
}

function getContributionEvidenceDecision({
  hasSourceEvidence,
  hasIncompleteEvidence,
  sourceStatus,
  smoothingStatus,
  hasUnknownEvidence,
  evidenceInconsistency,
  coveragePosture,
  hasBlockingSourceLimitations,
  componentDetailStatus,
}: {
  hasSourceEvidence: boolean;
  hasIncompleteEvidence: boolean;
  sourceStatus: string | null;
  smoothingStatus: string | null;
  hasUnknownEvidence: boolean;
  evidenceInconsistency: ContributionEvidenceInconsistency | null;
  coveragePosture: ContributionCoveragePosture;
  hasBlockingSourceLimitations: boolean;
  componentDetailStatus: string | null;
}): Pick<ContributionEvidencePresentation, "tone" | "title" | "body"> {
  if (!hasSourceEvidence) {
    return {
      tone: "review",
      title: "Contribution coverage cannot be confirmed",
      body: "Lotus did not receive governed portfolio evidence for this calculation. Review the calculation evidence before using the drivers in a client discussion.",
    };
  }
  if (hasIncompleteEvidence) {
    return {
      tone: "review",
      title: "Contribution calculation evidence is incomplete",
      body: "Lotus did not receive complete source and methodology statuses for this calculation. Review the published calculation evidence before using the driver explanation with a client.",
    };
  }
  if (hasUnknownEvidence) {
    return {
      tone: "review",
      title: "Contribution evidence needs review",
      body: "Lotus received a source or methodology status it does not yet recognize. Do not assume the figures are complete; review the exact calculation evidence before use.",
    };
  }
  if (evidenceInconsistency === "numeric_reconciliation") {
    return {
      tone: "review",
      title: "Contribution reconciliation needs review",
      body: "The published contribution, linked-return, or smoothing-residual amounts do not reconcile. Do not use the driver explanation with a client until the calculation evidence has been reviewed.",
    };
  }
  if (evidenceInconsistency === "status_or_reason") {
    return {
      tone: "review",
      title: "Contribution evidence is inconsistent",
      body: "The published calculation status does not agree with its supporting evidence. Do not use the driver explanation with a client until the source evidence has been reviewed.",
    };
  }
  if (
    (sourceStatus === "SOURCE_BACKED" || sourceStatus === "SOURCE_LIMITED") &&
    coveragePosture === "unconfirmed"
  ) {
    return {
      tone: "review",
      title: "Contribution coverage cannot be confirmed",
      body: "A reliable market-value coverage percentage was not published for this calculation. Review the calculation evidence before using the driver explanation with a client.",
    };
  }
  if (sourceStatus === "CALLER_SUPPLIED") {
    return {
      tone: "review",
      title: "Contribution inputs need confirmation",
      body: "These figures use request-supplied inputs rather than the governed portfolio record. Confirm the inputs before client use.",
    };
  }
  if (smoothingStatus === "INVALID_DOMAIN_FALLBACK") {
    return {
      tone: "limited",
      title: "Contribution evidence has a methodology limitation",
      body: "The standard multi-period smoothing method could not be applied for every day in the selected period. Review the methodology evidence before using the driver explanation with a client.",
    };
  }
  if (smoothingStatus === "NO_CONTRIBUTION_ROWS") {
    return {
      tone: "limited",
      title: "Contribution observations are unavailable",
      body: "No contribution rows were published for the selected period. The screen preserves the source posture but cannot support a driver explanation.",
    };
  }
  if (sourceStatus === "SOURCE_LIMITED") {
    return {
      tone: "limited",
      title: "Contribution coverage is limited",
      body: "The driver ranking uses the available governed portfolio data, but the calculation has published limitations. Review the stated exclusions before using the explanation with a client.",
    };
  }
  if (sourceStatus === "SOURCE_BACKED" && coveragePosture === "limited") {
    return {
      tone: "limited",
      title: "Contribution market-value coverage is limited",
      body: "The source economics are confirmed, but the calculation covers less than 95% of portfolio market value. Treat the driver ranking as partial until broader coverage is available.",
    };
  }
  if (
    sourceStatus === "SOURCE_BACKED" &&
    componentDetailStatus === "LIMITED" &&
    !hasBlockingSourceLimitations
  ) {
    return {
      tone: "confirmed",
      title: "Contribution calculation is supported",
      body: "The driver ranking uses the portfolio valuations, cash flows and classifications received for this period. Some profit-and-loss breakdowns are unavailable and listed in calculation evidence.",
    };
  }
  if (sourceStatus === "SOURCE_BACKED" && !hasBlockingSourceLimitations) {
    return {
      tone: "confirmed",
      title: "Contribution coverage is confirmed",
      body: "The published driver view is supported by governed portfolio data for the selected period. Use the displayed coverage and reconciliation when preparing the client explanation.",
    };
  }
  return {
    tone: "review",
    title: "Contribution coverage needs review",
    body: "The published source posture and its stated limitations do not fully align. Review the exact calculation evidence before use.",
  };
}

function getContributionCoveragePosture(
  coverageMvPct: number | null | undefined,
): ContributionCoveragePosture {
  if (
    typeof coverageMvPct !== "number" ||
    !Number.isFinite(coverageMvPct) ||
    coverageMvPct < 0 ||
    coverageMvPct > 100
  ) {
    return "unconfirmed";
  }
  return coverageMvPct >= 95 ? "adequate" : "limited";
}

function getContributionLimitations(
  contribution: ContributionSummaryView,
  {
    hasUnknownEvidence,
    evidenceInconsistency,
    smoothingStatus,
  }: {
    hasUnknownEvidence: boolean;
    evidenceInconsistency: ContributionEvidenceInconsistency | null;
    smoothingStatus: string | null;
  },
): string[] {
  const sourceEvidence = contribution.source_economics_evidence;
  const limitations: string[] = [];
  const unsupportedEconomics = sourceEvidence?.unsupported_economics ?? [];
  const mappedUnsupported = unsupportedEconomics
    .map((item) => UNSUPPORTED_ECONOMICS_VOCABULARY[item]?.label)
    .filter((item): item is string => Boolean(item));

  if (mappedUnsupported.length > 0) {
    limitations.push(`Not source-authored: ${formatBusinessList(mappedUnsupported)}.`);
  }
  if (mappedUnsupported.length < unsupportedEconomics.length) {
    limitations.push("Additional component economics are not source-authored.");
  }

  for (const degradedItem of sourceEvidence?.degraded_economics ?? []) {
    const message = DEGRADED_ECONOMICS_VOCABULARY[degradedItem]?.label;
    if (message && !limitations.includes(message)) {
      limitations.push(message);
    }
  }
  if (
    (sourceEvidence?.degraded_economics.length ?? 0) >
    limitations.filter((item) =>
      Object.values(DEGRADED_ECONOMICS_VOCABULARY).some(({ label }) => label === item),
    ).length
  ) {
    limitations.push("Additional source economics are degraded.");
  }
  if (sourceEvidence?.reason_codes.includes("MISSING_FX")) {
    limitations.push("Currency source economics are incomplete.");
  }
  if (sourceEvidence?.reason_codes.includes("MISSING_LOCAL_ECONOMICS")) {
    limitations.push("Local-currency source economics are incomplete.");
  }
  if (smoothingStatus === "INVALID_DOMAIN_FALLBACK") {
    limitations.push("Multi-period smoothing used a source-confirmed fallback.");
  }
  if (hasUnknownEvidence) {
    limitations.push("Some published evidence is not recognized by this Workbench version.");
  }
  if (evidenceInconsistency === "status_or_reason") {
    limitations.push("Published statuses and supporting reason codes do not agree.");
  }
  if (evidenceInconsistency === "numeric_reconciliation") {
    limitations.push("Published contribution and return evidence does not reconcile.");
  }

  return [...new Set(limitations)];
}

function buildContributionContext(
  contribution: ContributionSummaryView,
  evidenceInconsistency: ContributionEvidenceInconsistency | null,
): string {
  const context = [
    formatContributionCoverageContext(contribution),
    formatContributionWeightingScheme(contribution.weighting_scheme),
    evidenceInconsistency === "numeric_reconciliation"
      ? "Calculation values do not reconcile"
      : getContributionReconciliationAssessment(contribution) ?? "Reconciliation not published",
  ].filter((item): item is string => Boolean(item));

  return context.join(" • ");
}

function formatContributionCoverageContext(contribution: ContributionSummaryView): string {
  const coverageMvPct = contribution.coverage_mv_pct;
  if (coverageMvPct === null || coverageMvPct === undefined) {
    return getContributionCoverageAssessment(contribution) ?? "Market-value coverage not published";
  }
  if (getContributionCoveragePosture(coverageMvPct) === "unconfirmed") {
    return "Market-value coverage needs review";
  }
  return `${formatContributionCoveragePct(coverageMvPct)} of market value covered`;
}

function buildContributionEvidenceItems(
  contribution: ContributionSummaryView,
): ContributionEvidenceItem[] {
  const sourceEvidence = contribution.source_economics_evidence;
  const smoothingEvidence = contribution.smoothing_evidence;

  return [
    { label: "Source status", value: formatEvidenceScalar(sourceEvidence?.status) },
    {
      label: "Component detail",
      value: formatEvidenceScalar(sourceEvidence?.component_detail_status),
    },
    { label: "Source reason codes", value: formatEvidenceList(sourceEvidence?.reason_codes) },
    { label: "Source contracts", value: formatEvidenceList(sourceEvidence?.source_contracts) },
    { label: "Available economics", value: formatEvidenceList(sourceEvidence?.available_economics) },
    { label: "Unsupported economics", value: formatEvidenceList(sourceEvidence?.unsupported_economics) },
    { label: "Degraded economics", value: formatEvidenceList(sourceEvidence?.degraded_economics) },
    {
      label: "Source snapshots",
      value:
        sourceEvidence?.source_snapshot_count === null ||
        sourceEvidence?.source_snapshot_count === undefined
          ? "Not published"
          : String(sourceEvidence.source_snapshot_count),
    },
    {
      label: "Weighting basis",
      value: formatEvidenceScalar(contribution.weighting_scheme),
    },
    {
      label: "Market-value coverage",
      value: formatExactEvidencePct(contribution.coverage_mv_pct),
    },
    {
      label: "Portfolio contribution",
      value: formatExactEvidencePct(contribution.portfolio_contribution_pct),
    },
    {
      label: PERFORMANCE_RETURN_LABELS.portfolioTwr,
      value: formatExactEvidencePct(contribution.total_portfolio_return_pct),
    },
    { label: "Smoothing status", value: formatEvidenceScalar(smoothingEvidence?.status) },
    { label: "Smoothing reason codes", value: formatEvidenceList(smoothingEvidence?.reason_codes) },
    {
      label: "Raw contribution",
      value: formatExactEvidencePct(smoothingEvidence?.raw_contribution_pct),
    },
    {
      label: "Final contribution",
      value: formatExactEvidencePct(smoothingEvidence?.final_contribution_pct),
    },
    {
      label: "Linked return",
      value: formatExactEvidencePct(smoothingEvidence?.linked_return_pct),
    },
    {
      label: "Smoothing residual",
      value: formatExactEvidencePct(smoothingEvidence?.smoothing_residual_pct),
    },
    {
      label: "Reconciliation",
      value:
        getContributionReconciliationAssessment(contribution) ??
        "Contribution-to-return reconciliation not published",
    },
  ];
}

function formatContributionWeightingScheme(weightingScheme?: string | null): string | null {
  switch (weightingScheme?.trim().toUpperCase()) {
    case "BOD":
      return "Beginning-of-day weight basis";
    case "EOD":
      return "End-of-day weight basis";
    case "AVERAGE_WEIGHT":
      return "Average-weight basis";
    default:
      return weightingScheme?.trim() ? "Weighting basis published in calculation evidence" : null;
  }
}

function getUnknownValues(
  values: string[] | undefined,
  knownValues: readonly string[],
): string[] {
  return (values ?? []).filter((value) => !includesEvidenceValue(knownValues, value));
}

function includesEvidenceValue(knownValues: readonly string[], value: string): boolean {
  return knownValues.includes(value);
}

function getPublishedEvidenceValue(value?: string | null): string | null {
  return value === null || value === undefined || value.length === 0 ? null : value;
}

function formatEvidenceList(values: string[] | undefined): string {
  const publishedValues = values ?? [];
  return publishedValues.length > 0
    ? publishedValues.map(formatEvidenceListValue).join(", ")
    : "None published";
}

function formatEvidenceScalar(value: string | null | undefined): string {
  return value === null || value === undefined ? "Not published" : formatEvidenceListValue(value);
}

function formatEvidenceListValue(value: string): string {
  if (value.length === 0) {
    return "[empty value]";
  }
  if (value.trim().length === 0) {
    return `[blank value: ${value.length} whitespace characters]`;
  }
  return value === value.trim() ? value : `[padded value] ${value.trim()}`;
}

function formatExactEvidencePct(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${String(value)}%` : "Not published";
}

function formatContributionCoveragePct(value: number): string {
  const roundedCoverage = Number(value.toFixed(2));
  return value < 95 && roundedCoverage >= 95 ? "<95.00%" : formatPct(value);
}

function formatBusinessList(values: string[]): string {
  if (values.length < 2) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
