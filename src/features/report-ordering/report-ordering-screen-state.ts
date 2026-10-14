import type { ReportOrderingViewModel } from "./view-model";

export type ReportOrderingCatalogueState =
  | "loading"
  | "ready"
  | "permission_blocked"
  | "error";

export type ReportOrderingSubmissionState = "idle" | "submitting" | "accepted" | "error";

export type ReportOrderingWorkspaceState =
  | {
      kind: "configuration";
      model: ReportOrderingViewModel;
    }
  | {
      kind: "accepted";
      model: ReportOrderingViewModel | null;
    }
  | {
      kind: "loading" | "permission_blocked" | "error" | "empty";
      title: string;
      body: string;
      actionLabel: string | null;
    };

type ReportOrderingBaseWorkspaceState = Exclude<
  ReportOrderingWorkspaceState,
  { kind: "accepted" }
>;

export type ReportOrderingReadinessState = {
  kind:
    | "loading"
    | "restricted"
    | "unavailable"
    | "empty"
    | "setup_required"
    | "ready_for_review"
    | "reviewed"
    | "submitting"
    | "accepted"
    | "not_accepted";
  badgeLabel: string;
  tone: "default" | "success" | "warn" | "danger";
  title: string;
  detail: string;
  clientReleaseTitle: string;
  clientReleaseDetail: string;
  busy: boolean;
  showRequestSummary: boolean;
  showActions: boolean;
  showValidationSummary: boolean;
  requestModel?: ReportOrderingViewModel | null;
  canStartAnother?: boolean;
  catalogueNotice?: Exclude<
    ReportOrderingWorkspaceState,
    { kind: "configuration" | "accepted" }
  >;
};

export type ReportOrderingScreenState = {
  workspace: ReportOrderingWorkspaceState;
  readiness: ReportOrderingReadinessState;
};

export function buildReportOrderingScreenState({
  catalogueState,
  catalogueError,
  model,
  submissionModel,
  preflightReviewed,
  submissionState,
  submissionError,
}: {
  catalogueState: ReportOrderingCatalogueState;
  catalogueError: string | null;
  model: ReportOrderingViewModel | null;
  submissionModel?: ReportOrderingViewModel | null;
  preflightReviewed: boolean;
  submissionState: ReportOrderingSubmissionState;
  submissionError: string | null;
}): ReportOrderingScreenState {
  const baseWorkspace = buildWorkspaceState(catalogueState, catalogueError, model);
  if (submissionState === "submitting" || submissionState === "accepted") {
    const requestModel = submissionModel ?? null;
    return {
      workspace:
        submissionState === "accepted"
          ? { kind: "accepted", model: requestModel }
          : requestModel
            ? { kind: "configuration", model: requestModel }
            : baseWorkspace,
      readiness: {
        kind: submissionState,
        badgeLabel: submissionState === "accepted" ? "Accepted" : "Submitting",
        tone: submissionState === "accepted" ? "success" : "default",
        title:
          submissionState === "accepted"
            ? "Report request accepted"
            : "Submitting report request",
        detail:
          submissionState === "accepted"
            ? "Reporting recorded the request. Report data, archive, and client delivery remain separate."
            : "The reviewed request is being sent to Reporting.",
        clientReleaseTitle: "Review before any client use",
        clientReleaseDetail: "Request acceptance does not authorize client use.",
        busy: submissionState === "submitting",
        showRequestSummary: Boolean(requestModel),
        showActions: submissionState === "submitting",
        showValidationSummary: false,
        requestModel,
        canStartAnother:
          submissionState === "accepted" &&
          baseWorkspace.kind === "configuration" &&
          baseWorkspace.model.eligibleFamilies.length > 0,
        ...(baseWorkspace.kind === "configuration"
          ? {}
          : { catalogueNotice: baseWorkspace }),
      },
    };
  }
  if (baseWorkspace.kind !== "configuration") {
    return {
      workspace: baseWorkspace,
      readiness: terminalReadinessState(baseWorkspace),
    };
  }

  return {
    workspace: baseWorkspace,
    readiness: configuredReadinessState({
      model: baseWorkspace.model,
      preflightReviewed,
      submissionState,
      submissionError,
    }),
  };
}

function buildWorkspaceState(
  catalogueState: ReportOrderingCatalogueState,
  catalogueError: string | null,
  model: ReportOrderingViewModel | null,
): ReportOrderingBaseWorkspaceState {
  if (catalogueState === "loading") {
    return {
      kind: "loading",
      title: "Loading approved reports",
      body: "Checking portfolio access, available report families, and current output readiness.",
      actionLabel: null,
    };
  }
  if (
    catalogueState === "permission_blocked" ||
    model?.scopeEligibility.state === "permission_blocked"
  ) {
    return {
      kind: "permission_blocked",
      title: "Report ordering is restricted",
      body:
        catalogueError ?? "This portfolio is not available for report ordering.",
      actionLabel: "Check Again",
    };
  }
  if (
    catalogueState === "error" ||
    model?.catalogueAvailability.state === "unavailable" ||
    model?.scopeEligibility.state === "unavailable" ||
    model?.scopeEligibility.state === "unsupported"
  ) {
    return {
      kind: "error",
      title: "Approved reports are unavailable",
      body: catalogueError ?? "Reporting choices could not be loaded.",
      actionLabel: "Try Again",
    };
  }
  if (
    !model ||
    (model.eligibleFamilies.length === 0 &&
      model.workflowManagedFamilies.length === 0 &&
      model.nonOrderableFamilies.length === 0)
  ) {
    return {
      kind: "empty",
      title: "No approved reports available",
      body: "No report family is currently available for this portfolio and business role.",
      actionLabel: null,
    };
  }
  return { kind: "configuration", model };
}

function terminalReadinessState(
  workspace: Exclude<
    ReportOrderingWorkspaceState,
    { kind: "configuration" | "accepted" }
  >,
): ReportOrderingReadinessState {
  const common = {
    busy: workspace.kind === "loading",
    showRequestSummary: false,
    showActions: false,
    showValidationSummary: false,
  };
  if (workspace.kind === "loading") {
    return {
      ...common,
      kind: "loading",
      badgeLabel: "Loading",
      tone: "default",
      title: "Checking report availability",
      detail: "Approved report choices and portfolio access are being checked.",
      clientReleaseTitle: "Client release not yet assessed",
      clientReleaseDetail: "Client-use controls will be shown when report availability is known.",
    };
  }
  if (workspace.kind === "permission_blocked") {
    return {
      ...common,
      kind: "restricted",
      badgeLabel: "Restricted",
      tone: "warn",
      title: "Report ordering restricted",
      detail: "Portfolio access or the current business role does not permit report ordering.",
      clientReleaseTitle: "Client use is restricted",
      clientReleaseDetail: "No report can be prepared for client review until access is confirmed.",
    };
  }
  if (workspace.kind === "error") {
    return {
      ...common,
      kind: "unavailable",
      badgeLabel: "Unavailable",
      tone: "danger",
      title: "Report ordering unavailable",
      detail: "Approved report choices could not be confirmed. Retry before preparing a request.",
      clientReleaseTitle: "Client release unavailable",
      clientReleaseDetail: "No report can be prepared for client review while choices are unavailable.",
    };
  }
  return {
    ...common,
    kind: "empty",
    badgeLabel: "No approved reports",
    tone: "default",
    title: "No approved reports available",
    detail: "There is no report available to configure for this portfolio and business role.",
    clientReleaseTitle: "No report available for client review",
    clientReleaseDetail: "Client review can begin when Reporting makes an approved report available.",
  };
}

function configuredReadinessState({
  model,
  preflightReviewed,
  submissionState,
  submissionError,
}: {
  model: ReportOrderingViewModel;
  preflightReviewed: boolean;
  submissionState: Exclude<ReportOrderingSubmissionState, "submitting" | "accepted">;
  submissionError: string | null;
}): ReportOrderingReadinessState {
  const common = {
    clientReleaseTitle: "Review before any client use",
    clientReleaseDetail: model.clientReleaseLabel,
    busy: false,
    showRequestSummary: true,
    showActions: true,
    showValidationSummary: false,
  };
  if (model.eligibleFamilies.length === 0 && model.nonOrderableFamilies.length > 0) {
    return {
      ...common,
      kind: "setup_required",
      badgeLabel: "Not orderable here",
      tone: "warn",
      title: "Report creation is not available here",
      detail: "Reporting publishes these report details without a supported ordering action in Report centre.",
      showRequestSummary: false,
      showActions: false,
    };
  }
  if (submissionState === "error") {
    return {
      ...common,
      kind: "not_accepted",
      badgeLabel: "Not accepted",
      tone: "danger",
      title: "Report request not accepted",
      detail:
        submissionError ??
        "The reviewed request was not accepted. Confirm the current setup before retrying.",
    };
  }
  if (model.readiness.state !== "ready") {
    return {
      ...common,
      kind: "setup_required",
      badgeLabel: "Setup required",
      tone: "warn",
      title: model.readiness.title,
      detail: model.readiness.detail,
      showValidationSummary: true,
    };
  }
  if (preflightReviewed) {
    return {
      ...common,
      kind: "reviewed",
      badgeLabel: "Reviewed",
      tone: "success",
      title: "Ready to submit",
      detail: "The current report setup has been reviewed and is ready for submission.",
    };
  }
  return {
    ...common,
    kind: "ready_for_review",
    badgeLabel: "Ready for review",
    tone: "default",
    title: model.readiness.title,
    detail: model.readiness.detail,
  };
}
