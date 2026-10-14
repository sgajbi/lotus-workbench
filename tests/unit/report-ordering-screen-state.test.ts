import { describe, expect, it } from "vitest";

import { buildReportOrderingScreenState } from "@/features/report-ordering/report-ordering-screen-state";
import {
  buildReportOrderingViewModel,
  createReportOrderingConfiguration,
} from "@/features/report-ordering/view-model";
import { parseReportOrderingResponse } from "@/features/report-ordering/contracts";
import { buildReportOrderingResponse } from "../fixtures/report-ordering-fixtures";

const sourceContext = {
  asOfDate: "2026-04-22",
  reportingCurrency: "SGD",
  earliestReportDate: "2025-01-06",
  latestReportDate: "2026-04-22",
  reportingCurrencies: ["SGD", "USD"],
};

function readyModel() {
  const response = parseReportOrderingResponse(buildReportOrderingResponse());
  return buildReportOrderingViewModel(
    response,
    createReportOrderingConfiguration(response, sourceContext),
    sourceContext,
  );
}

describe("report ordering screen state", () => {
  it.each((["submitting", "accepted"] as const).flatMap((submissionState) =>
    (["loading", "unavailable", "empty", "permission", "transport"] as const).map((sourceState) => ({ submissionState, sourceState })),
  ))("preserves $submissionState lifecycle with $sourceState catalogue independently", ({ submissionState, sourceState }) => {
    const originalModel = readyModel();
    originalModel.configuration.asOfDate = "2026-04-21";
    const payload = buildReportOrderingResponse();
    payload.reportFamilies = [];
    if (sourceState === "unavailable") payload.catalogueAvailability.state = "unavailable";
    if (sourceState === "permission") payload.scopeEligibility.state = "permission_blocked";
    const response = parseReportOrderingResponse(payload);
    const currentModel = buildReportOrderingViewModel(response, createReportOrderingConfiguration(response, sourceContext), sourceContext);
    const state = buildReportOrderingScreenState({
      catalogueState: sourceState === "loading" ? "loading" : sourceState === "transport" ? "error" : "ready",
      catalogueError: null, model: sourceState === "transport" ? null : currentModel,
      submissionModel: originalModel, preflightReviewed: false, submissionState, submissionError: null,
    });
    expect(state.workspace.kind).toBe(submissionState === "accepted" ? "accepted" : "configuration");
    expect(state.readiness).toMatchObject({ kind: submissionState, busy: submissionState === "submitting", showActions: submissionState === "submitting", canStartAnother: false, requestModel: originalModel });
    expect(state.readiness.catalogueNotice).toBeDefined();
    expect(state.readiness.requestModel?.configuration.asOfDate).toBe("2026-04-21");
  });

  it("never reconstructs accepted request terms from a newly loaded catalogue", () => {
    const state = buildReportOrderingScreenState({ catalogueState: "ready", catalogueError: null, model: readyModel(), preflightReviewed: false, submissionState: "accepted", submissionError: null });
    expect(state.workspace).toEqual({ kind: "accepted", model: null });
    expect(state.readiness.showRequestSummary).toBe(false);
    expect(state.readiness.requestModel).toBeNull();
  });
  it.each([false, true])("prioritizes unavailable source over retained families=%s", (retainFamilies) => {
    const payload = buildReportOrderingResponse();
    payload.catalogueAvailability = {
      state: "unavailable",
      reasonCode: "report_catalogue_contract_invalid",
      message: "Report choices are temporarily unavailable.",
    };
    if (!retainFamilies) payload.reportFamilies = [];
    const response = parseReportOrderingResponse(payload);
    const model = buildReportOrderingViewModel(
      response, createReportOrderingConfiguration(response, sourceContext), sourceContext,
    );
    const state = buildReportOrderingScreenState({
      catalogueState: "ready", catalogueError: null, model,
      preflightReviewed: true, submissionState: "idle", submissionError: null,
    });
    expect(state.workspace).toEqual(expect.objectContaining({
      kind: "error", title: "Approved reports are unavailable",
      body: "Reporting choices could not be loaded.", actionLabel: "Try Again",
    }));
    expect(state.readiness.kind).toBe("unavailable");
    expect(state.readiness.showActions).toBe(false);
    expect(model.canSubmit).toBe(false);
    expect(model.canReview).toBe(false);
  });

  it.each([
    ["loading", "loading", "Loading"],
    ["permission_blocked", "restricted", "Restricted"],
    ["error", "unavailable", "Unavailable"],
  ] as const)(
    "maps %s catalogue state to one terminal %s readiness posture",
    (catalogueState, readinessKind, badgeLabel) => {
      const state = buildReportOrderingScreenState({
        catalogueState,
        catalogueError: null,
        model: null,
        preflightReviewed: false,
        submissionState: "idle",
        submissionError: null,
      });

      expect(state.workspace.kind).toBe(catalogueState);
      expect(state.readiness).toEqual(
        expect.objectContaining({
          kind: readinessKind,
          badgeLabel,
          showRequestSummary: false,
          showActions: false,
          showValidationSummary: false,
        }),
      );
    },
  );

  it("treats a ready catalogue without an orderable report as empty", () => {
    const payload = buildReportOrderingResponse();
    payload.catalogueAvailability.state = "ready";
    payload.reportFamilies = [];
    const response = parseReportOrderingResponse(payload);
    const model = buildReportOrderingViewModel(
      response,
      createReportOrderingConfiguration(response, sourceContext),
      sourceContext,
    );

    const state = buildReportOrderingScreenState({
      catalogueState: "ready",
      catalogueError: null,
      model,
      preflightReviewed: false,
      submissionState: "idle",
      submissionError: null,
    });

    expect(state.workspace.kind).toBe("empty");
    expect(state.readiness.kind).toBe("empty");
    expect(state.readiness.showActions).toBe(false);
    expect(state.readiness.showValidationSummary).toBe(false);
  });

  it.each([
    ["permission_blocked", "permission_blocked", "restricted"],
    ["unavailable", "error", "unavailable"],
    ["unsupported", "error", "unavailable"],
  ] as const)("keeps source scope %s distinct from empty", (scope, workspaceKind, readinessKind) => {
    const payload = buildReportOrderingResponse();
    payload.reportFamilies = [];
    payload.scopeEligibility.state = scope;
    payload.scopeEligibility.message = "Selected portfolio is not available for reporting.";
    const response = parseReportOrderingResponse(payload);
    const model = buildReportOrderingViewModel(
      response, createReportOrderingConfiguration(response, sourceContext), sourceContext,
    );
    const state = buildReportOrderingScreenState({
      catalogueState: "ready", catalogueError: null, model,
      preflightReviewed: false, submissionState: "idle", submissionError: null,
    });
    expect(state.workspace.kind).toBe(workspaceKind);
    expect(state.readiness.kind).toBe(readinessKind);
    expect(state.readiness.showActions).toBe(false);
    expect(model.canSubmit).toBe(false);
  });

  it.each(["ready", "partial"])("keeps %s usable catalogue configurable", (availability) => {
    const payload = buildReportOrderingResponse();
    payload.catalogueAvailability.state = availability;
    const response = parseReportOrderingResponse(payload);
    const model = buildReportOrderingViewModel(
      response, createReportOrderingConfiguration(response, sourceContext), sourceContext,
    );
    const state = buildReportOrderingScreenState({
      catalogueState: "ready", catalogueError: null, model,
      preflightReviewed: false, submissionState: "idle", submissionError: null,
    });
    expect(state.workspace.kind).toBe("configuration");
    expect(state.readiness.kind).toBe("ready_for_review");
    expect(model.outputChoices.find((output) => output.id === "pdf")?.available).toBe(false);
  });

  it.each([
    [false, "idle", "ready_for_review", "Ready for review"],
    [true, "idle", "reviewed", "Reviewed"],
    [true, "submitting", "submitting", "Submitting"],
    [true, "accepted", "accepted", "Accepted"],
    [true, "error", "not_accepted", "Not accepted"],
  ] as const)(
    "projects review=%s and submission=%s as %s",
    (preflightReviewed, submissionState, readinessKind, badgeLabel) => {
      const state = buildReportOrderingScreenState({
        catalogueState: "ready",
        catalogueError: null,
        model: readyModel(),
        preflightReviewed,
        submissionState,
        submissionError: submissionState === "error" ? "Request failed." : null,
      });

      expect(state.workspace.kind).toBe(
        submissionState === "accepted" ? "accepted" : "configuration",
      );
      expect(state.readiness).toEqual(
        expect.objectContaining({ kind: readinessKind, badgeLabel }),
      );
    },
  );

  it("shows validation guidance only for actionable setup-required states", () => {
    const setupRequiredModel = readyModel();
    setupRequiredModel.readiness.state = "blocked";
    setupRequiredModel.readiness.issues = ["Select a valid report date."];

    const state = buildReportOrderingScreenState({
      catalogueState: "ready",
      catalogueError: null,
      model: setupRequiredModel,
      preflightReviewed: false,
      submissionState: "idle",
      submissionError: null,
    });

    expect(state.workspace.kind).toBe("configuration");
    expect(state.readiness.kind).toBe("setup_required");
    expect(state.readiness.showActions).toBe(true);
    expect(state.readiness.showValidationSummary).toBe(true);
  });
});
