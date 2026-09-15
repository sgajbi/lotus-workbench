import {
  AdvisoryPolicyEnvelopeResponse,
  AdvisoryPolicyEvaluationData,
  AdvisoryPolicyReviewQueueData,
  AdvisoryPolicySignOffDecisionData,
  AdvisoryPolicySignOffDecisionRequest,
  AdvisoryPolicySignOffPackageData,
  AdvisoryPolicyWorkflowData,
  AdvisoryCopilotActionRequest,
  AdvisoryCopilotEnvelopeResponse,
  AdvisoryCopilotEvidencePacketData,
  AdvisoryCopilotEvidencePacketRequest,
  AdvisoryCopilotReviewData,
  AdvisoryCopilotReviewRequest,
  AdvisoryCopilotRunData,
  AdvisoryCopilotSupportabilityData,
  AdvisorCockpitAcknowledgeData,
  AdvisorCockpitAcknowledgeRequest,
  AdvisorCockpitActionPageData,
  AdvisorCockpitEnvelopeResponse,
  AdvisorCockpitPreparationPacketPageData,
  AdvisorCockpitSnapshotData,
  AdvisorCockpitSupportabilityData,
  AdvisorIdeaCandidateActionData,
  AdvisorIdeaCandidateDetailData,
  AdvisorIdeaConversionIntentRequest,
  AdvisorIdeaFeedbackRequest,
  AdvisorIdeaReviewActionRequest,
  AdvisorIdeaReviewQueueData,
  ProposalApprovalActionRequest,
  ProposalApprovalsData,
  AdvisoryWorkspaceBodyRequest,
  AdvisoryWorkspaceCreateRequest,
  AdvisoryWorkspaceDraftActionRequest,
  AdvisoryWorkspaceEnvelopeResponse,
  AdvisoryWorkspaceHandoffRequest,
  AdvisoryWorkspaceSaveRequest,
  BankDemoProofEnvelopeResponse,
  BankDemoScenarioContractData,
  BankDemoSupportedClaimRegisterData,
  ProposalBodyRequest,
  ProposalCreateRequest,
  ProposalDeliveryEventsData,
  ProposalDeliverySummaryData,
  ProposalDetailData,
  ProposalEnvelopeResponse,
  ProposalListData,
  ProposalLineageData,
  ProposalMemoAdvisorCommentaryData,
  ProposalMemoAdvisorCommentaryRequest,
  ProposalMemoAiCommentaryData,
  ProposalMemoAiCommentaryRequest,
  ProposalMemoCreateRequest,
  ProposalMemoData,
  ProposalMemoLineageData,
  ProposalMemoProjectionData,
  ProposalMemoReplayEvidenceData,
  ProposalMemoReportPackageData,
  ProposalMemoReportPackageRequest,
  ProposalMemoReviewData,
  ProposalMemoReviewRequest,
  ProposalNarrativeReviewData,
  ProposalNarrativeReviewRequest,
  ProposalReportRequest,
  ProposalReportRequestData,
  ProposalSubmitRequest,
  ProposalStateTransitionEnvelopeResponse,
  ProposalVersionData,
  ProposalWorkflowEventsData,
} from "./types";
import { matchesAdvisorIdeaFeedbackEvidence } from "./idea-feedback";
import {
  matchesIdeaPresentationReceiptEvidence,
  type IdeaPresentationReceiptDraft,
  type IdeaPresentationReceiptResponse,
} from "./idea-presentation-receipt";
import { utcTimestampsIdentifySameInstant } from "./utc-evidence";
import {
  parseAdvisorIdeaAIExplanationResponse,
  type AdvisorIdeaEvidenceIdentity,
  type AdvisorIdeaAIExplanationRequest,
  type AdvisorIdeaAIExplanationResponse,
} from "./idea-ai-explanation-contract";
import { parseProposalListEnvelope } from "./proposal-list-contract";
import {
  parseProposalRiskImpactEnvelope,
  type ProposalRiskImpactEnvelope,
} from "./proposal-risk-impact-contract";
import {
  parseProposalImplementationStatusEnvelope,
  type ProposalImplementationStatusEnvelope,
} from "./proposal-implementation-status-contract";
import {
  parseProposalDiscussionPackEnvelope,
  type ProposalDiscussionPackEnvelope,
} from "./proposal-discussion-pack-contract";
import {
  fetchWorkbenchJson,
  fetchWorkbenchMutation,
  observeWorkbenchMutation,
} from "@/features/workbench/api-client";
import { WorkbenchResponseEvidenceError } from "@/features/analytics-observability/response-evidence-error";

const BFF_PROXY_BASE = "/api/bff/api/v1";

export type ProposalListFilters = {
  portfolioId?: string;
  state?: string;
  createdBy?: string;
  createdFrom?: string;
  createdTo?: string;
  limit?: number;
  cursor?: string;
};

export type AdvisorCockpitFilters = {
  portfolioId?: string;
  limit?: number;
  cursor?: string;
};

export type AdvisorIdeaQueueFilters = {
  portfolioId: string;
  evaluatedAtUtc?: string;
};

export type AdvisorIdeaCandidateDetailFilters = {
  candidateId: string;
  portfolioId: string;
};

type AdvisorIdeaCandidateActionInput<TRequest> = {
  candidateId: string;
  portfolioId: string;
  idempotencyKey: string;
  request: TRequest;
};

export type AdvisorIdeaPresentationReceiptInput = {
  candidateId: string;
  portfolioId: string;
  idempotencyKey: string;
  request: IdeaPresentationReceiptDraft;
};

export type AdvisorIdeaAIExplanationInput = {
  candidateId: string;
  evidenceIdentity: AdvisorIdeaEvidenceIdentity;
  portfolioId: string;
  idempotencyKey: string;
  request: AdvisorIdeaAIExplanationRequest;
};

export async function getBankDemoScenarioContract(): Promise<BankDemoScenarioContractData> {
  const envelope = await fetchWorkbenchJson<BankDemoProofEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory/bank-demo-proof/scenario-contract`,
    "bank demo scenario contract",
  );
  return envelope.data as unknown as BankDemoScenarioContractData;
}

export async function getBankDemoSupportedClaimRegister(): Promise<BankDemoSupportedClaimRegisterData> {
  const envelope = await fetchWorkbenchJson<BankDemoProofEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory/bank-demo-proof/supported-claim-register`,
    "bank demo supported-claim register",
  );
  return envelope.data as unknown as BankDemoSupportedClaimRegisterData;
}

export async function createProposalArtifact(
  payload: ProposalBodyRequest,
  idempotencyKey: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson("/proposals/artifact", payload, idempotencyKey);
}

export async function createAdvisoryWorkspace(
  payload: AdvisoryWorkspaceCreateRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson("", payload);
}

export async function getAdvisoryWorkspace(
  workspaceId: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await fetchWorkbenchJson<AdvisoryWorkspaceEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-workspaces/${workspaceId}`,
    "advisory workspace",
  );
}

export async function applyAdvisoryWorkspaceDraftAction(
  workspaceId: string,
  payload: AdvisoryWorkspaceDraftActionRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(
    `/${workspaceId}/draft-actions`,
    payload,
  );
}

export async function evaluateAdvisoryWorkspace(
  workspaceId: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(`/${workspaceId}/evaluate`, {
    body: {},
  });
}

export async function saveAdvisoryWorkspace(
  workspaceId: string,
  payload: AdvisoryWorkspaceSaveRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(`/${workspaceId}/save`, payload);
}

export async function listAdvisoryWorkspaceSavedVersions(
  workspaceId: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await getAdvisoryWorkspaceJson(`/${workspaceId}/saved-versions`);
}

export async function getAdvisoryWorkspaceSavedVersionReplayEvidence(
  workspaceId: string,
  workspaceVersionId: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await getAdvisoryWorkspaceJson(
    `/${workspaceId}/saved-versions/${workspaceVersionId}/replay-evidence`,
  );
}

export async function resumeAdvisoryWorkspace(
  workspaceId: string,
  payload: AdvisoryWorkspaceBodyRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(`/${workspaceId}/resume`, payload);
}

export async function compareAdvisoryWorkspace(
  workspaceId: string,
  payload: AdvisoryWorkspaceBodyRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(`/${workspaceId}/compare`, payload);
}

export async function requestAdvisoryWorkspaceRationale(
  workspaceId: string,
  payload: AdvisoryWorkspaceBodyRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(
    `/${workspaceId}/assistant/rationale`,
    payload,
  );
}

export async function reviewAdvisoryWorkspaceRationale(
  workspaceId: string,
  payload: AdvisoryWorkspaceBodyRequest,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(
    `/${workspaceId}/assistant/rationale/review-actions`,
    payload,
  );
}

export async function handoffAdvisoryWorkspace(
  workspaceId: string,
  payload: AdvisoryWorkspaceHandoffRequest,
  idempotencyKey: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await postAdvisoryWorkspaceJson(
    `/${workspaceId}/handoff`,
    payload,
    idempotencyKey,
  );
}

export async function createProposal(
  payload: ProposalCreateRequest,
  idempotencyKey: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson("/proposals", payload, idempotencyKey);
}

export async function createProposalAsync(
  payload: ProposalBodyRequest,
  idempotencyKey: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson("/proposals/async", payload, idempotencyKey);
}

export async function listProposals(
  filters: ProposalListFilters = {},
): Promise<ProposalListData> {
  const params = new URLSearchParams();
  if (filters.portfolioId) {
    params.set("portfolio_id", filters.portfolioId);
  }
  if (filters.state) {
    params.set("state", filters.state);
  }
  if (filters.createdBy) {
    params.set("created_by", filters.createdBy);
  }
  if (filters.createdFrom) {
    params.set("created_from", filters.createdFrom);
  }
  if (filters.createdTo) {
    params.set("created_to", filters.createdTo);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  if (filters.cursor) {
    params.set("cursor", filters.cursor);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const proposalList = parseProposalListEnvelope(
    await fetchWorkbenchJson<unknown>(
      `${BFF_PROXY_BASE}/proposals${query}`,
      "proposal list",
    ),
  );
  if (filters.cursor && proposalList.next_cursor === filters.cursor) {
    throw new Error("Proposal list response was incomplete.");
  }
  return proposalList;
}

export async function getAdvisoryPolicyReviewQueue({
  evaluationStatus = "PENDING_REVIEW",
  portfolioId,
}: {
  evaluationStatus?: string;
  portfolioId?: string;
} = {}): Promise<AdvisoryPolicyReviewQueueData> {
  const params = new URLSearchParams();
  if (evaluationStatus) {
    params.set("evaluation_status", evaluationStatus);
  }
  if (portfolioId) {
    params.set("portfolio_id", portfolioId);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const envelope = await fetchWorkbenchJson<AdvisoryPolicyEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-policy-evaluations/review-queue${query}`,
    "advisory policy review queue",
  );
  return envelope.data as unknown as AdvisoryPolicyReviewQueueData;
}

export async function getAdvisorIdeaReviewQueue({
  portfolioId,
  evaluatedAtUtc,
}: AdvisorIdeaQueueFilters): Promise<AdvisorIdeaReviewQueueData> {
  requireSelectedIdeaPortfolio(portfolioId);
  const params = new URLSearchParams();
  if (evaluatedAtUtc) {
    params.set("evaluatedAtUtc", evaluatedAtUtc);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await fetchWorkbenchJson<unknown>(
    `${BFF_PROXY_BASE}/ideas/review-queues/advisor${query}`,
    "advisor idea queue",
  );
  const data = unwrapGatewayData<AdvisorIdeaReviewQueueData>(payload);
  if (
    evaluatedAtUtc &&
    !utcTimestampsIdentifySameInstant(data.evaluatedAtUtc, evaluatedAtUtc)
  ) {
    throw new WorkbenchResponseEvidenceError(
      "The opportunity worklist did not confirm the requested evaluation time. No current worklist is shown.",
    );
  }
  return data;
}

export async function getAdvisorIdeaCandidateDetail({
  candidateId,
  portfolioId,
}: AdvisorIdeaCandidateDetailFilters): Promise<AdvisorIdeaCandidateDetailData> {
  requireSelectedIdeaPortfolio(portfolioId);
  const payload = await fetchWorkbenchJson<unknown>(
    `${BFF_PROXY_BASE}/ideas/candidates/${encodeURIComponent(candidateId)}`,
    "advisor idea candidate detail",
  );
  return unwrapGatewayData<AdvisorIdeaCandidateDetailData>(payload);
}

export async function requestAdvisorIdeaAIExplanation(
  input: AdvisorIdeaAIExplanationInput,
): Promise<AdvisorIdeaAIExplanationResponse> {
  requireSelectedIdeaPortfolio(input.portfolioId);
  return await observeWorkbenchMutation(
    "idea.candidate.ai-explanation",
    async () => {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("Idempotency-Key", input.idempotencyKey);
      const payload = await fetchWorkbenchMutation<unknown>(
        `${BFF_PROXY_BASE}/ideas/candidates/${encodeURIComponent(input.candidateId)}/ai-explanations`,
        "advisor idea explanation",
        {
          method: "POST",
          headers,
          body: JSON.stringify(input.request),
        },
      );
      return parseAdvisorIdeaAIExplanationResponse(
        unwrapGatewayData<unknown>(payload),
        {
          candidateId: input.candidateId,
          evidenceIdentity: input.evidenceIdentity,
          requestId: input.request.requestId,
        },
      );
    },
  );
}

export async function recordAdvisorIdeaReviewAction(
  input: AdvisorIdeaCandidateActionInput<AdvisorIdeaReviewActionRequest>,
): Promise<AdvisorIdeaCandidateActionData> {
  return await observeWorkbenchMutation(
    "idea.candidate.review-action",
    async () =>
      await postAdvisorIdeaCandidateAction({
        ...input,
        pathSuffix: "review-actions",
        capability: "idea.review.record",
        errorLabel: "Advisor idea review action",
      }),
  );
}

export async function recordAdvisorIdeaFeedback(
  input: AdvisorIdeaCandidateActionInput<AdvisorIdeaFeedbackRequest>,
): Promise<AdvisorIdeaCandidateActionData> {
  return await observeWorkbenchMutation(
    "idea.candidate.feedback",
    async () => {
      const data = await postAdvisorIdeaCandidateAction({
        ...input,
        pathSuffix: "feedback",
        capability: "idea.feedback.record",
        errorLabel: "Advisor idea feedback",
      });
      if (
        !matchesAdvisorIdeaFeedbackEvidence({
          candidateId: input.candidateId,
          event: data.feedbackEvent,
          request: input.request,
        })
      ) {
        throw new WorkbenchResponseEvidenceError(
          "Advisor idea feedback did not return matching source-owned event evidence. No success was recorded in Workbench.",
        );
      }
      return data;
    },
  );
}

export async function recordAdvisorIdeaPresentationReceipt(
  input: AdvisorIdeaPresentationReceiptInput,
): Promise<IdeaPresentationReceiptResponse> {
  requireSelectedIdeaPortfolio(input.portfolioId);
  return await observeWorkbenchMutation(
    "idea.candidate.presentation-receipt",
    async () => {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("Idempotency-Key", input.idempotencyKey);
      const payload = await fetchWorkbenchMutation<unknown>(
        `${BFF_PROXY_BASE}/ideas/candidates/${encodeURIComponent(input.candidateId)}/presentation-receipts`,
        "advisor idea presentation receipt",
        {
          method: "POST",
          headers,
          body: JSON.stringify(input.request),
        },
      );
      const data = unwrapGatewayData<IdeaPresentationReceiptResponse>(payload);
      if (
        !matchesIdeaPresentationReceiptEvidence({
          candidateId: input.candidateId,
          request: input.request,
          response: data,
        })
      ) {
        throw new WorkbenchResponseEvidenceError(
          "Idea visibility evidence did not match the recorded observation. Review remains available.",
        );
      }
      return data;
    },
  );
}

export async function recordAdvisorIdeaConversionIntent(
  input: AdvisorIdeaCandidateActionInput<AdvisorIdeaConversionIntentRequest>,
): Promise<AdvisorIdeaCandidateActionData> {
  return await observeWorkbenchMutation(
    "idea.candidate.conversion-intent",
    async () =>
      await postAdvisorIdeaCandidateAction({
        ...input,
        pathSuffix: "conversion-intents",
        capability: "idea.conversion.intent.record",
        errorLabel: "Advisor idea conversion intent",
      }),
  );
}

export async function getAdvisoryPolicyEvaluation(
  evaluationId: string,
): Promise<AdvisoryPolicyEvaluationData> {
  const envelope = await fetchWorkbenchJson<AdvisoryPolicyEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-policy-evaluations/${encodeURIComponent(evaluationId)}`,
    "advisory policy evaluation",
  );
  return envelope.data as unknown as AdvisoryPolicyEvaluationData;
}

export async function getAdvisoryPolicySignOffPackage(
  evaluationId: string,
): Promise<AdvisoryPolicySignOffPackageData> {
  const envelope = await fetchWorkbenchJson<AdvisoryPolicyEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-policy-evaluations/${encodeURIComponent(
      evaluationId,
    )}/sign-off-package`,
    "advisory policy sign-off package",
  );
  return envelope.data as unknown as AdvisoryPolicySignOffPackageData;
}

export async function getAdvisoryPolicyWorkflow(
  evaluationId: string,
): Promise<AdvisoryPolicyWorkflowData> {
  const envelope = await fetchWorkbenchJson<AdvisoryPolicyEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-policy-evaluations/${encodeURIComponent(evaluationId)}/workflow`,
    "advisory policy workflow",
  );
  return envelope.data as unknown as AdvisoryPolicyWorkflowData;
}

export async function recordAdvisoryPolicySignOffDecision(
  evaluationId: string,
  payload: AdvisoryPolicySignOffDecisionRequest,
  idempotencyKey?: string,
): Promise<AdvisoryPolicySignOffDecisionData> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const envelope = await fetchWorkbenchMutation<AdvisoryPolicyEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-policy-evaluations/${encodeURIComponent(
      evaluationId,
    )}/sign-off-decisions`,
    "advisory policy sign-off decision",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );
  return envelope.data as unknown as AdvisoryPolicySignOffDecisionData;
}

export async function listAdvisorCockpitActions(
  filters: AdvisorCockpitFilters = {},
): Promise<AdvisorCockpitActionPageData> {
  return (await getAdvisorCockpitData(
    `/actions${buildAdvisorCockpitQuery(filters)}`,
  )) as AdvisorCockpitActionPageData;
}

export async function listAdvisorCockpitPreparationPackets(
  filters: AdvisorCockpitFilters = {},
): Promise<AdvisorCockpitPreparationPacketPageData> {
  return (await getAdvisorCockpitData(
    `/preparation-packets${buildAdvisorCockpitQuery(filters)}`,
  )) as AdvisorCockpitPreparationPacketPageData;
}

export async function getAdvisorCockpitSnapshot(
  filters: AdvisorCockpitFilters = {},
): Promise<AdvisorCockpitSnapshotData> {
  return (await getAdvisorCockpitData(
    `/snapshot${buildAdvisorCockpitQuery(filters)}`,
  )) as AdvisorCockpitSnapshotData;
}

export async function getAdvisorCockpitSupportability(
  filters: AdvisorCockpitFilters = {},
): Promise<AdvisorCockpitSupportabilityData> {
  return (await getAdvisorCockpitData(
    `/supportability${buildAdvisorCockpitQuery(filters)}`,
  )) as AdvisorCockpitSupportabilityData;
}

export async function createAdvisoryCopilotEvidencePacketFromProposalVersion(
  payload: AdvisoryCopilotEvidencePacketRequest,
): Promise<AdvisoryCopilotEvidencePacketData> {
  const envelope = await postAdvisoryCopilotJson(
    "/evidence-packets/from-proposal-version",
    payload,
  );
  return envelope.data as unknown as AdvisoryCopilotEvidencePacketData;
}

export async function runAdvisoryCopilotAction(
  payload: AdvisoryCopilotActionRequest,
  idempotencyKey: string,
): Promise<AdvisoryCopilotRunData> {
  const envelope = await postAdvisoryCopilotJson(
    "/actions",
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as AdvisoryCopilotRunData;
}

export async function reviewAdvisoryCopilotRun(
  runId: string,
  payload: AdvisoryCopilotReviewRequest,
  idempotencyKey: string,
): Promise<AdvisoryCopilotReviewData> {
  const envelope = await postAdvisoryCopilotJson(
    `/actions/${encodeURIComponent(runId)}/reviews`,
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as AdvisoryCopilotReviewData;
}

export async function getAdvisoryCopilotSupportability(): Promise<AdvisoryCopilotSupportabilityData> {
  const envelope = await fetchWorkbenchJson<AdvisoryCopilotEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-copilot/supportability`,
    "advisory copilot supportability",
  );
  return envelope.data as unknown as AdvisoryCopilotSupportabilityData;
}

export async function acknowledgeAdvisorCockpitAction(
  actionItemId: string,
  payload: AdvisorCockpitAcknowledgeRequest,
  {
    filters = {},
    idempotencyKey,
  }: {
    filters?: Omit<AdvisorCockpitFilters, "limit" | "cursor">;
    idempotencyKey: string;
  },
): Promise<AdvisorCockpitAcknowledgeData> {
  const envelope = await fetchWorkbenchMutation<AdvisorCockpitEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisor-cockpit/actions/${encodeURIComponent(
      actionItemId,
    )}/acknowledgements${buildAdvisorCockpitQuery(filters)}`,
    "advisor cockpit acknowledgement",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    },
  );
  return envelope.data as unknown as AdvisorCockpitAcknowledgeData;
}

export async function getProposal(
  proposalId: string,
  includeEvidence = false,
): Promise<ProposalDetailData> {
  const query = `?include_evidence=${includeEvidence ? "true" : "false"}`;
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}${query}`,
    "proposal detail",
  );
  return envelope.data as unknown as ProposalDetailData;
}

export async function getProposalRiskImpact(
  proposalId: string,
  portfolioId: string,
  versionNo: number,
  currentState: string,
): Promise<ProposalRiskImpactEnvelope> {
  const envelope = await fetchWorkbenchJson<unknown>(
    `${BFF_PROXY_BASE}/proposals/${encodeURIComponent(proposalId)}/risk-impact`,
    "proposal risk and impact",
  );
  return parseProposalRiskImpactEnvelope(
    envelope,
    proposalId,
    portfolioId,
    versionNo,
    currentState,
  );
}

export async function getProposalDiscussionPack(
  proposalId: string,
  portfolioId: string,
  versionNo: number,
  currentState: string,
): Promise<ProposalDiscussionPackEnvelope> {
  const query = new URLSearchParams({
    portfolio_id: portfolioId,
    version_no: String(versionNo),
  });
  const envelope = await fetchWorkbenchJson<unknown>(
    `${BFF_PROXY_BASE}/proposals/${encodeURIComponent(proposalId)}/discussion-pack-review?${query}`,
    "proposal discussion pack review",
  );
  return parseProposalDiscussionPackEnvelope(
    envelope,
    proposalId,
    portfolioId,
    versionNo,
    currentState,
  );
}

export async function getProposalVersion(
  proposalId: string,
  versionNo: number,
  includeEvidence = false,
): Promise<ProposalVersionData> {
  const query = `?include_evidence=${includeEvidence ? "true" : "false"}`;
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/versions/${versionNo}${query}`,
    "proposal version",
  );
  return envelope.data as unknown as ProposalVersionData;
}

export async function createProposalVersion(
  proposalId: string,
  payload: ProposalCreateRequest,
  idempotencyKey: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson(
    `/proposals/${proposalId}/versions`,
    payload,
    idempotencyKey,
  );
}

export async function createProposalVersionAsync(
  proposalId: string,
  payload: ProposalBodyRequest,
  idempotencyKey: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson(
    `/proposals/${proposalId}/versions/async`,
    payload,
    idempotencyKey,
  );
}

export async function getProposalOperation(
  operationId: string,
): Promise<ProposalEnvelopeResponse> {
  return await getProposalEnvelope(`/proposals/operations/${operationId}`);
}

export async function getProposalOperationByCorrelation(
  operationCorrelationId: string,
): Promise<ProposalEnvelopeResponse> {
  return await getProposalEnvelope(
    `/proposals/operations/by-correlation/${operationCorrelationId}`,
  );
}

export async function getProposalOperationReplayEvidence(
  operationId: string,
): Promise<ProposalEnvelopeResponse> {
  return await getProposalEnvelope(
    `/proposals/operations/${operationId}/replay-evidence`,
  );
}

export async function getProposalVersionReplayEvidence(
  proposalId: string,
  versionNo: number,
): Promise<ProposalEnvelopeResponse> {
  return await getProposalEnvelope(
    `/proposals/${proposalId}/versions/${versionNo}/replay-evidence`,
  );
}

export async function getProposalIdempotencyRecord(
  idempotencyKey: string,
): Promise<ProposalEnvelopeResponse> {
  return await getProposalEnvelope(`/proposals/idempotency/${idempotencyKey}`);
}

export async function getProposalLineage(
  proposalId: string,
): Promise<ProposalLineageData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/lineage`,
    "proposal lineage",
  );
  return envelope.data as unknown as ProposalLineageData;
}

export async function regenerateProposalNarrative(
  proposalId: string,
  versionNo: number,
  payload: ProposalBodyRequest,
): Promise<ProposalEnvelopeResponse> {
  return await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/narrative/regenerate`,
    payload,
  );
}

export async function getProposalNarrative(
  proposalId: string,
  versionNo: number,
): Promise<ProposalEnvelopeResponse> {
  return await getProposalEnvelope(
    `/proposals/${proposalId}/versions/${versionNo}/narrative`,
  );
}

export async function getProposalNarrativeReviewEvidence(
  proposalId: string,
  versionNo: number,
): Promise<ProposalNarrativeReviewData> {
  const envelope = await getProposalNarrative(proposalId, versionNo);
  return envelope.data as unknown as ProposalNarrativeReviewData;
}

export async function reviewProposalNarrative(
  proposalId: string,
  versionNo: number,
  payload: ProposalNarrativeReviewRequest,
  idempotencyKey?: string,
): Promise<ProposalNarrativeReviewData> {
  const envelope = await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/narrative/review`,
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as ProposalNarrativeReviewData;
}

export async function createProposalReportRequest(
  proposalId: string,
  payload: ProposalReportRequest,
): Promise<ProposalReportRequestData> {
  const envelope = await postJson(
    `/proposals/${proposalId}/report-requests`,
    payload,
  );
  return envelope.data as unknown as ProposalReportRequestData;
}

export async function createProposalExecutionHandoff(
  proposalId: string,
  payload: ProposalBodyRequest,
  idempotencyKey?: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson(
    `/proposals/${proposalId}/execution-handoffs`,
    payload,
    idempotencyKey,
  );
}

export async function getProposalDeliverySummary(
  proposalId: string,
): Promise<ProposalDeliverySummaryData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/delivery-summary`,
    "proposal delivery summary",
  );
  return envelope.data as unknown as ProposalDeliverySummaryData;
}

export async function getProposalDeliveryEvents(
  proposalId: string,
): Promise<ProposalDeliveryEventsData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/delivery-events`,
    "proposal delivery events",
  );
  return envelope.data as unknown as ProposalDeliveryEventsData;
}

export async function getProposalExecutionStatus(
  proposalId: string,
  portfolioId: string,
  versionNo: number,
  currentState: string,
): Promise<ProposalImplementationStatusEnvelope> {
  const envelope = await fetchWorkbenchJson<unknown>(
    `${BFF_PROXY_BASE}/proposals/${encodeURIComponent(proposalId)}/execution-status`,
    "proposal implementation status",
  );
  return parseProposalImplementationStatusEnvelope(
    envelope,
    proposalId,
    portfolioId,
    versionNo,
    currentState,
  );
}

export async function recordProposalExecutionUpdate(
  proposalId: string,
  payload: ProposalBodyRequest,
  idempotencyKey?: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson(
    `/proposals/${proposalId}/execution-updates`,
    payload,
    idempotencyKey,
  );
}

export async function createProposalMemo(
  proposalId: string,
  versionNo: number,
  payload: ProposalMemoCreateRequest,
  idempotencyKey: string,
): Promise<ProposalMemoData> {
  const envelope = await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/memo`,
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as ProposalMemoData;
}

export async function getProposalMemo(
  proposalId: string,
  versionNo: number,
): Promise<ProposalMemoData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/versions/${versionNo}/memo`,
    "proposal memo",
  );
  return envelope.data as unknown as ProposalMemoData;
}

export async function getProposalMemoProjection(
  proposalId: string,
  versionNo: number,
  audience?: string,
): Promise<ProposalMemoProjectionData> {
  const params = new URLSearchParams();
  if (audience) {
    params.set("audience", audience);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/versions/${versionNo}/memo/projection${query}`,
    "proposal memo projection",
  );
  return envelope.data as unknown as ProposalMemoProjectionData;
}

export async function reviewProposalMemo(
  proposalId: string,
  versionNo: number,
  payload: ProposalMemoReviewRequest,
  idempotencyKey?: string,
): Promise<ProposalMemoReviewData> {
  const envelope = await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/memo/review`,
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as ProposalMemoReviewData;
}

export async function recordProposalMemoReportPackageEvent(
  proposalId: string,
  versionNo: number,
  payload: ProposalBodyRequest,
  idempotencyKey?: string,
): Promise<ProposalEnvelopeResponse> {
  return await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/memo/report-package-events`,
    payload,
    idempotencyKey,
  );
}

export async function requestProposalMemoReportPackage(
  proposalId: string,
  versionNo: number,
  payload: ProposalMemoReportPackageRequest,
  idempotencyKey?: string,
): Promise<ProposalMemoReportPackageData> {
  const envelope = await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/memo/report-packages`,
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as ProposalMemoReportPackageData;
}

export async function requestProposalMemoAiCommentary(
  proposalId: string,
  versionNo: number,
  payload: ProposalMemoAiCommentaryRequest,
  idempotencyKey?: string,
): Promise<ProposalMemoAiCommentaryData> {
  const envelope = await postJson(
    `/proposals/${proposalId}/versions/${versionNo}/memo/ai-commentary`,
    payload,
    idempotencyKey,
  );
  return envelope.data as unknown as ProposalMemoAiCommentaryData;
}

export async function requestProposalMemoAdvisorCommentary(
  proposalId: string,
  versionNo: number,
  payload: ProposalMemoAdvisorCommentaryRequest,
  idempotencyKey?: string,
): Promise<ProposalMemoAdvisorCommentaryData> {
  return await requestProposalMemoAiCommentary(
    proposalId,
    versionNo,
    payload,
    idempotencyKey,
  );
}

export async function getProposalMemoLineage(
  proposalId: string,
): Promise<ProposalMemoLineageData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/memos/lineage`,
    "proposal memo lineage",
  );
  return envelope.data as unknown as ProposalMemoLineageData;
}

export async function getProposalMemoReplayEvidence(
  proposalId: string,
  versionNo: number,
): Promise<ProposalMemoReplayEvidenceData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/versions/${versionNo}/memo/replay-evidence`,
    "proposal memo replay evidence",
  );
  return envelope.data as unknown as ProposalMemoReplayEvidenceData;
}

export async function submitProposal(
  proposalId: string,
  payload: ProposalSubmitRequest,
  idempotencyKey: string,
): Promise<ProposalStateTransitionEnvelopeResponse> {
  return await postJson<ProposalStateTransitionEnvelopeResponse>(
    `/proposals/${proposalId}/submit`,
    payload,
    idempotencyKey,
  );
}

export async function approveRisk(
  proposalId: string,
  payload: ProposalApprovalActionRequest,
  idempotencyKey: string,
): Promise<ProposalStateTransitionEnvelopeResponse> {
  return await postJson<ProposalStateTransitionEnvelopeResponse>(
    `/proposals/${proposalId}/approve-risk`,
    payload,
    idempotencyKey,
  );
}

export async function approveCompliance(
  proposalId: string,
  payload: ProposalApprovalActionRequest,
  idempotencyKey: string,
): Promise<ProposalStateTransitionEnvelopeResponse> {
  return await postJson<ProposalStateTransitionEnvelopeResponse>(
    `/proposals/${proposalId}/approve-compliance`,
    payload,
    idempotencyKey,
  );
}

export async function recordClientConsent(
  proposalId: string,
  payload: ProposalApprovalActionRequest,
  idempotencyKey: string,
): Promise<ProposalStateTransitionEnvelopeResponse> {
  return await postJson<ProposalStateTransitionEnvelopeResponse>(
    `/proposals/${proposalId}/record-client-consent`,
    payload,
    idempotencyKey,
  );
}

export async function getProposalWorkflowEvents(
  proposalId: string,
): Promise<ProposalWorkflowEventsData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/workflow-events`,
    "proposal workflow events",
  );
  return envelope.data as unknown as ProposalWorkflowEventsData;
}

export async function getProposalApprovals(
  proposalId: string,
): Promise<ProposalApprovalsData> {
  const envelope = await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}/proposals/${proposalId}/approvals`,
    "proposal approvals",
  );
  return envelope.data as unknown as ProposalApprovalsData;
}

async function postJson<TResponse extends ProposalEnvelopeResponse = ProposalEnvelopeResponse>(
  path: string,
  payload: unknown,
  idempotencyKey?: string,
): Promise<TResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return await fetchWorkbenchMutation<TResponse>(
    `${BFF_PROXY_BASE}${path}`,
    "proposal request",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );
}

async function getProposalEnvelope(
  path: string,
): Promise<ProposalEnvelopeResponse> {
  return await fetchWorkbenchJson<ProposalEnvelopeResponse>(
    `${BFF_PROXY_BASE}${path}`,
    "proposal request",
  );
}

async function getAdvisoryWorkspaceJson(
  path: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  return await fetchWorkbenchJson<AdvisoryWorkspaceEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-workspaces${path}`,
    "advisory workspace request",
  );
}

async function postAdvisoryWorkspaceJson(
  path: string,
  payload: unknown,
  idempotencyKey?: string,
): Promise<AdvisoryWorkspaceEnvelopeResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return await fetchWorkbenchMutation<AdvisoryWorkspaceEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-workspaces${path}`,
    "advisory workspace request",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
  );
}

async function getAdvisorCockpitData(
  path: string,
): Promise<Record<string, unknown>> {
  const envelope = await fetchWorkbenchJson<AdvisorCockpitEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisor-cockpit${path}`,
    "advisor cockpit request",
  );
  return envelope.data;
}

async function postAdvisoryCopilotJson(
  path: string,
  body: unknown,
  idempotencyKey?: string,
): Promise<AdvisoryCopilotEnvelopeResponse> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  return await fetchWorkbenchMutation<AdvisoryCopilotEnvelopeResponse>(
    `${BFF_PROXY_BASE}/advisory-copilot${path}`,
    "advisory copilot request",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ body }),
    },
  );
}

function buildAdvisorCockpitQuery(filters: AdvisorCockpitFilters): string {
  const params = new URLSearchParams();
  if (filters.portfolioId) {
    params.set("portfolio_id", filters.portfolioId);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  if (filters.cursor) {
    params.set("cursor", filters.cursor);
  }
  return params.toString() ? `?${params.toString()}` : "";
}

function requireSelectedIdeaPortfolio(portfolioId: string) {
  if (!portfolioId.trim()) {
    throw new Error(
      "Select a portfolio before requesting Lotus Idea source data.",
    );
  }
}

async function postAdvisorIdeaCandidateAction<TRequest>({
  candidateId,
  idempotencyKey,
  request,
  pathSuffix,
  errorLabel,
}: AdvisorIdeaCandidateActionInput<TRequest> & {
  pathSuffix: "review-actions" | "feedback" | "conversion-intents";
  capability: string;
  errorLabel: string;
}): Promise<AdvisorIdeaCandidateActionData> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Idempotency-Key", idempotencyKey);
  const payload = await fetchWorkbenchMutation<unknown>(
    `${BFF_PROXY_BASE}/ideas/candidates/${encodeURIComponent(candidateId)}/${pathSuffix}`,
    errorLabel.toLowerCase(),
    {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    },
  );
  const data = unwrapGatewayData<AdvisorIdeaCandidateActionData>(payload);
  const persistenceDecision = data.persistence?.decision;
  if (
    persistenceDecision !== "accepted" &&
    persistenceDecision !== "replayed"
  ) {
    throw new Error(
      `${errorLabel} did not return source-owned persistence proof. No success was recorded in Workbench.`,
    );
  }
  return data;
}

function unwrapGatewayData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: unknown }).data &&
    typeof (payload as { data?: unknown }).data === "object"
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
