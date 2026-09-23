import { fetchJson, sendJson } from "./probes.mjs";
import {
  buildPayloadScopedIdempotencyKey,
  extractGatewayEnvelopeData,
  readString,
} from "./payload-utils.mjs";

const CANONICAL_POLICY_TENANT_ID = "tenant-sg";

function advisoryPolicyCallerHeaders({
  actorId,
  legalEntityCode,
  role,
  capability,
  proposalId,
  portfolioId,
}) {
  const headers = {
    "X-Actor-Id": actorId,
    "X-Tenant-Id": CANONICAL_POLICY_TENANT_ID,
    "X-Legal-Entity-Code": legalEntityCode,
    "X-Role": role,
    "X-Caller-Capabilities": capability,
  };
  if (proposalId && portfolioId) {
    headers["X-Authorized-Proposal-Id"] = proposalId;
    headers["X-Authorized-Portfolio-Id"] = portfolioId;
  }
  return headers;
}

function extractPolicyPackLegalEntityCode(response) {
  const payload = extractGatewayEnvelopeData(response);
  const legalEntityScope = Array.isArray(
    payload?.applicability?.legal_entity_scope,
  )
    ? payload.applicability.legal_entity_scope.map(readString).filter(Boolean)
    : [];
  if (legalEntityScope.length !== 1) {
    throw new Error(
      "Canonical advisory policy pack must declare exactly one legal-entity scope.",
    );
  }
  return legalEntityScope[0];
}

function extractPolicyPackContentHash(response) {
  const payload = extractGatewayEnvelopeData(response);
  return (
    readString(payload?.policy_pack?.content_hash) ||
    readString(payload?.policy_pack_version?.policy_pack?.content_hash) ||
    readString(payload?.content_hash) ||
    readString(payload?.policy_pack?.metadata?.content_hash) ||
    null
  );
}

function isAlreadyActivePolicyPackError(error) {
  return (
    error instanceof Error &&
    error.message.includes("POLICY_PACK_VERSION_ALREADY_ACTIVE_IMMUTABLE")
  );
}

function buildAdvisoryPolicyMutationIdempotencyKey(
  prefix,
  resource,
  requestBody,
) {
  return buildPayloadScopedIdempotencyKey(prefix, {
    resource,
    request: requestBody,
  });
}

async function ensureAdvisoryPolicyPackActive({
  summary,
  scenario,
  gatewayBaseUrl,
  timeoutMs,
}) {
  const version = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-policy-packs/${encodeURIComponent(
      scenario.policyPackId,
    )}/versions/${encodeURIComponent(scenario.policyVersion)}`,
    "Advisory policy pack version for canonical scenario",
    timeoutMs,
  );
  const contentHash = extractPolicyPackContentHash(version);
  if (!contentHash) {
    throw new Error(
      "Canonical advisory policy pack version returned no content hash.",
    );
  }
  const legalEntityCode = extractPolicyPackLegalEntityCode(version);

  const validateBody = {
    body: {
      requested_by: "workbench-canonical-validator",
      reason: {
        purpose: "canonical_rfc0025_policy_validation",
        scenario_id: scenario.scenarioId,
      },
    },
  };
  await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-policy-packs/${encodeURIComponent(
      scenario.policyPackId,
    )}/versions/${encodeURIComponent(scenario.policyVersion)}/validate`,
    "Validate advisory policy pack for canonical scenario",
    timeoutMs,
    {
      method: "POST",
      body: validateBody,
      headers: {
        ...advisoryPolicyCallerHeaders({
          actorId: validateBody.body.requested_by,
          legalEntityCode,
          role: "POLICY_STEWARD",
          capability: "advisory.policy_pack.validate",
        }),
        "Idempotency-Key": buildAdvisoryPolicyMutationIdempotencyKey(
          "wb-policy-pack-validate",
          {
            policy_pack_id: scenario.policyPackId,
            policy_version: scenario.policyVersion,
          },
          validateBody,
        ),
      },
    },
  );

  const activateBody = {
    body: {
      activated_by: "workbench-canonical-policy-checker",
      source_content_hash: contentHash,
      reason: {
        purpose: "canonical_rfc0025_policy_validation",
        scenario_id: scenario.scenarioId,
      },
    },
  };
  const activateUrl = `${gatewayBaseUrl}/api/v1/advisory-policy-packs/${encodeURIComponent(
    scenario.policyPackId,
  )}/versions/${encodeURIComponent(scenario.policyVersion)}/activate`;
  try {
    await sendJson(
      summary,
      activateUrl,
      "Activate advisory policy pack for canonical scenario",
      timeoutMs,
      {
        method: "POST",
        body: activateBody,
        headers: {
          ...advisoryPolicyCallerHeaders({
            actorId: activateBody.body.activated_by,
            legalEntityCode,
            role: "POLICY_CHECKER",
            capability: "advisory.policy_pack.activate",
          }),
          "Idempotency-Key": buildAdvisoryPolicyMutationIdempotencyKey(
            "wb-policy-pack-activate",
            {
              policy_pack_id: scenario.policyPackId,
              policy_version: scenario.policyVersion,
            },
            activateBody,
          ),
        },
      },
    );
  } catch (error) {
    if (!isAlreadyActivePolicyPackError(error)) {
      throw error;
    }
    summary.apiChecks.push({
      description: "Activate advisory policy pack for canonical scenario",
      url: activateUrl,
      status: "already_active",
      kind: "json-idempotent-replay",
      method: "POST",
    });
  }
  return { legalEntityCode };
}

export async function createCanonicalPolicyEvaluation({
  summary,
  scenario,
  gatewayBaseUrl,
  proposalId,
  proposalVersionId,
  timeoutMs,
}) {
  const { legalEntityCode } = await ensureAdvisoryPolicyPackActive({
    summary,
    scenario,
    gatewayBaseUrl,
    timeoutMs,
  });
  const portfolioId = readString(
    scenario.evidenceBundle?.inputs?.portfolio_snapshot?.portfolio_id,
  );
  if (!portfolioId) {
    throw new Error(
      "Canonical policy evaluation scenario did not declare a portfolio id.",
    );
  }
  const createBody = {
    body: {
      policy_pack_id: scenario.policyPackId,
      policy_version: scenario.policyVersion,
      created_by: scenario.createdBy,
      evidence_bundle: scenario.evidenceBundle,
      reason: {
        purpose: "canonical_suitability_policy_review",
        scenario_id: scenario.scenarioId,
      },
    },
  };
  const created = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/proposals/${encodeURIComponent(
      proposalId,
    )}/versions/${encodeURIComponent(proposalVersionId)}/policy-evaluations`,
    "Create advisory policy evaluation canonical proof",
    timeoutMs,
    {
      method: "POST",
      body: createBody,
      headers: {
        ...advisoryPolicyCallerHeaders({
          actorId: scenario.createdBy,
          legalEntityCode,
          role: "ADVISOR",
          capability: "advisory.policy_evaluation.finalize",
          proposalId,
          portfolioId,
        }),
        "Idempotency-Key": buildAdvisoryPolicyMutationIdempotencyKey(
          "wb-policy-evaluation",
          {
            proposal_id: proposalId,
            proposal_version_id: proposalVersionId,
          },
          createBody,
        ),
      },
    },
  );
  const createdData = extractGatewayEnvelopeData(created);
  const record = createdData?.record ?? createdData;
  const evaluationId = readString(record?.evaluation_id);
  const evaluationHash = readString(record?.evaluation_hash);
  if (!evaluationId || !evaluationHash) {
    throw new Error(
      "Canonical policy evaluation proof did not return evaluation identity and hash.",
    );
  }
  if (record.evaluation_status !== scenario.expectedEvaluationStatus) {
    throw new Error(
      `Canonical policy evaluation returned ${record.evaluation_status}, expected ${scenario.expectedEvaluationStatus}.`,
    );
  }
  const recordPortfolioId = readString(record?.portfolio_id);
  if (recordPortfolioId !== portfolioId) {
    throw new Error(
      `Canonical policy evaluation returned portfolio ${recordPortfolioId || "missing"}, expected ${portfolioId}.`,
    );
  }

  const readHeaders = advisoryPolicyCallerHeaders({
    actorId: scenario.createdBy,
    legalEntityCode,
    role: "ADVISOR",
    capability: "advisory.policy_evaluation.read",
  });
  const queue = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-policy-evaluations/review-queue?evaluation_status=${encodeURIComponent(
      scenario.expectedEvaluationStatus,
    )}&portfolio_id=${encodeURIComponent(portfolioId)}`,
    "Advisory policy review queue canonical proof",
    timeoutMs,
    { headers: readHeaders },
  );
  const queueData = extractGatewayEnvelopeData(queue);
  const queueItems = Array.isArray(queueData?.items) ? queueData.items : [];
  const outOfScopeItem = queueItems.find(
    (item) => readString(item?.portfolio_id) !== portfolioId,
  );
  if (outOfScopeItem) {
    throw new Error(
      `Canonical policy review queue returned item outside portfolio scope ${portfolioId}: ${
        readString(outOfScopeItem?.evaluation_id) || "unknown_evaluation"
      }.`,
    );
  }
  if (!queueItems.some((item) => item?.evaluation_id === evaluationId)) {
    throw new Error(
      "Canonical policy review queue did not include the seeded evaluation.",
    );
  }
  if (
    queueData?.queue_posture?.client_ready_publication !==
    scenario.expectedClientReadyPublication
  ) {
    throw new Error(
      "Canonical policy review queue did not preserve blocked client-ready posture.",
    );
  }

  const workflow = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-policy-evaluations/${encodeURIComponent(
      evaluationId,
    )}/workflow`,
    "Advisory policy workflow canonical proof",
    timeoutMs,
    { headers: readHeaders },
  );
  const workflowData = extractGatewayEnvelopeData(workflow);
  if (
    workflowData?.client_ready_publication !==
    scenario.expectedClientReadyPublication
  ) {
    throw new Error(
      "Canonical policy workflow did not preserve blocked client-ready posture.",
    );
  }

  const signOffPackage = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-policy-evaluations/${encodeURIComponent(
      evaluationId,
    )}/sign-off-package`,
    "Advisory policy sign-off package canonical proof",
    timeoutMs,
    { headers: readHeaders },
  );
  const signOffPackageData = extractGatewayEnvelopeData(signOffPackage);
  if (
    signOffPackageData?.package_posture?.client_ready_publication !==
    scenario.expectedClientReadyPublication
  ) {
    throw new Error(
      "Canonical policy sign-off package did not preserve blocked client-ready posture.",
    );
  }

  const reviewDecisionBody = {
    body: {
      actor_id: "policy_checker_1",
      decision: "REQUEST_MORE_EVIDENCE",
      source_evaluation_hash: evaluationHash,
      reason: {
        purpose: "canonical_policy_review_request",
        scenario_id: scenario.scenarioId,
      },
    },
  };
  await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory-policy-evaluations/${encodeURIComponent(
      evaluationId,
    )}/sign-off-decisions`,
    "Record advisory policy review request canonical proof",
    timeoutMs,
    {
      method: "POST",
      body: reviewDecisionBody,
      headers: {
        ...advisoryPolicyCallerHeaders({
          actorId: reviewDecisionBody.body.actor_id,
          legalEntityCode,
          role: "POLICY_CHECKER",
          capability: "advisory.policy_evaluation.sign_off",
          proposalId,
          portfolioId,
        }),
        "Idempotency-Key": buildAdvisoryPolicyMutationIdempotencyKey(
          "wb-policy-review-request",
          { evaluation_id: evaluationId },
          reviewDecisionBody,
        ),
      },
    },
  );

  summary.workflowPackChecks.push({
    actionType: "POLICY_EVALUATION_PENDING_REVIEW_CREATED",
    route: "/api/v1/advisory-policy-evaluations/review-queue",
    scenarioId: scenario.scenarioId,
    proposalId,
    proposalVersionId,
    portfolioId,
    evaluationId,
    resultReviewState: workflowData?.sign_off_status,
    resultSupportabilityStatus: record.evaluation_status,
    clientReadyPublication: workflowData?.client_ready_publication,
  });

  return {
    evaluationId,
    evaluationHash,
    authority: {
      tenantId: CANONICAL_POLICY_TENANT_ID,
      legalEntityCode,
      actorId: scenario.createdBy,
    },
  };
}
