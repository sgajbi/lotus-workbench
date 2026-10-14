import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getReportOrderingOptions,
  listPortfolioReviewOrders,
  submitPortfolioReviewOrder,
} from "@/features/report-ordering/api";
import { parseReportOrderingResponse } from "@/features/report-ordering/contracts";
import { useReportOrderingWorkflow as useReportOrderingWorkflowSource } from "@/features/report-ordering/use-report-ordering-workflow";
import { WorkbenchApiError } from "@/features/workbench/api-client";
import {
  buildReportJobListResponse,
  buildReportOrderingResponse,
} from "../fixtures/report-ordering-fixtures";

vi.mock("@/features/report-ordering/api", () => ({
  getReportOrderingOptions: vi.fn(),
  listPortfolioReviewOrders: vi.fn(),
  submitPortfolioReviewOrder: vi.fn(),
}));

const optionsMock = vi.mocked(getReportOrderingOptions);
const historyMock = vi.mocked(listPortfolioReviewOrders);
const submitMock = vi.mocked(submitPortfolioReviewOrder);

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
