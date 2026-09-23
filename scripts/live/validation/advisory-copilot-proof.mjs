import { randomUUID } from "node:crypto";

import { fetchJson, sendJson } from "./probes.mjs";
import {
  buildPayloadScopedIdempotencyKey,
  extractGatewayEnvelopeData,
  readString,
} from "./payload-utils.mjs";

export const CANONICAL_ADVISORY_COPILOT_ACTIONS = [
  {
    family: "PROPOSAL_EXPLANATION",
    audience: "ADVISOR",
    outputKey: "advisor_review_summary",
    intent: "explain_policy_posture",
  },
  {
    family: "EVIDENCE_QA",
    audience: "ADVISOR",
    outputKey: "evidence_answer",
    intent: "answer_source_evidence_question",
  },
  {
    family: "MEETING_PREPARATION",
    audience: "ADVISOR",
    outputKey: "meeting_preparation_note",
    intent: "prepare_meeting_review",
  },
  {
    family: "COMPLIANCE_REVIEW_SUMMARY",
    audience: "COMPLIANCE_REVIEWER",
    outputKey: "compliance_review_summary",
    intent: "summarize_compliance_review",
  },
  {
    family: "OPERATIONS_REPORT_HANDOFF",
    audience: "OPERATIONS_SUPPORT",
    outputKey: "operations_handoff_summary",
    intent: "summarize_operations_handoff",
  },
  {
    family: "CLIENT_FOLLOW_UP_DRAFT",
    audience: "ADVISOR",
    outputKey: "advisor_follow_up_draft",
    intent: "draft_internal_follow_up",
  },
];

const DEFAULT_SCENARIO = {
  scenarioId: "RFC27_ADVISORY_COPILOT_CANONICAL",
  expectedSupportStatus:
    "ADVISE_COPILOT_GATEWAY_WORKBENCH_CANONICAL_PROOF_SUPPORTED",
  expectedClientReadyPublication: "BLOCKED",
  expectedReviewPosture: "REVIEW_REQUIRED",
  expectedReviewedPosture: "APPROVED_FOR_INTERNAL_USE",
  expectedGuardrailPosture: "GUARDRAIL_REJECTED",
  expectedGuardrailReason: "CLIENT_READY_PUBLICATION_FORBIDDEN",
  actionFamilies: CANONICAL_ADVISORY_COPILOT_ACTIONS.map(
    (action) => action.family,
  ),
  unsupportedCapabilityBoundaries: [
    "CLIENT_READY_PUBLICATION",
    "POLICY_APPROVAL_OR_SIGN_OFF",
    "OMS_ORDER_LIFECYCLE",
    "CLIENT_COMMUNICATION_DELIVERY",
  ],
};

const COPILOT_MAKER_ACTOR_ID = "workbench-canonical-copilot-validator";
const COPILOT_REVIEWER_ACTOR_ID = "desk_head_sg_001";

function advisoryCopilotCallerHeaders({
  authority,
  actorId,
  role,
  capability,
  proposalId,
  portfolioId,
}) {
  const tenantId = readString(authority?.tenantId);
  const legalEntityCode = readString(authority?.legalEntityCode);
  if (!tenantId || !legalEntityCode) {
    throw new Error(
      "Advisory copilot proof requires the authority consumed by the canonical policy evaluation.",
    );
  }
  return {
    "X-Actor-Id": actorId,
    "X-Tenant-Id": tenantId,
    "X-Legal-Entity-Code": legalEntityCode,
    "X-Role": role,
    "X-Caller-Capabilities": capability,
    "X-Principal-Status": "ACTIVE",
    "X-Authorized-Proposal-Id": proposalId,
    "X-Authorized-Portfolio-Id": portfolioId,
  };
}

function normalizeScenario(rawScenario) {
  if (!rawScenario || typeof rawScenario !== "object") {
    return DEFAULT_SCENARIO;
  }
  return {
    scenarioId:
      readString(rawScenario.scenarioId) ?? DEFAULT_SCENARIO.scenarioId,
    expectedSupportStatus:
      readString(rawScenario.expectedSupportStatus) ??
      DEFAULT_SCENARIO.expectedSupportStatus,
    expectedClientReadyPublication:
      readString(rawScenario.expectedClientReadyPublication) ??
      DEFAULT_SCENARIO.expectedClientReadyPublication,
    expectedReviewPosture:
      readString(rawScenario.expectedReviewPosture) ??
      DEFAULT_SCENARIO.expectedReviewPosture,
    expectedReviewedPosture:
      readString(rawScenario.expectedReviewedPosture) ??
      DEFAULT_SCENARIO.expectedReviewedPosture,
    expectedGuardrailPosture:
      readString(rawScenario.expectedGuardrailPosture) ??
      DEFAULT_SCENARIO.expectedGuardrailPosture,
    expectedGuardrailReason:
      readString(rawScenario.expectedGuardrailReason) ??
      DEFAULT_SCENARIO.expectedGuardrailReason,
    actionFamilies: Array.isArray(rawScenario.actionFamilies)
      ? rawScenario.actionFamilies.map(readString).filter(Boolean)
      : DEFAULT_SCENARIO.actionFamilies,
    unsupportedCapabilityBoundaries: Array.isArray(
      rawScenario.unsupportedCapabilityBoundaries,
    )
      ? rawScenario.unsupportedCapabilityBoundaries
          .map(readString)
          .filter(Boolean)
      : DEFAULT_SCENARIO.unsupportedCapabilityBoundaries,
  };
}

function actionsForScenario(scenario) {
  const requestedFamilies = new Set(scenario.actionFamilies);
  return CANONICAL_ADVISORY_COPILOT_ACTIONS.filter((action) =>
    requestedFamilies.has(action.family),
  );
}

function assertBoundaryText(payload, boundaries) {
  const text = JSON.stringify(payload).toUpperCase();
  for (const boundary of boundaries) {
    if (!text.includes(boundary.toUpperCase())) {
      throw new Error(
        `Advisory copilot supportability did not include boundary ${boundary}.`,
      );
    }
  }
}

function assertSourceBackedPacket(packet, { action, portfolioId, proposalId }) {
  if (readString(packet?.action_family) !== action.family) {
    throw new Error(
      `Advisory copilot packet returned action ${readString(packet?.action_family) ?? "missing"}, expected ${action.family}.`,
    );
  }
  if (readString(packet?.portfolio_id) !== portfolioId) {
    throw new Error(
      `Advisory copilot packet returned portfolio ${readString(packet?.portfolio_id) ?? "missing"}, expected ${portfolioId}.`,
    );
  }
  if (readString(packet?.proposal_id) !== proposalId) {
    throw new Error(
      `Advisory copilot packet returned proposal ${readString(packet?.proposal_id) ?? "missing"}, expected ${proposalId}.`,
    );
  }
  if (
    !readString(packet?.evidence_packet_id) ||
    !readString(packet?.evidence_packet_hash)
  ) {
    throw new Error(
      "Advisory copilot packet returned no stable identity and hash.",
    );
  }
  const sections = Array.isArray(packet?.sections) ? packet.sections : [];
  if (sections.length < 1) {
    throw new Error(
      `Advisory copilot ${action.family} packet returned no source sections.`,
    );
  }
  const sectionWithoutSource = sections.find(
    (section) =>
      !readString(section?.section_key) ||
      !readString(section?.title) ||
      !Array.isArray(section?.source_refs) ||
      section.source_refs.length < 1,
  );
  if (sectionWithoutSource) {
    throw new Error(
      `Advisory copilot ${action.family} packet included a section without source refs.`,
    );
  }
}

function assertRun(run, { action, scenario, packet }) {
  if (
    !readString(run?.run_id) ||
    !readString(run?.request_hash) ||
    !readString(run?.output_hash)
  ) {
    throw new Error(
      `Advisory copilot ${action.family} run returned no stable hashes.`,
    );
  }
  if (readString(run?.action_family) !== action.family) {
    throw new Error(
      `Advisory copilot run action drifted for ${action.family}.`,
    );
  }
  if (readString(run?.evidence_packet_id) !== packet.evidence_packet_id) {
    throw new Error(
      `Advisory copilot ${action.family} run lost evidence-packet lineage.`,
    );
  }
  if (
    readString(run?.client_ready_publication) !==
    scenario.expectedClientReadyPublication
  ) {
    throw new Error(
      `Advisory copilot ${action.family} run returned client publication ${readString(run?.client_ready_publication) ?? "missing"}, expected ${scenario.expectedClientReadyPublication}.`,
    );
  }
  if (readString(run?.review_posture) !== scenario.expectedReviewPosture) {
    throw new Error(
      `Advisory copilot ${action.family} run returned review posture ${readString(run?.review_posture) ?? "missing"}, expected ${scenario.expectedReviewPosture}.`,
    );
  }
  if (
    !readString(run?.workflow_pack_id) ||
    !readString(run?.workflow_pack_version)
  ) {
    throw new Error(
      `Advisory copilot ${action.family} run returned no workflow-pack lineage.`,
    );
  }
}

function assertReviewedRun(reviewResponse, { action, scenario }) {
  const run = reviewResponse?.run;
  const review = reviewResponse?.review;
  if (readString(run?.review_posture) !== scenario.expectedReviewedPosture) {
    throw new Error(
      `Advisory copilot ${action.family} review returned posture ${readString(run?.review_posture) ?? "missing"}, expected ${scenario.expectedReviewedPosture}.`,
    );
  }
  if (!readString(review?.review_id) || !readString(review?.request_hash)) {
    throw new Error(
      `Advisory copilot ${action.family} review returned no audit identity.`,
    );
  }
}

function assertGuardrailRun(run, { scenario }) {
  if (readString(run?.review_posture) !== scenario.expectedGuardrailPosture) {
    throw new Error(
      `Advisory copilot guardrail run returned posture ${readString(run?.review_posture) ?? "missing"}, expected ${scenario.expectedGuardrailPosture}.`,
    );
  }
  const guardrails = Array.isArray(run?.guardrail_results_json)
    ? run.guardrail_results_json
    : [];
  if (!guardrails.includes(scenario.expectedGuardrailReason)) {
    throw new Error(
      `Advisory copilot guardrail run did not include ${scenario.expectedGuardrailReason}.`,
    );
  }
}

async function createSourceOwnedPacket({
  summary,
  scenario,
  gatewayBaseUrl,
  proposalId,
  proposalVersionNo,
  portfolioId,
  authority,
  action,
  timeoutMs,
}) {
  const requestBody = {
    body: {
      proposal_id: proposalId,
      proposal_version_no: proposalVersionNo,
      action_family: action.family,
      audience: action.audience,
      created_by: COPILOT_MAKER_ACTOR_ID,
      reason: {
        purpose: "canonical_rfc0027_advisory_copilot_validation",
        scenario_id: scenario.scenarioId,
      },
    },
  };
  const response = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-copilot/evidence-packets/from-proposal-version`,
    `Advisory copilot ${action.family} source evidence packet`,
    timeoutMs,
    {
      method: "POST",
      body: requestBody,
      headers: advisoryCopilotCallerHeaders({
        authority,
        actorId: COPILOT_MAKER_ACTOR_ID,
        role: "ADVISOR",
        capability: "advisory.policy_evaluation.read",
        proposalId,
        portfolioId,
      }),
    },
  );
  const data = extractGatewayEnvelopeData(response);
  return data?.evidence_packet ?? data;
}

async function runCopilotAction({
  summary,
  scenario,
  gatewayBaseUrl,
  packet,
  portfolioId,
  proposalId,
  authority,
  action,
  timeoutMs,
  proofExecutionId,
}) {
  const requestBody = {
    body: {
      evidence_packet_id: packet.evidence_packet_id,
      audience: action.audience,
      requested_outputs: [action.outputKey],
      requested_by: COPILOT_MAKER_ACTOR_ID,
      requested_intents: [action.intent],
      user_instruction: "",
      reason: {
        purpose: "canonical_rfc0027_advisory_copilot_validation",
        scenario_id: scenario.scenarioId,
        evidence_packet_hash: packet.evidence_packet_hash,
        proof_execution_id: proofExecutionId,
      },
    },
  };
  const response = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-copilot/actions`,
    `Advisory copilot ${action.family} action run`,
    timeoutMs,
    {
      method: "POST",
      body: requestBody,
      headers: {
        ...advisoryCopilotCallerHeaders({
          authority,
          actorId: COPILOT_MAKER_ACTOR_ID,
          role: "ADVISOR",
          capability: "advisory.copilot.action",
          proposalId,
          portfolioId,
        }),
        "Idempotency-Key": buildPayloadScopedIdempotencyKey(
          "wb-copilot-run",
          requestBody,
        ),
      },
    },
  );
  const data = extractGatewayEnvelopeData(response);
  return data?.run ?? data;
}

async function reviewCopilotRun({
  summary,
  scenario,
  gatewayBaseUrl,
  run,
  action,
  portfolioId,
  proposalId,
  authority,
  timeoutMs,
  proofExecutionId,
}) {
  const requestBody = {
    body: {
      action: "APPROVE_FOR_INTERNAL_USE",
      reason: {
        decision:
          "Reviewed against cited source evidence for internal advisor use.",
        scenario_id: scenario.scenarioId,
        proof_execution_id: proofExecutionId,
      },
    },
  };
  const response = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-copilot/actions/${encodeURIComponent(
      run.run_id,
    )}/reviews`,
    `Advisory copilot ${action.family} internal review`,
    timeoutMs,
    {
      method: "POST",
      body: requestBody,
      headers: {
        "Idempotency-Key": buildPayloadScopedIdempotencyKey(
          "wb-copilot-review",
          { run_id: run.run_id, ...requestBody },
        ),
        ...advisoryCopilotCallerHeaders({
          authority,
          actorId: COPILOT_REVIEWER_ACTOR_ID,
          role: "ADVISORY_SUPERVISOR",
          capability: "advisory.copilot.review",
          proposalId,
          portfolioId,
        }),
      },
    },
  );
  return extractGatewayEnvelopeData(response);
}

async function createGuardrailRejectedRun({
  summary,
  scenario,
  gatewayBaseUrl,
  packet,
  portfolioId,
  proposalId,
  authority,
  action,
  timeoutMs,
  proofExecutionId,
}) {
  const requestBody = {
    body: {
      evidence_packet_id: packet.evidence_packet_id,
      audience: action.audience,
      requested_outputs: [action.outputKey],
      requested_by: COPILOT_MAKER_ACTOR_ID,
      requested_intents: ["publish_client_ready"],
      user_instruction: "",
      reason: {
        purpose: "canonical_rfc0027_guardrail_validation",
        scenario_id: scenario.scenarioId,
        evidence_packet_hash: packet.evidence_packet_hash,
        proof_execution_id: proofExecutionId,
      },
    },
  };
  const response = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-copilot/actions`,
    "Advisory copilot client-ready guardrail rejection",
    timeoutMs,
    {
      method: "POST",
      body: requestBody,
      headers: {
        ...advisoryCopilotCallerHeaders({
          authority,
          actorId: COPILOT_MAKER_ACTOR_ID,
          role: "ADVISOR",
          capability: "advisory.copilot.action",
          proposalId,
          portfolioId,
        }),
        "Idempotency-Key": buildPayloadScopedIdempotencyKey(
          "wb-copilot-guardrail",
          requestBody,
        ),
      },
    },
  );
  const data = extractGatewayEnvelopeData(response);
  return data?.run ?? data;
}

export async function validateCanonicalAdvisoryCopilot({
  summary,
  scenario: rawScenario,
  gatewayBaseUrl,
  portfolioId,
  proposalId,
  proposalVersionId,
  proposalVersionNo,
  authority,
  timeoutMs,
  proofExecutionId: rawProofExecutionId,
}) {
  const scenario = normalizeScenario(rawScenario);
  const proofExecutionId =
    readString(rawProofExecutionId) ??
    `wb-rfc0027-copilot-proof-${randomUUID()}`;
  const actions = actionsForScenario(scenario);
  if (actions.length !== scenario.actionFamilies.length) {
    throw new Error(
      "Advisory copilot canonical scenario declares unknown action families.",
    );
  }

  const supportability = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-copilot/supportability`,
    "Advisory copilot canonical supportability",
    timeoutMs,
  );
  const supportabilityData = extractGatewayEnvelopeData(supportability);
  if (
    readString(supportabilityData?.support_status) !==
    scenario.expectedSupportStatus
  ) {
    throw new Error(
      `Advisory copilot supportability returned ${readString(supportabilityData?.support_status) ?? "missing"}, expected ${scenario.expectedSupportStatus}.`,
    );
  }
  if (
    readString(supportabilityData?.client_ready_publication) !==
    scenario.expectedClientReadyPublication
  ) {
    throw new Error(
      "Advisory copilot supportability did not preserve blocked publication.",
    );
  }
  const supportedFamilies = new Set(
    supportabilityData?.supported_action_families ?? [],
  );
  for (const action of actions) {
    if (!supportedFamilies.has(action.family)) {
      throw new Error(
        `Advisory copilot supportability omitted ${action.family}.`,
      );
    }
  }
  assertBoundaryText(
    supportabilityData,
    scenario.unsupportedCapabilityBoundaries,
  );

  const actionProofs = [];
  for (const action of actions) {
    const packet = await createSourceOwnedPacket({
      summary,
      scenario,
      gatewayBaseUrl,
      proposalId,
      proposalVersionNo,
      portfolioId,
      authority,
      action,
      timeoutMs,
    });
    assertSourceBackedPacket(packet, { action, portfolioId, proposalId });
    if (
      readString(packet.client_ready_publication) !==
      scenario.expectedClientReadyPublication
    ) {
      throw new Error(
        `Advisory copilot ${action.family} packet did not block client publication.`,
      );
    }

    const run = await runCopilotAction({
      summary,
      scenario,
      gatewayBaseUrl,
      packet,
      portfolioId,
      proposalId,
      authority,
      action,
      timeoutMs,
      proofExecutionId,
    });
    assertRun(run, { action, scenario, packet });

    const reviewResponse = await reviewCopilotRun({
      summary,
      scenario,
      gatewayBaseUrl,
      run,
      action,
      portfolioId,
      proposalId,
      authority,
      timeoutMs,
      proofExecutionId,
    });
    assertReviewedRun(reviewResponse, { action, scenario });
    actionProofs.push({
      actionFamily: action.family,
      evidencePacketId: packet.evidence_packet_id,
      runId: run.run_id,
      reviewedPosture: reviewResponse.run.review_posture,
      clientReadyPublication: run.client_ready_publication,
      sourceSectionCount: packet.sections.length,
      unsupportedEvidenceCount: Array.isArray(packet.unsupported_evidence)
        ? packet.unsupported_evidence.length
        : 0,
    });
  }

  const guardrailAction = actions[0];
  const guardrailPacket = await createSourceOwnedPacket({
    summary,
    scenario,
    gatewayBaseUrl,
    proposalId,
    proposalVersionNo,
    portfolioId,
    authority,
    action: guardrailAction,
    timeoutMs,
  });
  const guardrailRun = await createGuardrailRejectedRun({
    summary,
    scenario,
    gatewayBaseUrl,
    packet: guardrailPacket,
    portfolioId,
    proposalId,
    authority,
    action: guardrailAction,
    timeoutMs,
    proofExecutionId,
  });
  assertGuardrailRun(guardrailRun, { scenario });

  const runPage = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-copilot/proposals/${encodeURIComponent(
      proposalId,
    )}/versions/${encodeURIComponent(proposalVersionId)}/runs`,
    "Advisory copilot proposal-version run list",
    timeoutMs,
    {
      headers: advisoryCopilotCallerHeaders({
        authority,
        actorId: COPILOT_MAKER_ACTOR_ID,
        role: "ADVISOR",
        capability: "advisory.copilot.read",
        proposalId,
        portfolioId,
      }),
    },
  );
  const runPageData = extractGatewayEnvelopeData(runPage);
  const listedRuns = Array.isArray(runPageData?.items) ? runPageData.items : [];
  const missingRun = actionProofs.find(
    (proof) =>
      !listedRuns.some((run) => readString(run?.run_id) === proof.runId),
  );
  if (missingRun) {
    throw new Error(
      `Advisory copilot proposal-version run list did not include ${missingRun.actionFamily}.`,
    );
  }

  summary.workflowPackChecks.push({
    actionType: "ADVISORY_COPILOT_CANONICAL_PROOF_CREATED",
    route: "/api/v1/advisory-copilot/actions",
    scenarioId: scenario.scenarioId,
    portfolioId,
    proposalId,
    proposalVersionId,
    proofExecutionId,
    actionFamilies: actionProofs.map((proof) => proof.actionFamily),
    actionRunCount: actionProofs.length,
    sourcePacketCount: actionProofs.length,
    guardrailRunId: guardrailRun.run_id,
    guardrailPosture: guardrailRun.review_posture,
    clientReadyPublication: scenario.expectedClientReadyPublication,
    proposalVersionRunCount: listedRuns.length,
  });

  return {
    scenarioId: scenario.scenarioId,
    proofExecutionId,
    actionRunCount: actionProofs.length,
    sourcePacketCount: actionProofs.length,
    guardrailRunId: guardrailRun.run_id,
    guardrailPosture: guardrailRun.review_posture,
    clientReadyPublication: scenario.expectedClientReadyPublication,
    proposalVersionRunCount: listedRuns.length,
    actions: actionProofs,
  };
}
