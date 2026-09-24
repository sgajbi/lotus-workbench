import type { ContributionSummaryView } from "@/features/workbench/types";

import {
  DEGRADED_ECONOMICS_VOCABULARY,
  UNSUPPORTED_ECONOMICS_VOCABULARY,
} from "./performance-contribution-evidence-vocabulary";

const SOURCE_LIMITATION_REASON_CODES = [
  "COMPONENT_PNL_NOT_SOURCE_AUTHORED",
  "PERFORMANCE_COMPONENT_ECONOMICS_UNAVAILABLE",
  "UNSUPPORTED_SOURCE_CASH_FLOW_TYPES_PRESENT",
  "UNCLASSIFIED_POSITION_ECONOMICS_PRESENT",
  "MISSING_FX",
  "MISSING_LOCAL_ECONOMICS",
  "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE_VIA_EXECUTION_ONLY",
] as const;
const COMPONENT_DETAIL_LIMITATION_REASON_CODE =
  "COMPONENT_PNL_NOT_SOURCE_AUTHORED";
const COMPONENT_AVAILABILITY_LIMITATION_REASON_CODE =
  "PERFORMANCE_COMPONENT_ECONOMICS_UNAVAILABLE";

const COMMON_SMOOTHING_RESIDUAL_CODES = [
  "RAW_CONTRIBUTION_DIFFERS_FROM_LINKED_RETURN",
  "RESIDUAL_ALLOCATED_TO_RECONCILE_PERIOD",
] as const;

const CONTRIBUTION_RECONCILIATION_TOLERANCE_PCT = 0.005;

export type ContributionEvidenceInconsistency =
  "numeric_reconciliation" | "status_or_reason";

export function getContributionEvidenceInconsistency(
  contribution: ContributionSummaryView,
  {
    sourceStatus,
    smoothingStatus,
  }: {
    sourceStatus: string;
    smoothingStatus: string;
  },
): ContributionEvidenceInconsistency | null {
  if (
    !isSourceEvidenceConsistent(contribution, sourceStatus) ||
    !isSmoothingEvidenceConsistent(
      contribution,
      smoothingStatus,
      contribution.smoothing_evidence?.reason_codes,
    )
  ) {
    return "status_or_reason";
  }
  return isPublishedContributionReconciled(contribution, smoothingStatus)
    ? null
    : "numeric_reconciliation";
}

function isSourceEvidenceConsistent(
  contribution: ContributionSummaryView,
  sourceStatus: string,
): boolean {
  const sourceEvidence = contribution.source_economics_evidence;
  const reasonCodes = sourceEvidence?.reason_codes ?? [];
  const unsupportedEconomics = sourceEvidence?.unsupported_economics ?? [];
  const degradedEconomics = sourceEvidence?.degraded_economics ?? [];
  const hasDeclaredLimitations = Boolean(
    unsupportedEconomics.length || degradedEconomics.length,
  );
  const hasBlockingLimitationReason = SOURCE_LIMITATION_REASON_CODES.some(
    (reasonCode) =>
      reasonCode !== COMPONENT_DETAIL_LIMITATION_REASON_CODE &&
      reasonCodes.includes(reasonCode),
  );
  const hasCallerSuppliedReason = reasonCodes.includes(
    "STATELESS_CALLER_SUPPLIED_SOURCE_ECONOMICS",
  );
  const hasContradictoryEconomics = hasOverlappingValues(
    sourceEvidence?.available_economics ?? [],
    sourceEvidence?.unsupported_economics ?? [],
  );
  const hasPublishedSourceContracts = hasNonBlankValues(
    sourceEvidence?.source_contracts ?? [],
  );
  const hasPublishedAvailableEconomics = hasNonBlankValues(
    sourceEvidence?.available_economics ?? [],
  );
  const hasPublishedValuesForAvailableContributionEconomics =
    hasValuesForAvailableContributionEconomics(
      contribution,
      sourceEvidence?.available_economics ?? [],
    );
  const hasConsistentSnapshotLineage = isSnapshotLineageConsistent(
    reasonCodes,
    sourceEvidence?.source_snapshot_count,
  );
  const hasSupportedDeclaredLimitations =
    hasReasonEvidenceForDeclaredLimitations(
      unsupportedEconomics,
      degradedEconomics,
      reasonCodes,
    );
  const hasConsistentComponentDetail = isComponentDetailStatusConsistent(
    sourceEvidence?.component_detail_status,
    unsupportedEconomics,
    degradedEconomics,
    reasonCodes,
  );

  switch (sourceStatus) {
    case "SOURCE_BACKED":
      return (
        degradedEconomics.length === 0 &&
        !hasBlockingLimitationReason &&
        hasSupportedDeclaredLimitations &&
        hasConsistentComponentDetail &&
        !hasCallerSuppliedReason &&
        !hasContradictoryEconomics &&
        hasPublishedSourceContracts &&
        hasPublishedAvailableEconomics &&
        hasPublishedValuesForAvailableContributionEconomics &&
        hasConsistentSnapshotLineage &&
        reasonCodes.includes("LOTUS_CORE_ANALYTICS_INPUTS_USED") &&
        reasonCodes.includes("UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE")
      );
    case "SOURCE_LIMITED":
      return (
        hasDeclaredLimitations &&
        hasSupportedDeclaredLimitations &&
        hasConsistentComponentDetail &&
        !hasCallerSuppliedReason &&
        !hasContradictoryEconomics &&
        hasPublishedSourceContracts &&
        hasPublishedAvailableEconomics &&
        hasPublishedValuesForAvailableContributionEconomics &&
        hasConsistentSnapshotLineage &&
        reasonCodes.includes("LOTUS_CORE_ANALYTICS_INPUTS_USED")
      );
    case "CALLER_SUPPLIED":
      return hasCallerSuppliedReason;
    default:
      return false;
  }
}

function isComponentDetailStatusConsistent(
  componentDetailStatus: string | null | undefined,
  unsupportedEconomics: string[],
  degradedEconomics: string[],
  reasonCodes: string[],
): boolean {
  const hasUnsupportedComponentDetails = unsupportedEconomics.some(
    (economics) =>
      UNSUPPORTED_ECONOMICS_VOCABULARY[economics]?.reasonCode ===
      COMPONENT_DETAIL_LIMITATION_REASON_CODE,
  );
  const hasDegradedComponentDetails = degradedEconomics.some(
    (economics) =>
      DEGRADED_ECONOMICS_VOCABULARY[economics]?.reasonCode ===
      COMPONENT_AVAILABILITY_LIMITATION_REASON_CODE,
  );
  const hasComponentLimitation =
    hasUnsupportedComponentDetails || hasDegradedComponentDetails;
  const hasComponentLimitationReason = reasonCodes.some((reasonCode) =>
    [
      COMPONENT_DETAIL_LIMITATION_REASON_CODE,
      COMPONENT_AVAILABILITY_LIMITATION_REASON_CODE,
    ].includes(reasonCode),
  );
  switch (componentDetailStatus) {
    case "COMPLETE":
      return !hasComponentLimitation && !hasComponentLimitationReason;
    case "LIMITED":
      return hasComponentLimitation && hasComponentLimitationReason;
    case null:
    case undefined:
      return !hasComponentLimitation && !hasComponentLimitationReason;
    default:
      return false;
  }
}

function hasOverlappingValues(left: string[], right: string[]): boolean {
  const rightValues = new Set(right);
  return left.some((value) => rightValues.has(value));
}

function hasNonBlankValues(values: string[]): boolean {
  return values.length > 0 && values.every((value) => value.trim().length > 0);
}

function hasValuesForAvailableContributionEconomics(
  contribution: ContributionSummaryView,
  availableEconomics: string[],
): boolean {
  return availableEconomics.every((economics) => {
    switch (economics) {
      case "local_contribution":
        return hasPublishedContributionDimension(
          contribution,
          "portfolio_local_contribution_pct",
          "local_contribution_pct",
        );
      case "fx_contribution":
        return hasPublishedContributionDimension(
          contribution,
          "portfolio_fx_contribution_pct",
          "fx_contribution_pct",
        );
      default:
        return true;
    }
  });
}

function hasPublishedContributionDimension(
  contribution: ContributionSummaryView,
  portfolioField:
    "portfolio_local_contribution_pct" | "portfolio_fx_contribution_pct",
  rowField: "local_contribution_pct" | "fx_contribution_pct",
): boolean {
  return (
    isFiniteNumber(contribution[portfolioField]) ||
    contribution.position_rows.some((row) => isFiniteNumber(row[rowField])) ||
    contribution.levels.some((level) =>
      level.rows.some((row) => isFiniteNumber(row[rowField])),
    )
  );
}

function isSnapshotLineageConsistent(
  reasonCodes: string[],
  sourceSnapshotCount: number | null | undefined,
): boolean {
  if (
    typeof sourceSnapshotCount !== "number" ||
    !Number.isInteger(sourceSnapshotCount) ||
    sourceSnapshotCount < 0
  ) {
    return false;
  }

  const hasEmbeddedLineage = reasonCodes.includes(
    "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE",
  );
  const hasExecutionOnlyLineage = reasonCodes.includes(
    "UPSTREAM_SNAPSHOT_LINEAGE_AVAILABLE_VIA_EXECUTION_ONLY",
  );
  if (hasEmbeddedLineage && hasExecutionOnlyLineage) {
    return false;
  }
  if (hasEmbeddedLineage) {
    return sourceSnapshotCount > 0;
  }
  if (hasExecutionOnlyLineage) {
    return sourceSnapshotCount === 0;
  }
  return sourceSnapshotCount > 0;
}

function hasReasonEvidenceForDeclaredLimitations(
  unsupportedEconomics: string[],
  degradedEconomics: string[],
  reasonCodes: string[],
): boolean {
  const expectedLimitationReasons = [
    ...unsupportedEconomics.map(
      (item) => UNSUPPORTED_ECONOMICS_VOCABULARY[item]?.reasonCode,
    ),
    ...degradedEconomics.map(
      (item) => DEGRADED_ECONOMICS_VOCABULARY[item]?.reasonCode,
    ),
  ];
  if (
    expectedLimitationReasons.some((reasonCode) => reasonCode === undefined) ||
    expectedLimitationReasons.some(
      (reasonCode) => !reasonCodes.includes(reasonCode),
    )
  ) {
    return false;
  }

  const expectedReasonSet = new Set(
    expectedLimitationReasons.filter(
      (reasonCode): reasonCode is string => reasonCode !== undefined,
    ),
  );
  return SOURCE_LIMITATION_REASON_CODES.every(
    (reasonCode) =>
      !reasonCodes.includes(reasonCode) || expectedReasonSet.has(reasonCode),
  );
}

function isSmoothingEvidenceConsistent(
  contribution: ContributionSummaryView,
  smoothingStatus: string,
  reasonCodes: string[] | undefined,
): boolean {
  const publishedReasonCodes = reasonCodes ?? [];

  switch (smoothingStatus) {
    case "APPLIED":
      return (
        hasOnlyExpectedReasons(
          publishedReasonCodes,
          [
            "CARINO_FACTOR_APPLIED",
            "SMOOTHED_CONTRIBUTION_RECONCILES",
            ...COMMON_SMOOTHING_RESIDUAL_CODES,
          ],
          "CARINO_FACTOR_APPLIED",
        ) && hasConsistentResidualReasons(contribution, publishedReasonCodes)
      );
    case "NOT_REQUESTED":
      return hasOnlyExpectedReasons(
        publishedReasonCodes,
        ["SMOOTHING_NOT_REQUESTED"],
        "SMOOTHING_NOT_REQUESTED",
      );
    case "INVALID_DOMAIN_FALLBACK":
      return (
        hasOnlyExpectedReasons(
          publishedReasonCodes,
          [
            "CARINO_INVALID_DAILY_LOG_DOMAIN",
            ...COMMON_SMOOTHING_RESIDUAL_CODES,
          ],
          "CARINO_INVALID_DAILY_LOG_DOMAIN",
        ) && hasConsistentResidualReasons(contribution, publishedReasonCodes)
      );
    case "NO_CONTRIBUTION_ROWS":
      return (
        hasOnlyExpectedReasons(
          publishedReasonCodes,
          ["NO_CONTRIBUTION_ROWS"],
          "NO_CONTRIBUTION_ROWS",
        ) &&
        contribution.position_rows.length === 0 &&
        contribution.levels.every((level) => level.rows.length === 0)
      );
    default:
      return false;
  }
}

function hasConsistentResidualReasons(
  contribution: ContributionSummaryView,
  reasonCodes: string[],
): boolean {
  const hasResidualReason = COMMON_SMOOTHING_RESIDUAL_CODES.some((reasonCode) =>
    reasonCodes.includes(reasonCode),
  );
  if (!hasResidualReason) {
    return true;
  }

  const rawContribution = contribution.smoothing_evidence?.raw_contribution_pct;
  const linkedReturn = contribution.smoothing_evidence?.linked_return_pct;
  return (
    isFiniteNumber(rawContribution) &&
    isFiniteNumber(linkedReturn) &&
    !isWithinReconciliationTolerance(rawContribution, linkedReturn)
  );
}

function hasOnlyExpectedReasons(
  publishedReasonCodes: string[],
  expectedReasonCodes: readonly string[],
  requiredReasonCode: string,
): boolean {
  return (
    publishedReasonCodes.includes(requiredReasonCode) &&
    publishedReasonCodes.every((reasonCode) =>
      expectedReasonCodes.includes(reasonCode),
    )
  );
}

function isPublishedContributionReconciled(
  contribution: ContributionSummaryView,
  smoothingStatus: string,
): boolean {
  if (
    smoothingStatus !== "APPLIED" &&
    smoothingStatus !== "NOT_REQUESTED" &&
    smoothingStatus !== "INVALID_DOMAIN_FALLBACK"
  ) {
    return true;
  }

  const smoothingEvidence = contribution.smoothing_evidence;
  const portfolioContribution = contribution.portfolio_contribution_pct;
  const portfolioReturn = contribution.total_portfolio_return_pct;
  const rawContribution = smoothingEvidence?.raw_contribution_pct;
  const finalContribution = smoothingEvidence?.final_contribution_pct;
  const linkedReturn = smoothingEvidence?.linked_return_pct;
  const smoothingResidual = smoothingEvidence?.smoothing_residual_pct;
  if (
    !isFiniteNumber(portfolioContribution) ||
    !isFiniteNumber(portfolioReturn) ||
    !isFiniteNumber(rawContribution) ||
    !isFiniteNumber(finalContribution) ||
    !isFiniteNumber(linkedReturn) ||
    !isFiniteNumber(smoothingResidual)
  ) {
    return false;
  }

  return (
    isWithinReconciliationTolerance(portfolioContribution, portfolioReturn) &&
    isWithinReconciliationTolerance(finalContribution, linkedReturn) &&
    isWithinReconciliationTolerance(finalContribution, portfolioContribution) &&
    isWithinReconciliationTolerance(smoothingResidual, 0) &&
    (smoothingStatus !== "NOT_REQUESTED" ||
      isWithinReconciliationTolerance(rawContribution, finalContribution))
  );
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWithinReconciliationTolerance(left: number, right: number): boolean {
  return Math.abs(left - right) < CONTRIBUTION_RECONCILIATION_TOLERANCE_PCT;
}
