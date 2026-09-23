import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const PORTFOLIO_ID = "PB_SG_GLOBAL_BAL_001";
const PROOF_MODULE_PATH: string =
  "../../scripts/live/validation/advisory-policy-proof.mjs";

type CanonicalScenario = ReturnType<typeof canonicalScenario>;
type ProofSummary = { apiChecks: unknown[]; workflowPackChecks: unknown[] };
type CreateCanonicalPolicyEvaluation = (args: {
  summary: ProofSummary;
  scenario: CanonicalScenario;
  gatewayBaseUrl: string;
  proposalId: string;
  proposalVersionId: string;
  timeoutMs: number;
}) => Promise<{
  evaluationId: string;
  evaluationHash: string;
  authority: { tenantId: string; legalEntityCode: string; actorId: string };
}>;

let createCanonicalPolicyEvaluation: CreateCanonicalPolicyEvaluation;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function canonicalScenario() {
  return {
    scenarioId: "RFC23_25_ADVISORY_PROPOSAL_POLICY_CANONICAL",
    policyPackId: "SG_PRIVATE_BANKING_REFERENCE",
    policyVersion: "2026.05",
    createdBy: "workbench-canonical-validator",
    expectedEvaluationStatus: "PENDING_REVIEW",
    expectedClientReadyPublication: "BLOCKED",
    evidenceBundle: {
      inputs: {
        portfolio_snapshot: {
          portfolio_id: PORTFOLIO_ID,
        },
      },
    },
  };
}

function policyPackVersionResponse(): Response {
  return jsonResponse({
    data: {
      policy_pack_version: {
        policy_pack: {
          content_hash: "policy-content-hash",
        },
      },
      applicability: {
        legal_entity_scope: ["REFERENCE"],
      },
    },
  });
}

function createdEvaluationResponse({
  portfolioId = PORTFOLIO_ID,
  evaluationId = "pev_001",
  evaluationHash = "evaluation-hash",
} = {}): Response {
  return jsonResponse({
    data: {
      record: {
        evaluation_id: evaluationId,
        evaluation_hash: evaluationHash,
        evaluation_status: "PENDING_REVIEW",
        portfolio_id: portfolioId,
      },
    },
  });
}

function reviewQueueResponse({
  portfolioId = PORTFOLIO_ID,
  evaluationId = "pev_001",
} = {}): Response {
  return jsonResponse({
    data: {
      items: [
        {
          evaluation_id: evaluationId,
          evaluation_status: "PENDING_REVIEW",
          portfolio_id: portfolioId,
        },
      ],
      queue_posture: {
        client_ready_publication: "BLOCKED",
      },
    },
  });
}

function workflowResponse(): Response {
  return jsonResponse({
    data: {
      sign_off_status: "PENDING_REVIEW",
      client_ready_publication: "BLOCKED",
    },
  });
}

function signOffPackageResponse(): Response {
  return jsonResponse({
    data: {
      package_posture: {
        client_ready_publication: "BLOCKED",
      },
    },
  });
}

function successfulFetchMock({
  evaluationId = "pev_001",
  evaluationHash = "evaluation-hash",
} = {}) {
  return vi
    .fn()
    .mockResolvedValueOnce(policyPackVersionResponse())
    .mockResolvedValueOnce(jsonResponse({ data: { status: "validated" } }))
    .mockResolvedValueOnce(jsonResponse({ data: { status: "active" } }))
    .mockResolvedValueOnce(
      createdEvaluationResponse({ evaluationId, evaluationHash }),
    )
    .mockResolvedValueOnce(reviewQueueResponse({ evaluationId }))
    .mockResolvedValueOnce(workflowResponse())
    .mockResolvedValueOnce(signOffPackageResponse())
    .mockResolvedValueOnce(jsonResponse({ data: { status: "recorded" } }));
}

function readIdempotencyKey(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex: number,
): string {
  const options = fetchMock.mock.calls[callIndex]?.[1] as
    RequestInit | undefined;
  const headers = options?.headers as Record<string, string> | undefined;
  const key = headers?.["Idempotency-Key"];
  if (!key) {
    throw new Error(
      `Fetch call ${callIndex} did not carry an Idempotency-Key header.`,
    );
  }
  return key;
}

function readHeaders(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex: number,
): Record<string, string> {
  const options = fetchMock.mock.calls[callIndex]?.[1] as
    RequestInit | undefined;
  return (options?.headers as Record<string, string> | undefined) ?? {};
}

async function captureMutationKeys({
  scenario = canonicalScenario(),
  proposalId = "proposal_001",
  proposalVersionId = "version_001",
  evaluationId = "pev_001",
  evaluationHash = "evaluation-hash",
}: {
  scenario?: CanonicalScenario;
  proposalId?: string;
  proposalVersionId?: string;
  evaluationId?: string;
  evaluationHash?: string;
} = {}) {
  const fetchMock = successfulFetchMock({ evaluationId, evaluationHash });
  vi.stubGlobal("fetch", fetchMock);

  await createCanonicalPolicyEvaluation({
    summary: { apiChecks: [], workflowPackChecks: [] },
    scenario,
    gatewayBaseUrl: "http://gateway.dev.lotus",
    proposalId,
    proposalVersionId,
    timeoutMs: 1000,
  });

  return {
    validate: readIdempotencyKey(fetchMock, 1),
    activate: readIdempotencyKey(fetchMock, 2),
    create: readIdempotencyKey(fetchMock, 3),
    signOff: readIdempotencyKey(fetchMock, 7),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("advisory policy live proof", () => {
  beforeAll(async () => {
    const module = (await import(PROOF_MODULE_PATH)) as {
      createCanonicalPolicyEvaluation: CreateCanonicalPolicyEvaluation;
    };
    createCanonicalPolicyEvaluation = module.createCanonicalPolicyEvaluation;
  });

  it("uses maker-checker actors and portfolio-scoped review queue validation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(policyPackVersionResponse())
      .mockResolvedValueOnce(jsonResponse({ data: { status: "validated" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "active" } }))
      .mockResolvedValueOnce(createdEvaluationResponse())
      .mockResolvedValueOnce(reviewQueueResponse())
      .mockResolvedValueOnce(workflowResponse())
      .mockResolvedValueOnce(signOffPackageResponse())
      .mockResolvedValueOnce(jsonResponse({ data: { status: "recorded" } }));
    vi.stubGlobal("fetch", fetchMock);

    const summary = { apiChecks: [], workflowPackChecks: [] };

    await createCanonicalPolicyEvaluation({
      summary,
      scenario: canonicalScenario(),
      gatewayBaseUrl: "http://gateway.dev.lotus",
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    });

    const validateBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const activateBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(validateBody.body.requested_by).toBe(
      "workbench-canonical-validator",
    );
    expect(activateBody.body.activated_by).toBe(
      "workbench-canonical-policy-checker",
    );
    expect(activateBody.body.activated_by).not.toBe(
      validateBody.body.requested_by,
    );

    const reviewQueueUrl = fetchMock.mock.calls[4][0].toString();
    expect(reviewQueueUrl).toContain("evaluation_status=PENDING_REVIEW");
    expect(reviewQueueUrl).toContain(`portfolio_id=${PORTFOLIO_ID}`);
    expect(summary.workflowPackChecks[0]).toMatchObject({
      actionType: "POLICY_EVALUATION_PENDING_REVIEW_CREATED",
      portfolioId: PORTFOLIO_ID,
      clientReadyPublication: "BLOCKED",
    });
  });

  it("carries least-privilege caller authority through every governed policy request", async () => {
    const fetchMock = successfulFetchMock();
    const scenario = canonicalScenario();
    vi.stubGlobal("fetch", fetchMock);

    const proof = await createCanonicalPolicyEvaluation({
      summary: { apiChecks: [], workflowPackChecks: [] },
      scenario,
      gatewayBaseUrl: "http://gateway.dev.lotus",
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    });

    expect(proof.authority).toEqual({
      tenantId: "tenant-sg",
      legalEntityCode: "REFERENCE",
      actorId: scenario.createdBy,
    });

    expect(readHeaders(fetchMock, 1)).toMatchObject({
      "X-Actor-Id": "workbench-canonical-validator",
      "X-Tenant-Id": "tenant-sg",
      "X-Legal-Entity-Code": "REFERENCE",
      "X-Role": "POLICY_STEWARD",
      "X-Caller-Capabilities": "advisory.policy_pack.validate",
    });
    expect(readHeaders(fetchMock, 2)).toMatchObject({
      "X-Actor-Id": "workbench-canonical-policy-checker",
      "X-Tenant-Id": "tenant-sg",
      "X-Legal-Entity-Code": "REFERENCE",
      "X-Role": "POLICY_CHECKER",
      "X-Caller-Capabilities": "advisory.policy_pack.activate",
    });
    expect(readHeaders(fetchMock, 3)).toMatchObject({
      "X-Actor-Id": scenario.createdBy,
      "X-Tenant-Id": "tenant-sg",
      "X-Legal-Entity-Code": "REFERENCE",
      "X-Role": "ADVISOR",
      "X-Caller-Capabilities": "advisory.policy_evaluation.finalize",
      "X-Authorized-Proposal-Id": "proposal_001",
      "X-Authorized-Portfolio-Id": PORTFOLIO_ID,
    });

    for (const callIndex of [4, 5, 6]) {
      expect(readHeaders(fetchMock, callIndex)).toMatchObject({
        "X-Actor-Id": scenario.createdBy,
        "X-Tenant-Id": "tenant-sg",
        "X-Legal-Entity-Code": "REFERENCE",
        "X-Role": "ADVISOR",
        "X-Caller-Capabilities": "advisory.policy_evaluation.read",
      });
    }

    expect(readHeaders(fetchMock, 7)).toMatchObject({
      "X-Actor-Id": "policy_checker_1",
      "X-Tenant-Id": "tenant-sg",
      "X-Legal-Entity-Code": "REFERENCE",
      "X-Role": "POLICY_CHECKER",
      "X-Caller-Capabilities": "advisory.policy_evaluation.sign_off",
      "X-Authorized-Proposal-Id": "proposal_001",
      "X-Authorized-Portfolio-Id": PORTFOLIO_ID,
    });
  });

  it("fails closed when the policy pack does not identify one authoritative legal entity", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          policy_pack_version: {
            policy_pack: { content_hash: "policy-content-hash" },
          },
          applicability: { legal_entity_scope: ["REFERENCE", "SGPB"] },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCanonicalPolicyEvaluation({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: canonicalScenario(),
        gatewayBaseUrl: "http://gateway.dev.lotus",
        proposalId: "proposal_001",
        proposalVersionId: "version_001",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Canonical advisory policy pack must declare exactly one legal-entity scope.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects review queue responses that are not scoped to the canonical portfolio", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(policyPackVersionResponse())
      .mockResolvedValueOnce(jsonResponse({ data: { status: "validated" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "active" } }))
      .mockResolvedValueOnce(createdEvaluationResponse())
      .mockResolvedValueOnce(
        reviewQueueResponse({ portfolioId: "PB_OTHER_001" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createCanonicalPolicyEvaluation({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: canonicalScenario(),
        gatewayBaseUrl: "http://gateway.dev.lotus",
        proposalId: "proposal_001",
        proposalVersionId: "version_001",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Canonical policy review queue returned item outside portfolio scope PB_SG_GLOBAL_BAL_001",
    );
  });

  it("keeps advisory policy mutation keys stable for an exact resource and payload replay", async () => {
    const first = await captureMutationKeys();
    const replay = await captureMutationKeys();

    expect(replay).toEqual(first);
  });

  it("isolates advisory policy mutation keys by their route resource identity", async () => {
    const baseline = await captureMutationKeys();
    const otherPolicyPack = await captureMutationKeys({
      scenario: {
        ...canonicalScenario(),
        policyPackId: "SG_PRIVATE_BANKING_ALTERNATE",
        policyVersion: "2026.06",
      },
    });
    const otherProposal = await captureMutationKeys({
      proposalId: "proposal_002",
      evaluationId: "pev_002",
    });
    const otherProposalVersion = await captureMutationKeys({
      proposalVersionId: "version_002",
      evaluationId: "pev_003",
    });

    expect(otherPolicyPack.validate).not.toBe(baseline.validate);
    expect(otherPolicyPack.activate).not.toBe(baseline.activate);
    expect(otherProposal.create).not.toBe(baseline.create);
    expect(otherProposal.signOff).not.toBe(baseline.signOff);
    expect(otherProposalVersion.create).not.toBe(baseline.create);
    expect(otherProposalVersion.signOff).not.toBe(baseline.signOff);
  });

  it("isolates advisory policy mutation keys when the request payload changes", async () => {
    const baseline = await captureMutationKeys();
    const changedCreatePayload = await captureMutationKeys({
      scenario: {
        ...canonicalScenario(),
        createdBy: "workbench-canonical-validator-2",
      },
    });
    const changedSignOffPayload = await captureMutationKeys({
      evaluationHash: "evaluation-hash-2",
    });

    expect(changedCreatePayload.create).not.toBe(baseline.create);
    expect(changedSignOffPayload.signOff).not.toBe(baseline.signOff);
  });
});
