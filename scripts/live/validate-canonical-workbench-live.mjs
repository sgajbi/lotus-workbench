import process from "node:process";
import { chromium } from "@playwright/test";
import { resolveValidationConfig } from "./validation/args.mjs";
import {
  DEFAULT_CANONICAL_CONTRACT,
  loadCanonicalContractMetadata,
  loadWorkbenchPanelRegistryMetadata,
} from "./validation/contract-metadata.mjs";
import {
  buildSummaryPaths,
  createValidationSummary,
  ensureDirectory,
  writeShotIndex,
  writeValidationSummary,
} from "./validation/evidence-summary-writer.mjs";
import {
  checkDns,
  fetchJson,
  fetchJsonUntil,
  fetchText,
  postJson,
  sendJson,
  sendJsonExpectingStatus,
} from "./validation/probes.mjs";
import {
  assertPerformanceCalculationSanity,
  assertRiskCalculationSanity,
} from "./validation/calculation-sanity.mjs";
import {
  createBrowserValidationHelpers,
  validateAdvisoryJourneyScreens,
  validateCanonicalIdeaJourney,
  validateAdvisorBriefPanel,
  validateAdvisorBookPanel,
  validateBankDemoProofPanel,
  validateConstructionAlternativesPanel,
  validateDpmCopilotWorkspace,
  validateProposalMemoEvidencePackPanel,
  validateProposalNarrativePosturePanel,
  validateDpmCommandCenterPanel,
  validatePortfolioMemoryPanel,
  validateDpmWaveCommandCenterPanel,
  validateEvidencePanel,
  validatePerformanceAnalysisPanel,
  validatePerformanceSummaryPanel,
  validatePortfolioPanels,
  validateReportCentrePanel,
  validatePmOperatingQualityPanel,
  validateOutcomeReviewPanel,
  validateProofPackPanel,
  validateRiskPanel,
} from "./validation/browser-workflows.mjs";
import { createPanelGovernance } from "./validation/panel-governance.mjs";
import {
  assertRfc3643FeatureCoverage,
  buildRfc3643FeatureCoverage,
} from "./validation/rfc36-43-feature-coverage.mjs";
import { validateAdvisorBriefWorkflowPackReviewChain } from "./validation/workflow-pack-proof.mjs";
import { validateCanonicalAdvisorCockpit } from "./validation/advisor-cockpit-proof.mjs";
import {
  classifyCanonicalAdvisorBookPanelSupportState,
  validateCanonicalAdvisorBookEvidence,
} from "./validation/advisor-book-proof.mjs";
import { createCanonicalPolicyEvaluation } from "./validation/advisory-policy-proof.mjs";
import { validateCanonicalAdvisoryCopilot } from "./validation/advisory-copilot-proof.mjs";
import {
  buildPayloadScopedIdempotencyKey,
  buildRuntimeScopedIdempotencyKey,
  extractGatewayEnvelopeData,
  readString,
} from "./validation/payload-utils.mjs";
import { loadIdeaCapacitySeedEvidence } from "./validation/idea-capacity-seed-evidence.mjs";
import {
  bindMainlineSourceManifestToRuntime,
  loadValidatedMainlineSourceManifest,
} from "./validation/mainline-source-provenance.mjs";

const {
  portfolioId,
  benchmarkCode,
  workbenchBaseUrl,
  gatewayBaseUrl,
  ideaBaseUrl,
  outputDir,
  timeoutMs,
  canonicalStartDate,
  canonicalAsOfDate,
  ideaCandidateId,
  ideaCapacitySeedEvidencePath,
  validationProfile,
  mainlineSourceProvenancePath,
} = resolveValidationConfig(process.argv.slice(2));
const { summaryPath, shotIndexPath } = buildSummaryPaths(outputDir);
const canonicalContract = await loadCanonicalContractMetadata();
const panelRegistry = await loadWorkbenchPanelRegistryMetadata();
const dpmCommandCenterDefaults = {
  tenantId:
    process.env.WORKBENCH_DPM_COMMAND_CENTER_TENANT_ID ??
    canonicalContract.dpmCommandCenter?.tenantId ??
    "default",
  workbenchCallerTenantId:
    process.env.WORKBENCH_BFF_TENANT_ID ??
    canonicalContract.dpmCommandCenter?.workbenchCallerTenantId ??
    "tenant-sg",
  portfolioManagerId:
    process.env.WORKBENCH_DPM_COMMAND_CENTER_PORTFOLIO_MANAGER_ID ??
    canonicalContract.dpmCommandCenter?.portfolioManagerId ??
    "PM_SG_DPM_001",
  bookId:
    process.env.WORKBENCH_DPM_COMMAND_CENTER_BOOK_ID ??
    canonicalContract.dpmCommandCenter?.bookId ??
    "BOOK_SG_BALANCED_DPM",
  asOfDate:
    process.env.WORKBENCH_DPM_COMMAND_CENTER_AS_OF_DATE ??
    canonicalContract.dpmCommandCenter?.commandCenterAsOfDate ??
    "2026-05-03",
};

const summary = createValidationSummary({
  generatedAt: new Date().toISOString(),
  portfolioId,
  benchmarkCode,
  canonicalContract,
  workbenchBaseUrl,
  gatewayBaseUrl,
  panelRegistry,
  validationProfile,
});
const mainlineSourceProvenance = mainlineSourceProvenancePath
  ? loadValidatedMainlineSourceManifest(mainlineSourceProvenancePath)
  : null;
const ideaVersion = await fetchJson(
  summary,
  `${ideaBaseUrl}/version`,
  "Lotus Idea runtime version",
  timeoutMs,
);
const canonicalRuntimeGeneration = readString(ideaVersion?.build?.imageBuildId);
if (canonicalRuntimeGeneration === null) {
  throw new Error(
    "Lotus Idea runtime version omitted the admitted canonical image generation.",
  );
}
if (mainlineSourceProvenance) {
  const ideaRuntimeBinding = bindMainlineSourceManifestToRuntime(
    mainlineSourceProvenance,
    {
      repository: "lotus-idea",
      commitSha: ideaVersion?.build?.gitCommitSha,
      branch: ideaVersion?.build?.gitBranch,
    },
  );
  summary.mainlineSourceProvenance = {
    path: mainlineSourceProvenancePath,
    certificationClassification:
      mainlineSourceProvenance.certificationClassification,
    repositories: mainlineSourceProvenance.repositories.map((repository) => ({
      repository: repository.repository,
      headSha: repository.headSha,
      expectedMainSha: repository.expectedMainSha,
    })),
    runtimeBindings: [ideaRuntimeBinding],
  };
}
summary.ideaCapacitySeed =
  validationProfile === "full"
    ? await loadIdeaCapacitySeedEvidence(ideaCapacitySeedEvidencePath, {
        commitSha: ideaVersion?.build?.gitCommitSha,
        branch: ideaVersion?.build?.gitBranch,
        runId: ideaVersion?.build?.ciRunId,
      })
    : {
        status: "excluded",
        ...summary.excludedProofs[0],
        productionCapacityCertified: false,
      };
const panelGovernance = createPanelGovernance(summary, panelRegistry);

const advisorBookAsOfDate =
  process.env.NEXT_PUBLIC_WORKBENCH_ADVISOR_BOOK_AS_OF_DATE ??
  canonicalAsOfDate;

function canonicalPerformanceQuery(extra = {}) {
  const query = new URLSearchParams({
    period: "EXPLICIT",
    chart_frequency: extra.chartFrequency ?? "monthly",
    detail_basis: extra.detailBasis ?? "NET",
    contribution_dimension: extra.contributionDimension ?? "asset_class",
    attribution_dimension: extra.attributionDimension ?? "asset_class",
    benchmark_code: benchmarkCode,
    report_start_date: extra.reportStartDate ?? canonicalStartDate,
    report_end_date: extra.reportEndDate ?? canonicalAsOfDate,
  });
  return query.toString();
}

function canonicalRiskQuery(extra = {}) {
  const query = new URLSearchParams({
    period: "EXPLICIT",
    detail_basis: extra.detailBasis ?? "NET",
    benchmark_code: benchmarkCode,
    report_start_date: extra.reportStartDate ?? canonicalStartDate,
    report_end_date: extra.reportEndDate ?? canonicalAsOfDate,
    as_of_date: extra.asOfDate ?? canonicalAsOfDate,
  });
  for (const [key, value] of Object.entries(extra.params ?? {})) {
    query.set(key, value);
  }
  return query.toString();
}

function readSupportabilityState(supportability) {
  return (
    readString(supportability?.state) ||
    readString(supportability?.supportability_state)
  );
}

function classifyCommandCenterPanelState(commandCenterPayload) {
  const supportability = commandCenterPayload?.supportability;
  const explicitState = readSupportabilityState(supportability)?.toLowerCase();
  if (explicitState === "ready") {
    return "ready";
  }
  if (
    explicitState === "partial" ||
    explicitState === "degraded" ||
    explicitState === "blocked"
  ) {
    return "partial";
  }
  if (explicitState === "empty") {
    return "empty";
  }
  const completenessState = readString(
    supportability?.data_completeness_state,
  )?.toLowerCase();
  if (completenessState === "complete") {
    return "ready";
  }
  if (completenessState === "partial") {
    return "partial";
  }
  if (completenessState === "empty") {
    return "empty";
  }
  return "partial";
}

function extractGeneratedProofPackId(response) {
  return (
    readString(response?.data?.proof_pack?.proof_pack_id) ||
    readString(response?.data?.proof_pack_id) ||
    readString(response?.supportability?.proof_pack_id) ||
    null
  );
}

function extractDpmWaveId(response) {
  const payload = response?.data ?? response;
  return (
    readString(payload?.wave?.wave_id) ||
    readString(payload?.wave_id) ||
    readString(payload?.items?.[0]?.wave_id) ||
    readString(response?.supportability?.wave_id) ||
    null
  );
}

function extractDpmWaveItemCount(response) {
  const payload = extractGatewayEnvelopeData(response);
  const wave = payload?.wave ?? payload;
  for (const candidate of [
    wave?.items,
    payload?.items,
    wave?.portfolios,
    payload?.portfolios,
    wave?.affected_portfolios,
    payload?.affected_portfolios,
  ]) {
    if (Array.isArray(candidate)) {
      return candidate.length;
    }
  }
  return 0;
}

function extractDpmWaveSourceRefs(response) {
  const sourceRefs = [];
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }
    if (Array.isArray(candidate.source_refs)) {
      sourceRefs.push(
        ...candidate.source_refs.filter(
          (item) => item && typeof item === "object",
        ),
      );
    }
    for (const value of Object.values(candidate)) {
      if (value && typeof value === "object") {
        visit(value);
      }
    }
  };
  visit(response);
  return sourceRefs;
}

function hasCoreDpmPortfolioUniverseSourceRef(response) {
  return extractDpmWaveSourceRefs(response).some((sourceRef) => {
    const sourceSystem = readString(sourceRef.source_system)?.toLowerCase();
    const sourceType = readString(sourceRef.source_type);
    return (
      sourceSystem === "lotus-core" &&
      sourceType === "DpmPortfolioUniverseCandidate"
    );
  });
}

function payloadTextIncludes(payload, expectedText) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return text.includes(expectedText);
}

function extractWorkbenchRebalanceRunId(gatewayOverview) {
  const snapshot = gatewayOverview?.rebalance_snapshot;
  const latestRunId = readString(snapshot?.last_rebalance_run_id);
  if (latestRunId) {
    return latestRunId;
  }
  const recentRuns = Array.isArray(snapshot?.recent_runs)
    ? snapshot.recent_runs
    : [];
  const recentRun = recentRuns.find((item) =>
    readString(item?.rebalance_run_id),
  );
  return readString(recentRun?.rebalance_run_id);
}

function recordArrayCount(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object").length
    : 0;
}

function recordMapCount(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  return Object.values(value).filter((item) => {
    if (typeof item === "string") {
      return item.trim().length > 0;
    }
    return item !== null && item !== undefined;
  }).length;
}

function sourceEvidenceCount(proofPackPayload) {
  const sourceHashCount =
    recordArrayCount(proofPackPayload.source_hashes) ||
    recordMapCount(proofPackPayload.source_hashes);
  const lineageCount = recordArrayCount(proofPackPayload.source_lineage);
  return sourceHashCount + lineageCount;
}

function isReviewableProofPackState(state) {
  const normalized = readString(state)?.toUpperCase();
  return (
    normalized === "READY" ||
    normalized === "PENDING_REVIEW" ||
    normalized === "DEGRADED" ||
    normalized === "BLOCKED"
  );
}

function extractWorkflowPackRunId(payload) {
  return (
    readString(payload?.run_id) ||
    readString(payload?.workflow_run_id) ||
    readString(payload?.workflow_pack_run?.run_id) ||
    readString(payload?.execution?.audit?.workflow_pack_run_id) ||
    readString(payload?.audit?.workflow_pack_run_id) ||
    null
  );
}

function buildPmQualitySourceRef({
  sourceSystem,
  sourceType,
  sourceId,
  sourceVersion,
  contentHash,
}) {
  return {
    source_system: sourceSystem,
    source_type: sourceType,
    source_id: sourceId,
    source_version: sourceVersion,
    content_hash: contentHash,
  };
}

function buildCanonicalPmQualityPolicy(asOfDate) {
  return {
    tenant_id: dpmCommandCenterDefaults.workbenchCallerTenantId,
    policy_id: "pmq_canonical_dpm",
    policy_version: "2026.05",
    enabled: true,
    as_of_date: asOfDate,
    access_purpose: "SUPERVISORY_CONTROL_REVIEW",
    weights: [
      {
        indicator: "OUTCOME_DISCIPLINE",
        weight: "70",
        minimum_evidence_count: 1,
      },
      {
        indicator: "SOURCE_QUALITY",
        weight: "30",
        minimum_evidence_count: 1,
      },
    ],
    governance_approval: {
      approval_ref: "PMQ-CANONICAL-APPROVAL-2026-05",
      approved_by: "pm_quality_committee",
      approved_at: "2026-05-03T09:00:00Z",
      fairness_review_ref: "PMQ-CANONICAL-FAIRNESS-2026-05",
      fairness_reviewed_by: "model_risk_governance",
      fairness_reviewed_at: "2026-05-03T10:00:00Z",
      expires_on: "2026-06-30",
      entitled_actor_ids: [
        "workbench-system",
        "workbench-pm-operating-quality-supervisor",
        "ops",
      ],
      source_refs: [
        buildPmQualitySourceRef({
          sourceSystem: "bank-governance",
          sourceType: "PM_QUALITY_POLICY_APPROVAL",
          sourceId: "PMQ-CANONICAL-APPROVAL-2026-05",
          sourceVersion: "2026.05",
          contentHash: "sha256:pmq-canonical-approval",
        }),
      ],
    },
  };
}

function buildCanonicalPmQualityScoreRunRequest(asOfDate) {
  const outcomeDisciplineSourceRef = buildPmQualitySourceRef({
    sourceSystem: "lotus-manage",
    sourceType: "DPM_OUTCOME_REVIEW_POSTURE",
    sourceId: "canonical-outcome-review-posture",
    sourceVersion: asOfDate,
    contentHash: "sha256:pmq-canonical-outcome",
  });
  const sourceQualitySourceRef = buildPmQualitySourceRef({
    sourceSystem: "lotus-core",
    sourceType: "PortfolioManagerBookMembership",
    sourceId: dpmCommandCenterDefaults.bookId,
    sourceVersion: asOfDate,
    contentHash: "sha256:pmq-canonical-source-quality",
  });

  return {
    pm_id: dpmCommandCenterDefaults.portfolioManagerId,
    book_id: dpmCommandCenterDefaults.bookId,
    as_of_date: asOfDate,
    policy: buildCanonicalPmQualityPolicy(asOfDate),
    evidence_items: [
      {
        indicator: "OUTCOME_DISCIPLINE",
        evidence_state: "READY",
        score: "92",
        source_system: "lotus-manage",
        source_type: "DPM_OUTCOME_REVIEW_POSTURE",
        source_id: "canonical-outcome-review-posture",
        source_refs: [outcomeDisciplineSourceRef],
      },
      {
        indicator: "SOURCE_QUALITY",
        evidence_state: "READY",
        score: "88",
        source_system: "lotus-core",
        source_type: "PortfolioManagerBookMembership",
        source_id: dpmCommandCenterDefaults.bookId,
        source_refs: [sourceQualitySourceRef],
      },
    ],
    actor_id: "workbench-system",
  };
}

function extractPmQualityScoreRunId(response) {
  const data = extractGatewayEnvelopeData(response);
  return (
    readString(data?.score_run?.score_run_id) ||
    readString(data?.score_run_id) ||
    readString(data?.score_runs?.[0]?.score_run_id) ||
    readString(response?.supportability?.score_run_id) ||
    null
  );
}

function extractPmQualityScoreRunState(response, scoreRunId) {
  const data = extractGatewayEnvelopeData(response);
  const candidates = [
    data?.score_run,
    ...(Array.isArray(data?.score_runs) ? data.score_runs : []),
  ];
  const selected = candidates.find(
    (candidate) => readString(candidate?.score_run_id) === scoreRunId,
  );
  return readString(selected?.state) || null;
}

function extractPmQualityFairnessAnalysisId(response) {
  const data = extractGatewayEnvelopeData(response);
  return (
    readString(data?.fairness_analysis?.fairness_analysis_id) ||
    readString(data?.fairness_analysis_id) ||
    readString(data?.fairness_analyses?.[0]?.fairness_analysis_id) ||
    readString(response?.supportability?.fairness_analysis_id) ||
    null
  );
}

function extractPmQualityFairnessAnalysisState(response, fairnessAnalysisId) {
  const data = extractGatewayEnvelopeData(response);
  const candidates = [
    data?.fairness_analysis,
    ...(Array.isArray(data?.fairness_analyses) ? data.fairness_analyses : []),
  ];
  const selected = candidates.find(
    (candidate) =>
      readString(candidate?.fairness_analysis_id) === fairnessAnalysisId,
  );
  return readString(selected?.state) || null;
}

function extractPmQualityReviewActionId(response) {
  const data = extractGatewayEnvelopeData(response);
  return (
    readString(data?.review_action?.review_action_id) ||
    readString(data?.review_action_id) ||
    readString(data?.review_actions?.[0]?.review_action_id) ||
    readString(response?.supportability?.review_action_id) ||
    null
  );
}

function extractPmQualitySummaryInvocationId(response) {
  const data = extractGatewayEnvelopeData(response);
  return (
    readString(data?.summary_invocation?.summary_invocation_id) ||
    readString(data?.summary_invocation_id) ||
    readString(data?.summary_invocations?.[0]?.summary_invocation_id) ||
    readString(response?.supportability?.summary_invocation_id) ||
    null
  );
}

async function ensureCanonicalPmOperatingQualityEvidence() {
  const asOfDate = dpmCommandCenterDefaults.asOfDate;
  const pmQualityBaseUrl = `${gatewayBaseUrl}/api/v1/dpm/command-center/pm-operating-quality`;
  const sendPmQualityJson = (url, description, { method = "GET", body } = {}) =>
    sendDpmCommandCenterJson(url, description, {
      method,
      body,
    });
  const scoreRunRequest = buildCanonicalPmQualityScoreRunRequest(asOfDate);
  const scoreRunResponse = await sendPmQualityJson(
    `${pmQualityBaseUrl}/score-runs`,
    "DPM PM operating-quality score-run create",
    { method: "POST", body: { body: scoreRunRequest } },
  );
  const scoreRunId = extractPmQualityScoreRunId(scoreRunResponse);
  if (!scoreRunId) {
    throw new Error(
      "DPM PM operating-quality score-run create returned no score-run id.",
    );
  }

  const bookSourceRef = buildPmQualitySourceRef({
    sourceSystem: "lotus-core",
    sourceType: "PortfolioManagerBookMembership",
    sourceId: dpmCommandCenterDefaults.bookId,
    sourceVersion: asOfDate,
    contentHash: "sha256:pmq-canonical-source-quality",
  });
  const fairnessResponse = await sendPmQualityJson(
    `${pmQualityBaseUrl}/fairness-analyses`,
    "DPM PM operating-quality fairness-analysis create",
    {
      method: "POST",
      body: {
        body: {
          policy_id: "pmq_canonical_dpm",
          policy_version: "2026.05",
          as_of_date: asOfDate,
          actor_id: "workbench-system",
          minimum_segment_score_run_count: 1,
          maximum_average_score_spread: "5.00",
          segments: [
            {
              segment_id: "canonical_sg_dpm_balanced",
              segment_type: "BOOK_PROFILE",
              display_name: "Singapore DPM balanced book",
              score_run_ids: [scoreRunId],
              source_refs: [bookSourceRef],
            },
            {
              segment_id: "canonical_apac_balanced",
              segment_type: "REGION",
              display_name: "APAC balanced DPM",
              score_run_ids: [scoreRunId],
              source_refs: [bookSourceRef],
            },
          ],
        },
      },
    },
  );
  const fairnessAnalysisId =
    extractPmQualityFairnessAnalysisId(fairnessResponse);
  if (!fairnessAnalysisId) {
    throw new Error(
      "DPM PM operating-quality fairness-analysis create returned no fairness-analysis id.",
    );
  }

  const reviewResponse = await sendPmQualityJson(
    `${pmQualityBaseUrl}/review-actions`,
    "DPM PM operating-quality review-action create",
    {
      method: "POST",
      body: {
        body: {
          target_type: "SCORE_RUN",
          target_id: scoreRunId,
          action_type: "ACKNOWLEDGE",
          action_state: "REVIEW_REQUIRED",
          review_action_ref: `PMQ-CANONICAL-REVIEW-${scoreRunId}`,
          review_reason:
            "Canonical live validation recorded bounded supervisory review evidence.",
          actor_id: "workbench-system",
          policy_id: "pmq_canonical_dpm",
          policy_version: "2026.05",
          as_of_date: asOfDate,
          source_refs: [
            buildPmQualitySourceRef({
              sourceSystem: "lotus-workbench",
              sourceType: "CANONICAL_FRONT_OFFICE_VALIDATION",
              sourceId: "rfc36-43-audit-20260524",
              sourceVersion: "2026-05-24",
              contentHash: "sha256:pmq-canonical-review",
            }),
          ],
        },
      },
    },
  );
  const reviewActionId = extractPmQualityReviewActionId(reviewResponse);
  if (!reviewActionId) {
    throw new Error(
      "DPM PM operating-quality review-action create returned no review-action id.",
    );
  }

  const summaryResponse = await sendPmQualityJson(
    `${pmQualityBaseUrl}/summary-invocations`,
    "DPM PM operating-quality summary-invocation create",
    {
      method: "POST",
      body: {
        body: {
          score_run_id: scoreRunId,
          review_action_id: reviewActionId,
          invocation_state: "COMPLETED",
          summary_ref: `PMQ-CANONICAL-SUMMARY-${scoreRunId}`,
          workflow_pack_name: "pm_quality_summary.pack",
          workflow_pack_version: "v1",
          workflow_run_id: `pmq-canonical-summary-${scoreRunId}`,
          summary_artifact_ref: `pmq-canonical-summary-artifact-${scoreRunId}`,
          summary_content_hash: "sha256:pmq-canonical-summary",
          requested_by: "workbench-system",
          source_refs: [
            buildPmQualitySourceRef({
              sourceSystem: "lotus-ai",
              sourceType: "pm_quality_summary.pack",
              sourceId: `pmq-canonical-summary-${scoreRunId}`,
              sourceVersion: "v1",
              contentHash: "sha256:pmq-canonical-summary",
            }),
          ],
        },
      },
    },
  );
  const summaryInvocationId =
    extractPmQualitySummaryInvocationId(summaryResponse);
  if (!summaryInvocationId) {
    throw new Error(
      "DPM PM operating-quality summary-invocation create returned no summary-invocation id.",
    );
  }

  const scoreRunList = await sendPmQualityJson(
    `${pmQualityBaseUrl}/score-runs?book_id=${encodeURIComponent(
      dpmCommandCenterDefaults.bookId,
    )}&as_of_date=${encodeURIComponent(asOfDate)}&limit=10&offset=0`,
    "DPM PM operating-quality score-run list",
  );
  const reviewActionList = await sendPmQualityJson(
    `${pmQualityBaseUrl}/review-actions?target_type=SCORE_RUN&target_id=${encodeURIComponent(
      scoreRunId,
    )}&as_of_date=${encodeURIComponent(asOfDate)}&limit=10&offset=0`,
    "DPM PM operating-quality review-action list",
  );
  const fairnessAnalysisList = await sendPmQualityJson(
    `${pmQualityBaseUrl}/fairness-analyses?policy_id=pmq_canonical_dpm&policy_version=2026.05&as_of_date=${encodeURIComponent(
      asOfDate,
    )}&limit=10&offset=0`,
    "DPM PM operating-quality fairness-analysis list",
  );
  const summaryInvocationList = await sendPmQualityJson(
    `${pmQualityBaseUrl}/summary-invocations?score_run_id=${encodeURIComponent(
      scoreRunId,
    )}&review_action_id=${encodeURIComponent(reviewActionId)}&as_of_date=${encodeURIComponent(
      asOfDate,
    )}&limit=10&offset=0`,
    "DPM PM operating-quality summary-invocation list",
  );
  if (extractPmQualityScoreRunId(scoreRunList) !== scoreRunId) {
    throw new Error(
      "DPM PM operating-quality score-run list did not return the seeded score run.",
    );
  }
  const scoreRunState = extractPmQualityScoreRunState(scoreRunList, scoreRunId);
  if (scoreRunState !== "READY") {
    throw new Error(
      `DPM PM operating-quality score run ${scoreRunId} is not ready: ${scoreRunState ?? "missing state"}.`,
    );
  }
  if (extractPmQualityReviewActionId(reviewActionList) !== reviewActionId) {
    throw new Error(
      "DPM PM operating-quality review-action list did not return the seeded review action.",
    );
  }
  if (
    extractPmQualityFairnessAnalysisId(fairnessAnalysisList) !==
    fairnessAnalysisId
  ) {
    throw new Error(
      "DPM PM operating-quality fairness-analysis list did not return the seeded analysis.",
    );
  }
  const fairnessAnalysisState = extractPmQualityFairnessAnalysisState(
    fairnessAnalysisList,
    fairnessAnalysisId,
  );
  if (fairnessAnalysisState !== "READY") {
    throw new Error(
      `DPM PM operating-quality fairness analysis ${fairnessAnalysisId} is not ready: ${fairnessAnalysisState ?? "missing state"}.`,
    );
  }
  if (
    extractPmQualitySummaryInvocationId(summaryInvocationList) !==
    summaryInvocationId
  ) {
    throw new Error(
      "DPM PM operating-quality summary-invocation list did not return the seeded invocation.",
    );
  }

  return {
    scoreRunId,
    scoreRunState,
    fairnessAnalysisId,
    fairnessAnalysisState,
    reviewActionId,
    summaryInvocationId,
    asOfDate,
    tenantId: dpmCommandCenterDefaults.workbenchCallerTenantId,
  };
}

const dpmCommandCenterCallerHeaders = Object.freeze({
  "X-Tenant-Id": dpmCommandCenterDefaults.workbenchCallerTenantId,
});

function sendDpmCommandCenterJson(
  url,
  description,
  { method = "GET", body } = {},
) {
  return sendJson(summary, url, description, timeoutMs, {
    method,
    body,
    headers: dpmCommandCenterCallerHeaders,
  });
}

function fetchDpmCommandCenterJson(url, description) {
  return sendDpmCommandCenterJson(url, description);
}

function postDpmCommandCenterJson(url, description, body) {
  return sendDpmCommandCenterJson(url, description, {
    method: "POST",
    body,
  });
}

function postDpmCommandCenterJsonExpectingStatus(
  url,
  description,
  expectedStatus,
  body,
) {
  return sendJsonExpectingStatus(
    summary,
    url,
    description,
    timeoutMs,
    expectedStatus,
    {
      method: "POST",
      body,
      headers: dpmCommandCenterCallerHeaders,
    },
  );
}

async function fetchOptionalDpmCommandCenterJson(description, url) {
  try {
    return await fetchDpmCommandCenterJson(url, description);
  } catch (error) {
    summary.apiChecks.push({
      description,
      url,
      status: "seed_gap",
      kind: "json",
      method: "GET",
      warning: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function run() {
  await ensureDirectory(outputDir);

  const dnsChecks = await Promise.all([
    checkDns(summary, "workbench.dev.lotus"),
    checkDns(summary, "gateway.dev.lotus"),
    checkDns(summary, "core-query.dev.lotus"),
    checkDns(summary, "core-control.dev.lotus"),
    checkDns(summary, "core-ingestion.dev.lotus"),
    checkDns(summary, "performance.dev.lotus"),
    checkDns(summary, "risk.dev.lotus"),
    checkDns(summary, "advise.dev.lotus"),
    checkDns(summary, "manage.dev.lotus"),
    checkDns(summary, "report.dev.lotus"),
    checkDns(summary, "archive.dev.lotus"),
    checkDns(summary, "render.dev.lotus"),
    checkDns(summary, "ai.dev.lotus", { required: false }),
  ]);

  dnsChecks
    .filter((item) => !item.ok)
    .forEach((item) => console.warn(item.warning));

  const portfolioWorkspace = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/portfolio/portfolios/${portfolioId}/workspace`,
    "Portfolio workspace",
    timeoutMs,
  );
  if (portfolioWorkspace?.portfolio?.portfolio_id !== portfolioId) {
    throw new Error(`Portfolio workspace did not resolve ${portfolioId}.`);
  }

  const performanceSummaryUrl = `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/performance/summary?${canonicalPerformanceQuery()}`;
  const performanceSummary = await fetchJsonUntil(
    summary,
    performanceSummaryUrl,
    "Performance summary evidence readiness",
    timeoutMs,
    (payload) =>
      payload?.capabilities?.evidence?.state === "supported"
        ? true
        : `evidence state is ${payload?.capabilities?.evidence?.state ?? "missing"}`,
  );
  if (!performanceSummary?.portfolio_id) {
    throw new Error("Performance summary returned no portfolio payload.");
  }

  const performanceDetailsUrl = `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/performance/details?${canonicalPerformanceQuery()}`;
  const performanceDetails = await fetchJsonUntil(
    summary,
    performanceDetailsUrl,
    "Performance details contribution readiness",
    timeoutMs,
    (payload) => {
      const rows = payload?.contribution?.levels?.[0]?.rows;
      if (
        payload?.capabilities?.contribution_detail?.state === "supported" &&
        Array.isArray(rows) &&
        rows.length >= 4
      ) {
        return true;
      }
      return `contribution_detail state is ${
        payload?.capabilities?.contribution_detail?.state ?? "missing"
      }; rows=${Array.isArray(rows) ? rows.length : "non-array"}`;
    },
  );
  if (!performanceDetails?.portfolio_id) {
    throw new Error("Performance details returned no portfolio payload.");
  }

  const riskSummary = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/risk/summary?${canonicalRiskQuery()}`,
    "Risk summary",
    timeoutMs,
  );
  if (!riskSummary?.portfolio_id) {
    throw new Error("Risk summary returned no portfolio payload.");
  }

  const riskConcentration = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/risk/concentration?${canonicalRiskQuery({ detailBasis: "NET" })}`,
    "Risk concentration",
    timeoutMs,
  );
  const riskDrawdown = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/risk/drawdown?${canonicalRiskQuery({ params: { include_underwater_series: "true" } })}`,
    "Risk drawdown",
    timeoutMs,
  );
  const riskRolling = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/risk/rolling?${canonicalRiskQuery({ params: { include_time_series: "true" } })}`,
    "Risk rolling",
    timeoutMs,
  );
  const riskAttribution = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/risk/attribution?${canonicalRiskQuery({ params: { attribution_type: "total_risk", grouping_dimension: "sector" } })}`,
    "Risk attribution",
    timeoutMs,
  );
  for (const [description, payload] of [
    ["Risk concentration", riskConcentration],
    ["Risk drawdown", riskDrawdown],
    ["Risk rolling", riskRolling],
    ["Risk attribution", riskAttribution],
  ]) {
    if (payload?.state !== "ready") {
      throw new Error(
        `${description} returned non-ready state: ${String(payload?.state)}.`,
      );
    }
  }
  assertPerformanceCalculationSanity({
    summary,
    performanceSummary,
    performanceDetails,
    recordPanelClassification: panelGovernance.recordPanelClassification,
  });
  assertRiskCalculationSanity({
    summary,
    riskSummary,
    concentration: riskConcentration,
    drawdown: riskDrawdown,
    rolling: riskRolling,
    attribution: riskAttribution,
    recordPanelClassification: panelGovernance.recordPanelClassification,
  });

  const advisorBrief = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/performance/advisor-brief?${canonicalPerformanceQuery()}`,
    "Advisor brief",
    timeoutMs,
  );
  if (!advisorBrief?.summary) {
    throw new Error("Advisor brief returned no summary.");
  }
  if (!advisorBrief?.workflow_pack_run?.run_id) {
    throw new Error("Advisor brief returned no workflow-pack run identity.");
  }
  summary.workflowPackChecks.push({
    actionType: "INITIAL_VISIBLE",
    route: `/api/v1/workbench/${portfolioId}/performance/advisor-brief?${canonicalPerformanceQuery()}`,
    sourceRunId: advisorBrief.workflow_pack_run.run_id,
    resultReviewState: advisorBrief.workflow_pack_run.review_state,
    resultSupportabilityStatus:
      advisorBrief.workflow_pack_run.supportability_status,
  });

  const advisoryScenario =
    canonicalContract.advisoryProposalScenarios ??
    DEFAULT_CANONICAL_CONTRACT.advisoryProposalScenarios;
  const proposalScenario = advisoryScenario.proposal;
  const proposalCreateBody = {
    body: {
      created_by: proposalScenario.createdBy,
      input_mode: "stateful",
      stateful_input: {
        portfolio_id: portfolioId,
        as_of: canonicalAsOfDate,
        narrative_request: proposalScenario.narrativeRequest,
      },
      metadata: {
        title: proposalScenario.title,
        advisor_notes: proposalScenario.advisorNotes,
        jurisdiction: proposalScenario.jurisdiction,
        canonical_scenario_id: advisoryScenario.scenarioId,
      },
    },
  };
  const proposalCreateIdempotencyKey = buildRuntimeScopedIdempotencyKey(
    "wb-canonical-narrative",
    canonicalRuntimeGeneration,
    proposalCreateBody,
  );
  const proposalCreate = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/proposals`,
    "Create proposal narrative canonical proof",
    timeoutMs,
    {
      method: "POST",
      body: proposalCreateBody,
      headers: {
        "Idempotency-Key": proposalCreateIdempotencyKey,
      },
    },
  );
  const proposalCreateData = extractGatewayEnvelopeData(proposalCreate);
  const proposalId = readString(proposalCreateData?.proposal?.proposal_id);
  const proposalVersionNo = proposalCreateData?.version?.version_no ?? null;
  const proposalVersionId = readString(
    proposalCreateData?.version?.proposal_version_id,
  );
  const proposalNarrative =
    proposalCreateData?.version?.artifact?.proposal_narrative;
  if (!proposalId || !proposalVersionId || !proposalNarrative?.narrative_id) {
    throw new Error(
      "Canonical proposal narrative proof did not create a narrative proposal.",
    );
  }
  summary.workflowPackChecks.push({
    actionType: "PROPOSAL_NARRATIVE_CREATED",
    route: `/api/v1/proposals`,
    sourceRunId: proposalNarrative.narrative_id,
    resultReviewState: proposalNarrative.review_state,
    resultSupportabilityStatus: proposalNarrative.generation_mode,
    proposalId,
    versionNo: proposalVersionNo,
  });

  const policyEvaluationProof = await createCanonicalPolicyEvaluation({
    summary,
    scenario: advisoryScenario.policyEvaluation,
    gatewayBaseUrl,
    proposalId,
    proposalVersionId,
    timeoutMs,
  });
  const advisorCockpitProof = await validateCanonicalAdvisorCockpit({
    summary,
    scenario: advisoryScenario.advisorCockpit,
    gatewayBaseUrl,
    portfolioId,
    proposalId,
    proposalVersionId,
    timeoutMs,
  });
  const advisoryCopilotProof = await validateCanonicalAdvisoryCopilot({
    summary,
    scenario: advisoryScenario.advisoryCopilot,
    gatewayBaseUrl,
    portfolioId,
    proposalId,
    proposalVersionId,
    proposalVersionNo,
    authority: policyEvaluationProof.authority,
    timeoutMs,
  });
  const bankDemoProofScenario = advisoryScenario.bankDemoProof;
  const bankDemoScenarioContract = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory/bank-demo-proof/scenario-contract`,
    "RFC-0028 bank demo scenario contract",
    timeoutMs,
  );
  const bankDemoScenarioData = extractGatewayEnvelopeData(
    bankDemoScenarioContract,
  );
  if (bankDemoScenarioData?.scenario_id !== bankDemoProofScenario.scenarioId) {
    throw new Error(
      "RFC-0028 bank demo scenario contract did not return the governed scenario id.",
    );
  }
  if (
    bankDemoScenarioData?.proof_marker !==
    bankDemoProofScenario.expectedProofMarker
  ) {
    throw new Error(
      "RFC-0028 bank demo scenario contract did not return the governed proof marker.",
    );
  }
  const bankDemoClaimRegister = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisory/bank-demo-proof/supported-claim-register`,
    "RFC-0028 bank demo supported-claim register",
    timeoutMs,
  );
  const bankDemoClaimData = extractGatewayEnvelopeData(bankDemoClaimRegister);
  const bankDemoClaimPostures = new Map(
    (bankDemoClaimData?.claims ?? []).map((claim) => [
      claim.claim_id,
      claim.classification,
    ]),
  );
  for (const [claimId, expectedPosture] of Object.entries(
    bankDemoProofScenario.expectedClaimPostures,
  )) {
    if (bankDemoClaimPostures.get(claimId) !== expectedPosture) {
      throw new Error(
        `RFC-0028 supported claim ${claimId} returned ${bankDemoClaimPostures.get(
          claimId,
        )}; expected ${expectedPosture}.`,
      );
    }
  }
  summary.uiChecks.push({
    description: "RFC-0028 bank demo proof Gateway contracts",
    kind: "bank-demo-proof-contracts",
    scenarioId: bankDemoScenarioData.scenario_id,
    proofMarker: bankDemoScenarioData.proof_marker,
    claimCount: bankDemoClaimData?.claims?.length ?? 0,
    clientReadyPublication:
      bankDemoProofScenario.expectedClientReadyPublication.toLowerCase(),
  });

  const manageSupportabilitySummary = await fetchJson(
    summary,
    "http://manage.dev.lotus/api/v1/rebalance/supportability/summary",
    "lotus-manage supportability summary",
    timeoutMs,
  );
  const manageSupportabilityState = readSupportabilityState(
    manageSupportabilitySummary?.supportability,
  );
  if (!manageSupportabilityState) {
    throw new Error(
      "lotus-manage supportability summary returned no bounded supportability state.",
    );
  }
  summary.sourceSupportability = {
    ...(summary.sourceSupportability ?? {}),
    lotusManageActionRegister: {
      state: manageSupportabilityState,
      reason: readString(manageSupportabilitySummary?.supportability?.reason),
      freshnessBucket: readString(
        manageSupportabilitySummary?.supportability?.freshness_bucket,
      ),
      runCount: manageSupportabilitySummary?.supportability?.run_count ?? null,
      operationCount:
        manageSupportabilitySummary?.supportability?.operation_count ?? null,
      workflowDecisionCount:
        manageSupportabilitySummary?.supportability?.workflow_decision_count ??
        null,
    },
  };

  const outcomeReviews = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/outcome-reviews?portfolio_id=${portfolioId}&limit=5`,
    "DPM outcome reviews",
  );
  const outcomeReviewItems =
    outcomeReviews?.data?.items ?? outcomeReviews?.items ?? [];
  if (!Array.isArray(outcomeReviewItems) || outcomeReviewItems.length < 1) {
    throw new Error(
      "DPM outcome-review list returned no manage-backed reviews.",
    );
  }
  const gatewayOverview = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/workbench/${portfolioId}/overview`,
    "Gateway workbench overview",
    timeoutMs,
  );
  if (gatewayOverview?.portfolio?.portfolio_id !== portfolioId) {
    throw new Error(
      "Gateway workbench overview returned no portfolio payload.",
    );
  }
  const proofPackSourceReview = outcomeReviewItems.find((item) =>
    readString(item?.mandate_id),
  );
  const rebalanceRunId = extractWorkbenchRebalanceRunId(gatewayOverview);
  if (!rebalanceRunId) {
    throw new Error(
      "Gateway workbench overview returned no manage rebalance-run reference for proof-pack generation.",
    );
  }
  const proofPackRequestBody = {
    source_type: "REBALANCE_RUN",
    rebalance_run_id: rebalanceRunId,
    mandate_id: readString(proofPackSourceReview?.mandate_id) ?? undefined,
    include_markdown: true,
    include_report_input: true,
    include_ai_evidence_input: true,
    actor_id: "workbench-proof-pack-operator",
    reason:
      "Workbench PM generated proof pack from Gateway-backed rebalance run.",
  };
  const proofPackIdempotencyKey = buildPayloadScopedIdempotencyKey(
    "wb-proof-pack",
    proofPackRequestBody,
  );
  const generatedProofPack = await postDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/proof-packs`,
    "Generate DPM proof-pack evidence",
    {
      idempotency_key: proofPackIdempotencyKey,
      body: proofPackRequestBody,
    },
  );
  const proofPackId = extractGeneratedProofPackId(generatedProofPack);
  if (!proofPackId) {
    throw new Error(
      "DPM proof-pack generation returned no proof-pack reference.",
    );
  }
  const proofPack = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/proof-packs/${encodeURIComponent(proofPackId)}`,
    "DPM proof-pack evidence",
  );
  const proofPackPayload =
    proofPack?.data?.proof_pack ?? proofPack?.data ?? proofPack;
  if (!proofPackPayload?.proof_pack_id) {
    throw new Error("DPM proof-pack evidence returned no proof-pack identity.");
  }
  const proofPackSectionCount = recordArrayCount(
    proofPackPayload.sections ?? proofPackPayload.section_posture,
  );
  const proofPackSourceHashCount = sourceEvidenceCount(proofPackPayload);
  if (proofPackSectionCount < 1) {
    throw new Error(
      "DPM proof-pack evidence returned no reviewable proof-pack sections.",
    );
  }
  if (proofPackSourceHashCount < 1) {
    throw new Error(
      "DPM proof-pack evidence returned no source hashes or lineage references.",
    );
  }
  const proofPackSupportability = proofPack?.supportability;
  if (
    proofPackSupportability?.state &&
    !isReviewableProofPackState(proofPackSupportability.state)
  ) {
    throw new Error(
      `DPM proof-pack evidence returned non-reviewable state: ${proofPackSupportability.state}.`,
    );
  }
  const proofPackAiPmMemo = await postDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/proof-packs/${encodeURIComponent(proofPackId)}/ai-pm-memo`,
    "DPM proof-pack AI PM memo",
    {
      requested_outputs: ["pm_memo", "rationale_summary", "evidence_gaps"],
      audience: ["portfolio_manager", "investment_control"],
    },
  );
  const proofPackAiPmMemoPayload = proofPackAiPmMemo?.data ?? proofPackAiPmMemo;
  const proofPackAiPmMemoSourceService =
    readString(proofPackAiPmMemo?.source_service) ??
    readString(proofPackAiPmMemo?.sourceService);
  if (proofPackAiPmMemoSourceService !== "lotus-ai") {
    throw new Error(
      "DPM proof-pack AI PM memo did not return lotus-ai source authority.",
    );
  }
  const proofPackAiPmMemoRunId = extractWorkflowPackRunId(
    proofPackAiPmMemoPayload,
  );
  if (!proofPackAiPmMemoRunId) {
    throw new Error(
      "DPM proof-pack AI PM memo returned no workflow-pack run reference.",
    );
  }
  summary.workflowPackChecks.push({
    description: "DPM proof-pack AI PM memo",
    sourceService: proofPackAiPmMemoSourceService,
    proofPackId,
    sourceRunId: proofPackAiPmMemoRunId,
    resultReviewState:
      proofPackAiPmMemoPayload?.workflow_pack_run?.review_state ??
      proofPackAiPmMemoPayload?.execution?.review_state ??
      "unknown",
    resultSupportabilityStatus:
      proofPackAiPmMemoPayload?.workflow_pack_run?.supportability_status ??
      proofPackAiPmMemoPayload?.execution?.supportability_status ??
      "unknown",
  });

  const commandCenterParams = new URLSearchParams({
    tenant_id: dpmCommandCenterDefaults.tenantId,
    portfolio_manager_id: dpmCommandCenterDefaults.portfolioManagerId,
    book_id: dpmCommandCenterDefaults.bookId,
    as_of_date: dpmCommandCenterDefaults.asOfDate,
    limit: "25",
  });
  const dpmCommandCenter = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center?${commandCenterParams.toString()}`,
    "DPM command-center summary",
  );
  const dpmCommandCenterPayload = dpmCommandCenter?.data ?? dpmCommandCenter;
  if (!dpmCommandCenterPayload?.supportability) {
    throw new Error(
      "DPM command-center summary returned no manage supportability envelope.",
    );
  }
  const dpmCommandCenterPanelState = classifyCommandCenterPanelState(
    dpmCommandCenterPayload,
  );
  if (!["ready", "partial"].includes(dpmCommandCenterPanelState)) {
    throw new Error(
      `DPM command-center summary did not return canonical populated posture; observed ${dpmCommandCenterPanelState}.`,
    );
  }

  const portfolioMemory = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/portfolios/${encodeURIComponent(portfolioId)}/memory?limit=100`,
    "DPM portfolio memory",
  );
  const portfolioMemorySupportability = portfolioMemory?.supportability;
  const portfolioMemoryPayload = portfolioMemory?.data ?? portfolioMemory;
  const portfolioMemoryEvents = Array.isArray(portfolioMemoryPayload?.events)
    ? portfolioMemoryPayload.events
    : [];
  const portfolioMemoryState = readSupportabilityState(
    portfolioMemorySupportability,
  );
  const supportedPortfolioMemoryStates = new Set([
    "ready",
    "partial",
    "degraded",
    "blocked",
  ]);
  if (
    !supportedPortfolioMemoryStates.has(portfolioMemoryState?.toLowerCase())
  ) {
    throw new Error(
      `DPM portfolio memory did not return populated manage supportability; observed ${
        portfolioMemoryState ?? "missing"
      }.`,
    );
  }
  if (portfolioMemoryEvents.length < 1) {
    throw new Error(
      "DPM portfolio memory returned no manage-owned timeline events.",
    );
  }
  if (!readString(portfolioMemorySupportability?.content_hash)) {
    throw new Error("DPM portfolio memory returned no content hash.");
  }

  const dpmExceptions = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/exceptions?tenant_id=${encodeURIComponent(
      dpmCommandCenterDefaults.tenantId,
    )}&portfolio_manager_id=${encodeURIComponent(
      dpmCommandCenterDefaults.portfolioManagerId,
    )}&limit=25&state=ACTIVE`,
    "DPM command-center active exceptions",
  );
  const dpmExceptionItems =
    dpmExceptions?.data?.items ??
    dpmExceptions?.items ??
    dpmExceptions?.exceptions ??
    [];
  if (!Array.isArray(dpmExceptionItems)) {
    throw new Error("DPM command-center exceptions returned no list envelope.");
  }

  const dpmMandate = await fetchOptionalDpmCommandCenterJson(
    "DPM command-center mandate by portfolio",
    `${gatewayBaseUrl}/api/v1/dpm/command-center/mandates/by-portfolio/${portfolioId}`,
  );
  const dpmMandatePayload = dpmMandate?.data ?? dpmMandate;
  const mandateId =
    dpmMandatePayload?.mandate_id ??
    dpmMandatePayload?.mandateId ??
    dpmMandatePayload?.mandate?.mandate_id ??
    dpmMandatePayload?.mandate?.mandateId;

  let mandateHealthObserved = false;
  if (mandateId) {
    const dpmMandateHealth = await fetchDpmCommandCenterJson(
      `${gatewayBaseUrl}/api/v1/dpm/command-center/mandates/${encodeURIComponent(mandateId)}/health`,
      "DPM command-center mandate health",
    );
    const dpmMandateHealthPayload = dpmMandateHealth?.data ?? dpmMandateHealth;
    if (
      !dpmMandateHealthPayload?.health_state &&
      !dpmMandateHealthPayload?.state
    ) {
      throw new Error(
        "DPM command-center mandate health returned no health state.",
      );
    }
    mandateHealthObserved = true;
  }

  const dpmWaveParams = new URLSearchParams({
    trigger_type: "EXPLICIT_PORTFOLIO_LIST",
    as_of_date: dpmCommandCenterDefaults.asOfDate,
    limit: "10",
    offset: "0",
  });
  const dpmWaves = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/waves?${dpmWaveParams.toString()}`,
    "DPM rebalance waves",
  );
  const dpmWaveSupportability = dpmWaves?.supportability;
  if (!readSupportabilityState(dpmWaveSupportability)) {
    throw new Error(
      "DPM rebalance-wave list returned no manage supportability state.",
    );
  }
  const dpmWavePayload = dpmWaves?.data ?? dpmWaves;
  let dpmWaveId = extractDpmWaveId(dpmWavePayload);
  const dpmWavePreview = await postDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/waves/preview`,
    "DPM rebalance-wave preview",
    {
      body: {
        trigger_type: "EXPLICIT_PORTFOLIO_LIST",
        trigger_id: `live-validation-wave-${portfolioId}-${dpmCommandCenterDefaults.asOfDate}`,
        rationale:
          "Canonical Workbench live validation previewed an RFC-0041 rebalance wave.",
        as_of_date: dpmCommandCenterDefaults.asOfDate,
        actor_id: "workbench-system",
        portfolios: [{ portfolio_id: portfolioId }],
      },
    },
  );
  const dpmWavePreviewSupportability = dpmWavePreview?.supportability;
  const dpmWavePreviewSupportabilityState = readSupportabilityState(
    dpmWavePreviewSupportability,
  );
  if (dpmWavePreviewSupportabilityState?.toLowerCase() !== "ready") {
    throw new Error(
      `DPM rebalance-wave preview did not return ready manage supportability; observed ${
        dpmWavePreviewSupportabilityState ?? "missing"
      }.`,
    );
  }
  const multiPortfolioWaveScenario =
    canonicalContract.dpmCommandCenter?.multiPortfolioWaveScenario ??
    DEFAULT_CANONICAL_CONTRACT.dpmCommandCenter.multiPortfolioWaveScenario;
  const multiPortfolioWavePreview = await postDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/waves/preview`,
    "DPM rebalance-wave multi-portfolio preview",
    {
      body: {
        trigger_type: multiPortfolioWaveScenario.triggerType,
        trigger_id: `live-validation-wave-${multiPortfolioWaveScenario.scenarioId}-${dpmCommandCenterDefaults.asOfDate}`,
        rationale:
          "Canonical Workbench live validation previewed an RFC-0041 multi-portfolio explicit-list wave.",
        as_of_date: dpmCommandCenterDefaults.asOfDate,
        actor_id: "workbench-system",
        portfolios: multiPortfolioWaveScenario.portfolios,
      },
    },
  );
  const multiPortfolioWavePreviewSupportabilityState = readSupportabilityState(
    multiPortfolioWavePreview?.supportability,
  );
  if (multiPortfolioWavePreviewSupportabilityState?.toLowerCase() !== "ready") {
    throw new Error(
      `DPM rebalance-wave multi-portfolio preview did not return ready manage supportability; observed ${
        multiPortfolioWavePreviewSupportabilityState ?? "missing"
      }.`,
    );
  }
  const multiPortfolioWaveItemCount = extractDpmWaveItemCount(
    multiPortfolioWavePreview,
  );
  if (
    multiPortfolioWaveItemCount <
    multiPortfolioWaveScenario.minimumPortfolioCount
  ) {
    throw new Error(
      `DPM rebalance-wave multi-portfolio preview returned ${multiPortfolioWaveItemCount} item(s); expected at least ${multiPortfolioWaveScenario.minimumPortfolioCount}.`,
    );
  }
  const coreCandidateSourcePreviewBody = {
    trigger_type: "BULK_REVIEW_CAMPAIGN",
    trigger_id: `live-validation-core-candidates-${dpmCommandCenterDefaults.asOfDate}`,
    rationale:
      "Canonical Workbench live validation previewed bounded Core-owned DPM candidate discovery.",
    as_of_date: dpmCommandCenterDefaults.asOfDate,
    actor_id: "workbench-system",
    campaign_candidate_source: "CORE_DPM_PORTFOLIO_UNIVERSE",
    model_portfolio_ids: ["MODEL_PB_SG_GLOBAL_BAL_DPM"],
    include_inactive_mandates: false,
    campaign_candidate_page_size: 500,
  };
  const coreCandidateSourcePreview = await postDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/waves/preview`,
    "DPM Core candidate-source wave preview",
    {
      body: coreCandidateSourcePreviewBody,
    },
  );
  const coreCandidateSourcePreviewState = readSupportabilityState(
    coreCandidateSourcePreview?.supportability,
  );
  if (coreCandidateSourcePreviewState?.toLowerCase() !== "ready") {
    throw new Error(
      `DPM Core candidate-source preview did not return ready manage supportability; observed ${
        coreCandidateSourcePreviewState ?? "missing"
      }.`,
    );
  }
  const coreCandidateSourceItemCount = extractDpmWaveItemCount(
    coreCandidateSourcePreview,
  );
  if (coreCandidateSourceItemCount < 1) {
    throw new Error(
      "DPM Core candidate-source preview returned no candidate portfolios.",
    );
  }
  if (!hasCoreDpmPortfolioUniverseSourceRef(coreCandidateSourcePreview)) {
    throw new Error(
      "DPM Core candidate-source preview did not preserve lotus-core DpmPortfolioUniverseCandidate source refs.",
    );
  }
  const coreCandidateSourceRejected =
    await postDpmCommandCenterJsonExpectingStatus(
      `${gatewayBaseUrl}/api/v1/dpm/command-center/waves/preview`,
      "DPM Core candidate-source rejects caller portfolios",
      422,
      {
        body: {
          ...coreCandidateSourcePreviewBody,
          trigger_id: `${coreCandidateSourcePreviewBody.trigger_id}-invalid-mixed-request`,
          portfolios: [{ portfolio_id: portfolioId }],
        },
      },
    );
  if (
    !payloadTextIncludes(
      coreCandidateSourceRejected,
      "CORE_DPM_PORTFOLIO_UNIVERSE candidate discovery supplies the portfolio set",
    ) ||
    !payloadTextIncludes(
      coreCandidateSourceRejected,
      "DpmPortfolioUniverseCandidate:v1",
    )
  ) {
    throw new Error(
      "DPM Core candidate-source invalid request did not return the governed no-caller-portfolio boundary message.",
    );
  }
  summary.supportabilityChecks.push({
    checkId: "dpm-core-candidate-source-preview",
    sourceProduct: "DpmPortfolioUniverseCandidate:v1",
    supportabilityState: coreCandidateSourcePreviewState,
    candidateCount: coreCandidateSourceItemCount,
    invalidMixedRequestRejected: true,
    unsupportedClaimsExcluded: [
      "global portfolio-universe ownership",
      "relationship householding",
      "PM ranking",
      "external workflow orchestration",
      "client communication workflow",
      "OMS execution",
    ],
  });
  if (!dpmWaveId) {
    const dpmWaveCreate = await postDpmCommandCenterJson(
      `${gatewayBaseUrl}/api/v1/dpm/command-center/waves`,
      "DPM rebalance-wave create",
      {
        idempotency_key: [
          "workbench-live-validation-wave",
          portfolioId,
          dpmCommandCenterDefaults.asOfDate,
        ].join("-"),
        body: {
          trigger_type: "EXPLICIT_PORTFOLIO_LIST",
          trigger_id: `live-validation-wave-${portfolioId}-${dpmCommandCenterDefaults.asOfDate}`,
          rationale:
            "Canonical Workbench live validation created an RFC-0041 rebalance wave.",
          as_of_date: dpmCommandCenterDefaults.asOfDate,
          actor_id: "workbench-system",
          portfolios: [{ portfolio_id: portfolioId }],
        },
      },
    );
    dpmWaveId = extractDpmWaveId(dpmWaveCreate);
  }
  if (!dpmWaveId) {
    throw new Error(
      "DPM rebalance-wave create returned no manage-owned wave id.",
    );
  }
  const dpmWaveReportInput = await fetchDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/waves/${encodeURIComponent(dpmWaveId)}/report-input`,
    "DPM rebalance-wave report input",
  );
  const dpmWaveReportInputPayload =
    dpmWaveReportInput?.data ?? dpmWaveReportInput;
  const dpmWaveReportInputRef =
    readString(dpmWaveReportInputPayload?.report_input_ref) ||
    readString(dpmWaveReportInputPayload?.evidence_ref?.ref_id);
  if (!dpmWaveReportInputRef) {
    throw new Error(
      "DPM rebalance-wave report input returned no report input evidence ref.",
    );
  }
  const dpmWaveAiPmMemo = await postDpmCommandCenterJson(
    `${gatewayBaseUrl}/api/v1/dpm/command-center/waves/${encodeURIComponent(dpmWaveId)}/ai-pm-memo`,
    "DPM rebalance-wave AI PM memo",
    {
      requested_outputs: [
        "wave_pm_memo",
        "approval_checklist",
        "evidence_gaps",
      ],
      audience: ["portfolio_manager", "investment_control", "operations"],
    },
  );
  const dpmWaveAiPmMemoPayload = dpmWaveAiPmMemo?.data ?? dpmWaveAiPmMemo;
  const dpmWaveAiPmMemoSourceService =
    readString(dpmWaveAiPmMemo?.source_service) ??
    readString(dpmWaveAiPmMemo?.sourceService);
  if (dpmWaveAiPmMemoSourceService !== "lotus-ai") {
    throw new Error(
      "DPM rebalance-wave AI PM memo did not return lotus-ai source authority.",
    );
  }
  const dpmWaveAiPmMemoRunId = extractWorkflowPackRunId(dpmWaveAiPmMemoPayload);
  if (!dpmWaveAiPmMemoRunId) {
    throw new Error(
      "DPM rebalance-wave AI PM memo returned no workflow-pack run reference.",
    );
  }
  summary.workflowPackChecks.push({
    description: "DPM rebalance-wave AI PM memo",
    sourceService: dpmWaveAiPmMemoSourceService,
    waveId: dpmWaveId,
    sourceRunId: dpmWaveAiPmMemoRunId,
    resultReviewState:
      dpmWaveAiPmMemoPayload?.workflow_pack_run?.review_state ??
      dpmWaveAiPmMemoPayload?.execution?.review_state ??
      dpmWaveAiPmMemoPayload?.status ??
      "UNKNOWN",
  });

  const pmOperatingQualityEvidence =
    await ensureCanonicalPmOperatingQualityEvidence();

  const reportCapabilities = await fetchJson(
    summary,
    "http://report.dev.lotus/integration/capabilities?consumerSystem=lotus-gateway&tenantId=default",
    "lotus-report integration capabilities",
    timeoutMs,
  );
  if (
    !Array.isArray(reportCapabilities?.features) ||
    reportCapabilities.features.length < 1
  ) {
    throw new Error(
      "lotus-report integration capabilities returned no feature flags.",
    );
  }

  await fetchJson(
    summary,
    "http://archive.dev.lotus/health/ready",
    "lotus-archive readiness",
    timeoutMs,
  );
  await fetchJson(
    summary,
    "http://render.dev.lotus/health/ready",
    "lotus-render readiness",
    timeoutMs,
  );

  const gatewayCapabilities = await fetchJson(
    summary,
    `${gatewayBaseUrl}/api/v1/platform/capabilities`,
    "Gateway platform capabilities",
    timeoutMs,
  );
  const advisorBook = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-book/portfolios?asOfDate=${encodeURIComponent(
      advisorBookAsOfDate,
    )}&limit=100`,
    "Gateway advisor own-book membership",
    timeoutMs,
    {
      headers: {
        "X-Actor-Id":
          process.env.WORKBENCH_ADVISOR_BOOK_ACTOR_ID ?? "PM_SG_001",
        "X-Caller-Application": "lotus-workbench",
        "X-Tenant-Id":
          process.env.WORKBENCH_ADVISOR_BOOK_TENANT_ID ?? "tenant-sg",
        "X-Region": process.env.WORKBENCH_ADVISOR_BOOK_REGION ?? "APAC",
        "X-Booking-Center-Code":
          process.env.WORKBENCH_ADVISOR_BOOK_BOOKING_CENTER_CODE ?? "Singapore",
        "X-Role": process.env.WORKBENCH_ADVISOR_BOOK_ROLE ?? "ADVISOR",
        "X-Caller-Capabilities": "advisor.book.read",
      },
    },
  );
  const advisorBookEvidence = validateCanonicalAdvisorBookEvidence(
    advisorBook,
    portfolioId,
    advisorBookAsOfDate,
  );
  summary.advisorBookChecks.push(advisorBookEvidence);
  const gatewayModuleHealth =
    gatewayCapabilities?.data?.normalized?.moduleHealth;
  if (
    !gatewayModuleHealth ||
    typeof gatewayModuleHealth.lotus_manage !== "string"
  ) {
    throw new Error(
      "Gateway platform capabilities returned no explicit lotus-manage module health.",
    );
  }
  for (const requiredSource of [
    "lotus_core",
    "lotus_performance",
    "lotus_risk",
  ]) {
    if (gatewayModuleHealth[requiredSource] !== "available") {
      throw new Error(
        `Gateway platform capabilities returned non-available ${requiredSource}.`,
      );
    }
  }

  panelGovernance.recordPanelClassification(
    "advisor.book_overview",
    classifyCanonicalAdvisorBookPanelSupportState(advisorBookEvidence),
    "lotus-gateway",
    {
      portfolioId,
      asOfDate: advisorBookEvidence.asOfDate,
      scope: advisorBookEvidence.scope,
      membershipSource: advisorBookEvidence.membershipSource,
      membershipBasis: advisorBookEvidence.membershipBasis,
      tenantScope: advisorBookEvidence.tenantScope,
    },
  );
  panelGovernance.recordPanelClassification(
    "portfolio.summary",
    "ready",
    "lotus-gateway",
    {
      portfolioId,
    },
  );
  panelGovernance.recordPanelClassification(
    "portfolio.detailed",
    "ready",
    "lotus-gateway",
    {
      portfolioId,
    },
  );
  panelGovernance.recordPanelClassification(
    "performance.advisor_brief",
    "ready",
    "lotus-performance",
    {
      sourceMetricMinimum: 3,
    },
  );
  panelGovernance.recordPanelClassification(
    "proposal.narrative_posture",
    "ready",
    "lotus-advise",
    {
      route: `/proposals/${proposalId}`,
      proposalId,
      versionNo: proposalVersionNo,
      narrativeId: proposalNarrative.narrative_id,
      generationMode: proposalNarrative.generation_mode,
    },
  );
  panelGovernance.recordPanelClassification(
    "proposal.memo_evidence_pack",
    "ready",
    "lotus-advise",
    {
      route: `/proposals/${proposalId}`,
      proposalId,
      versionNo: proposalVersionNo,
      source: "lotus-advise memo evidence-pack posture",
    },
  );
  panelGovernance.recordPanelClassification(
    "advisory.advisor_cockpit",
    "ready",
    "lotus-advise",
    {
      route: `/recommendations?portfolioId=${portfolioId}&mode=cockpit`,
      proposalId,
      proposalVersionId,
      policyEvaluationId: policyEvaluationProof.evaluationId,
      actionItemId: advisorCockpitProof.actionItemId,
      actionCount: advisorCockpitProof.actionCount,
      snapshotId: advisorCockpitProof.snapshotId,
      clientReadyPublication: advisorCockpitProof.clientReadyPublication,
      supportabilityPosture: advisorCockpitProof.supportabilityPosture,
      source:
        "Gateway advisor cockpit action list, snapshot, supportability, and acknowledgement",
    },
  );
  panelGovernance.recordPanelClassification(
    "advisory.advisory_copilot",
    "ready",
    "lotus-advise",
    {
      route: `/recommendations?portfolioId=${portfolioId}&mode=copilot`,
      proposalId,
      proposalVersionId,
      actionRunCount: advisoryCopilotProof.actionRunCount,
      sourcePacketCount: advisoryCopilotProof.sourcePacketCount,
      guardrailPosture: advisoryCopilotProof.guardrailPosture,
      clientReadyPublication: advisoryCopilotProof.clientReadyPublication,
      source:
        "Gateway advisory copilot source-packet, lotus-ai action, review, guardrail, and proposal-run proof",
    },
  );
  panelGovernance.recordPanelClassification(
    "advisory.bank_demo_proof",
    "ready",
    "lotus-advise",
    {
      route: `/recommendations?portfolioId=${portfolioId}&mode=proof`,
      scenarioId: bankDemoScenarioData.scenario_id,
      proofMarker: bankDemoScenarioData.proof_marker,
      claimCount: bankDemoClaimData?.claims?.length ?? 0,
      clientReadyPublication:
        bankDemoProofScenario.expectedClientReadyPublication,
      source: "Gateway RFC-0028 scenario contract and supported-claim register",
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.outcome_review",
    "ready",
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}`,
      outcomeReviewMinimum: 1,
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.proof_pack",
    "ready",
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}`,
      proofPackId,
      proofPackBusinessState:
        proofPackSupportability?.state ?? proofPackPayload.status ?? "UNKNOWN",
      sectionCount: proofPackSectionCount,
      sourceHashCount: proofPackSourceHashCount,
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.command_center",
    dpmCommandCenterPanelState,
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}`,
      source: "Gateway DPM command-center summary",
      supportabilityState: readSupportabilityState(
        dpmCommandCenterPayload.supportability,
      ),
      dataCompletenessState:
        dpmCommandCenterPayload.supportability.data_completeness_state,
      reason: readString(dpmCommandCenterPayload.supportability.reason),
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.portfolio_memory",
    "ready",
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}`,
      eventCount: portfolioMemoryEvents.length,
      source: "Gateway DPM portfolio-memory composition",
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.wave_command_center",
    "ready",
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}`,
      source: "Gateway DPM rebalance-wave composition",
      waveId: dpmWaveId,
      reportInputRef: dpmWaveReportInputPayload.report_input_ref,
      aiMemoRunId: dpmWaveAiPmMemoRunId,
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.construction_alternatives",
    "ready",
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}?mode=construction`,
      source: "Gateway DPM construction alternatives",
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.pm_operating_quality",
    "ready",
    "lotus-manage",
    {
      route: `/workbench/${portfolioId}?mode=quality`,
      source: "Gateway DPM PM operating quality",
      scoreRunId: pmOperatingQualityEvidence.scoreRunId,
      fairnessAnalysisId: pmOperatingQualityEvidence.fairnessAnalysisId,
      reviewActionId: pmOperatingQualityEvidence.reviewActionId,
      summaryInvocationId: pmOperatingQualityEvidence.summaryInvocationId,
      asOfDate: pmOperatingQualityEvidence.asOfDate,
      tenantId: pmOperatingQualityEvidence.tenantId,
    },
  );
  panelGovernance.recordPanelClassification(
    "dpm.copilot_workspace",
    "ready",
    "lotus-ai",
    {
      route: `/workbench/${portfolioId}?mode=copilot`,
      source: "Gateway/lotus-ai DPM workflow-pack workspace",
    },
  );
  summary.rfc3643FeatureCoverage = buildRfc3643FeatureCoverage(summary, {
    portfolioWorkspace,
    manageSupportabilitySummary,
    gatewayOverview,
    commandCenterSummary: dpmCommandCenterPayload,
    dpmCommandCenterPanel: true,
    activeExceptions: true,
    coreCandidateSourcePreview:
      coreCandidateSourcePreviewState?.toLowerCase() === "ready" &&
      coreCandidateSourceItemCount > 0 &&
      hasCoreDpmPortfolioUniverseSourceRef(coreCandidateSourcePreview),
    coreCandidateSourceInvalidRequestRejected: true,
    portfolioMemory: portfolioMemoryEvents,
    mandateLookup: mandateId,
    mandateHealth: mandateHealthObserved,
    constructionAlternativesPanel: true,
    proofPackId,
    proofPackSections: proofPackSectionCount,
    proofPackSourceEvidence: proofPackSourceHashCount,
    proofPackPanel: true,
    proofPackAiMemo: proofPackAiPmMemoRunId,
    wavePreview: dpmWavePreviewSupportabilityState?.toLowerCase() === "ready",
    multiPortfolioWavePreview:
      multiPortfolioWavePreviewSupportabilityState?.toLowerCase() === "ready" &&
      multiPortfolioWaveItemCount >=
        multiPortfolioWaveScenario.minimumPortfolioCount,
    waveId: dpmWaveId,
    waveReportInput: dpmWaveReportInputRef,
    waveAiMemo: dpmWaveAiPmMemoRunId,
    wavePanel: true,
    outcomeReviewRows: outcomeReviewItems,
    outcomeReviewPanel: true,
    pmQualityScoreRun: pmOperatingQualityEvidence.scoreRunId,
    pmQualityFairnessAnalysis: pmOperatingQualityEvidence.fairnessAnalysisId,
    pmQualityReviewAction: pmOperatingQualityEvidence.reviewActionId,
    pmQualitySummaryInvocation: pmOperatingQualityEvidence.summaryInvocationId,
    pmQualityPanel: true,
    copilotWorkspace: true,
    copilotPanel: true,
    proposalNarrative: proposalNarrative.narrative_id,
    proposalNarrativePanel: true,
    proposalMemoEvidencePack: proposalId,
    proposalMemoEvidencePackPanel: true,
  });
  assertRfc3643FeatureCoverage(summary);

  const portfolioShell = await fetchText(
    summary,
    `${workbenchBaseUrl}/portfolio?portfolioId=${portfolioId}`,
    "Workbench portfolio route",
    timeoutMs,
  );
  if (!portfolioShell.includes("Portfolio")) {
    throw new Error(
      "Workbench portfolio route did not render the Portfolio shell.",
    );
  }

  const performanceShell = await fetchText(
    summary,
    `${workbenchBaseUrl}/performance?portfolioId=${portfolioId}`,
    "Workbench performance route",
    timeoutMs,
  );
  if (!performanceShell.includes("Performance")) {
    throw new Error(
      "Workbench performance route did not render the Performance shell.",
    );
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
  });
  const browserHelpers = createBrowserValidationHelpers({
    outputDir,
    summary,
    portfolioId,
    benchmarkCode,
    canonicalAsOfDate,
    timeoutMs,
    panelRegistryById: panelGovernance.panelRegistryById,
  });

  try {
    await validateAdvisorBookPanel(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      canonicalAsOfDate: advisorBookAsOfDate,
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validatePortfolioPanels(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      assertListHasItems: browserHelpers.assertListHasItems,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    const reportCentreProof = await validateReportCentrePanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      assertListHasItems: browserHelpers.assertListHasItems,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    panelGovernance.recordPanelClassification(
      "reporting.report_centre",
      reportCentreProof.panelState,
      "lotus-report",
      {
        portfolioId,
        route: `/reports?portfolioId=${portfolioId}`,
        source:
          "Workbench BFF report catalogue, portfolio-review request, and request history proof",
        outputFormat: reportCentreProof.outputFormat,
        pdfOutputState: reportCentreProof.pdfOutputState,
        reason: reportCentreProof.reason,
      },
    );
    await browserHelpers.screenshotRegisteredPanel(
      page,
      "reporting.report_centre",
    );
    await validatePerformanceSummaryPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      benchmarkCode,
      canonicalStartDate,
      canonicalAsOfDate,
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validatePerformanceAnalysisPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      benchmarkCode,
      canonicalStartDate,
      canonicalAsOfDate,
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      recordUiCheck: browserHelpers.recordUiCheck,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    const advisorBriefAcceptProofQuery = await validateAdvisorBriefPanel(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      benchmarkCode,
      canonicalStartDate,
      canonicalAsOfDate,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
      performAcceptReviewActionProof: true,
    });
    await validateAdvisorBriefWorkflowPackReviewChain({
      summary,
      gatewayBaseUrl,
      portfolioId,
      benchmarkCode,
      canonicalStartDate,
      canonicalAsOfDate,
      timeoutMs,
      fetchJson,
      postJson,
      preRecordedAcceptReviewer: "live.validator.ui",
      acceptDetailBasis: advisorBriefAcceptProofQuery?.detailBasis ?? "NET",
      acceptChartFrequency:
        advisorBriefAcceptProofQuery?.chartFrequency ?? "monthly",
    });
    await validateProposalNarrativePosturePanel(page, {
      summary,
      workbenchBaseUrl,
      proposalId,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateProposalMemoEvidencePackPanel(page, {
      summary,
      workbenchBaseUrl,
      proposalId,
      proposalVersionNo,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateBankDemoProofPanel(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    const preparedIdeaJourney = await validateAdvisoryJourneyScreens(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      canonicalIdeaCandidateId: ideaCandidateId,
      portfolioWorkspace,
      timeoutMs,
      screenshotAdvisoryJourney: browserHelpers.screenshotAdvisoryJourney,
      assertGridHasRows: browserHelpers.assertGridHasRows,
    });
    await validateRiskPanel(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      benchmarkCode,
      canonicalStartDate,
      canonicalAsOfDate,
      mandateComparisons: {
        summary: riskSummary.mandate_comparison,
        concentration: riskConcentration.mandate_comparison,
      },
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateEvidencePanel(page, {
      summary,
      workbenchBaseUrl,
      portfolioId,
      benchmarkCode,
      canonicalStartDate,
      canonicalAsOfDate,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateOutcomeReviewPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      sourceReview: outcomeReviewItems[0],
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateProofPackPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateDpmCommandCenterPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validatePortfolioMemoryPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      assertTableHasRows: browserHelpers.assertTableHasRows,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateDpmWaveCommandCenterPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateConstructionAlternativesPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validatePmOperatingQualityPanel(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      expectedEvidence: pmOperatingQualityEvidence,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateDpmCopilotWorkspace(page, {
      workbenchBaseUrl,
      portfolioId,
      timeoutMs,
      screenshotRegisteredPanel: browserHelpers.screenshotRegisteredPanel,
    });
    await validateCanonicalIdeaJourney(page, preparedIdeaJourney);
  } finally {
    await browser.close();
  }

  panelGovernance.assertNoUnsupportedBlankPanels();
  panelGovernance.assertPanelSupportabilityAlignment();
  await writeValidationSummary(summaryPath, summary);
  await writeShotIndex(shotIndexPath, summary, summaryPath);
  console.log(
    `Live canonical Workbench validation passed for ${portfolioId}. Screenshots: ${outputDir}`,
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
