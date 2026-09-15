import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveCompliance,
  approveRisk,
  compareAdvisoryWorkspace,
  acknowledgeAdvisorCockpitAction,
  createAdvisoryCopilotEvidencePacketFromProposalVersion,
  createProposalArtifact,
  createProposalAsync,
  createProposalExecutionHandoff,
  createProposalVersion,
  createProposalVersionAsync,
  createProposalReportRequest,
  createProposalMemo,
  getAdvisoryWorkspaceSavedVersionReplayEvidence,
  getAdvisoryCopilotSupportability,
  getAdvisoryPolicyEvaluation,
  getAdvisoryPolicyReviewQueue,
  getAdvisoryPolicySignOffPackage,
  getAdvisoryPolicyWorkflow,
  getAdvisorCockpitSnapshot,
  getAdvisorCockpitSupportability,
  getAdvisorIdeaCandidateDetail,
  getAdvisorIdeaReviewQueue,
  recordAdvisorIdeaConversionIntent,
  recordAdvisorIdeaFeedback,
  recordAdvisorIdeaPresentationReceipt,
  recordAdvisorIdeaReviewAction,
  requestAdvisorIdeaAIExplanation,
  getBankDemoScenarioContract,
  getBankDemoSupportedClaimRegister,
  getProposalExecutionStatus,
  getProposalIdempotencyRecord,
  getProposalDeliveryEvents,
  getProposalDeliverySummary,
  getProposalDiscussionPack,
  getProposalApprovals,
  getProposalMemo,
  getProposalMemoLineage,
  getProposalMemoProjection,
  getProposalMemoReplayEvidence,
  getProposalNarrative,
  getProposalNarrativeReviewEvidence,
  getProposalOperation,
  getProposalOperationByCorrelation,
  getProposalOperationReplayEvidence,
  getProposalRiskImpact,
  getProposalVersion,
  getProposalVersionReplayEvidence,
  getProposalWorkflowEvents,
  listAdvisoryWorkspaceSavedVersions,
  listAdvisorCockpitActions,
  listAdvisorCockpitPreparationPackets,
  recordProposalExecutionUpdate,
  recordProposalMemoReportPackageEvent,
  listProposals,
  recordAdvisoryPolicySignOffDecision,
  recordClientConsent,
  regenerateProposalNarrative,
  reviewAdvisoryCopilotRun,
  runAdvisoryCopilotAction,
  requestAdvisoryWorkspaceRationale,
  requestProposalMemoAdvisorCommentary,
  requestProposalMemoAiCommentary,
  requestProposalMemoReportPackage,
  resumeAdvisoryWorkspace,
  reviewAdvisoryWorkspaceRationale,
  reviewProposalMemo,
  reviewProposalNarrative,
  submitProposal,
} from "../../src/features/proposals/api";
import { proposalRiskImpactFixture } from "../fixtures/proposal-risk-impact";
import { proposalDiscussionPackFixture } from "../fixtures/proposal-discussion-pack";
import { WorkbenchApiError } from "../../src/features/workbench/api-client";
import {
  getAnalyticsUiMetricEvents,
  resetAnalyticsUiMetricEvents,
} from "../../src/features/analytics-observability/metrics";

const expectedBaseUrl = "/api/bff/api/v1";

function expectNoStoreRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  url: string,
) {
  expect(fetchMock).toHaveBeenCalledWith(url, { cache: "no-store" });
}

describe("proposal api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetAnalyticsUiMetricEvents();
  });

  it("keeps raw Gateway failure bodies out of proposal transport errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"detail":"internal policy and service identifiers"}', {
            status: 403,
          }),
      ),
    );

    const error = await listProposals().catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(WorkbenchApiError);
    expect(error).toMatchObject({
      message: "Failed to fetch proposal list (403)",
      status: 403,
    });
    expect((error as Error).message).not.toContain("internal policy");
  });

  it("calls submit endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {},
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await submitProposal(
      "pp_1",
      {
        actor_id: "advisor_1",
        expected_state: "DRAFT",
        review_type: "RISK",
      },
      "idem-submit-1",
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/submit`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-submit-1",
        }),
      }),
    );
  });

  it("calls approval action endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {},
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await approveRisk(
      "pp_1",
      { actor_id: "risk_1", expected_state: "RISK_REVIEW" },
      "idem-risk-1",
    );
    await approveCompliance(
      "pp_1",
      {
        actor_id: "compliance_1",
        expected_state: "COMPLIANCE_REVIEW",
      },
      "idem-compliance-1",
    );
    await recordClientConsent(
      "pp_1",
      {
        actor_id: "advisor_1",
        expected_state: "AWAITING_CLIENT_CONSENT",
      },
      "idem-consent-1",
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/approve-risk`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-risk-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/approve-compliance`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-compliance-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/record-client-consent`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-consent-1",
        }),
      }),
    );
  });

  it("calls supportability endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: { events: [], approvals: [] },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await getProposalWorkflowEvents("pp_1");
    await getProposalApprovals("pp_1");

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/proposals/pp_1/workflow-events`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/proposals/pp_1/approvals`,
    );
  });

  it("builds list query from server-side filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: { items: [] },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await listProposals({
      state: "DRAFT",
      portfolioId: "pf_1",
      createdBy: "advisor_1",
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/proposals?portfolio_id=pf_1&state=DRAFT&created_by=advisor_1`,
    );
  });

  it("loads selected proposal risk and impact only through the BFF and validates identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(proposalRiskImpactFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const envelope = await getProposalRiskImpact(
      "PRP-RISK",
      "PB_SG_GLOBAL_BAL_001",
      3,
      "RISK_REVIEW",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/PRP-RISK/risk-impact`,
      { cache: "no-store" },
    );
    expect(envelope.correlation_id).toBe("corr-proposal-risk-impact-001");
    expect(envelope.data.proposal_id).toBe("PRP-RISK");
    expect(envelope.data.portfolio_id).toBe("PB_SG_GLOBAL_BAL_001");
  });

  it("loads a selected discussion pack only through the BFF with bound identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(proposalDiscussionPackFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const envelope = await getProposalDiscussionPack(
      "proposal-1",
      "PB_SG_GLOBAL_BAL_001",
      2,
      "AWAITING_CLIENT_CONSENT",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/proposal-1/discussion-pack-review?portfolio_id=PB_SG_GLOBAL_BAL_001&version_no=2`,
      { cache: "no-store" },
    );
    expect(envelope.data.narrative.review_state).toBe(
      "APPROVED_FOR_ADVISOR_USE",
    );
  });

  it.each([
    {
      label: "missing proposal-list data",
      envelope: { correlation_id: "c", contract_version: "v1" },
    },
    {
      label: "missing proposal items",
      envelope: { correlation_id: "c", contract_version: "v1", data: {} },
    },
    {
      label: "invalid proposal summary",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: { items: [{ proposal_id: "PRP-1" }] },
      },
    },
    {
      label: "invalid continuation cursor",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: { items: [], next_cursor: 2 },
      },
    },
    {
      label: "whitespace-padded proposal identity",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: {
          items: [{ proposal_id: " PRP-1", current_state: "DRAFT" }],
        },
      },
    },
    {
      label: "control-containing proposal identity",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: {
          items: [{ proposal_id: "PRP-1\u0000", current_state: "DRAFT" }],
        },
      },
    },
    {
      label: "unbounded proposal identity",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: {
          items: [{ proposal_id: "x".repeat(257), current_state: "DRAFT" }],
        },
      },
    },
    {
      label: "empty continuation cursor",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: { items: [], next_cursor: "" },
      },
    },
    {
      label: "control-containing continuation cursor",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: { items: [], next_cursor: "window-2\u0000" },
      },
    },
    {
      label: "unbounded continuation cursor",
      envelope: {
        correlation_id: "c",
        contract_version: "v1",
        data: { items: [], next_cursor: "x".repeat(2_049) },
      },
    },
  ])(
    "rejects $label instead of confirming an empty worklist",
    async ({ envelope }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify(envelope), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
        ),
      );

      await expect(listProposals()).rejects.toThrow(
        "Proposal list response was incomplete.",
      );
    },
  );

  it("rejects a continuation cursor that repeats the requested source window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: { items: [], next_cursor: "cursor-window-2" },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await expect(listProposals({ cursor: "cursor-window-2" })).rejects.toThrow(
      "Proposal list response was incomplete.",
    );
  });

  it("loads the Gateway-backed advisory policy review queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: { items: [{ evaluation_id: "pev_1" }], queue_posture: {} },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await getAdvisoryPolicyReviewQueue({
      evaluationStatus: "PENDING_REVIEW",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory-policy-evaluations/review-queue?evaluation_status=PENDING_REVIEW&portfolio_id=PB_SG_GLOBAL_BAL_001`,
    );
    expect(result.items?.[0]?.evaluation_id).toBe("pev_1");
  });

  it("loads the Lotus Idea advisor queue through Gateway with portfolio scope headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              policyVersion: "idea-deterministic-ranking-v1",
              evaluatedAtUtc: "2026-06-21T10:10:00Z",
              items: [{ candidate: { candidateId: "idea_high_cash_001" } }],
              exclusions: [],
              durableStorageBacked: true,
              supportedFeaturePromoted: false,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await getAdvisorIdeaReviewQueue({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      evaluatedAtUtc: "2026-06-21T10:10:00Z",
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/ideas/review-queues/advisor?evaluatedAtUtc=2026-06-21T10%3A10%3A00Z`,
    );
    expect(result.items?.[0]?.candidate?.candidateId).toBe(
      "idea_high_cash_001",
    );
    expect(result.supportedFeaturePromoted).toBe(false);
  });

  it("loads the active Lotus Idea advisor queue when no evaluation timestamp is supplied", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [],
              exclusions: [],
              supportedFeaturePromoted: false,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await getAdvisorIdeaReviewQueue({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/ideas/review-queues/advisor`,
    );
  });

  it("accepts an Idea queue boundary normalized to equivalent fractional-second precision", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              evaluatedAtUtc: "2026-06-21T10:10:00.123000Z",
              items: [{ candidate: { candidateId: "idea_high_cash_001" } }],
              exclusions: [],
              durableStorageBacked: true,
              supportedFeaturePromoted: false,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await getAdvisorIdeaReviewQueue({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      evaluatedAtUtc: "2026-06-21T10:10:00.123Z",
    });

    expect(result.items?.[0]?.candidate?.candidateId).toBe(
      "idea_high_cash_001",
    );
  });

  it.each([
    ["a missing boundary", undefined],
    ["a different boundary", "2026-06-21T10:09:59Z"],
    ["a different microsecond boundary", "2026-06-21T10:10:00.000001Z"],
    ["an impossible calendar boundary", "2026-02-30T10:10:00Z"],
    ["a malformed boundary", "not-a-timestamp"],
  ])("rejects %s from an explicitly evaluated Idea queue", async (_case, returnedBoundary) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              evaluatedAtUtc: returnedBoundary,
              items: [],
              exclusions: [],
              supportedFeaturePromoted: false,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await expect(
      getAdvisorIdeaReviewQueue({
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        evaluatedAtUtc: "2026-06-21T10:10:00Z",
      }),
    ).rejects.toThrow(
      "The opportunity worklist did not confirm the requested evaluation time.",
    );
  });

  it("unwraps the Gateway envelope for the Lotus Idea advisor queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlationId: "corr-idea-queue",
              contractVersion: "idea-gateway-v1",
              data: {
                items: [{ candidate: { candidateId: "idea_gateway_001" } }],
                exclusions: [],
                supportedFeaturePromoted: false,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await getAdvisorIdeaReviewQueue({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
    });

    expect(result.items?.[0]?.candidate?.candidateId).toBe("idea_gateway_001");
    expect(result.supportedFeaturePromoted).toBe(false);
  });

  it("loads Lotus Idea candidate detail through the Gateway BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidate: { candidateId: "idea_high_cash_001" },
              evidence: {
                evidencePacketId: "evidence_high_cash_001",
                evidenceContentHash: "sha256:evidence-high-cash-001",
                sourceRevisionVectorDigest: "sha256:revision-high-cash-001",
                sourceRefs: [],
              },
              lifecycleHistory: [],
              reviewDecisions: [],
              feedbackEvents: [],
              conversionIntents: [],
              conversionOutcomes: [],
              reportEvidencePacks: [],
              auditSummary: { eventCount: 1 },
              durableStorageBacked: true,
              supportedFeaturePromoted: false,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await getAdvisorIdeaCandidateDetail({
      candidateId: "idea_high_cash_001",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/ideas/candidates/idea_high_cash_001`,
    );
    expect(result.candidate?.candidateId).toBe("idea_high_cash_001");
    expect(result.evidence?.sourceRevisionVectorDigest).toBe(
      "sha256:revision-high-cash-001",
    );
  });

  it("unwraps the Gateway envelope for Lotus Idea candidate detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlationId: "corr-idea-detail",
              contractVersion: "idea-gateway-v1",
              data: {
                candidate: { candidateId: "idea_gateway_001" },
                evidence: {
                  evidencePacketId: "evidence_gateway_001",
                  evidenceContentHash: "sha256:evidence-gateway-001",
                  sourceRevisionVectorDigest: "sha256:revision-gateway-001",
                  sourceRefs: [{ sourceProductId: "Core" }],
                },
                lifecycleHistory: [],
                reviewDecisions: [],
                feedbackEvents: [],
                conversionIntents: [],
                conversionOutcomes: [],
                reportEvidencePacks: [],
                auditSummary: { eventCount: 1 },
                durableStorageBacked: true,
                supportedFeaturePromoted: false,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    const result = await getAdvisorIdeaCandidateDetail({
      candidateId: "idea_gateway_001",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
    });

    expect(result.candidate?.candidateId).toBe("idea_gateway_001");
    expect(result.evidence?.sourceRefs).toHaveLength(1);
    expect(result.supportedFeaturePromoted).toBe(false);
  });

  it("records an Idea review action through the Gateway BFF without browser authority headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                persistence: { decision: "accepted" },
                durableStorageBacked: true,
                supportedFeaturePromoted: false,
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const result = await recordAdvisorIdeaReviewAction({
      candidateId: "idea_high_cash_001",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      idempotencyKey: "ui-idea-review-001",
      request: {
        reviewId: "review_001",
        action: "approve_for_conversion",
        reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
        decidedAtUtc: "2026-07-17T08:00:00Z",
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/ideas/candidates/idea_high_cash_001/review-actions`,
      expect.objectContaining({ method: "POST", headers: expect.any(Headers) }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("X-Caller-Subject")).toBeNull();
    expect(headers.get("X-Caller-Roles")).toBeNull();
    expect(headers.get("X-Caller-Capabilities")).toBeNull();
    expect(headers.get("X-Caller-Portfolio-Ids")).toBeNull();
    expect(headers.get("Idempotency-Key")).toBe("ui-idea-review-001");
    expect(init.body).toBe(
      JSON.stringify({
        reviewId: "review_001",
        action: "approve_for_conversion",
        reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
        decidedAtUtc: "2026-07-17T08:00:00Z",
      }),
    );
    expect(result.supportedFeaturePromoted).toBe(false);
  });

  it("requests an identity-matched governed Idea explanation through the Gateway BFF", async () => {
    const evidenceIdentity = {
      evidencePacketId: "evidence_high_cash_001",
      evidenceContentHash: "sha256:evidence-high-cash-001",
      sourceRevisionVectorDigest: "sha256:revision-high-cash-001",
    };
    const request = {
      requestId: "request-001",
      purpose: "advisor_rationale_draft" as const,
      requestedAtUtc: "2026-09-05T08:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: "EXPLANATION_SERVED",
            disposition: "executed",
            lotusAiRunId: "run-001",
            lotusAiRuntimeExecutionConfirmed: true,
            evaluationVerdict: "accepted",
            explanation: {
              requestId: request.requestId,
              candidateId: "idea_high_cash_001",
              posture: "ready_for_advisor_review",
              verifierOutcome: "passed",
              explanationText: "Cash weight is above the policy threshold.",
              fallbackUsed: false,
              fallbackReason: null,
              grantsDownstreamAuthority: false,
              supportedFeaturePromoted: false,
              executionProvenancePosture: "unattested_local_test_fixture",
              aiLineageRecorded: true,
              redactedEvidence: {
                ...evidenceIdentity,
                reasonCodes: [],
                unsupportedReasons: [],
                scorePolicyVersion: null,
                sourceRefs: [],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await requestAdvisorIdeaAIExplanation({
      candidateId: "idea_high_cash_001",
      evidenceIdentity,
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      idempotencyKey: "idea-explanation-request-001",
      request,
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `${expectedBaseUrl}/ideas/candidates/idea_high_cash_001/ai-explanations`,
    );
    expect((init.headers as Headers).get("Idempotency-Key")).toBe(
      "idea-explanation-request-001",
    );
    expect((init.headers as Headers).get("X-Caller-Capabilities")).toBeNull();
    expect(init.body).toBe(JSON.stringify(request));
    expect(result).toMatchObject({
      status: "EXPLANATION_SERVED",
      lotusAiRunId: "run-001",
    });
  });

  it("records Idea feedback through the scoped Gateway BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              feedbackEvent: {
                feedbackId: "feedback_001",
                candidateId: "idea_high_cash_001",
                evidencePacketId: "evidence_high_cash_001",
                taxonomyVersion: "idea-feedback-taxonomy-v1",
                outcome: "useful",
                reason: "relevant",
                actorRole: "advisor",
                recordedAtUtc: "2026-07-17T08:00:00Z",
              },
              persistence: { decision: "accepted" },
              durableStorageBacked: true,
              supportedFeaturePromoted: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    await recordAdvisorIdeaFeedback({
      candidateId: "idea_high_cash_001",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      idempotencyKey: "ui-idea-feedback-001",
      request: {
        feedbackId: "feedback_001",
        taxonomyVersion: "idea-feedback-taxonomy-v1",
        outcome: "useful",
        reason: "relevant",
        recordedAtUtc: "2026-07-17T08:00:00Z",
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${expectedBaseUrl}/ideas/candidates/idea_high_cash_001/feedback`,
    );
    expect(init.body).toBe(
      JSON.stringify({
        feedbackId: "feedback_001",
        taxonomyVersion: "idea-feedback-taxonomy-v1",
        outcome: "useful",
        reason: "relevant",
        recordedAtUtc: "2026-07-17T08:00:00Z",
      }),
    );
    expect((init.headers as Headers).get("X-Caller-Capabilities")).toBeNull();
    expect((init.headers as Headers).get("Idempotency-Key")).toBe(
      "ui-idea-feedback-001",
    );
    expect(getAnalyticsUiMetricEvents()).toEqual([
      expect.objectContaining({
        metric_name: "lotus_workbench_api_request_duration_seconds",
        labels: expect.objectContaining({
          operation: "idea.candidate.feedback",
          status_class: "2xx",
          state: "ready",
        }),
      }),
      expect.objectContaining({
        metric_name: "lotus_workbench_panel_state_total",
        labels: expect.objectContaining({
          operation: "idea.candidate.feedback",
          state: "ready",
        }),
      }),
    ]);
  });

  it("rejects persistence success without matching source-owned feedback event evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              persistence: { decision: "accepted" },
              durableStorageBacked: true,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    await expect(
      recordAdvisorIdeaFeedback({
        candidateId: "idea_high_cash_001",
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        idempotencyKey: "ui-idea-feedback-no-proof-001",
        request: {
          feedbackId: "feedback_no_proof_001",
          taxonomyVersion: "idea-feedback-taxonomy-v1",
          outcome: "useful",
          reason: "relevant",
          recordedAtUtc: "2026-07-17T08:00:00Z",
        },
      }),
    ).rejects.toThrow(
      "Advisor idea feedback did not return matching source-owned event evidence. No success was recorded in Workbench.",
    );
    expect(getAnalyticsUiMetricEvents()).toEqual([
      expect.objectContaining({
        metric_name: "lotus_workbench_api_request_duration_seconds",
        labels: expect.objectContaining({
          operation: "idea.candidate.feedback",
          status_class: "2xx",
          state: "error",
          error_category: "evidence",
        }),
      }),
      expect.objectContaining({
        metric_name: "lotus_workbench_panel_state_total",
        labels: expect.objectContaining({
          operation: "idea.candidate.feedback",
          state: "error",
          reason: "evidence",
        }),
      }),
    ]);
  });

  it("records exact Idea presentation evidence without browser-owned tenant authority", async () => {
    const request = {
      presentedAtUtc: "2026-08-31T10:15:00.000Z",
      rankAtPresentation: 25,
      visibleCandidateCount: 1,
      queueSnapshotDigest: `sha256:${"a".repeat(64)}` as const,
      queuePolicyVersion: "idea-deterministic-ranking-v1",
      rankingPolicyVersion: "idle-liquidity-v1",
      candidateMaterialVersion: 2,
      candidateEvidenceVersion: 3,
      sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}` as const,
      sourceCutPosture: "coherent" as const,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              receipt: {
                ...request,
                tenantId: "tenant-private-bank-sg",
                receiptId: "receipt-idea-025",
                candidateId: "idea-025",
                acceptedAtUtc: "2026-08-31T10:15:00.100000Z",
                acceptanceTimeSource: "server_accepted",
                schemaVersion: "lotus-idea.candidate-presentation-receipt.v2",
                surface: "advisor_review_queue",
                producer: "lotus-workbench",
              },
              persistenceDecision: "accepted",
              durableStorageBacked: true,
              supportedFeaturePromoted: false,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    await recordAdvisorIdeaPresentationReceipt({
      candidateId: "idea-025",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      idempotencyKey: "presentation-idea-025",
      request,
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${expectedBaseUrl}/ideas/candidates/idea-025/presentation-receipts`,
    );
    expect(JSON.parse(String(init.body))).toEqual(request);
    expect(JSON.parse(String(init.body))).not.toHaveProperty("tenantId");
    expect((init.headers as Headers).get("Idempotency-Key")).toBe(
      "presentation-idea-025",
    );
    expect(getAnalyticsUiMetricEvents()).toEqual([
      expect.objectContaining({
        metric_name: "lotus_workbench_api_request_duration_seconds",
        labels: expect.objectContaining({
          operation: "idea.candidate.presentation-receipt",
          status_class: "2xx",
          state: "ready",
        }),
      }),
      expect.objectContaining({
        metric_name: "lotus_workbench_panel_state_total",
        labels: expect.objectContaining({
          operation: "idea.candidate.presentation-receipt",
          state: "ready",
        }),
      }),
    ]);
  });

  it("rejects presentation success without matching persisted evidence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              receipt: {
                presentedAtUtc: "2026-08-31T10:15:00.000Z",
                rankAtPresentation: 24,
                visibleCandidateCount: 1,
                queueSnapshotDigest: `sha256:${"a".repeat(64)}`,
                queuePolicyVersion: "idea-deterministic-ranking-v1",
                rankingPolicyVersion: "idle-liquidity-v1",
                candidateMaterialVersion: 2,
                candidateEvidenceVersion: 3,
                sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
                sourceCutPosture: "coherent",
                tenantId: "tenant-private-bank-sg",
                receiptId: "receipt-idea-025",
                candidateId: "idea-025",
                acceptedAtUtc: "2026-08-31T10:15:00.100000Z",
                acceptanceTimeSource: "server_accepted",
                schemaVersion: "lotus-idea.candidate-presentation-receipt.v2",
                surface: "advisor_review_queue",
                producer: "lotus-workbench",
              },
              persistenceDecision: "accepted",
              durableStorageBacked: true,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    await expect(
      recordAdvisorIdeaPresentationReceipt({
        candidateId: "idea-025",
        portfolioId: "PB_SG_GLOBAL_BAL_001",
        idempotencyKey: "presentation-idea-025",
        request: {
          presentedAtUtc: "2026-08-31T10:15:00.000Z",
          rankAtPresentation: 25,
          visibleCandidateCount: 1,
          queueSnapshotDigest: `sha256:${"a".repeat(64)}`,
          queuePolicyVersion: "idea-deterministic-ranking-v1",
          rankingPolicyVersion: "idle-liquidity-v1",
          candidateMaterialVersion: 2,
          candidateEvidenceVersion: 3,
          sourceRevisionVectorDigest: `sha256:${"b".repeat(64)}`,
          sourceCutPosture: "coherent",
        },
      }),
    ).rejects.toThrow(
      "Idea visibility evidence did not match the recorded observation. Review remains available.",
    );
    expect(getAnalyticsUiMetricEvents()).toEqual([
      expect.objectContaining({
        metric_name: "lotus_workbench_api_request_duration_seconds",
        labels: expect.objectContaining({
          operation: "idea.candidate.presentation-receipt",
          status_class: "2xx",
          state: "error",
          error_category: "evidence",
        }),
      }),
      expect.objectContaining({
        metric_name: "lotus_workbench_panel_state_total",
        labels: expect.objectContaining({
          operation: "idea.candidate.presentation-receipt",
          state: "error",
          reason: "evidence",
        }),
      }),
    ]);
  });

  it("records an Idea conversion intent without creating a proposal locally", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              persistence: { decision: "accepted" },
              durableStorageBacked: true,
              supportedFeaturePromoted: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    await recordAdvisorIdeaConversionIntent({
      candidateId: "idea_high_cash_001",
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      idempotencyKey: "ui-idea-conversion-001",
      request: {
        conversionIntentId: "conversion_001",
        target: "advise_proposal",
        reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
        requestedAtUtc: "2026-07-17T08:00:00Z",
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${expectedBaseUrl}/ideas/candidates/idea_high_cash_001/conversion-intents`,
    );
    expect((init.headers as Headers).get("X-Caller-Capabilities")).toBeNull();
    expect(init.body).toBe(
      JSON.stringify({
        conversionIntentId: "conversion_001",
        target: "advise_proposal",
        reasonCodes: ["review_approved_for_conversion", "high_cash_ratio"],
        requestedAtUtc: "2026-07-17T08:00:00Z",
      }),
    );
  });

  it("loads RFC28 bank demo proof contracts through the Gateway BFF", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const data = url.endsWith("/scenario-contract")
          ? {
              scenario_id: "RFC28_BANK_DEMO_CLIENT_READY_PROOF_CANONICAL",
              primary_portfolio_id: "PB_SG_GLOBAL_BAL_001",
            }
          : {
              claims: [
                {
                  claim_id: "client_ready_publication_blocked",
                  classification: "UNSUPPORTED",
                },
              ],
            };
        return new Response(
          JSON.stringify({
            correlationId: "c",
            contractVersion: "v1",
            data,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const scenario = await getBankDemoScenarioContract();
    const claimRegister = await getBankDemoSupportedClaimRegister();

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory/bank-demo-proof/scenario-contract`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory/bank-demo-proof/supported-claim-register`,
    );
    expect(scenario.scenario_id).toBe(
      "RFC28_BANK_DEMO_CLIENT_READY_PROOF_CANONICAL",
    );
    expect(claimRegister.claims?.[0]?.classification).toBe("UNSUPPORTED");
  });

  it("loads Gateway-backed advisory policy detail and sign-off package", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const data = url.endsWith("/sign-off-package")
          ? {
              package_posture: {
                sign_off_source_package:
                  "SUPPORTED_BY_RFC0025_SLICE8_ADVISE_API",
              },
            }
          : { evaluation_id: "pev_1", evaluation_status: "PENDING_REVIEW" };
        return new Response(
          JSON.stringify({
            correlation_id: "c",
            contract_version: "v1",
            data,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const evaluation = await getAdvisoryPolicyEvaluation("pev_1");
    const signOffPackage = await getAdvisoryPolicySignOffPackage("pev_1");

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory-policy-evaluations/pev_1`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory-policy-evaluations/pev_1/sign-off-package`,
    );
    expect(evaluation.evaluation_id).toBe("pev_1");
    expect(signOffPackage.package_posture?.sign_off_source_package).toContain(
      "SUPPORTED",
    );
  });

  it("loads advisory policy workflow and records review requests through Gateway", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const data =
          init?.method === "POST"
            ? { workflow: { sign_off_status: "PENDING_REVIEW" } }
            : {
                sign_off_status: "PENDING_REVIEW",
                maker_checker_required: true,
              };
        return new Response(
          JSON.stringify({
            correlation_id: "c",
            contract_version: "v1",
            data,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const workflow = await getAdvisoryPolicyWorkflow("pev_1");
    const decision = await recordAdvisoryPolicySignOffDecision(
      "pev_1",
      {
        body: {
          actor_id: "advisor_1",
          decision: "REQUEST_MORE_EVIDENCE",
          source_evaluation_hash: "sha256:policy-evaluation-1",
          reason: { purpose: "advisor_policy_review" },
        },
      },
      "idem-policy-review-request",
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory-policy-evaluations/pev_1/workflow`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/advisory-policy-evaluations/pev_1/sign-off-decisions`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-policy-review-request",
        }),
      }),
    );
    expect(workflow.sign_off_status).toBe("PENDING_REVIEW");
    expect(decision.workflow?.sign_off_status).toBe("PENDING_REVIEW");
  });

  it("calls Gateway-backed advisor cockpit read and acknowledgement endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const data =
          init?.method === "POST"
            ? { action_item: { action_item_id: "aci_1" }, replayed: false }
            : url.includes("/supportability")
              ? {
                  posture: "ADVISE_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
                }
              : url.includes("/snapshot")
                ? {
                    snapshot_id: "cockpit_snapshot_1",
                    action_counts: { "status.BLOCKED": 1 },
                  }
                : { items: [{ action_item_id: "aci_1" }], total_count: 1 };
        return new Response(
          JSON.stringify({
            correlation_id: "c",
            contract_version: "v1",
            data,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const filters = {
      portfolioId: "PB_SG_GLOBAL_BAL_001",
    };

    const actions = await listAdvisorCockpitActions({ ...filters, limit: 25 });
    const preparationPackets = await listAdvisorCockpitPreparationPackets({
      ...filters,
      limit: 25,
    });
    const snapshot = await getAdvisorCockpitSnapshot(filters);
    const supportability = await getAdvisorCockpitSupportability(filters);
    const acknowledgement = await acknowledgeAdvisorCockpitAction(
      "aci_1",
      {
        action_item_version: 1,
        acknowledgement_note: "Reviewed in Workbench.",
      },
      {
        filters,
        idempotencyKey: "idem-cockpit-ack-1",
      },
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisor-cockpit/actions?portfolio_id=PB_SG_GLOBAL_BAL_001&limit=25`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisor-cockpit/preparation-packets?portfolio_id=PB_SG_GLOBAL_BAL_001&limit=25`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisor-cockpit/snapshot?portfolio_id=PB_SG_GLOBAL_BAL_001`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisor-cockpit/supportability?portfolio_id=PB_SG_GLOBAL_BAL_001`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/advisor-cockpit/actions/aci_1/acknowledgements?portfolio_id=PB_SG_GLOBAL_BAL_001`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-cockpit-ack-1",
        }),
        body: JSON.stringify({
          action_item_version: 1,
          acknowledgement_note: "Reviewed in Workbench.",
        }),
      }),
    );
    expect(actions.total_count).toBe(1);
    expect(preparationPackets.total_count).toBe(1);
    expect(snapshot.snapshot_id).toBe("cockpit_snapshot_1");
    expect(supportability.posture).toBe(
      "ADVISE_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
    );
    expect(acknowledgement.replayed).toBe(false);
  });

  it("calls advisory copilot endpoints through the Gateway BFF without source-section payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {
                evidence_packet: {
                  evidence_packet_id: "copilot_packet_1",
                },
                run: {
                  run_id: "copilot_run_1",
                  review_posture: "REVIEW_REQUIRED",
                },
                support_status: "SUPPORTED",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await createAdvisoryCopilotEvidencePacketFromProposalVersion({
      proposal_id: "proposal_sg_structured_note_001",
      proposal_version_no: 1,
      action_family: "PROPOSAL_EXPLANATION",
      audience: "ADVISOR",
      created_by: "advisor_sg_001",
      reason: { business_reason: "Prepare advisor-use copilot review." },
    });
    await runAdvisoryCopilotAction(
      {
        evidence_packet_id: "copilot_packet_1",
        audience: "ADVISOR",
        requested_outputs: ["advisor_review_summary"],
        requested_by: "advisor_sg_001",
        requested_intents: ["explain_policy_posture"],
      },
      "idem-copilot-run",
    );
    await reviewAdvisoryCopilotRun(
      "copilot_run_1",
      {
        action: "APPROVE_FOR_INTERNAL_USE",
        reason: { decision: "Reviewed for internal advisor use." },
      },
      "idem-copilot-review",
    );
    await getAdvisoryCopilotSupportability();

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/advisory-copilot/evidence-packets/from-proposal-version`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          body: {
            proposal_id: "proposal_sg_structured_note_001",
            proposal_version_no: 1,
            action_family: "PROPOSAL_EXPLANATION",
            audience: "ADVISOR",
            created_by: "advisor_sg_001",
            reason: { business_reason: "Prepare advisor-use copilot review." },
          },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/advisory-copilot/actions`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-copilot-run",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/advisory-copilot/actions/copilot_run_1/reviews`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-copilot-review",
        }),
        body: JSON.stringify({
          body: {
            action: "APPROVE_FOR_INTERNAL_USE",
            reason: { decision: "Reviewed for internal advisor use." },
          },
        }),
      }),
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/advisory-copilot/supportability`,
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      "source_sections",
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("actor_id");
  });

  it("calls proposal version endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: { version_no: 2 },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await getProposalVersion("pp_1", 2, true);
    await createProposalVersion(
      "pp_1",
      { body: { created_by: "advisor_1", simulate_request: { options: {} } } },
      "idem-v2",
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/pp_1/versions/2?include_evidence=true`,
    );
    expect(calledUrls).toContain(`${expectedBaseUrl}/proposals/pp_1/versions`);
  });

  it("calls full Gateway-backed advisory operation support endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {},
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await createProposalArtifact(
      { body: { proposal_run_id: "pr_1" } },
      "idem-artifact-1",
    );
    await createProposalAsync(
      { body: { created_by: "advisor_1" } },
      "idem-async-1",
    );
    await createProposalVersionAsync(
      "pp_1",
      { body: { created_by: "advisor_1" } },
      "idem-version-async-1",
    );
    await getProposalOperation("apo_1");
    await getProposalOperationByCorrelation("corr-operation-1");
    await getProposalOperationReplayEvidence("apo_1");
    await getProposalVersionReplayEvidence("pp_1", 2);
    await getProposalIdempotencyRecord("idem-create-1");

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calledUrls).toContain(`${expectedBaseUrl}/proposals/artifact`);
    expect(calledUrls).toContain(`${expectedBaseUrl}/proposals/async`);
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/pp_1/versions/async`,
    );
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/operations/apo_1`,
    );
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/operations/by-correlation/corr-operation-1`,
    );
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/operations/apo_1/replay-evidence`,
    );
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/replay-evidence`,
    );
    expect(calledUrls).toContain(
      `${expectedBaseUrl}/proposals/idempotency/idem-create-1`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/artifact`,
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-artifact-1",
        }),
      }),
    );
  });

  it("calls reviewed narrative and delivery posture endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {
                narrative_review: {
                  review_state: "APPROVED_FOR_ADVISOR_USE",
                  source_narrative_hash: "sha256:narrative-001",
                },
                explanation: {
                  proposal_narrative_package: {
                    package_status: "INCLUDED_REVIEWED_NARRATIVE",
                  },
                },
                event_count: 1,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await reviewProposalNarrative(
      "pp_1",
      2,
      {
        action: "APPROVE",
        reviewed_by: "advisor_1",
        reason: "Evidence-grounded advisor narrative.",
      },
      "idem-review-1",
    );
    await regenerateProposalNarrative("pp_1", 2, {
      body: { requested_by: "advisor_1" },
    });
    await getProposalNarrative("pp_1", 2);
    const narrativeReviewEvidence = await getProposalNarrativeReviewEvidence(
      "pp_1",
      2,
    );
    expect(narrativeReviewEvidence.narrative_review?.review_state).toBe(
      "APPROVED_FOR_ADVISOR_USE",
    );
    await createProposalReportRequest("pp_1", {
      report_type: "PORTFOLIO_REVIEW",
      requested_by: "advisor_1",
      related_version_no: 2,
      include_reviewed_narrative: true,
    });
    await getProposalDeliverySummary("pp_1");
    await getProposalDeliveryEvents("pp_1");
    await createProposalExecutionHandoff(
      "pp_1",
      {
        body: { requested_by: "advisor_1", execution_provider: "lotus-manage" },
      },
      "idem-execution-handoff-1",
    );
    await recordProposalExecutionUpdate(
      "pp_1",
      { body: { handoff_status: "PARTIALLY_EXECUTED" } },
      "idem-execution-update-1",
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/narrative/review`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-review-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/report-requests`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/narrative/regenerate`,
      expect.objectContaining({ method: "POST" }),
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/proposals/pp_1/versions/2/narrative`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/proposals/pp_1/delivery-summary`,
    );
    expectNoStoreRequest(
      fetchMock,
      `${expectedBaseUrl}/proposals/pp_1/delivery-events`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/execution-handoffs`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-execution-handoff-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/execution-updates`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-execution-update-1",
        }),
      }),
    );
  });

  it("parses the Gateway implementation-status contract for the selected proposal", async () => {
    const { proposalImplementationStatusFixture } =
      await import("../fixtures/proposal-implementation-status");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(proposalImplementationStatusFixture()), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const result = await getProposalExecutionStatus(
      "PRP-IMPLEMENT",
      "PB_SG_GLOBAL_BAL_001",
      3,
      "EXECUTION_READY",
    );

    expect(result.contract_version).toBe("proposal-implementation-status.v1");
    expect(result.data.handoff_status).toBe("ACCEPTED");
    expect(global.fetch).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/PRP-IMPLEMENT/execution-status`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("calls proposal memo Gateway endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {
                memo_hash: "sha256:memo-001",
                memo: {
                  memo_hash: "sha256:memo-001",
                  review_posture: {
                    status: "RECORDED",
                    review_action: "APPROVE_FOR_ADVISOR_USE",
                  },
                },
                review_event: { event_type: "MEMO_REVIEW_RECORDED" },
                report_package_event: {
                  event_type: "MEMO_REPORT_PACKAGE_RECORDED",
                },
                report: { status: "ARCHIVED" },
                ai_event: { event_type: "MEMO_AI_REFERENCE_RECORDED" },
                commentary: {
                  status: "REVIEW_REQUIRED",
                  authoritative_for_memo_status: false,
                },
                hashes: { memo_hash: "sha256:memo-001" },
                replayed: false,
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await createProposalMemo(
      "pp_1",
      2,
      { created_by: "advisor_1", lifecycle_status: "DRAFT" },
      "idem-memo-create-1",
    );
    await getProposalMemo("pp_1", 2);
    await getProposalMemoProjection("pp_1", 2, "COMPLIANCE");
    const reviewResult = await reviewProposalMemo(
      "pp_1",
      2,
      {
        action: "APPROVE_FOR_ADVISOR_USE",
        reviewed_by: "compliance_1",
        reason: "Evidence-backed memo.",
        source_memo_hash: "sha256:memo-001",
        client_ready_release_requested: false,
      },
      "idem-memo-review-1",
    );
    const reportResult = await requestProposalMemoReportPackage(
      "pp_1",
      2,
      {
        requested_by: "advisor_1",
        source_memo_hash: "sha256:memo-001",
        requested_output_formats: ["pdf"],
        client_ready_document_requested: false,
      },
      "idem-memo-report-1",
    );
    await recordProposalMemoReportPackageEvent(
      "pp_1",
      2,
      { body: { event_type: "ARCHIVED", archive_ref: "archive_1" } },
      "idem-memo-report-event-1",
    );
    const commentaryResult = await requestProposalMemoAiCommentary(
      "pp_1",
      2,
      {
        requested_by: "advisor_1",
        source_memo_hash: "sha256:memo-001",
        requested_sections: ["EXECUTIVE_SUMMARY"],
      },
      "idem-memo-ai-1",
    );
    await requestProposalMemoAdvisorCommentary(
      "pp_1",
      2,
      {
        requested_by: "advisor_1",
        source_memo_hash: "sha256:memo-001",
        requested_sections: ["LIMITATIONS_AND_DISCLOSURES"],
      },
      "idem-memo-advisor-commentary-1",
    );
    await getProposalMemoLineage("pp_1");
    await getProposalMemoReplayEvidence("pp_1", 2);

    expect(reviewResult.memo?.review_posture?.review_action).toBe(
      "APPROVE_FOR_ADVISOR_USE",
    );
    expect(reviewResult.review_event?.event_type).toBe("MEMO_REVIEW_RECORDED");
    expect(reportResult.report_package_event?.event_type).toBe(
      "MEMO_REPORT_PACKAGE_RECORDED",
    );
    expect(commentaryResult.ai_event?.event_type).toBe(
      "MEMO_AI_REFERENCE_RECORDED",
    );
    expect(commentaryResult.commentary?.authoritative_for_memo_status).toBe(
      false,
    );

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-memo-create-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/projection?audience=COMPLIANCE`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/review`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-memo-review-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/report-packages`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-memo-report-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/report-package-events`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-memo-report-event-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/ai-commentary`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-memo-ai-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/ai-commentary`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "idem-memo-advisor-commentary-1",
        }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/memo/advisor-commentary"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/memos/lineage`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${expectedBaseUrl}/proposals/pp_1/versions/2/memo/replay-evidence`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it.each([
    ["memo", () => getProposalMemo("pp_1", 2)],
    ["projection", () => getProposalMemoProjection("pp_1", 2, "ADVISOR")],
    ["lineage", () => getProposalMemoLineage("pp_1")],
    ["replay evidence", () => getProposalMemoReplayEvidence("pp_1", 2)],
  ])(
    "preserves the HTTP status for a missing proposal memo %s read",
    async (_label, request) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("not found", { status: 404 })),
      );

      await expect(request()).rejects.toMatchObject({
        name: "WorkbenchApiError",
        status: 404,
      });
    },
  );

  it("calls full advisory workspace support endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              correlation_id: "c",
              contract_version: "v1",
              data: {},
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ),
    );

    await listAdvisoryWorkspaceSavedVersions("aws_1");
    await getAdvisoryWorkspaceSavedVersionReplayEvidence("aws_1", "awv_1");
    await resumeAdvisoryWorkspace("aws_1", {
      body: { workspace_version_id: "awv_1", actor_id: "advisor_1" },
    });
    await compareAdvisoryWorkspace("aws_1", {
      body: { workspace_version_id: "awv_1" },
    });
    await requestAdvisoryWorkspaceRationale("aws_1", {
      body: {
        requested_by: "advisor_1",
        instruction: "Summarize client impact.",
      },
    });
    await reviewAdvisoryWorkspaceRationale("aws_1", {
      body: {
        run_id: "packrun_1",
        action_type: "APPROVE",
        reviewed_by: "advisor_1",
      },
    });

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(calledUrls).toEqual([
      `${expectedBaseUrl}/advisory-workspaces/aws_1/saved-versions`,
      `${expectedBaseUrl}/advisory-workspaces/aws_1/saved-versions/awv_1/replay-evidence`,
      `${expectedBaseUrl}/advisory-workspaces/aws_1/resume`,
      `${expectedBaseUrl}/advisory-workspaces/aws_1/compare`,
      `${expectedBaseUrl}/advisory-workspaces/aws_1/assistant/rationale`,
      `${expectedBaseUrl}/advisory-workspaces/aws_1/assistant/rationale/review-actions`,
    ]);
  });
});
