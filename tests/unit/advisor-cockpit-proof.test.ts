import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const PORTFOLIO_ID = "PB_SG_GLOBAL_BAL_001";
const PROOF_MODULE_PATH: string =
  "../../scripts/live/validation/advisor-cockpit-proof.mjs";

type ProofSummary = { apiChecks: unknown[]; workflowPackChecks: unknown[] };
type ActionItemOptions = {
  actionItemId?: string;
  portfolioId?: string;
  ownerRole?: string;
  family?: string;
  status?: string;
  priority?: string;
  reasonCodes?: string[];
  acknowledged?: boolean;
};
type ActionListResponseOptions = Pick<
  ActionItemOptions,
  "actionItemId" | "portfolioId" | "ownerRole" | "acknowledged"
> & {
  includeHouseView?: boolean;
  totalCount?: number;
  nextCursor?: string;
};
type ValidateCanonicalAdvisorCockpit = (args: {
  summary: ProofSummary;
  scenario: {
    expectedClientReadyPublication: string;
    expectedSupportabilityPosture?: string;
    expectedWorkbenchPosture?: string;
    expectedMinPreparationPackets?: number;
    expectedActionFamilies?: string[];
    seedHouseViewCohort?: boolean;
    houseViewCohort?: Record<string, unknown>;
  };
  gatewayBaseUrl: string;
  portfolioId: string;
  proposalId: string;
  proposalVersionId: string;
  timeoutMs: number;
}) => Promise<{
  actionItemId: string;
  actionItemVersion: number;
  actionCount: number;
  snapshotId: string;
  preparationPacketCount: number;
  preparationPacketRouteCount: number;
  houseViewCohortId: string | null;
  supportabilityPosture: string;
  workbenchPosture: string;
  clientReadyPublication: string;
  paginationCursor: string | null;
  roleProjectionValidated: boolean;
}>;

let validateCanonicalAdvisorCockpit: ValidateCanonicalAdvisorCockpit;

function fetchCallUrl(fetchMock: ReturnType<typeof vi.fn>, index: number): string {
  return fetchMock.mock.calls[index][0].toString();
}

function fetchCallHeaders(
  fetchMock: ReturnType<typeof vi.fn>,
  index: number,
): Record<string, string> {
  return fetchMock.mock.calls[index][1]?.headers as Record<string, string>;
}

function expectNoLegacyAuthorityQuery(fetchMock: ReturnType<typeof vi.fn>): void {
  for (const [url] of fetchMock.mock.calls) {
    const value = url.toString();
    if (value.includes("/api/v1/advisor-cockpit/")) {
      expect(value).not.toContain("advisor_id=");
      expect(value).not.toContain("role=");
    }
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function actionItem({
  actionItemId = "aci_policy_review_001",
  portfolioId = PORTFOLIO_ID,
  ownerRole = "COMPLIANCE_REVIEWER",
  family = "POLICY_REVIEW_REQUIRED",
  status = "PENDING_REVIEW",
  priority = "HIGH",
  reasonCodes = ["POLICY_PENDING_REVIEW", "CLIENT_READY_BLOCKED"],
  acknowledged = false,
}: ActionItemOptions = {}): Record<string, unknown> {
  return {
    action_item_id: actionItemId,
    action_item_version: 7,
    action_family: family,
    status,
    priority,
    owner_role: ownerRole,
    owning_system: "lotus-advise",
    title: "Policy review required",
    next_required_action: "Review policy evidence before client-ready posture can change.",
    sla_age_band: "DUE_SOON",
    portfolio_id: portfolioId,
    reason_codes: reasonCodes,
    evidence_refs: [
      {
        evidence_id: "policy_eval_001",
        evidence_type: "POLICY_EVALUATION",
        source_system: "lotus-advise",
        access_class: "RESTRICTED_CUSTOMER_EVIDENCE",
        summary: "Policy evaluation requires review.",
      },
    ],
    lineage_refs: [
      {
        lineage_id: "policy_evaluation:policy_eval_001",
        source_system: "lotus-advise",
        content_hash: "sha256:policy-evaluation",
      },
    ],
    acknowledgement_state: acknowledged
      ? {
          acknowledged: true,
          acknowledgement_id: `ack_${actionItemId}`,
          acknowledged_by: "workbench-canonical-validator",
          acknowledged_at: "2026-05-27T00:00:00Z",
        }
      : { acknowledged: false },
  };
}

function actionListResponse({
  actionItemId = "aci_policy_review_001",
  portfolioId = PORTFOLIO_ID,
  ownerRole = "COMPLIANCE_REVIEWER",
  acknowledged = false,
  includeHouseView = false,
  totalCount,
  nextCursor,
}: ActionListResponseOptions = {}): Response {
  const items = [
    actionItem({ actionItemId, portfolioId, ownerRole, acknowledged }),
  ];
  if (includeHouseView) {
    items.push(
      actionItem({
        actionItemId: "aci_house_view_impact_review_001",
        portfolioId,
        ownerRole: "DPM_OWNER",
        family: "HOUSE_VIEW_IMPACT_REVIEW",
        priority: "MEDIUM",
        reasonCodes: ["TACTICAL_HOUSE_VIEW_PORTFOLIO_AFFECTED"],
      }),
    );
  }
  return jsonResponse({
    data: {
      total_count: totalCount ?? items.length,
      next_cursor: nextCursor,
      items,
    },
  });
}

function actionDetailResponse(): Response {
  return jsonResponse({
    data: actionItem(),
  });
}

function invalidCursorResponse(): Response {
  return jsonResponse(
    {
      detail: {
        code: "ADVISOR_COCKPIT_CURSOR_INVALID",
      },
    },
    422,
  );
}

function houseViewCohortResponse(): Response {
  return jsonResponse({
    data: {
      product_name: "TacticalHouseViewAffectedCohort",
      cohort_id: "thv_cohort_001",
      affected_portfolios: [{ portfolio_id: PORTFOLIO_ID }],
      supportability: { state: "READY" },
    },
  });
}

function snapshotResponse(): Response {
  return jsonResponse({
    data: {
      snapshot_id: "cockpit_snapshot_001",
      action_counts: {
        "status.PENDING_REVIEW": 1,
      },
      supportability: {
        client_ready_publication: "BLOCKED",
        workbench_posture: "CANONICAL_WORKBENCH_PROOF_PASSED_RFC0026",
      },
      preparation_packets: [
        {
          packet_id: "prep_proposal_sg_001_v1",
          context_type: "PROPOSAL",
          context_ref: "proposal_sg_001",
          status: "READY",
        },
      ],
    },
  });
}

function supportabilityResponse(
  posture = "ADVISE_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
): Response {
  return jsonResponse({
    data: {
      posture,
    },
  });
}

function preparationPacketsResponse(): Response {
  return jsonResponse({
    data: {
      total_count: 1,
      items: [
        {
          packet_id: "prep_proposal_sg_001_v1",
          context_type: "PROPOSAL",
          context_ref: "proposal_sg_001",
          status: "READY",
        },
      ],
    },
  });
}

function acknowledgementResponse(): Response {
  return jsonResponse({
    data: {
      action_item: {
        action_item_id: "aci_policy_review_001",
      },
      acknowledgement: {
        acknowledged: true,
      },
      replayed: true,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("advisor cockpit live proof", () => {
  beforeAll(async () => {
    const module = (await import(PROOF_MODULE_PATH)) as {
      validateCanonicalAdvisorCockpit: ValidateCanonicalAdvisorCockpit;
    };
    validateCanonicalAdvisorCockpit = module.validateCanonicalAdvisorCockpit;
  });

  it("validates action list, snapshot posture, supportability, and repeatable acknowledgement", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(actionListResponse())
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(supportabilityResponse())
      .mockResolvedValueOnce(acknowledgementResponse());
    vi.stubGlobal("fetch", fetchMock);

    const summary = { apiChecks: [], workflowPackChecks: [] };

    const proof = await validateCanonicalAdvisorCockpit({
      summary,
      scenario: { expectedClientReadyPublication: "BLOCKED" },
      gatewayBaseUrl: "http://gateway.dev.lotus",
      portfolioId: PORTFOLIO_ID,
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    });

    expect(proof).toMatchObject({
      actionItemId: "aci_policy_review_001",
      actionItemVersion: 7,
      actionCount: 1,
      snapshotId: "cockpit_snapshot_001",
      preparationPacketCount: 1,
      preparationPacketRouteCount: 1,
      clientReadyPublication: "BLOCKED",
      supportabilityPosture:
        "ADVISE_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
      workbenchPosture: "CANONICAL_WORKBENCH_PROOF_PASSED_RFC0026",
      paginationCursor: null,
      roleProjectionValidated: false,
    });
    expect(fetchCallUrl(fetchMock, 0)).toContain(
      `/api/v1/advisor-cockpit/actions?portfolio_id=${PORTFOLIO_ID}`,
    );
    expect(fetchCallHeaders(fetchMock, 0)).toMatchObject({
      "X-Actor-Id": "advisor_sg_001",
      "X-Authorized-Advisor-Id": "advisor_sg_001",
      "X-Authorized-Portfolio-Id": PORTFOLIO_ID,
      "X-Caller-Application": "lotus-workbench",
      "X-Caller-Capabilities": "advisory.advisor_cockpit.read",
      "X-Role": "ADVISOR",
    });
    expect(fetchCallUrl(fetchMock, 6)).toContain(
      "/api/v1/advisor-cockpit/supportability",
    );
    expect(fetchCallUrl(fetchMock, 5)).toContain(
      "/api/v1/advisor-cockpit/preparation-packets",
    );
    expect(fetchCallUrl(fetchMock, 7)).toContain(
      "/api/v1/advisor-cockpit/actions/aci_policy_review_001/acknowledgements",
    );
    expect(fetchCallHeaders(fetchMock, 7)["Idempotency-Key"]).toMatch(
      /^wb-advisor-cockpit-ack-/,
    );
    expect(fetchCallHeaders(fetchMock, 7)).toMatchObject({
      "X-Caller-Capabilities": "advisory.advisor_cockpit.acknowledge",
      "X-Role": "ADVISOR",
      "X-Authorized-Advisor-Id": "advisor_sg_001",
      "X-Authorized-Portfolio-Id": PORTFOLIO_ID,
    });
    expect(JSON.parse(fetchMock.mock.calls[7][1].body as string)).toEqual({
      action_item_version: 7,
      acknowledgement_note:
        "Canonical validation recorded advisor cockpit acknowledgement without clearing source-owned blockers.",
    });
    expect(summary.workflowPackChecks[0]).toMatchObject({
      actionType: "ADVISOR_COCKPIT_ACTION_ACKNOWLEDGED",
      portfolioId: PORTFOLIO_ID,
      actionItemId: "aci_policy_review_001",
      clientReadyPublication: "BLOCKED",
      preparationPacketCount: 1,
      preparationPacketRouteCount: 1,
      workbenchPosture: "CANONICAL_WORKBENCH_PROOF_PASSED_RFC0026",
      supportabilityPosture:
        "ADVISE_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
      replayed: true,
    });
    expect(fetchCallUrl(fetchMock, 1)).toContain(
      "/api/v1/advisor-cockpit/actions/aci_policy_review_001",
    );
    expect(fetchCallHeaders(fetchMock, 2)["X-Role"]).toBe(
      "COMPLIANCE_REVIEWER",
    );
    expect(fetchCallHeaders(fetchMock, 2)["X-Caller-Capabilities"]).toBe(
      "advisory.advisor_cockpit.read",
    );
    expect(fetchCallUrl(fetchMock, 3)).toContain(
      "cursor=invalid-rfc0026-cursor",
    );
    expectNoLegacyAuthorityQuery(fetchMock);
  });

  it("seeds house-view cohort evidence and requires cockpit action projection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(houseViewCohortResponse())
      .mockResolvedValueOnce(actionListResponse({ includeHouseView: true }))
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(
        actionListResponse({ totalCount: 2, nextCursor: "aci_policy_review_001" }),
      )
      .mockResolvedValueOnce(
        actionListResponse({ actionItemId: "aci_house_view_impact_review_001", totalCount: 2 }),
      )
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              actionItem({
                actionItemId: "aci_house_view_impact_review_001",
                ownerRole: "DPM_OWNER",
                family: "HOUSE_VIEW_IMPACT_REVIEW",
                reasonCodes: ["TACTICAL_HOUSE_VIEW_PORTFOLIO_AFFECTED"],
              }),
            ],
            total_count: 1,
          },
        }),
      )
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(supportabilityResponse())
      .mockResolvedValueOnce(acknowledgementResponse());
    vi.stubGlobal("fetch", fetchMock);

    const summary = { apiChecks: [], workflowPackChecks: [] };
    const proof = await validateCanonicalAdvisorCockpit({
      summary,
      scenario: {
        expectedClientReadyPublication: "BLOCKED",
        expectedActionFamilies: [
          "POLICY_REVIEW_REQUIRED",
          "HOUSE_VIEW_IMPACT_REVIEW",
        ],
        seedHouseViewCohort: true,
      },
      gatewayBaseUrl: "http://gateway.dev.lotus",
      portfolioId: PORTFOLIO_ID,
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    });

    expect(fetchCallUrl(fetchMock, 0)).toContain(
      "/api/v1/advisor-cockpit/house-view-cohorts/evaluate",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject(
      {
        body: {
          tactical_view: {
            tactical_view_id: "thv_2026_05_asia_duration",
          },
          candidate_portfolios: [{ portfolio_id: PORTFOLIO_ID }],
        },
      },
    );
    expect(proof.houseViewCohortId).toBe("thv_cohort_001");
    expect(proof.paginationCursor).toBe("aci_policy_review_001");
    expect(proof.roleProjectionValidated).toBe(true);
    expect(summary.workflowPackChecks[0]).toMatchObject({
      houseViewCohortId: "thv_cohort_001",
      paginationCursor: "aci_policy_review_001",
      roleProjectionValidated: true,
    });
    expect(fetchCallHeaders(fetchMock, 5)["X-Role"]).toBe(
      "COMPLIANCE_REVIEWER",
    );
    expect(fetchCallHeaders(fetchMock, 6)["X-Role"]).toBe(
      "PORTFOLIO_MANAGER",
    );
    expectNoLegacyAuthorityQuery(fetchMock);
  });

  it("reads later action pages when accumulated canonical history fills the first page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        actionListResponse({
          totalCount: 2,
          nextCursor: "aci_policy_review_001",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              actionItem({
                actionItemId: "aci_house_view_impact_review_001",
                ownerRole: "DPM_OWNER",
                family: "HOUSE_VIEW_IMPACT_REVIEW",
                priority: "MEDIUM",
                reasonCodes: ["TACTICAL_HOUSE_VIEW_PORTFOLIO_AFFECTED"],
              }),
            ],
            total_count: 2,
            next_cursor: null,
          },
        }),
      )
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(
        actionListResponse({ totalCount: 2, nextCursor: "aci_policy_review_001" }),
      )
      .mockResolvedValueOnce(
        actionListResponse({
          actionItemId: "aci_house_view_impact_review_001",
          totalCount: 2,
        }),
      )
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [
              actionItem({
                actionItemId: "aci_house_view_impact_review_001",
                ownerRole: "DPM_OWNER",
                family: "HOUSE_VIEW_IMPACT_REVIEW",
                reasonCodes: ["TACTICAL_HOUSE_VIEW_PORTFOLIO_AFFECTED"],
              }),
            ],
            total_count: 1,
          },
        }),
      )
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(supportabilityResponse())
      .mockResolvedValueOnce(acknowledgementResponse());
    vi.stubGlobal("fetch", fetchMock);

    const proof = await validateCanonicalAdvisorCockpit({
      summary: { apiChecks: [], workflowPackChecks: [] },
      scenario: {
        expectedClientReadyPublication: "BLOCKED",
        expectedActionFamilies: [
          "POLICY_REVIEW_REQUIRED",
          "HOUSE_VIEW_IMPACT_REVIEW",
        ],
      },
      gatewayBaseUrl: "http://gateway.dev.lotus",
      portfolioId: PORTFOLIO_ID,
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    });

    expect(proof.actionCount).toBe(2);
    expect(fetchCallUrl(fetchMock, 0)).toContain("limit=100");
    expect(fetchCallUrl(fetchMock, 1)).toContain(
      "cursor=aci_policy_review_001",
    );
    expectNoLegacyAuthorityQuery(fetchMock);
  });

  it("rejects missing expected cockpit action families", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(actionListResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisorCockpit({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {
          expectedClientReadyPublication: "BLOCKED",
          expectedActionFamilies: ["HOUSE_VIEW_IMPACT_REVIEW"],
        },
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: "proposal_001",
        proposalVersionId: "version_001",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Advisor cockpit canonical action list did not include expected action family HOUSE_VIEW_IMPACT_REVIEW",
    );
  });

  it("rejects supportability posture drift from the governed canonical contract", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(actionListResponse())
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(
        supportabilityResponse("ADVISE_API_SUPPORTED_DOWNSTREAM_GATED"),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisorCockpit({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {
          expectedClientReadyPublication: "BLOCKED",
          expectedSupportabilityPosture:
            "ADVISE_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
          expectedWorkbenchPosture: "CANONICAL_WORKBENCH_PROOF_PASSED_RFC0026",
          expectedMinPreparationPackets: 1,
        },
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: "proposal_001",
        proposalVersionId: "version_001",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Advisor cockpit supportability returned posture ADVISE_API_SUPPORTED_DOWNSTREAM_GATED",
    );
  });

  it("rejects missing meeting-preparation packets when the canonical contract requires them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(actionListResponse())
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            snapshot_id: "cockpit_snapshot_001",
            action_counts: {
              "status.PENDING_REVIEW": 1,
            },
            supportability: {
              client_ready_publication: "BLOCKED",
              workbench_posture: "CANONICAL_WORKBENCH_PROOF_PASSED_RFC0026",
            },
            preparation_packets: [],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisorCockpit({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: {
          expectedClientReadyPublication: "BLOCKED",
          expectedMinPreparationPackets: 1,
        },
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: "proposal_001",
        proposalVersionId: "version_001",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(
      "Advisor cockpit snapshot returned 0 preparation packets, expected at least 1",
    );
  });

  it("scopes acknowledgement idempotency keys to the action identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        actionListResponse({ actionItemId: "aci_policy_review_001" }),
      )
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(supportabilityResponse())
      .mockResolvedValueOnce(acknowledgementResponse())
      .mockResolvedValueOnce(
        actionListResponse({ actionItemId: "aci_policy_review_002" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: actionItem({ actionItemId: "aci_policy_review_002" }),
        }),
      )
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(supportabilityResponse())
      .mockResolvedValueOnce(acknowledgementResponse());
    vi.stubGlobal("fetch", fetchMock);

    const baseArgs = {
      summary: { apiChecks: [], workflowPackChecks: [] },
      scenario: { expectedClientReadyPublication: "BLOCKED" },
      gatewayBaseUrl: "http://gateway.dev.lotus",
      portfolioId: PORTFOLIO_ID,
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    };

    await validateCanonicalAdvisorCockpit(baseArgs);
    await validateCanonicalAdvisorCockpit({
      ...baseArgs,
      summary: { apiChecks: [], workflowPackChecks: [] },
    });

    expect(fetchCallHeaders(fetchMock, 7)["Idempotency-Key"]).toMatch(
      /^wb-advisor-cockpit-ack-/,
    );
    expect(fetchCallHeaders(fetchMock, 15)["Idempotency-Key"]).toMatch(
      /^wb-advisor-cockpit-ack-/,
    );
    expect(fetchCallHeaders(fetchMock, 7)["Idempotency-Key"]).not.toBe(
      fetchCallHeaders(fetchMock, 15)["Idempotency-Key"],
    );
    expectNoLegacyAuthorityQuery(fetchMock);
  });

  it("treats already acknowledged source state as repeatable canonical proof", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(actionListResponse({ acknowledged: true }))
      .mockResolvedValueOnce(actionDetailResponse())
      .mockResolvedValueOnce(actionListResponse({ ownerRole: "COMPLIANCE_REVIEWER" }))
      .mockResolvedValueOnce(invalidCursorResponse())
      .mockResolvedValueOnce(snapshotResponse())
      .mockResolvedValueOnce(preparationPacketsResponse())
      .mockResolvedValueOnce(supportabilityResponse());
    vi.stubGlobal("fetch", fetchMock);

    const summary = { apiChecks: [], workflowPackChecks: [] };

    const proof = await validateCanonicalAdvisorCockpit({
      summary,
      scenario: { expectedClientReadyPublication: "BLOCKED" },
      gatewayBaseUrl: "http://gateway.dev.lotus",
      portfolioId: PORTFOLIO_ID,
      proposalId: "proposal_001",
      proposalVersionId: "version_001",
      timeoutMs: 1000,
    });

    expect(proof.actionItemId).toBe("aci_policy_review_001");
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(
      fetchMock.mock.calls.some((call) =>
        call[0].toString().includes("/acknowledgements"),
      ),
    ).toBe(false);
    expect(summary.workflowPackChecks[0]).toMatchObject({
      actionType: "ADVISOR_COCKPIT_ACTION_ACKNOWLEDGED",
      portfolioId: PORTFOLIO_ID,
      actionItemId: "aci_policy_review_001",
      alreadyAcknowledged: true,
      replayed: true,
    });
  });

  it("rejects action lists that escape the requested portfolio scope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        actionListResponse({ portfolioId: "PB_OTHER_001" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateCanonicalAdvisorCockpit({
        summary: { apiChecks: [], workflowPackChecks: [] },
        scenario: { expectedClientReadyPublication: "BLOCKED" },
        gatewayBaseUrl: "http://gateway.dev.lotus",
        portfolioId: PORTFOLIO_ID,
        proposalId: "proposal_001",
        proposalVersionId: "version_001",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow("Advisor cockpit returned out-of-scope action");
  });
});
