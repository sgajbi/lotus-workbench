import {
  buildWorkbenchUrl,
  fetchWorkbenchMutation,
  fetchWorkbenchResource,
  observeWorkbenchMutation,
  observeWorkbenchResource,
  type WorkbenchRequestTarget,
  type WorkbenchObservedOperation,
} from "@/features/workbench/api-client";
import { getDpmAiWorkflowProfile } from "@/features/workbench/dpm-ai-workflow-profiles";
import type {
  DpmCampaignApprovalDecisionBody,
  DpmCampaignAssignmentActionBody,
  DpmCampaignAssignmentTaskBody,
  DpmCampaignMakerCheckerBody,
  DpmCampaignRetirementBody,
  DpmCampaignSupersessionBody,
  DpmCampaignTaskTransitionBody,
} from "@/features/workbench/dpm-campaign-command-contracts";
import {
  resolveDefaultCallerContext,
  resolveDefaultDpmContext,
} from "@/features/workbench/caller-context";
import type {
  DpmCampaignDefinitionGatewayResponse,
  DpmCampaignWorkflowGatewayResponse,
  DpmOperationsHandoffSummaryResponse,
  DpmWaveAiPmMemoResponse,
  DpmWaveGatewayResponse,
} from "@/features/workbench/types";

function buildDpmWaveCallerHeaders(actorId?: string): Record<string, string> {
  const callerContext = resolveDefaultCallerContext();
  return {
    "Content-Type": "application/json",
    "X-Actor-Id": actorId ?? callerContext.actorId,
    "X-Caller-Application": "lotus-workbench",
    "X-Correlation-Id": "corr-workbench-dpm-wave",
  };
}

function buildExplicitPortfolioWaveBody(params: {
  portfolioId: string;
  asOfDate?: string;
  actorId?: string;
  rationale?: string;
}): {
  trigger_type: string;
  trigger_id: string;
  rationale: string;
  as_of_date: string;
  actor_id: string;
  portfolios: Array<{ portfolio_id: string }>;
} {
  const dpmContext = resolveDefaultDpmContext();
  const callerContext = resolveDefaultCallerContext();
  const asOfDate = params.asOfDate ?? dpmContext.commandCenterAsOfDate;
  return {
    trigger_type: "EXPLICIT_PORTFOLIO_LIST",
    trigger_id: `workbench-wave-${params.portfolioId}-${asOfDate}`,
    rationale:
      params.rationale ??
      "Workbench PM requested a Gateway-backed explicit portfolio-list rebalance wave.",
    as_of_date: asOfDate,
    actor_id: params.actorId ?? callerContext.actorId,
    portfolios: [{ portfolio_id: params.portfolioId }],
  };
}

function buildDpmWaveWorkflowBody(reasonCode: string): {
  actor_id: string;
  reason_code: string;
  comment: string;
} {
  return {
    actor_id: resolveDefaultCallerContext().actorId,
    reason_code: reasonCode,
    comment: "Workbench Gateway-backed rebalance-wave command-center action.",
  };
}

async function runDpmWaveWorkflowAction(
  waveId: string,
  actionPath: "approve" | "stage" | "handoff",
  operation: WorkbenchObservedOperation,
  label: string,
  body: Record<string, unknown>
): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchMutation(
    operation,
    async () =>
      await fetchWorkbenchMutation<DpmWaveGatewayResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/${encodeURIComponent(waveId)}/${actionPath}`
        ),
        label,
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(),
          body: JSON.stringify({ body }),
        }
      )
  );
}

export async function listDpmWaves(params?: {
  state?: string;
  triggerType?: string;
  asOfDate?: string;
  supportabilityState?: string;
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "server", signal?: AbortSignal): Promise<DpmWaveGatewayResponse> {
  const dpmContext = resolveDefaultDpmContext();
  const query = new URLSearchParams();
  query.set("trigger_type", params?.triggerType ?? "EXPLICIT_PORTFOLIO_LIST");
  query.set("as_of_date", params?.asOfDate ?? dpmContext.commandCenterAsOfDate);
  query.set("limit", String(params?.limit ?? 10));
  query.set("offset", String(params?.offset ?? 0));
  if (params?.state) {
    query.set("state", params.state);
  }
  if (params?.supportabilityState) {
    query.set("supportability_state", params.supportabilityState);
  }
  return await observeWorkbenchResource(
    "dpm.waves.list",
    async () =>
      await fetchWorkbenchResource<DpmWaveGatewayResponse>(
        target,
        "/dpm/command-center/waves",
        "DPM rebalance waves",
        query,
        { signal },
      )
  );
}

export async function listDpmCampaignDefinitions(params?: {
  campaignId?: string;
  campaignStatus?: "ACTIVE" | "RETIRED";
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "server"): Promise<DpmCampaignDefinitionGatewayResponse> {
  const query = new URLSearchParams();
  query.set("limit", String(params?.limit ?? 10));
  query.set("offset", String(params?.offset ?? 0));
  if (params?.campaignId) {
    query.set("campaign_id", params.campaignId);
  }
  if (params?.campaignStatus) {
    query.set("campaign_status", params.campaignStatus);
  }
  return await observeWorkbenchResource(
    "dpm.waves.campaign-definitions.list",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        target,
        "/dpm/command-center/waves/campaign-definitions",
        "DPM campaign definitions",
        query
      )
  );
}

export async function getDpmCampaignDefinition(
  params: { campaignId: string; campaignVersion: string },
  target: WorkbenchRequestTarget = "server",
): Promise<DpmCampaignDefinitionGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.campaign-definitions.get",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        target,
        `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(params.campaignId)}/versions/${encodeURIComponent(params.campaignVersion)}`,
        "DPM campaign definition",
      ),
  );
}

export async function listDpmCampaignDiscovery(params?: {
  campaignId?: string;
  campaignStatus?: "ACTIVE" | "RETIRED" | "SUPERSEDED";
  asOfDate?: string;
  activeOn?: string;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}): Promise<DpmCampaignDefinitionGatewayResponse> {
  const query = new URLSearchParams();
  query.set("limit", String(params?.limit ?? 10));
  query.set("offset", String(params?.offset ?? 0));
  query.set("campaign_status", params?.campaignStatus ?? "ACTIVE");
  if (params?.campaignId) {
    query.set("campaign_id", params.campaignId);
  }
  if (params?.asOfDate) {
    query.set("as_of_date", params.asOfDate);
  }
  if (params?.activeOn) {
    query.set("active_on", params.activeOn);
  }
  if (params?.includeExpired !== undefined) {
    query.set("include_expired", String(params.includeExpired));
  }
  return await observeWorkbenchResource(
    "dpm.waves.campaign-discovery.list",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        "server",
        "/dpm/command-center/waves/campaign-discovery",
        "DPM campaign discovery",
        query
      )
  );
}

export async function getDpmCampaignDefinitionLifecycleEvents(params: {
  campaignId: string;
  campaignVersion: string;
}, target: WorkbenchRequestTarget = "client"): Promise<DpmCampaignDefinitionGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.campaign-definitions.lifecycle-events",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        target,
        `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
          params.campaignId
        )}/versions/${encodeURIComponent(params.campaignVersion)}/lifecycle-events`,
        "DPM campaign-definition lifecycle evidence"
      )
  );
}

export async function getDpmCampaignDefinitionPreviewReadiness(params: {
  campaignId: string;
  campaignVersion: string;
  requestedAsOfDate?: string;
  actorId?: string;
}): Promise<DpmCampaignDefinitionGatewayResponse> {
  const dpmContext = resolveDefaultDpmContext();
  const callerContext = resolveDefaultCallerContext();
  const requestedAsOfDate = params.requestedAsOfDate ?? dpmContext.commandCenterAsOfDate;
  const actorId = params.actorId ?? callerContext.actorId;
  const query = new URLSearchParams();
  query.set("requested_as_of_date", requestedAsOfDate);
  query.set("actor_id", actorId);
  return await observeWorkbenchResource(
    "dpm.waves.campaign-definitions.preview-readiness",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        "client",
        `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
          params.campaignId
        )}/versions/${encodeURIComponent(params.campaignVersion)}/preview-readiness`,
        "DPM campaign-definition preview readiness",
        query
      )
  );
}

export async function getDpmCampaignDefinitionLaunchHistory(params: {
  campaignId: string;
  campaignVersion: string;
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "client"): Promise<DpmCampaignDefinitionGatewayResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }
  const query = searchParams.toString();
  return await observeWorkbenchResource(
    "dpm.waves.campaign-definitions.launch-history",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        target,
        `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
          params.campaignId
        )}/versions/${encodeURIComponent(params.campaignVersion)}/launch-history${
          query ? `?${query}` : ""
        }`,
        "DPM campaign-definition launch history"
      )
  );
}

async function runDpmCampaignDefinitionLifecycleCommand<TBody extends object>(
  operation: WorkbenchObservedOperation,
  actionPath: "retire" | "supersede",
  label: string,
  params: {
    campaignId: string;
    campaignVersion: string;
    body: TBody;
    actorId?: string;
  }
): Promise<DpmCampaignDefinitionGatewayResponse> {
  return await observeWorkbenchMutation(
    operation,
    async () =>
      await fetchWorkbenchMutation<DpmCampaignDefinitionGatewayResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
            params.campaignId
          )}/versions/${encodeURIComponent(params.campaignVersion)}/${actionPath}`
        ),
        label,
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(params.actorId),
          body: JSON.stringify({ body: params.body }),
        }
      )
  );
}

export async function retireDpmCampaignDefinition(params: {
  campaignId: string;
  campaignVersion: string;
  body: DpmCampaignRetirementBody;
  actorId?: string;
}): Promise<DpmCampaignDefinitionGatewayResponse> {
  return await runDpmCampaignDefinitionLifecycleCommand(
    "dpm.waves.campaign-definitions.retire",
    "retire",
    "retire DPM campaign definition",
    params
  );
}

export async function supersedeDpmCampaignDefinition(params: {
  campaignId: string;
  campaignVersion: string;
  body: DpmCampaignSupersessionBody;
  actorId?: string;
}): Promise<DpmCampaignDefinitionGatewayResponse> {
  return await runDpmCampaignDefinitionLifecycleCommand(
    "dpm.waves.campaign-definitions.supersede",
    "supersede",
    "supersede DPM campaign definition",
    params
  );
}

function appendOptionalCampaignWorkflowQuery(
  query: URLSearchParams,
  params?: {
    campaignId?: string;
    campaignVersion?: string;
    state?: string;
    limit?: number;
    offset?: number;
  }
): URLSearchParams {
  query.set("limit", String(params?.limit ?? 10));
  query.set("offset", String(params?.offset ?? 0));
  if (params?.campaignId) {
    query.set("campaign_id", params.campaignId);
  }
  if (params?.campaignVersion) {
    query.set("campaign_version", params.campaignVersion);
  }
  if (params?.state) {
    query.set("state", params.state);
  }
  return query;
}

async function listDpmCampaignWorkflowResource(
  operation: WorkbenchObservedOperation,
  path: string,
  label: string,
  params?: {
    campaignId?: string;
    campaignVersion?: string;
    state?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DpmCampaignWorkflowGatewayResponse> {
  const query = appendOptionalCampaignWorkflowQuery(new URLSearchParams(), params);
  return await observeWorkbenchResource(
    operation,
    async () =>
      await fetchWorkbenchResource<DpmCampaignWorkflowGatewayResponse>(
        "server",
        path,
        label,
        query
      )
  );
}

export async function listDpmCampaignOperatingQueue(params?: {
  campaignId?: string;
  campaignVersion?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await listDpmCampaignWorkflowResource(
    "dpm.waves.campaign-operating-queue.list",
    "/dpm/command-center/waves/campaign-operating-queue",
    "DPM campaign operating queue",
    params
  );
}

export async function listDpmCampaignApprovalInbox(params?: {
  campaignId?: string;
  campaignVersion?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await listDpmCampaignWorkflowResource(
    "dpm.waves.campaign-approval-inbox.list",
    "/dpm/command-center/waves/campaign-approval-inbox",
    "DPM campaign approval inbox",
    params
  );
}

export async function listDpmCampaignWorkflowBoard(params?: {
  campaignId?: string;
  campaignVersion?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await listDpmCampaignWorkflowResource(
    "dpm.waves.campaign-workflow-board.list",
    "/dpm/command-center/waves/campaign-workflow-board",
    "DPM campaign workflow board",
    params
  );
}

export async function listDpmCampaignAssignmentPlan(params?: {
  campaignId?: string;
  campaignVersion?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await listDpmCampaignWorkflowResource(
    "dpm.waves.campaign-assignment-plan.list",
    "/dpm/command-center/waves/campaign-assignment-plan",
    "DPM campaign assignment plan",
    params
  );
}

export async function listDpmCampaignWorkflowAutomation(params?: {
  campaignId?: string;
  campaignVersion?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await listDpmCampaignWorkflowResource(
    "dpm.waves.campaign-workflow-automation.list",
    "/dpm/command-center/waves/campaign-workflow-automation",
    "DPM campaign workflow automation",
    params
  );
}

async function getDpmCampaignWorkflowEvidence(
  operation: WorkbenchObservedOperation,
  pathSuffix: string,
  label: string,
  params: {
    campaignId: string;
    campaignVersion: string;
    limit?: number;
    offset?: number;
  },
  target: WorkbenchRequestTarget,
): Promise<DpmCampaignWorkflowGatewayResponse> {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 10));
  query.set("offset", String(params.offset ?? 0));
  return await observeWorkbenchResource(
    operation,
    async () =>
      await fetchWorkbenchResource<DpmCampaignWorkflowGatewayResponse>(
        target,
        `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
          params.campaignId
        )}/versions/${encodeURIComponent(params.campaignVersion)}/${pathSuffix}`,
        label,
        query
      )
  );
}

async function createDpmCampaignWorkflowEvidence<TBody extends object>(
  operation: WorkbenchObservedOperation,
  pathSuffix: string,
  label: string,
  params: {
    campaignId: string;
    campaignVersion: string;
    body: TBody;
    actorId?: string;
  }
): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await observeWorkbenchMutation(
    operation,
    async () =>
      await fetchWorkbenchMutation<DpmCampaignWorkflowGatewayResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
            params.campaignId
          )}/versions/${encodeURIComponent(params.campaignVersion)}/${pathSuffix}`
        ),
        label,
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(params.actorId),
          body: JSON.stringify({ body: params.body }),
        }
      )
  );
}

export async function getDpmCampaignApprovalDecisions(params: {
  campaignId: string;
  campaignVersion: string;
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "server"): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await getDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-approval-decisions.list",
    "approval-decisions",
    "DPM campaign approval decisions",
    params,
    target,
  );
}

export async function createDpmCampaignApprovalDecision(params: {
  campaignId: string;
  campaignVersion: string;
  body: DpmCampaignApprovalDecisionBody;
  actorId?: string;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await createDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-approval-decisions.create",
    "approval-decisions",
    "create DPM campaign approval decision",
    params
  );
}

export async function getDpmCampaignAssignmentActions(params: {
  campaignId: string;
  campaignVersion: string;
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "server"): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await getDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-assignment-actions.list",
    "assignment-actions",
    "DPM campaign assignment actions",
    params,
    target,
  );
}

export async function createDpmCampaignAssignmentAction(params: {
  campaignId: string;
  campaignVersion: string;
  body: DpmCampaignAssignmentActionBody;
  actorId?: string;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await createDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-assignment-actions.create",
    "assignment-actions",
    "create DPM campaign assignment action",
    params
  );
}

export async function getDpmCampaignAssignmentTasks(params: {
  campaignId: string;
  campaignVersion: string;
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "server"): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await getDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-assignment-tasks.list",
    "assignment-tasks",
    "DPM campaign assignment tasks",
    params,
    target,
  );
}

export async function createDpmCampaignAssignmentTask(params: {
  campaignId: string;
  campaignVersion: string;
  body: DpmCampaignAssignmentTaskBody;
  actorId?: string;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await createDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-assignment-tasks.create",
    "assignment-tasks",
    "create DPM campaign assignment task",
    params
  );
}

export async function createDpmCampaignAssignmentTaskTransition(params: {
  campaignId: string;
  campaignVersion: string;
  taskRef: string;
  body: DpmCampaignTaskTransitionBody;
  actorId?: string;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await createDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-assignment-task-transitions.create",
    `assignment-tasks/${encodeURIComponent(params.taskRef)}/transitions`,
    "create DPM campaign assignment-task transition",
    params
  );
}

export async function getDpmCampaignMakerCheckerControls(params: {
  campaignId: string;
  campaignVersion: string;
  limit?: number;
  offset?: number;
}, target: WorkbenchRequestTarget = "server"): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await getDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-maker-checker-controls.list",
    "maker-checker-controls",
    "DPM campaign maker-checker controls",
    params,
    target,
  );
}

export async function createDpmCampaignMakerCheckerControl(params: {
  campaignId: string;
  campaignVersion: string;
  body: DpmCampaignMakerCheckerBody;
  actorId?: string;
}): Promise<DpmCampaignWorkflowGatewayResponse> {
  return await createDpmCampaignWorkflowEvidence(
    "dpm.waves.campaign-maker-checker-controls.create",
    "maker-checker-controls",
    "create DPM campaign maker-checker control",
    params
  );
}

export async function getDpmCampaignDefinitionLaunchPackage(params: {
  campaignId: string;
  campaignVersion: string;
  requestedAsOfDate?: string;
  actorId?: string;
  correlationId?: string;
}): Promise<DpmCampaignDefinitionGatewayResponse> {
  const dpmContext = resolveDefaultDpmContext();
  const callerContext = resolveDefaultCallerContext();
  const requestedAsOfDate = params.requestedAsOfDate ?? dpmContext.commandCenterAsOfDate;
  const actorId = params.actorId ?? callerContext.actorId;
  const query = new URLSearchParams();
  query.set("requested_as_of_date", requestedAsOfDate);
  query.set("actor_id", actorId);
  if (params.correlationId) {
    query.set("correlation_id", params.correlationId);
  }
  return await observeWorkbenchResource(
    "dpm.waves.campaign-definitions.launch-package",
    async () =>
      await fetchWorkbenchResource<DpmCampaignDefinitionGatewayResponse>(
        "client",
        `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
          params.campaignId
        )}/versions/${encodeURIComponent(params.campaignVersion)}/launch-package`,
        "DPM campaign-definition launch readiness",
        query
      )
  );
}

export async function launchDpmCampaignDefinition(params: {
  campaignId: string;
  campaignVersion: string;
  requestedAsOfDate?: string;
  actorId?: string;
  correlationId?: string;
}): Promise<DpmWaveGatewayResponse> {
  const dpmContext = resolveDefaultDpmContext();
  const callerContext = resolveDefaultCallerContext();
  const requestedAsOfDate = params.requestedAsOfDate ?? dpmContext.commandCenterAsOfDate;
  const actorId = params.actorId ?? callerContext.actorId;
  const correlationId =
    params.correlationId ||
    ["workbench-campaign-launch", params.campaignId, params.campaignVersion, requestedAsOfDate].join(
      "-"
    );
  return await observeWorkbenchMutation(
    "dpm.waves.campaign-definitions.launch",
    async () =>
      await fetchWorkbenchMutation<DpmWaveGatewayResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/campaign-definitions/${encodeURIComponent(
            params.campaignId
          )}/versions/${encodeURIComponent(params.campaignVersion)}/launch`
        ),
        "launch DPM campaign-definition wave",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(actorId),
          body: JSON.stringify({
            body: {
              requested_as_of_date: requestedAsOfDate,
              actor_id: actorId,
              correlation_id: correlationId,
            },
          }),
        }
      )
  );
}

export async function previewDpmWave(params: {
  portfolioId: string;
  asOfDate?: string;
  actorId?: string;
  rationale?: string;
}): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchMutation(
    "dpm.waves.preview",
    async () =>
      await fetchWorkbenchMutation<DpmWaveGatewayResponse>(
        buildWorkbenchUrl("client", "/dpm/command-center/waves/preview"),
        "preview DPM rebalance wave",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(params.actorId),
          body: JSON.stringify({
            body: buildExplicitPortfolioWaveBody(params),
          }),
        }
      )
  );
}

export async function createDpmWave(params: {
  portfolioId: string;
  asOfDate?: string;
  actorId?: string;
  rationale?: string;
}): Promise<DpmWaveGatewayResponse> {
  const body = buildExplicitPortfolioWaveBody(params);
  return await observeWorkbenchMutation(
    "dpm.waves.create",
    async () =>
      await fetchWorkbenchMutation<DpmWaveGatewayResponse>(
        buildWorkbenchUrl("client", "/dpm/command-center/waves"),
        "create DPM rebalance wave",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(params.actorId),
          body: JSON.stringify({
            idempotency_key: [
              "workbench-wave",
              params.portfolioId,
              body.as_of_date,
            ].join("-"),
            body,
          }),
        }
      )
  );
}

export async function getDpmWave(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.get",
    async () =>
      await fetchWorkbenchResource<DpmWaveGatewayResponse>(
        "client",
        `/dpm/command-center/waves/${encodeURIComponent(waveId)}`,
        "DPM rebalance wave"
      )
  );
}

export async function getDpmWaveItems(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.items",
    async () =>
      await fetchWorkbenchResource<DpmWaveGatewayResponse>(
        "client",
        `/dpm/command-center/waves/${encodeURIComponent(waveId)}/items`,
        "DPM rebalance wave items"
      )
  );
}

export async function sourceCheckDpmWave(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchMutation(
    "dpm.waves.source-check",
    async () =>
      await fetchWorkbenchMutation<DpmWaveGatewayResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/${encodeURIComponent(waveId)}/source-check`
        ),
        "source-check DPM rebalance wave",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(),
          body: JSON.stringify({
            body: {
              actor_id: resolveDefaultCallerContext().actorId,
            },
          }),
        }
      )
  );
}

export async function simulateDpmWave(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchMutation(
    "dpm.waves.simulate",
    async () =>
      await fetchWorkbenchMutation<DpmWaveGatewayResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/${encodeURIComponent(waveId)}/simulate`
        ),
        "simulate DPM rebalance wave",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(),
          body: JSON.stringify({
            body: {
              actor_id: resolveDefaultCallerContext().actorId,
              methods: ["DO_NOTHING_BASELINE", "HEURISTIC_EXPLAINABLE", "MIN_TURNOVER"],
            },
          }),
        }
      )
  );
}

export async function approveDpmWave(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await runDpmWaveWorkflowAction(
    waveId,
    "approve",
    "dpm.waves.approve",
    "approve DPM rebalance wave",
    buildDpmWaveWorkflowBody("PM_APPROVED_AFTER_PROOF_REVIEW")
  );
}

export async function stageDpmWave(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await runDpmWaveWorkflowAction(
    waveId,
    "stage",
    "dpm.waves.stage",
    "stage DPM rebalance wave",
    buildDpmWaveWorkflowBody("READY_FOR_INTERNAL_OPERATIONS")
  );
}

export async function handoffDpmWave(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await runDpmWaveWorkflowAction(
    waveId,
    "handoff",
    "dpm.waves.handoff",
    "handoff DPM rebalance wave",
    buildDpmWaveWorkflowBody("INTERNAL_HANDOFF_READY")
  );
}

export async function getDpmWaveProofPackPosture(
  waveId: string
): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.proof-pack",
    async () =>
      await fetchWorkbenchResource<DpmWaveGatewayResponse>(
        "client",
        `/dpm/command-center/waves/${encodeURIComponent(waveId)}/proof-pack`,
        "DPM rebalance wave proof-pack posture"
      )
  );
}

export async function getDpmWaveSupportability(
  waveId: string
): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.supportability",
    async () =>
      await fetchWorkbenchResource<DpmWaveGatewayResponse>(
        "client",
        `/dpm/command-center/waves/${encodeURIComponent(waveId)}/supportability`,
        "DPM rebalance wave supportability"
      )
  );
}

export async function getDpmWaveReportInput(waveId: string): Promise<DpmWaveGatewayResponse> {
  return await observeWorkbenchResource(
    "dpm.waves.report-input",
    async () =>
      await fetchWorkbenchResource<DpmWaveGatewayResponse>(
        "client",
        `/dpm/command-center/waves/${encodeURIComponent(waveId)}/report-input`,
        "DPM rebalance wave report input"
      )
  );
}

export async function requestDpmWaveAiPmMemo(waveId: string): Promise<DpmWaveAiPmMemoResponse> {
  return await observeWorkbenchMutation(
    "dpm.waves.ai-pm-memo",
    async () =>
      await fetchWorkbenchMutation<DpmWaveAiPmMemoResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/${encodeURIComponent(waveId)}/ai-pm-memo`
        ),
        "request DPM rebalance wave AI PM memo",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(),
          body: JSON.stringify({
            requested_outputs:
              getDpmAiWorkflowProfile("wave-memo").requestedOutputs,
            audience: ["portfolio_manager", "investment_control", "operations"],
          }),
        }
      )
  );
}

export async function requestDpmOperationsHandoffSummary(
  waveId: string
): Promise<DpmOperationsHandoffSummaryResponse> {
  return await observeWorkbenchMutation(
    "dpm.waves.operations-handoff-summary",
    async () =>
      await fetchWorkbenchMutation<DpmOperationsHandoffSummaryResponse>(
        buildWorkbenchUrl(
          "client",
          `/dpm/command-center/waves/${encodeURIComponent(waveId)}/operations-handoff-summary`
        ),
        "request DPM operations handoff AI summary",
        {
          method: "POST",
          headers: buildDpmWaveCallerHeaders(),
          body: JSON.stringify({
            requested_outputs:
              getDpmAiWorkflowProfile("operations-handoff").requestedOutputs,
            audience: ["operations", "portfolio_manager", "investment_control"],
          }),
        }
      )
  );
}
