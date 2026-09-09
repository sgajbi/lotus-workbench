import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportOrderingWorkspace } from "@/features/report-ordering/components/report-ordering-workspace";
import {
  getPortfolioReviewBatchStatus,
  getReportOrderingOptions,
  listPortfolioReviewOrders,
  submitPortfolioReviewBatch,
  submitPortfolioReviewOrder,
} from "@/features/report-ordering/api";
import {
  parseReportBatchHandle,
  parseReportBatchStatus,
  parseReportOrderingResponse,
} from "@/features/report-ordering/contracts";
import { WorkbenchApiError } from "@/features/workbench/api-client";
import { useAdvisorBook } from "@/features/advisor-book/use-advisor-book";
import {
  buildReportBatchHandle,
  buildReportBatchStatus,
  buildReportJobListResponse,
  buildReportOrderingResponse,
} from "../fixtures/report-ordering-fixtures";
import { expectReviewContextOwns } from "../review-context-census";

const routerPushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/features/report-ordering/api", () => ({
  getPortfolioReviewBatchStatus: vi.fn(),
  getReportOrderingOptions: vi.fn(),
  listPortfolioReviewOrders: vi.fn(),
  submitPortfolioReviewBatch: vi.fn(),
  submitPortfolioReviewOrder: vi.fn(),
}));

vi.mock("@/features/advisor-book/use-advisor-book", () => ({
  useAdvisorBook: vi.fn(),
}));

function buildAdvisorBookResult({
  currentPortfolioStatus = "ACTIVE",
  includeCurrentPortfolio = true,
}: {
  currentPortfolioStatus?: "ACTIVE" | "INACTIVE";
  includeCurrentPortfolio?: boolean;
} = {}) {
  const items = [
    ...(includeCurrentPortfolio
      ? [
          {
            portfolio_id: "PB_SG_GLOBAL_BAL_001",
            display_name: "Global Balanced Mandate",
            client_id: "CLIENT_001",
            base_currency: "SGD",
            booking_center_code: "Singapore",
            mandate_type: "ADVISORY" as const,
            status: currentPortfolioStatus,
            opened_on: "2020-01-01",
            closed_on: null,
            membership_source: "PortfolioManagerBookMembership:v1" as const,
            membership_reference: "membership-1",
            membership_basis: "governed_role_assignment" as const,
          },
        ]
      : []),
    {
      portfolio_id: "PB_SG_INCOME_002",
      display_name: "Income Preservation Mandate",
      client_id: "CLIENT_002",
      base_currency: "USD",
      booking_center_code: "Singapore",
      mandate_type: "DISCRETIONARY" as const,
      status: "ACTIVE" as const,
      opened_on: "2021-01-01",
      closed_on: null,
      membership_source: "PortfolioManagerBookMembership:v1" as const,
      membership_reference: "membership-2",
      membership_basis: "governed_role_assignment" as const,
    },
  ];
  return {
    loading: false,
    error: null,
    recheckError: null,
    rechecking: false,
    checkedAt: 1_771_000_000_000,
    reload: vi.fn(),
    response: {
      correlation_id: "corr-book",
      contract_version: "v1" as const,
      scope: {
        kind: "own_book" as const,
        label: "My book" as const,
        as_of_date: "2026-04-22",
        booking_center_code: "Singapore",
      },
      items,
      page: {
        total_count: 150,
        offset: 0,
        limit: 100,
        returned_count: items.length,
        sort_by: "client_id" as const,
        sort_order: "asc" as const,
      },
      supportability: {
        state: "ready" as const,
        reason_code: "advisor_book_ready" as const,
        tenant_scope: "source_confirmed" as const,
        limitations: [],
      },
      provenance: null,
    },
  };
}

function buildRenderSupportability({
  state = "unavailable",
  supportedOutputFormats = ["json"],
}: {
  state?: "ready" | "degraded" | "unavailable";
  supportedOutputFormats?: string[];
} = {}) {
  return {
    feature_key: "portfolio_review_render",
    state,
    reason: state === "ready" ? "render_ready" : `render_${state}`,
    freshness_bucket: "current",
    deterministic_output_supported: state !== "unavailable",
    render_store_ready: state !== "unavailable",
    template_registry_ready: true,
    default_output_format: "json",
    supported_output_formats: supportedOutputFormats,
  };
}

function buildPdfReadyOrderingResponse() {
  const options = buildReportOrderingResponse();
  const pdfOutput = options.reportFamilies[0].outputFormats.find(
    (output) => output.formatId === "pdf",
  );
  if (pdfOutput) {
    pdfOutput.state = "ready";
    pdfOutput.reasonCode = "governed_pdf_ready";
  }
  return options;
}

function mockAcceptedBatchRenderSupport(
  renderSupportability: ReturnType<typeof buildRenderSupportability>,
) {
  submitBatchMock.mockImplementation(async (order) => {
    const handle = {
      ...buildReportBatchHandle(),
      idempotency_key: order.idempotencyKey,
      render_supportability: renderSupportability,
    };
    return parseReportBatchHandle(handle);
  });
}

const optionsMock = vi.mocked(getReportOrderingOptions);
const historyMock = vi.mocked(listPortfolioReviewOrders);
const submitMock = vi.mocked(submitPortfolioReviewOrder);
const submitBatchMock = vi.mocked(submitPortfolioReviewBatch);
const batchStatusMock = vi.mocked(getPortfolioReviewBatchStatus);
const advisorBookMock = vi.mocked(useAdvisorBook);

const portfolio = {
  portfolioId: "PB_SG_GLOBAL_BAL_001",
  asOfDate: "2026-04-22",
  sourceBaseCurrency: "SGD",
  reportingCurrency: "SGD",
  earliestReportDate: "2025-01-06",
  latestReportDate: "2026-04-22",
  reportingCurrencies: ["SGD", "USD"],
};

describe("ReportOrderingWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      "",
      "/reports?portfolioId=PB_SG_GLOBAL_BAL_001&period=YTD",
    );
    advisorBookMock.mockReturnValue(buildAdvisorBookResult());
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse(buildReportOrderingResponse()),
    );
    historyMock.mockResolvedValue(buildReportJobListResponse());
    submitMock.mockImplementation(async (order) => ({
      report_request_id: "rrq_2",
      report_job_id: "rjob_2",
      status: "accepted",
      status_url: "/api/v1/report-jobs/rjob_2",
      idempotency_key: order.idempotencyKey,
    }));
    submitBatchMock.mockImplementation(async (order) => {
      const handle = buildReportBatchHandle();
      handle.idempotency_key = order.idempotencyKey;
      return parseReportBatchHandle(handle);
    });
    batchStatusMock.mockResolvedValue(
      parseReportBatchStatus(buildReportBatchStatus()),
    );
  });

  it("keeps a carried unsupported review period visible as source-scope context", () => {
    render(
      <ReportOrderingWorkspace
        portfolio={portfolio}
        reviewContext={{
          portfolioName: "Global Balanced Mandate",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          clientId: "CIF_SG_000184",
          mandateType: "Discretionary",
          bookingCenter: "Singapore",
          businessDate: "22 Apr 2026",
          currency: { kind: "base", value: "SGD" },
          sourceState: "confirmed",
          notice: {
            label: "Report source context",
            message:
              "The carried review period YTD does not filter this report ordering workflow.",
            tone: "attention",
          },
        }}
      />,
    );

    expect(screen.getByTestId("review-context-strip")).toHaveTextContent(
      /review period YTD.*does not filter this report ordering workflow/i,
    );
    expectReviewContextOwns({
      exclusiveFacts: ["PB_SG_GLOBAL_BAL_001", "CIF_SG_000184", "Singapore"],
      contextualFacts: [{ label: "Business date", value: "22 Apr 2026" }],
    });
  });

  it("renders a source-backed advisor flow and keeps unavailable PDF disabled", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(screen.getByText("Loading approved reports")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Checking report availability",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
    const reportDate = screen.getByDisplayValue("2026-04-22");
    expect(reportDate).toHaveAccessibleName("Report date");
    expect(reportDate).toHaveAttribute("min", "2025-01-06");
    expect(reportDate).toHaveAttribute("max", "2026-04-22");
    const reportingCurrency = screen.getByRole("combobox", {
      name: "Reporting currency",
    });
    expect(reportingCurrency).toHaveValue("SGD");
    expect(
      within(reportingCurrency)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["SGD", "USD"]);
    expect(
      screen.getByRole("radio", { name: /Structured data package/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Governed PDF document/ }),
    ).toBeDisabled();
    expect(
      screen.getByText(/PDF creation is temporarily unavailable/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /default allocation view maintained for this portfolio/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/source-owned default/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("render_metadata_unavailable"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("lotus-report")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Review report contents"));
    const requiredSection = screen.getByRole("checkbox", {
      name: /Client and mandate profile/,
    });
    expect(requiredSection).toBeChecked();
    expect(requiredSection).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Asset class" }),
    ).not.toBeChecked();
  });

  it("uses the exact accepted brief without asking the advisor for a run identifier", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByText("Review report contents"));
    const commentary = screen.getByRole("checkbox", {
      name: /Advisor commentary/,
    });
    expect(commentary).toBeEnabled();
    expect(screen.getByText("Accepted brief ready")).toBeInTheDocument();
    expect(screen.getByText(/Accepted by advisor.sg.301/)).toBeInTheDocument();
    expect(commentary.closest("div")).toHaveAttribute(
      "data-accepted-brief-run-id",
      "abr_accepted_1",
    );
    expect(
      screen.queryByRole("textbox", { name: "Accepted advisor brief" }),
    ).not.toBeInTheDocument();
    fireEvent.click(commentary);
    const review = screen.getByRole("button", { name: "Review Request" });
    expect(review).toBeEnabled();

    fireEvent.click(review);
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationValues: { advisor_brief_run_id: "abr_accepted_1" },
        sections: expect.arrayContaining(["ADVISOR_COMMENTARY"]),
      }),
    );
  });

  it("fences accepted commentary to the current report date and currency", async () => {
    let resolvePriorContext:
      ((value: ReturnType<typeof parseReportOrderingResponse>) => void) | null =
      null;
    const priorContextResponse = new Promise<
      ReturnType<typeof parseReportOrderingResponse>
    >((resolve) => {
      resolvePriorContext = resolve;
    });
    const currentPayload = buildReportOrderingResponse();
    const currentCommentary = currentPayload.reportFamilies[0].sections.find(
      (section) => section.sectionId === "ADVISOR_COMMENTARY",
    );
    if (!currentCommentary?.availability?.acceptedBrief) {
      throw new Error("Accepted Advisor Brief fixture missing");
    }
    currentCommentary.availability.acceptedBrief.runId = "abr_current_context";

    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByText("Review report contents"));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Advisor commentary/ }),
    );

    optionsMock
      .mockImplementationOnce(() => priorContextResponse)
      .mockResolvedValueOnce(parseReportOrderingResponse(currentPayload));
    fireEvent.change(screen.getByLabelText("Report date"), {
      target: { value: "2026-04-21" },
    });

    expect(
      screen.getByRole("checkbox", { name: /Advisor commentary/ }),
    ).toBeDisabled();
    expect(screen.getByText("Checking accepted brief")).toBeInTheDocument();
    await waitFor(() => expect(optionsMock).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("Reporting currency"), {
      target: { value: "USD" },
    });
    await waitFor(() => expect(optionsMock).toHaveBeenCalledTimes(3));
    expect(optionsMock).toHaveBeenLastCalledWith("PB_SG_GLOBAL_BAL_001", {
      asOfDate: "2026-04-21",
      reportingCurrency: "USD",
    });
    await waitFor(() =>
      expect(screen.getByText("Accepted brief ready")).toBeInTheDocument(),
    );
    expect(
      screen
        .getByRole("checkbox", { name: /Advisor commentary/ })
        .closest("div"),
    ).toHaveAttribute("data-accepted-brief-run-id", "abr_current_context");

    await act(async () => {
      resolvePriorContext?.(
        parseReportOrderingResponse(buildReportOrderingResponse()),
      );
    });
    expect(
      screen
        .getByRole("checkbox", { name: /Advisor commentary/ })
        .closest("div"),
    ).toHaveAttribute("data-accepted-brief-run-id", "abr_current_context");
  });

  it("restores accepted commentary evidence when a debounced context change is cancelled", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    const reportDate = screen.getByLabelText("Report date");
    fireEvent.change(reportDate, { target: { value: "2026-04-21" } });
    fireEvent.change(reportDate, { target: { value: "2026-04-22" } });

    await new Promise((resolve) => window.setTimeout(resolve, 300));
    expect(optionsMock).toHaveBeenCalledTimes(1);
    const commentary = screen.getByRole("checkbox", {
      name: /Advisor commentary/,
    });
    expect(commentary).toBeEnabled();
    fireEvent.click(commentary);
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfDate: "2026-04-22",
        configurationValues: { advisor_brief_run_id: "abr_accepted_1" },
        sections: expect.arrayContaining(["ADVISOR_COMMENTARY"]),
      }),
    );
  });

  it("keeps non-commentary ordering reviewable after an availability recheck fails", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    optionsMock.mockRejectedValueOnce(new Error("reporting unavailable"));
    fireEvent.change(screen.getByLabelText("Report date"), {
      target: { value: "2026-04-21" },
    });

    await waitFor(() => expect(optionsMock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByText("Review report contents"));
    expect(
      await screen.findByText("Availability not confirmed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Advisor commentary/ }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfDate: "2026-04-21",
        configurationValues: {},
        sections: expect.not.arrayContaining(["ADVISOR_COMMENTARY"]),
      }),
    );
  });

  it("does not restore a default commentary selection when changing report after a failed recheck", async () => {
    const payload = buildReportOrderingResponse();
    const alternateFamily = structuredClone(payload.reportFamilies[0]);
    alternateFamily.reportFamilyId = "portfolio_review_condensed";
    alternateFamily.businessLabel = "Condensed portfolio review";
    const commentary = alternateFamily.sections.find(
      (section) => section.sectionId === "ADVISOR_COMMENTARY",
    );
    if (!commentary) throw new Error("Advisor commentary fixture missing");
    commentary.defaultSelected = true;
    optionsMock.mockResolvedValueOnce(
      parseReportOrderingResponse({
        ...payload,
        reportFamilies: [...payload.reportFamilies, alternateFamily],
      }),
    );

    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    optionsMock.mockRejectedValueOnce(new Error("reporting unavailable"));
    fireEvent.change(screen.getByLabelText("Report date"), {
      target: { value: "2026-04-21" },
    });
    await waitFor(() => expect(optionsMock).toHaveBeenCalledTimes(2));

    fireEvent.click(
      screen.getByRole("radio", { name: /Condensed portfolio review/ }),
    );
    const commentaryChoice = screen.getByRole("checkbox", {
      name: /Advisor commentary/,
    });
    expect(commentaryChoice).not.toBeChecked();
    expect(commentaryChoice).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfDate: "2026-04-21",
        configurationValues: {},
        sections: expect.not.arrayContaining(["ADVISOR_COMMENTARY"]),
      }),
    );
  });

  it("requires an explicit review before idempotent submission", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    const submitButton = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    expect(submitButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(
      await screen.findByRole("heading", { name: "Report request accepted" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Report request readiness" }),
      ).toHaveFocus(),
    );
    expect(
      within(screen.getByRole("status")).getByRole("heading", {
        name: "Report request accepted",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Report request accepted")).toHaveLength(1);
    expect(
      screen.queryByText("Report request recorded"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Approved report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Recent portfolio report requests" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit Report Request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create another report" }),
    ).toBeEnabled();
    expect(screen.getByText("rjob_2")).toBeInTheDocument();
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        asOfDate: "2026-04-22",
        outputFormat: "json",
        sections: ["CLIENT_PROFILE", "OVERVIEW", "PERFORMANCE"],
        idempotencyKey: expect.stringMatching(/^workbench-report-order-/),
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create another report" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Report configuration")).toHaveFocus(),
    );
    expect(
      screen.queryByText("Report request accepted"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit Report Request" }),
    ).toBeDisabled();
  });

  it("rejects acceptance for a different reviewed request without storing its handle", async () => {
    submitMock.mockResolvedValue({
      report_request_id: "rrq_wrong",
      report_job_id: "rjob_wrong",
      status: "accepted",
      status_url: "/api/v1/report-jobs/rjob_wrong",
      idempotency_key: "another-reviewed-request",
    });
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByRole("heading", {
        name: "Report request not accepted",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("rjob_wrong")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Report request accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry Report Request" }),
    ).toBeEnabled();
  });

  it("rejects acceptance whose status reference names another report job", async () => {
    submitMock.mockImplementation(async (order) => ({
      report_request_id: "rrq_2",
      report_job_id: "rjob_2",
      status: "accepted",
      status_url: "/api/v1/report-jobs/rjob_other",
      idempotency_key: order.idempotencyKey,
    }));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", {
        name: "Report request not accepted",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("rjob_2")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry Report Request" }),
    ).toBeEnabled();
  });

  it("replays an unchanged reviewed request with the same idempotency identity", async () => {
    submitMock
      .mockRejectedValueOnce(new Error("temporary unavailable"))
      .mockImplementationOnce(async (order) => ({
        report_request_id: "rrq_retry",
        report_job_id: "rjob_retry",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_retry",
        idempotency_key: order.idempotencyKey,
      }));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry Report Request" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Report request accepted" }),
    ).toBeInTheDocument();
    expect(submitMock).toHaveBeenCalledTimes(2);
    expect(submitMock.mock.calls[1][0]).toEqual(submitMock.mock.calls[0][0]);
    expect(screen.getByText("rjob_retry")).toBeInTheDocument();
  });

  it("keeps a valid acceptance distinct when the subsequent history refresh fails", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    await screen.findByRole("table", {
      name: "Recent portfolio report requests",
    });
    historyMock.mockRejectedValueOnce(new Error("history unavailable"));

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", { name: "Report request accepted" }),
    ).toBeInTheDocument();
    expect(screen.getByText("rjob_2")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "The latest lifecycle check did not complete. Previously confirmed requests remain visible; use Refresh to check again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("rjob_1")).toHaveLength(2);
  });

  it("restores accepted commentary evidence after leaving portfolio bundle mode", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByText("Review report contents"));

    const commentary = screen.getByRole("checkbox", {
      name: /Advisor commentary/,
    });
    fireEvent.click(commentary);
    expect(commentary).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    expect(commentary).not.toBeChecked();
    expect(commentary).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Selected portfolio/ }));
    expect(commentary).toBeEnabled();
    fireEvent.click(commentary);
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationValues: { advisor_brief_run_id: "abr_accepted_1" },
        sections: expect.arrayContaining(["ADVISOR_COMMENTARY"]),
      }),
    );
    expect(submitBatchMock).not.toHaveBeenCalled();
  });

  it("selects a source-backed portfolio bundle and shows per-portfolio outcomes", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Report data complete")).toBeInTheDocument();
    expect(screen.getByText("Needs retry")).toBeInTheDocument();
    const completion = screen.getByRole("progressbar", {
      name: "Portfolio bundle completion",
    });
    expect(completion).toHaveAttribute("aria-valuenow", "1");
    expect(completion).toHaveAttribute("aria-valuemax", "2");
    expect(
      within(screen.getByLabelText("Portfolio bundle summary")).getByText(
        "50%",
      ),
    ).toBeInTheDocument();
    expect(submitBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
        idempotencyKey: expect.stringMatching(/^workbench-report-order-/),
      }),
    );
    expect(batchStatusMock).toHaveBeenCalledWith("rbch_1");
    expect(routerPushMock).toHaveBeenCalledWith(
      "/reports?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-22&period=YTD&reportingCurrency=SGD&batchId=rbch_1",
      { scroll: false },
    );
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("rehydrates an addressed bundle from source-owned status without resubmitting", async () => {
    window.history.replaceState(
      {},
      "",
      "/reports?portfolioId=PB_SG_GLOBAL_BAL_001&period=YTD&batchId=rbch_1",
    );

    render(
      <ReportOrderingWorkspace portfolio={portfolio} initialBatchId="rbch_1" />,
    );

    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();
    expect(batchStatusMock).toHaveBeenCalledWith("rbch_1");
    expect(await screen.findByText("Report data complete")).toBeInTheDocument();
    expect(screen.getByText("Needs retry")).toBeInTheDocument();
    expect(screen.getByText("2 selected portfolios")).toBeInTheDocument();
    expect(submitBatchMock).not.toHaveBeenCalled();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("keeps polling when an addressed batch omits its source-base currency", async () => {
    const runningSourceBaseBatch = {
      ...buildReportBatchStatus(),
      reporting_currency: null,
      status: "running" as const,
      completed_at: null,
    };
    const completedSourceBaseBatch = {
      ...buildReportBatchStatus(),
      reporting_currency: null,
    };
    batchStatusMock
      .mockResolvedValueOnce(parseReportBatchStatus(runningSourceBaseBatch))
      .mockResolvedValueOnce(parseReportBatchStatus(completedSourceBaseBatch));
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      render(
        <ReportOrderingWorkspace
          portfolio={portfolio}
          initialBatchId="rbch_1"
        />,
      );

      expect(
        await screen.findByLabelText("Status In progress"),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(timerSpy.mock.calls.some(([, delay]) => delay === 5_000)).toBe(
          true,
        ),
      );
      const poll = timerSpy.mock.calls.find(
        ([, delay]) => delay === 5_000,
      )?.[0];

      await act(async () => {
        (poll as () => void)();
      });

      expect(await screen.findByText("Needs retry")).toBeInTheDocument();
      expect(batchStatusMock).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByText(
          /returned report setup did not match the reviewed request/i,
        ),
      ).not.toBeInTheDocument();
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("rejects an omitted batch currency for a restated reporting context", async () => {
    const unconfirmedRestatement = {
      ...buildReportBatchStatus(),
      reporting_currency: null,
    };
    batchStatusMock.mockResolvedValueOnce(
      parseReportBatchStatus(unconfirmedRestatement),
    );

    render(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, reportingCurrency: "USD" }}
        initialBatchId="rbch_1"
      />,
    );

    expect(
      await screen.findByText(
        /does not match the selected review date or reporting currency/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).not.toBeInTheDocument();
  });

  it("fails closed when an addressed bundle does not confirm the selected portfolio", async () => {
    const mismatch = buildReportBatchStatus();
    mismatch.batch_id = "rbch_other";
    batchStatusMock.mockResolvedValueOnce(parseReportBatchStatus(mismatch));

    render(
      <ReportOrderingWorkspace
        portfolio={portfolio}
        initialBatchId="rbch_requested"
      />,
    );

    expect(
      await screen.findByText(/does not confirm the selected portfolio/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).not.toBeInTheDocument();
    expect(submitBatchMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Return to report setup" }),
    );
    expect(routerPushMock).toHaveBeenCalledWith(
      "/reports?portfolioId=PB_SG_GLOBAL_BAL_001&period=YTD",
      { scroll: false },
    );
  });

  it("keeps a late Back-navigation batch response out of the current address", async () => {
    const currentStatus = buildReportBatchStatus();
    currentStatus.batch_id = "rbch_current";
    currentStatus.items[1].last_error_summary = "Current addressed outcome";
    const staleStatus = buildReportBatchStatus();
    staleStatus.batch_id = "rbch_stale";
    staleStatus.items[1].last_error_summary = "Stale addressed outcome";
    let resolveStale:
      ((value: ReturnType<typeof parseReportBatchStatus>) => void) | null =
      null;
    batchStatusMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
      )
      .mockResolvedValueOnce(parseReportBatchStatus(currentStatus));

    const view = render(
      <ReportOrderingWorkspace
        portfolio={portfolio}
        initialBatchId="rbch_stale"
      />,
    );
    await waitFor(() =>
      expect(batchStatusMock).toHaveBeenCalledWith("rbch_stale"),
    );
    view.rerender(
      <ReportOrderingWorkspace
        portfolio={portfolio}
        initialBatchId="rbch_current"
      />,
    );

    expect(
      await screen.findByText("Current addressed outcome"),
    ).toBeInTheDocument();
    await act(async () => {
      resolveStale?.(parseReportBatchStatus(staleStatus));
    });
    expect(screen.getByText("Current addressed outcome")).toBeInTheDocument();
    expect(
      screen.queryByText("Stale addressed outcome"),
    ).not.toBeInTheDocument();
  });

  it("pages through the source-owned advisor book instead of truncating bundle selection", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    expect(screen.getByText("1–2 of 150 portfolios")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next portfolios" }));

    expect(advisorBookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        asOfDate: "2026-04-22",
        offset: 100,
        limit: 100,
      }),
      { recoverOutOfRange: true },
    );
  });

  it("returns to an available book page when the current page falls outside a smaller source book", async () => {
    advisorBookMock.mockImplementation(({ offset }, options) => {
      const result = buildAdvisorBookResult();
      if (offset === 100 && options?.recoverOutOfRange) {
        result.response.page.offset = 0;
        result.response.page.total_count = 2;
      } else {
        result.response.page.offset = offset ?? 0;
      }
      return result;
    });
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next portfolios" }));

    await waitFor(() =>
      expect(advisorBookMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 100, limit: 100 }),
        { recoverOutOfRange: true },
      ),
    );
    expect(
      screen.getByRole("checkbox", { name: /Global Balanced Mandate/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No portfolios available"),
    ).not.toBeInTheDocument();
  });

  it("selects the routed portfolio when source membership appears on a later book page", async () => {
    advisorBookMock.mockImplementation(({ offset }) => {
      const result = buildAdvisorBookResult({
        includeCurrentPortfolio: offset === 100,
      });
      result.response.page.offset = offset ?? 0;
      return result;
    });
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next portfolios" }));

    expect(
      await screen.findByRole("checkbox", { name: /Global Balanced Mandate/ }),
    ).toBeChecked();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("does not count an inactive routed portfolio before source-owned book confirmation", async () => {
    advisorBookMock.mockReturnValue(
      buildAdvisorBookResult({ currentPortfolioStatus: "INACTIVE" }),
    );
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    await waitFor(() =>
      expect(screen.getByText("0 selected")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("checkbox", { name: /Global Balanced Mandate/ }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    ).toBeDisabled();
  });

  it("invalidates bundle readiness when the source-owned advisor book becomes unavailable", async () => {
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    advisorBookMock.mockReturnValue({
      loading: false,
      error: new Error("book unavailable"),
      recheckError: null,
      rechecking: false,
      checkedAt: null,
      reload: vi.fn(),
      response: null,
    });
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(
      await screen.findByRole("heading", {
        name: "Portfolio selection unavailable",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Restore My book before reviewing this bundle/),
    ).toBeInTheDocument();
  });

  it("removes a selected portfolio when refreshed source evidence marks it inactive", async () => {
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Submit Portfolio Bundle" }),
      ).toBeEnabled(),
    );

    advisorBookMock.mockReturnValue(
      buildAdvisorBookResult({ currentPortfolioStatus: "INACTIVE" }),
    );
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);

    await waitFor(() =>
      expect(screen.getByText("1 selected")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("checkbox", { name: /Global Balanced Mandate/ }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Global Balanced Mandate/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Submit Portfolio Bundle" }),
    ).toBeDisabled();
  });

  it("preserves a selected portfolio across a shifted book page until Gateway revalidates it", async () => {
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Submit Portfolio Bundle" }),
      ).toBeEnabled(),
    );

    advisorBookMock.mockReturnValue(
      buildAdvisorBookResult({ includeCurrentPortfolio: false }),
    );
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);

    await waitFor(() =>
      expect(screen.getByText("2 selected")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("checkbox", { name: /Global Balanced Mandate/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit Portfolio Bundle" }),
    ).toBeEnabled();
  });

  it("clears a reviewed portfolio bundle when My book is definitively empty", async () => {
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Submit Portfolio Bundle" }),
      ).toBeEnabled(),
    );

    const emptyBook = buildAdvisorBookResult();
    emptyBook.response.items = [];
    emptyBook.response.page.total_count = 0;
    emptyBook.response.page.returned_count = 0;
    advisorBookMock.mockReturnValue(emptyBook);
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(await screen.findByText("0 selected")).toBeInTheDocument();
    expect(screen.getByText("No portfolios available")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit Portfolio Bundle" }),
    ).toBeDisabled();
  });

  it("locks the reviewed portfolio bundle while its source submission is pending", async () => {
    let resolveSubmission:
      | ((
          value: Awaited<ReturnType<typeof submitPortfolioReviewBatch>>,
        ) => void)
      | null = null;
    submitBatchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    const secondPortfolio = screen.getByRole("checkbox", {
      name: /Income Preservation Mandate/,
    });
    fireEvent.click(secondPortfolio);
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", {
        name: "Submitting portfolio bundle",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Selected portfolio/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Portfolio bundle/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("searchbox", { name: "Filter portfolios on this page" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next portfolios" }),
    ).toBeDisabled();
    expect(secondPortfolio).toBeDisabled();
    expect(screen.getByLabelText("Report date")).toBeDisabled();
    expect(screen.getByLabelText("Reporting currency")).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Structured data package/ }),
    ).toBeDisabled();

    await act(async () => {
      const handle = buildReportBatchHandle();
      handle.idempotency_key = submitBatchMock.mock.calls[0][0].idempotencyKey;
      resolveSubmission?.(parseReportBatchHandle(handle));
    });
    expect(
      await screen.findByRole("heading", { name: "Portfolio bundle accepted" }),
    ).toBeInTheDocument();
    expect(submitBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioIds: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
      }),
    );
  });

  it("keeps a late prior-batch status response out of the active bundle", async () => {
    const firstHandle = buildReportBatchHandle();
    firstHandle.batch_id = "rbch_first";
    firstHandle.status_url = "/api/v1/report-batches/rbch_first";
    const secondHandle = buildReportBatchHandle();
    secondHandle.batch_id = "rbch_second";
    secondHandle.status_url = "/api/v1/report-batches/rbch_second";
    submitBatchMock
      .mockImplementationOnce(async (order) => {
        firstHandle.idempotency_key = order.idempotencyKey;
        return parseReportBatchHandle(firstHandle);
      })
      .mockImplementationOnce(async (order) => {
        secondHandle.idempotency_key = order.idempotencyKey;
        return parseReportBatchHandle(secondHandle);
      });

    const firstStatus = buildReportBatchStatus();
    firstStatus.batch_id = "rbch_first";
    firstStatus.items[1].last_error_summary = "Stale first-batch outcome";
    const secondStatus = buildReportBatchStatus();
    secondStatus.batch_id = "rbch_second";
    secondStatus.items[1].last_error_summary = "Current second-batch outcome";
    let resolveFirstStatus:
      ((value: ReturnType<typeof parseReportBatchStatus>) => void) | null =
      null;
    batchStatusMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstStatus = resolve;
        }),
      )
      .mockResolvedValueOnce(parseReportBatchStatus(secondStatus));

    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const firstSubmit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(firstSubmit).toBeEnabled());
    fireEvent.click(firstSubmit);

    fireEvent.click(
      await screen.findByRole("button", { name: "Create another report" }),
    );
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const secondSubmit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(secondSubmit).toBeEnabled());
    fireEvent.click(secondSubmit);
    expect(
      await screen.findByText("Current second-batch outcome"),
    ).toBeInTheDocument();

    await act(async () => {
      resolveFirstStatus?.(parseReportBatchStatus(firstStatus));
    });
    expect(
      screen.getByText("Current second-batch outcome"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Stale first-batch outcome"),
    ).not.toBeInTheDocument();
  });

  it("reports cancelled portfolio outcomes separately from active work", async () => {
    const status = buildReportBatchStatus();
    (status as { status_counts: Record<string, number> }).status_counts = {
      succeeded: 1,
      cancelled: 1,
    };
    status.items[1].status = "cancelled";
    status.items[1].retry_eligible = false;
    status.items[1].last_error_category = null;
    status.items[1].last_error_summary = null;
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    const summary = await screen.findByLabelText("Portfolio bundle summary");
    expect(
      within(summary).getByText("In progress").parentElement,
    ).toHaveTextContent("In progress0");
    expect(
      within(summary).getByText("Cancelled").parentElement,
    ).toHaveTextContent("Cancelled1");
    expect(
      screen.getByRole("progressbar", { name: "Portfolio bundle completion" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(within(summary).getByText("50%")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).toHaveTextContent("Cancelled");
  });

  it("reports 100% completion only when every portfolio report succeeds", async () => {
    const status = buildReportBatchStatus();
    (status as { status_counts: Record<string, number> }).status_counts = {
      succeeded: 2,
    };
    status.status = "completed";
    status.items[1] = {
      ...status.items[1],
      status: "succeeded",
      report_job_id: "rjob_2",
      retry_eligible: false,
      next_retry_at: null,
      last_error_category: null,
      last_error_summary: null,
      completed_at: "2026-04-22T09:01:00Z",
    };
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    const summary = await screen.findByLabelText("Portfolio bundle summary");
    const completion = screen.getByRole("progressbar", {
      name: "Portfolio bundle completion",
    });
    expect(completion).toHaveAttribute("aria-valuenow", "2");
    expect(completion).toHaveAttribute("aria-valuemax", "2");
    expect(within(summary).getByText("100%")).toBeInTheDocument();
  });

  it("keeps unavailable governed output explicit after report data completes", async () => {
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse(buildPdfReadyOrderingResponse()),
    );
    const status = {
      ...buildReportBatchStatus(),
      requested_output_formats: ["pdf"],
      render_supportability: buildRenderSupportability(),
    };
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(
      screen.getByRole("radio", { name: /Governed PDF document/ }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const unavailableOutputSubmit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(unavailableOutputSubmit).toBeEnabled());
    fireEvent.click(unavailableOutputSubmit);

    const supportPosture = await screen.findByLabelText(
      "Portfolio bundle availability",
    );
    expect(
      within(supportPosture).getByText("Requested output unavailable"),
    ).toBeInTheDocument();
    expect(supportPosture).toHaveTextContent(
      "nothing has been archived or delivered",
    );
    expect(screen.getByText("Report data complete")).toBeInTheDocument();
  });

  it("does not apply document-renderer failure copy to a supported structured-data output", async () => {
    const status = {
      ...buildReportBatchStatus(),
      render_supportability: buildRenderSupportability(),
    };
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const structuredDataSubmit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(structuredDataSubmit).toBeEnabled());
    fireEvent.click(structuredDataSubmit);

    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Requested output unavailable"),
    ).not.toBeInTheDocument();
  });

  it("retains accepted-handle output limitations when initial outcomes are unavailable", async () => {
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse(buildPdfReadyOrderingResponse()),
    );
    mockAcceptedBatchRenderSupport(buildRenderSupportability());
    const recoveredStatus = {
      ...buildReportBatchStatus(),
      requested_output_formats: ["pdf"],
      render_supportability: buildRenderSupportability({
        state: "ready",
        supportedOutputFormats: ["json", "pdf"],
      }),
    };
    batchStatusMock
      .mockRejectedValueOnce(new Error("status unavailable"))
      .mockResolvedValueOnce(parseReportBatchStatus(recoveredStatus));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(
      screen.getByRole("radio", { name: /Governed PDF document/ }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", {
        name: "Current outcomes unavailable",
      }),
    ).toBeInTheDocument();
    const supportPosture = screen.getByLabelText(
      "Portfolio bundle availability",
    );
    expect(
      within(supportPosture).getByText("Requested output unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Portfolio bundle availability"),
    ).not.toBeInTheDocument();
  });

  it("retains accepted-handle limitations when status omits nullable support posture", async () => {
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse(buildPdfReadyOrderingResponse()),
    );
    mockAcceptedBatchRenderSupport(
      buildRenderSupportability({
        state: "degraded",
        supportedOutputFormats: ["json", "pdf"],
      }),
    );
    const status = buildReportBatchStatus();
    status.requested_output_formats = ["pdf"];
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(
      screen.getByRole("radio", { name: /Governed PDF document/ }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    const supportPosture = await screen.findByLabelText(
      "Portfolio bundle availability",
    );
    expect(
      within(supportPosture).getByText("Requested output has limitations"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).toBeInTheDocument();
  });

  it("lets newer status support posture supersede acceptance-time limitations", async () => {
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse(buildPdfReadyOrderingResponse()),
    );
    mockAcceptedBatchRenderSupport(buildRenderSupportability());
    const status = {
      ...buildReportBatchStatus(),
      requested_output_formats: ["pdf"],
      render_supportability: buildRenderSupportability({
        state: "ready",
        supportedOutputFormats: ["json", "pdf"],
      }),
    };
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(
      screen.getByRole("radio", { name: /Governed PDF document/ }),
    );
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Portfolio bundle availability"),
    ).not.toBeInTheDocument();
  });

  it("does not mislabel structured data from acceptance-time document limitations", async () => {
    mockAcceptedBatchRenderSupport(buildRenderSupportability());
    batchStatusMock.mockResolvedValue(
      parseReportBatchStatus(buildReportBatchStatus()),
    );
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Portfolio bundle availability"),
    ).not.toBeInTheDocument();
  });

  it("shows degraded source reporting support without hiding portfolio outcomes", async () => {
    const status = {
      ...buildReportBatchStatus(),
      supportability: {
        feature_key: "portfolio_review_batch",
        state: "degraded",
        reason: "partial_reporting_support",
        freshness_bucket: "current",
        evidence_feature_count: 2,
        ready_evidence_feature_count: 1,
        degraded_evidence_feature_count: 1,
        workflow_count: 1,
        ready_workflow_count: 0,
      },
    };
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const degradedSupportSubmit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(degradedSupportSubmit).toBeEnabled());
    fireEvent.click(degradedSupportSubmit);

    const supportPosture = await screen.findByLabelText(
      "Portfolio bundle availability",
    );
    expect(
      within(supportPosture).getByText("Reporting support has limitations"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).toBeInTheDocument();
  });

  it("clears accepted bundle posture when portfolio navigation ends its monitoring context", async () => {
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(
      await screen.findByRole("heading", { name: "Portfolio bundle accepted" }),
    ).toBeInTheDocument();

    view.rerender(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, portfolioId: "PB_SG_OTHER_002" }}
      />,
    );
    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith(
        "PB_SG_OTHER_002",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);
    await waitFor(() =>
      expect(optionsMock).toHaveBeenLastCalledWith(
        "PB_SG_GLOBAL_BAL_001",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );

    expect(
      screen.queryByRole("heading", { name: "Portfolio bundle accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
  });

  it("clears accepted bundle posture when source reporting currency changes", async () => {
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(
      await screen.findByRole("heading", { name: "Portfolio bundle accepted" }),
    ).toBeInTheDocument();

    view.rerender(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, reportingCurrency: "USD" }}
      />,
    );
    await waitFor(() =>
      expect(optionsMock).toHaveBeenLastCalledWith(
        "PB_SG_GLOBAL_BAL_001",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "USD",
        }),
      ),
    );

    expect(
      screen.queryByRole("heading", { name: "Portfolio bundle accepted" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
  });

  it("rejects a late portfolio-bundle acceptance after A-to-B-to-A workspace navigation", async () => {
    let resolveSubmission:
      | ((
          value: Awaited<ReturnType<typeof submitPortfolioReviewBatch>>,
        ) => void)
      | null = null;
    submitBatchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await screen.findByRole("heading", { name: "Submitting portfolio bundle" });

    view.rerender(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, portfolioId: "PB_SG_OTHER_002" }}
      />,
    );
    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith(
        "PB_SG_OTHER_002",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);
    await waitFor(() =>
      expect(optionsMock).toHaveBeenLastCalledWith(
        "PB_SG_GLOBAL_BAL_001",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );

    await act(async () => {
      const handle = buildReportBatchHandle();
      handle.idempotency_key = submitBatchMock.mock.calls[0][0].idempotencyKey;
      resolveSubmission?.(parseReportBatchHandle(handle));
    });

    expect(
      screen.queryByRole("heading", { name: "Portfolio bundle accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Portfolio bundle not accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
    expect(batchStatusMock).not.toHaveBeenCalled();
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("rejects a late report acceptance after A-to-B-to-A workspace navigation", async () => {
    let resolveSubmission:
      | ((
          value: Awaited<ReturnType<typeof submitPortfolioReviewOrder>>,
        ) => void)
      | null = null;
    submitMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await screen.findByRole("heading", { name: "Submitting report request" });

    view.rerender(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, portfolioId: "PB_SG_OTHER_002" }}
      />,
    );
    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith(
        "PB_SG_OTHER_002",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);
    await waitFor(() =>
      expect(optionsMock).toHaveBeenLastCalledWith(
        "PB_SG_GLOBAL_BAL_001",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );

    await act(async () => {
      resolveSubmission?.({
        report_request_id: "rrq_old",
        report_job_id: "rjob_old",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_old",
        idempotency_key: submitMock.mock.calls[0][0].idempotencyKey,
      });
    });

    expect(
      screen.queryByRole("heading", { name: "Report request accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Report request not accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
  });

  it("rejects a late report failure after A-to-B-to-A workspace navigation", async () => {
    let rejectSubmission: ((reason: Error) => void) | null = null;
    submitMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSubmission = reject;
      }),
    );
    const view = render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await screen.findByRole("heading", { name: "Submitting report request" });

    view.rerender(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, portfolioId: "PB_SG_OTHER_002" }}
      />,
    );
    await waitFor(() =>
      expect(optionsMock).toHaveBeenCalledWith(
        "PB_SG_OTHER_002",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );
    view.rerender(<ReportOrderingWorkspace portfolio={portfolio} />);
    await waitFor(() =>
      expect(optionsMock).toHaveBeenLastCalledWith(
        "PB_SG_GLOBAL_BAL_001",
        expect.objectContaining({
          asOfDate: "2026-04-22",
          reportingCurrency: "SGD",
        }),
      ),
    );

    await act(async () => {
      rejectSubmission?.(new Error("late source rejection"));
    });

    expect(
      screen.queryByRole("heading", { name: "Report request accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Report request not accepted" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
  });

  it("surfaces a paused source batch separately from portfolio item progress", async () => {
    const status = buildReportBatchStatus();
    status.status = "paused";
    batchStatusMock.mockResolvedValue(parseReportBatchStatus(status));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    const summary = await screen.findByLabelText("Portfolio bundle summary");
    expect(
      within(summary).getByText("Batch status").parentElement,
    ).toHaveTextContent("Paused");
  });

  it("keeps a rejected portfolio bundle explicit and never renders success outcomes", async () => {
    submitBatchMock.mockRejectedValue(new Error("batch unavailable"));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", {
        name: "Portfolio bundle not accepted",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry Portfolio Bundle" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).not.toBeInTheDocument();
    expect(batchStatusMock).not.toHaveBeenCalled();
  });

  it("rejects an accepted batch handle for a different idempotency intent", async () => {
    const staleHandle = buildReportBatchHandle();
    staleHandle.idempotency_key = "stale_prior_intent";
    submitBatchMock.mockResolvedValue(parseReportBatchHandle(staleHandle));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", {
        name: "Portfolio bundle not accepted",
      }),
    ).toBeInTheDocument();
    expect(batchStatusMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).not.toBeInTheDocument();
  });

  it("rejects an accepted batch handle that omits reviewed portfolios", async () => {
    submitBatchMock.mockImplementation(async (order) => {
      const partialHandle = buildReportBatchHandle();
      partialHandle.idempotency_key = order.idempotencyKey;
      partialHandle.item_count = 1;
      return parseReportBatchHandle(partialHandle);
    });
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(
      await screen.findByRole("heading", {
        name: "Portfolio bundle not accepted",
      }),
    ).toBeInTheDocument();
    expect(batchStatusMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).not.toBeInTheDocument();
  });

  it("keeps last source-confirmed outcomes visible when refresh fails", async () => {
    batchStatusMock
      .mockResolvedValueOnce(parseReportBatchStatus(buildReportBatchStatus()))
      .mockRejectedValueOnce(new Error("temporary refresh failure"));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(
      await screen.findByRole("table", {
        name: "Portfolio report bundle outcomes",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh outcomes" }));

    expect(
      await screen.findByRole("heading", {
        name: "Outcome refresh unavailable",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/last source-confirmed outcomes remain visible below/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Portfolio report bundle outcomes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Report data complete")).toBeInTheDocument();
  });

  it("automatically retries a transient source-owned batch status failure", async () => {
    batchStatusMock
      .mockRejectedValueOnce(new Error("temporary status failure"))
      .mockResolvedValueOnce(parseReportBatchStatus(buildReportBatchStatus()));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      fireEvent.click(submit);
      expect(
        await screen.findByRole("heading", {
          name: "Current outcomes unavailable",
        }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(timerSpy.mock.calls.some(([, delay]) => delay === 10_000)).toBe(
          true,
        ),
      );
      const retry = timerSpy.mock.calls.find(
        ([, delay]) => delay === 10_000,
      )?.[0];

      await act(async () => {
        (retry as () => void)();
      });
      expect(
        await screen.findByRole("table", {
          name: "Portfolio report bundle outcomes",
        }),
      ).toBeInTheDocument();
      expect(batchStatusMock).toHaveBeenCalledTimes(2);
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("retries when source-owned outcomes identify a different batch", async () => {
    const mismatchedStatus = buildReportBatchStatus();
    mismatchedStatus.batch_id = "rbch_other";
    batchStatusMock
      .mockResolvedValueOnce(parseReportBatchStatus(mismatchedStatus))
      .mockResolvedValueOnce(parseReportBatchStatus(buildReportBatchStatus()));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      fireEvent.click(submit);
      expect(
        await screen.findByRole("heading", {
          name: "Current outcomes unavailable",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /returned portfolio outcomes did not match this request/,
        ),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(timerSpy.mock.calls.some(([, delay]) => delay === 10_000)).toBe(
          true,
        ),
      );
      const retry = timerSpy.mock.calls.find(
        ([, delay]) => delay === 10_000,
      )?.[0];

      await act(async () => {
        (retry as () => void)();
      });
      expect(
        await screen.findByRole("table", {
          name: "Portfolio report bundle outcomes",
        }),
      ).toBeInTheDocument();
      expect(batchStatusMock).toHaveBeenCalledTimes(2);
    } finally {
      timerSpy.mockRestore();
    }
  });

  it("retries when source-owned outcomes differ from the reviewed portfolio bundle", async () => {
    const substitutedStatus = buildReportBatchStatus();
    substitutedStatus.materialized_portfolio_ids[1] = "PB_SG_UNREVIEWED_003";
    substitutedStatus.items[1].portfolio_id = "PB_SG_UNREVIEWED_003";
    batchStatusMock
      .mockResolvedValueOnce(parseReportBatchStatus(substitutedStatus))
      .mockResolvedValueOnce(parseReportBatchStatus(buildReportBatchStatus()));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    );
    const submit = screen.getByRole("button", {
      name: "Submit Portfolio Bundle",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    const timerSpy = vi.spyOn(window, "setTimeout");
    try {
      fireEvent.click(submit);
      expect(
        await screen.findByRole("heading", {
          name: "Current outcomes unavailable",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /returned portfolios did not match the reviewed selection/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("table", {
          name: "Portfolio report bundle outcomes",
        }),
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(timerSpy.mock.calls.some(([, delay]) => delay === 10_000)).toBe(
          true,
        ),
      );
      const retry = timerSpy.mock.calls.find(
        ([, delay]) => delay === 10_000,
      )?.[0];

      await act(async () => {
        (retry as () => void)();
      });
      expect(
        await screen.findByRole("table", {
          name: "Portfolio report bundle outcomes",
        }),
      ).toBeInTheDocument();
      expect(batchStatusMock).toHaveBeenCalledTimes(2);
    } finally {
      timerSpy.mockRestore();
    }
  });

  it.each([
    [
      "report date",
      (status: ReturnType<typeof buildReportBatchStatus>) => {
        status.as_of_date = "2026-04-21";
      },
    ],
    [
      "output format",
      (status: ReturnType<typeof buildReportBatchStatus>) => {
        status.requested_output_formats = ["pdf"];
      },
    ],
    [
      "reporting currency",
      (status: ReturnType<typeof buildReportBatchStatus>) => {
        status.reporting_currency = "USD";
      },
    ],
  ])(
    "rejects source-owned outcomes with a different reviewed %s",
    async (_field, mutateStatus) => {
      const mismatchedStatus = buildReportBatchStatus();
      mutateStatus(mismatchedStatus);
      batchStatusMock.mockResolvedValue(
        parseReportBatchStatus(mismatchedStatus),
      );
      render(<ReportOrderingWorkspace portfolio={portfolio} />);
      await screen.findByRole("heading", { name: "Approved report" });
      fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
      fireEvent.click(
        screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Review Portfolio Bundle" }),
      );
      const submit = screen.getByRole("button", {
        name: "Submit Portfolio Bundle",
      });
      await waitFor(() => expect(submit).toBeEnabled());
      fireEvent.click(submit);

      expect(
        await screen.findByRole("heading", {
          name: "Current outcomes unavailable",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /returned report setup did not match the reviewed request/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("table", {
          name: "Portfolio report bundle outcomes",
        }),
      ).not.toBeInTheDocument();
    },
  );

  it("clears stale bundle selection when the report date changes", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("radio", { name: /Portfolio bundle/ }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Income Preservation Mandate/ }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Report date"), {
      target: { value: "2026-04-23" },
    });

    await waitFor(() =>
      expect(screen.getByText("1 selected")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Review Portfolio Bundle" }),
    ).toBeDisabled();
  });

  it("creates a second reviewed request with a fresh idempotency intent", async () => {
    submitMock.mockImplementation(async (order) => {
      const requestNumber = submitMock.mock.calls.length;
      return {
        report_request_id: `rrq_${requestNumber + 1}`,
        report_job_id: `rjob_${requestNumber + 1}`,
        status: "accepted",
        status_url: `/api/v1/report-jobs/rjob_${requestNumber + 1}`,
        idempotency_key: order.idempotencyKey,
      };
    });
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const firstSubmit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(firstSubmit).toBeEnabled());
    fireEvent.click(firstSubmit);
    await screen.findByRole("heading", { name: "Report request accepted" });

    fireEvent.click(
      screen.getByRole("button", { name: "Create another report" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Review Request" }),
    );
    const secondSubmit = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(secondSubmit).toBeEnabled());
    fireEvent.click(secondSubmit);

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(2));
    expect(submitMock.mock.calls[0][0].idempotencyKey).not.toBe(
      submitMock.mock.calls[1][0].idempotencyKey,
    );
    expect(
      await screen.findByRole("heading", { name: "Report request accepted" }),
    ).toBeInTheDocument();
    expect(screen.getByText("rjob_3")).toBeInTheDocument();
  });

  it("does not steal focus from a new request when the prior history refresh settles", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    await screen.findByRole("table", {
      name: "Recent portfolio report requests",
    });

    let resolveHistory: (() => void) | null = null;
    historyMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHistory = () => resolve(buildReportJobListResponse());
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submitButton = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);
    await screen.findByRole("heading", { name: "Report request accepted" });

    fireEvent.click(
      screen.getByRole("button", { name: "Create another report" }),
    );
    const configuration = await screen.findByRole("region", {
      name: "Report configuration",
    });
    await waitFor(() => expect(configuration).toHaveFocus());

    await act(async () => {
      resolveHistory?.();
    });
    await screen.findByRole("table", {
      name: "Recent portfolio report requests",
    });
    await waitFor(() => expect(configuration).toHaveFocus());
  });

  it("keeps recent report requests visible when support correlation is unavailable", async () => {
    const history = buildReportJobListResponse();
    history.items[0].correlationId = "";
    historyMock.mockResolvedValue(history);

    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    const recentRequests = await screen.findByRole("table", {
      name: "Recent portfolio report requests",
    });
    expect(
      within(recentRequests).getByText("Portfolio review"),
    ).toBeInTheDocument();
    expect(within(recentRequests).getByText("rjob_1")).toBeInTheDocument();
    expect(
      screen.queryByText("Recent requests unavailable"),
    ).not.toBeInTheDocument();
  });

  it("retains confirmed request history when the latest lifecycle check fails", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("table", {
      name: "Recent portfolio report requests",
    });
    historyMock.mockRejectedValueOnce(new Error("reporting unavailable"));

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(
        "The latest lifecycle check did not complete. Previously confirmed requests remain visible; use Refresh to check again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("rjob_1")).toHaveLength(2);
    expect(
      screen.queryByText("Recent requests unavailable"),
    ).not.toBeInTheDocument();
  });

  it("invalidates reviewed readiness after a business-date change", async () => {
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submitButton = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submitButton).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Report date"), {
      target: { value: "2026-04-23" },
    });

    expect(submitButton).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Review Request" }),
    ).toBeEnabled();
  });

  it("renders only setup controls published by the selected report family", async () => {
    const payload = buildReportOrderingResponse();
    payload.reportFamilies[0].configurationFields =
      payload.reportFamilies[0].configurationFields.filter(
        (field) => field.fieldId === "as_of_date",
      );
    payload.reportFamilies[0].sections = payload.reportFamilies[0].sections
      .filter((section) => section.sectionId !== "ADVISOR_COMMENTARY")
      .map((section) => ({ ...section, dependencyFieldIds: [] }));
    optionsMock.mockResolvedValue(parseReportOrderingResponse(payload));

    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(await screen.findByLabelText("Report date")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Reporting currency"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Comparison benchmark")).not.toBeInTheDocument();
    expect(screen.queryByText("Allocation views")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review Request" }),
    ).toBeEnabled();
  });

  it("renders an intentional permission state without exposing configuration controls", async () => {
    optionsMock.mockRejectedValue(
      new WorkbenchApiError("report ordering options", 403),
    );

    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(
      await screen.findByText("Report ordering is restricted"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not available for report ordering/),
    ).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(
      within(status).getByRole("heading", {
        name: "Report ordering restricted",
      }),
    ).toBeInTheDocument();
    expect(
      within(status).getByLabelText("Status Restricted"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Complete before review"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review Request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit Report Request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Approved report" }),
    ).not.toBeInTheDocument();
  });

  it("keeps source failure terminal in both workspace regions", async () => {
    optionsMock.mockRejectedValue(new Error("reporting unavailable"));

    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(
      await screen.findByText("Approved reports are unavailable"),
    ).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(
      within(status).getByRole("heading", {
        name: "Report ordering unavailable",
      }),
    ).toBeInTheDocument();
    expect(
      within(status).getByLabelText("Status Unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Complete before review"),
    ).not.toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Try Again" });
    expect(retryButton).toBeEnabled();
    expect(
      screen.queryByText("Loading report readiness"),
    ).not.toBeInTheDocument();
    expect(optionsMock).toHaveBeenCalledTimes(1);
    fireEvent.click(retryButton);
    await waitFor(() => expect(optionsMock).toHaveBeenCalledTimes(2));
  });

  it("renders an empty approved catalogue without configuration or request actions", async () => {
    const payload = buildReportOrderingResponse();
    payload.reportFamilies = [];
    optionsMock.mockResolvedValue(parseReportOrderingResponse(payload));

    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    const emptyPanels = await screen.findAllByText(
      "No approved reports available",
    );
    expect(emptyPanels).toHaveLength(2);
    const status = screen.getByRole("status");
    expect(
      within(status).getByLabelText("Status No approved reports"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Complete before review"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "No report is available for the selected portfolio and business role.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Approved report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review Request" }),
    ).not.toBeInTheDocument();
  });

  it("distinguishes incomplete setup from source availability", async () => {
    render(
      <ReportOrderingWorkspace
        portfolio={{ ...portfolio, asOfDate: "not-a-business-date" }}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Approved report" }),
    ).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(
      within(status).getByLabelText("Status Setup required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Complete before review")).toBeInTheDocument();
    expect(screen.getByText("Select a valid report date.")).toBeInTheDocument();
    const review = screen.getByRole("button", { name: "Review Request" });
    expect(review).toBeEnabled();
    fireEvent.click(review);
    const date = screen.getByLabelText("Report date");
    await waitFor(() => expect(date).toHaveFocus());
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Select a valid report date.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a report date within the available portfolio history.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit Report Request" }),
    ).toBeDisabled();
  });

  it("disables review actions while the reviewed request is submitting", async () => {
    let resolveSubmission:
      | ((
          value: Awaited<ReturnType<typeof submitPortfolioReviewOrder>>,
        ) => void)
      | null = null;
    submitMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmission = resolve;
      }),
    );
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submitButton = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(
      await within(screen.getByRole("status")).findByRole("heading", {
        name: "Submitting report request",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reviewed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();

    await act(async () => {
      resolveSubmission?.({
        report_request_id: "rrq_2",
        report_job_id: "rjob_2",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_2",
        idempotency_key: submitMock.mock.calls[0][0].idempotencyKey,
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Report request accepted" }),
    ).toBeInTheDocument();
  });

  it("preserves reviewed setup and offers an explicit retry after rejection", async () => {
    submitMock.mockRejectedValue(new Error("temporary unavailable"));
    render(<ReportOrderingWorkspace portfolio={portfolio} />);
    await screen.findByRole("heading", { name: "Approved report" });
    fireEvent.click(screen.getByRole("button", { name: "Review Request" }));
    const submitButton = screen.getByRole("button", {
      name: "Submit Report Request",
    });
    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByRole("heading", {
        name: "Report request not accepted",
      }),
    ).toBeInTheDocument();
    expect(
      within(alert).getByLabelText("Status Not accepted"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry Report Request" }),
    ).toBeEnabled();
  });

  it("presents source-workflow evidence without offering a false ordering control", async () => {
    const payload = buildReportOrderingResponse();
    optionsMock.mockResolvedValue(
      parseReportOrderingResponse({
        ...payload,
        reportFamilies: [
          ...payload.reportFamilies,
          {
            ...structuredClone(payload.reportFamilies[0]),
            reportFamilyId: "proof_pack",
            businessLabel: "Pre-trade decision evidence",
            description: "Decision evidence created during suitability review.",
            orderingModes: [
              {
                modeId: "source_workflow",
                businessLabel: "Advisory workflow",
                description:
                  "Created as part of an approved advisory decision.",
                defaultOutputFormat: "json",
                interactive: false,
                eligibility: {
                  state: "ready",
                  reasonCode: "source_workflow_ready",
                  message: "Created from its source business workflow.",
                },
              },
            ],
          },
        ],
      }),
    );

    render(<ReportOrderingWorkspace portfolio={portfolio} />);

    expect(
      await screen.findByText("Created through business workflows"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pre-trade decision evidence")).toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /Pre-trade decision evidence/ }),
    ).not.toBeInTheDocument();
  });
});
