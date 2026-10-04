import { parseCanonicalPerformancePeriod } from "@/apps/performance/periods";
import {
  PERFORMANCE_EVIDENCE_COPY,
  PERFORMANCE_EVIDENCE_LABELS,
} from "@/apps/performance/performance-terminology";
import { formatBusinessDateValue, formatTimestampValue } from "@/design-system/utils/financial-formatters";
import type {
  PerformanceCalculationEvidenceView,
  PerformanceEvidenceArtifactView,
  PerformanceEvidenceView,
  PerformanceHistoryCoverageView,
} from "@/features/workbench/types";
import type { WorkspaceCapability } from "@/shell/workspace-capabilities";

export type PerformanceEvidenceTone = "default" | "success" | "warn" | "danger";

export type PerformanceEvidenceException = {
  key: string;
  title: string;
  detail: string;
  action: string;
  tone: Exclude<PerformanceEvidenceTone, "success">;
};

export type PerformanceEvidenceRecord = {
  key: string;
  label: string;
  href: string | null;
  support: string;
};

export type PerformanceCalculationAssurance = {
  key: string;
  title: string;
  purpose: string;
  calculationStatus: string;
  calculationTone: PerformanceEvidenceTone;
  evidenceStatus: string;
  evidenceTone: PerformanceEvidenceTone;
  evidenceCount: number;
  records: PerformanceEvidenceRecord[];
};

export type PerformanceEvidenceSupportGroup = {
  key: string;
  title: string;
  rows: Array<{ label: string; value: string }>;
};

export type PerformanceEvidenceSelectionContext = {
  asOfDate: string;
  period: string | null | undefined;
  reportStartDate?: string | null;
  reportEndDate?: string | null;
  basis: string;
  benchmarkCode?: string | null;
  contributionDimension: string;
  attributionDimension: string;
};

export type PerformanceEvidenceAssuranceViewModel = {
  state: "ready" | "attention" | "incomplete" | "unavailable";
  posture: string;
  tone: PerformanceEvidenceTone;
  summary: string;
  context: Array<{ label: string; value: string }>;
  metrics: Array<{ label: string; value: string; support: string }>;
  exceptions: PerformanceEvidenceException[];
  calculations: PerformanceCalculationAssurance[];
  methodologyCount: number;
  supportGroups: PerformanceEvidenceSupportGroup[];
  history: PerformanceHistoryAssurance[];
};

const CALCULATION_ROLE_PRESENTATION: Record<string, { title: string; purpose: string }> = {
  workspace_summary: {
    title: "Portfolio performance summary",
    purpose: "Supports the selected portfolio return and benchmark review.",
  },
  workspace_details: {
    title: "Performance analysis detail",
    purpose: "Supports the selected analytical breakdown and its underlying observations.",
  },
};

const DIMENSION_LABELS: Record<string, string> = {
  asset_class: "Asset class",
  country: "Country",
  currency: "Currency",
  issuer: "Issuer",
  sector: "Sector",
};
const REQUIRED_INPUT_LABELS = {
  performance: "Performance input",
  benchmark: "Benchmark input",
} as const;

const COMPLETE_STATUS = "complete";
const PERFORMANCE_WORKSPACE_SCOPE = "performance_workspace";
const PENDING_STATUSES: readonly string[] = ["accepted", "pending", "queued", "running", "processing"];
const FAILED_STATUSES: readonly string[] = ["cancelled", "failed", "rejected", "unavailable"];
const FRESH_STATES: readonly string[] = ["current", "fresh"];
const STALE_STATES: readonly string[] = ["expired", "stale"];
const UNAVAILABLE_STATES: readonly string[] = ["missing", "unavailable"];
const READY_SUPPORTABILITY_STATES: readonly string[] = [
  "ready",
  "supported",
  "ok",
  "complete",
  "source_backed",
  "caller_supplied",
];
const PARTIAL_SUPPORTABILITY_STATES: readonly string[] = ["partial", "stale", "source_limited"];
const ACTION_REQUIRED_SUPPORTABILITY_STATES: readonly string[] = [
  "blocked",
  "degraded",
  "unavailable",
  "unsupported",
  "action_required",
];
const GATEWAY_API_PREFIX = "/api/v1/";
const WORKBENCH_BFF_API_PREFIX = "/api/bff/api/v1/";

export function buildPerformanceEvidenceAssuranceViewModel(
  capability: WorkspaceCapability,
  evidence: PerformanceEvidenceView,
  selection: PerformanceEvidenceSelectionContext
): PerformanceEvidenceAssuranceViewModel {
  const calculations = safeArray(evidence.calculations).map(buildCalculationAssurance),
    history = buildHistoryAssurance(evidence);
  const exceptions = withHistoryExceptions(buildExceptions(capability, evidence, selection), history);
  const completeCalculations = calculations.filter(
    (calculation) =>
      calculation.calculationTone === "success" && calculation.evidenceTone === "success"
  ).length;
  const evidenceCount = calculations.reduce(
    (total, calculation) => total + calculation.evidenceCount,
    0
  );
  const state = resolveAssuranceState(capability, evidence, calculations, exceptions);
  const posture = {
    ready: "Ready for internal review",
    attention: PERFORMANCE_EVIDENCE_LABELS.needsAttention,
    incomplete: "Incomplete evidence",
    unavailable: "Assurance unavailable",
  }[state];
  const tone: PerformanceEvidenceTone = {
    ready: "success",
    attention: "danger",
    incomplete: "warn",
    unavailable: "default",
  }[state] as PerformanceEvidenceTone;

  return {
    state,
    posture,
    tone,
    summary: assuranceSummary(state),
    context: buildContext(evidence),
    metrics: [
      {
        label: "Calculation coverage",
        value: `${completeCalculations} of ${calculations.length}`,
        support: "Calculations with both completion and supporting-evidence confirmation.",
      },
      {
        label: "Review items",
        value: String(exceptions.length),
        support: exceptions.length
          ? "Items to resolve or qualify before relying on the evidence package."
          : "No source-reported evidence exception is present.",
      },
      {
        label: "Supporting records",
        value: String(evidenceCount),
        support: "Source-published records available from the calculation evidence package.",
      },
    ],
    exceptions,
    calculations,
    methodologyCount: safeStrings(evidence.methodology_references).length,
    supportGroups: [...buildSupportGroups(capability, evidence), ...history.map((item) => item.support)],
    history,
  };
}

function resolveAssuranceState(
  capability: WorkspaceCapability,
  evidence: PerformanceEvidenceView,
  calculations: PerformanceCalculationAssurance[],
  exceptions: PerformanceEvidenceException[]
): PerformanceEvidenceAssuranceViewModel["state"] {
  if (capability.state === "unavailable" || capability.state === "hidden") return "unavailable";
  if (normalise(evidence.state) === "unavailable") return "unavailable";
  if (exceptions.some((exception) => exception.tone === "danger")) return "attention";
  if (!calculations.length) return "incomplete";
  if (
    capability.state !== "supported" ||
    normalise(evidence.state) !== "supported" ||
    exceptions.length > 0 ||
    calculations.some(
      (calculation) =>
        calculation.calculationTone !== "success" || calculation.evidenceTone !== "success"
    )
  ) {
    return "incomplete";
  }
  return "ready";
}

function assuranceSummary(state: PerformanceEvidenceAssuranceViewModel["state"]): string {
  if (state === "ready") {
    return "The selected performance result has source-confirmed calculation and supporting evidence for internal review. This does not constitute client-release or regulatory approval.";
  }
  if (state === "attention") {
    return "A source-reported control exception affects the selected evidence package. Review the affected calculation before relying on the result.";
  }
  if (state === "incomplete") {
    return "The selected result remains visible, but its calculation or supporting evidence is not fully confirmed. Keep the package within internal review.";
  }
  return "The source could not confirm a usable calculation-assurance package for the selected performance view.";
}

function buildContext(evidence: PerformanceEvidenceView) {
  return [
    { label: "As of", value: displayValue(evidence.as_of_date) },
    { label: "Review period", value: displayValue(evidence.period) },
    { label: "Return basis", value: basisLabel(evidence.basis) },
    { label: "Benchmark", value: evidence.benchmark_code?.trim() ? "Assigned" : "Not assigned" },
  ];
}

function buildCalculationAssurance(
  calculation: PerformanceCalculationEvidenceView,
  index: number
): PerformanceCalculationAssurance {
  const role = calculationRolePresentation(calculation, index);
  const calculationStatus = resolveCalculationLifecyclePresentation(calculation);
  const evidenceStatus = resolveEvidenceLifecyclePresentation(calculation);
  const records = safeArray(calculation.artifacts).map((artifact, artifactIndex) =>
    buildRecord(artifact, artifactIndex)
  );

  return {
    key: calculation.calculation_id || `calculation-${index}`,
    title: role.title,
    purpose: role.purpose,
    calculationStatus: calculationStatus.label,
    calculationTone: calculationStatus.tone,
    evidenceStatus: evidenceStatus.label,
    evidenceTone: evidenceStatus.tone,
    evidenceCount: records.length,
    records,
  };
}

function calculationRolePresentation(
  calculation: PerformanceCalculationEvidenceView,
  index: number
) {
  return CALCULATION_ROLE_PRESENTATION[normalise(calculation.calculation_role)] ?? {
    title: `Additional performance calculation ${index + 1}`,
    purpose: "Business purpose not confirmed by the source.",
  };
}

function resolveCalculationLifecyclePresentation(
  calculation: PerformanceCalculationEvidenceView
): { label: string; tone: PerformanceEvidenceTone } {
  if (
    !calculation.calculation_id?.trim() ||
    !CALCULATION_ROLE_PRESENTATION[normalise(calculation.calculation_role)]
  ) {
    return { label: "Not confirmed", tone: "default" };
  }
  const aggregate = lifecyclePresentation(calculation.execution_status, "calculation");
  const stageStates = safeArray(calculation.stage_statuses).map((stage) => normalise(stage.status));
  if (!stageStates.length || stageStates.every((state) => state === COMPLETE_STATUS)) {
    return aggregate;
  }

  const stagePresentation = stageStates.some((state) => FAILED_STATUSES.includes(state))
    ? { label: PERFORMANCE_EVIDENCE_LABELS.needsAttention, tone: "danger" as const }
    : stageStates.some((state) => PENDING_STATUSES.includes(state))
      ? { label: "In progress", tone: "warn" as const }
      : { label: "Not confirmed", tone: "default" as const };
  const tonePriority: Record<PerformanceEvidenceTone, number> = {
    default: 1,
    success: 0,
    warn: 2,
    danger: 3,
  };
  return tonePriority[stagePresentation.tone] > tonePriority[aggregate.tone]
    ? stagePresentation
    : aggregate;
}

function resolveEvidenceLifecyclePresentation(
  calculation: PerformanceCalculationEvidenceView
): { label: string; tone: PerformanceEvidenceTone } {
  const lineage = lifecyclePresentation(calculation.lineage_status, "evidence");
  if (lineage.tone !== "success") return lineage;

  const artifacts = safeArray(calculation.artifacts);
  if (!artifacts.length) return { label: "Not confirmed", tone: "default" };
  if (
    artifacts.some(
      (artifact) =>
        !buildEvidenceRecordHref(artifact.archive_document_download_url ?? artifact.url)
    )
  ) {
    return { label: PERFORMANCE_EVIDENCE_LABELS.needsAttention, tone: "danger" };
  }
  const upstreamSnapshots = safeArray(calculation.upstream_snapshots);
  if (
    upstreamSnapshots.some(
      (snapshot) =>
        !snapshot.upstream_endpoint?.trim() ||
        !snapshot.source_identifier?.trim() ||
        !snapshot.as_of_date?.trim()
    )
  ) {
    return { label: "Not confirmed", tone: "default" };
  }
  const retrievalStates = upstreamSnapshots.map((snapshot) =>
    classifyUpstreamRetrievalState(snapshot.retrieval_status)
  );
  if (retrievalStates.includes("failed")) {
    return { label: PERFORMANCE_EVIDENCE_LABELS.needsAttention, tone: "danger" };
  }
  if (retrievalStates.includes("pending")) {
    return { label: "In progress", tone: "warn" };
  }
  if (retrievalStates.includes("unknown")) {
    return { label: "Not confirmed", tone: "default" };
  }
  return lineage;
}

function lifecyclePresentation(
  value: string | null | undefined,
  subject: "calculation" | "evidence"
): { label: string; tone: PerformanceEvidenceTone } {
  const state = normalise(value);
  if (state === COMPLETE_STATUS) return { label: "Confirmed", tone: "success" };
  if (PENDING_STATUSES.includes(state)) return { label: "In progress", tone: "warn" };
  if (FAILED_STATUSES.includes(state)) {
    return { label: PERFORMANCE_EVIDENCE_LABELS.needsAttention, tone: "danger" };
  }
  return { label: subject === "calculation" ? "Not reported" : "Not confirmed", tone: "default" };
}

function buildRecord(
  artifact: PerformanceEvidenceArtifactView,
  index: number
): PerformanceEvidenceRecord {
  const name = normalise(artifact.artifact_name);
  const label =
    name === "request.json"
      ? "Calculation input record"
      : name === "lineage.json"
        ? "Calculation lineage record"
        : artifact.archive_document_id
          ? "Archived evidence document"
          : `Supporting record ${index + 1}`;
  const href = buildEvidenceRecordHref(
    artifact.archive_document_download_url ?? artifact.url
  );
  return {
    key: `${artifact.artifact_name}-${index}`,
    label,
    href,
    support: href
      ? artifact.archive_document_id
        ? "Open the governed archived document through the Workbench evidence boundary."
        : "Open the source-published record through the Workbench evidence boundary."
      : "This source-published route is not available through the Workbench evidence boundary.",
  };
}

function buildEvidenceRecordHref(value: string | null | undefined): string | null {
  const route = value?.trim();
  if (!route) return null;
  if (route.startsWith(WORKBENCH_BFF_API_PREFIX)) return route;
  if (route.startsWith(GATEWAY_API_PREFIX)) return `/api/bff${route}`;
  return null;
}

function buildExceptions(
  capability: WorkspaceCapability,
  evidence: PerformanceEvidenceView,
  selection: PerformanceEvidenceSelectionContext
): PerformanceEvidenceException[] {
  const exceptions: PerformanceEvidenceException[] = [];
  const evidenceState = normalise(evidence.state);
  if (capability.state === "partial" || evidenceState === "partial") {
    exceptions.push({
      key: "evidence-package-partial",
      title: "Evidence package incomplete",
      detail: "One or more calculation or supporting-evidence checks are not fully confirmed.",
      action: "Review the affected calculation and keep the result within internal review.",
      tone: "warn",
    });
  } else if (evidenceState === "unavailable") {
    exceptions.push({
      key: "evidence-package-unavailable",
      title: "Evidence package unavailable",
      detail: "The source could not provide a usable calculation-assurance package for this selection.",
      action: "Keep the result within internal review and obtain refreshed source evidence.",
      tone: "danger",
    });
  } else if (evidenceState !== "supported") {
    exceptions.push({
      key: "evidence-state-not-reported",
      title: "Assurance status not reported",
      detail: "The source did not publish a recognised assurance state for this selection.",
      action: "Use support details to identify the source reference before relying on the package.",
      tone: "warn",
    });
  }

  if (!evidence.as_of_date?.trim()) {
    exceptions.push({
      key: "reporting-date-missing",
      title: "Reporting date not confirmed",
      detail: "The source did not identify the date covered by this assurance package.",
      action: "Obtain source-confirmed reporting context before relying on the package.",
      tone: "warn",
    });
  }
  if (!evidence.period?.trim()) {
    exceptions.push({
      key: "review-period-missing",
      title: "Review period not confirmed",
      detail: "The source did not identify the performance period covered by this assurance package.",
      action: "Obtain source-confirmed reporting context before relying on the package.",
      tone: "warn",
    });
  } else if (!parseCanonicalPerformancePeriod(evidence.period)) {
    exceptions.push({
      key: "review-period-unrecognized",
      title: "Review period not supported",
      detail:
        "The source assurance package identifies a performance period that Workbench does not support.",
      action: "Obtain calculation evidence for a supported review period before relying on the package.",
      tone: "danger",
    });
  }
  const selectedPeriod = parseCanonicalPerformancePeriod(selection.period);
  if (!normalise(selection.period)) {
    exceptions.push({
      key: "active-review-period-missing",
      title: "Selected review period not confirmed",
      detail: "The active performance workspace does not identify the review period in use.",
      action: "Choose a supported review period and refresh the source-confirmed performance view.",
      tone: "danger",
    });
  } else if (!selectedPeriod) {
    exceptions.push({
      key: "active-review-period-unrecognized",
      title: "Selected review period not supported",
      detail: "The active performance workspace uses a review period that Workbench cannot interpret.",
      action: "Choose a supported review period and refresh the source-confirmed performance view.",
      tone: "danger",
    });
  }
  if (!["gross", "net"].includes(normalise(evidence.basis))) {
    exceptions.push({
      key: "return-basis-missing",
      title: "Return basis not confirmed",
      detail: "The source did not publish a recognised gross- or net-of-fees basis for this package.",
      action: "Confirm the applicable return basis before relying on the calculation evidence.",
      tone: "warn",
    });
  }
  if (normalise(evidence.calculation_scope) !== PERFORMANCE_WORKSPACE_SCOPE) {
    exceptions.push({
      key: "calculation-scope-unconfirmed",
      title: "Calculation assurance scope not confirmed",
      detail: evidence.calculation_scope?.trim()
        ? "The source evidence package is not scoped to the active performance workspace."
        : "The source did not identify this package as evidence for the active performance workspace.",
      action: "Obtain a performance-workspace evidence package before relying on the assurance conclusion.",
      tone: "danger",
    });
  }
  if (!safeStrings(evidence.source_services).length) {
    exceptions.push({
      key: "source-services-unconfirmed",
      title: "Evidence source not confirmed",
      detail: "The package does not identify the domain service responsible for its calculation evidence.",
      action: "Obtain source-owned evidence before relying on the assurance conclusion.",
      tone: "warn",
    });
  }
  const calculationVersions = Object.entries(evidence.calculation_versions ?? {}).filter(
    ([key, value]) => key.trim() && typeof value === "string" && value.trim()
  );
  if (!calculationVersions.length) {
    exceptions.push({
      key: "calculation-versions-unconfirmed",
      ...PERFORMANCE_EVIDENCE_COPY.exceptions.calculationVersionMissing,
      tone: "warn",
    });
  }
  const explicitWindowSelected =
    normalise(selection.period) === "explicit" || normalise(evidence.period) === "explicit";
  const evidenceReportStartDate = evidence.report_start_date?.trim();
  const evidenceReportEndDate = evidence.report_end_date?.trim();
  const selectedReportStartDate = selection.reportStartDate?.trim();
  const selectedReportEndDate = selection.reportEndDate?.trim();
  if (
    explicitWindowSelected &&
    (!evidenceReportStartDate ||
      !evidenceReportEndDate ||
      !selectedReportStartDate ||
      !selectedReportEndDate)
  ) {
    exceptions.push({
      key: "explicit-review-window-unconfirmed",
      title: "Explicit review window not confirmed",
      detail:
        "The source assurance package does not identify the same inclusive start and end boundaries as the active performance review.",
      action: "Refresh the selected performance view and obtain evidence for the complete review window.",
      tone: "danger",
    });
  }
  const mismatchedContext = [
    evidence.as_of_date?.trim() && evidence.as_of_date.trim() !== selection.asOfDate.trim()
      ? "reporting date"
      : null,
    evidence.period?.trim() && normalise(evidence.period) !== normalise(selection.period)
      ? "review period"
      : null,
    ["gross", "net"].includes(normalise(evidence.basis)) &&
    normalise(evidence.basis) !== normalise(selection.basis)
      ? "return basis"
      : null,
    normalise(evidence.benchmark_code) !== normalise(selection.benchmarkCode)
      ? "benchmark assignment"
      : null,
    explicitWindowSelected &&
    evidenceReportStartDate &&
    selectedReportStartDate &&
    evidenceReportStartDate !== selectedReportStartDate
      ? "review start date"
      : null,
    explicitWindowSelected &&
    evidenceReportEndDate &&
    selectedReportEndDate &&
    evidenceReportEndDate !== selectedReportEndDate
      ? "review end date"
      : null,
  ].filter((item): item is string => Boolean(item));
  if (mismatchedContext.length) {
    exceptions.push({
      key: "selection-context-mismatch",
      title: "Evidence context does not match the active selection",
      detail: `The source evidence does not match the selected ${mismatchedContext.join(
        ", "
      )}.`,
      action: "Refresh the selected performance view and obtain evidence for the confirmed context.",
      tone: "danger",
    });
  }

  const calculations = safeArray(evidence.calculations);
  if (!calculations.length) {
    exceptions.push({
      key: "calculations-missing",
      title: "Calculation evidence not reported",
      detail: "The source did not publish any calculation evidence for this assurance package.",
      action: "Obtain the source calculation and its supporting records before relying on the package.",
      tone: "warn",
    });
  }
  calculations.forEach((calculation, index) => {
    const calculationTitle = calculationRolePresentation(calculation, index).title;
    if (!calculation.calculation_id?.trim()) {
      exceptions.push({
        key: `calculation-id-${index}`,
        title: `${calculationTitle} reference not confirmed`,
        detail: "The source did not publish a durable reference for this calculation.",
        action: "Obtain source-owned calculation evidence before relying on this item.",
        tone: "warn",
      });
    }
    if (!CALCULATION_ROLE_PRESENTATION[normalise(calculation.calculation_role)]) {
      exceptions.push({
        key: `calculation-role-${index}`,
        title: `${calculationTitle} purpose not confirmed`,
        detail: "The source did not publish a recognised business purpose for this calculation evidence.",
        action: "Obtain a source-confirmed calculation role before relying on this item.",
        tone: "warn",
      });
    }
    appendLifecycleException(
      exceptions,
      calculation.execution_status,
      "calculation",
      index,
      calculationTitle
    );
    appendLifecycleException(
      exceptions,
      calculation.lineage_status,
      "evidence",
      index,
      calculationTitle
    );
    safeArray(calculation.stage_statuses).forEach((stage, stageIndex) => {
      appendStageLifecycleException(
        exceptions,
        stage.status,
        index,
        stageIndex,
        calculationTitle
      );
    });
    safeArray(calculation.upstream_snapshots).forEach((snapshot, snapshotIndex) => {
      if (
        !snapshot.upstream_endpoint?.trim() ||
        !snapshot.source_identifier?.trim() ||
        !snapshot.as_of_date?.trim()
      ) {
        exceptions.push({
          key: `upstream-context-${index}-${snapshotIndex}`,
          title: `${calculationTitle} upstream evidence ${snapshotIndex + 1} context not confirmed`,
          detail: "The source did not identify the upstream record, owner reference, and business date used by this calculation.",
          action: "Obtain complete upstream evidence before relying on this calculation.",
          tone: "warn",
        });
      }
      appendUpstreamRetrievalException(
        exceptions,
        snapshot.retrieval_status,
        index,
        snapshotIndex,
        calculationTitle
      );
    });
    const artifacts = safeArray(calculation.artifacts);
    if (!artifacts.length) {
      exceptions.push({
        key: `artifacts-${index}`,
        title: `${calculationTitle} supporting records not published`,
        detail: "The source did not publish a supporting record for this calculation.",
        action: "Obtain the calculation record before relying on the assurance package.",
        tone: "warn",
      });
    }
    artifacts.forEach((artifact, artifactIndex) => {
      if (buildEvidenceRecordHref(artifact.archive_document_download_url ?? artifact.url)) return;
      exceptions.push({
        key: `artifact-route-${index}-${artifactIndex}`,
        title: `${calculationTitle} supporting record ${artifactIndex + 1} route unavailable`,
        detail: "A source-published supporting record is not exposed through the Workbench evidence boundary.",
        action: "Use support details to identify the record and request a governed Gateway route before relying on it.",
        tone: "danger",
      });
    });
  });

  const inputFreshness = evidence.input_freshness ?? {};
  const inputFreshnessEntries = Object.entries(inputFreshness);
  const requiredInputKeys: Array<keyof typeof REQUIRED_INPUT_LABELS> = ["performance"];
  if (evidence.benchmark_code?.trim()) requiredInputKeys.push("benchmark");
  if (!inputFreshnessEntries.length) {
    exceptions.push({
      key: "input-freshness-missing",
      title: "Input freshness not confirmed",
      detail: "The source did not publish freshness evidence for the inputs used by this package.",
      action: "Obtain refreshed source evidence before relying on the calculation-assurance package.",
      tone: "warn",
    });
  } else {
    requiredInputKeys.forEach((key) => {
      if (Object.hasOwn(inputFreshness, key)) return;
      const label = REQUIRED_INPUT_LABELS[key];
      exceptions.push({
        key: `freshness-${key}-missing`,
        title: `${label} freshness not confirmed`,
        detail: `The source did not publish freshness evidence for the selected ${key} input.`,
        action: "Obtain refreshed source evidence before relying on the calculation-assurance package.",
        tone: "warn",
      });
    });
  }
  inputFreshnessEntries
    .filter(([key]) => requiredInputKeys.includes(key as keyof typeof REQUIRED_INPUT_LABELS))
    .forEach(([key, value]) => {
      const state = normalise(value);
      if (FRESH_STATES.includes(state)) return;
      const label =
        REQUIRED_INPUT_LABELS[key as keyof typeof REQUIRED_INPUT_LABELS] ??
        DIMENSION_LABELS[normalise(key)] ??
        "Required input";
      if (STALE_STATES.includes(state)) {
        exceptions.push({
          key: `freshness-${key}`,
          title: `${label} evidence is not current`,
          detail: "The source reports that an input used by the evidence package is stale.",
          action: "Refresh the source calculation before using the result for a current review.",
          tone: "danger",
        });
      } else if (state === "unavailable") {
        exceptions.push({
          key: `freshness-${key}`,
          title: `${label} unavailable`,
          detail: "The source could not provide a selected input required by the evidence package.",
          action: "Restore the required source input and obtain refreshed evidence before relying on the package.",
          tone: "danger",
        });
      } else {
        exceptions.push({
          key: `freshness-${key}`,
          title: `${label} freshness not confirmed`,
          detail: UNAVAILABLE_STATES.includes(state)
            ? "The source could not provide this input for the evidence package."
            : "The source did not publish a recognised freshness state for this input.",
          action: "Review the source limitation and supporting records before relying on the package.",
          tone: "warn",
        });
      }
    });

  const sourceSupportability = safeArray(evidence.source_supportability);
  if (!sourceSupportability.length) {
    exceptions.push({
      key: "source-supportability-missing",
      ...PERFORMANCE_EVIDENCE_COPY.exceptions.calculationAvailabilityMissing,
      tone: "warn",
    });
  }
  sourceSupportability.forEach((item, index) => {
    const state = normalise(item.state);
    const freshness = normalise(item.freshness_bucket);
    const sourceReference = `${item.source_service || "source"}-${item.operation || item.key || "entry"}-${index}`;
    if (
      !item.source_service?.trim() ||
      !(item.operation?.trim() || item.key?.trim())
    ) {
      exceptions.push({
        key: `source-supportability-identity-${index}`,
        ...PERFORMANCE_EVIDENCE_COPY.exceptions.calculationAvailabilityIdentityMissing,
        tone: "warn",
      });
    }
    if (STALE_STATES.includes(freshness)) {
      exceptions.push({
        key: `source-supportability-${sourceReference}`,
        title: "Source calculation evidence is not current",
        detail: "A source calculation required by this evidence package is stale.",
        action: "Review the source reason in support details and obtain refreshed evidence.",
        tone: "danger",
      });
      return;
    }
    if (READY_SUPPORTABILITY_STATES.includes(state)) {
      if (!FRESH_STATES.includes(freshness)) {
        exceptions.push({
          key: `source-supportability-${sourceReference}`,
          title: "Source calculation freshness not confirmed",
          detail: "A ready source calculation does not include a recognised current freshness state.",
          action: "Review the source reason in support details and obtain current source evidence.",
          tone: "warn",
        });
      }
      return;
    }
    const actionRequired = ACTION_REQUIRED_SUPPORTABILITY_STATES.includes(state);
    const qualified = PARTIAL_SUPPORTABILITY_STATES.includes(state);
    exceptions.push({
      key: `source-supportability-${sourceReference}`,
      title: actionRequired
        ? "Source calculation unavailable"
        : qualified
          ? PERFORMANCE_EVIDENCE_COPY.exceptions.calculationAvailabilityQualifiedTitle
          : PERFORMANCE_EVIDENCE_COPY.exceptions.calculationAvailabilityUnknownTitle,
      detail:
        actionRequired
          ? "A source calculation required by this evidence package is unavailable."
          : qualified
            ? PERFORMANCE_EVIDENCE_COPY.exceptions.calculationAvailabilityQualified
            : PERFORMANCE_EVIDENCE_COPY.exceptions.calculationAvailabilityUnknown,
      action: "Review the source reason in support details and obtain refreshed evidence.",
      tone: actionRequired ? "danger" : "warn",
    });
  });

  if (safeStrings(evidence.fallbacks).length) {
    exceptions.push({
      key: "fallbacks",
      title: "Alternate calculation path applied",
      detail: "The source reports that one or more fallback paths were used for this evidence package.",
      action: "Review the fallback description in support details before relying on the result.",
      tone: "warn",
    });
  }
  if (safeStrings(evidence.limitations).length) {
    exceptions.push({
      key: "limitations",
      title: "Source limitation applies",
      detail: "The source has qualified the scope or completeness of this evidence package.",
      action: "Review the source limitation in support details and retain the package for internal review only.",
      tone: "warn",
    });
  }

  if (!safeStrings(evidence.methodology_references).length) {
    exceptions.push({
      key: "methodology-reference-missing",
      ...PERFORMANCE_EVIDENCE_COPY.exceptions.methodologyMissing,
      tone: "warn",
    });
  }

  const supportedDimensions = safeStrings(evidence.coverage?.supported_dimensions);
  const unsupportedDimensions = safeStrings(evidence.coverage?.unsupported_dimensions);
  if (!supportedDimensions.length && !unsupportedDimensions.length) {
    exceptions.push({
      key: "coverage-not-confirmed",
      title: "Evidence coverage not confirmed",
      detail: "The source did not publish the dimensional scope covered by this assurance package.",
      action: "Obtain source-confirmed coverage before applying the evidence conclusion.",
      tone: "warn",
    });
  }
  const supportedDimensionKeys = new Set(supportedDimensions.map(normalise));
  const selectedDimensionsWithoutCoverage = Array.from(
    new Set(
      [selection.contributionDimension, selection.attributionDimension]
        .map(normalise)
        .filter(Boolean)
    )
  ).filter((dimension) => !supportedDimensionKeys.has(dimension));
  if (selectedDimensionsWithoutCoverage.length) {
    const knownLabels = selectedDimensionsWithoutCoverage
      .map((dimension) => DIMENSION_LABELS[dimension])
      .filter((label): label is string => Boolean(label));
    exceptions.push({
      key: "selected-dimension-coverage-unconfirmed",
      title: "Selected analytical coverage not confirmed",
      detail: knownLabels.length
        ? `The source evidence does not confirm ${knownLabels.join(", ")} for the active performance review.`
        : "The source evidence does not confirm every selected analytical breakdown for the active performance review.",
      action: "Select a source-supported breakdown or obtain evidence for the current analytical view.",
      tone: "warn",
    });
  }
  if (unsupportedDimensions.length) {
    const knownLabels = unsupportedDimensions
      .map((dimension) => DIMENSION_LABELS[normalise(dimension)])
      .filter((label): label is string => Boolean(label));
    exceptions.push({
      key: "coverage-limit",
      title: "Evidence coverage is limited",
      detail: knownLabels.length
        ? `${knownLabels.join(", ")} ${knownLabels.length === 1 ? "is" : "are"} outside the published evidence coverage.`
        : `${unsupportedDimensions.length} additional evidence ${unsupportedDimensions.length === 1 ? "dimension is" : "dimensions are"} outside the published coverage.`,
      action: "Do not extend the evidence conclusion to dimensions the source does not support.",
      tone: "warn",
    });
  }
  return dedupeByKey(exceptions);
}

function appendLifecycleException(
  exceptions: PerformanceEvidenceException[],
  value: string | null | undefined,
  subject: "calculation" | "evidence",
  index: number,
  calculationTitle: string
) {
  const state = normalise(value);
  if (state === COMPLETE_STATUS) return;
  const failed = FAILED_STATUSES.includes(state);
  const pending = PENDING_STATUSES.includes(state);
  exceptions.push({
    key: `${subject}-${index}`,
    title:
      subject === "calculation"
        ? failed
          ? `${calculationTitle} did not complete`
          : pending
            ? `${calculationTitle} still in progress`
            : `${calculationTitle} status not reported`
        : failed
          ? `${calculationTitle} evidence unavailable`
          : pending
            ? `${calculationTitle} evidence still being prepared`
            : `${calculationTitle} evidence not confirmed`,
    detail:
      subject === "calculation"
        ? "The source has not confirmed a completed performance calculation for this item."
        : "The source has not confirmed complete lineage and supporting records for this item.",
    action: "Keep the affected result within internal review and obtain refreshed source evidence.",
    tone: failed ? "danger" : "warn",
  });
}

function appendStageLifecycleException(
  exceptions: PerformanceEvidenceException[],
  value: string | null | undefined,
  calculationIndex: number,
  stageIndex: number,
  calculationTitle: string
) {
  const state = normalise(value);
  if (state === COMPLETE_STATUS) return;
  const failed = FAILED_STATUSES.includes(state);
  const pending = PENDING_STATUSES.includes(state);
  exceptions.push({
    key: `calculation-stage-${calculationIndex}-${stageIndex}`,
    title: failed
      ? `${calculationTitle} stage did not complete`
      : pending
        ? `${calculationTitle} stage still in progress`
        : `${calculationTitle} stage status not reported`,
    detail: failed
      ? "A source calculation stage did not complete successfully."
      : pending
        ? "A source calculation stage has not completed yet."
        : "The source published a calculation stage without a recognised completion state.",
    action: "Keep the affected result within internal review and obtain refreshed source evidence.",
    tone: failed ? "danger" : "warn",
  });
}

function appendUpstreamRetrievalException(
  exceptions: PerformanceEvidenceException[],
  value: string | null | undefined,
  calculationIndex: number,
  snapshotIndex: number,
  calculationTitle: string
) {
  const state = classifyUpstreamRetrievalState(value);
  if (state === "success") return;

  const pending = state === "pending";
  const failed = state === "failed";
  exceptions.push({
    key: `upstream-retrieval-${calculationIndex}-${snapshotIndex}`,
    title: failed
      ? `${calculationTitle} upstream evidence ${snapshotIndex + 1} unavailable`
      : pending
        ? `${calculationTitle} upstream evidence ${snapshotIndex + 1} retrieval in progress`
        : `${calculationTitle} upstream evidence ${snapshotIndex + 1} status not confirmed`,
    detail: failed
      ? "The source reports that required upstream evidence could not be retrieved."
      : pending
        ? "The source has not completed retrieval of required upstream evidence."
        : "The source did not publish a recognised upstream retrieval state.",
    action: "Keep the affected result within internal review and obtain refreshed source evidence.",
    tone: failed ? "danger" : "warn",
  });
}

function classifyUpstreamRetrievalState(
  value: string | null | undefined
): "success" | "pending" | "failed" | "unknown" {
  const state = normalise(value);
  if (/^(2\d{2}|complete|completed|ok|retrieved|success|successful)$/.test(state)) {
    return "success";
  }
  if (PENDING_STATUSES.includes(state)) return "pending";
  if (/^(4\d{2}|5\d{2}|error)$/.test(state) || FAILED_STATUSES.includes(state)) {
    return "failed";
  }
  return "unknown";
}

function buildSupportGroups(
  capability: WorkspaceCapability,
  evidence: PerformanceEvidenceView
): PerformanceEvidenceSupportGroup[] {
  const groups: PerformanceEvidenceSupportGroup[] = [];
  const sourceRows = [
    {
      label: PERFORMANCE_EVIDENCE_COPY.support.evidenceStateLabel,
      value: displayValue(evidence.state),
    },
    {
      label: PERFORMANCE_EVIDENCE_COPY.support.capabilityStateLabel,
      value: capability.state,
    },
    { label: "Evidence reason", value: displayValue(evidence.reason ?? capability.reason) },
    { label: "Calculation scope", value: displayValue(evidence.calculation_scope) },
    { label: "Benchmark code", value: displayValue(evidence.benchmark_code, "Not assigned") },
    {
      label: "Generated at",
      value: formatTimestampValue(evidence.generated_at, { nullDisplay: "Not reported" }),
    },
    ...safeStrings(evidence.source_services).map((value, index) => ({
      label: `Source service ${index + 1}`,
      value,
    })),
    ...Object.entries(evidence.input_freshness ?? {}).map(([key, value]) => ({
      label: `Input freshness · ${key}`,
      value,
    })),
    ...Object.entries(evidence.calculation_versions ?? {}).map(([key, value]) => ({
      label: `Version · ${key}`,
      value,
    })),
  ];
  groups.push({ key: "source-contract", title: "Source contract", rows: sourceRows });

  const sourceSupportabilityRows = safeArray(evidence.source_supportability).flatMap(
    (item, index) => [
      {
        label: `Source ${index + 1}`,
        value: displayValue(item.source_service, "Not reported"),
      },
      { label: `Source ${index + 1} state`, value: displayValue(item.state) },
      {
        label: `Source ${index + 1} freshness`,
        value: displayValue(item.freshness_bucket),
      },
      { label: `Source ${index + 1} reason`, value: displayValue(item.reason) },
      {
        label: `Source ${index + 1} reference`,
        value: displayValue(item.operation || item.key),
      },
    ]
  );
  if (sourceSupportabilityRows.length) {
    groups.push({
      key: "source-supportability",
      title: PERFORMANCE_EVIDENCE_COPY.support.availabilityGroupTitle,
      rows: sourceSupportabilityRows,
    });
  }

  const scopeRows = [
    ...safeStrings(evidence.methodology_references).map((value, index) => ({
      label: `Methodology reference ${index + 1}`,
      value,
    })),
    ...safeStrings(evidence.coverage?.supported_dimensions).map((value, index) => ({
      label: `Supported dimension ${index + 1}`,
      value,
    })),
    ...safeStrings(evidence.coverage?.unsupported_dimensions).map((value, index) => ({
      label: `Unsupported dimension ${index + 1}`,
      value,
    })),
    ...safeStrings(evidence.fallbacks).map((value, index) => ({
      label: `Fallback ${index + 1}`,
      value,
    })),
    ...safeStrings(evidence.limitations).map((value, index) => ({
      label: `Limitation ${index + 1}`,
      value,
    })),
  ];
  if (scopeRows.length) groups.push({ key: "scope", title: "Methodology and scope", rows: scopeRows });

  safeArray(evidence.calculations).forEach((calculation, index) => {
    groups.push({
      key: calculation.calculation_id || `calculation-${index}`,
      title: `Calculation ${index + 1}`,
      rows: buildCalculationSupportRows(calculation),
    });
  });
  return groups.filter((group) => group.rows.length > 0);
}

function buildCalculationSupportRows(calculation: PerformanceCalculationEvidenceView) {
  return [
    { label: "Calculation role", value: displayValue(calculation.calculation_role) },
    { label: "Calculation ID", value: displayValue(calculation.calculation_id) },
    { label: "Analytics type", value: displayValue(calculation.analytics_type) },
    { label: "Execution status", value: displayValue(calculation.execution_status) },
    { label: "Execution mode", value: displayValue(calculation.execution_mode) },
    { label: "Lineage status", value: displayValue(calculation.lineage_status) },
    { label: "Source reason", value: displayValue(calculation.reason) },
    ...safeArray(calculation.stage_statuses).flatMap((stage, index) => [
      { label: `Stage ${index + 1}`, value: `${stage.stage_name}: ${stage.status}` },
      ...(stage.completed_at_utc
        ? [{ label: `Stage ${index + 1} completed`, value: stage.completed_at_utc }]
        : []),
    ]),
    ...safeArray(calculation.upstream_snapshots).map((snapshot, index) => ({
      label: `Upstream snapshot ${index + 1}`,
      value: `${snapshot.upstream_endpoint} · ${snapshot.source_identifier} · ${snapshot.as_of_date} · ${snapshot.retrieval_status}`,
    })),
    ...safeArray(calculation.artifacts).map((artifact, index) => ({
      label: `Artifact ${index + 1}`,
      value: `${artifact.artifact_name} · ${artifact.archive_document_download_url ?? artifact.url}`,
    })),
  ];
}

function basisLabel(value: string | null | undefined) {
  const basis = normalise(value);
  if (basis === "net") return "Net of fees";
  if (basis === "gross") return "Gross of fees";
  return "Not reported";
}

function normalise(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function displayValue(value: unknown, fallback = "Not reported"): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text || fallback;
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeStrings(value: string[] | null | undefined): string[] {
  return safeArray(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeByKey(items: PerformanceEvidenceException[]) {
  return items.filter((item, index) => items.findIndex((candidate) => candidate.key === item.key) === index);
}

export { PERFORMANCE_EVIDENCE_COPY };

type PerformanceHistoryAssurance = {
  key: string;
  title: string;
  status: string;
  tone: PerformanceEvidenceTone;
  rows: PerformanceEvidenceSupportGroup["rows"];
  support: PerformanceEvidenceSupportGroup;
  needsReview: boolean;
};

function withHistoryExceptions(exceptions: PerformanceEvidenceException[], history: PerformanceHistoryAssurance[]) {
  if (!history.some((item) => item.needsReview)) return exceptions;
  return [...exceptions, {
    key: "performance-history-qualified",
    title: PERFORMANCE_EVIDENCE_COPY.history.exception,
    detail: PERFORMANCE_EVIDENCE_COPY.history.detail,
    action: PERFORMANCE_EVIDENCE_COPY.history.action,
    tone: "warn" as const,
  }];
}

const HISTORY_REASON_CODES: readonly string[] = [
  "covered_window_matches_requested_window", "no_observations_in_requested_window",
  "leading_history_missing", "interior_history_missing", "trailing_history_missing",
  "venue_calendar_not_attested", "explicit_ignored_dates_applied", "beginning_market_value_baseline_applied",
];

function isHistoryDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    formatBusinessDateValue(value, { nullDisplay: "" }) !== "";
}

function isHistoryCoverage(value: unknown): value is PerformanceHistoryCoverageView {
  if (!value || typeof value !== "object") return false;
  const history = value as Record<string, unknown>;
  if (typeof history.status !== "string" || !["complete", "partial", "unknown"].includes(history.status) ||
      typeof history.calculation_basis !== "string" || !["requested_window", "available_window"].includes(history.calculation_basis) ||
      typeof history.calendar_basis !== "string" || !["natural_days", "business_weekdays"].includes(history.calendar_basis) ||
      !isHistoryDate(history.requested_start_date) || !isHistoryDate(history.requested_end_date) ||
      history.requested_start_date > history.requested_end_date ||
      !Number.isSafeInteger(history.missing_required_observation_count) ||
      (history.missing_required_observation_count as number) < 0 ||
      !Array.isArray(history.missing_required_observation_dates_sample) ||
      history.missing_required_observation_dates_sample.length > 10 ||
      !history.missing_required_observation_dates_sample.every(isHistoryDate) ||
      !Array.isArray(history.reason_codes) ||
      !history.reason_codes.every((code) => typeof code === "string" && HISTORY_REASON_CODES.includes(code))) return false;
  for (const [start, end] of [[history.covered_start_date, history.covered_end_date],
    [history.effective_start_date, history.effective_end_date]]) {
    if (start === null && end === null) continue;
    if (!isHistoryDate(start) || !isHistoryDate(end) || start > end) return false;
  }
  const effectiveStart = history.effective_start_date;
  const effectiveEnd = history.effective_end_date;
  const requestedStart = history.requested_start_date;
  const requestedEnd = history.requested_end_date;
  // Covered observations may be wider; effective observations belong to both source windows.
  if (isHistoryDate(effectiveStart) && isHistoryDate(effectiveEnd) &&
      (effectiveStart < requestedStart || effectiveEnd > requestedEnd ||
       !isHistoryDate(history.covered_start_date) || !isHistoryDate(history.covered_end_date) ||
       effectiveStart < history.covered_start_date || effectiveEnd > history.covered_end_date)) return false;
  if (history.reason_codes.includes("no_observations_in_requested_window") && effectiveStart !== null) return false;
  if (history.missing_required_observation_dates_sample.length > (history.missing_required_observation_count as number) ||
      history.missing_required_observation_dates_sample.some((date) =>
        date < requestedStart || date > requestedEnd)) return false;
  return history.status !== "complete" ||
    (history.missing_required_observation_count === 0 &&
      history.calculation_basis === "requested_window" &&
      history.missing_required_observation_dates_sample.length === 0 &&
      !history.reason_codes.some((code) => ["no_observations_in_requested_window", "leading_history_missing",
        "interior_history_missing", "trailing_history_missing", "venue_calendar_not_attested"].includes(code)) &&
      history.covered_start_date !== null && history.effective_start_date !== null);
}

function historyWindow(start: string | null, end: string | null): string {
  const copy = PERFORMANCE_EVIDENCE_COPY.history;
  return start && end
    ? `${formatBusinessDateValue(start)} – ${formatBusinessDateValue(end)}`
    : copy.notReported;
}

function buildHistoryAssurance(evidence: PerformanceEvidenceView): PerformanceHistoryAssurance[] {
  const copy = PERFORMANCE_EVIDENCE_COPY.history;
  const calculations = safeArray(evidence.calculations);
  return safeArray(evidence.source_supportability).map((source, index) => {
    const matches = calculations.filter((calculation) =>
      typeof source.calculation_id === "string" && source.calculation_id.trim() !== "" &&
      typeof source.calculation_role === "string" && source.calculation_role.trim() !== "" &&
      source.calculation_id === calculation.calculation_id && source.calculation_role === calculation.calculation_role);
    const matched = matches.length === 1 && normalise(source.source_service) === "lotus-performance" &&
      (source.metric_basis == null || (typeof source.metric_basis === "string" && source.metric_basis.trim() !== "" &&
        normalise(source.metric_basis) === normalise(evidence.basis))) &&
      (source.period_keys == null || (Array.isArray(source.period_keys) &&
        source.period_keys.every((key) => typeof key === "string" && key.trim() !== "")));
    const title = matched
      ? copy.titleFor(calculationRolePresentation(matches[0], calculations.indexOf(matches[0])).title)
      : copy.unmatched;
    const absent = source.history_coverage == null;
    const history = matched && isHistoryCoverage(source.history_coverage) ? source.history_coverage : null;
    const status = absent ? copy.absent : history ? copy.status[history.status] : copy.invalid;
    const tone: PerformanceEvidenceTone = history?.status === "complete" ? "success" : absent ? "default" : "warn";
    const rows = history ? [
      { label: copy.requested, value: historyWindow(history.requested_start_date, history.requested_end_date) },
      { label: copy.effective, value: historyWindow(history.effective_start_date, history.effective_end_date) },
      { label: copy.calculationWindow, value: copy.basis[history.calculation_basis] },
      { label: copy.missing, value: String(history.missing_required_observation_count) },
    ] : [];
    return {
      key: `history-${index}`, title, status, tone, rows,
      needsReview: !absent && (!history || history.status !== "complete"),
      support: {
        key: `history-support-${index}`, title: PERFORMANCE_EVIDENCE_COPY.history.supportTitle,
        rows: [
          { label: copy.reference, value: displayValue(source.calculation_id) },
          { label: copy.role, value: displayValue(source.calculation_role) },
          { label: copy.periods, value: safeStrings(source.period_keys).join(", ") || copy.notReported },
          { label: copy.metricBasis, value: displayValue(source.metric_basis) },
          ...(history ? [
            { label: copy.covered, value: historyWindow(history.covered_start_date, history.covered_end_date) },
            { label: copy.observationCalendar, value: copy.calendar[history.calendar_basis] },
            { label: copy.sample, value: history.missing_required_observation_dates_sample.map((date) => formatBusinessDateValue(date)).join(", ") || copy.notReported },
            { label: copy.reasons, value: history.reason_codes.join(", ") || copy.notReported },
          ] : []),
        ],
      },
    };
  });
}
