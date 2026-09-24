import type {
  AdvisorIdeaReasonCode,
  AdvisorIdeaReviewAction,
} from "./idea-action-reasons";
import type { AdvisorIdeaFeedbackEvent } from "./idea-feedback";

export type {
  AdvisorIdeaReasonCode,
  AdvisorIdeaReviewAction,
} from "./idea-action-reasons";
export type {
  AdvisorIdeaFeedbackEvent,
  AdvisorIdeaFeedbackOutcome,
  AdvisorIdeaFeedbackReason,
  AdvisorIdeaFeedbackRequest,
} from "./idea-feedback";

export type ProposalSimulateResponse = {
  correlation_id: string;
  contract_version: string;
  data: {
    status?: string;
    proposal_run_id?: string;
    [key: string]: unknown;
  };
};

export type ProposalCreateRequest = {
  body: {
    created_by: string;
    simulate_request: Record<string, unknown>;
    metadata?: {
      title?: string;
      advisor_notes?: string;
      jurisdiction?: string;
      mandate_id?: string;
    };
  };
};

export type ProposalBodyRequest = {
  body: Record<string, unknown>;
};

export type AdvisoryWorkspaceEnvelopeResponse = {
  correlation_id: string;
  contract_version: string;
  data: Record<string, unknown>;
};

export type AdvisoryWorkspaceCreateRequest = {
  body: {
    workspace_name: string;
    created_by: string;
    input_mode: "stateful";
    stateful_input: {
      portfolio_id: string;
      as_of: string;
      household_id?: string;
      mandate_id?: string;
      benchmark_id?: string;
    };
  };
};

export type AdvisoryWorkspaceDraftActionRequest = {
  body: {
    actor_id: string;
    action_type:
      | "ADD_TRADE"
      | "UPDATE_TRADE"
      | "REMOVE_TRADE"
      | "ADD_CASH_FLOW"
      | "UPDATE_CASH_FLOW"
      | "REMOVE_CASH_FLOW"
      | "REPLACE_OPTIONS";
    workspace_trade_id?: string;
    workspace_cash_flow_id?: string;
    trade?: Record<string, unknown>;
    cash_flow?: Record<string, unknown>;
    options?: Record<string, unknown>;
  };
};

export type AdvisoryWorkspaceSaveRequest = {
  body: {
    saved_by: string;
    version_label?: string;
  };
};

export type AdvisoryWorkspaceHandoffRequest = {
  body: {
    handoff_by: string;
    metadata?: {
      title?: string;
      advisor_notes?: string;
      jurisdiction?: string;
      mandate_id?: string;
    };
  };
};

export type AdvisoryWorkspaceBodyRequest = {
  body: Record<string, unknown>;
};

export type ProposalEnvelopeResponse = {
  correlation_id: string;
  contract_version: string;
  data: Record<string, unknown>;
};

export type ProposalStateTransitionEnvelopeResponse = Omit<
  ProposalEnvelopeResponse,
  "data"
> & {
  data: {
    proposal_id: string;
    current_state: string;
    latest_workflow_event: ProposalWorkflowEvent;
    approval: ProposalApprovalRecord | null;
  };
};

export type AdvisoryPolicyEnvelopeResponse = {
  correlation_id: string;
  contract_version: string;
  data: Record<string, unknown>;
};

export type AdvisoryPolicyEvaluationRecord = {
  evaluation_id?: string;
  proposal_id?: string;
  proposal_version_id?: string;
  portfolio_id?: string;
  policy_pack_id?: string;
  policy_version?: string;
  evaluation_status?: string;
  source_refs?: string[];
  source_gaps?: string[];
  approval_dependencies?: string[];
  disclosure_requirements?: string[];
  consent_requirements?: string[];
  review_events_json?: Array<Record<string, unknown>>;
  sign_off_events_json?: Array<Record<string, unknown>>;
  report_archive_refs_json?: Array<Record<string, unknown>>;
  replay_metadata_json?: Record<string, unknown>;
  evaluation_json?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisoryPolicyReviewQueueData = {
  items?: AdvisoryPolicyEvaluationRecord[];
  queue_posture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisoryPolicyEvaluationData = AdvisoryPolicyEvaluationRecord;

export type AdvisoryPolicyRequirementProjection = {
  requirement_id?: string;
  requirement_type?: string;
  status?: string;
  owner_role?: string;
  review_sla?: string;
  due_at?: string | null;
  reason_codes?: string[];
  [key: string]: unknown;
};

export type AdvisoryPolicyWorkflowData = {
  evaluation_id?: string;
  proposal_id?: string;
  proposal_version_id?: string;
  evaluation_status?: string;
  approval_dependencies?: AdvisoryPolicyRequirementProjection[];
  disclosure_requirements?: AdvisoryPolicyRequirementProjection[];
  consent_requirements?: AdvisoryPolicyRequirementProjection[];
  conflict_posture?: Record<string, unknown>;
  sla_posture?: Record<string, unknown>;
  sign_off_status?: string;
  sign_off_blockers?: string[];
  maker_checker_required?: boolean;
  latest_sign_off_event?: Record<string, unknown> | null;
  client_ready_publication?: string;
  [key: string]: unknown;
};

export type AdvisoryPolicySignOffPackageData = {
  evaluation?: AdvisoryPolicyEvaluationRecord;
  lineage?: {
    evaluation_id?: string;
    source_refs?: string[];
    source_gaps?: string[];
    audit_events?: Array<Record<string, unknown>>;
    lineage_posture?: Record<string, unknown>;
    [key: string]: unknown;
  };
  package_posture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisoryPolicySignOffDecisionRequest = {
  body: {
    actor_id: string;
    decision:
      | "APPROVE_FOR_POLICY_SIGN_OFF"
      | "REQUEST_MORE_EVIDENCE"
      | "REJECT_POLICY_SIGN_OFF";
    source_evaluation_hash: string;
    resolved_approval_dependencies?: string[];
    satisfied_disclosure_requirements?: string[];
    satisfied_consent_requirements?: string[];
    conflict_review_outcome?: string | null;
    reason?: Record<string, unknown>;
  };
};

export type AdvisoryPolicySignOffDecisionData = {
  workflow?: AdvisoryPolicyWorkflowData;
  sign_off_event?: Record<string, unknown>;
  replay_metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisorCockpitOwnerRole =
  | "ADVISOR"
  | "DESK_HEAD"
  | "COMPLIANCE_REVIEWER"
  | "INVESTMENT_DESK"
  | "OPERATIONS"
  | "CRM_OWNER"
  | "REPORTING_OWNER"
  | "ARCHIVE_OWNER"
  | "EXECUTION_OWNER"
  | "DPM_OWNER"
  | "SYSTEM";

export type AdvisorCockpitActionStatus =
  | "READY"
  | "PENDING_REVIEW"
  | "BLOCKED"
  | "ACKNOWLEDGED"
  | "HANDOFF_REQUESTED"
  | "COMPLETED"
  | "SUPERSEDED";

export type AdvisorCockpitActionPriority =
  "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL";

export type AdvisorCockpitSlaAgeBand =
  | "NOT_DUE"
  | "DUE_SOON"
  | "DUE_NOW"
  | "OVERDUE"
  | "CRITICAL_OVERDUE"
  | "NOT_APPLICABLE";

export type AdvisorCockpitEvidenceRef = {
  evidence_id?: string;
  evidence_type?: string;
  source_system?: string;
  access_class?: string;
  summary?: string;
  [key: string]: unknown;
};

export type AdvisorCockpitSourceReadinessGap = {
  source_family?: string;
  gap_code?: string;
  owner_role?: AdvisorCockpitOwnerRole;
  message?: string;
  [key: string]: unknown;
};

export type AdvisorCockpitDependencyReadiness = {
  dependency?: string;
  state?: "READY" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED" | string;
  reason_code?: string;
  summary?: string;
  [key: string]: unknown;
};

export type AdvisorCockpitAcknowledgementState = {
  acknowledged?: boolean;
  acknowledgement_id?: string | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  acknowledgement_note?: string | null;
  [key: string]: unknown;
};

export type AdvisorCockpitActionItem = {
  action_item_id: string;
  action_item_version: number;
  action_family?: string;
  status: AdvisorCockpitActionStatus | string;
  priority: AdvisorCockpitActionPriority | string;
  owner_role: AdvisorCockpitOwnerRole | string;
  owning_system?: string;
  title: string;
  next_required_action?: string;
  reason_codes?: string[];
  portfolio_id?: string | null;
  proposal_id?: string | null;
  workspace_id?: string | null;
  memo_id?: string | null;
  policy_evaluation_id?: string | null;
  report_ref?: string | null;
  execution_ref?: string | null;
  due_at?: string | null;
  sla_age_band?: AdvisorCockpitSlaAgeBand | string;
  materiality_rank?: number;
  source_timestamp?: string | null;
  evidence_refs?: AdvisorCockpitEvidenceRef[];
  source_readiness_gaps?: AdvisorCockpitSourceReadinessGap[];
  dependency_readiness?: AdvisorCockpitDependencyReadiness[];
  lineage_refs?: Array<Record<string, unknown>>;
  acknowledgement_state?: AdvisorCockpitAcknowledgementState;
  unsupported_capabilities?: string[];
  correlation_id?: string | null;
  [key: string]: unknown;
};

export type AdvisorCockpitActionPageData = {
  items?: AdvisorCockpitActionItem[];
  next_cursor?: string | null;
  page_size?: number;
  total_count?: number | null;
  [key: string]: unknown;
};

export type AdvisorCockpitPreparationPacket = {
  packet_id?: string;
  context_type?: string;
  context_ref?: string;
  status?: string;
  evidence_refs?: AdvisorCockpitEvidenceRef[];
  sections?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type AdvisorCockpitPreparationPacketPageData = {
  items?: AdvisorCockpitPreparationPacket[];
  next_cursor?: string | null;
  page_size?: number;
  total_count?: number | null;
  supportability?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisorCockpitSnapshotData = {
  snapshot_id?: string;
  as_of?: string;
  action_counts?: Record<string, number>;
  top_priority_actions?: AdvisorCockpitActionItem[];
  preparation_packets?: AdvisorCockpitPreparationPacket[];
  dependency_readiness?: AdvisorCockpitDependencyReadiness[];
  source_readiness_gaps?: AdvisorCockpitSourceReadinessGap[];
  unsupported_capabilities?: string[];
  supportability?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisorCockpitSupportabilityData = {
  posture?: string;
  supportability?: Record<string, unknown>;
  unsupported_capabilities?: string[];
  [key: string]: unknown;
};

export type AdvisorCockpitEnvelopeResponse = {
  correlation_id: string;
  contract_version: string;
  data: Record<string, unknown>;
};

export type AdvisorCockpitAcknowledgeRequest = {
  action_item_version: number;
  acknowledgement_note?: string;
};

export type AdvisorCockpitAcknowledgeData = {
  action_item?: AdvisorCockpitActionItem;
  acknowledgement?: AdvisorCockpitAcknowledgementState;
  replayed?: boolean;
  audit?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisoryCopilotActionFamily =
  | "PROPOSAL_EXPLANATION"
  | "EVIDENCE_QA"
  | "MEETING_PREPARATION"
  | "COMPLIANCE_REVIEW_SUMMARY"
  | "OPERATIONS_REPORT_HANDOFF"
  | "CLIENT_FOLLOW_UP_DRAFT";

export type AdvisoryCopilotAudience =
  | "ADVISOR"
  | "DESK_HEAD"
  | "COMPLIANCE_REVIEWER"
  | "OPERATIONS_SUPPORT"
  | "MODEL_RISK_OPERATOR";

export type AdvisoryCopilotEnvelopeResponse = {
  correlation_id: string;
  contract_version: string;
  data: Record<string, unknown>;
};

export type AdvisoryCopilotEvidencePacketRequest = {
  proposal_id: string;
  proposal_version_no: number;
  evidence_packet_id?: string;
  action_family: AdvisoryCopilotActionFamily;
  audience: AdvisoryCopilotAudience;
  created_by: string;
  reason?: Record<string, unknown>;
};

export type AdvisoryCopilotActionRequest = {
  evidence_packet_id: string;
  audience: AdvisoryCopilotAudience;
  requested_outputs: string[];
  requested_by: string;
  reason?: Record<string, unknown>;
  requested_intents?: string[];
  user_instruction?: string;
};

export type AdvisoryCopilotResourceScope = {
  proposal_id: string;
  portfolio_id: string;
};

export type AdvisoryCopilotReviewRequest = {
  action:
    | "APPROVE_FOR_INTERNAL_USE"
    | "REJECT"
    | "REQUEST_CHANGES"
    | "SUPERSEDE"
    | "EXPIRE";
  actor_id?: string;
  reason?: Record<string, unknown>;
};

export type AdvisoryCopilotSourceRef = {
  source_system?: string;
  source_type?: string;
  source_id?: string;
  content_hash?: string | null;
  access_class?: string;
  [key: string]: unknown;
};

export type AdvisoryCopilotEvidencePacketData = {
  evidence_packet?: {
    evidence_packet_id?: string;
    evidence_packet_hash?: string;
    action_family?: AdvisoryCopilotActionFamily | string;
    portfolio_id?: string;
    proposal_id?: string | null;
    sections?: Array<{
      section_key?: string;
      title?: string;
      summary_items?: string[];
      source_refs?: AdvisoryCopilotSourceRef[];
      [key: string]: unknown;
    }>;
    unsupported_evidence?: Array<{
      reason_code?: string;
      advisor_message?: string;
      [key: string]: unknown;
    }>;
    client_ready_publication?: string;
    [key: string]: unknown;
  };
  record?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdvisoryCopilotRunData = {
  run?: {
    run_id?: string;
    action_family?: AdvisoryCopilotActionFamily | string;
    evidence_packet_id?: string;
    evidence_packet_hash?: string;
    portfolio_id?: string;
    proposal_id?: string;
    output_hash?: string;
    review_posture?: string;
    client_ready_publication?: string;
    created_at?: string;
    updated_at?: string;
    lotus_ai_workflow_run_id?: string | null;
    lotus_ai_model_version?: string | null;
    workflow_pack_id?: string;
    workflow_pack_version?: string;
    prompt_template_version?: string;
    output_schema_version?: string;
    evaluation_pack_ref?: string;
    lineage_json?: Record<string, unknown>;
    output_sections_json?: Array<{
      section_key?: string;
      title?: string;
      text?: string;
      review_state?: string;
      [key: string]: unknown;
    }>;
    review_guidance_json?: string[];
    guardrail_results_json?: string[];
    [key: string]: unknown;
  };
  reviews?: AdvisoryCopilotReviewRecord[];
  replayed?: boolean;
  [key: string]: unknown;
};

export type AdvisoryCopilotReviewRecord = {
  review_id?: string;
  run_id?: string;
  action?: string;
  previous_review_posture?: string;
  new_review_posture?: string;
  actor_id?: string;
  occurred_at?: string;
  [key: string]: unknown;
};

export type AdvisoryCopilotReviewData = {
  run?: AdvisoryCopilotRunData["run"];
  review: AdvisoryCopilotReviewRecord;
  replayed?: boolean;
  [key: string]: unknown;
};

export type AdvisoryCopilotSupportabilityData = {
  support_status?: string;
  client_ready_publication?: string;
  supported_action_families?: AdvisoryCopilotActionFamily[];
  boundaries?: string[];
  [key: string]: unknown;
};

export type BankDemoProofEnvelopeResponse = {
  correlationId?: string;
  correlation_id?: string;
  contractVersion?: string;
  contract_version?: string;
  data: Record<string, unknown>;
};

export type BankDemoScenarioStep = {
  step_id?: string;
  title?: string;
  owner_repository?: string;
  required_evidence_refs?: string[];
  required_workbench_panels?: string[];
  [key: string]: unknown;
};

export type BankDemoScenarioContractData = {
  contract_name?: string;
  contract_version?: string;
  scenario_id?: string;
  primary_portfolio_id?: string;
  governed_as_of_date?: string;
  proof_marker?: string;
  required_evidence_markers?: string[];
  required_source_products?: string[];
  unsupported_boundaries?: string[];
  steps?: BankDemoScenarioStep[];
  [key: string]: unknown;
};

export type BankDemoSupportedClaimClassification =
  | "IMPLEMENTATION_BACKED"
  | "BACKEND_BACKED_UI_PENDING"
  | "DEGRADED_SUPPORTED"
  | "PLANNED_RFC"
  | "UNSUPPORTED"
  | string;

export type BankDemoSupportedClaim = {
  claim_id?: string;
  title?: string;
  classification?: BankDemoSupportedClaimClassification;
  audiences?: string[];
  allowed_materials?: string[];
  claim_text?: string;
  evidence_refs?: string[];
  proof_requirements?: Array<{
    requirement_id?: string;
    evidence_ref?: string;
    blocking?: boolean;
    [key: string]: unknown;
  }>;
  wording_rules?: string[];
  [key: string]: unknown;
};

export type BankDemoSupportedClaimRegisterData = {
  contract_name?: string;
  contract_version?: string;
  scenario_id?: string;
  primary_portfolio_id?: string;
  proof_marker?: string;
  claims?: BankDemoSupportedClaim[];
  artifact_policy?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalSummary = {
  proposal_id: string;
  portfolio_id?: string;
  current_state: string;
  current_version_no?: number;
  title?: string | null;
  created_by?: string;
  created_at?: string;
};

export type ProposalListData = {
  items: ProposalSummary[];
  next_cursor?: string | null;
};

export type IdeaCandidateSummary = {
  candidateId: string;
  materialVersion?: number;
  evidenceVersion?: number;
  family?: string;
  lifecycleStatus?: string;
  reviewPosture?: string;
  evidencePacketId?: string;
  score?: string | null;
  scorePolicyVersion?: string | null;
  sourceSignalIds?: string[];
  reasonCodes?: string[];
  [key: string]: unknown;
};

export type AdvisorIdeaQueueItem = {
  rank?: number;
  candidate?: IdeaCandidateSummary;
  score?: string | null;
  priorityBucket?: string;
  policyVersion?: string;
  reasonCodes?: string[];
  [key: string]: unknown;
};

export type AdvisorIdeaReviewQueueData = {
  policyVersion?: string;
  evaluatedAtUtc?: string;
  items?: AdvisorIdeaQueueItem[];
  exclusions?: Array<Record<string, unknown>>;
  durableStorageBacked?: boolean;
  supportedFeaturePromoted?: boolean;
  [key: string]: unknown;
};

export type AdvisorIdeaCandidateDetailData = {
  candidate?: IdeaCandidateSummary;
  evidence?: {
    evidencePacketId?: string;
    evidenceContentHash?: string;
    sourceRevisionVectorDigest?: string;
    sourceCutPosture?: string;
    supportability?: string;
    lineageId?: string;
    sourceRefs?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
  lifecycleHistory?: Array<Record<string, unknown>>;
  reviewDecisions?: AdvisorIdeaReviewDecision[];
  feedbackEvents?: Array<Record<string, unknown>>;
  conversionIntents?: Array<Record<string, unknown>>;
  conversionOutcomes?: Array<Record<string, unknown>>;
  reportEvidencePacks?: Array<Record<string, unknown>>;
  auditSummary?: {
    eventCount?: number;
    latestEventType?: string;
    latestEventOutcome?: string;
    latestOccurredAtUtc?: string;
    [key: string]: unknown;
  };
  durableStorageBacked?: boolean;
  supportedFeaturePromoted?: boolean;
  [key: string]: unknown;
};

export type AdvisorIdeaReviewActionRequest = {
  reviewId: string;
  action: AdvisorIdeaReviewAction;
  reasonCodes: AdvisorIdeaReasonCode[];
  decidedAtUtc: string;
  reviewChannel: "workbench";
  expectedMaterialVersion: number;
  expectedEvidenceVersion: number;
  expectedEvidencePacketId: string;
  expectedEvidenceContentHash: `sha256:${string}`;
  expectedSourceRevisionVectorDigest: `sha256:${string}`;
  expectedSourceCutPosture:
    | "coherent"
    | "coherent_with_declared_tolerance"
    | "mixed"
    | "partial"
    | "unknown";
  presentationReceiptId: string;
  suppressionReason?:
    | "duplicate"
    | "recently_rejected"
    | "below_materiality"
    | "unsupported_evidence"
    | "manual_suppression";
  snoozedUntilUtc?: string;
};

export type AdvisorIdeaConversionIntentRequest = {
  conversionIntentId: string;
  target: "advise_proposal" | "manage_review" | "report_evidence";
  reasonCodes: AdvisorIdeaReasonCode[];
  requestedAtUtc: string;
  expectedReviewId: string;
  expectedMaterialVersion: number;
  expectedEvidenceVersion: number;
  expectedEvidencePacketId: string;
  expectedEvidenceContentHash: `sha256:${string}`;
  expectedSourceRevisionVectorDigest: `sha256:${string}`;
  expectedSourceCutPosture: AdvisorIdeaReviewActionRequest["expectedSourceCutPosture"];
};

export type AdvisorIdeaReviewDecision = {
  reviewId?: string;
  candidateId?: string;
  evidencePacketId?: string;
  evidenceContentHash?: string;
  sourceRevisionVectorDigest?: string;
  sourceCutPosture?: string;
  candidateMaterialVersion?: number;
  candidateEvidenceVersion?: number;
  reviewChannel?: string;
  presentationReceiptId?: string | null;
  action?: string;
  resultingPosture?: string;
  reasonCodes?: string[];
  decidedAtUtc?: string;
  acceptedAtUtc?: string;
  acceptanceTimeSource?: string;
  grantsDownstreamAuthority?: boolean;
  [key: string]: unknown;
};

export type AdvisorIdeaConversionIntent = {
  conversionIntentId?: string;
  candidateId?: string;
  target?: string;
  evidencePacketId?: string;
  evidenceContentHash?: string;
  sourceRevisionVectorDigest?: string;
  sourceCutPosture?: string;
  reviewId?: string;
  candidateMaterialVersion?: number;
  candidateEvidenceVersion?: number;
  reasonCodes?: string[];
  requestedAtUtc?: string;
  acceptedAtUtc?: string;
  acceptanceTimeSource?: string;
  boundary?: string;
  grantsDownstreamAuthority?: boolean;
  [key: string]: unknown;
};

export type AdvisorIdeaCandidateActionData = {
  feedbackEvent?: AdvisorIdeaFeedbackEvent;
  reviewDecision?: AdvisorIdeaReviewDecision;
  conversionIntent?: AdvisorIdeaConversionIntent;
  persistence?: {
    decision?: string;
    lifecycleStatus?: string;
    reviewPosture?: string;
    auditEventType?: string;
    [key: string]: unknown;
  };
  durableStorageBacked?: boolean;
  supportedFeaturePromoted?: boolean;
  [key: string]: unknown;
};

export type ProposalDetailData = {
  proposal: ProposalSummary;
  current_version?: {
    version_no?: number;
    status_at_creation?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ProposalVersionData = {
  proposal_id?: string;
  version_no?: number;
  status_at_creation?: string;
  created_at?: string;
  artifact_hash?: string;
  [key: string]: unknown;
};

export type ProposalLineageData = {
  proposal_id?: string;
  versions?: Array<{
    version_no?: number;
    request_hash?: string;
    simulation_hash?: string;
    artifact_hash?: string;
    created_at?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type ProposalSubmitRequest = {
  actor_id: string;
  expected_state: string;
  review_type: "RISK" | "COMPLIANCE";
  reason?: Record<string, unknown>;
  related_version_no?: number;
};

export type ProposalApprovalActionRequest = {
  actor_id: string;
  expected_state: string;
  details?: Record<string, unknown>;
  related_version_no?: number;
};

export type ProposalWorkflowEvent = {
  event_id: string;
  proposal_id?: string | null;
  event_type: string;
  from_state?: string | null;
  to_state: string;
  actor_id: string;
  occurred_at: string;
};

export type ProposalWorkflowEventsData = {
  proposal_id: string;
  current_state: string;
  events: ProposalWorkflowEvent[];
};

export type ProposalApprovalRecord = {
  approval_id: string;
  proposal_id?: string | null;
  approval_type: string;
  approved: boolean;
  actor_id: string;
  occurred_at: string;
};

export type ProposalApprovalsData = {
  proposal_id: string;
  current_state: string;
  approvals: ProposalApprovalRecord[];
};

export type ProposalNarrativeReviewRequest = {
  action: "APPROVE" | "REJECT" | "REQUEST_REGENERATION";
  reviewed_by: string;
  reason: string;
  client_ready_release_requested?: boolean;
  replacement_narrative_id?: string;
};

export type ProposalReportRequest = {
  report_type: string;
  requested_by: string;
  related_version_no?: number;
  include_execution_summary?: boolean;
  include_reviewed_narrative?: boolean;
};

export type ProposalNarrativeReviewData = {
  narrative_review?: {
    review_id?: string;
    proposal_id?: string;
    proposal_version_no?: number;
    narrative_id?: string;
    review_state?: string;
    action?: string;
    source_narrative_hash?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    client_ready_status?: string | null;
    [key: string]: unknown;
  };
  proposal_narrative?: {
    policy_version?: string | null;
    [key: string]: unknown;
  };
  policy_version?: string | null;
  audience?: string | null;
  [key: string]: unknown;
};

export type ProposalReportRequestData = {
  report_request_id?: string;
  status?: string;
  report_type?: string;
  report_reference_id?: string | null;
  generated_at?: string | null;
  explanation?: {
    related_version_no?: number | null;
    include_reviewed_narrative?: boolean;
    proposal_narrative_package?: {
      package_status?: string;
      review_state?: string;
      source_narrative_hash?: string | null;
      related_version_no?: number | null;
      proposal_version_no?: number | null;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ProposalDeliverySummaryData = {
  proposal?: ProposalSummary;
  reporting?: {
    status?: string;
    report_request_id?: string;
    report_type?: string;
    report_reference_id?: string | null;
    generated_at?: string | null;
    requested_by?: string | null;
    related_version_no?: number | null;
    include_reviewed_narrative?: boolean;
    proposal_narrative_package?: {
      package_status?: string;
      review_state?: string;
      source_narrative_hash?: string | null;
      related_version_no?: number | null;
      proposal_version_no?: number | null;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  reporting_summary?: {
    related_version_no?: number | null;
    include_reviewed_narrative?: boolean;
    source_narrative_hash?: string | null;
    [key: string]: unknown;
  };
  explanation?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalDeliveryEvent = {
  event_id?: string;
  proposal_id?: string;
  related_version_no?: number | null;
  event_type?: string;
  to_state?: string;
  occurred_at?: string;
  actor_id?: string;
  reason?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalDeliveryEventsData = {
  proposal?: ProposalSummary;
  proposal_id?: string;
  event_count?: number;
  latest_event?: ProposalDeliveryEvent;
  events?: ProposalDeliveryEvent[];
  explanation?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalMemoCreateRequest = {
  created_by: string;
  lifecycle_status?: string;
  reason?: Record<string, unknown>;
};

export type ProposalMemoReviewRequest = {
  action: "APPROVE_FOR_ADVISOR_USE" | "REJECT" | "REQUEST_CHANGES";
  reviewed_by: string;
  reason: string;
  source_memo_hash: string;
  client_ready_release_requested?: boolean;
};

export type ProposalMemoReportPackageRequest = {
  requested_by: string;
  source_memo_hash: string;
  requested_output_formats?: string[];
  client_ready_document_requested?: boolean;
  reason?: Record<string, unknown>;
};

export type ProposalMemoAiCommentaryRequest = {
  requested_by: string;
  source_memo_hash: string;
  requested_sections?: string[];
  reason?: Record<string, unknown>;
};

export type ProposalMemoAdvisorCommentaryRequest =
  ProposalMemoAiCommentaryRequest;

export type ProposalMemoData = {
  proposal?: ProposalSummary;
  proposal_version_no?: number;
  memo_id?: string;
  memo_status?: string;
  lifecycle_status?: string;
  memo_hash?: string;
  memo?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  review_posture?: Record<string, unknown>;
  report_package_posture?: Record<string, unknown>;
  ai_commentary_posture?: Record<string, unknown>;
  replay_metadata?: Record<string, unknown>;
  audit_events?: Array<Record<string, unknown>>;
  event_count?: number;
  read_posture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalMemoProjectionData = {
  proposal?: ProposalSummary;
  proposal_version_no?: number;
  memo_id?: string;
  memo_hash?: string;
  audience?: string | null;
  projection?: Record<string, unknown>;
  sections?: Array<Record<string, unknown>>;
  projection_posture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalMemoAuditEvent = {
  event_id?: string;
  event_type?: string;
  actor_id?: string;
  occurred_at?: string;
  reason?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalMemoReviewData = {
  memo?: ProposalMemoData;
  review_event?: ProposalMemoAuditEvent;
  replayed?: boolean;
  [key: string]: unknown;
};

export type ProposalMemoReportPackageData = {
  memo?: ProposalMemoData;
  report_package_event?: ProposalMemoAuditEvent;
  report?: Record<string, unknown>;
  replayed?: boolean;
  [key: string]: unknown;
};

export type ProposalMemoAiCommentaryData = {
  memo?: ProposalMemoData;
  ai_event?: ProposalMemoAuditEvent;
  commentary?: Record<string, unknown>;
  replayed?: boolean;
  [key: string]: unknown;
};

export type ProposalMemoAdvisorCommentaryData = ProposalMemoAiCommentaryData;

export type ProposalMemoLineageData = {
  proposal?: ProposalSummary;
  proposal_id?: string;
  memo_count?: number;
  latest_memo_id?: string | null;
  lineage_complete?: boolean;
  memos?: Array<{
    memo_id?: string;
    proposal_version_no?: number;
    proposal_version_id?: string | null;
    memo_hash?: string;
    memo_status?: string;
    lifecycle_status?: string;
    source_input_hash?: string;
    created_at?: string;
    event_count?: number;
    report_package_posture?: Record<string, unknown>;
    archive_refs?: Array<Record<string, unknown>>;
    ai_commentary_posture?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  lineage_posture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProposalMemoReplayEvidenceData = {
  subject?: {
    proposal_id?: string;
    proposal_version_no?: number;
    proposal_version_id?: string | null;
    memo_id?: string;
    [key: string]: unknown;
  };
  hashes?: Record<string, unknown>;
  replay_metadata?: Record<string, unknown>;
  audit_events?: Array<Record<string, unknown>>;
  evidence?: Record<string, unknown>;
  explanation?: Record<string, unknown>;
  [key: string]: unknown;
};
