import { sendJson, sendJsonExpectingStatus } from "./probes.mjs";
import {
  buildPayloadScopedIdempotencyKey,
  extractGatewayEnvelopeData,
  readString,
} from "./payload-utils.mjs";

const DEFAULT_ADVISOR_ID = "advisor_sg_001";
const DEFAULT_ROLE = "ADVISOR";
const DEFAULT_CALLER_APPLICATION = "lotus-workbench";
const DEFAULT_TENANT_ID = "tenant-sg";
const DEFAULT_REGION = "APAC";
const DEFAULT_BOOKING_CENTER_CODE = "SG";
const DEFAULT_LEGAL_ENTITY_CODE = "SGPB";
const DEFAULT_PRINCIPAL_STATUS = "ACTIVE";
const READ_CAPABILITY = "advisory.advisor_cockpit.read";
const ACKNOWLEDGE_CAPABILITY = "advisory.advisor_cockpit.acknowledge";
const CANONICAL_ACTION_PAGE_SIZE = 100;
const MAX_CANONICAL_ACTION_PAGES = 5;

function advisorCockpitQuery({
  portfolioId,
  limit,
  cursor,
}) {
  const query = new URLSearchParams({
    portfolio_id: portfolioId,
  });
  if (limit) {
    query.set("limit", String(limit));
  }
  if (cursor) {
    query.set("cursor", String(cursor));
  }
  return query.toString();
}

function advisorCockpitHeaders({
  portfolioId,
  advisorId = DEFAULT_ADVISOR_ID,
  role = DEFAULT_ROLE,
  capability = READ_CAPABILITY,
}) {
  return {
    "X-Actor-Id": advisorId,
    "X-Caller-Application": DEFAULT_CALLER_APPLICATION,
    "X-Tenant-Id": DEFAULT_TENANT_ID,
    "X-Region": DEFAULT_REGION,
    "X-Booking-Center-Code": DEFAULT_BOOKING_CENTER_CODE,
    "X-Legal-Entity-Code": DEFAULT_LEGAL_ENTITY_CODE,
    "X-Role": role,
    "X-Caller-Capabilities": capability,
    "X-Principal-Status": DEFAULT_PRINCIPAL_STATUS,
    "X-Authorized-Advisor-Id": advisorId,
    "X-Authorized-Portfolio-Id": portfolioId,
  };
}

function assertPortfolioScopedActions(items, portfolioId) {
  const outOfScope = items.find(
    (item) => readString(item?.portfolio_id) !== portfolioId,
  );
  if (outOfScope) {
    throw new Error(
      `Advisor cockpit returned out-of-scope action ${readString(outOfScope?.action_item_id) ?? "unknown"} for portfolio ${readString(outOfScope?.portfolio_id) ?? "missing"}.`,
    );
  }
}

function findPolicyReviewAction(items, expectedActionFamily) {
  return items.find((item) => {
    const family = readString(item?.action_family);
    const status = readString(item?.status);
    const reasonCodes = Array.isArray(item?.reason_codes)
      ? item.reason_codes
      : [];
    return (
      (expectedActionFamily && family === expectedActionFamily) ||
      family === "POLICY_REVIEW_REQUIRED" ||
      status === "PENDING_REVIEW" ||
      reasonCodes.includes("POLICY_PENDING_REVIEW")
    );
  });
}

function assertActionContract(action, portfolioId, context) {
  const actionItemId = readString(action?.action_item_id);
  if (!actionItemId || typeof action?.action_item_version !== "number") {
    throw new Error(
      `Advisor cockpit ${context} did not include stable action identity and version.`,
    );
  }
  for (const field of [
    "action_family",
    "status",
    "priority",
    "owner_role",
    "owning_system",
    "title",
    "next_required_action",
    "sla_age_band",
  ]) {
    if (!readString(action?.[field])) {
      throw new Error(
        `Advisor cockpit ${context} action ${actionItemId} returned no ${field}.`,
      );
    }
  }
  if (readString(action?.portfolio_id) !== portfolioId) {
    throw new Error(
      `Advisor cockpit ${context} action ${actionItemId} was scoped to ${readString(action?.portfolio_id) ?? "missing"} instead of ${portfolioId}.`,
    );
  }
  if (!Array.isArray(action?.reason_codes) || action.reason_codes.length < 1) {
    throw new Error(
      `Advisor cockpit ${context} action ${actionItemId} returned no reason codes.`,
    );
  }
  if (!Array.isArray(action?.evidence_refs) || action.evidence_refs.length < 1) {
    throw new Error(
      `Advisor cockpit ${context} action ${actionItemId} returned no source evidence refs.`,
    );
  }
  const evidenceWithoutSource = action.evidence_refs.find(
    (ref) =>
      !readString(ref?.evidence_id) ||
      !readString(ref?.evidence_type) ||
      !readString(ref?.source_system) ||
      !readString(ref?.access_class),
  );
  if (evidenceWithoutSource) {
    throw new Error(
      `Advisor cockpit ${context} action ${actionItemId} returned incomplete evidence refs.`,
    );
  }
  if (!Array.isArray(action?.lineage_refs) || action.lineage_refs.length < 1) {
    throw new Error(
      `Advisor cockpit ${context} action ${actionItemId} returned no lineage refs.`,
    );
  }
}

function expectedActionFamilies(scenario) {
  if (Array.isArray(scenario?.expectedActionFamilies)) {
    return scenario.expectedActionFamilies
      .map((family) => readString(family))
      .filter(Boolean);
  }
  return [];
}

async function readCanonicalActionFeed({
  summary,
  gatewayBaseUrl,
  portfolioId,
  headers,
  timeoutMs,
}) {
  const items = [];
  const actionIds = new Set();
  let cursor;
  let firstPage;
  let sourceTotal;

  for (let pageNumber = 1; pageNumber <= MAX_CANONICAL_ACTION_PAGES; pageNumber += 1) {
    const query = advisorCockpitQuery({
      portfolioId,
      limit: CANONICAL_ACTION_PAGE_SIZE,
      cursor,
    });
    const response = await sendJson(
      summary,
      `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions?${query}`,
      pageNumber === 1
        ? "Advisor cockpit canonical action list"
        : `Advisor cockpit canonical action list page ${pageNumber}`,
      timeoutMs,
      { headers },
    );
    const page = extractGatewayEnvelopeData(response);
    firstPage ??= page;
    const pageItems = Array.isArray(page?.items) ? page.items : [];
    const pageTotal = Number(page?.total_count);
    if (!Number.isSafeInteger(pageTotal) || pageTotal < 0) {
      throw new Error("Advisor cockpit canonical action list returned no valid total_count.");
    }
    if (sourceTotal === undefined) {
      sourceTotal = pageTotal;
    } else if (sourceTotal !== pageTotal) {
      throw new Error(
        `Advisor cockpit canonical action list total_count changed from ${sourceTotal} to ${pageTotal} during pagination.`,
      );
    }
    for (const item of pageItems) {
      const actionId = readString(item?.action_item_id);
      if (actionId && actionIds.has(actionId)) {
        throw new Error(
          `Advisor cockpit canonical action list repeated action ${actionId} during pagination.`,
        );
      }
      if (actionId) {
        actionIds.add(actionId);
      }
      items.push(item);
    }

    const nextCursor = readString(page?.next_cursor);
    if (!nextCursor) {
      if (items.length !== sourceTotal) {
        throw new Error(
          `Advisor cockpit canonical action list ended after ${items.length} items but declared total_count ${sourceTotal}.`,
        );
      }
      return { firstPage, items };
    }
    if (nextCursor === cursor) {
      throw new Error("Advisor cockpit canonical action list returned a non-advancing cursor.");
    }
    cursor = nextCursor;
  }

  throw new Error(
    `Advisor cockpit canonical action list exceeded the bounded ${MAX_CANONICAL_ACTION_PAGES}-page proof budget.`,
  );
}

function buildHouseViewCohortBody({ scenario, portfolioId }) {
  if (scenario?.houseViewCohort && typeof scenario.houseViewCohort === "object") {
    return scenario.houseViewCohort;
  }
  if (!scenario?.seedHouseViewCohort) {
    return null;
  }
  return {
    tactical_view: {
      tactical_view_id: "thv_2026_05_asia_duration",
      tactical_view_version: "2026.05",
      theme_id: "asia_duration_reduce",
      as_of_date: "2026-05-14",
      target_action: "REDUCE",
      rationale: "Reduce duration exposure in Asia balanced discretionary books.",
      source_refs: [
        {
          source_system: "lotus-advise",
          source_type: "TACTICAL_HOUSE_VIEW",
          source_id: "thv_2026_05_asia_duration",
          source_version: "2026.05",
          content_hash: "sha256:house-view",
        },
      ],
    },
    candidate_portfolios: [
      {
        portfolio_id: portfolioId,
        mandate_id: "MANDATE_PB_SG_GLOBAL_BAL_001",
        portfolio_type: "DPM",
        discretionary_mandate: true,
        booking_center_code: "Singapore",
        current_exposure_weight: "0.18",
        alignment_signal: "OVERWEIGHT",
        source_refs: [
          {
            source_system: "lotus-core",
            source_type: "HoldingsAsOf",
            source_id: `holdings:${portfolioId}:2026-05-14`,
            source_version: "v1",
            content_hash: "sha256:holdings",
          },
        ],
      },
    ],
    eligible_portfolio_types: ["DPM"],
    correlation_id: "corr-rfc26-house-view-canonical",
  };
}

async function seedHouseViewCohort({
  summary,
  scenario,
  gatewayBaseUrl,
  portfolioId,
  timeoutMs,
}) {
  const body = buildHouseViewCohortBody({ scenario, portfolioId });
  if (!body) {
    return null;
  }
  const response = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/house-view-cohorts/evaluate`,
    "Advisor cockpit canonical house-view cohort",
    timeoutMs,
    {
      method: "POST",
      body: { body },
    },
  );
  const cohort = extractGatewayEnvelopeData(response);
  if (readString(cohort?.product_name) !== "TacticalHouseViewAffectedCohort") {
    throw new Error("Advisor cockpit house-view cohort proof returned no cohort product.");
  }
  const affected = Array.isArray(cohort?.affected_portfolios)
    ? cohort.affected_portfolios
    : [];
  if (!affected.some((item) => readString(item?.portfolio_id) === portfolioId)) {
    throw new Error(
      `Advisor cockpit house-view cohort did not include portfolio ${portfolioId}.`,
    );
  }
  return cohort;
}

function snapshotCount(snapshot, key) {
  const value = snapshot?.action_counts?.[key];
  return typeof value === "number" ? value : 0;
}

function isAcknowledged(action) {
  return action?.acknowledgement_state?.acknowledged === true;
}

async function validateActionDetail({
  summary,
  gatewayBaseUrl,
  query,
  headers,
  policyAction,
  portfolioId,
  timeoutMs,
}) {
  const actionItemId = readString(policyAction?.action_item_id);
  const detail = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions/${encodeURIComponent(
      actionItemId,
    )}?${query}`,
    "Advisor cockpit canonical action detail",
    timeoutMs,
    { headers },
  );
  const detailData = extractGatewayEnvelopeData(detail);
  if (readString(detailData?.action_item_id) !== actionItemId) {
    throw new Error(
      `Advisor cockpit action detail returned ${readString(detailData?.action_item_id) ?? "missing"} for ${actionItemId}.`,
    );
  }
  if (detailData?.action_item_version !== policyAction.action_item_version) {
    throw new Error(
      `Advisor cockpit action detail returned version ${detailData?.action_item_version ?? "missing"} for ${actionItemId}; expected ${policyAction.action_item_version}.`,
    );
  }
  assertActionContract(detailData, portfolioId, "detail");
}

async function validateActionPagination({
  summary,
  gatewayBaseUrl,
  portfolioId,
  advisorId,
  role,
  firstPage,
  timeoutMs,
}) {
  const totalCount = Number(firstPage?.total_count ?? 0);
  if (totalCount < 2) {
    return null;
  }
  const pagedQuery = advisorCockpitQuery({
    portfolioId,
    limit: 1,
  });
  const headers = advisorCockpitHeaders({ portfolioId, advisorId, role });
  const firstPaged = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions?${pagedQuery}`,
    "Advisor cockpit canonical pagination first page",
    timeoutMs,
    { headers },
  );
  const firstPagedData = extractGatewayEnvelopeData(firstPaged);
  const firstItems = Array.isArray(firstPagedData?.items)
    ? firstPagedData.items
    : [];
  const nextCursor = readString(firstPagedData?.next_cursor);
  if (firstItems.length !== 1 || !nextCursor) {
    throw new Error(
      "Advisor cockpit pagination did not return one item and a stable next_cursor.",
    );
  }
  const secondPaged = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions?${advisorCockpitQuery({
      portfolioId,
      limit: 1,
      cursor: nextCursor,
    })}`,
    "Advisor cockpit canonical pagination second page",
    timeoutMs,
    { headers },
  );
  const secondPagedData = extractGatewayEnvelopeData(secondPaged);
  const secondItems = Array.isArray(secondPagedData?.items)
    ? secondPagedData.items
    : [];
  if (secondItems.length !== 1) {
    throw new Error("Advisor cockpit pagination second page returned no action item.");
  }
  if (
    readString(firstItems[0]?.action_item_id) ===
    readString(secondItems[0]?.action_item_id)
  ) {
    throw new Error("Advisor cockpit pagination repeated the first action item.");
  }
  assertPortfolioScopedActions([...firstItems, ...secondItems], portfolioId);
  return nextCursor;
}

async function validateRoleProjection({
  summary,
  gatewayBaseUrl,
  portfolioId,
  advisorId,
  timeoutMs,
  expectedActionFamilies: families,
}) {
  const compliance = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions?${advisorCockpitQuery({
      portfolioId,
      limit: 25,
    })}`,
    "Advisor cockpit canonical compliance projection",
    timeoutMs,
    {
      headers: advisorCockpitHeaders({
        portfolioId,
        advisorId,
        role: "COMPLIANCE_REVIEWER",
      }),
    },
  );
  const compliancePage = extractGatewayEnvelopeData(compliance);
  const complianceItems = Array.isArray(compliancePage?.items)
    ? compliancePage.items
    : [];
  if (!complianceItems.some((item) => readString(item?.owner_role) === "COMPLIANCE_REVIEWER")) {
    throw new Error("Advisor cockpit compliance projection returned no compliance-owned action.");
  }
  const invalidOwner = complianceItems.find((item) => {
    const owner = readString(item?.owner_role);
    return owner !== "COMPLIANCE_REVIEWER" && owner !== "SYSTEM";
  });
  if (invalidOwner) {
    throw new Error(
      `Advisor cockpit compliance projection leaked ${readString(invalidOwner?.owner_role) ?? "missing"} action ownership.`,
    );
  }

  if (!families.includes("HOUSE_VIEW_IMPACT_REVIEW")) {
    return false;
  }
  const dpm = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions?${advisorCockpitQuery({
      portfolioId,
      limit: 25,
    })}`,
    "Advisor cockpit canonical portfolio-manager house-view projection",
    timeoutMs,
    {
      headers: advisorCockpitHeaders({
        portfolioId,
        advisorId,
        role: "PORTFOLIO_MANAGER",
      }),
    },
  );
  const dpmPage = extractGatewayEnvelopeData(dpm);
  const dpmItems = Array.isArray(dpmPage?.items) ? dpmPage.items : [];
  if (!dpmItems.some((item) => readString(item?.action_family) === "HOUSE_VIEW_IMPACT_REVIEW")) {
    throw new Error("Advisor cockpit DPM projection did not expose house-view impact review.");
  }
  return true;
}

export async function validateCanonicalAdvisorCockpit({
  summary,
  scenario,
  gatewayBaseUrl,
  portfolioId,
  proposalId,
  proposalVersionId,
  timeoutMs,
  advisorId = scenario?.advisorId ?? DEFAULT_ADVISOR_ID,
  role = scenario?.role ?? DEFAULT_ROLE,
}) {
  const houseViewCohort = await seedHouseViewCohort({
    summary,
    scenario,
    gatewayBaseUrl,
    portfolioId,
    timeoutMs,
  });
  const readHeaders = advisorCockpitHeaders({ portfolioId, advisorId, role });
  const { firstPage: actionPage, items } = await readCanonicalActionFeed({
    summary,
    gatewayBaseUrl,
    portfolioId,
    headers: readHeaders,
    timeoutMs,
  });
  if (items.length < 1) {
    throw new Error(
      "Advisor cockpit canonical action list returned no action items.",
    );
  }
  assertPortfolioScopedActions(items, portfolioId);
  for (const action of items) {
    assertActionContract(action, portfolioId, "list");
  }
  for (const family of expectedActionFamilies(scenario)) {
    if (!items.some((item) => readString(item?.action_family) === family)) {
      throw new Error(
        `Advisor cockpit canonical action list did not include expected action family ${family}.`,
      );
    }
  }

  const policyAction = findPolicyReviewAction(
    items,
    scenario?.expectedActionFamily,
  );
  if (!policyAction) {
    throw new Error(
      "Advisor cockpit did not expose a policy-review action for the canonical scenario.",
    );
  }
  const actionItemId = readString(policyAction.action_item_id);
  const actionItemVersion = policyAction.action_item_version;
  if (!actionItemId || typeof actionItemVersion !== "number") {
    throw new Error(
      "Advisor cockpit canonical action item did not include stable identity and version.",
    );
  }
  const query = advisorCockpitQuery({
    portfolioId,
    limit: CANONICAL_ACTION_PAGE_SIZE,
  });
  await validateActionDetail({
    summary,
    gatewayBaseUrl,
    query,
    headers: readHeaders,
    policyAction,
    portfolioId,
    timeoutMs,
  });
  const paginationCursor = await validateActionPagination({
    summary,
    gatewayBaseUrl,
    portfolioId,
    advisorId,
    role,
    firstPage: actionPage,
    timeoutMs,
  });
  const roleProjectionValidated = await validateRoleProjection({
    summary,
    gatewayBaseUrl,
    portfolioId,
    advisorId,
    timeoutMs,
    expectedActionFamilies: expectedActionFamilies(scenario),
  });
  await sendJsonExpectingStatus(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions?${advisorCockpitQuery({
      portfolioId,
      cursor: "invalid-rfc0026-cursor",
    })}`,
    "Advisor cockpit canonical invalid cursor rejection",
    timeoutMs,
    422,
    { headers: readHeaders },
  );

  const snapshot = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/snapshot?${query}`,
    "Advisor cockpit canonical operating snapshot",
    timeoutMs,
    { headers: readHeaders },
  );
  const snapshotData = extractGatewayEnvelopeData(snapshot);
  if (!readString(snapshotData?.snapshot_id)) {
    throw new Error("Advisor cockpit snapshot returned no snapshot id.");
  }
  if (snapshotCount(snapshotData, "status.PENDING_REVIEW") < 1) {
    throw new Error(
      "Advisor cockpit snapshot did not preserve pending-review action count.",
    );
  }
  const preparationPackets = Array.isArray(snapshotData?.preparation_packets)
    ? snapshotData.preparation_packets
    : [];
  const expectedMinPreparationPackets = Number(
    scenario?.expectedMinPreparationPackets ?? 0,
  );
  if (preparationPackets.length < expectedMinPreparationPackets) {
    throw new Error(
      `Advisor cockpit snapshot returned ${preparationPackets.length} preparation packets, expected at least ${expectedMinPreparationPackets}.`,
    );
  }
  const preparationPacketResponse = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/preparation-packets?${query}`,
    "Advisor cockpit canonical preparation packets",
    timeoutMs,
    { headers: readHeaders },
  );
  const preparationPacketPage = extractGatewayEnvelopeData(
    preparationPacketResponse,
  );
  const routedPreparationPackets = Array.isArray(preparationPacketPage?.items)
    ? preparationPacketPage.items
    : [];
  if (routedPreparationPackets.length < expectedMinPreparationPackets) {
    throw new Error(
      `Advisor cockpit preparation route returned ${routedPreparationPackets.length} packets, expected at least ${expectedMinPreparationPackets}.`,
    );
  }
  const missingPacketIdentity = routedPreparationPackets.find(
    (packet) => !readString(packet?.packet_id) || !readString(packet?.status),
  );
  if (missingPacketIdentity) {
    throw new Error(
      "Advisor cockpit preparation route returned a packet without stable packet_id and status.",
    );
  }
  const clientReadyPublication = readString(
    snapshotData?.supportability?.client_ready_publication,
  );
  const workbenchPosture = readString(
    snapshotData?.supportability?.workbench_posture,
  );
  if (
    scenario?.expectedClientReadyPublication &&
    clientReadyPublication !== scenario.expectedClientReadyPublication
  ) {
    throw new Error(
      `Advisor cockpit snapshot returned client publication ${clientReadyPublication ?? "missing"}, expected ${scenario.expectedClientReadyPublication}.`,
    );
  }
  if (
    scenario?.expectedWorkbenchPosture &&
    workbenchPosture !== scenario.expectedWorkbenchPosture
  ) {
    throw new Error(
      `Advisor cockpit snapshot returned Workbench posture ${workbenchPosture ?? "missing"}, expected ${scenario.expectedWorkbenchPosture}.`,
    );
  }

  const supportability = await sendJson(
    summary,
    `${gatewayBaseUrl}/api/v1/advisor-cockpit/supportability?${advisorCockpitQuery(
      {
        portfolioId,
      },
    )}`,
    "Advisor cockpit canonical supportability",
    timeoutMs,
    { headers: readHeaders },
  );
  const supportabilityData = extractGatewayEnvelopeData(supportability);
  const supportabilityPosture = readString(supportabilityData?.posture);
  if (!supportabilityPosture) {
    throw new Error(
      "Advisor cockpit supportability returned no bounded posture.",
    );
  }
  if (
    scenario?.expectedSupportabilityPosture &&
    supportabilityPosture !== scenario.expectedSupportabilityPosture
  ) {
    throw new Error(
      `Advisor cockpit supportability returned posture ${supportabilityPosture}, expected ${scenario.expectedSupportabilityPosture}.`,
    );
  }

  const alreadyAcknowledged = isAcknowledged(policyAction);
  let acknowledgementData = null;
  let acknowledgementState = policyAction.acknowledgement_state;
  if (!alreadyAcknowledged) {
    const acknowledgementBody = {
      action_item_version: actionItemVersion,
      acknowledgement_note:
        "Canonical validation recorded advisor cockpit acknowledgement without clearing source-owned blockers.",
    };
    const acknowledgementIdempotencyMaterial = {
      portfolio_id: portfolioId,
      action_item_id: actionItemId,
      ...acknowledgementBody,
    };
    const acknowledgement = await sendJson(
      summary,
      `${gatewayBaseUrl}/api/v1/advisor-cockpit/actions/${encodeURIComponent(
        actionItemId,
      )}/acknowledgements?${advisorCockpitQuery({ portfolioId })}`,
      "Advisor cockpit canonical acknowledgement",
      timeoutMs,
      {
        method: "POST",
        body: acknowledgementBody,
        headers: {
          ...advisorCockpitHeaders({
            portfolioId,
            advisorId,
            role,
            capability: ACKNOWLEDGE_CAPABILITY,
          }),
          "Idempotency-Key": buildPayloadScopedIdempotencyKey(
            "wb-advisor-cockpit-ack",
            acknowledgementIdempotencyMaterial,
          ),
        },
      },
    );
    acknowledgementData = extractGatewayEnvelopeData(acknowledgement);
    acknowledgementState =
      acknowledgementData?.acknowledgement ??
      acknowledgementData?.action_item?.acknowledgement_state;
  }
  if (acknowledgementState?.acknowledged !== true) {
    throw new Error(
      "Advisor cockpit acknowledgement did not return acknowledged=true.",
    );
  }

  summary.workflowPackChecks.push({
    actionType:
      scenario?.expectedAcknowledgementMarker ??
      "ADVISOR_COCKPIT_ACTION_ACKNOWLEDGED",
    route: "/api/v1/advisor-cockpit/actions",
    portfolioId,
    proposalId,
    proposalVersionId,
    actionItemId,
    actionItemVersion,
    resultReviewState: policyAction.status,
    clientReadyPublication,
    preparationPacketCount: preparationPackets.length,
    preparationPacketRouteCount: routedPreparationPackets.length,
    houseViewCohortId: readString(houseViewCohort?.cohort_id),
    workbenchPosture,
    supportabilityPosture,
    paginationCursor,
    roleProjectionValidated,
    alreadyAcknowledged,
    replayed: alreadyAcknowledged || Boolean(acknowledgementData?.replayed),
  });

  return {
    actionItemId,
    actionItemVersion,
    actionCount: items.length,
    snapshotId: snapshotData.snapshot_id,
    preparationPacketCount: preparationPackets.length,
    preparationPacketRouteCount: routedPreparationPackets.length,
    houseViewCohortId: readString(houseViewCohort?.cohort_id),
    supportabilityPosture,
    workbenchPosture,
    clientReadyPublication,
    paginationCursor,
    roleProjectionValidated,
  };
}
