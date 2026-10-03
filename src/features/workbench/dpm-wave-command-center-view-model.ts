import {
  formatBusinessDateValue,
  formatTimestampValue,
} from "@/design-system/utils/financial-formatters";

import type {
  DpmCampaignDefinitionGatewayResponse,
  DpmCampaignWorkflowGatewayResponse,
  DpmOperationsHandoffSummaryResponse,
  DpmWaveAiPmMemoResponse,
  DpmWaveGatewayResponse,
} from "./types";
import { readDpmAiWorkflowSourceReference } from "./dpm-ai-workflow-normalization";
import {
  getDpmAiWorkflowProfile,
  type DpmAiWorkflowProfile,
} from "./dpm-ai-workflow-profiles";
import {
  readDpmCampaignDefinitionRecords,
  readDpmCampaignWorkflowRecords,
} from "./dpm-campaign-source-records";

const WAVE_MEMO_PROFILE = getDpmAiWorkflowProfile("wave-memo");
const OPERATIONS_HANDOFF_PROFILE = getDpmAiWorkflowProfile(
  "operations-handoff",
);

export type DpmWaveCommandCenterPanelState =
  | "ready"
  | "partial"
  | "empty"
  | "blocked"
  | "unavailable";

export type DpmWaveSummaryRow = {
  key: string;
  waveId: string;
  state: string;
  triggerType: string;
  asOfDate: string;
  itemCount: string;
  supportabilityState: string;
  supportabilityReason: string;
};

export type DpmWaveMetricRow = {
  key: string;
  label: string;
  value: string;
};

export type DpmWaveItemRow = {
  key: string;
  waveItemId: string;
  portfolioId: string;
  security: string;
  proposedAction: string;
  estimatedValue: string;
  reason: string;
  mandateImpact: string;
  status: string;
  state: string;
  sourceReadinessState: string;
  alternativeSetId: string;
  selectedAlternativeId: string;
  proofPackId: string;
  handoffRef: string;
  reasonCodes: string;
};

export type DpmCampaignDefinitionRow = {
  key: string;
  campaignId: string;
  campaignVersion: string;
  displayName: string;
  status: string;
  asOfDate: string;
  candidateCount: string;
  eligibleCandidateCount: string;
  eligiblePortfolioTypes: string;
  governanceState: string;
  expiryState: string;
  accessPurpose: string;
  sourcePosture: string;
  candidateSourceProduct: string;
  candidateSelectionBasis: string;
  candidateSourceReadiness: string;
  candidateFilters: string;
  candidateWarnings: string;
  lineageRefCount: string;
  nextAction: string;
  operatingBoundaries: string;
};

export type DpmCampaignLifecycleEventRow = {
  key: string;
  eventType: string;
  occurredAt: string;
  actor: string;
  status: string;
  reason: string;
  waveId: string;
  requestedAsOfDate: string;
  correlationId: string;
  idempotencyKey: string;
};

export type DpmCampaignLaunchHistoryRow = {
  key: string;
  waveId: string;
  actor: string;
  launchedAt: string;
  requestedAsOfDate: string;
  correlationId: string;
  idempotencyKey: string;
};

export type DpmCampaignLaunchHistoryPage = {
  productName: string;
  campaignId: string;
  campaignVersion: string;
  count: number;
  totalCount: number;
  limit: number;
  offset: number;
  operatingBoundaries: string[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type DpmCampaignPreviewReadinessPosture = {
  state: string;
  reason: string;
  requestedAsOfDate: string;
  actor: string;
  blockedActions: string[];
  operatingBoundaries: string[];
  sourcePosture: string;
};

export type DpmCampaignLaunchPosture = {
  state: string;
  canLaunch: boolean;
  reason: string;
  requestedAsOfDate: string;
  actor: string;
  launchedWaveId: string;
  idempotencyEvidence: string;
};

export type DpmCampaignWorkflowSummaryRow = {
  key: string;
  surface: string;
  state: string;
  itemCount: string;
  page: string;
  sourceRefs: string;
  reasonCodes: string;
  contentHash: string;
  operatingBoundaries: string;
};

export type DpmCampaignWorkflowEvidenceRow = {
  key: string;
  evidenceType: string;
  evidenceRef: string;
  status: string;
  actor: string;
  recordedAt: string;
  reasonCodes: string;
  sourceRefs: string;
  contentHash: string;
  operatingBoundaries: string;
  transitionPosture: string;
};

export type DpmWaveCommandCenterPanelModel = {
  state: DpmWaveCommandCenterPanelState;
  sourceService: string;
  authority: string;
  correlationId: string;
  supportabilityState: string;
  reasonCodes: string[];
  blockedActions: string[];
  remediationOwner: string;
  selectedWaveId: string | null;
  selectedWaveState: string;
  selectedWaveAsOfDate: string;
  selectedWaveItemCount: string;
  selectedWaveIssueCount: string;
  selectedWaveSupportabilityReason: string;
  reportInputRef: string;
  reportInputStatus: string;
  proofPackStatus: string;
  aiMemoStatus: string;
  aiMemoRunId: string;
  operationsHandoffSummaryStatus: string;
  operationsHandoffSummaryRunId: string;
  summaryRows: DpmWaveSummaryRow[];
  campaignRows: DpmCampaignDefinitionRow[];
  campaignLifecycleRows: DpmCampaignLifecycleEventRow[];
  campaignLaunchHistoryRows: DpmCampaignLaunchHistoryRow[];
  campaignLaunchHistoryPage: DpmCampaignLaunchHistoryPage;
  campaignPreviewReadinessPosture: DpmCampaignPreviewReadinessPosture;
  campaignLaunchPosture: DpmCampaignLaunchPosture;
  campaignWorkflowSummaryRows: DpmCampaignWorkflowSummaryRow[];
  campaignWorkflowEvidenceRows: DpmCampaignWorkflowEvidenceRow[];
  metricRows: DpmWaveMetricRow[];
  itemRows: DpmWaveItemRow[];
  proofPackRows: DpmWaveMetricRow[];
  handoffRows: DpmWaveMetricRow[];
  externalExecutionClaimed: string;
};

export function buildDpmWaveCommandCenterModel(params: {
  selectedWaveId?: string | null;
  waveList: DpmWaveGatewayResponse | null;
  waveDetail?: DpmWaveGatewayResponse | null;
  waveDetailSourceWaveId?: string | null;
  waveProofPack?: DpmWaveGatewayResponse | null;
  waveProofPackSourceWaveId?: string | null;
  waveItems?: DpmWaveGatewayResponse | null;
  waveItemsSourceWaveId?: string | null;
  actionResponse?: DpmWaveGatewayResponse | null;
  waveReportInput?: DpmWaveGatewayResponse | null;
  waveAiMemo?: DpmWaveAiPmMemoResponse | null;
  waveAiMemoSourceWaveId?: string | null;
  operationsHandoffSummary?: DpmOperationsHandoffSummaryResponse | null;
  operationsHandoffSummarySourceWaveId?: string | null;
  campaignDefinitions?: DpmCampaignDefinitionGatewayResponse | null;
  campaignDiscovery?: DpmCampaignDefinitionGatewayResponse | null;
  campaignLifecycleEvents?: DpmCampaignDefinitionGatewayResponse | null;
  campaignPreviewReadiness?: DpmCampaignDefinitionGatewayResponse | null;
  campaignLaunchHistory?: DpmCampaignDefinitionGatewayResponse | null;
  campaignLaunchPackage?: DpmCampaignDefinitionGatewayResponse | null;
  campaignLaunchResponse?: DpmWaveGatewayResponse | null;
  campaignOperatingQueue?: DpmCampaignWorkflowGatewayResponse | null;
  campaignApprovalInbox?: DpmCampaignWorkflowGatewayResponse | null;
  campaignWorkflowBoard?: DpmCampaignWorkflowGatewayResponse | null;
  campaignAssignmentPlan?: DpmCampaignWorkflowGatewayResponse | null;
  campaignWorkflowAutomation?: DpmCampaignWorkflowGatewayResponse | null;
  campaignApprovalDecisions?: DpmCampaignWorkflowGatewayResponse | null;
  campaignAssignmentActions?: DpmCampaignWorkflowGatewayResponse | null;
  campaignAssignmentTasks?: DpmCampaignWorkflowGatewayResponse | null;
  campaignMakerCheckerControls?: DpmCampaignWorkflowGatewayResponse | null;
}): DpmWaveCommandCenterPanelModel {
  const selectionPrimary =
    params.actionResponse ??
    params.waveDetail ??
    params.waveReportInput ??
    params.waveList ??
    params.waveItems;
  const listRows = buildSummaryRows(params.waveList?.data);
  const selectionWaveRecord =
    readWaveRecord(params.actionResponse?.data) ||
    readWaveRecord(params.waveDetail?.data);
  const selectionSupportability = selectionPrimary?.supportability;
  const selectedWaveId =
    readString(selectionWaveRecord ?? {}, "wave_id") ||
    params.selectedWaveId ||
    selectionSupportability?.wave_id ||
    listRows[0]?.waveId ||
    null;
  const waveDetail = matchesSelectedWave(
    params.waveDetailSourceWaveId,
    selectedWaveId,
  )
    ? params.waveDetail
    : null;
  const waveItems = matchesSelectedWave(
    params.waveItemsSourceWaveId,
    selectedWaveId,
  )
    ? params.waveItems
    : null;
  const waveProofPack = matchesSelectedWave(
    params.waveProofPackSourceWaveId,
    selectedWaveId,
  )
    ? params.waveProofPack
    : null;
  const waveProofPackRecord = readWaveRecord(waveProofPack?.data);
  const primary =
    params.actionResponse ??
    waveDetail ??
    params.waveReportInput ??
    params.waveList ??
    waveItems;
  const waveRecord =
    readWaveRecord(params.actionResponse?.data) || readWaveRecord(waveDetail?.data);
  const itemData = waveItems?.data ?? params.actionResponse?.data ?? waveDetail?.data;
  const itemRows = buildItemRows(itemData);
  const proofPackPosture = firstRecord(
    waveProofPackRecord?.proof_pack_posture,
    waveProofPack?.data.proof_pack_posture,
    waveRecord?.proof_pack_posture,
    params.actionResponse?.data.proof_pack_posture ??
      waveDetail?.data.proof_pack_posture,
    waveItems?.data.proof_pack_posture,
    params.actionResponse?.data,
    waveProofPack?.data,
  );
  const supportability = primary?.supportability;
  const supportabilityState = normalizeState(supportability?.state);
  const selectedWaveState =
    readString(waveRecord ?? {}, "state") ||
    supportability?.wave_state ||
    listRows[0]?.state ||
    "N/A";
  const waveAiMemoSelection = selectWaveWorkflowResponse(
    params.waveAiMemo,
    params.waveAiMemoSourceWaveId,
    selectedWaveId,
    WAVE_MEMO_PROFILE,
  );
  const operationsHandoffSummarySelection = selectWaveWorkflowResponse(
    params.operationsHandoffSummary,
    params.operationsHandoffSummarySourceWaveId,
    selectedWaveId,
    OPERATIONS_HANDOFF_PROFILE,
  );
  const waveAiMemo = waveAiMemoSelection.response;
  const operationsHandoffSummary = operationsHandoffSummarySelection.response;
  const selectedListRecord = findSelectedWaveListRecord(params.waveList?.data, selectedWaveId);
  const selectedListRow = listRows.find((row) => row.waveId === selectedWaveId);
  const metricSource = firstRecord(
    waveRecord?.aggregate_metrics,
    params.actionResponse?.data.aggregate_metrics,
    waveItems?.data.aggregate_metrics,
    selectedListRecord?.aggregate_metrics,
  );

  return {
    state: resolvePanelState(primary, listRows, itemRows, supportabilityState),
    sourceService: supportability?.source_service || primary?.source_service || "lotus-gateway",
    authority: supportability?.authority || "lotus-manage:RFC-0041",
    correlationId: primary?.correlation_id ?? "N/A",
    supportabilityState,
    reasonCodes: supportability?.reason_codes ?? [],
    blockedActions: supportability?.blocked_actions ?? [],
    remediationOwner: supportability?.remediation_owner ?? "N/A",
    selectedWaveId,
    selectedWaveState,
    selectedWaveAsOfDate:
      readString(waveRecord ?? {}, "as_of_date") ||
      selectedListRow?.asOfDate ||
      "N/A",
    selectedWaveItemCount: formatValue(
      supportability?.item_count ?? readValue(metricSource, "item_count") ?? itemRows.length
    ),
    selectedWaveIssueCount: formatValue(
      supportability?.issue_count ??
        readValue(metricSource, "issue_count") ??
        readValue(selectedListRecord ?? {}, "issue_count")
    ),
    selectedWaveSupportabilityReason:
      selectedListRow?.supportabilityReason ||
      firstNonEmpty(supportability?.reason_codes) ||
      "N/A",
    reportInputRef: readReportInputRef(params.waveReportInput?.data, waveAiMemo),
    reportInputStatus: params.waveReportInput
      ? normalizeState(params.waveReportInput.supportability.state)
      : "NOT_REQUESTED",
    proofPackStatus: waveProofPack
      ? normalizeState(waveProofPack.supportability.state)
      : "NOT_REQUESTED",
    aiMemoStatus: readAiMemoStatus(
      waveAiMemo,
      waveAiMemoSelection.receivedForSelectedSource,
    ),
    aiMemoRunId: readAiMemoRunId(waveAiMemo),
    operationsHandoffSummaryStatus: readWorkflowPackStatus(
      operationsHandoffSummary,
      operationsHandoffSummarySelection.receivedForSelectedSource,
    ),
    operationsHandoffSummaryRunId: readWorkflowPackRunId(operationsHandoffSummary),
    summaryRows: listRows,
    campaignRows: buildCampaignDefinitionRows(
      params.campaignDefinitions?.data,
      params.campaignDiscovery?.data
    ),
    campaignLifecycleRows: buildCampaignLifecycleEventRows(params.campaignLifecycleEvents?.data),
    campaignLaunchHistoryRows: buildCampaignLaunchHistoryRows(params.campaignLaunchHistory?.data),
    campaignLaunchHistoryPage: buildCampaignLaunchHistoryPage(params.campaignLaunchHistory?.data),
    campaignPreviewReadinessPosture: buildCampaignPreviewReadinessPosture(
      params.campaignPreviewReadiness?.data
    ),
    campaignLaunchPosture: buildCampaignLaunchPosture(
      params.campaignLaunchPackage?.data,
      params.campaignLaunchResponse?.data
    ),
    campaignWorkflowSummaryRows: buildCampaignWorkflowSummaryRows([
      ["Operating Queue", params.campaignOperatingQueue],
      ["Approval Inbox", params.campaignApprovalInbox],
      ["Workflow Board", params.campaignWorkflowBoard],
      ["Assignment Plan", params.campaignAssignmentPlan],
      ["Workflow Automation", params.campaignWorkflowAutomation],
    ]),
    campaignWorkflowEvidenceRows: buildCampaignWorkflowEvidenceRows([
      ["Approval Decision", params.campaignApprovalDecisions],
      ["Assignment Action", params.campaignAssignmentActions],
      ["Assignment Task", params.campaignAssignmentTasks],
      ["Maker-Checker Control", params.campaignMakerCheckerControls],
    ]),
    metricRows: buildMetricRows(metricSource),
    itemRows,
    proofPackRows: buildProofPackRows(proofPackPosture, itemRows),
    handoffRows: buildHandoffRows(proofPackPosture),
    externalExecutionClaimed: formatValue(
      readValue(proofPackPosture, "external_execution_claimed")
    ),
  };
}

function buildCampaignWorkflowSummaryRows(
  responses: Array<[string, DpmCampaignWorkflowGatewayResponse | null | undefined]>
): DpmCampaignWorkflowSummaryRow[] {
  return responses.flatMap(([surface, response]) => {
    if (!response) {
      return [];
    }
    const data = response.data;
    const supportability = readRecord(response.supportability);
    const records = extractWorkflowRecords(data);
    const count = readNumber(data, "count") ?? readNumber(supportability, "count") ?? records.length;
    const totalCount =
      readNumber(data, "total_count") ?? readNumber(supportability, "total_count") ?? count;
    const limit = readNumber(data, "limit");
    const offset = readNumber(data, "offset");
    return [
      {
        key: surface.toLowerCase().replaceAll(" ", "-"),
        surface,
        state: normalizeState(
          readString(data, "supportability_state") ||
            readString(data, "state") ||
            readString(supportability, "state")
        ),
        itemCount: formatValue(count),
        page:
          limit === null || offset === null
            ? `${formatValue(count)} of ${formatValue(totalCount)}`
            : `${formatValue(offset + 1)}-${formatValue(offset + count)} of ${formatValue(totalCount)}`,
        sourceRefs: formatValue(countNestedRecords(data, "source_refs")),
        reasonCodes: formatStringList(
          extractStringArray(data.reason_codes ?? supportability.reason_codes)
        ),
        contentHash:
          readString(data, "content_hash") || readString(supportability, "content_hash") || "N/A",
        operatingBoundaries: formatStringList(extractStringArray(data.operating_boundaries)),
      },
    ];
  });
}

function buildCampaignWorkflowEvidenceRows(
  responses: Array<[string, DpmCampaignWorkflowGatewayResponse | null | undefined]>
): DpmCampaignWorkflowEvidenceRow[] {
  return responses.flatMap(([evidenceType, response]) =>
    extractWorkflowRecords(response?.data).map((record, index) =>
      buildCampaignWorkflowEvidenceRow(evidenceType, record, index)
    )
  );
}

function buildCampaignWorkflowEvidenceRow(
  evidenceType: string,
  record: Record<string, unknown>,
  index: number
): DpmCampaignWorkflowEvidenceRow {
  const sourceRefs = extractRecordArray(record.source_refs);
  const transitionRecords = extractRecordArray(
    record.transitions ?? record.transition_history ?? record.task_transitions
  );
  const transitionPosture = transitionRecords.length
    ? transitionRecords
        .map((transition, transitionIndex) => {
          const transitionType =
            readString(transition, "transition_type") ||
            readString(transition, "event_type") ||
            `transition_${transitionIndex + 1}`;
          const fromStatus = readString(transition, "from_status");
          const toStatus = readString(transition, "to_status");
          return [transitionType, [fromStatus, toStatus].filter(Boolean).join(" to ")]
            .filter(Boolean)
            .join(": ");
        })
        .join(" | ")
    : "N/A";
  const recordedAt =
    readString(record, "recorded_at") ||
    readString(record, "created_at") ||
    readString(record, "updated_at");
  return {
    key: [
      evidenceType.toLowerCase().replaceAll(" ", "-"),
      readString(record, "evidence_ref") ||
        readString(record, "decision_ref") ||
        readString(record, "action_ref") ||
        readString(record, "task_ref") ||
        readString(record, "control_ref") ||
        String(index + 1),
    ].join(":"),
    evidenceType,
    evidenceRef:
      readString(record, "evidence_ref") ||
      readString(record, "decision_ref") ||
      readString(record, "action_ref") ||
      readString(record, "task_ref") ||
      readString(record, "control_ref") ||
      "N/A",
    status: normalizeState(
      readString(record, "status") ||
        readString(record, "state") ||
        readString(record, "to_status") ||
        "RECORDED"
    ),
    actor:
      readString(record, "decided_by") ||
      readString(record, "recorded_by") ||
      readString(record, "opened_by") ||
      readString(record, "transitioned_by") ||
      readString(record, "actor_id") ||
      readString(record, "created_by") ||
      "N/A",
    recordedAt: formatTimestampValue(recordedAt, { nullDisplay: "Not reported" }),
    reasonCodes: formatStringList(extractStringArray(record.reason_codes ?? record.reason_code)),
    sourceRefs: formatValue(sourceRefs.length),
    contentHash: readString(record, "content_hash") || "N/A",
    operatingBoundaries: formatStringList(extractStringArray(record.operating_boundaries)),
    transitionPosture,
  };
}

function buildCampaignPreviewReadinessPosture(
  previewReadiness: Record<string, unknown> | undefined
): DpmCampaignPreviewReadinessPosture {
  const state = normalizeState(
    readString(previewReadiness ?? {}, "supportability_state") ||
      readString(previewReadiness ?? {}, "state") ||
      "NOT_CHECKED"
  );
  const reasonCodes = extractStringArray(
    previewReadiness?.reason_codes ?? previewReadiness?.blocked_reason_codes
  );
  const sourceRefs = extractRecordArray(previewReadiness?.source_refs);
  return {
    state,
    reason: reasonCodes.length > 0 ? reasonCodes.join(", ") : state === "READY" ? "Ready" : "Not checked",
    requestedAsOfDate: formatBusinessDateValue(
      readString(previewReadiness ?? {}, "requested_as_of_date"),
      { nullDisplay: "Not reported" },
    ),
    actor: readString(previewReadiness ?? {}, "actor_id") || "N/A",
    blockedActions: extractStringArray(previewReadiness?.blocked_actions),
    operatingBoundaries: extractStringArray(previewReadiness?.operating_boundaries),
    sourcePosture:
      sourceRefs.length > 0
        ? `${sourceRefs.length} source ${sourceRefs.length === 1 ? "reference" : "references"}`
        : "N/A",
  };
}

function buildCampaignLaunchPosture(
  launchPackage: Record<string, unknown> | undefined,
  launchResponse: Record<string, unknown> | undefined
): DpmCampaignLaunchPosture {
  const readiness = readRecord(launchPackage?.readiness);
  const createRequest = readRecord(launchPackage?.create_request);
  const createHeaders = readRecord(launchPackage?.create_headers);
  const wave = readWaveRecord(launchResponse);
  const state = normalizeState(
    readString(launchPackage ?? {}, "launch_state") ||
      readString(readiness, "state") ||
      "NOT_CHECKED"
  );
  const reasonCodes = extractStringArray(
    launchPackage?.reason_codes ?? readiness.reason_codes ?? readiness.blocked_reason_codes
  );
  return {
    state,
    canLaunch: state === "READY",
    reason: reasonCodes.length > 0 ? reasonCodes.join(", ") : state === "READY" ? "Ready" : "Not checked",
    requestedAsOfDate: formatBusinessDateValue(
      readString(launchPackage ?? {}, "requested_as_of_date") ||
        readString(createRequest, "as_of_date"),
      { nullDisplay: "Not reported" },
    ),
    actor:
      readString(launchPackage ?? {}, "actor_id") ||
      readString(createRequest, "actor_id") ||
      "N/A",
    launchedWaveId: readString(wave ?? {}, "wave_id") || "N/A",
    idempotencyEvidence:
      readString(createHeaders, "Idempotency-Key") ||
      readString(createHeaders, "idempotency_key") ||
      readString(createRequest, "idempotency_key") ||
      "N/A",
  };
}

function readWorkflowPackStatus(
  response: unknown,
  receivedForSelectedSource = false,
): string {
  if (!response) {
    return receivedForSelectedSource ? "UNAVAILABLE" : "NOT_REQUESTED";
  }
  const reviewState = readString(readWorkflowPackRun(response), "review_state");
  return reviewState ? normalizeState(reviewState) : "UNAVAILABLE";
}

function readWorkflowPackRunId(response: unknown): string {
  if (!response) {
    return "N/A";
  }
  return readString(readWorkflowPackRun(response), "run_id") || "N/A";
}

function readReportInputRef(
  reportInput: Record<string, unknown> | undefined,
  memo: DpmWaveAiPmMemoResponse | null | undefined
): string {
  const evidenceRef = readRecord(reportInput?.evidence_ref);
  const waveReportInput = readRecord(readRecord(memo).wave_report_input);
  return (
    readString(reportInput ?? {}, "report_input_ref") ||
    readString(evidenceRef, "ref_id") ||
    readString(waveReportInput, "report_input_ref") ||
    "N/A"
  );
}

function readAiMemoStatus(
  memo: unknown,
  receivedForSelectedSource = false,
): string {
  if (!memo) {
    return receivedForSelectedSource ? "UNAVAILABLE" : "NOT_REQUESTED";
  }
  const reviewState = readString(readWorkflowPackRun(memo), "review_state");
  return reviewState ? normalizeState(reviewState) : "UNAVAILABLE";
}

function readWorkflowPackRun(response: unknown): Record<string, unknown> {
  const data = readRecord(readRecord(response).data);
  return readRecord(data.workflow_pack_run);
}

function matchesSelectedWave(
  sourceWaveId: string | null | undefined,
  selectedWaveId: string | null,
): boolean {
  return (
    sourceWaveId === undefined ||
    (sourceWaveId !== null && sourceWaveId === selectedWaveId)
  );
}

function selectWaveWorkflowResponse<T>(
  response: T | null | undefined,
  sourceWaveId: string | null | undefined,
  selectedWaveId: string | null,
  profile: DpmAiWorkflowProfile,
): { response: T | null; receivedForSelectedSource: boolean } {
  if (!matchesSelectedWave(sourceWaveId, selectedWaveId) || !response) {
    return { response: null, receivedForSelectedSource: false };
  }
  const responseWaveId = readDpmAiWorkflowSourceReference(response, profile);
  if (responseWaveId === null) {
    return { response: null, receivedForSelectedSource: true };
  }
  return responseWaveId === selectedWaveId
    ? { response, receivedForSelectedSource: true }
    : { response: null, receivedForSelectedSource: false };
}

function readAiMemoRunId(memo: unknown): string {
  return readWorkflowPackRunId(memo);
}

function resolvePanelState(
  primary: DpmWaveGatewayResponse | null | undefined,
  listRows: DpmWaveSummaryRow[],
  itemRows: DpmWaveItemRow[],
  supportabilityState: string
): DpmWaveCommandCenterPanelState {
  if (!primary) {
    return "unavailable";
  }
  if (supportabilityState === "BLOCKED") {
    return "blocked";
  }
  if (supportabilityState !== "READY") {
    return "partial";
  }
  if (!readWaveRecord(primary.data) && listRows.length === 0 && itemRows.length === 0) {
    return "empty";
  }
  return "ready";
}

function buildSummaryRows(data: Record<string, unknown> | undefined): DpmWaveSummaryRow[] {
  return extractRecordArray(data?.items ?? data?.waves).map((record, index) => {
    const aggregate = readRecord(record.aggregate_metrics);
    return {
      key: readString(record, "wave_id") || `wave-${index + 1}`,
      waveId: readString(record, "wave_id") || "N/A",
      state: readString(record, "state") || "N/A",
      triggerType: readString(record, "trigger_type") || "N/A",
      asOfDate: readString(record, "as_of_date") || "N/A",
      itemCount: formatValue(readValue(record, "item_count") ?? readValue(aggregate, "item_count")),
      supportabilityState: normalizeState(readString(record, "supportability_state")),
      supportabilityReason: readString(record, "supportability_reason") || "N/A",
    };
  });
}

function buildCampaignDefinitionRows(
  data: Record<string, unknown> | undefined,
  discoveryData?: Record<string, unknown> | undefined
): DpmCampaignDefinitionRow[] {
  const discoveryByKey = new Map(
    extractRecordArray(discoveryData?.items ?? discoveryData?.campaigns).map((record, index) => [
      buildCampaignKey(record, index),
      record,
    ])
  );
  return readDpmCampaignDefinitionRecords(data).map((record, index) => {
    const discovery = discoveryByKey.get(buildCampaignKey(record, index)) ?? {};
    const governance = readRecord(record.governance);
    const candidates = extractRecordArray(record.candidates);
    const candidateSourceRefCount = candidates.reduce(
      (count, candidate) => count + extractRecordArray(candidate.source_refs).length,
      0
    );
    const candidateCount =
      readValue(discovery, "candidate_count") ??
      readValue(record, "candidate_count") ??
      readValue(record, "eligible_candidate_count") ??
      candidates.length;
    const eligibleCandidateCount =
      readValue(discovery, "eligible_candidate_count") ??
      readValue(record, "eligible_candidate_count") ??
      candidateCount;
    const governanceState =
      readString(discovery, "governance_status") ||
      readString(record, "governance_state") ||
      (governance.approval_ref || governance.approved_by ? "GOVERNED" : "NOT_PROVIDED");
    const sourceRefCount =
      readNumber(discovery, "source_ref_count") ??
      extractRecordArray(record.source_refs).length +
        extractRecordArray(governance.source_refs).length +
        candidateSourceRefCount;
    const candidateSourceReadiness = resolveCampaignCandidateSourceReadiness(
      discovery,
      sourceRefCount
    );
    const pageTruncated =
      readValue(discovery, "page_truncated") === true ||
      readValue(record, "page_truncated") === true ||
      readString(discovery, "page_truncated").toLowerCase() === "true";
    return {
      key: buildCampaignKey(record, index),
      campaignId: readString(record, "campaign_id") || "N/A",
      campaignVersion: readString(record, "campaign_version") || "N/A",
      displayName:
        readString(record, "display_name") ||
        readString(record, "name") ||
        readString(record, "campaign_id") ||
        `Campaign ${index + 1}`,
      status: normalizeState(
        readString(record, "status") || readString(discovery, "campaign_status") || "UNKNOWN"
      ),
      asOfDate: readString(record, "as_of_date") || "N/A",
      candidateCount: formatValue(candidateCount),
      eligibleCandidateCount: formatValue(eligibleCandidateCount),
      eligiblePortfolioTypes:
        extractStringArray(record.eligible_portfolio_types).join(", ") ||
        extractStringArray(discovery.eligible_portfolio_types).join(", ") ||
        "N/A",
      governanceState,
      expiryState: normalizeState(readString(discovery, "expiry_state") || "N/A"),
      accessPurpose: readString(discovery, "access_purpose") || "N/A",
      sourcePosture:
        sourceRefCount > 0 ||
        extractRecordArray(record.source_refs).length > 0 ||
        extractRecordArray(governance.source_refs).length > 0 ||
        candidateSourceRefCount > 0
          ? "Source-backed"
          : "Review source refs",
      candidateSourceProduct: resolveCampaignCandidateSourceProduct(record, discovery),
      candidateSelectionBasis: resolveCampaignCandidateSelectionBasis(record),
      candidateSourceReadiness,
      candidateFilters: resolveCampaignCandidateFilters(record, discovery),
      candidateWarnings: resolveCampaignCandidateWarnings(
        discovery,
        candidateSourceReadiness,
        pageTruncated
      ),
      lineageRefCount: formatValue(sourceRefCount),
      nextAction: resolveCampaignCandidateNextAction(candidateSourceReadiness, pageTruncated),
      operatingBoundaries: resolveCampaignCandidateOperatingBoundaries(record, discovery),
    };
  });
}

function resolveCampaignCandidateSourceProduct(
  record: Record<string, unknown>,
  discovery: Record<string, unknown>
): string {
  const lineageProduct = resolveCampaignCandidateLineageProduct(record);
  if (lineageProduct) {
    return lineageProduct;
  }
  const productName =
    readString(discovery, "product_name") ||
    readString(record, "product_name") ||
    readString(discovery, "source_product") ||
    readString(record, "source_product");
  const productVersion =
    readString(discovery, "product_version") || readString(record, "product_version");
  if (productName && productVersion) {
    return `${productName}:${productVersion}`;
  }
  return productName || "BulkReviewCampaignMembership:v1";
}

function resolveCampaignCandidateLineageProduct(record: Record<string, unknown>): string {
  const sourceRefs = extractRecordArray(record.candidates).flatMap((candidate) =>
    extractRecordArray(candidate.source_refs)
  );
  const sourceProduct = sourceRefs
    .map(formatCandidateLineageSourceProduct)
    .find((value) => value.length > 0);
  return sourceProduct ?? "";
}

function formatCandidateLineageSourceProduct(sourceRef: Record<string, unknown>): string {
  const sourceType = (
    readString(sourceRef, "source_type") ||
    readString(sourceRef, "source_product_name") ||
    readString(sourceRef, "product_name")
  ).trim();
  if (!sourceType || sourceType.startsWith("BulkReviewCampaign")) {
    return "";
  }
  const sourceVersion = (
    readString(sourceRef, "source_version") ||
    readString(sourceRef, "source_product_version") ||
    readString(sourceRef, "product_version")
  ).trim();
  if (!sourceVersion || sourceType.endsWith(`:${sourceVersion}`)) {
    return sourceType;
  }
  return `${sourceType}:${sourceVersion}`;
}

function resolveCampaignCandidateSelectionBasis(record: Record<string, unknown>): string {
  const sourceRefs = extractRecordArray(record.candidates).flatMap((candidate) =>
    extractRecordArray(candidate.source_refs)
  );
  const basis = sourceRefs.map((sourceRef) => readRecord(sourceRef.selection_basis)).find((value) => {
    return Object.keys(value).length > 0;
  });
  if (!basis) {
    return "N/A";
  }
  const basisType = readString(basis, "basis_type");
  const sourceTable = readString(basis, "source_table");
  const predicates = extractStringArray(basis.included_when);
  const parts = [
    basisType ? formatLabel(basisType) : "",
    sourceTable ? `Source: ${sourceTable}` : "",
    predicates.length > 0 ? `Predicates: ${predicates.join(", ")}` : "",
  ].filter((value) => value.length > 0);
  return parts.length > 0 ? parts.join("; ") : "N/A";
}

function resolveCampaignCandidateSourceReadiness(
  discovery: Record<string, unknown>,
  sourceRefCount: number
): string {
  const supportability = readRecord(discovery.supportability);
  return normalizeState(
    readString(discovery, "source_readiness_state") ||
      readString(discovery, "supportability_state") ||
      readString(supportability, "state") ||
      readString(discovery, "candidate_source_ref_posture") ||
      (sourceRefCount > 0 ? "READY" : "UNKNOWN")
  );
}

function resolveCampaignCandidateFilters(
  record: Record<string, unknown>,
  discovery: Record<string, unknown>
): string {
  const appliedFilters = readRecord(discovery.applied_filters ?? record.applied_filters);
  const filterEntries = Object.entries(appliedFilters)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${formatLabel(key)}: ${formatValue(value)}`);
  if (filterEntries.length > 0) {
    return filterEntries.join("; ");
  }
  return [
    ["As Of", readString(record, "as_of_date") || readString(discovery, "as_of_date")],
    [
      "Eligible Types",
      extractStringArray(record.eligible_portfolio_types).join(", ") ||
        extractStringArray(discovery.eligible_portfolio_types).join(", "),
    ],
    ["Access Purpose", readString(discovery, "access_purpose")],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("; ") || "N/A";
}

function resolveCampaignCandidateWarnings(
  discovery: Record<string, unknown>,
  candidateSourceReadiness: string,
  pageTruncated: boolean
): string {
  const warnings = [
    ...extractStringArray(discovery.warnings),
    ...extractStringArray(discovery.reason_codes),
  ];
  if (pageTruncated) {
    warnings.push("TRUNCATED_PAGE");
  }
  if (["INCOMPLETE", "DEGRADED", "PARTIAL", "BLOCKED"].includes(candidateSourceReadiness)) {
    warnings.push(`SOURCE_${candidateSourceReadiness}`);
  }
  return formatStringList([...new Set(warnings)]);
}

function resolveCampaignCandidateNextAction(
  candidateSourceReadiness: string,
  pageTruncated: boolean
): string {
  if (pageTruncated) {
    return "Narrow candidate filters or page through source evidence before launch readiness.";
  }
  if (["INCOMPLETE", "DEGRADED", "PARTIAL", "BLOCKED"].includes(candidateSourceReadiness)) {
    return "Resolve source readiness before checking campaign launch posture.";
  }
  if (candidateSourceReadiness === "READY") {
    return "Review launch readiness and any source-owned blockers.";
  }
  return "Review source refs before campaign action.";
}

function resolveCampaignCandidateOperatingBoundaries(
  record: Record<string, unknown>,
  discovery: Record<string, unknown>
): string {
  const universePosture = readRecord(discovery.universe_posture);
  const boundaries = [
    ...extractStringArray(discovery.operating_boundaries),
    ...extractStringArray(universePosture.operating_boundaries),
    ...extractStringArray(record.operating_boundaries),
    "NO_OMS_EXECUTION_CLAIM",
    "NO_CLIENT_CONTACT_WORKFLOW",
  ];
  return formatStringList([...new Set(boundaries)]);
}

function buildCampaignKey(record: Record<string, unknown>, index: number): string {
  return [
    readString(record, "campaign_id") || `campaign-${index + 1}`,
    readString(record, "campaign_version") || "version",
  ].join(":");
}

function buildCampaignLifecycleEventRows(
  data: Record<string, unknown> | undefined
): DpmCampaignLifecycleEventRow[] {
  return extractRecordArray(data?.events ?? data?.lifecycle_events ?? data?.items).map(
    (record, index) => {
      const metadata = readRecord(record.metadata);
      const occurredAt =
        readString(record, "occurred_at") ||
        readString(record, "created_at") ||
        readString(record, "effective_at");
      return {
        key:
          readString(record, "event_id") ||
          [
            readString(record, "event_type") || `campaign-event-${index + 1}`,
            readString(record, "occurred_at") || String(index + 1),
          ].join(":"),
        eventType: formatLabel(
          readString(record, "event_type") ||
            readString(record, "type") ||
            readString(record, "lifecycle_event") ||
            "Lifecycle Event"
        ),
        occurredAt: formatTimestampValue(occurredAt, { nullDisplay: "Not reported" }),
        actor:
          readString(record, "actor_id") ||
          readString(record, "created_by") ||
          readString(metadata, "actor_id") ||
          "N/A",
        status: normalizeState(
          readString(record, "status") ||
            readString(record, "state") ||
            readString(record, "campaign_status") ||
            "RECORDED"
        ),
        reason:
          readString(record, "reason_code") ||
          readString(record, "reason") ||
          readString(record, "rationale") ||
          readString(metadata, "reason_code") ||
          "N/A",
        waveId:
          readString(record, "wave_id") ||
          readString(metadata, "wave_id") ||
          "N/A",
        requestedAsOfDate: formatBusinessDateValue(
          readString(record, "requested_as_of_date") ||
            readString(metadata, "requested_as_of_date"),
          { nullDisplay: "Not reported" },
        ),
        correlationId:
          readString(record, "correlation_id") ||
          readString(metadata, "correlation_id") ||
          "N/A",
        idempotencyKey:
          readString(record, "idempotency_key") ||
          readString(metadata, "idempotency_key") ||
          "N/A",
      };
    }
  );
}

function buildCampaignLaunchHistoryRows(
  data: Record<string, unknown> | undefined
): DpmCampaignLaunchHistoryRow[] {
  return extractRecordArray(data?.items).map((record, index) => {
    const waveId = readString(record, "wave_id") || `launch-${index + 1}`;
    const launchedAt = readString(record, "launched_at");
    return {
      key: [
        waveId,
        readString(record, "launched_at") || "launched",
        readString(record, "requested_as_of_date") || String(index + 1),
        readString(record, "idempotency_key") || "idempotency",
      ].join(":"),
      waveId,
      actor: readString(record, "launched_by") || "N/A",
      launchedAt: formatTimestampValue(launchedAt, { nullDisplay: "Not reported" }),
      requestedAsOfDate: formatBusinessDateValue(
        readString(record, "requested_as_of_date"),
        { nullDisplay: "Not reported" },
      ),
      correlationId: readString(record, "correlation_id") || "N/A",
      idempotencyKey: readString(record, "idempotency_key") || "N/A",
    };
  });
}

function buildCampaignLaunchHistoryPage(
  data: Record<string, unknown> | undefined
): DpmCampaignLaunchHistoryPage {
  const count = readNumber(data ?? {}, "count") ?? 0;
  const totalCount = readNumber(data ?? {}, "total_count") ?? count;
  const limit = readNumber(data ?? {}, "limit") ?? 0;
  const offset = readNumber(data ?? {}, "offset") ?? 0;
  return {
    productName: readString(data ?? {}, "product_name") || "BulkReviewCampaignDefinitionLaunchHistory",
    campaignId: readString(data ?? {}, "campaign_id") || "N/A",
    campaignVersion: readString(data ?? {}, "campaign_version") || "N/A",
    count,
    totalCount,
    limit,
    offset,
    operatingBoundaries: extractStringArray(data?.operating_boundaries),
    hasPreviousPage: offset > 0,
    hasNextPage: limit > 0 && offset + count < totalCount,
  };
}

function findSelectedWaveListRecord(
  data: Record<string, unknown> | undefined,
  selectedWaveId: string | null
): Record<string, unknown> | undefined {
  const records = extractRecordArray(data?.items ?? data?.waves);
  if (records.length === 0) {
    return undefined;
  }
  if (!selectedWaveId) {
    return records[0];
  }
  return (
    records.find((record) => readString(record, "wave_id") === selectedWaveId) ??
    records[0]
  );
}

function buildMetricRows(record: Record<string, unknown>): DpmWaveMetricRow[] {
  return Object.entries(record).map(([key, value]) => ({
    key,
    label: formatLabel(key),
    value: formatValue(value),
  }));
}

function buildItemRows(data: Record<string, unknown> | undefined): DpmWaveItemRow[] {
  const records = extractRecordArray(data?.items ?? readWaveRecord(data)?.items);
  return records.flatMap((record, index) => {
    const diagnostics = readRecord(record.diagnostics);
    const proposedChanges = extractRecordArray(diagnostics.proposed_changes);
    if (proposedChanges.length > 0) {
      return proposedChanges.map((change, changeIndex) =>
        buildItemRow(record, index, change, changeIndex),
      );
    }
    return [buildItemRow(record, index)];
  });
}

function buildItemRow(
  record: Record<string, unknown>,
  index: number,
  proposedChange?: Record<string, unknown>,
  changeIndex?: number
): DpmWaveItemRow {
  const diagnostics = readRecord(record.diagnostics);
  const trade = firstRecord(
    proposedChange?.trade,
    proposedChange?.proposed_trade,
    record.trade,
    record.proposed_trade,
    record.rebalance_action,
  );
  const instrument = firstRecord(
    proposedChange?.instrument,
    proposedChange?.security,
    record.instrument,
    record.security,
    record.asset,
    trade.instrument,
  );
  const rationale = firstRecord(
    proposedChange?.rationale,
    proposedChange?.reason,
    record.rationale,
    record.reason,
    trade.rationale,
  );
  const estimatedValue =
    readValue(proposedChange ?? {}, "estimated_value") ??
    readValue(proposedChange ?? {}, "trade_value") ??
    readValue(record, "estimated_value") ??
    readValue(record, "trade_value") ??
    readValue(record, "estimated_trade_value") ??
    readValue(trade, "estimated_value") ??
    readValue(trade, "trade_value");
  const baseKey = readString(record, "wave_item_id") || `wave-item-${index + 1}`;
  return {
    key: changeIndex === undefined ? baseKey : `${baseKey}-change-${changeIndex + 1}`,
    waveItemId: readString(record, "wave_item_id") || "N/A",
    portfolioId: readString(record, "portfolio_id") || "N/A",
    security:
      readString(proposedChange ?? {}, "security") ||
      readString(proposedChange ?? {}, "security_id") ||
      readString(proposedChange ?? {}, "instrument_id") ||
      readString(proposedChange ?? {}, "ticker") ||
      readString(proposedChange ?? {}, "symbol") ||
      readString(record, "security") ||
      readString(record, "security_id") ||
      readString(record, "instrument_id") ||
      readString(record, "ticker") ||
      readString(record, "symbol") ||
      readString(record, "asset_name") ||
      readString(instrument, "security_id") ||
      readString(instrument, "instrument_id") ||
      readString(instrument, "ticker") ||
      readString(instrument, "symbol") ||
      readString(instrument, "name") ||
      "N/A",
    proposedAction:
      readString(proposedChange ?? {}, "action") ||
      readString(proposedChange ?? {}, "trade_action") ||
      readString(proposedChange ?? {}, "side") ||
      readString(record, "action") ||
      readString(record, "trade_action") ||
      readString(record, "side") ||
      readString(record, "instruction") ||
      readString(trade, "action") ||
      readString(trade, "side") ||
      "N/A",
    estimatedValue: formatValue(estimatedValue),
    reason:
      readString(proposedChange ?? {}, "reason") ||
      readString(proposedChange ?? {}, "rationale") ||
      readString(record, "reason") ||
      readString(record, "rationale") ||
      readString(rationale, "summary") ||
      readString(rationale, "reason") ||
      "N/A",
    mandateImpact:
      readString(proposedChange ?? {}, "mandate_impact") ||
      readString(proposedChange ?? {}, "impact") ||
      readString(record, "mandate_impact") ||
      readString(record, "impact") ||
      readString(record, "expected_impact") ||
      readString(rationale, "mandate_impact") ||
      "N/A",
    status:
      readString(proposedChange ?? {}, "status") ||
      readString(record, "status") ||
      readString(record, "approval_status") ||
      "N/A",
    state: readString(record, "state") || "N/A",
    sourceReadinessState:
      readString(record, "source_readiness_state") ||
      readString(diagnostics, "source_readiness_state") ||
      "N/A",
    alternativeSetId: readString(record, "alternative_set_id") || "N/A",
    selectedAlternativeId: readString(record, "selected_alternative_id") || "N/A",
    proofPackId: readString(record, "proof_pack_id") || "N/A",
    handoffRef:
      readString(record, "handoff_ref_id") || readString(diagnostics, "handoff_ref_id") || "N/A",
    reasonCodes:
      extractStringArray(
        proposedChange?.reason_codes ??
          proposedChange?.reason_code ??
          record.reason_codes ??
          diagnostics.reason_codes,
      ).join(", ") || "N/A",
  };
}

function buildProofPackRows(
  proofPackPosture: Record<string, unknown>,
  itemRows: DpmWaveItemRow[]
): DpmWaveMetricRow[] {
  const refs = extractRecordArray(proofPackPosture.proof_pack_refs);
  if (refs.length > 0) {
    return refs.map((record, index) => ({
      key: readString(record, "proof_pack_id") || `proof-pack-${index + 1}`,
      label: readString(record, "proof_pack_id") || "Proof Pack",
      value: [
        readString(record, "wave_item_id"),
        readString(record, "proof_pack_state"),
        readString(record, "content_hash"),
      ]
        .filter(Boolean)
        .join(" | "),
    }));
  }
  return itemRows
    .filter((row) => row.proofPackId !== "N/A")
    .map((row) => ({
      key: row.proofPackId,
      label: row.proofPackId,
      value: `${row.waveItemId} | ${row.state}`,
    }));
}

function buildHandoffRows(proofPackPosture: Record<string, unknown>): DpmWaveMetricRow[] {
  return extractRecordArray(proofPackPosture.handoff_refs).map((record, index) => ({
    key: readString(record, "handoff_ref_id") || `handoff-${index + 1}`,
    label: readString(record, "handoff_ref_id") || "Handoff",
    value: [
      readString(record, "status"),
      readString(record, "content_hash"),
      formatValue(record.item_ids),
    ]
      .filter((value) => value !== "N/A")
      .join(" | "),
  }));
}

function readWaveRecord(data: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const wave = readRecord(data?.wave);
  return Object.keys(wave).length > 0 ? wave : null;
}

function firstRecord(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const record = readRecord(value);
    if (Object.keys(record).length > 0) {
      return record;
    }
  }
  return {};
}

function extractRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function extractWorkflowRecords(data: Record<string, unknown> | undefined): Record<string, unknown>[] {
  return readDpmCampaignWorkflowRecords(data);
}

function countNestedRecords(data: Record<string, unknown>, key: string): number {
  return (
    extractRecordArray(data[key]).length +
    extractWorkflowRecords(data).reduce(
      (count, record) => count + extractRecordArray(record[key]).length,
      0
    )
  );
}

function extractStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNonEmpty(values: string[] | undefined): string {
  return values?.find((value) => value.trim().length > 0) ?? "";
}

function formatStringList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "N/A";
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatValue(item)).join(", ") : "N/A";
  }
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return JSON.stringify(value);
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeState(state: string | undefined): string {
  return state?.trim().toUpperCase() || "UNKNOWN";
}
