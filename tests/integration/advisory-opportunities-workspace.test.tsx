import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdvisoryOpportunitiesWorkspace from "../../src/features/proposals/components/advisory-opportunities-workspace";
import type { IdeaPresentationReceiptDraft } from "../../src/features/proposals/idea-presentation-receipt";
import type { AdvisorIdeaReviewActionRequest } from "../../src/features/proposals/types";
import type { WorkspaceReviewContext } from "../../src/shell/review-context";

type MockGridRow = Record<string, unknown> & { candidateId: string };
type ReviewActionInput = {
  candidateId: string;
  request: AdvisorIdeaReviewActionRequest;
};
type PresentationReceiptInput = {
  candidateId: string;
  request: IdeaPresentationReceiptDraft;
};

type MockGridColumn = {
  cellRenderer?: React.ComponentType<{
    data: MockGridRow;
    value: unknown;
  }>;
  field?: string;
  headerName?: string;
  hide?: boolean;
};

const gridApiMock = vi.hoisted(() => ({
  ensureNodeVisible: vi.fn(),
  getDisplayedRowAtIndex: vi.fn(),
  getDisplayedRowCount: vi.fn(),
  getRowNode: vi.fn(),
  setGridAriaProperty: vi.fn(),
}));

vi.mock("ag-grid-react", () => ({
  AgGridReact: ({
    rowData = [],
    columnDefs = [],
    onGridReady,
    quickFilterText = "",
  }: {
    rowData?: MockGridRow[];
    columnDefs?: MockGridColumn[];
    onGridReady?: (event: { api: typeof gridApiMock }) => void;
    quickFilterText?: string;
  }) => {
    const normalizedFilter = quickFilterText.trim().toLowerCase();
    const displayedRows = normalizedFilter
      ? rowData.filter((row) =>
          JSON.stringify(row).toLowerCase().includes(normalizedFilter),
        )
      : rowData;
    gridApiMock.getRowNode.mockImplementation((candidateId: string) => {
      const data = rowData.find((row) => row.candidateId === candidateId);
      return data ? { data, id: candidateId } : undefined;
    });
    gridApiMock.getDisplayedRowCount.mockReturnValue(displayedRows.length);
    gridApiMock.getDisplayedRowAtIndex.mockImplementation((index: number) => {
      const data = displayedRows[index];
      return data ? { data, id: data.candidateId } : undefined;
    });
    onGridReady?.({ api: gridApiMock });
    const visibleColumns = columnDefs.filter((column) => !column.hide);
    return (
      <div role="grid" aria-label="Idea candidate review queue">
        <div role="row">
          {visibleColumns.map((column) => (
            <div role="columnheader" key={column.field ?? column.headerName}>
              {column.headerName}
            </div>
          ))}
        </div>
        {displayedRows.map((row) => (
          <div role="row" key={row.candidateId}>
            {visibleColumns.map((column) => {
              const value = column.field ? row[column.field] : undefined;
              const CellRenderer = column.cellRenderer;
              return (
                <div role="gridcell" key={column.field ?? column.headerName}>
                  {CellRenderer ? (
                    <CellRenderer data={row} value={value} />
                  ) : (
                    String(value ?? "")
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
}));

function reviewContext(portfolioId: string): WorkspaceReviewContext {
  return {
    portfolioId,
    asOfDate: "2026-04-10",
    period: "YTD",
    reportingCurrency: "SGD",
  };
}

const getAdvisorIdeaReviewQueueMock = vi.fn(
  async (filters?: { evaluatedAtUtc?: string }) => ({
    policyVersion: "idea-deterministic-ranking-v1",
    evaluatedAtUtc: filters?.evaluatedAtUtc ?? "2026-06-21T10:10:00Z",
    durableStorageBacked: true,
    supportedFeaturePromoted: false,
    exclusions: [],
    items: [
      {
        rank: 1,
        score: "82",
        priorityBucket: "high",
        reasonCodes: ["high_cash_ratio", "review_required"],
        candidate: {
          candidateId: "idea_high_cash_001",
          evidencePacketId: "evidence_high_cash_001",
          materialVersion: 1,
          evidenceVersion: 1,
          scorePolicyVersion: "idle-liquidity-v1",
          sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
          sourceCutPosture: "coherent",
          family: "high_cash",
          reviewPosture: "advisor_review_required",
          score: "82",
          sourceSignalIds: ["signal_high_cash_001"],
        },
      },
    ],
  }),
);
function candidateDetail(reviewDecisions: Array<Record<string, unknown>> = []) {
  return {
    candidate: {
      candidateId: "idea_high_cash_001",
      identity: {
        materialVersion: 1,
        evidenceVersion: 1,
      },
      family: "high_cash",
      lifecycleStatus: "generated",
      reviewPosture: "advisor_review_required",
    },
    evidence: {
      evidencePacketId: "evidence_high_cash_001",
      evidenceContentHash: `sha256:${"c".repeat(64)}`,
      sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
      sourceCutPosture: "coherent",
      supportability: "ready",
      sourceRefs: [{ productId: "lotus-core:PortfolioStateSnapshot:v1" }],
    },
    auditSummary: { eventCount: 1 },
    durableStorageBacked: true,
    supportedFeaturePromoted: false,
    reviewDecisions,
  };
}
const getAdvisorIdeaCandidateDetailMock = vi.fn(async (_filters?: unknown) =>
  candidateDetail(),
);
const recordAdvisorIdeaReviewActionMock = vi.fn(
  async (input?: ReviewActionInput) => ({
    reviewDecision: {
      reviewId: input?.request.reviewId,
      candidateId: input?.candidateId,
      evidencePacketId: input?.request.expectedEvidencePacketId,
      evidenceContentHash: input?.request.expectedEvidenceContentHash,
      sourceRevisionVectorDigest:
        input?.request.expectedSourceRevisionVectorDigest,
      sourceCutPosture: input?.request.expectedSourceCutPosture,
      candidateMaterialVersion: input?.request.expectedMaterialVersion,
      candidateEvidenceVersion: input?.request.expectedEvidenceVersion,
      reviewChannel: input?.request.reviewChannel,
      presentationReceiptId: input?.request.presentationReceiptId,
      action: input?.request.action,
      resultingPosture: "approved_for_conversion",
      reasonCodes: input?.request.reasonCodes,
      decidedAtUtc: input?.request.decidedAtUtc,
      acceptedAtUtc: "2026-09-24T01:00:01Z",
      acceptanceTimeSource: "server_accepted",
      grantsDownstreamAuthority: false,
    },
    persistence: { decision: "accepted" },
    durableStorageBacked: true,
    supportedFeaturePromoted: false,
  }),
);
const recordAdvisorIdeaFeedbackMock = vi.fn(async (_input?: unknown) => ({
  persistence: { decision: "accepted" },
  durableStorageBacked: true,
  supportedFeaturePromoted: false,
}));
const recordAdvisorIdeaConversionIntentMock = vi.fn(
  async (_input?: unknown) => ({
    persistence: { decision: "accepted" },
    durableStorageBacked: true,
    supportedFeaturePromoted: false,
  }),
);
const recordAdvisorIdeaPresentationReceiptMock = vi.fn(
  async (input?: PresentationReceiptInput) => ({
    receipt: {
      ...input?.request,
      tenantId: "tenant_demo_sg",
      receiptId: "presentation-receipt-001",
      candidateId: input?.candidateId,
      acceptedAtUtc: "2026-09-24T01:00:01Z",
      acceptanceTimeSource: "server_accepted",
      schemaVersion: "lotus-idea.candidate-presentation-receipt.v2",
      surface: "advisor_review_queue",
      producer: "lotus-workbench",
    },
    persistenceDecision: "accepted",
    durableStorageBacked: true,
  }),
);
vi.mock("../../src/features/proposals/api", () => ({
  getAdvisorIdeaCandidateDetail: (filters: unknown) =>
    getAdvisorIdeaCandidateDetailMock(filters),
  getAdvisorIdeaReviewQueue: (
    filters:
      | {
          evaluatedAtUtc?: string;
        }
      | undefined,
  ) => getAdvisorIdeaReviewQueueMock(filters),
  recordAdvisorIdeaReviewAction: (input: unknown) =>
    recordAdvisorIdeaReviewActionMock(input as ReviewActionInput),
  recordAdvisorIdeaFeedback: (input: unknown) =>
    recordAdvisorIdeaFeedbackMock(input),
  recordAdvisorIdeaConversionIntent: (input: unknown) =>
    recordAdvisorIdeaConversionIntentMock(input),
  recordAdvisorIdeaPresentationReceipt: (input: unknown) =>
    recordAdvisorIdeaPresentationReceiptMock(input as PresentationReceiptInput),
}));

vi.mock("../../src/features/proposals/use-idea-presentation-receipts", () => ({
  useIdeaPresentationReceipts: ({
    queue,
  }: {
    queue?: { items?: Array<{ candidate?: { candidateId?: string } }> };
  }) => ({
    status: "ready",
    failedCount: 0,
    retryFailed: vi.fn(),
    authorityByCandidateId: new Map(
      queue?.items?.some(
        (item) => item.candidate?.candidateId === "idea_high_cash_001",
      )
        ? [
            [
              "idea_high_cash_001",
              {
                candidateId: "idea_high_cash_001",
                receiptId: "presentation-receipt-001",
                evidencePacketId: "evidence_high_cash_001",
                candidateMaterialVersion: 1,
                candidateEvidenceVersion: 1,
                sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
                sourceCutPosture: "coherent",
              },
            ],
          ]
        : [],
    ),
  }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("AdvisoryOpportunitiesWorkspace", () => {
  beforeEach(() => {
    getAdvisorIdeaCandidateDetailMock.mockClear();
    getAdvisorIdeaReviewQueueMock.mockClear();
    recordAdvisorIdeaReviewActionMock.mockClear();
    recordAdvisorIdeaFeedbackMock.mockClear();
    recordAdvisorIdeaConversionIntentMock.mockClear();
    recordAdvisorIdeaPresentationReceiptMock.mockClear();
    gridApiMock.ensureNodeVisible.mockClear();
    gridApiMock.getRowNode.mockClear();
    gridApiMock.setGridAriaProperty.mockClear();
  });

  it("loads Gateway-backed Lotus Idea candidates", async () => {
    const mountedAfterUtc = Date.now();
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
      />,
    );

    await waitFor(() => {
      expect(getAdvisorIdeaReviewQueueMock).toHaveBeenCalledWith({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        evaluatedAtUtc: expect.any(String),
      });
    });
    const [{ evaluatedAtUtc }] = getAdvisorIdeaReviewQueueMock.mock
      .calls[0] as [{ evaluatedAtUtc: string }];
    expect(Date.parse(evaluatedAtUtc)).toBeGreaterThanOrEqual(mountedAfterUtc);
    expect(Date.parse(evaluatedAtUtc)).toBeLessThanOrEqual(Date.now());

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Opportunities And Ideas",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Idea candidates")).toHaveTextContent(
      /1\s*Idea candidates/,
    );
    expect(
      screen.getByLabelText("Idea worklist evidence status"),
    ).toHaveTextContent("Policy: idea-deterministic-ranking-v1");
    expect(
      await screen.findByRole("grid", { name: "Idea candidate review queue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Next decision" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: "Excess Cash - idea_high_cash_001",
      }),
    ).toHaveAttribute(
      "href",
      "/recommendations?mode=opportunities&portfolioId=PB_SG_GLOBAL_BAL_001&candidateId=idea_high_cash_001",
    );
    expect(screen.getByText("Advisor Review Required")).toBeInTheDocument();
    expect(screen.getByText("signal_high_cash_001")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Proposal Builder" }),
    ).toHaveAttribute(
      "href",
      "/proposals/simulate?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-10&period=YTD&reportingCurrency=SGD",
    );
  });

  it("does not manufacture queue presentation evidence from action controls", async () => {
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    const actionPanel = await screen.findByLabelText(
      "Idea candidate advisor actions",
    );
    expect(
      actionPanel.querySelector("[data-idea-presentation-candidate]"),
    ).toBeNull();
  });

  it("explains the supported opportunity-review scope in business language", () => {
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_UNCERTIFIED_001"
        reviewContext={reviewContext("PB_UNCERTIFIED_001")}
      />,
    );

    expect(
      screen.getByText(
        "Advisory opportunity review is not available for this portfolio",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select the supported demonstration portfolio before opening the opportunity queue.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("PB_SG_GLOBAL_BAL_001")).not.toBeInTheDocument();
    expect(getAdvisorIdeaReviewQueueMock).not.toHaveBeenCalled();
  });

  it("loads selected candidate detail through the scoped Gateway helper", async () => {
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    expect(
      await screen.findByLabelText("Idea candidate source-safe detail"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(getAdvisorIdeaCandidateDetailMock).toHaveBeenCalledWith({
        candidateId: "idea_high_cash_001",
        portfolioId: "PB_SG_GLOBAL_BAL_001",
      });
    });
    expect(screen.getByText("Lifecycle: Generated")).toBeInTheDocument();
    expect(screen.getByText("Sources: 1")).toBeInTheDocument();
    expect(
      screen.getByText("Source refs: lotus-core:PortfolioStateSnapshot:v1"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Source signals: signal_high_cash_001"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Queue policy: idea-deterministic-ranking-v1"),
    ).toBeInTheDocument();
    const [{ evaluatedAtUtc }] = getAdvisorIdeaReviewQueueMock.mock
      .calls[0] as [{ evaluatedAtUtc: string }];
    expect(
      screen.getByText(`Queue evaluated: ${evaluatedAtUtc}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Evidence hash: sha256:${"c".repeat(64)}`),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Close detail" })).toHaveAttribute(
      "href",
      "/recommendations?mode=opportunities&portfolioId=PB_SG_GLOBAL_BAL_001",
    );
    expect(gridApiMock.ensureNodeVisible).not.toHaveBeenCalled();
  });

  it("preserves an adviser filter until a completed action refresh needs renewal", async () => {
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    const filter = screen.getByRole("searchbox", {
      name: "Find an opportunity",
    });
    fireEvent.change(filter, { target: { value: "another candidate" } });

    expect(filter).toHaveValue("another candidate");
    expect(gridApiMock.ensureNodeVisible).not.toHaveBeenCalled();
  });

  it("withholds review authority when Gateway returns detail for another candidate", async () => {
    getAdvisorIdeaCandidateDetailMock.mockResolvedValueOnce({
      candidate: {
        candidateId: "idea_high_cash_other",
        identity: {
          materialVersion: 1,
          evidenceVersion: 1,
        },
        family: "high_cash",
        lifecycleStatus: "generated",
        reviewPosture: "advisor_review_required",
      },
      evidence: {
        evidencePacketId: "evidence_high_cash_001",
        evidenceContentHash: `sha256:${"c".repeat(64)}`,
        sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
        sourceCutPosture: "coherent",
        supportability: "ready",
        sourceRefs: [{ productId: "lotus-core:PortfolioStateSnapshot:v1" }],
      },
      auditSummary: { eventCount: 1 },
      durableStorageBacked: true,
      supportedFeaturePromoted: false,
      reviewDecisions: [],
    });

    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    expect(
      screen.getByRole("button", { name: "Record review" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));
    expect(recordAdvisorIdeaReviewActionMock).not.toHaveBeenCalled();
  });

  it("shows no fallback ideas when the Idea queue fails", async () => {
    getAdvisorIdeaReviewQueueMock.mockRejectedValueOnce(
      new Error("gateway unavailable"),
    );

    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
      />,
    );

    expect(
      await screen.findByText(
        "Idea candidates are unavailable. No fallback opportunity list is shown.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Idea queue unavailable")).toBeInTheDocument();
    expect(
      screen.queryByText("Excess Cash - idea_high_cash_001"),
    ).not.toBeInTheDocument();
  });

  it("records an advisor review through Gateway and refreshes source-owned detail", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    gridApiMock.ensureNodeVisible.mockClear();
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));

    await waitFor(() => {
      expect(recordAdvisorIdeaReviewActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: "idea_high_cash_001",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          request: expect.objectContaining({
            action: "approve_for_conversion",
            reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
          }),
        }),
      );
    });
    const recordedStatus = await screen.findByTestId(
      "idea-action-review-status",
    );
    expect(recordedStatus).toHaveAttribute(
      "data-action-state",
      "recorded-and-refreshed",
    );
    expect(recordedStatus).toHaveTextContent(
      "Review saved. Opportunity detail and worklist are current.",
    );
    expect(recordAdvisorIdeaConversionIntentMock).not.toHaveBeenCalled();
    expect(getAdvisorIdeaReviewQueueMock).toHaveBeenCalledTimes(2);
    const [initialFilters, refreshedFilters] = getAdvisorIdeaReviewQueueMock
      .mock.calls as [
      [{ evaluatedAtUtc: string }],
      [{ evaluatedAtUtc: string }],
    ];
    expect(Date.parse(refreshedFilters[0].evaluatedAtUtc)).toBeGreaterThan(
      Date.parse(initialFilters[0].evaluatedAtUtc),
    );
    await waitFor(() => {
      expect(gridApiMock.ensureNodeVisible).toHaveBeenCalledWith(
        expect.objectContaining({ id: "idea_high_cash_001" }),
        "middle",
      );
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        inline: "nearest",
      });
    });
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("clears a hiding filter when the refreshed boundary uses equivalent UTC precision", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const refreshedQueue = {
      policyVersion: "idea-deterministic-ranking-v1",
      evaluatedAtUtc: "2026-09-24T01:00:02Z",
      durableStorageBacked: true,
      supportedFeaturePromoted: false,
      exclusions: [],
      items: [
        {
          rank: 1,
          score: "82",
          priorityBucket: "high",
          reasonCodes: ["high_cash_ratio", "review_required"],
          candidate: {
            candidateId: "idea_high_cash_001",
            evidencePacketId: "evidence_high_cash_001",
            materialVersion: 1,
            evidenceVersion: 1,
            scorePolicyVersion: "idle-liquidity-v1",
            sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
            sourceCutPosture: "coherent",
            family: "high_cash",
            reviewPosture: "approved_for_conversion",
            score: "82",
            sourceSignalIds: ["signal_high_cash_001"],
          },
        },
      ],
    };
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    getAdvisorIdeaReviewQueueMock.mockImplementationOnce(async (filters) => ({
      ...refreshedQueue,
      evaluatedAtUtc: filters?.evaluatedAtUtc
        ? `${filters.evaluatedAtUtc.slice(0, -1)}0Z`
        : refreshedQueue.evaluatedAtUtc,
    }));
    const filter = screen.getByRole("searchbox", {
      name: "Find an opportunity",
    });
    fireEvent.change(filter, { target: { value: "advisor_review_required" } });
    expect(filter).toHaveValue("advisor_review_required");
    gridApiMock.ensureNodeVisible.mockClear();
    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));

    await waitFor(() => expect(filter).toHaveValue(""));
    await waitFor(() => {
      expect(gridApiMock.ensureNodeVisible).toHaveBeenCalledWith(
        expect.objectContaining({ id: "idea_high_cash_001" }),
        "middle",
      );
      expect(scrollIntoView).toHaveBeenCalled();
    });
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("warns when a recorded advisor action cannot refresh source-owned posture", async () => {
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    getAdvisorIdeaReviewQueueMock.mockRejectedValueOnce(
      new Error("source refresh unavailable"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));

    const refreshStatus = await screen.findByTestId(
      "idea-action-review-status",
    );
    expect(refreshStatus).toHaveAttribute(
      "data-action-state",
      "recorded-refresh-failed",
    );
    expect(refreshStatus).toHaveTextContent(
      "Review was saved, but the latest opportunity detail and worklist could not be loaded.",
    );
    expect(refreshStatus).not.toHaveTextContent(
      "Opportunity detail and worklist are current.",
    );
  });

  it("uses the exact durable approved review when the action removes the queue row", async () => {
    recordAdvisorIdeaConversionIntentMock
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({
        persistence: { decision: "replayed" },
        durableStorageBacked: true,
        supportedFeaturePromoted: false,
      });
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    getAdvisorIdeaCandidateDetailMock.mockImplementationOnce(async () => {
      const recordedRequest =
        recordAdvisorIdeaReviewActionMock.mock.calls[0]?.[0]?.request;
      if (!recordedRequest) {
        throw new Error("Expected the review request before detail refresh.");
      }
      return candidateDetail([
        {
          reviewId: recordedRequest.reviewId,
          candidateId: "idea_high_cash_001",
          evidencePacketId: recordedRequest.expectedEvidencePacketId,
          evidenceContentHash: recordedRequest.expectedEvidenceContentHash,
          sourceRevisionVectorDigest:
            recordedRequest.expectedSourceRevisionVectorDigest,
          sourceCutPosture: recordedRequest.expectedSourceCutPosture,
          candidateMaterialVersion: recordedRequest.expectedMaterialVersion,
          candidateEvidenceVersion: recordedRequest.expectedEvidenceVersion,
          reviewChannel: recordedRequest.reviewChannel,
          presentationReceiptId: recordedRequest.presentationReceiptId,
          action: recordedRequest.action,
          resultingPosture: "approved_for_conversion",
          reasonCodes: recordedRequest.reasonCodes,
          decidedAtUtc: recordedRequest.decidedAtUtc,
          acceptedAtUtc: "2026-09-24T01:00:01Z",
          acceptanceTimeSource: "server_accepted",
          grantsDownstreamAuthority: false,
        },
      ]);
    });
    getAdvisorIdeaReviewQueueMock.mockResolvedValueOnce({
      policyVersion: "idea-deterministic-ranking-v1",
      evaluatedAtUtc: "2026-09-24T01:00:02Z",
      durableStorageBacked: true,
      supportedFeaturePromoted: false,
      exclusions: [],
      items: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));

    const recordedStatus = await screen.findByTestId(
      "idea-action-review-status",
    );
    expect(recordedStatus).toHaveAttribute(
      "data-action-state",
      "recorded-and-refreshed",
    );
    expect(recordedStatus).toHaveTextContent(
      "Review saved. Opportunity detail and worklist are current.",
    );
    expect(recordedStatus).not.toHaveTextContent("could not be loaded");
    const acceptedReviewRequest =
      recordAdvisorIdeaReviewActionMock.mock.calls[0]?.[0]?.request;
    expect(acceptedReviewRequest).toBeDefined();
    const conversionButton = screen.getByRole("button", {
      name: "Record intent",
    });
    expect(conversionButton).toBeEnabled();
    fireEvent.click(conversionButton);
    await waitFor(() =>
      expect(recordAdvisorIdeaConversionIntentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: "idea_high_cash_001",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          request: expect.objectContaining({
            expectedReviewId: acceptedReviewRequest?.reviewId,
            expectedEvidencePacketId:
              acceptedReviewRequest?.expectedEvidencePacketId,
            expectedEvidenceContentHash:
              acceptedReviewRequest?.expectedEvidenceContentHash,
            expectedSourceRevisionVectorDigest:
              acceptedReviewRequest?.expectedSourceRevisionVectorDigest,
            expectedSourceCutPosture:
              acceptedReviewRequest?.expectedSourceCutPosture,
          }),
        }),
      ),
    );
    const firstConversion =
      recordAdvisorIdeaConversionIntentMock.mock.calls[0]?.[0];
    const retry = await screen.findByTestId("idea-conversion-retry");
    fireEvent.click(
      within(retry).getByRole("button", {
        name: "Retry exact conversion intent",
      }),
    );
    await waitFor(() =>
      expect(recordAdvisorIdeaConversionIntentMock).toHaveBeenCalledTimes(2),
    );
    expect(recordAdvisorIdeaConversionIntentMock.mock.calls[1]?.[0]).toEqual(
      firstConversion,
    );
  });

  it("shows an explicit failure state when Gateway cannot record an action", async () => {
    recordAdvisorIdeaFeedbackMock.mockRejectedValueOnce(
      new Error("gateway unavailable"),
    );
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    fireEvent.click(screen.getByRole("button", { name: "Record feedback" }));

    const error = await screen.findByTestId("idea-action-error");
    expect(error).toHaveAttribute("data-action-state", "not-recorded");
    expect(error).toHaveTextContent(
      "Workbench could not verify the saved feedback against source evidence.",
    );
  });

  it("retries a failed advisor action with the original idempotent submission", async () => {
    recordAdvisorIdeaReviewActionMock.mockRejectedValueOnce(
      new Error("gateway unavailable"),
    );
    renderWithQueryClient(
      <AdvisoryOpportunitiesWorkspace
        portfolioId="PB_SG_GLOBAL_BAL_001"
        reviewContext={reviewContext("PB_SG_GLOBAL_BAL_001")}
        selectedCandidateId="idea_high_cash_001"
      />,
    );

    await screen.findByLabelText("Idea candidate advisor actions");
    const reviewForm = screen
      .getByRole("heading", { name: "Record review" })
      .closest("form");
    expect(reviewForm).not.toBeNull();
    const reviewControls = within(reviewForm!);
    fireEvent.click(
      reviewControls.getByRole("button", { name: "Record review" }),
    );

    const recovery = await screen.findByTestId("idea-review-retry");
    expect(recovery).toHaveAttribute(
      "data-action-state",
      "outcome-not-confirmed",
    );
    expect(recovery).toHaveTextContent("Approve for conversion review");
    expect(recovery).toHaveTextContent("Cash balance requires review");
    const firstSubmission = recordAdvisorIdeaReviewActionMock.mock.calls[0][0];
    fireEvent.click(
      within(recovery).getByRole("button", { name: "Retry exact review" }),
    );

    await waitFor(() => {
      expect(recordAdvisorIdeaReviewActionMock).toHaveBeenCalledTimes(2);
    });
    expect(recordAdvisorIdeaReviewActionMock.mock.calls[1][0]).toEqual(
      firstSubmission,
    );
  });
});
