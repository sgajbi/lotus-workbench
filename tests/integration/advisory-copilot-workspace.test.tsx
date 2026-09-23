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

import AdvisoryCopilotWorkspace from "../../src/features/proposals/components/advisory-copilot-workspace";
import type {
  AdvisoryCopilotReviewData,
  AdvisoryCopilotRunData,
} from "../../src/features/proposals/types";

const listProposalsMock = vi.fn(async (_filters: unknown) => ({
  items: [
    {
      proposal_id: "proposal_sg_structured_note_001",
      portfolio_id: "PB_SG_GLOBAL_BAL_001",
      current_state: "COMPLIANCE_REVIEW",
      current_version_no: 1,
      title: "Structured note proposal review",
    },
  ],
}));
const getAdvisoryCopilotSupportabilityMock = vi.fn(async () => ({
  support_status: "ADVISE_COPILOT_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
  client_ready_publication: "BLOCKED",
  supported_action_families: [
    "PROPOSAL_EXPLANATION",
    "MEETING_PREPARATION",
  ],
  boundaries: [
    "CLIENT_READY_PUBLICATION is blocked",
    "POLICY_APPROVAL_OR_SIGN_OFF is not delegated to copilot",
  ],
}));
const createEvidencePacketMock = vi.fn(async (_payload: unknown) => ({
  evidence_packet: {
    evidence_packet_id: "copilot_packet_1",
    proposal_id: "proposal_sg_structured_note_001",
    portfolio_id: "PB_SG_GLOBAL_BAL_001",
    client_ready_publication: "BLOCKED",
    sections: [
      {
        section_key: "POLICY_POSTURE",
        title: "Policy posture",
        summary_items: ["Policy evaluation requires compliance review."],
        source_refs: [
          {
            source_system: "lotus-manage",
            source_type: "policy-evaluation",
            source_id: "policy-evaluation-1",
            access_class: "ADVISOR_INTERNAL",
          },
        ],
      },
    ],
    unsupported_evidence: [
      {
        reason_code: "SOURCE_NOT_AVAILABLE",
        advisor_message: "Report readiness is not available.",
      },
    ],
  },
}));
const runAdvisoryCopilotActionMock = vi.fn(
  async (
    _payload: unknown,
    _idempotencyKey: string,
    _resourceScope: unknown,
  ): Promise<AdvisoryCopilotRunData> => ({
  run: {
    run_id: "copilot_run_1",
    evidence_packet_id: "copilot_packet_1",
    evidence_packet_hash: "packet_hash_1",
    output_hash: "output_hash_1",
    lotus_ai_workflow_run_id: "lotus_ai_run_1",
    created_at: "2026-08-04T08:00:00Z",
    review_posture: "REVIEW_REQUIRED",
    client_ready_publication: "BLOCKED",
    output_sections_json: [
      {
        section_key: "SUMMARY",
        title: "Advisor summary",
        text: "Policy review is required before client communication.",
      },
    ],
    review_guidance_json: ["Review source evidence before internal use."],
    guardrail_results_json: [] as string[],
  },
  reviews: [],
  }),
);
const reviewAdvisoryCopilotRunMock = vi.fn(
  async (
    _runId: string,
    _payload: unknown,
    _idempotencyKey: string,
    _resourceScope: unknown,
  ): Promise<AdvisoryCopilotReviewData> => ({
  run: {
    run_id: "copilot_run_1",
    evidence_packet_id: "copilot_packet_1",
    evidence_packet_hash: "packet_hash_1",
    output_hash: "output_hash_1",
    lotus_ai_workflow_run_id: "lotus_ai_run_1",
    created_at: "2026-08-04T08:00:00Z",
    review_posture: "APPROVED_FOR_INTERNAL_USE",
    client_ready_publication: "BLOCKED",
    output_sections_json: [
      {
        section_key: "SUMMARY",
        title: "Advisor summary",
        text: "Policy review is required before client communication.",
      },
    ],
    review_guidance_json: ["Review source evidence before internal use."],
    guardrail_results_json: [] as string[],
  },
  review: {
    review_id: "review_1",
    run_id: "copilot_run_1",
    action: "APPROVE_FOR_INTERNAL_USE",
    actor_id: "advisor_sg_001",
    occurred_at: "2026-08-04T08:05:00Z",
  },
  replayed: false,
  }),
);

vi.mock("../../src/features/proposals/api", () => ({
  createAdvisoryCopilotEvidencePacketFromProposalVersion: (payload: unknown) =>
    createEvidencePacketMock(payload),
  getAdvisoryCopilotSupportability: () =>
    getAdvisoryCopilotSupportabilityMock(),
  listProposals: (filters: unknown) => listProposalsMock(filters),
  reviewAdvisoryCopilotRun: (
    runId: string,
    payload: unknown,
    idempotencyKey: string,
    resourceScope: unknown,
  ) => reviewAdvisoryCopilotRunMock(runId, payload, idempotencyKey, resourceScope),
  runAdvisoryCopilotAction: (
    payload: unknown,
    idempotencyKey: string,
    resourceScope: unknown,
  ) => runAdvisoryCopilotActionMock(payload, idempotencyKey, resourceScope),
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

describe("AdvisoryCopilotWorkspace", () => {
  beforeEach(() => {
    listProposalsMock.mockClear();
    getAdvisoryCopilotSupportabilityMock.mockClear();
    createEvidencePacketMock.mockClear();
    runAdvisoryCopilotActionMock.mockClear();
    reviewAdvisoryCopilotRunMock.mockClear();
  });

  it("runs Gateway-backed copilot actions without building evidence sections locally", async () => {
    renderWithQueryClient(
      <AdvisoryCopilotWorkspace portfolioId="PB_SG_GLOBAL_BAL_001" />,
    );

    expect(
      await screen.findByText(
        "AI-assisted preparation for proposal review, with proposal evidence and mandatory human review before any client use.",
      ),
    ).toBeInTheDocument();
    const decisionRegion = screen.getByTestId("advisory-copilot-decision");
    expect(decisionRegion).toHaveAccessibleName(
      "Prepare an evidence-led proposal review",
    );
    expect(
      screen.getByRole("region", {
        name: "Prepare an evidence-led proposal review",
      }),
    ).toBe(decisionRegion);
    expect(within(decisionRegion).getByText("Adviser decision")).toBeInTheDocument();
    expect(
      within(decisionRegion).getByRole("heading", {
        name: "Prepare an evidence-led proposal review",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("advisory-copilot-status")).toHaveAccessibleName(
      "Advisory Copilot status",
    );
    expect(screen.getAllByText("Not approved for client use").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        "Advise Copilot Gateway Workbench Canonical Proof Supported",
      ),
    ).not.toBeInTheDocument();

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Prepare review" }))[0],
    );

    await waitFor(() => {
      expect(createEvidencePacketMock).toHaveBeenCalledWith({
        proposal_id: "proposal_sg_structured_note_001",
        proposal_version_no: 1,
        action_family: "PROPOSAL_EXPLANATION",
        audience: "ADVISOR",
        created_by: "advisor_sg_001",
        reason: {
          business_reason: "Prepare advisor-use copilot review.",
        },
      });
    });
    expect(runAdvisoryCopilotActionMock).toHaveBeenCalledWith(
      {
        evidence_packet_id: "copilot_packet_1",
        audience: "ADVISOR",
        requested_outputs: ["advisor_review_summary"],
        requested_by: "advisor_sg_001",
        requested_intents: ["explain_policy_posture"],
        user_instruction: "",
        reason: {
          business_reason: "Prepare advisor-use copilot review.",
        },
      },
      "ui-copilot-run-PROPOSAL_EXPLANATION-proposal_sg_structured_note_001-1-copilot_packet_1",
      {
        proposal_id: "proposal_sg_structured_note_001",
        portfolio_id: "PB_SG_GLOBAL_BAL_001",
      },
    );
    expect(JSON.stringify(createEvidencePacketMock.mock.calls)).not.toContain(
      "source_sections",
    );
    expect(screen.getByText("Policy posture")).toBeInTheDocument();
    expect(
      screen.getByText("Policy evaluation requires compliance review."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Not approved for client use").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(screen.getByText("Live output • review required")).toBeInTheDocument();
    expect(screen.getByTestId("advisory-copilot-output")).toHaveAttribute(
      "data-output-section-count",
      "1",
    );
    expect(screen.getByTestId("advisory-copilot-human-review")).toHaveAttribute(
      "data-review-posture",
      "REVIEW_REQUIRED",
    );
    fireEvent.click(screen.getByText("How this was prepared"));
    expect(screen.getByText("Prepared with AI assistance")).toBeInTheDocument();
    expect(screen.getByText("Limited source evidence")).toBeInTheDocument();
    expect(
      screen.getAllByText("Not approved for client use").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("workflow_pack")).not.toBeInTheDocument();
    expect(screen.queryByText("PROPOSAL_EXPLANATION")).not.toBeInTheDocument();
  });

  it("uses the source-declared audience for non-advisor copilot actions", async () => {
    getAdvisoryCopilotSupportabilityMock.mockResolvedValueOnce({
      support_status: "ADVISE_COPILOT_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
      client_ready_publication: "BLOCKED",
      supported_action_families: ["COMPLIANCE_REVIEW_SUMMARY"],
      boundaries: ["CLIENT_READY_PUBLICATION is blocked"],
    });
    renderWithQueryClient(
      <AdvisoryCopilotWorkspace portfolioId="PB_SG_GLOBAL_BAL_001" />,
    );

    await screen.findByText("Compliance review summary");
    fireEvent.click(screen.getByRole("button", { name: "Prepare review" }));

    await waitFor(() => {
      expect(createEvidencePacketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action_family: "COMPLIANCE_REVIEW_SUMMARY",
          audience: "COMPLIANCE_REVIEWER",
        }),
      );
    });
    expect(runAdvisoryCopilotActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "COMPLIANCE_REVIEWER",
        requested_outputs: ["compliance_review_summary"],
        requested_intents: ["summarize_compliance_review"],
      }),
      "ui-copilot-run-COMPLIANCE_REVIEW_SUMMARY-proposal_sg_structured_note_001-1-copilot_packet_1",
      {
        proposal_id: "proposal_sg_structured_note_001",
        portfolio_id: "PB_SG_GLOBAL_BAL_001",
      },
    );
  });

  it("does not expose copilot actions when supportability declares none", async () => {
    getAdvisoryCopilotSupportabilityMock.mockResolvedValueOnce({
      support_status: "ADVISE_COPILOT_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
      client_ready_publication: "BLOCKED",
      supported_action_families: [],
      boundaries: ["CLIENT_READY_PUBLICATION is blocked"],
    });
    renderWithQueryClient(
      <AdvisoryCopilotWorkspace portfolioId="PB_SG_GLOBAL_BAL_001" />,
    );

    expect(
      await screen.findByText("No AI-assisted review tasks available"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Prepare review" }),
    ).not.toBeInTheDocument();
    expect(createEvidencePacketMock).not.toHaveBeenCalled();
  });

  it("does not allow internal approval for non-reviewable copilot runs", async () => {
    runAdvisoryCopilotActionMock.mockResolvedValueOnce({
      run: {
        run_id: "copilot_run_guardrail_rejected",
        review_posture: "GUARDRAIL_REJECTED",
        client_ready_publication: "BLOCKED",
        output_sections_json: [
          {
            section_key: "SUMMARY",
            title: "Advisor summary",
            text: "Client-ready publication is forbidden.",
          },
        ],
        review_guidance_json: [],
        guardrail_results_json: ["CLIENT_READY_PUBLICATION_FORBIDDEN"],
      },
    });
    renderWithQueryClient(
      <AdvisoryCopilotWorkspace portfolioId="PB_SG_GLOBAL_BAL_001" />,
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Prepare review" }))[0],
    );

    await waitFor(() => {
      expect(screen.getAllByText("Review controls not met").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByRole("button", { name: "Record internal review" }),
    ).toBeDisabled();
    expect(reviewAdvisoryCopilotRunMock).not.toHaveBeenCalled();
  });

  it("records internal review without presenting client-ready approval", async () => {
    renderWithQueryClient(
      <AdvisoryCopilotWorkspace portfolioId="PB_SG_GLOBAL_BAL_001" />,
    );

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Prepare review" }))[0],
    );
    await screen.findByText("Advisor summary");
    fireEvent.click(screen.getByRole("button", { name: "Record internal review" }));

    await waitFor(() => {
      expect(reviewAdvisoryCopilotRunMock).toHaveBeenCalledWith(
        "copilot_run_1",
        {
          action: "APPROVE_FOR_INTERNAL_USE",
          reason: {
            decision: "Reviewed against source evidence for internal advisor use.",
          },
        },
        "ui-copilot-review-copilot_run_1",
        {
          proposal_id: "proposal_sg_structured_note_001",
          portfolio_id: "PB_SG_GLOBAL_BAL_001",
        },
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Approved for internal use").length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId("advisory-copilot-human-review")).toHaveAttribute(
      "data-review-posture",
      "APPROVED_FOR_INTERNAL_USE",
    );
    expect(screen.getByText(/Client use:/).parentElement).toHaveTextContent(
      "Not approved for client use",
    );
    expect(screen.queryByText("Client-ready approved")).not.toBeInTheDocument();
  });
});
