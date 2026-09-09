import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, vi } from "vitest";

import type { AdvisorBookResponse } from "@/features/advisor-book/contracts";
import AdvisorBookWorkspace from "@/features/advisor-book/components/advisor-book-workspace";
import IdeaCandidateExplanation from "@/features/proposals/components/idea-candidate-explanation";
import { parseAdvisorIdeaAIExplanationResponse } from "@/features/proposals/idea-ai-explanation-contract";
import { buildRiskMandateComparisonViewModel } from "@/apps/performance/risk-mandate-comparison-view-model";
import RiskMandateComparison from "@/apps/performance/components/risk/risk-mandate-comparison";

import { assertExactSourceRenderProof } from "../../scripts/live/validation/source-render-proof.mjs";
import {
  SOURCE_AUTHORITY_CONTRACTS,
  type SourceAuthorityContract,
} from "../../scripts/quality/source-authority-contracts.mjs";
import { SOURCE_AUTHORITY_RENDER_PROOF_IDS } from "../../scripts/quality/source-authority-render-proof-registry.mjs";
import {
  buildConcentrationMandateComparisonFixture,
  buildSummaryMandateComparisonFixture,
} from "../fixtures/risk-mandate-comparison-fixtures";

const getAdvisorBookMock = vi.fn();
const requestIdeaExplanationMock = vi.fn();

vi.mock("@/features/advisor-book/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/advisor-book/api")>(
    "@/features/advisor-book/api",
  );
  return {
    ...actual,
    getAdvisorBook: (...args: unknown[]) => getAdvisorBookMock(...args),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/book",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("asOfDate=2026-02-24"),
}));

vi.mock("@/features/proposals/api", () => ({
  requestAdvisorIdeaAIExplanation: (...args: unknown[]) =>
    requestIdeaExplanationMock(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

function sourceContract(id: string) {
  const contract = SOURCE_AUTHORITY_CONTRACTS.find((candidate) => candidate.id === id);
  if (!contract) {
    throw new Error(`Source-authority contract ${id} is not enrolled.`);
  }
  return contract;
}

const ADVISOR_BOOK_RENDER_CASES = [
  {
    identity: "PB_SG_SOURCE_AUTH_CLOSED",
    state: "CLOSED",
  },
  {
    identity: "PB_SG_SOURCE_AUTH_ACTIVE",
    state: "ACTIVE",
  },
] as const;

const RISK_RENDER_CASES = [
  {
    identity: "issuer_max_weight",
    state: "breach",
  },
  {
    identity: "issuer_group_max_weight",
    state: "measure_unavailable",
  },
] as const;

const IDEA_EXPLANATION_RENDER_CASES = [
  {
    identity: "idea-source-authority-unavailable",
    state: "EXPLANATION_UNAVAILABLE",
  },
  {
    identity: "idea-source-authority-served",
    state: "EXPLANATION_SERVED",
  },
] as const;

type RenderProofCase = Readonly<{
  identity: string;
  state: string;
  sourceRevisionVectorDigest?: string;
}>;

type ExecutableRenderProof = Readonly<{
  contractId: string;
  cases: readonly RenderProofCase[];
  renderCase(testCase: RenderProofCase): Promise<unknown>;
}>;

function advisorBookResponse(
  portfolioId: string,
  status: "ACTIVE" | "CLOSED",
): AdvisorBookResponse {
  return {
    correlation_id: "source-authority-proof",
    contract_version: "v1",
    scope: {
      kind: "own_book",
      label: "My book",
      as_of_date: "2026-02-24",
      booking_center_code: "Singapore",
    },
    page: {
      total_count: 1,
      offset: 0,
      limit: 25,
      returned_count: 1,
      sort_by: "portfolio_id",
      sort_order: "asc",
    },
    items: [
      {
        portfolio_id: portfolioId,
        display_name: "Global Balanced Mandate",
        client_id: "CLIENT_001",
        base_currency: "SGD",
        booking_center_code: "Singapore",
        mandate_type: "DISCRETIONARY",
        status,
        opened_on: "2024-01-01",
        closed_on: status === "CLOSED" ? "2026-02-24" : null,
        membership_source: "PortfolioManagerBookMembership:v1",
        membership_reference: `portfolio:${portfolioId}`,
        membership_basis: "governed_role_assignment",
      },
    ],
    supportability: {
      state: "ready",
      reason_code: "advisor_book_ready",
      tenant_scope: "source_confirmed",
      limitations: [],
    },
    provenance: null,
  };
}

function extractDeclaredRenderedRows(contract: SourceAuthorityContract) {
  const evidence = contract.renderedEvidence;
  return [...document.querySelectorAll(evidence.rowSelector)].map((row) => ({
    source: row.getAttribute(evidence.sourceAttribute) ?? "",
    identity: row.getAttribute(evidence.identityAttribute) ?? "",
    state: row.getAttribute(evidence.stateAttribute) ?? "",
  }));
}

async function renderAdvisorBookCase({ identity, state }: RenderProofCase) {
  if (state !== "ACTIVE" && state !== "CLOSED") {
    throw new Error(`Unsupported Advisor Book proof state ${state}.`);
  }
  const response = advisorBookResponse(identity, state);
  getAdvisorBookMock.mockResolvedValue(response);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AdvisorBookWorkspace),
    ),
  );
  await screen.findByRole("table", { name: "Portfolios in my book" });
  return response;
}

function riskPayload(
  identity: string,
  state: "breach" | "measure_unavailable",
) {
  const summary = buildSummaryMandateComparisonFixture();
  const concentration = buildConcentrationMandateComparisonFixture();
  const target = concentration.constraints.find(
    (constraint) => constraint.key === "issuer_max_weight",
  );
  if (!target) {
    throw new Error("Risk source-authority fixture has no issuer constraint.");
  }
  target.key = identity;
  target.state = state;
  return { summary, concentration };
}

function renderRiskMandateComparison(payload: ReturnType<typeof riskPayload>) {
  render(
    createElement(RiskMandateComparison, {
      comparison: buildRiskMandateComparisonViewModel({
        portfolioRisk: payload.summary,
        concentrationRisk: payload.concentration,
      }),
    }),
  );
}

async function renderRiskCase({ identity, state }: RenderProofCase) {
  if (state !== "breach" && state !== "measure_unavailable") {
    throw new Error(`Unsupported Risk proof state ${state}.`);
  }
  const payload = riskPayload(identity, state);
  renderRiskMandateComparison(payload);
  return payload;
}

async function renderIdeaExplanationCase({
  identity,
  state,
  sourceRevisionVectorDigest = "sha256:revision-source-authority-proof",
}: RenderProofCase) {
  if (
    state !== "EXPLANATION_SERVED" &&
    state !== "EXPLANATION_UNAVAILABLE"
  ) {
    throw new Error(`Unsupported Idea explanation proof state ${state}.`);
  }
  const contract = sourceContract("idea-candidate-explanation");
  const payload = structuredClone(contract.sampleGatewayResponse) as Record<
    string,
    unknown
  >;
  const explanation = payload.explanation as Record<string, unknown>;
  payload.status = state;
  payload.disposition =
    state === "EXPLANATION_SERVED" ? "executed" : "runtime_unavailable";
  payload.evaluationVerdict =
    state === "EXPLANATION_SERVED" ? "accepted" : "not_evaluated";
  payload.lotusAiRuntimeExecutionConfirmed = state === "EXPLANATION_SERVED";
  payload.lotusAiRunId = state === "EXPLANATION_SERVED" ? "run-source-authority-proof" : null;
  explanation.candidateId = identity;
  explanation.requestId =
    `idea-explanation-${identity}-00000000-0000-4000-8000-000000000000`;
  explanation.fallbackUsed = state === "EXPLANATION_UNAVAILABLE";
  explanation.posture =
    state === "EXPLANATION_SERVED" ? "ready_for_advisor_review" : "fallback_only";
  explanation.verifierOutcome =
    state === "EXPLANATION_SERVED" ? "passed" : "not_run";
  explanation.executionProvenancePosture =
    state === "EXPLANATION_SERVED"
      ? "unattested_local_test_fixture"
      : "runtime_unavailable";
  explanation.aiLineageRecorded = state === "EXPLANATION_SERVED";
  const evidenceIdentity = {
    evidencePacketId: "evidence-source-authority-proof",
    evidenceContentHash: "sha256:evidence-source-authority-proof",
    sourceRevisionVectorDigest,
  };
  explanation.redactedEvidence = {
    ...(explanation.redactedEvidence as Record<string, unknown>),
    ...evidenceIdentity,
  };
  const parsedPayload = parseAdvisorIdeaAIExplanationResponse(payload, {
    candidateId: identity,
    evidenceIdentity,
    requestId: String(explanation.requestId),
  });
  requestIdeaExplanationMock.mockResolvedValue(parsedPayload);
  vi.stubGlobal("crypto", {
    getRandomValues: vi.fn((bytes: Uint8Array) => {
      bytes.fill(0);
      return bytes;
    }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IdeaCandidateExplanation, {
        candidateId: identity,
        evidenceIdentity,
        portfolioId: "PB_SG_GLOBAL_BAL_001",
      }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Explain this idea" }));
  await screen.findByTestId("idea-explanation-result");
  return parsedPayload;
}

const EXECUTABLE_RENDER_PROOFS = [
  {
    contractId: "advisor-book-portfolios",
    cases: ADVISOR_BOOK_RENDER_CASES,
    renderCase: renderAdvisorBookCase,
  },
  {
    contractId: "idea-candidate-explanation",
    cases: IDEA_EXPLANATION_RENDER_CASES,
    renderCase: renderIdeaExplanationCase,
  },
  {
    contractId: "risk-mandate-comparison",
    cases: RISK_RENDER_CASES,
    renderCase: renderRiskCase,
  },
] as const satisfies readonly ExecutableRenderProof[];

describe("source-authority production mapping", () => {
  beforeEach(() => {
    getAdvisorBookMock.mockReset();
    requestIdeaExplanationMock.mockReset();
  });

  it("registers identity-and-state render cases for every enrolled contract", () => {
    const contractIds = SOURCE_AUTHORITY_CONTRACTS.map((contract) => contract.id).sort();
    const proofIds = [...SOURCE_AUTHORITY_RENDER_PROOF_IDS].sort();
    const executableIds = EXECUTABLE_RENDER_PROOFS.map((proof) => proof.contractId).sort();

    expect(proofIds).toEqual(contractIds);
    expect(executableIds).toEqual(contractIds);
    for (const proof of EXECUTABLE_RENDER_PROOFS) {
      expect(new Set(proof.cases.map((entry) => entry.identity)).size).toBeGreaterThan(1);
      expect(new Set(proof.cases.map((entry) => entry.state)).size).toBeGreaterThan(1);
    }
  });

  for (const proof of EXECUTABLE_RENDER_PROOFS) {
    const testCases: RenderProofCase[] = [...proof.cases];
    it.each(testCases)(
      `preserves ${proof.contractId} source identity $identity and state $state through its rendered component`,
      async (testCase: RenderProofCase) => {
        const contract = sourceContract(proof.contractId);
        const sourcePayload = await proof.renderCase(testCase);
        const expectedRows = contract.buildExpectedRows(sourcePayload);
        expect(
          assertExactSourceRenderProof({
            screen: contract.screen,
            expectedRows,
            renderedRows: extractDeclaredRenderedRows(contract),
          }),
        ).toHaveLength(expectedRows.length);
      },
    );
  }

  it("rejects stale Idea rendering when only the source revision changes", async () => {
    const contract = sourceContract("idea-candidate-explanation");
    const sourcePayload = (await renderIdeaExplanationCase({
      identity: "idea-source-authority-same-candidate",
      state: "EXPLANATION_SERVED",
      sourceRevisionVectorDigest: "sha256:revision-original",
    })) as Record<string, unknown>;
    const changedPayload = structuredClone(sourcePayload) as {
      explanation: {
        redactedEvidence: { sourceRevisionVectorDigest: string };
      };
    };
    changedPayload.explanation.redactedEvidence.sourceRevisionVectorDigest =
      "sha256:revision-changed";

    expect(() =>
      assertExactSourceRenderProof({
        screen: contract.screen,
        expectedRows: contract.buildExpectedRows(changedPayload),
        renderedRows: extractDeclaredRenderedRows(contract),
      }),
    ).toThrow(/revision-changed.*no rendered evidence was found/);
  });
});
