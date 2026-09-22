import {
  formatBusinessDateValue,
  formatTimestampValue,
  isBusinessDateValue,
} from "@/design-system/utils/financial-formatters";
import type {
  ReportFamily,
  ReportJobListItem,
  ReportOrderingMode,
  ReportOrderingResponse,
  ReportOutputFormat,
  ReportSection,
} from "./contracts";
import { normalizeReportJobLifecycleValue } from "./report-job-lifecycle";

export type ReportOrderingConfiguration = {
  familyId: string;
  modeId: string;
  asOfDate: string;
  reportingCurrency: string;
  allocationDimensions: string[];
  configurationValues: Record<string, string>;
  selectedSections: string[];
  outputFormat: "json" | "pdf";
};

export type ReportOrderingSourceContext = {
  asOfDate: string;
  reportingCurrency: string;
  earliestReportDate: string;
  latestReportDate: string;
  reportingCurrencies: string[];
};

export type ReportOrderingScopeMode =
  "single_portfolio" | "explicit_portfolio_batch";
export type ReportSectionAvailabilityEvidence =
  "current" | "checking" | "unavailable";

export type ReportOrderingReadiness = {
  state: "ready" | "partial" | "blocked";
  title: string;
  detail: string;
  issues: string[];
};

export type ReportOrderingViewModel = {
  family: ReportFamily | null;
  mode: ReportOrderingMode | null;
  configuration: ReportOrderingConfiguration;
  readiness: ReportOrderingReadiness;
  batchReadiness: ReportOrderingReadiness;
  eligibleFamilies: ReportFamily[];
  workflowManagedFamilies: ReportFamily[];
  outputChoices: Array<{
    id: "json" | "pdf";
    label: string;
    detail: string;
    available: boolean;
    supportReason: string;
  }>;
  sectionChoices: Array<{
    id: string;
    label: string;
    detail: string;
    required: boolean;
    selected: boolean;
    selectable: boolean;
    dependencyLabels: string[];
    availabilityLabel: string | null;
    availabilityDetail: string | null;
    recovery: "advisor_brief" | "refresh" | null;
    acceptedBrief: {
      runId: string;
      reviewedBy: string;
      reviewedAt: string;
    } | null;
  }>;
  audienceLabel: string;
  clientReleaseLabel: string;
  sourceContext: ReportOrderingSourceContext;
  canSubmit: boolean;
  canReview: boolean;
  formIssues: string[];
};

export type ReportOrderingFieldErrors = {
  asOfDate?: string;
  reportingCurrency?: string;
  configurationValues: Record<string, string>;
};

export type ReportRequestRow = {
  key: string;
  reportLabel: string;
  reportDate: string;
  requestedAt: string;
  statusLabel: string;
  statusDetail: string;
  tone: "default" | "success" | "warn" | "danger";
  supportReference: string;
};

export function isAdvisorCommentarySection(section: ReportSection): boolean {
  return (
    section.sectionId === "ADVISOR_COMMENTARY" &&
    section.dependencyFieldIds.length === 1 &&
    section.dependencyFieldIds[0] === "advisor_brief_run_id"
  );
}

export function createReportOrderingConfiguration(
  response: ReportOrderingResponse,
  context: ReportOrderingSourceContext,
): ReportOrderingConfiguration {
  const family = firstEligibleFamily(response);
  const mode = family ? firstSupportedMode(family) : null;
  const outputFormat = resolveReadyOutputFormat(family, mode);

  return {
    familyId: family?.reportFamilyId ?? "",
    modeId: mode?.modeId ?? "",
    asOfDate: context.asOfDate,
    reportingCurrency: context.reportingCurrency,
    allocationDimensions: [],
    configurationValues: family ? defaultConfigurationValues(family) : {},
    selectedSections: family ? defaultSelectedSectionIds(family) : [],
    outputFormat,
  };
}

export function selectReportOrderingFamily(
  response: ReportOrderingResponse,
  current: ReportOrderingConfiguration,
  familyId: string,
  sectionAvailabilityEvidence: ReportSectionAvailabilityEvidence = "current",
): ReportOrderingConfiguration {
  const family = response.reportFamilies.find(
    (candidate) =>
      candidate.reportFamilyId === familyId &&
      candidate.eligibility.state === "ready" &&
      firstSupportedMode(candidate),
  );
  const mode = family ? firstSupportedMode(family) : null;
  if (!family || !mode) {
    return current;
  }

  const next = {
    ...current,
    familyId: family.reportFamilyId,
    modeId: mode.modeId,
    allocationDimensions: [],
    configurationValues: defaultConfigurationValues(family),
    selectedSections: defaultSelectedSectionIds(family),
    outputFormat: resolveReadyOutputFormat(family, mode),
  };
  return sectionAvailabilityEvidence === "current"
    ? next
    : clearContextBoundReportSections(family, next);
}

export function buildReportOrderingViewModel(
  response: ReportOrderingResponse,
  configuration: ReportOrderingConfiguration,
  sourceContext: ReportOrderingSourceContext,
  sectionAvailabilityEvidence: ReportSectionAvailabilityEvidence = "current",
): ReportOrderingViewModel {
  const eligibleFamilies = response.reportFamilies.filter(
    (family) =>
      family.eligibility.state === "ready" && firstSupportedMode(family),
  );
  const workflowManagedFamilies = response.reportFamilies.filter(
    (family) =>
      family.eligibility.state === "ready" && !firstSupportedMode(family),
  );
  const family =
    eligibleFamilies.find(
      (candidate) => candidate.reportFamilyId === configuration.familyId,
    ) ?? null;
  const mode =
    family?.orderingModes.find(
      (candidate) => candidate.modeId === configuration.modeId,
    ) ?? null;
  const readiness = evaluateReadiness(
    response,
    family,
    findSinglePortfolioMode(family),
    configuration,
    sourceContext,
    "single_portfolio",
    sectionAvailabilityEvidence,
  );
  const batchReadiness = evaluateReadiness(
    response,
    family,
    findPortfolioReviewBatchMode(family),
    configuration,
    sourceContext,
    "explicit_portfolio_batch",
    sectionAvailabilityEvidence,
  );
  const sectionChoices = family
    ? family.sections
        .slice()
        .sort(byDisplayOrder)
        .map((section) =>
          toSectionChoice(
            section,
            family,
            configuration,
            sectionAvailabilityEvidence,
          ),
        )
    : [];
  const fieldErrors = reportOrderingFieldErrors(
    family,
    configuration,
    sourceContext,
  );
  const formIssues = [
    fieldErrors.asOfDate,
    fieldErrors.reportingCurrency,
    ...Object.values(fieldErrors.configurationValues),
  ].filter((issue): issue is string => Boolean(issue));

  return {
    family,
    mode,
    configuration,
    readiness,
    batchReadiness,
    eligibleFamilies,
    workflowManagedFamilies,
    outputChoices: (family?.outputFormats ?? []).map(toOutputChoice),
    sectionChoices,
    audienceLabel: family
      ? audienceLabel(family.audienceRoles)
      : "No eligible audience",
    clientReleaseLabel: family
      ? clientReleaseLabel(family.clientReleasePosture)
      : "Client release posture is unavailable.",
    sourceContext,
    canSubmit: readiness.state === "ready",
    canReview:
      readiness.state === "ready" ||
      (readiness.issues.length > 0 &&
        readiness.issues.every((issue) => formIssues.includes(issue))),
    formIssues,
  };
}

export function applyReportScopeReadiness(
  model: ReportOrderingViewModel,
  scopeMode: ReportOrderingScopeMode,
  selectedPortfolioIds: string[],
  portfolioSelectionState: "loading" | "ready" | "error" = "ready",
): ReportOrderingViewModel {
  if (scopeMode === "single_portfolio") {
    return model;
  }
  const sectionChoices = model.sectionChoices.map((section) =>
    section.acceptedBrief || section.availabilityLabel
      ? {
          ...section,
          selected: false,
          selectable: false,
          availabilityLabel: "Single portfolio only",
          availabilityDetail:
            "Prepare reviewed commentary separately for each portfolio before including it in a report.",
          recovery: null,
          acceptedBrief: null,
        }
      : section,
  );
  const issues = [...model.batchReadiness.issues];
  if (portfolioSelectionState !== "ready") {
    issues.push(
      portfolioSelectionState === "error"
        ? "Portfolio assignments are unavailable. Restore My book before reviewing this bundle."
        : "Portfolio assignments are still loading.",
    );
  }
  if (selectedPortfolioIds.length < 2) {
    issues.push(
      "Select at least two portfolios from your book for a portfolio bundle.",
    );
  }
  if (issues.length === 0) {
    return {
      ...model,
      sectionChoices,
      readiness: {
        state: "ready",
        title: "Bundle ready for review",
        detail: `${selectedPortfolioIds.length} portfolios will be verified by Gateway before report creation.`,
        issues: [],
      },
      canSubmit: true,
      canReview: true,
    };
  }
  return {
    ...model,
    sectionChoices,
    readiness: {
      state: "blocked",
      title: "Complete the portfolio bundle",
      detail:
        "Resolve the highlighted items before reviewing this report bundle.",
      issues: [...new Set(issues)],
    },
    canSubmit: false,
    canReview:
      issues.length > 0 &&
      issues.every((issue) => model.formIssues.includes(issue)),
  };
}

export function findPortfolioReviewBatchMode(
  family: ReportFamily | null,
): ReportOrderingMode | null {
  return (
    family?.orderingModes.find(
      (mode) =>
        mode.modeId === "explicit_portfolio_batch" &&
        mode.interactive &&
        mode.eligibility.state === "partial" &&
        mode.eligibility.reasonCode ===
          "explicit_portfolio_selection_required" &&
        mode.submission?.capabilityId ===
          "reporting.portfolio_review.explicit_batch" &&
        mode.submission.path === "/api/v1/report-batches" &&
        mode.submission.state === "partial" &&
        mode.submission.reasonCode === "explicit_portfolio_selection_required",
    ) ?? null
  );
}

export function configurationFingerprint(
  configuration: ReportOrderingConfiguration,
): string {
  return JSON.stringify({
    ...configuration,
    allocationDimensions: [...configuration.allocationDimensions].sort(),
    configurationValues: Object.fromEntries(
      Object.entries(configuration.configurationValues).sort(
        ([left], [right]) => left.localeCompare(right),
      ),
    ),
    selectedSections: [...configuration.selectedSections].sort(),
  });
}

export function selectedReportConfigurationValues(
  family: ReportFamily | null,
  configuration: ReportOrderingConfiguration,
): Record<string, string> {
  if (!family) return {};

  return Object.fromEntries(
    family.configurationFields.flatMap((field) => {
      if (field.inputType !== "text") return [];
      const value = configuration.configurationValues[field.fieldId]?.trim();
      if (!value) return [];
      const isRelevant =
        field.requirement !== "conditional" ||
        family.sections.some(
          (section) =>
            configuration.selectedSections.includes(section.sectionId) &&
            section.dependencyFieldIds.includes(field.fieldId),
        );
      return isRelevant ? [[field.fieldId, value] as const] : [];
    }),
  );
}

export function clearContextBoundReportSections(
  family: ReportFamily | null,
  configuration: ReportOrderingConfiguration,
): ReportOrderingConfiguration {
  const contextBoundSections = new Set(
    (family?.sections ?? [])
      .filter(isAdvisorCommentarySection)
      .map((section) => section.sectionId),
  );
  const contextBoundFields = new Set(
    (family?.sections ?? [])
      .filter((section) => contextBoundSections.has(section.sectionId))
      .flatMap((section) => section.dependencyFieldIds),
  );
  return {
    ...configuration,
    selectedSections: configuration.selectedSections.filter(
      (sectionId) => !contextBoundSections.has(sectionId),
    ),
    configurationValues: Object.fromEntries(
      Object.entries(configuration.configurationValues).map(
        ([fieldId, value]) => [
          fieldId,
          contextBoundFields.has(fieldId) ? "" : value,
        ],
      ),
    ),
  };
}

export function reconcileReportSectionAvailability(
  response: ReportOrderingResponse,
  configuration: ReportOrderingConfiguration,
): ReportOrderingConfiguration {
  const family = response.reportFamilies.find(
    (candidate) => candidate.reportFamilyId === configuration.familyId,
  );
  if (!family) return configuration;

  const previouslySelectedSections = new Set(configuration.selectedSections);
  const next = clearContextBoundReportSections(family, configuration);
  for (const section of family.sections) {
    if (
      section.availability?.state !== "ready" ||
      !section.availability.acceptedBrief
    ) {
      continue;
    }
    for (const fieldId of section.dependencyFieldIds) {
      next.configurationValues[fieldId] =
        section.availability.acceptedBrief.runId;
    }
    if (previouslySelectedSections.has(section.sectionId)) {
      next.selectedSections.push(section.sectionId);
    }
  }
  return next;
}

export function reportOrderingFieldErrors(
  family: ReportFamily | null,
  configuration: Pick<
    ReportOrderingConfiguration,
    | "asOfDate"
    | "reportingCurrency"
    | "configurationValues"
    | "selectedSections"
  >,
  sourceContext: ReportOrderingSourceContext,
): ReportOrderingFieldErrors {
  const errors: ReportOrderingFieldErrors = { configurationValues: {} };
  if (!isBusinessDateValue(configuration.asOfDate)) {
    errors.asOfDate = "Select a valid report date.";
  } else if (
    configuration.asOfDate < sourceContext.earliestReportDate ||
    configuration.asOfDate > sourceContext.latestReportDate
  ) {
    errors.asOfDate = `Select a report date from ${formatBusinessDateValue(sourceContext.earliestReportDate)} to ${formatBusinessDateValue(sourceContext.latestReportDate)}.`;
  }

  if (
    family?.configurationFields.some(
      (field) => field.fieldId === "reporting_currency",
    ) &&
    !sourceContext.reportingCurrencies.includes(configuration.reportingCurrency)
  ) {
    errors.reportingCurrency =
      "Select a reporting currency confirmed for this portfolio.";
  }

  for (const field of family?.configurationFields ?? []) {
    if (field.inputType !== "text") continue;
    const dependentSections = (family?.sections ?? []).filter(
      (section) =>
        configuration.selectedSections.includes(section.sectionId) &&
        section.dependencyFieldIds.includes(field.fieldId),
    );
    const required =
      field.requirement === "required" ||
      (field.requirement === "conditional" && dependentSections.length > 0);
    if (required && !configuration.configurationValues[field.fieldId]?.trim()) {
      const dependency = dependentSections
        .map((section) => section.businessLabel)
        .join(" and ");
      errors.configurationValues[field.fieldId] = dependency
        ? `${field.businessLabel} is required when ${dependency} is included.`
        : `${field.businessLabel} is required.`;
    }
  }
  return errors;
}

export function toReportRequestRows(
  items: ReportJobListItem[],
): ReportRequestRow[] {
  return items.map((item) => {
    const lifecycle = reportLifecycleCopy(
      item.status,
      item.currentStep,
      item.failureCategory,
    );
    return {
      key: item.reportJobId,
      reportLabel: "Portfolio review",
      reportDate: formatBusinessDateValue(item.asOfDate, {
        nullDisplay: "Date unavailable",
      }),
      requestedAt: formatTimestampValue(item.createdAt, {
        nullDisplay: "Time unavailable",
      }),
      statusLabel: lifecycle.label,
      statusDetail: lifecycle.detail,
      tone: lifecycle.tone,
      supportReference: item.reportJobId,
    };
  });
}

function evaluateReadiness(
  response: ReportOrderingResponse,
  family: ReportFamily | null,
  mode: ReportOrderingMode | null,
  configuration: ReportOrderingConfiguration,
  sourceContext: ReportOrderingSourceContext,
  scopeMode: ReportOrderingScopeMode,
  sectionAvailabilityEvidence: ReportSectionAvailabilityEvidence,
): ReportOrderingReadiness {
  const issues: string[] = [];
  if (response.catalogueAvailability.state === "unavailable") {
    issues.push(response.catalogueAvailability.message);
  }
  if (response.scopeEligibility.state !== "ready") {
    issues.push(response.scopeEligibility.message);
  }
  if (!family) {
    issues.push(
      "No report is available for the selected portfolio and business role.",
    );
  } else if (family.availability.state === "unavailable") {
    issues.push(family.availability.message);
  }
  if (scopeMode === "single_portfolio") {
    if (!mode) {
      issues.push(
        "Single-portfolio ordering is not currently available for this report.",
      );
    }
  } else if (!mode) {
    issues.push(
      "Portfolio bundle ordering is not currently published for this report.",
    );
  }
  const fieldErrors = reportOrderingFieldErrors(
    family,
    configuration,
    sourceContext,
  );
  issues.push(
    ...[fieldErrors.asOfDate, fieldErrors.reportingCurrency].filter(
      (issue): issue is string => Boolean(issue),
    ),
    ...Object.values(fieldErrors.configurationValues),
  );

  const output = family?.outputFormats.find(
    (candidate) => candidate.formatId === configuration.outputFormat,
  );
  if (!output || output.state !== "ready") {
    issues.push("Select an output that is currently available.");
  }

  for (const section of family?.sections ?? []) {
    if (
      section.selectionPosture === "required" &&
      !configuration.selectedSections.includes(section.sectionId)
    ) {
      issues.push(`${section.businessLabel} is required.`);
    }
    if (
      isAdvisorCommentarySection(section) &&
      configuration.selectedSections.includes(section.sectionId) &&
      (sectionAvailabilityEvidence !== "current" ||
        section.availability?.state !== "ready" ||
        !section.availability.acceptedBrief)
    ) {
      issues.push(
        "Confirm reviewed commentary for the current report date and currency, or remove it from this request.",
      );
    }
  }
  if (
    (family?.sections ?? []).length > 0 &&
    configuration.selectedSections.length === 0
  ) {
    issues.push("Select at least one report section.");
  }

  const uniqueIssues = [...new Set(issues)];
  if (uniqueIssues.length > 0) {
    return {
      state: "blocked",
      title: "Complete the report setup",
      detail:
        "Resolve the highlighted items before submitting this report request.",
      issues: uniqueIssues,
    };
  }
  if (
    response.catalogueAvailability.state === "partial" ||
    family?.availability.state === "partial"
  ) {
    return {
      state: "ready",
      title: "Ready with available outputs",
      detail:
        "The report data package is ready. Unavailable document outputs remain excluded.",
      issues: [],
    };
  }
  return {
    state: "ready",
    title: "Ready to request",
    detail:
      "The selected report and configuration are available for this portfolio.",
    issues: [],
  };
}

function firstEligibleFamily(
  response: ReportOrderingResponse,
): ReportFamily | null {
  return (
    response.reportFamilies.find(
      (family) =>
        family.eligibility.state === "ready" && firstSupportedMode(family),
    ) ?? null
  );
}

function defaultSelectedSectionIds(family: ReportFamily): string[] {
  return family.sections
    .filter(
      (section) =>
        (!isAdvisorCommentarySection(section) ||
          (section.availability?.state === "ready" &&
            Boolean(section.availability.acceptedBrief))) &&
        (section.selectionPosture === "required" || section.defaultSelected),
    )
    .sort(byDisplayOrder)
    .map((section) => section.sectionId);
}

function defaultConfigurationValues(
  family: ReportFamily,
): Record<string, string> {
  const values = Object.fromEntries(
    family.configurationFields
      .filter((field) => field.inputType === "text")
      .map((field) => [field.fieldId, ""]),
  );
  for (const section of family.sections) {
    if (
      section.availability?.state !== "ready" ||
      !section.availability.acceptedBrief
    ) {
      continue;
    }
    for (const fieldId of section.dependencyFieldIds) {
      values[fieldId] = section.availability.acceptedBrief.runId;
    }
  }
  return values;
}

function findSinglePortfolioMode(
  family: ReportFamily | null,
): ReportOrderingMode | null {
  return (
    family?.orderingModes.find(
      (mode) =>
        mode.modeId === "single_portfolio" &&
        mode.interactive &&
        mode.eligibility.state === "ready" &&
        mode.submission?.capabilityId === "reporting.portfolio_review.single" &&
        mode.submission.path === "/api/v1/reports/portfolio-reviews" &&
        mode.submission.state === "ready",
    ) ?? null
  );
}

function firstSupportedMode(family: ReportFamily): ReportOrderingMode | null {
  return (
    findSinglePortfolioMode(family) ?? findPortfolioReviewBatchMode(family)
  );
}

function resolveReadyOutputFormat(
  family: ReportFamily | null,
  mode: ReportOrderingMode | null,
): "json" | "pdf" {
  const preferred = family?.outputFormats.find(
    (format) =>
      format.formatId === mode?.defaultOutputFormat && format.state === "ready",
  );
  return (
    preferred?.formatId ??
    family?.outputFormats.find((format) => format.state === "ready")
      ?.formatId ??
    "json"
  );
}

function toOutputChoice(output: ReportOutputFormat) {
  return {
    id: output.formatId,
    label: output.businessLabel,
    detail:
      output.usePosture === "governed_document"
        ? "Governed document for advisor review. Client distribution is a separate control."
        : "Structured report data for review and downstream workflows.",
    available: output.state === "ready",
    supportReason: outputAvailabilityCopy(output),
  };
}

function outputAvailabilityCopy(output: ReportOutputFormat): string {
  if (output.state === "ready") {
    return output.formatId === "json"
      ? "Report data is available."
      : "Governed document creation is available.";
  }
  if (output.reasonCode === "render_metadata_unavailable") {
    return "Governed PDF creation is temporarily unavailable while document rendering is restored.";
  }
  return output.state === "partial"
    ? "This output is available with limitations."
    : "This output is not currently available.";
}

function toSectionChoice(
  section: ReportSection,
  family: ReportFamily,
  configuration: ReportOrderingConfiguration,
  evidence: ReportSectionAvailabilityEvidence,
) {
  const fieldsById = new Map(
    family.configurationFields.map((field) => [
      field.fieldId,
      field.businessLabel,
    ]),
  );
  const availability = toSectionAvailability(section, evidence);
  return {
    id: section.sectionId,
    label: section.businessLabel,
    detail: section.description,
    required: section.selectionPosture === "required",
    selected:
      availability.selectable &&
      configuration.selectedSections.includes(section.sectionId),
    selectable: availability.selectable,
    dependencyLabels: section.dependencyFieldIds.map(
      (fieldId) => fieldsById.get(fieldId) ?? "Additional report context",
    ),
    availabilityLabel: availability.label,
    availabilityDetail: availability.detail,
    recovery: availability.recovery,
    acceptedBrief: availability.acceptedBrief,
  };
}

function toSectionAvailability(
  section: ReportSection,
  evidence: ReportSectionAvailabilityEvidence,
) {
  if (section.availability == null) {
    if (isAdvisorCommentarySection(section)) {
      return {
        selectable: false,
        label: "Availability not evaluated",
        detail:
          "Reporting did not evaluate reviewed commentary for this report context.",
        recovery: "refresh",
        acceptedBrief: null,
      } as const;
    }
    return {
      selectable: true,
      label: null,
      detail: null,
      recovery: null,
      acceptedBrief: null,
    } as const;
  }
  if (evidence === "checking") {
    return {
      selectable: false,
      label: "Checking accepted brief",
      detail:
        "Checking whether reviewed commentary matches this report date and currency.",
      recovery: null,
      acceptedBrief: null,
    } as const;
  }
  if (evidence === "unavailable") {
    return {
      selectable: false,
      label: "Availability not confirmed",
      detail:
        "Reviewed commentary availability could not be confirmed for this report context.",
      recovery: "refresh",
      acceptedBrief: null,
    } as const;
  }
  if (
    section.availability?.state === "ready" &&
    section.availability.acceptedBrief
  ) {
    return {
      selectable: true,
      label: "Accepted brief ready",
      detail: "Accepted commentary matches this report date and currency.",
      recovery: null,
      acceptedBrief: section.availability.acceptedBrief,
    } as const;
  }
  if (section.availability?.reasonCode === "advisor_brief_not_reviewed") {
    return {
      selectable: false,
      label: "Review required",
      detail: "Review and accept an Advisor Brief before including commentary.",
      recovery: "advisor_brief",
      acceptedBrief: null,
    } as const;
  }
  if (section.availability?.reasonCode === "advisor_brief_context_mismatch") {
    return {
      selectable: false,
      label: "Different report context",
      detail:
        "The accepted Advisor Brief does not match this report date and currency.",
      recovery: "advisor_brief",
      acceptedBrief: null,
    } as const;
  }
  return {
    selectable: false,
    label: "Availability not confirmed",
    detail: "Reviewed commentary availability cannot be determined right now.",
    recovery: "refresh",
    acceptedBrief: null,
  } as const;
}

function audienceLabel(roles: string[]): string {
  const labels = roles.map((role) => {
    if (role === "client_advisor") return "Client advisor";
    if (role === "portfolio_manager") return "Portfolio manager";
    if (role === "investment_control") return "Investment control";
    if (role === "audit") return "Audit";
    return "Authorized internal user";
  });
  return [...new Set(labels)].join(" · ");
}

function clientReleaseLabel(
  posture: ReportFamily["clientReleasePosture"],
): string {
  return posture === "advisor_review_required_distribution_not_supported"
    ? "Advisor review is required. Client distribution is not included in this request."
    : "For internal control use only. Client distribution is not supported.";
}

function reportLifecycleCopy(
  status: string | null | undefined,
  currentStep: string | null | undefined,
  failureCategory: string | null,
) {
  const normalized = normalizeReportJobLifecycleValue(status);
  const normalizedStep = normalizeReportJobLifecycleValue(currentStep);
  if (!normalized || !normalizedStep) {
    return {
      label: "Status not reported",
      detail:
        "Reporting returned a lifecycle state that this screen cannot safely interpret.",
      tone: "default" as const,
    };
  }
  if (normalized === "completed" || normalized === "data_ready") {
    return {
      label: "Report data complete",
      detail:
        "Report data is complete. Archive and client delivery remain separate states.",
      tone: "success" as const,
    };
  }
  if (normalized === "archived") {
    return {
      label: "Archived",
      detail:
        "The report is held in the document archive. Client delivery remains separate.",
      tone: "success" as const,
    };
  }
  if (normalized === "failed") {
    return reportFailureLifecycleCopy(failureCategory);
  }
  if (normalized === "cancelled") {
    return {
      label: "Request cancelled",
      detail: "This request was cancelled before completion.",
      tone: "default" as const,
    };
  }
  if (normalized === "completed_with_warnings") {
    return {
      label: "Completed with attention items",
      detail:
        "Some report evidence needs review before the result can be used.",
      tone: "warn" as const,
    };
  }
  if (normalized === "accepted" || normalized === "queued") {
    return {
      label: "Queued",
      detail: "The request is recorded and waiting to be prepared.",
      tone: "warn" as const,
    };
  }
  if (normalized === "archiving") {
    return {
      label: "Archiving report",
      detail:
        "Report data is complete and the archive record is being prepared.",
      tone: "warn" as const,
    };
  }
  return {
    label: "Preparing report data",
    detail: "Reporting is preparing the selected evidence and sections.",
    tone: "warn" as const,
  };
}

function reportFailureLifecycleCopy(failureCategory: string | null) {
  if (failureCategory === "data_incomplete") {
    return {
      label: "Request failed",
      detail:
        "Report data could not be completed from its sources; the request was not resumed.",
      tone: "danger" as const,
    };
  }
  if (failureCategory === "upstream_data_failed") {
    return {
      label: "Request failed",
      detail:
        "Required source evidence was unavailable. Reporting may permit an operational retry.",
      tone: "danger" as const,
    };
  }
  if (failureCategory === "timeout") {
    return {
      label: "Request failed",
      detail: "Report preparation did not complete within the allowed time.",
      tone: "danger" as const,
    };
  }
  if (
    failureCategory === "render_validation_failed" ||
    failureCategory === "render_conflict"
  ) {
    return {
      label: "Request failed",
      detail:
        "The requested document could not be created from the completed report data.",
      tone: "danger" as const,
    };
  }
  if (
    failureCategory === "archive_storage_failed" ||
    failureCategory === "archive_execution_failed"
  ) {
    return {
      label: "Request failed",
      detail: "The report could not be placed in the document archive.",
      tone: "danger" as const,
    };
  }
  if (failureCategory) {
    return {
      label: "Request failed",
      detail:
        "Reporting recorded a failure that requires operational review before any retry.",
      tone: "danger" as const,
    };
  }
  return {
    label: "Request failed",
    detail:
      "The report request failed without a confirmed reason. Use the support reference for review.",
    tone: "danger" as const,
  };
}

function byDisplayOrder(left: ReportSection, right: ReportSection): number {
  return left.displayOrder - right.displayOrder;
}
