import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getReportOrderingOptions,
  listPortfolioReviewOrders,
  submitPortfolioReviewOrder,
  submitPortfolioReviewBatch,
  getPortfolioReviewBatchStatus,
} from "@/features/report-ordering/api";
import { parseReportOrderingResponse, parseReportBatchHandle, parseReportBatchStatus, type ReportOrderingResponse, type ReportJobHandle, type ReportBatchHandle } from "@/features/report-ordering/contracts";
import { useReportOrderingWorkflow as useReportOrderingWorkflowSource } from "@/features/report-ordering/use-report-ordering-workflow";
import type { ReportOrderingConfiguration } from "@/features/report-ordering/view-model";
import { WorkbenchApiError } from "@/features/workbench/api-client";
import {
  buildReportJobListResponse,
  buildReportOrderingResponse,
  buildCompositeReportOrderingResponse,
  buildReportBatchHandle,
  buildReportBatchStatus,
} from "../fixtures/report-ordering-fixtures";

vi.mock("@/features/report-ordering/api", () => ({
  getReportOrderingOptions: vi.fn(),
  listPortfolioReviewOrders: vi.fn(),
  submitPortfolioReviewOrder: vi.fn(),
  submitPortfolioReviewBatch: vi.fn(),
  getPortfolioReviewBatchStatus: vi.fn(),
}));

const optionsMock = vi.mocked(getReportOrderingOptions);
const historyMock = vi.mocked(listPortfolioReviewOrders);
const submitMock = vi.mocked(submitPortfolioReviewOrder);
const submitBatchMock = vi.mocked(submitPortfolioReviewBatch);
const batchStatusMock = vi.mocked(getPortfolioReviewBatchStatus);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}

function useReportOrderingWorkflow(
  options: Omit<
    Parameters<typeof useReportOrderingWorkflowSource>[0],
    | "sourceBaseCurrency"
    | "earliestReportDate"
    | "latestReportDate"
    | "reportingCurrencies"
  >,
) {
  return useReportOrderingWorkflowSource({
    ...options,
    sourceBaseCurrency: "SGD",
    earliestReportDate: "2025-01-06",
    latestReportDate: "2026-04-22",
    reportingCurrencies: ["SGD", "USD"],
  });
}

describe("useReportOrderingWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse(buildReportOrderingResponse()),
    );
    historyMock.mockResolvedValue(buildReportJobListResponse());
    submitMock.mockImplementation(({ idempotencyKey }) =>
      Promise.resolve({
        report_request_id: "rrq_2",
        report_job_id: "rjob_2",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_2",
        idempotency_key: idempotencyKey,
      }),
    );
    submitBatchMock.mockImplementation(async ({ idempotencyKey }) => parseReportBatchHandle({ ...buildReportBatchHandle(), idempotency_key: idempotencyKey }));
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(buildReportBatchStatus()));
  });

  it.each(["single_composite", "unknown_mode"])("refuses a stale or malicious %s mode before the actual submission boundary", async (modeId) => {
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    act(() => result.current.updateConfiguration({ modeId }));
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.model?.canSubmit).toBe(false);
    act(() => expect(result.current.reviewRequest()).toBe(false));
    await act(() => result.current.submitRequest());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it.each(["xlsx", "pinned field"])("refuses injected %s after review at the actual submission boundary", async (scenario) => {
    const { result } = renderHook(() => useReportOrderingWorkflow({ portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD" }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    act(() => result.current.updateConfiguration(scenario === "xlsx"
      ? { outputFormat: "xlsx" } as unknown as Partial<ReportOrderingConfiguration>
      : { configurationValues: { composite_selection: "invented-selection" } }));
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.model?.canSubmit).toBe(false);
    act(() => expect(result.current.reviewRequest()).toBe(false));
    await act(() => result.current.submitRequest());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("invalidates a reviewed portfolio request when refreshed publication contains only unsupported composite metadata", async () => {
    const { result } = renderHook(() => useReportOrderingWorkflow({ portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD" }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    optionsMock.mockResolvedValueOnce(parseReportOrderingResponse(buildCompositeReportOrderingResponse(true)));
    await act(() => result.current.refreshCatalogue());
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.model?.family).toBeNull();
    act(() => result.current.updateConfiguration({ familyId: "composite_review", modeId: "single_composite", configurationValues: { composite_selection: "invented-selection" } }));
    act(() => expect(result.current.reviewRequest()).toBe(false));
    await act(() => result.current.submitRequest());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it.each(
    (["single_portfolio", "explicit_portfolio_batch"] as const).flatMap((scopeMode) =>
      (["portfolio", "workflow"] as const).map((substitution) => ({ scopeMode, substitution })),
    ),
  )("refuses unchecked stripped Composite $substitution metadata at the actual $scopeMode submit boundary", async ({ scopeMode, substitution }) => {
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
      scopeMode, selectedPortfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    const unchecked = parseReportOrderingResponse(buildCompositeReportOrderingResponse(true));
    const ordinary = parseReportOrderingResponse(buildCompositeReportOrderingResponse());
    const composite = unchecked.reportFamilies[0];
    composite.configurationFields = [];
    composite.orderingModes = [ordinary.reportFamilies[substitution === "portfolio" ? 0 : 1].orderingModes[0]];
    expect(() => parseReportOrderingResponse(unchecked)).toThrow();
    optionsMock.mockResolvedValueOnce(unchecked);
    await act(() => result.current.refreshCatalogue());
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.model?.family).toBeNull();
    expect(result.current.model?.nonOrderableFamilies).toEqual([composite]);
    expect(result.current.model?.workflowManagedFamilies).toEqual([]);
    act(() => result.current.updateConfiguration({
      familyId: "composite_review", modeId: composite.orderingModes[0].modeId,
      configurationValues: { composite_selection: "invented-selection" },
    }));
    act(() => expect(result.current.reviewRequest()).toBe(false));
    await act(async () => expect(await result.current.submitRequest()).toBe(false));
    expect(submitMock).not.toHaveBeenCalled();
    expect(submitBatchMock).not.toHaveBeenCalled();
  });

  it.each(
    (["single_portfolio", "explicit_portfolio_batch"] as const).flatMap((scopeMode) =>
      (["catalogue first", "receipt first"] as const).flatMap((completionOrder) =>
        (["unavailable", "permission", "transport", "composite only"] as const).map((refusal) => ({ scopeMode, completionOrder, refusal })),
      ),
    ),
  )("preserves $scopeMode transaction through $completionOrder / $refusal catalogue completion", async ({ scopeMode, completionOrder, refusal }) => {
    const read = deferred<ReportOrderingResponse>();
    const single = deferred<ReportJobHandle>();
    const batch = deferred<ReportBatchHandle>();
    let intentKey = "";
    if (scopeMode === "single_portfolio") submitMock.mockImplementationOnce(({ idempotencyKey }) => { intentKey = idempotencyKey; return single.promise; });
    else {
      submitBatchMock.mockImplementationOnce(({ idempotencyKey }) => { intentKey = idempotencyKey; return batch.promise; });
      batchStatusMock.mockResolvedValueOnce(parseReportBatchStatus({ ...buildReportBatchStatus(), as_of_date: "2026-04-21" }));
    }
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
      scopeMode, selectedPortfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    optionsMock.mockImplementationOnce(() => read.promise);
    act(() => result.current.updateConfiguration({ asOfDate: "2026-04-21" }));
    await waitFor(() => expect(optionsMock).toHaveBeenCalledTimes(2));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    let submission!: Promise<boolean>;
    act(() => { submission = result.current.submitRequest(); });
    await waitFor(() => expect(result.current.submissionState).toBe("submitting"));
    const completeRead = async () => {
      await act(async () => {
        if (refusal === "transport") read.reject(new Error("catalogue unavailable"));
        else {
          const payload = refusal === "composite only"
            ? buildCompositeReportOrderingResponse(true)
            : buildReportOrderingResponse();
          if (refusal !== "composite only") {
            payload.reportFamilies = [];
            if (refusal === "permission") payload.scopeEligibility.state = "permission_blocked";
            else payload.catalogueAvailability.state = "unavailable";
          }
          read.resolve(parseReportOrderingResponse(payload));
        }
        await read.promise.catch(() => undefined);
      });
    };
    const completeReceipt = async () => {
      await act(async () => {
        if (scopeMode === "single_portfolio") single.resolve({ report_request_id: "rrq_deferred", report_job_id: "rjob_deferred", status: "accepted", status_url: "/api/v1/report-jobs/rjob_deferred", idempotency_key: intentKey });
        else batch.resolve(parseReportBatchHandle({ ...buildReportBatchHandle(), idempotency_key: intentKey }));
        await submission;
      });
    };
    let busyAfterRead = true;
    if (completionOrder === "catalogue first") {
      await completeRead();
      busyAfterRead = result.current.screenState.readiness.kind === "submitting";
      await completeReceipt();
    } else {
      await completeReceipt();
      await completeRead();
    }
    expect(busyAfterRead).toBe(true);
    expect(result.current.submissionState).toBe("accepted");
    expect(result.current.screenState.workspace.kind).toBe("accepted");
    expect(result.current.screenState.readiness.kind).toBe("accepted");
    if (result.current.screenState.workspace.kind === "accepted") {
      expect(result.current.screenState.workspace.model?.configuration.asOfDate).toBe("2026-04-21");
      expect(result.current.screenState.workspace.model?.family?.reportFamilyId).toBe("portfolio_review");
    }
    expect(result.current.supportReference).toBe(scopeMode === "single_portfolio" ? "rjob_deferred" : "rbch_1");
    if (scopeMode === "explicit_portfolio_batch") expect(result.current.batchStatus?.batch_id).toBe("rbch_1");
    expect(result.current.canSubmitReviewedRequest).toBe(false);
    if (refusal === "composite only") {
      expect(result.current.model?.nonOrderableFamilies).toHaveLength(1);
      expect(result.current.screenState.readiness.canStartAnother).toBe(false);
    }
    act(() => expect(result.current.reviewRequest()).toBe(false));
    await act(async () => expect(await result.current.submitRequest()).toBe(false));
    expect(submitMock.mock.calls.length + submitBatchMock.mock.calls.length).toBe(1);
    act(() => expect(result.current.startAnotherReport()).toBe(false));
    optionsMock.mockResolvedValueOnce(parseReportOrderingResponse(buildReportOrderingResponse()));
    await act(() => result.current.refreshCatalogue());
    expect(result.current.preflightReviewed).toBe(false);
    act(() => expect(result.current.startAnotherReport()).toBe(true));
    expect(result.current.canSubmitReviewedRequest).toBe(false);
  });

  it.each(["single_portfolio", "explicit_portfolio_batch"] as const)("admits only one %s POST while the first reviewed intent is in flight", async (scopeMode) => {
    const post = deferred<ReportJobHandle>();
    const batchPost = deferred<ReportBatchHandle>();
    let intentKey = "";
    if (scopeMode === "single_portfolio") submitMock.mockImplementationOnce(({ idempotencyKey }) => { intentKey = idempotencyKey; return post.promise; });
    else submitBatchMock.mockImplementationOnce(({ idempotencyKey }) => { intentKey = idempotencyKey; return batchPost.promise; });
    const { result } = renderHook(() => useReportOrderingWorkflow({ portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD", scopeMode, selectedPortfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"] }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => { first = result.current.submitRequest(); second = result.current.submitRequest(); });
    await act(async () => {
      post.resolve({ report_request_id: "rrq_pending", report_job_id: "rjob_pending", status: "accepted", status_url: "/api/v1/report-jobs/rjob_pending", idempotency_key: intentKey });
      batchPost.resolve(parseReportBatchHandle({ ...buildReportBatchHandle(), idempotency_key: intentKey }));
      await Promise.all([first, second]);
    });
    expect(submitMock.mock.calls.length + submitBatchMock.mock.calls.length).toBe(1);
    expect(await second).toBe(false);
  });

  it.each(["single_portfolio", "explicit_portfolio_batch"] as const)("preserves actual receipt when protected %s outcomes independently refuse access", async (scopeMode) => {
    const { result } = renderHook(() => useReportOrderingWorkflow({ portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD", scopeMode, selectedPortfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"] }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    await act(() => result.current.submitRequest());
    const receipt = result.current.supportReference;
    if (scopeMode === "single_portfolio") {
      historyMock.mockRejectedValueOnce(new WorkbenchApiError("report history", 403));
      await act(() => result.current.refreshHistory());
      expect(result.current.historyState).toBe("permission_blocked");
      expect(result.current.history).toBeNull();
      expect(result.current.historyRows).toEqual([]);
      await act(() => result.current.refreshCatalogue());
      expect(result.current.historyState).toBe("permission_blocked");
      expect(result.current.historyRows).toEqual([]);
      await act(() => result.current.refreshHistory());
      expect(result.current.historyState).toBe("ready");
    } else {
      const timerSpy = vi.spyOn(window, "setTimeout");
      try {
        batchStatusMock.mockRejectedValueOnce(new WorkbenchApiError("report bundle outcomes", 403));
        await act(() => result.current.refreshBatchStatus());
        expect(result.current.batchStatus).toBeNull();
        expect(result.current.batchStatusError).toMatch(/restricted/i);
        expect(timerSpy.mock.calls.some(([, delay]) => delay === 10_000)).toBe(false);
        await act(() => result.current.refreshCatalogue());
        expect(result.current.batchStatus).toBeNull();
        expect(result.current.batchStatusError).toMatch(/restricted/i);
        await act(() => result.current.refreshBatchStatus());
        expect(result.current.batchStatus?.batch_id).toBe("rbch_1");
      } finally {
        timerSpy.mockRestore();
      }
    }
    expect(result.current.supportReference).toBe(receipt);
    expect(result.current.screenState.readiness.kind).toBe("accepted");
    expect(result.current.screenState.workspace.kind).toBe("accepted");
    expect(submitMock.mock.calls.length + submitBatchMock.mock.calls.length).toBe(1);
  });

  it.each(["500", "transport"])("keeps a history 403 latched through an explicit %s retry failure and catalogue success", async (failure) => {
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    await act(() => result.current.submitRequest());
    const receipt = result.current.supportReference;
    historyMock.mockRejectedValueOnce(new WorkbenchApiError("report history", 403));
    await act(() => result.current.refreshHistory());
    expect(result.current.historyState).toBe("permission_blocked");
    expect(result.current.historyRows).toEqual([]);

    const retry = deferred<ReturnType<typeof buildReportJobListResponse>>();
    historyMock.mockImplementationOnce(() => retry.promise);
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      let explicitRetry!: Promise<void>;
      act(() => { explicitRetry = result.current.refreshHistory(); });
      expect(result.current.historyState).toBe("loading");
      expect(result.current.historyRows).toEqual([]);
      await act(() => result.current.refreshCatalogue());
      expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000 || delay === 10_000)).toBe(false);
      await act(async () => {
        retry.reject(failure === "500" ? new WorkbenchApiError("report history", 500) : new Error("history transport failed"));
        await explicitRetry;
      });
      await act(() => result.current.refreshCatalogue());
      expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000 || delay === 10_000)).toBe(false);
      expect(result.current.historyState).toBe("permission_blocked");
      expect(result.current.history).toBeNull();
      expect(result.current.historyRows).toEqual([]);
      expect(result.current.supportReference).toBe(receipt);
      expect(result.current.screenState.readiness.kind).toBe("accepted");

      const recovered = buildReportJobListResponse();
      recovered.items[0].reportJobId = "rjob_2";
      recovered.items[0].status = "accepted";
      recovered.items[0].currentStep = "accepted";
      historyMock.mockResolvedValueOnce(recovered);
      await act(() => result.current.refreshHistory());
      expect(result.current.historyState).toBe("ready");
      expect(result.current.historyRows).toHaveLength(1);
      expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(true);
      expect(submitMock).toHaveBeenCalledTimes(1);
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("does not let a superseded protected history 200 clear a newer 403", async () => {
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    await act(() => result.current.submitRequest());
    historyMock.mockRejectedValueOnce(new WorkbenchApiError("report history", 403));
    await act(() => result.current.refreshHistory());
    const olderRead = deferred<ReturnType<typeof buildReportJobListResponse>>();
    historyMock.mockImplementationOnce(() => olderRead.promise);
    let olderRetry!: Promise<void>;
    act(() => { olderRetry = result.current.refreshHistory(); });
    historyMock.mockRejectedValueOnce(new WorkbenchApiError("report history", 403));
    await act(() => result.current.refreshHistory());
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      await act(async () => { olderRead.resolve(buildReportJobListResponse()); await olderRetry; });
      expect(result.current.historyState).toBe("permission_blocked");
      expect(result.current.historyRows).toEqual([]);
      expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000 || delay === 10_000)).toBe(false);
      expect(result.current.supportReference).toBe("rjob_2");
      await act(() => result.current.refreshHistory());
      expect(result.current.historyState).toBe("ready");
    } finally { timerSpy.mockRestore(); }
  });

  it("admits history afresh for a different owned portfolio without carrying the prior refusal", async () => {
    optionsMock.mockImplementation(async (portfolioId) => {
      const response = buildReportOrderingResponse();
      response.scopeSelection.scopeId = portfolioId;
      return parseReportOrderingResponse(response);
    });
    historyMock.mockImplementation(async (portfolioId) => {
      const history = buildReportJobListResponse();
      history.appliedFilters.portfolioId = portfolioId;
      history.items[0].portfolioScope.portfolio_ids = [portfolioId];
      return history;
    });
    const { result, rerender } = renderHook(({ portfolioId }) => useReportOrderingWorkflow({
      portfolioId, asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }), { initialProps: { portfolioId: "PB_SG_GLOBAL_BAL_001" } });
    await waitFor(() => expect(result.current.historyState).toBe("ready"));
    historyMock.mockRejectedValueOnce(new WorkbenchApiError("report history", 403));
    await act(() => result.current.refreshHistory());
    expect(result.current.historyState).toBe("permission_blocked");
    rerender({ portfolioId: "PB_SG_OTHER_002" });
    await waitFor(() => expect(result.current.history?.appliedFilters.portfolioId).toBe("PB_SG_OTHER_002"));
    expect(result.current.historyState).toBe("ready");
    expect(historyMock).toHaveBeenLastCalledWith("PB_SG_OTHER_002");
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("keeps same-portfolio refusal across a context change and ignores the previous generation's successful retry", async () => {
    const { result, rerender } = renderHook(({ asOfDate }) => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate, reportingCurrency: "SGD",
    }), { initialProps: { asOfDate: "2026-04-22" } });
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    await act(() => result.current.submitRequest());
    historyMock.mockRejectedValueOnce(new WorkbenchApiError("report history", 403));
    await act(() => result.current.refreshHistory());
    const olderRead = deferred<ReturnType<typeof buildReportJobListResponse>>();
    historyMock.mockImplementationOnce(() => olderRead.promise);
    let olderRetry!: Promise<void>;
    act(() => { olderRetry = result.current.refreshHistory(); });
    const readsBeforeContextChange = historyMock.mock.calls.length;
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      rerender({ asOfDate: "2026-04-21" });
      await waitFor(() => expect(optionsMock).toHaveBeenLastCalledWith("PB_SG_GLOBAL_BAL_001", { asOfDate: "2026-04-21", reportingCurrency: "SGD" }));
      expect(result.current.historyState).toBe("permission_blocked");
      expect(historyMock).toHaveBeenCalledTimes(readsBeforeContextChange);
      await act(async () => { olderRead.resolve(buildReportJobListResponse()); await olderRetry; });
      expect(result.current.historyState).toBe("permission_blocked");
      expect(result.current.historyRows).toEqual([]);
      expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000 || delay === 10_000)).toBe(false);
      expect(result.current.supportReference).toBe("rjob_2");
      await act(() => result.current.refreshHistory());
      expect(result.current.historyState).toBe("ready");
    } finally { timerSpy.mockRestore(); }
  });

  it("loads source choices and recent requests for the selected portfolio", async () => {
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );

    await waitFor(() => expect(result.current.catalogueState).toBe("ready"));
    await waitFor(() => expect(result.current.historyState).toBe("ready"));

    expect(optionsMock).toHaveBeenCalledWith("PB_SG_GLOBAL_BAL_001", {
      asOfDate: "2026-04-22",
      reportingCurrency: "SGD",
    });
    expect(historyMock).toHaveBeenCalledWith("PB_SG_GLOBAL_BAL_001");
    expect(result.current.configuration).toEqual(
      expect.objectContaining({
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
        outputFormat: "json",
      }),
    );
    expect(result.current.historyRows[0].statusLabel).toBe(
      "Report data complete",
    );
  });

  it("invalidates reviewed authority across source unavailability and recovery", async () => {
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => expect(result.current.reviewRequest()).toBe(true));
    expect(result.current.preflightReviewed).toBe(true);
    const unavailable = buildReportOrderingResponse();
    unavailable.catalogueAvailability = {
      state: "unavailable", reasonCode: "report_catalogue_contract_invalid",
      message: "Report choices are temporarily unavailable.",
    };
    optionsMock.mockResolvedValueOnce(parseReportOrderingResponse(unavailable));
    await act(() => result.current.refreshCatalogue());
    expect(result.current.screenState.workspace.kind).toBe("error");
    expect(result.current.screenState.readiness.kind).toBe("unavailable");
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.canSubmitReviewedRequest).toBe(false);
    act(() => expect(result.current.reviewRequest()).toBe(false));
    await act(() => result.current.submitRequest());
    expect(submitMock).not.toHaveBeenCalled();
    await act(() => result.current.refreshCatalogue());
    expect(result.current.screenState.workspace.kind).toBe("configuration");
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.canSubmitReviewedRequest).toBe(false);
    act(() => expect(result.current.reviewRequest()).toBe(true));
    expect(result.current.canSubmitReviewedRequest).toBe(true);
  });

  it.each(["missing", "unknown", "permission"])("keeps %s contract/context refusal terminal", async (failure) => {
    optionsMock.mockImplementation(async () => {
      if (failure === "permission") throw new WorkbenchApiError("report ordering options", 403);
      const payload = buildReportOrderingResponse();
      return parseReportOrderingResponse({
        ...payload,
        catalogueAvailability: failure === "missing" ? undefined : {
          ...payload.catalogueAvailability, state: "invented",
        },
      });
    });
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }));
    await waitFor(() => expect(result.current.catalogueState).toBe(failure === "permission" ? "permission_blocked" : "error"));
    expect(result.current.screenState.readiness.kind).toBe(failure === "permission" ? "restricted" : "unavailable");
    expect(result.current.canSubmitReviewedRequest).toBe(false);
    act(() => expect(result.current.reviewRequest()).toBe(false));
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("recovers an absent family in the currently requested date and currency", async () => {
    const unavailable = buildReportOrderingResponse();
    unavailable.catalogueAvailability.state = "unavailable";
    unavailable.reportFamilies = [];
    optionsMock.mockResolvedValueOnce(parseReportOrderingResponse(unavailable));
    const { result } = renderHook(() => useReportOrderingWorkflow({
      portfolioId: "PB_SG_GLOBAL_BAL_001", asOfDate: "2026-04-22", reportingCurrency: "SGD",
    }));
    await waitFor(() => expect(result.current.screenState.workspace.kind).toBe("error"));
    act(() => result.current.updateConfiguration({
      asOfDate: "2026-04-21", reportingCurrency: "USD",
    }));
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    expect(optionsMock).toHaveBeenLastCalledWith("PB_SG_GLOBAL_BAL_001", {
      asOfDate: "2026-04-21", reportingCurrency: "USD",
    });
    expect(result.current.configuration).toEqual(expect.objectContaining({
      familyId: "portfolio_review", asOfDate: "2026-04-21", reportingCurrency: "USD",
    }));
    expect(result.current.preflightReviewed).toBe(false);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("keeps the newest request history when refreshes complete out of order", async () => {
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    await waitFor(() => expect(result.current.historyState).toBe("ready"));

    let resolveOlder:
      ((value: ReturnType<typeof buildReportJobListResponse>) => void) | null =
      null;
    let resolveNewer:
      ((value: ReturnType<typeof buildReportJobListResponse>) => void) | null =
      null;
    historyMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );

    let olderRefresh: Promise<void> | null = null;
    let newerRefresh: Promise<void> | null = null;
    act(() => {
      olderRefresh = result.current.refreshHistory();
      newerRefresh = result.current.refreshHistory();
    });

    const newerHistory = buildReportJobListResponse();
    newerHistory.items[0].reportJobId = "rjob_newer";
    await act(async () => {
      resolveNewer?.(newerHistory);
      await newerRefresh;
    });
    expect(result.current.history?.items[0].reportJobId).toBe("rjob_newer");

    const olderHistory = buildReportJobListResponse();
    olderHistory.items[0].reportJobId = "rjob_older";
    await act(async () => {
      resolveOlder?.(olderHistory);
      await olderRefresh;
    });
    expect(result.current.history?.items[0].reportJobId).toBe("rjob_newer");
    expect(result.current.historyState).toBe("ready");
  });

  it("refreshes an accepted single report until Reporting confirms a terminal lifecycle", async () => {
    const activeHistory = buildReportJobListResponse();
    activeHistory.items[0] = {
      ...activeHistory.items[0],
      reportJobId: "rjob_2",
      reportRequestId: "rrq_2",
      status: "accepted",
      currentStep: "accepted",
    };
    const completedHistory = structuredClone(activeHistory);
    completedHistory.items[0].status = "completed";
    completedHistory.items[0].currentStep = "completed";
    historyMock
      .mockResolvedValueOnce(buildReportJobListResponse())
      .mockResolvedValueOnce(activeHistory)
      .mockResolvedValueOnce(completedHistory);
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      const { result } = renderHook(() =>
        useReportOrderingWorkflow({
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      );
      await waitFor(() => expect(result.current.catalogueState).toBe("ready"));
      act(() => expect(result.current.reviewRequest()).toBe(true));
      await waitFor(() => expect(result.current.preflightReviewed).toBe(true));
      await act(async () =>
        expect(await result.current.submitRequest()).toBe(true),
      );
      await waitFor(() =>
        expect(result.current.history?.items[0].status).toBe("accepted"),
      );
      await waitFor(() =>
        expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(
          true,
        ),
      );
      const poll = [...timerSpy.mock.calls]
        .reverse()
        .find(([, delay]) => delay === 5_000)?.[0];

      await act(async () => {
        (poll as () => void)();
      });
      await waitFor(() =>
        expect(result.current.history?.items[0].status).toBe("completed"),
      );
      expect(historyMock).toHaveBeenCalledTimes(3);
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("does not poll a terminal lifecycle published with mixed case", async () => {
    const completedHistory = buildReportJobListResponse();
    completedHistory.items[0].status = "COMPLETED";
    completedHistory.items[0].currentStep = "COMPLETED";
    historyMock.mockResolvedValue(completedHistory);
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      const { result } = renderHook(() =>
        useReportOrderingWorkflow({
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      );

      await waitFor(() => expect(result.current.historyState).toBe("ready"));
      expect(result.current.historyRows[0].statusLabel).toBe(
        "Report data complete",
      );
      expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(
        false,
      );
    } finally {
      timerSpy.mockRestore();
    }
  });

  it.each([
    [undefined, undefined],
    [null, null],
    ["", ""],
    ["SOMETHING_NEW", "SOMETHING_NEW"],
    ["queued", undefined],
    ["queued", null],
    ["queued", ""],
    ["queued", "SOMETHING_NEW"],
  ])(
    "does not poll a submitted request when lifecycle evidence is not reported: status=%s step=%s",
    async (status, currentStep) => {
      const unreportedHistory = buildReportJobListResponse();
      unreportedHistory.items[0] = {
        ...unreportedHistory.items[0],
        reportJobId: "rjob_2",
        reportRequestId: "rrq_2",
      };
      const item = unreportedHistory.items[0] as unknown as Record<
        string,
        unknown
      >;
      if (status === undefined) {
        delete item.status;
      } else {
        item.status = status;
      }
      if (currentStep === undefined) {
        delete item.currentStep;
      } else {
        item.currentStep = currentStep;
      }
      historyMock
        .mockResolvedValueOnce(buildReportJobListResponse())
        .mockResolvedValueOnce(unreportedHistory);
      const timerSpy = vi.spyOn(window, "setTimeout");
      try {
        const { result } = renderHook(() =>
          useReportOrderingWorkflow({
            portfolioId: "PB_SG_GLOBAL_BAL_001",
            asOfDate: "2026-04-22",
            reportingCurrency: "SGD",
          }),
        );
        await waitFor(() =>
          expect(result.current.catalogueState).toBe("ready"),
        );
        act(() => expect(result.current.reviewRequest()).toBe(true));
        await waitFor(() =>
          expect(result.current.preflightReviewed).toBe(true),
        );
        await act(async () =>
          expect(await result.current.submitRequest()).toBe(true),
        );
        await waitFor(() =>
          expect(result.current.historyRows[0].statusLabel).toBe(
            "Status not reported",
          ),
        );

        expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(
          false,
        );
      } finally {
        timerSpy.mockRestore();
      }
    },
  );

  it("retains confirmed request evidence when an automatic refresh fails", async () => {
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    await waitFor(() => expect(result.current.historyState).toBe("ready"));
    historyMock.mockRejectedValueOnce(new Error("reporting unavailable"));

    await act(async () => {
      await result.current.refreshHistory();
    });

    expect(result.current.historyState).toBe("error");
    expect(result.current.history?.items[0].reportJobId).toBe("rjob_1");
  });

  it("does not poll report history after source access becomes permission blocked", async () => {
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      const { result } = renderHook(() =>
        useReportOrderingWorkflow({
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      );
      await waitFor(() => expect(result.current.historyState).toBe("ready"));
      timerSpy.mockClear();
      historyMock.mockRejectedValueOnce(
        new WorkbenchApiError("recent portfolio review requests", 403),
      );

      act(() => expect(result.current.reviewRequest()).toBe(true));
      await waitFor(() => expect(result.current.preflightReviewed).toBe(true));
      await act(async () =>
        expect(await result.current.submitRequest()).toBe(true),
      );
      await waitFor(() =>
        expect(result.current.historyState).toBe("permission_blocked"),
      );

      expect(
        timerSpy.mock.calls.some(
          ([, delay]) => delay === 5_000 || delay === 10_000,
        ),
      ).toBe(false);
      expect(historyMock).toHaveBeenCalledTimes(2);
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("preserves one idempotency intent across a safe retry", async () => {
    submitMock
      .mockRejectedValueOnce(new Error("temporary unavailable"))
      .mockImplementationOnce(({ idempotencyKey }) =>
        Promise.resolve({
          report_request_id: "rrq_2",
          report_job_id: "rjob_2",
          status: "accepted",
          status_url: "/api/v1/report-jobs/rjob_2",
          idempotency_key: idempotencyKey,
        }),
      );
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));

    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));

    await act(async () => {
      expect(await result.current.submitRequest()).toBe(false);
    });
    expect(result.current.submissionError).toContain(
      "preserved for a safe retry",
    );
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });

    const firstIntent = submitMock.mock.calls[0][0].idempotencyKey;
    const secondIntent = submitMock.mock.calls[1][0].idempotencyKey;
    expect(submitMock.mock.calls[0][0]).not.toHaveProperty(
      "allocationDimensions",
    );
    expect(firstIntent).toBe(secondIntent);
    expect(firstIntent).toMatch(/^workbench-report-order-/);
    expect(result.current.canSubmitReviewedRequest).toBe(false);
  });

  it("starts another report for the current portfolio with a fresh reviewed intent", async () => {
    submitMock
      .mockImplementationOnce(({ idempotencyKey }) =>
        Promise.resolve({
          report_request_id: "rrq_2",
          report_job_id: "rjob_2",
          status: "accepted",
          status_url: "/api/v1/report-jobs/rjob_2",
          idempotency_key: idempotencyKey,
        }),
      )
      .mockImplementationOnce(({ idempotencyKey }) =>
        Promise.resolve({
          report_request_id: "rrq_3",
          report_job_id: "rjob_3",
          status: "accepted",
          status_url: "/api/v1/report-jobs/rjob_3",
          idempotency_key: idempotencyKey,
        }),
      );
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));

    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });
    const firstIntent = submitMock.mock.calls[0][0].idempotencyKey;
    expect(result.current.screenState.workspace.kind).toBe("accepted");

    act(() => {
      expect(result.current.startAnotherReport()).toBe(true);
    });
    expect(result.current.submittedHandle).toBeNull();
    expect(result.current.submissionState).toBe("idle");
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.screenState.workspace.kind).toBe("configuration");
    expect(result.current.configuration).toEqual(
      expect.objectContaining({
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );

    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });

    expect(submitMock).toHaveBeenCalledTimes(2);
    expect(submitMock.mock.calls[1][0].idempotencyKey).not.toBe(firstIntent);
    expect(result.current.submittedHandle?.report_job_id).toBe("rjob_3");
  });

  it("submits a PDF when the source catalogue marks document creation ready", async () => {
    const payload = buildReportOrderingResponse();
    payload.catalogueAvailability.state = "ready";
    payload.reportFamilies[0].availability.state = "ready";
    payload.reportFamilies[0].orderingModes[0].defaultOutputFormat = "pdf";
    payload.reportFamilies[0].outputFormats[1] = {
      ...payload.reportFamilies[0].outputFormats[1],
      state: "ready",
      reasonCode: "governed_document_ready",
    };
    optionsMock.mockResolvedValue(parseReportOrderingResponse(payload));
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );

    await waitFor(() =>
      expect(result.current.configuration?.outputFormat).toBe("pdf"),
    );
    expect(result.current.model?.canSubmit).toBe(true);
    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });

    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputFormat: "pdf",
        portfolioId: "PB_SG_GLOBAL_BAL_001",
      }),
    );
  });

  it("submits only optional configuration published by the selected report family", async () => {
    const payload = buildReportOrderingResponse();
    payload.reportFamilies[0].configurationFields =
      payload.reportFamilies[0].configurationFields.filter(
        (field) => field.fieldId === "as_of_date",
      );
    payload.reportFamilies[0].sections = payload.reportFamilies[0].sections
      .filter((section) => section.sectionId !== "ADVISOR_COMMENTARY")
      .map((section) => ({
        ...section,
        dependencyFieldIds: [],
      }));
    optionsMock.mockResolvedValue(parseReportOrderingResponse(payload));
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );

    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });

    const submittedOrder = submitMock.mock.calls[0][0];
    expect(submittedOrder).not.toHaveProperty("reportingCurrency");
    expect(submittedOrder).not.toHaveProperty("benchmarkCode");
    expect(submittedOrder).not.toHaveProperty("allocationDimensions");
  });

  it("does not restore single-portfolio commentary when a bundle changes report family", async () => {
    const payload = buildReportOrderingResponse();
    const alternateFamily = structuredClone(payload.reportFamilies[0]);
    alternateFamily.reportFamilyId = "portfolio_review_alternate";
    alternateFamily.businessLabel = "Alternate portfolio review";
    const commentary = alternateFamily.sections.find(
      (section) => section.sectionId === "ADVISOR_COMMENTARY",
    );
    if (!commentary) {
      throw new Error("Advisor Commentary fixture is required");
    }
    commentary.defaultSelected = true;
    payload.reportFamilies.push(alternateFamily);
    optionsMock.mockResolvedValue(parseReportOrderingResponse(payload));

    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
        scopeMode: "explicit_portfolio_batch",
        selectedPortfolioIds: [
          "PB_SG_GLOBAL_BAL_001",
          "PB_SG_INCOME_002",
        ],
      }),
    );

    await waitFor(() => expect(result.current.catalogueState).toBe("ready"));
    act(() => {
      result.current.updateConfiguration({
        familyId: "portfolio_review_alternate",
      });
    });

    expect(result.current.configuration?.selectedSections).not.toContain(
      "ADVISOR_COMMENTARY",
    );
    expect(
      result.current.configuration?.configurationValues.advisor_brief_run_id,
    ).toBe("");
    expect(
      result.current.model?.sectionChoices.find(
        (section) => section.id === "ADVISOR_COMMENTARY",
      ),
    ).toEqual(
      expect.objectContaining({ selected: false, selectable: false }),
    );
  });

  it("invalidates reviewed preflight when output-affecting configuration changes", async () => {
    const { result } = renderHook(() =>
      useReportOrderingWorkflow({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      result.current.reviewRequest();
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));

    act(() => {
      result.current.updateConfiguration({ asOfDate: "2026-04-23" });
    });

    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.canSubmitReviewedRequest).toBe(false);
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(false);
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("creates a fresh reviewed intent when the selected portfolio bundle changes", async () => {
    const { result, rerender } = renderHook(
      ({ selectedPortfolioIds }) =>
        useReportOrderingWorkflow({
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
          scopeMode: "explicit_portfolio_batch",
          selectedPortfolioIds,
        }),
      {
        initialProps: {
          selectedPortfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
        },
      },
    );
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      result.current.reviewRequest();
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));

    rerender({
      selectedPortfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_GROWTH_003"],
    });
    expect(result.current.preflightReviewed).toBe(false);

    act(() => {
      result.current.reviewRequest();
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));
    expect(result.current.canSubmitReviewedRequest).toBe(true);
  });

  it("resets scope-bound state when the selected portfolio changes", async () => {
    const { result, rerender } = renderHook(
      ({ portfolioId }) =>
        useReportOrderingWorkflow({
          portfolioId,
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      { initialProps: { portfolioId: "PB_SG_GLOBAL_BAL_001" } },
    );
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      result.current.reviewRequest();
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));

    rerender({ portfolioId: "PB_SG_OTHER_002" });

    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith("PB_SG_OTHER_002", {
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    expect(result.current.preflightReviewed).toBe(false);
    expect(result.current.submittedHandle).toBeNull();
  });

  it("creates a fresh reviewed intent when switching portfolios with the same catalogue", async () => {
    const { result, rerender } = renderHook(
      ({ portfolioId }) =>
        useReportOrderingWorkflow({
          portfolioId,
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      { initialProps: { portfolioId: "PB_SG_GLOBAL_BAL_001" } },
    );

    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));

    rerender({ portfolioId: "PB_SG_OTHER_002" });

    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith("PB_SG_OTHER_002", {
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    expect(result.current.preflightReviewed).toBe(false);

    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });

    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));
    expect(result.current.canSubmitReviewedRequest).toBe(true);

    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });

    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: "PB_SG_OTHER_002",
      }),
    );
  });

  it("restores accepted submission posture when returning to the originating portfolio", async () => {
    const { result, rerender } = renderHook(
      ({ portfolioId }) =>
        useReportOrderingWorkflow({
          portfolioId,
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      { initialProps: { portfolioId: "PB_SG_GLOBAL_BAL_001" } },
    );

    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });
    expect(result.current.submissionState).toBe("accepted");
    expect(result.current.submittedHandle?.report_job_id).toBe("rjob_2");

    rerender({ portfolioId: "PB_SG_OTHER_002" });
    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith("PB_SG_OTHER_002", {
        asOfDate: "2026-04-22",
        reportingCurrency: "SGD",
      }),
    );
    act(() => {
      result.current.updateConfiguration({ asOfDate: "2026-04-23" });
    });
    expect(result.current.submissionState).toBe("idle");
    expect(result.current.submittedHandle).toBeNull();

    rerender({ portfolioId: "PB_SG_GLOBAL_BAL_001" });

    await waitFor(() =>
      expect(result.current.submittedHandle?.report_job_id).toBe("rjob_2"),
    );
    expect(result.current.submissionState).toBe("accepted");
    expect(result.current.canSubmitReviewedRequest).toBe(false);
  });

  it("tracks accepted submission handles independently for multiple portfolios", async () => {
    optionsMock.mockImplementation((portfolioId) => {
      const payload = buildReportOrderingResponse();
      payload.scopeSelection.scopeId = portfolioId;
      return Promise.resolve(parseReportOrderingResponse(payload));
    });
    submitMock
      .mockImplementationOnce(({ idempotencyKey }) =>
        Promise.resolve({
          report_request_id: "rrq_a",
          report_job_id: "rjob_a",
          status: "accepted",
          status_url: "/api/v1/report-jobs/rjob_a",
          idempotency_key: idempotencyKey,
        }),
      )
      .mockImplementationOnce(({ idempotencyKey }) =>
        Promise.resolve({
          report_request_id: "rrq_b",
          report_job_id: "rjob_b",
          status: "accepted",
          status_url: "/api/v1/report-jobs/rjob_b",
          idempotency_key: idempotencyKey,
        }),
      );

    const { result, rerender } = renderHook(
      ({ portfolioId }) =>
        useReportOrderingWorkflow({
          portfolioId,
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      { initialProps: { portfolioId: "PB_SG_GLOBAL_BAL_001" } },
    );

    await waitFor(() => expect(result.current.model?.canSubmit).toBe(true));
    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });
    expect(result.current.submittedHandle?.report_job_id).toBe("rjob_a");

    rerender({ portfolioId: "PB_SG_OTHER_002" });

    await waitFor(() =>
      expect(result.current.catalogue?.scopeSelection?.scopeId).toBe(
        "PB_SG_OTHER_002",
      ),
    );
    act(() => {
      expect(result.current.reviewRequest()).toBe(true);
    });
    await waitFor(() => expect(result.current.preflightReviewed).toBe(true));
    await act(async () => {
      expect(await result.current.submitRequest()).toBe(true);
    });
    expect(result.current.submittedHandle?.report_job_id).toBe("rjob_b");

    rerender({ portfolioId: "PB_SG_GLOBAL_BAL_001" });

    await waitFor(() =>
      expect(result.current.submittedHandle?.report_job_id).toBe("rjob_a"),
    );
    expect(result.current.submissionState).toBe("accepted");
    expect(result.current.canSubmitReviewedRequest).toBe(false);
  });

  it("ignores a late catalogue response from the previously selected portfolio", async () => {
    let resolveFirst:
      ((value: ReturnType<typeof parseReportOrderingResponse>) => void) | null =
      null;
    const firstResponse = new Promise<
      ReturnType<typeof parseReportOrderingResponse>
    >((resolve) => {
      resolveFirst = resolve;
    });
    const secondPayload = buildReportOrderingResponse();
    secondPayload.scopeSelection.scopeId = "PB_SG_OTHER_002";
    optionsMock.mockImplementation((portfolioId) =>
      portfolioId === "PB_SG_GLOBAL_BAL_001"
        ? firstResponse
        : Promise.resolve(parseReportOrderingResponse(secondPayload)),
    );
    const { result, rerender } = renderHook(
      ({ portfolioId }) =>
        useReportOrderingWorkflow({
          portfolioId,
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      { initialProps: { portfolioId: "PB_SG_GLOBAL_BAL_001" } },
    );

    rerender({ portfolioId: "PB_SG_OTHER_002" });
    await waitFor(() =>
      expect(result.current.catalogue?.scopeSelection?.scopeId).toBe(
        "PB_SG_OTHER_002",
      ),
    );
    act(() => {
      resolveFirst?.(
        parseReportOrderingResponse(buildReportOrderingResponse()),
      );
    });

    await waitFor(() =>
      expect(result.current.catalogue?.scopeSelection?.scopeId).toBe(
        "PB_SG_OTHER_002",
      ),
    );
  });
});
