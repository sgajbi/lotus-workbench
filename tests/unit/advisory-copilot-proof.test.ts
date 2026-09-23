import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const PORTFOLIO_ID = "PB_SG_GLOBAL_BAL_001";
const PROPOSAL_ID = "proposal_rfc27_001";
const PROPOSAL_VERSION_ID = "version_rfc27_001";
const POLICY_AUTHORITY = {
  tenantId: "tenant-sg",
  legalEntityCode: "REFERENCE",
  actorId: "advisor_1",
};
const PROOF_MODULE_PATH: string =
  "../../scripts/live/validation/advisory-copilot-proof.mjs";

type ProofSummary = { apiChecks: unknown[]; workflowPackChecks: unknown[] };
type ValidateCanonicalAdvisoryCopilot = (args: {
  summary: ProofSummary;
  scenario: Record<string, unknown>;
  gatewayBaseUrl: string;
  portfolioId: string;
  proposalId: string;
  proposalVersionId: string;
  proposalVersionNo: number;
  authority: typeof POLICY_AUTHORITY;
  timeoutMs: number;
  proofExecutionId?: string;
}) => Promise<{
  actionRunCount: number;
  sourcePacketCount: number;
  guardrailPosture: string;
  clientReadyPublication: string;
  proposalVersionRunCount: number;
}>;

let validateCanonicalAdvisoryCopilot: ValidateCanonicalAdvisoryCopilot;

const ACTIONS = [
  "PROPOSAL_EXPLANATION",
  "EVIDENCE_QA",
  "MEETING_PREPARATION",
  "COMPLIANCE_REVIEW_SUMMARY",
  "OPERATIONS_REPORT_HANDOFF",
  "CLIENT_FOLLOW_UP_DRAFT",
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function supportabilityResponse({
  supportStatus = "ADVISE_COPILOT_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
} = {}): Response {
  return jsonResponse({
    data: {
      support_status: supportStatus,
      client_ready_publication: "BLOCKED",
      supported_action_families: ACTIONS,
      boundaries: [
        "CLIENT_READY_PUBLICATION",
        "POLICY_APPROVAL_OR_SIGN_OFF",
        "OMS_ORDER_LIFECYCLE",
        "CLIENT_COMMUNICATION_DELIVERY",
      ],
    },
  });
}

function evidencePacket(actionFamily: string): Record<string, unknown> {
  return {
    evidence_packet_id: `packet_${actionFamily.toLowerCase()}`,
    evidence_packet_hash: `sha256:${actionFamily.toLowerCase()}`,
    action_family: actionFamily,
    portfolio_id: PORTFOLIO_ID,
    proposal_id: PROPOSAL_ID,
    client_ready_publication: "BLOCKED",
    sections: [
      {
        section_key: "PROPOSAL_CONTEXT",
        title: "Proposal context",
        evidence_class: "ADVISOR_USE_SUMMARY",
        summary_items: ["Proposal version evidence is available."],
        source_refs: [
          {
            source_system: "lotus-advise",
            source_type: "PROPOSAL_VERSION",
            source_id: PROPOSAL_VERSION_ID,
            content_hash: "sha256:proposal-version",
            access_class: "ADVISOR_USE_SUMMARY",
          },
        ],
      },
    ],
    unsupported_evidence: [],
    lineage_refs: [
      {
        lineage_type: "EVIDENCE_PACKET",
        lineage_id: `packet_${actionFamily.toLowerCase()}`,
        source_system: "lotus-advise",
      },
    ],
    retention_class: "ADVISORY_REVIEW_RECORD",
  };
}

function runRecord(
  actionFamily: string,
  posture = "REVIEW_REQUIRED",
): Record<string, unknown> {
  return {
    run_id: `run_${actionFamily.toLowerCase()}_${posture.toLowerCase()}`,
    action_family: actionFamily,
    audience: "ADVISOR",
    portfolio_id: PORTFOLIO_ID,
    proposal_id: PROPOSAL_ID,
    evidence_packet_id: `packet_${actionFamily.toLowerCase()}`,
    evidence_packet_hash: `sha256:${actionFamily.toLowerCase()}`,
    request_hash: `sha256:request-${actionFamily}`,
    output_hash: `sha256:output-${actionFamily}`,
    review_posture: posture,
    client_ready_publication: "BLOCKED",
    workflow_pack_id: `advisory_copilot_${actionFamily.toLowerCase()}.pack`,
    workflow_pack_version: "v1",
    output_sections_json:
      posture === "REVIEW_REQUIRED"
        ? [
            {
              section_key: "ADVISOR_REVIEW",
              title: "Advisor review",
              text: "Review source-backed advisory evidence.",
            },
          ]
        : [],
    review_guidance_json: ["Review against source evidence."],
    guardrail_results_json:
      posture === "GUARDRAIL_REJECTED"
        ? ["CLIENT_READY_PUBLICATION_FORBIDDEN"]
        : [],
    lineage_json: {
      proposal_version_id: PROPOSAL_VERSION_ID,
    },
  };
}

function reviewResponse(actionFamily: string): Response {
  return jsonResponse({
    data: {
      run: runRecord(actionFamily, "APPROVED_FOR_INTERNAL_USE"),
      review: {
        review_id: `review_${actionFamily.toLowerCase()}`,
        run_id: `run_${actionFamily.toLowerCase()}_review_required`,
        action: "APPROVE_FOR_INTERNAL_USE",
        previous_posture: "REVIEW_REQUIRED",
        new_posture: "APPROVED_FOR_INTERNAL_USE",
        actor_id: "desk_head_sg_001",
        request_hash: `sha256:review-${actionFamily}`,
      },
    },
  });
}

function createFetchMock({ omitListedRun }: { omitListedRun?: string } = {}) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const target = url.toString();
    const body = init?.body ? JSON.parse(init.body.toString()) : {};
    if (target.endsWith("/api/v1/advisory-copilot/supportability")) {
      return supportabilityResponse();
    }
    if (target.includes("/evidence-packets/from-proposal-version")) {
      expect(body.body).not.toHaveProperty("source_sections");
      return jsonResponse({
        data: {
          evidence_packet: evidencePacket(body.body.action_family),
        },
      });
    }
    if (target.endsWith("/api/v1/advisory-copilot/actions")) {
      const packetId = body.body.evidence_packet_id as string;
      const actionFamily = ACTIONS.find((action) =>
        packetId.includes(action.toLowerCase()),
      );
      if (!actionFamily) {
        throw new Error(`No action family for ${packetId}`);
      }
      if (body.body.requested_intents?.includes("publish_client_ready")) {
        return jsonResponse({
          data: {
            run: runRecord(actionFamily, "GUARDRAIL_REJECTED"),
          },
        });
      }
      return jsonResponse({
        data: {
          run: runRecord(actionFamily),
        },
      });
    }
    if (target.includes("/reviews")) {
      const actionFamily = ACTIONS.find((action) =>
        target.includes(`run_${action.toLowerCase()}_review_required`),
      );
      if (!actionFamily) {
        throw new Error(`No review action family for ${target}`);
      }
      return reviewResponse(actionFamily);
    }
    if (
      target.includes(
        `/proposals/${PROPOSAL_ID}/versions/${PROPOSAL_VERSION_ID}/runs`,
      )
    ) {
      return jsonResponse({
        data: {
          items: ACTIONS.filter((action) => action !== omitListedRun).map(
            (action) => runRecord(action),
          ),
        },
      });
    }
    throw new Error(`Unhandled fetch ${target}`);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("advisory copilot live proof", () => {
  beforeAll(async () => {
    const module = (await import(PROOF_MODULE_PATH)) as {
      validateCanonicalAdvisoryCopilot: ValidateCanonicalAdvisoryCopilot;
    };
    validateCanonicalAdvisoryCopilot = module.validateCanonicalAdvisoryCopilot;
  });

  it("validates source-owned packets, all action families, review, guardrails, and run listing", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const summary = { apiChecks: [], workflowPackChecks: [] };

    const proof = await validateCanonicalAdvisoryCopilot({
      summary,
      scenario: {},
      gatewayBaseUrl: "http://gateway.dev.lotus",
      portfolioId: PORTFOLIO_ID,
      proposalId: PROPOSAL_ID,
      proposalVersionId: PROPOSAL_VERSION_ID,
      proposalVersionNo: 1,
      authority: POLICY_AUTHORITY,
      timeoutMs: 1000,
      proofExecutionId: "proof-execution-001",
    });

    expect(proof).toMatchObject({
      actionRunCount: 6,
      sourcePacketCount: 6,
      guardrailPosture: "GUARDRAIL_REJECTED",
      clientReadyPublication: "BLOCKED",
      proposalVersionRunCount: 6,
    });
    expect(fetchMock).toHaveBeenCalledTimes(22);
    const protectedCalls = fetchMock.mock.calls.filter(
      (call) =>
        !call[0].toString().endsWith("/api/v1/advisory-copilot/supportability"),
    );
    expect(protectedCalls).toHaveLength(21);
    for (const [, init] of protectedCalls) {
      expect(init?.headers).toEqual(
        expect.objectContaining({
          "X-Tenant-Id": POLICY_AUTHORITY.tenantId,
          "X-Legal-Entity-Code": POLICY_AUTHORITY.legalEntityCode,
          "X-Principal-Status": "ACTIVE",
          "X-Authorized-Proposal-Id": PROPOSAL_ID,
          "X-Authorized-Portfolio-Id": PORTFOLIO_ID,
        }),
      );
    }
    expect(
      protectedCalls.map(
        (call) =>
          (call[1]?.headers as Record<string, string>)["X-Caller-Capabilities"],
      ),
    ).toEqual(
      expect.arrayContaining([
        "advisory.policy_evaluation.read",
        "advisory.copilot.action",
        "advisory.copilot.review",
        "advisory.copilot.read",
      ]),
    );
    expect(
      fetchMock.mock.calls
        .filter((call) =>
          call[0].toString().endsWith("/api/v1/advisory-copilot/actions"),
        )
        .map((call) => call[1]?.headers),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(/^wb-copilot-run-/),
        }),
        expect.objectContaining({
          "Idempotency-Key": expect.stringMatching(/^wb-copilot-guardrail-/),
        }),
      ]),
    );
    expect(summary.workflowPackChecks[0]).toMatchObject({
      actionType: "ADVISORY_COPILOT_CANONICAL_PROOF_CREATED",
      scenarioId: "RFC27_ADVISORY_COPILOT_CANONICAL",
      portfolioId: PORTFOLIO_ID,
      actionRunCount: 6,
      sourcePacketCount: 6,
      guardrailPosture: "GUARDRAIL_REJECTED",
      clientReadyPublication: "BLOCKED",
    });
    expect(summary.workflowPackChecks[0]).toMatchObject({
      proofExecutionId: "proof-execution-001",
    });
    expect(
      fetchMock.mock.calls
        .filter((call) =>
          call[0].toString().endsWith("/api/v1/advisory-copilot/actions"),
        )
        .map(
          (call) => JSON.parse(call[1]?.body?.toString() ?? "{}").body.reason,
        ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proof_execution_id: "proof-execution-001" }),
      ]),
    );
  });

  it("scopes action idempotency by proof execution so prior reviewed runs cannot be replayed", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    for (const proofExecutionId of ["proof-execution-a", "proof-execution-b"]) {
      await validateCanonicalAdvisoryCopilot({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {},
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: PROPOSAL_ID,
        proposalVersionId: PROPOSAL_VERSION_ID,
        proposalVersionNo: 1,
        authority: POLICY_AUTHORITY,
        timeoutMs: 1000,
        proofExecutionId,
      });
    }

    const proposalExplanationRunKeys = fetchMock.mock.calls
      .filter((call) =>
        call[0].toString().endsWith("/api/v1/advisory-copilot/actions"),
      )
      .filter((call) => {
        const requestBody = JSON.parse(call[1]?.body?.toString() ?? "{}");
        return (
          requestBody.body.evidence_packet_id ===
            "packet_proposal_explanation" &&
          !requestBody.body.requested_intents?.includes("publish_client_ready")
        );
      })
      .map(
        (call) =>
          (call[1]?.headers as Record<string, string>)["Idempotency-Key"],
      );

    expect(proposalExplanationRunKeys).toHaveLength(2);
    expect(new Set(proposalExplanationRunKeys).size).toBe(2);
  });

  it("rejects supportability drift before creating action runs", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      supportabilityResponse({
        supportStatus: "ADVISE_API_CERTIFIED_GATEWAY_WORKBENCH_PENDING",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisoryCopilot({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {},
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: PROPOSAL_ID,
        proposalVersionId: PROPOSAL_VERSION_ID,
        proposalVersionNo: 1,
        authority: POLICY_AUTHORITY,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("Advisory copilot supportability returned");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed before tenant-owned calls when policy authority is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(supportabilityResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisoryCopilot({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {},
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: PROPOSAL_ID,
        proposalVersionId: PROPOSAL_VERSION_ID,
        proposalVersionNo: 1,
        authority: { ...POLICY_AUTHORITY, tenantId: "" },
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Advisory copilot proof requires the authority consumed by the canonical policy evaluation",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects proposal-version run listings that omit a canonical action run", async () => {
    const fetchMock = createFetchMock({
      omitListedRun: "CLIENT_FOLLOW_UP_DRAFT",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisoryCopilot({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {},
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: PROPOSAL_ID,
        proposalVersionId: PROPOSAL_VERSION_ID,
        proposalVersionNo: 1,
        authority: POLICY_AUTHORITY,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Advisory copilot proposal-version run list did not include CLIENT_FOLLOW_UP_DRAFT",
    );
  });
});
