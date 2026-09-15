import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as browserWorkflowModule from "../../scripts/live/validation/browser-workflows.mjs";
import { DEFAULT_PANEL_REGISTRY } from "../../scripts/live/validation/contract-metadata.mjs";

const {
  assertClientContextMandateProof,
  assertCanonicalIdeaPresentationReceiptEvidence,
  buildPreparedProofPackSourceProof,
  buildProofPackMemoSourceProof,
  buildReportCentreProofPosture,
  buildOutcomeReviewSourceEvidenceProof,
  buildProposalListSourceRows,
  assertWorkspaceReviewContextPreserved,
  classifyAttributionDetailEvidence,
  classifyContributionDetailEvidence,
  classifyPerformanceEvidenceScreenshotState,
  classifyAdvisoryJourneyScreenshotState,
  classifyDiscussionPackJourneyEvidence,
  classifyRegisteredPanelScreenshotState,
  canonicalIdeaOpportunitiesRoute,
  createBrowserValidationHelpers,
  classifyAdvisorBriefAcceptProofPosture,
  hasAcceptedAdvisorBriefReviewPosture,
  hasRecordedAdvisorBriefAcceptProof,
  readAdvisorBriefReviewEvidence,
  waitForAdvisorBriefReviewConfirmation,
  navigateForBusinessProof,
  resolveHighCashIdeaCandidateId,
  requireHighCashIdeaCandidateId,
  validateAdvisorBriefPanel,
  validateAdvisoryJourneyScreens,
  validatePmOperatingQualityPanel,
} = browserWorkflowModule as unknown as {
  assertClientContextMandateProof: (proof: {
    sourceValue: string;
    renderedValue: string;
  }) => { sourceMandate: string; renderedMandate: string };
  assertCanonicalIdeaPresentationReceiptEvidence: (input: {
    expectedCandidateId: string;
    expectedSourceLineage: {
      sourceRevisionVectorDigest: string;
      sourceCutPosture: string;
    };
    idempotencyKey: string | null;
    requestBody: unknown;
    responseBody: unknown;
  }) => Record<string, unknown>;
  buildPreparedProofPackSourceProof: (sourceResponse: unknown) => {
    proofPackId: string;
    sectionCount: number;
  };
  buildProofPackMemoSourceProof: (
    sourceResponse: unknown,
    expectedProofPackId: string,
  ) => { proofPackId: string; workflowPackRunId: string };
  buildReportCentreProofPosture: (pdfOutputReady: boolean) => {
    panelState: "partial";
    outputFormat: "json" | "pdf";
    pdfOutputState: "ready" | "unavailable";
    reason: string;
  };
  buildOutcomeReviewSourceEvidenceProof: (sourceReview: unknown) => {
    expectedAvailability: "Available" | "Not available";
    realizedAvailability: "Available" | "Not available";
    proofPackAvailability: "Available" | "Not available";
    sourceEvidenceStatus: "Available" | "Partial" | "Not available";
  };
  buildProposalListSourceRows: (
    value: unknown,
    expectedPortfolioId: string,
  ) => Array<{ source: string; identity: string; state: string }>;
  assertWorkspaceReviewContextPreserved: (input: {
    currentHref: string;
    destinationHref: string;
  }) => void;
  classifyAttributionDetailEvidence: (counts: {
    detailTableCount: number;
    summaryTableCount: number;
    partialFallbackCount: number;
    readyEmptyStateCount: number;
  }) =>
    | "detail_rows"
    | "summary_fallback"
    | "governed_partial_fallback"
    | "ready_empty_state";
  classifyContributionDetailEvidence: (evidence: {
    positionTableVisible: boolean;
    segmentTableVisible: boolean;
    governedPartialVisible: boolean;
  }) => "position_rows" | "segment_rows" | "governed_partial";
  classifyPerformanceEvidenceScreenshotState: (
    assuranceState: string | null,
  ) => "demo_ready" | "truthfully_degraded";
  classifyAdvisoryJourneyScreenshotState: (
    state: string | null,
  ) => "demo_ready" | "truthfully_degraded";
  classifyDiscussionPackJourneyEvidence: (counts: {
    selectedRecordCount: number;
    emptyStateCount: number;
  }) => "ready" | "empty";
  classifyRegisteredPanelScreenshotState: (
    panelState: string | null,
    requiredSupportState: string | null,
  ) => "demo_ready" | "truthfully_degraded";
  canonicalIdeaOpportunitiesRoute: (input: {
    workbenchBaseUrl: string;
    portfolioId: string;
    candidateId: string;
  }) => string;
  createBrowserValidationHelpers: typeof import("../../scripts/live/validation/browser-workflows.mjs").createBrowserValidationHelpers;
  classifyAdvisorBriefAcceptProofPosture: (
    evidence: AdvisorBriefReviewEvidence,
    expectedReviewer: string,
  ) =>
    | "source-confirmed-existing-action"
    | "accepted-by-another-reviewer"
    | "review-action-unavailable"
    | "review-action-available";
  hasAcceptedAdvisorBriefReviewPosture: (evidence: AdvisorBriefReviewEvidence) => boolean;
  hasRecordedAdvisorBriefAcceptProof: (
    evidence: AdvisorBriefReviewEvidence,
    expectedReviewer: string,
  ) => boolean;
  readAdvisorBriefReviewEvidence: (supportabilityRegion: {
    getByTestId: (testId: string) => {
      count: () => Promise<number>;
      first: () => {
        getAttribute: (name: string) => Promise<string | null>;
      };
    };
  }) => Promise<AdvisorBriefReviewEvidence>;
  waitForAdvisorBriefReviewConfirmation: (
    reviewRegion: {
      getByRole: (role: "alert" | "status") => {
        count: () => Promise<number>;
        isVisible: () => Promise<boolean>;
        textContent: () => Promise<string | null>;
      };
    },
    options: {
      timeoutMs: number;
      pollIntervalMs?: number;
      wait?: (delayMs: number) => Promise<void>;
    },
  ) => Promise<void>;
  navigateForBusinessProof: (
    page: {
      goto: (
        route: string,
        options: { timeout: number; waitUntil: string },
      ) => Promise<{ ok: () => boolean; status: () => number } | null>;
    },
    route: string,
    options: { timeout: number },
  ) => Promise<{ ok: () => boolean; status: () => number }>;
  resolveHighCashIdeaCandidateId: (
    candidateHref: string | null,
    workbenchBaseUrl: string,
  ) => string;
  requireHighCashIdeaCandidateId: (candidateId: string | null) => string;
  validateAdvisorBriefPanel: (...args: unknown[]) => Promise<void>;
  validateAdvisoryJourneyScreens: (...args: unknown[]) => Promise<void>;
  validatePmOperatingQualityPanel: (...args: unknown[]) => Promise<void>;
};

type AdvisorBriefReviewEvidence = {
  rowCount: number;
  reviewState: string | null;
  supportability: string | null;
  reviewer: string | null;
  recordedAt: string | null;
};

const ACCEPTED_REVIEW_EVIDENCE: AdvisorBriefReviewEvidence = {
  rowCount: 1,
  reviewState: "ACCEPTED",
  supportability: "READY",
  reviewer: "live.validator.ui",
  recordedAt: "2026-04-21T03:22:00Z",
};

describe("live validation browser workflow helpers", () => {
  describe("Client Context mandate proof", () => {
    it("accepts presentation-only case and source separator differences", () => {
      expect(
        assertClientContextMandateProof({
          sourceValue: "DISCRETIONARY_ADVISORY",
          renderedValue: "Discretionary Advisory",
        }),
      ).toEqual({
        sourceMandate: "DISCRETIONARY_ADVISORY",
        renderedMandate: "Discretionary Advisory",
      });
    });

    it("rejects a stale rendered fact even when both values are non-empty", () => {
      expect(() =>
        assertClientContextMandateProof({
          sourceValue: "DISCRETIONARY",
          renderedValue: "Advisory",
        }),
      ).toThrow(
        "Client Context: Mandate rendered Advisory, but Gateway supplied DISCRETIONARY.",
      );
    });

    it.each([
      ["sourceValue", "", "Client Context: Mandate returned no source value."],
      ["renderedValue", "", "Client Context: Mandate returned no rendered value."],
    ] as const)("rejects missing %s", (field, value, message) => {
      expect(() =>
        assertClientContextMandateProof({
          sourceValue: field === "sourceValue" ? value : "DISCRETIONARY",
          renderedValue: field === "renderedValue" ? value : "Discretionary",
        }),
      ).toThrow(message);
    });
  });

  describe("Outcome Review source evidence proof", () => {
    it("derives complete evidence from one Gateway review record", () => {
      expect(
        buildOutcomeReviewSourceEvidenceProof({
          outcome_review_id: "or-complete",
          expected_snapshot: {
            source_hashes: { expected: "sha256:expected" },
          },
          realized_snapshot: {
            source_hashes: { realized: "sha256:realized" },
          },
          proof_pack_id: "proof-pack-1",
          source_lineage: [{ source_system: "lotus-performance" }],
        }),
      ).toEqual({
        outcomeReviewId: "or-complete",
        expectedSnapshotHash: "sha256:expected",
        realizedSnapshotHash: "sha256:realized",
        expectedAvailability: "Available",
        realizedAvailability: "Available",
        proofPackAvailability: "Available",
        sourceEvidenceStatus: "Available",
      });
    });

    it("keeps missing and malformed source evidence explicit", () => {
      expect(
        buildOutcomeReviewSourceEvidenceProof({
          outcome_review_id: "or-partial",
          expected_snapshot: {
            source_hashes: { expected: "not-a-source-hash" },
          },
          proof_pack_id: "proof-pack-1",
        }),
      ).toEqual({
        outcomeReviewId: "or-partial",
        expectedSnapshotHash: "N/A",
        realizedSnapshotHash: "N/A",
        expectedAvailability: "Not available",
        realizedAvailability: "Not available",
        proofPackAvailability: "Available",
        sourceEvidenceStatus: "Partial",
      });
    });

    it("rejects proof without one atomic Gateway review record", () => {
      expect(() => buildOutcomeReviewSourceEvidenceProof(null)).toThrow(
        /requires one Gateway source record/i,
      );
      expect(() => buildOutcomeReviewSourceEvidenceProof([])).toThrow(
        /requires one Gateway source record/i,
      );
      expect(() =>
        buildOutcomeReviewSourceEvidenceProof({
          expected_snapshot: {
            source_hashes: { expected: "sha256:expected" },
          },
        }),
      ).toThrow(/requires a source-owned outcome review identity/i);
    });
  });

  describe("Evidence Pack generation source proof", () => {
    const sourceResponse = {
      source_service: "lotus-manage",
      supportability: {
        proof_pack_id: "dpp_123",
        markdown_available: true,
        report_input_available: true,
        ai_evidence_input_available: true,
      },
      data: {
        proof_pack: {
          proof_pack_id: "dpp_123",
          sections: [{ section_id: "decision" }, { section_id: "lineage" }],
        },
      },
    };

    it("binds one Manage-owned response identity to its rendered section count", () => {
      expect(buildPreparedProofPackSourceProof(sourceResponse)).toEqual({
        proofPackId: "dpp_123",
        sectionCount: 2,
      });
    });

    it.each([
      [
        "wrong source authority",
        { ...sourceResponse, source_service: "lotus-workbench" },
        /lotus-manage source authority/i,
      ],
      [
        "mismatched identity",
        {
          ...sourceResponse,
          supportability: {
            ...sourceResponse.supportability,
            proof_pack_id: "dpp_other",
          },
        },
        /mismatched source and supportability identity/i,
      ],
      [
        "missing sections",
        {
          ...sourceResponse,
          data: { proof_pack: { proof_pack_id: "dpp_123", sections: [] } },
        },
        /no reviewable evidence areas/i,
      ],
      [
        "memo unavailable",
        {
          ...sourceResponse,
          supportability: {
            ...sourceResponse.supportability,
            ai_evidence_input_available: false,
          },
        },
        /memo availability/i,
      ],
    ])("rejects %s", (_case, response, message) => {
      expect(() => buildPreparedProofPackSourceProof(response)).toThrow(message);
    });
  });

  describe("Evidence Pack memo source proof", () => {
    const sourceResponse = {
      source_service: "lotus-ai",
      evidence_source_service: "lotus-manage",
      supportability: { proof_pack_id: "dpp_123" },
      ai_evidence_input: { proof_pack_id: "dpp_123" },
      data: {
        execution: {
          result: { structured_output: { proof_pack_id: "dpp_123" } },
        },
        workflow_pack_run: { run_id: "packrun_123" },
      },
    };

    it("binds the AI workflow run to the exact prepared evidence pack", () => {
      expect(
        buildProofPackMemoSourceProof(sourceResponse, "dpp_123"),
      ).toEqual({
        proofPackId: "dpp_123",
        workflowPackRunId: "packrun_123",
      });
    });

    it.each([
      [
        "wrong evidence authority",
        { ...sourceResponse, evidence_source_service: "lotus-workbench" },
        /preserve AI and evidence source authority/i,
      ],
      [
        "mismatched generated output",
        {
          ...sourceResponse,
          data: {
            ...sourceResponse.data,
            execution: {
              result: { structured_output: { proof_pack_id: "dpp_other" } },
            },
          },
        },
        /not bound to the prepared proof-pack identity/i,
      ],
      [
        "missing workflow run",
        {
          ...sourceResponse,
          data: { ...sourceResponse.data, workflow_pack_run: {} },
        },
        /no workflow-pack run identity/i,
      ],
    ])("rejects %s", (_case, response, message) => {
      expect(() =>
        buildProofPackMemoSourceProof(response, "dpp_123"),
      ).toThrow(message);
    });
  });

  it.each([
    [
      "position rows",
      {
        positionTableVisible: true,
        segmentTableVisible: false,
        governedPartialVisible: false,
      },
      "position_rows",
    ],
    [
      "aggregate segment rows",
      {
        positionTableVisible: false,
        segmentTableVisible: true,
        governedPartialVisible: false,
      },
      "segment_rows",
    ],
    [
      "governed partial detail",
      {
        positionTableVisible: false,
        segmentTableVisible: false,
        governedPartialVisible: true,
      },
      "governed_partial",
    ],
  ])("classifies %s as source-backed contribution evidence", (_case, evidence, expected) => {
    expect(classifyContributionDetailEvidence(evidence)).toBe(expected);
  });

  it.each([
    [
      "missing evidence",
      {
        positionTableVisible: false,
        segmentTableVisible: false,
        governedPartialVisible: false,
      },
    ],
    [
      "ambiguous evidence",
      {
        positionTableVisible: true,
        segmentTableVisible: true,
        governedPartialVisible: false,
      },
    ],
  ])("rejects %s for contribution detail", (_case, evidence) => {
    expect(() => classifyContributionDetailEvidence(evidence)).toThrow(
      /invalid or ambiguous source state/iu,
    );
  });

  it("derives exact proposal identities and states from the requested Gateway portfolio", () => {
    expect(
      buildProposalListSourceRows(
        {
          data: {
            items: [
              {
                proposal_id: "PRP-RISK",
                portfolio_id: "PB_SG_GLOBAL_BAL_001",
                current_state: "RISK_REVIEW",
              },
              {
                proposal_id: "PRP-READY",
                portfolio_id: "PB_SG_GLOBAL_BAL_001",
                current_state: "EXECUTION_READY",
              },
            ],
          },
        },
        "PB_SG_GLOBAL_BAL_001",
      ),
    ).toEqual([
      {
        source: "proposal-list",
        identity: "PRP-RISK",
        state: "RISK_REVIEW",
      },
      {
        source: "proposal-list",
        identity: "PRP-READY",
        state: "EXECUTION_READY",
      },
    ]);
  });

  it.each([
    ["missing envelope", null],
    ["missing item list", { data: {} }],
    [
      "wrong portfolio row",
      {
        data: {
          items: [
            {
              proposal_id: "PRP-OTHER",
              portfolio_id: "PB_OTHER",
              current_state: "DRAFT",
            },
          ],
        },
      },
    ],
    [
      "missing source state",
      {
        data: {
          items: [
            {
              proposal_id: "PRP-RISK",
              portfolio_id: "PB_SG_GLOBAL_BAL_001",
            },
          ],
        },
      },
    ],
  ])("rejects proposal proof with %s", (_case, response) => {
    expect(() =>
      buildProposalListSourceRows(response, "PB_SG_GLOBAL_BAL_001"),
    ).toThrow(/proposal list/iu);
  });

  it("preserves every active workspace review-context field in proposal navigation", () => {
    expect(() =>
      assertWorkspaceReviewContextPreserved({
        currentHref:
          "/proposals?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-10&period=YTD&reportingCurrency=SGD",
        destinationHref:
          "/proposals/PRP-RISK?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-10&period=YTD&reportingCurrency=SGD",
      }),
    ).not.toThrow();
  });

  it.each([
    [
      "missing portfolio",
      "/proposals/PRP-RISK?asOfDate=2026-04-10&period=YTD&reportingCurrency=SGD",
    ],
    [
      "substituted portfolio",
      "/proposals/PRP-RISK?portfolioId=PB_OTHER&asOfDate=2026-04-10&period=YTD&reportingCurrency=SGD",
    ],
    [
      "dropped business date",
      "/proposals/PRP-RISK?portfolioId=PB_SG_GLOBAL_BAL_001&period=YTD&reportingCurrency=SGD",
    ],
  ])("rejects proposal navigation with %s", (_case, destinationHref) => {
    expect(() =>
      assertWorkspaceReviewContextPreserved({
        currentHref:
          "/proposals?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-10&period=YTD&reportingCurrency=SGD",
        destinationHref,
      }),
    ).toThrow(/did not preserve governed/iu);
  });

  it("navigates on document readiness and preserves the caller timeout", async () => {
    const response = { ok: () => true, status: () => 200 };
    const goto = vi.fn().mockResolvedValue(response);

    await expect(
      navigateForBusinessProof(
        { goto },
        "http://workbench.dev.lotus/book?asOfDate=2026-04-10",
        { timeout: 60_000 },
      ),
    ).resolves.toBe(response);
    expect(goto).toHaveBeenCalledWith(
      "http://workbench.dev.lotus/book?asOfDate=2026-04-10",
      { timeout: 60_000, waitUntil: "domcontentloaded" },
    );
  });

  it.each([
    ["missing document response", null, /returned no document response/],
    [
      "source HTTP failure",
      { ok: () => false, status: () => 503 },
      /failed.*HTTP 503/,
    ],
  ])("fails closed for %s", async (_case, response, expectedError) => {
    const goto = vi.fn().mockResolvedValue(response);

    await expect(
      navigateForBusinessProof(
        { goto },
        "http://workbench.dev.lotus/book?asOfDate=2026-04-10",
        { timeout: 60_000 },
      ),
    ).rejects.toThrow(expectedError);
  });

  it("routes canonical navigation through the governed readiness helper", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/live/validation/browser-workflows.mjs"),
      "utf8",
    );

    expect(source.match(/page\.goto\(/g)).toHaveLength(1);
    expect(source).not.toContain("networkidle");
  });

  it("counts semantic list items whether their role is implicit or explicit", () => {
    const source = createBrowserValidationHelpers.toString();

    expect(source).toContain('locator.getByRole("listitem").count()');
    expect(source).not.toContain("locator.locator('[role=\"listitem\"]')");
  });

  it("counts only rendered data rows for virtualized grids", () => {
    const source = createBrowserValidationHelpers.toString();

    expect(source).toContain(
      "locator.locator('[role=\"row\"]:has([role=\"gridcell\"])')",
    );
    expect(source).toContain('kind: "grid"');
  });

  it("waits for the source-backed Portfolio Review decision brief", () => {
    const source = browserWorkflowModule.validatePortfolioPanels.toString();

    expect(source).toContain('name: "Review context"');
    expect(source).toContain('getByTestId("review-context-strip")');
    expect(source).toContain('reviewContextStrip.locator("strong").first()');
    expect(source).toContain("portfolioId");
    expect(source).toContain('reviewContext.getByText("Mandate"');
    expect(source).toContain('reviewContext.getByText("Business date"');
    expect(source).not.toContain("Balanced Mandate");
    expect(source).toContain('".workbench-decision-brief-primary h3"');
    expect(source).toContain('"Portfolio readiness"');
    expect(source).toContain("/^Status (Ready|Partial|Unavailable)$/");
    expect(source).toContain('"Reporting coverage"');
  });

  it("binds PM operating-quality browser proof to source ids and explicit state", () => {
    const source = validatePmOperatingQualityPanel.toString();

    expect(source).toMatch(
      /getByTestId\(\s*"pm-operating-quality-source-evidence"/,
    );
    expect(source).toMatch(/"data-panel-state",\s*"ready"/);
    expect(source).toMatch(/"data-attention-state",\s*"clear"/);
    expect(source).toMatch(/"data-source-service",\s*"lotus-manage"/);
    expect(source).toMatch(/"data-score-run-id",\s*expectedEvidence\.scoreRunId/);
    expect(source).toMatch(
      /"data-fairness-analysis-id",\s*expectedEvidence\.fairnessAnalysisId/,
    );
    expect(source).toMatch(
      /"data-score-run-state",\s*expectedEvidence\.scoreRunState/,
    );
    expect(source).toMatch(
      /"data-fairness-analysis-state",\s*expectedEvidence\.fairnessAnalysisState/,
    );
    expect(source).not.toContain("/^(?!N\\/A$).+/");
    expect(source).not.toContain("Latest Score Run");
    expect(source).not.toContain('"Fairness Analysis"');
  });

  it("uses the governed live timeout while attribution history settles", () => {
    const source = browserWorkflowModule.validatePerformanceAnalysisPanel.toString();

    expect(source).toMatch(
      /not\.toHaveAttribute\(\s*"data-state",\s*"loading",\s*\{ timeout: timeoutMs \}/,
    );
    expect(source).toContain('attributionTrendPosture === "error"');
    expect(source).toContain("Attribution history could not be refreshed");
    expect(source).toContain('name: "Refresh history"');
    expect(source).toContain("Attribution history exact-selection recovery");
  });

  it.each([
    ["ready", "demo_ready"],
    ["attention", "truthfully_degraded"],
    ["incomplete", "truthfully_degraded"],
    ["unavailable", "truthfully_degraded"],
    [null, "truthfully_degraded"],
  ] as const)("classifies %s evidence screenshot posture as %s", (state, expected) => {
    expect(classifyPerformanceEvidenceScreenshotState(state)).toBe(expected);
  });

  it.each([
    ["ready", "demo_ready"],
    ["empty", "truthfully_degraded"],
    ["partial", "truthfully_degraded"],
    [null, "truthfully_degraded"],
  ] as const)(
    "classifies %s advisory journey evidence as %s",
    (state, expected) => {
      expect(classifyAdvisoryJourneyScreenshotState(state)).toBe(expected);
    },
  );

  it.each([
    [{ selectedRecordCount: 1, emptyStateCount: 0 }, "ready"],
    [{ selectedRecordCount: 0, emptyStateCount: 1 }, "empty"],
  ] as const)(
    "classifies discussion-pack source evidence as %s",
    (counts, expected) => {
      expect(classifyDiscussionPackJourneyEvidence(counts)).toBe(expected);
    },
  );

  it.each([
    { selectedRecordCount: 0, emptyStateCount: 0 },
    { selectedRecordCount: 1, emptyStateCount: 1 },
    { selectedRecordCount: 2, emptyStateCount: 0 },
  ])("rejects ambiguous discussion-pack evidence %#", (counts) => {
    expect(() => classifyDiscussionPackJourneyEvidence(counts)).toThrow(
      "Discussion pack rendered an ambiguous source state",
    );
  });

  it.each([
    ["ready", "ready", "demo_ready"],
    ["partial", "partial", "demo_ready"],
    ["partial", "ready", "truthfully_degraded"],
    [null, "ready", "truthfully_degraded"],
  ] as const)(
    "classifies panel state %s against required state %s as %s",
    (panelState, requiredState, expected) => {
      expect(classifyRegisteredPanelScreenshotState(panelState, requiredState)).toBe(expected);
    }
  );

  it.each([
    [{ detailTableCount: 1, summaryTableCount: 0, partialFallbackCount: 0, readyEmptyStateCount: 0 }, "detail_rows"],
    [{ detailTableCount: 0, summaryTableCount: 1, partialFallbackCount: 0, readyEmptyStateCount: 0 }, "summary_fallback"],
    [{ detailTableCount: 0, summaryTableCount: 0, partialFallbackCount: 1, readyEmptyStateCount: 0 }, "governed_partial_fallback"],
    [{ detailTableCount: 0, summaryTableCount: 0, partialFallbackCount: 0, readyEmptyStateCount: 1 }, "ready_empty_state"],
  ] as const)("classifies attribution detail evidence as %s", (counts, expected) => {
    expect(classifyAttributionDetailEvidence(counts)).toBe(expected);
  });

  it("rejects attribution detail without rows or a governed fallback", () => {
    expect(() =>
      classifyAttributionDetailEvidence({
        detailTableCount: 0,
        summaryTableCount: 0,
        partialFallbackCount: 0,
        readyEmptyStateCount: 0,
      }),
    ).toThrow("neither source rows nor a governed fallback state");
  });

  it("reads one atomic review record without depending on concatenated DOM text", async () => {
    const attributes = new Map([
      ["data-review-state", "ACCEPTED"],
      ["data-review-supportability", "READY"],
      ["data-reviewer", "live.validator.ui"],
      ["data-recorded-at", "2026-04-21T03:22:00Z"],
    ]);
    const getAttribute = vi.fn((name: string) => Promise.resolve(attributes.get(name) ?? null));
    const first = vi.fn(() => ({ getAttribute }));
    const count = vi.fn().mockResolvedValue(1);
    const getByTestId = vi.fn(() => ({ count, first }));

    await expect(readAdvisorBriefReviewEvidence({ getByTestId })).resolves.toEqual(
      ACCEPTED_REVIEW_EVIDENCE,
    );
    expect(getByTestId).toHaveBeenCalledWith("advisor-brief-human-review-evidence");
    expect(getAttribute).toHaveBeenCalledTimes(4);
  });

  it.each([0, 2])("rejects %i atomic review evidence rows", async (rowCount) => {
    const getAttribute = vi.fn();
    const getByTestId = vi.fn(() => ({
      count: vi.fn().mockResolvedValue(rowCount),
      first: vi.fn(() => ({ getAttribute })),
    }));

    const evidence = await readAdvisorBriefReviewEvidence({ getByTestId });

    expect(evidence).toEqual({
      rowCount,
      reviewState: null,
      supportability: null,
      reviewer: null,
      recordedAt: null,
    });
    expect(getAttribute).not.toHaveBeenCalled();
    expect(classifyAdvisorBriefAcceptProofPosture(evidence, "live.validator.ui")).toBe(
      "review-action-unavailable",
    );
  });

  it("accepts only a complete, source-recorded Advisor Brief review", () => {
    expect(hasAcceptedAdvisorBriefReviewPosture(ACCEPTED_REVIEW_EVIDENCE)).toBe(true);
    expect(
      hasRecordedAdvisorBriefAcceptProof(ACCEPTED_REVIEW_EVIDENCE, "live.validator.ui"),
    ).toBe(true);
    expect(
      hasRecordedAdvisorBriefAcceptProof(ACCEPTED_REVIEW_EVIDENCE, "another.reviewer"),
    ).toBe(false);
  });

  it("completes browser proof only from the explicit Workbench success confirmation", async () => {
    const reviewRegion = {
      getByRole: (role: "alert" | "status") => ({
        count: vi.fn().mockResolvedValue(role === "status" ? 1 : 0),
        isVisible: vi.fn().mockResolvedValue(role === "status"),
        textContent: vi
          .fn()
          .mockResolvedValue(
            role === "status"
              ? "The brief was accepted for its permitted internal workflow use."
              : null,
          ),
      }),
    };

    await expect(
      waitForAdvisorBriefReviewConfirmation(reviewRegion, {
        timeoutMs: 1_000,
        wait: vi.fn(),
      }),
    ).resolves.toBeUndefined();
  });

  it("fails browser proof immediately when Workbench exposes a source-confirmation failure", async () => {
    const wait = vi.fn();
    const reviewRegion = {
      getByRole: (role: "alert" | "status") => ({
        count: vi.fn().mockResolvedValue(role === "alert" ? 1 : 0),
        isVisible: vi.fn().mockResolvedValue(role === "alert"),
        textContent: vi
          .fn()
          .mockResolvedValue(
            role === "alert"
              ? "The review decision could not be confirmed."
              : null,
          ),
      }),
    };

    await expect(
      waitForAdvisorBriefReviewConfirmation(reviewRegion, {
        timeoutMs: 90_000,
        wait,
      }),
    ).rejects.toThrow(
      "Adviser brief review action failed in Workbench: The review decision could not be confirmed.",
    );
    expect(wait).not.toHaveBeenCalled();
  });

  it.each([
    ["missing review state", { reviewState: null }],
    ["unexpected review state", { reviewState: "REJECTED" }],
    ["non-ready supportability", { supportability: "ACTION_REQUIRED" }],
    ["missing reviewer", { reviewer: null }],
    ["blank reviewer", { reviewer: "  " }],
    ["missing timestamp", { recordedAt: null }],
    ["unzoned timestamp", { recordedAt: "2026-04-21T03:22:00" }],
    ["impossible timestamp", { recordedAt: "2026-04-31T03:22:00Z" }],
    ["non-UTC timestamp", { recordedAt: "2026-04-21T11:22:00+08:00" }],
  ] as const)("rejects %s", (_label, override) => {
    const evidence = { ...ACCEPTED_REVIEW_EVIDENCE, ...override };

    expect(hasAcceptedAdvisorBriefReviewPosture(evidence)).toBe(false);
    expect(classifyAdvisorBriefAcceptProofPosture(evidence, "live.validator.ui")).toBe(
      "review-action-unavailable",
    );
  });

  it("classifies another source reviewer and one actionable awaiting-review posture", () => {
    expect(
      classifyAdvisorBriefAcceptProofPosture(
        { ...ACCEPTED_REVIEW_EVIDENCE, reviewer: "live.validator.accept" },
        "live.validator.ui",
      ),
    ).toBe("accepted-by-another-reviewer");
    expect(
      classifyAdvisorBriefAcceptProofPosture(
        {
          rowCount: 1,
          reviewState: "AWAITING_REVIEW",
          supportability: "ACTION_REQUIRED",
          reviewer: null,
          recordedAt: null,
        },
        "live.validator.ui",
      ),
    ).toBe("review-action-available");
  });

  it.each([
    ["REJECTED", "FAILED"],
    ["ABANDONED", "FAILED"],
    ["REVISED", "ACTION_REQUIRED"],
    ["SUPERSEDED", "ACTION_REQUIRED"],
    ["NOT_REVIEW_REQUIRED", "READY"],
    [null, "ACTION_REQUIRED"],
  ] as const)(
    "reserves a fresh run when state %s with supportability %s is not actionable",
    (reviewState, supportability) => {
      expect(
        classifyAdvisorBriefAcceptProofPosture(
          {
            rowCount: 1,
            reviewState,
            supportability,
            reviewer: null,
            recordedAt: null,
          },
          "live.validator.ui",
        ),
      ).toBe("review-action-unavailable");
    },
  );

  it("drives the current two-step Advisor Brief review workflow for canonical proof", () => {
    const source = validateAdvisorBriefPanel.toString();

    expect(source).toMatch(
      /getByLabel\("Adviser brief human review",\s*\{\s*exact: true/,
    );
    expect(source).toContain("hasRecordedAdvisorBriefAcceptProof");
    expect(source).toContain("source-confirmed-existing-action");
    expect(source).toContain("accepted-by-another-reviewer");
    expect(source).toContain("review-action-unavailable");
    expect(source).toContain('detailBasis: "GROSS"');
    expect(source).toContain('chartFrequency: "quarterly"');
    expect(source).toContain("buildAdvisorBriefRoute(proofQuery)");
    expect(source).toContain('getByLabel("Review decision")');
    expect(source).toContain('reviewDecision.selectOption("ACCEPT")');
    expect(source).toContain('getByLabel("Reviewer reference")');
    expect(source).toContain('getByLabel("Review rationale")');
    expect(source).toContain('name: "Confirm acceptance"');
    expect(source).toContain("waitForAdvisorBriefReviewConfirmation");
    expect(source).toContain("readAdvisorBriefReviewEvidence");
    expect(source).not.toContain("supportabilityRegion.textContent()");
    expect(waitForAdvisorBriefReviewConfirmation.toString()).toContain(
      "ADVISOR_BRIEF_ACCEPT_SUCCESS_MESSAGE",
    );
    expect(source).not.toContain("Advisor brief review actions");
    expect(source).not.toContain("not-currently-allowed");
  });

  it("validates each canonical source-backed contribution detail state", () => {
    const source = browserWorkflowModule.validatePerformanceAnalysisPanel.toString();

    expect(source).toContain("contributionDimension=asset_class");
    expect(source).toContain("attributionDimension=asset_class");
    expect(source).toContain('page.locator("#performance-drivers").first()');
    expect(source).toContain("performanceDriversPanel.scrollIntoViewIfNeeded()");
    expect(source).toContain("classifyContributionDetailEvidence({");
    expect(source).toContain('contributionEvidence === "position_rows"');
    expect(source).toContain('contributionEvidence === "segment_rows"');
    expect(source).toContain("governedContributionPartial");
    expect(source).toContain("const positionsTab = performanceDriversPanel.getByRole");
    expect(source).toContain("Positions");
    expect(source).toContain('table[aria-label="Position contribution table"]');
    expect(source).toContain("Segment Summary");
    expect(source).toContain('{ name: "Attribution Detail", exact: true }');
    expect(source).toContain("governed_partial_fallback");
    expect(source).toContain("recordUiCheck");
    expect(source).toContain("const segmentSummaryTab = performanceDriversPanel.getByRole");
    expect(source).toContain("segmentSummaryTab.scrollIntoViewIfNeeded()");
    expect(source).toContain('table[aria-label="Asset Class contribution table"]');
    const positionBranchIndex = source.indexOf(
      'if (contributionEvidence === "position_rows")',
    );
    const positionProofIndex = source.indexOf("positionsTab).toBeVisible");
    expect(positionBranchIndex).toBeGreaterThanOrEqual(0);
    expect(positionProofIndex).toBeGreaterThan(positionBranchIndex);
  });

  it("keeps Advisor Cockpit browser proof aligned to business-facing readiness language", () => {
    const source = validateAdvisoryJourneyScreens.toString();

    expect(source).toContain('getByText("Preparation Readiness", { exact: true })');
    expect(source).not.toContain('getByText("Supportability", { exact: true })');
  });

  it("binds Client Context proof to the exact Review Evidence heading", () => {
    const source = validateAdvisoryJourneyScreens.toString();

    expect(source).toContain('getByRole("region", { name: "Review context" })');
    expect(source).toContain('getByText("Mandate", { exact: true })');
    expect(source).toContain('const mandateValue = mandateFact.locator("dd")');
    expect(source).toContain(
      'mandateValue).toHaveAttribute("data-confirmed", "true")',
    );
    expect(source).toContain(
      "portfolioWorkspace?.profile?.portfolio_type",
    );
    expect(source).toContain("assertClientContextMandateProof");
    expect(source).toContain(
      'evidencePosture: "source-confirmed-mandate-through-gateway"',
    );
    expect(source).toContain("evidence: mandateEvidence");
    expect(source).not.toContain("not.toHaveText(/^\\s*$/u)");
    expect(source).not.toContain("Balanced Mandate");
    expect(source).toContain(
      'getByRole("heading", { name: "Review Evidence", exact: true })',
    );
    expect(source).not.toContain('getByText("Review Evidence")');
  });

  it("binds Advisory Overview proof to Gateway rows instead of retired journey navigation", () => {
    const source = validateAdvisoryJourneyScreens.toString();

    expect(source).toContain(
      'url.pathname.endsWith("/api/bff/api/v1/proposals")',
    );
    expect(source).toContain("buildProposalListSourceRows(");
    expect(source).toContain(
      "return validateAdvisoryOverviewDecisionSurface(page,",
    );
    expect(source).not.toContain('getByLabel("Advisory journey screens")');
  });

  it("derives the source-owned high-cash candidate identity from its queue link", () => {
    expect(
      resolveHighCashIdeaCandidateId(
        "/recommendations?mode=opportunities&candidateId=idea_high_cash_ef02ad8793485081",
        "http://workbench.dev.lotus",
      ),
    ).toBe("idea_high_cash_ef02ad8793485081");
  });

  it("requires the candidate identity bound to the current canonical run", () => {
    expect(
      requireHighCashIdeaCandidateId("idea_high_cash_ef02ad8793485081"),
    ).toBe("idea_high_cash_ef02ad8793485081");
    expect(() => requireHighCashIdeaCandidateId(null)).toThrow(
      /current-run high-cash candidate/i,
    );
    expect(() => requireHighCashIdeaCandidateId("idea_high_cash_001")).toThrow(
      /current-run high-cash candidate/i,
    );
  });

  it("opens the current-run candidate in the initial opportunities route", () => {
    expect(
      canonicalIdeaOpportunitiesRoute({
        workbenchBaseUrl: "http://workbench.dev.lotus",
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        candidateId: "idea_high_cash_ef02ad8793485081",
      }),
    ).toBe(
      "http://workbench.dev.lotus/recommendations?mode=opportunities" +
        "&candidateId=idea_high_cash_ef02ad8793485081" +
        "&portfolioId=PB_SG_GLOBAL_BAL_001",
    );
  });

  describe("canonical Idea presentation receipt proof", () => {
    const requestBody = {
      presentedAtUtc: "2026-08-31T07:00:00.000Z",
      rankAtPresentation: 25,
      visibleCandidateCount: 1,
      queueSnapshotDigest: `sha256:${"a".repeat(64)}`,
      queuePolicyVersion: "idea-deterministic-ranking-v1",
      rankingPolicyVersion: "idle-liquidity-v1",
      candidateMaterialVersion: 3,
      candidateEvidenceVersion: 7,
      sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
      sourceCutPosture: "coherent",
    };
    const responseBody = {
      data: {
        receipt: {
          ...requestBody,
          candidateId: "idea_high_cash_ef02ad8793485081",
          tenantId: "tenant-sg-private-bank",
          receiptId: "receipt-001",
          acceptedAtUtc: "2026-08-31T07:00:00.100000Z",
          acceptanceTimeSource: "server_accepted",
          schemaVersion: "lotus-idea.candidate-presentation-receipt.v2",
          surface: "advisor_review_queue",
          producer: "lotus-workbench",
        },
        persistenceDecision: "accepted",
        durableStorageBacked: true,
      },
    };
    const expectedSourceLineage = {
      sourceRevisionVectorDigest: requestBody.sourceRevisionVectorDigest,
      sourceCutPosture: requestBody.sourceCutPosture,
    };

    it("preserves independent global rank and visible count", () => {
      expect(
        assertCanonicalIdeaPresentationReceiptEvidence({
          expectedCandidateId: "idea_high_cash_ef02ad8793485081",
          expectedSourceLineage,
          idempotencyKey: "presentation-001",
          requestBody,
          responseBody,
        }),
      ).toMatchObject({
        candidateId: "idea_high_cash_ef02ad8793485081",
        rankAtPresentation: 25,
        visibleCandidateCount: 1,
        tenantAuthority: "workbench-bff-derived",
        durableStorageBacked: true,
      });
    });

    it.each([
      ["browser tenant", { ...requestBody, tenantId: "tenant-browser" }, responseBody],
      ["missing idempotency", requestBody, responseBody, null],
      [
        "Boolean rank",
        { ...requestBody, rankAtPresentation: true },
        responseBody,
      ],
      [
        "malformed source revision digest",
        { ...requestBody, sourceRevisionVectorDigest: "sha256:not-a-digest" },
        responseBody,
      ],
      [
        "unknown source cut posture",
        { ...requestBody, sourceCutPosture: "ready" },
        responseBody,
      ],
      [
        "different valid queue lineage",
        { ...requestBody, sourceRevisionVectorDigest: `sha256:${"c".repeat(64)}` },
        {
          data: {
            ...responseBody.data,
            receipt: {
              ...responseBody.data.receipt,
              sourceRevisionVectorDigest: `sha256:${"c".repeat(64)}`,
            },
          },
        },
      ],
      [
        "changed receipt evidence",
        requestBody,
        {
          data: {
            ...responseBody.data,
            receipt: {
              ...responseBody.data.receipt,
              visibleCandidateCount: 25,
            },
          },
        },
      ],
      [
        "wrong candidate",
        requestBody,
        {
          data: {
            ...responseBody.data,
            receipt: {
              ...responseBody.data.receipt,
              candidateId: "idea_high_cash_other",
            },
          },
        },
      ],
      [
        "different microsecond presentation instant",
        requestBody,
        {
          data: {
            ...responseBody.data,
            receipt: {
              ...responseBody.data.receipt,
              presentedAtUtc: "2026-08-31T07:00:00.000001Z",
            },
          },
        },
      ],
      [
        "impossible acceptance date",
        requestBody,
        {
          data: {
            ...responseBody.data,
            receipt: {
              ...responseBody.data.receipt,
              acceptedAtUtc: "2026-02-30T07:00:00Z",
            },
          },
        },
      ],
    ])("rejects %s", (_case, request, response, key: string | null = "presentation-001") => {
      expect(() =>
        assertCanonicalIdeaPresentationReceiptEvidence({
          expectedCandidateId: "idea_high_cash_ef02ad8793485081",
          expectedSourceLineage,
          idempotencyKey: key,
          requestBody: request,
          responseBody: response,
        }),
      ).toThrow();
    });
  });

  it.each([
    null,
    "/recommendations?mode=opportunities",
    "/recommendations?candidateId=idea_high_cash_001",
    "/recommendations?candidateId=idea_concentration_ef02ad8793485081",
  ])("rejects a non-canonical Idea candidate queue link: %s", (candidateHref) => {
    expect(() =>
      resolveHighCashIdeaCandidateId(
        candidateHref,
        "http://workbench.dev.lotus",
      ),
    ).toThrow(/high-cash candidate/i);
  });

  it("binds Advisor Book proof to portfolio context and collapsed operating evidence", () => {
    const source = browserWorkflowModule.validateAdvisorBookPanel.toString();

    expect(source).toContain("navigateForBusinessProof");
    expect(source).toContain("waitForResponse");
    expect(source).toContain("validateAdvisorBookRenderPageEvidence");
    expect(source).toContain("sourcePageEvidence");
    expect(source).toContain("assertExactSourceRenderProof");
    expect(source).toContain('screen: "Advisor Book"');
    expect(source).toContain('element.getAttribute("data-portfolio-id")');
    expect(source).toContain('element.getAttribute("data-lifecycle-state")');
    expect(source).toContain('kind: "advisor-book-source-render-proof"');
    expect(source).toContain(
      'a[href*="portfolioId=${encodeURIComponent(portfolioId)}"]',
    );
    expect(source).not.toContain("getByText(portfolioId");
    expect(source).toContain('getByTestId("advisor-book-operating-evidence")');
    expect(source).toContain('.not.toHaveAttribute("open", "")');
    expect(source).toContain('.toHaveAttribute("open", "")');
    expect(source).toMatch(
      /getByRole\("heading",\s*{\s*name: "Operating boundaries",\s*exact: true,\s*}\)/,
    );
    expect(source).toMatch(
      /getByRole\("heading",\s*{\s*name: "Support references",\s*exact: true,\s*}\)/,
    );
    expect(source).not.toContain('{ name: "Operational details" }');
    expect(source).not.toContain('{ name: "Support details" }');
  });

  it.each([
    {
      pdfOutputReady: false,
      expected: {
        panelState: "partial",
        outputFormat: "json",
        pdfOutputState: "unavailable",
        reason:
          "Structured report data is available while governed PDF creation remains unavailable; archive retention and client delivery remain separate controls.",
      },
    },
    {
      pdfOutputReady: true,
      expected: {
        panelState: "partial",
        outputFormat: "pdf",
        pdfOutputState: "ready",
        reason:
          "Structured report data and governed PDF creation are available for advisor review; archive retention and client delivery remain separate controls.",
      },
    },
  ])(
    "classifies source-backed PDF readiness when ready is $pdfOutputReady",
    ({ pdfOutputReady, expected }) => {
      expect(buildReportCentreProofPosture(pdfOutputReady)).toEqual(expected);
    },
  );

  it("observes the rendered PDF readiness control before exercising Report Centre", () => {
    const source = browserWorkflowModule.validateReportCentrePanel.toString();

    expect(source).toContain("structuredDataRadio).toBeVisible");
    expect(source).toContain("governedPdfRadio).toBeVisible");
    expect(source).toContain("governedPdfRadio.isDisabled()");
    expect(source).toContain("governedPdfRadio.check");
    expect(source).toContain("Governed document creation is available.");
    expect(source).toContain("PDF creation is temporarily unavailable");
    expect(source).toContain("return reportCentreProof");
    expect(source).toContain('name: "Report request readiness"');
    expect(source).toContain('"Reporting recorded the request."');
    expect(source).toContain("requestHistoryTable.isVisible()");
    expect(source).toContain('name: "Recent portfolio report request details"');
    expect(source).toContain("assertListHasItems");
    expect(source).toContain("assertTableHasRows");
    expect(source).not.toContain('"Report request recorded"');
    expect(source).not.toContain("screenshotRegisteredPanel");
  });

  it("resolves governed routes and records screenshot evidence with absolute paths", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "lotus-browser-workflow-"));
    const screenshotCalls: Array<{ path: string; fullPage: boolean }> = [];
    const mouseMoves: Array<{ x: number; y: number }> = [];
    const keyPresses: string[] = [];
    const summary = {
      uiChecks: [],
      screenshots: [],
      panelClassifications: [
        { panel: "performance.risk.snapshot", state: "partial" },
      ],
    };
    const panelRegistryById = new Map([
      [
        "performance.risk.snapshot",
        {
          screenshotName: "performance-risk-live.png",
          route: "/performance?portfolioId={portfolio_id}&mode=risk&benchmark={benchmarkCode}",
          requiredSupportState: "ready",
        },
      ],
    ]);

    try {
      const helpers = createBrowserValidationHelpers({
        outputDir: tempDir,
        summary,
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        benchmarkCode: "BMK_PB_GLOBAL_BALANCED_60_40",
        canonicalAsOfDate: "2026-04-10",
        timeoutMs: 60000,
        panelRegistryById,
      });

      expect(
        helpers.resolveRegistryRoute(
          "/performance?portfolioId={portfolio_id}&mode=risk&benchmark={benchmarkCode}"
        )
      ).toBe(
        "/performance?portfolioId=PB_SG_GLOBAL_BAL_001&mode=risk&benchmark=BMK_PB_GLOBAL_BALANCED_60_40"
      );
      expect(
        helpers.resolveRegistryRoute("/book?asOfDate={canonicalAsOfDate}"),
      ).toBe("/book?asOfDate=2026-04-10");
      for (const panelId of [
        "portfolio.summary",
        "reporting.report_centre",
        "performance.summary",
        "performance.risk.snapshot",
        "dpm.outcome_review",
      ]) {
        const panel = DEFAULT_PANEL_REGISTRY.panels.find(
          (candidate) => candidate.panelId === panelId,
        );
        expect(panel, `${panelId} must remain registered`).toBeDefined();
        expect(helpers.resolveRegistryRoute(panel!.route)).not.toMatch(/\{[^}]+\}/);
      }

      await helpers.screenshotRegisteredPanel(
        {
          mouse: {
            move: async (x: number, y: number) => {
              mouseMoves.push({ x, y });
            },
          },
          keyboard: {
            press: async (key: string) => {
              keyPresses.push(key);
            },
          },
          screenshot: async ({ path, fullPage }: { path: string; fullPage: boolean }) => {
            screenshotCalls.push({ path, fullPage });
          },
        },
        "performance.risk.snapshot"
      );

      expect(mouseMoves).toEqual([{ x: 1, y: 1 }]);
      expect(keyPresses).toEqual(["Escape"]);
      expect(screenshotCalls).toEqual([
        {
          path: join(tempDir, "performance-risk-live.png"),
          fullPage: true,
        },
      ]);
      expect(summary.screenshots).toEqual([
        expect.objectContaining({
          name: "performance-risk-live.png",
          panel: "performance.risk.snapshot",
          route: "/performance?portfolioId=PB_SG_GLOBAL_BAL_001&mode=risk&benchmark=BMK_PB_GLOBAL_BALANCED_60_40",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          benchmarkCode: "BMK_PB_GLOBAL_BALANCED_60_40",
          asOfDate: "2026-04-10",
          state: "truthfully_degraded",
        }),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
