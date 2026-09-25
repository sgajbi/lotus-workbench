"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GridApi } from "ag-grid-community";
import { Alert, CircularProgress, Stack } from "@mui/material";

import { ScreenStatePanel, SectionBlock, Text } from "@/design-system";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";
import {
  buildReviewContextHref,
  type WorkspaceReviewContext,
} from "@/shell/review-context";

import {
  getAdvisorIdeaCandidateDetail,
  getAdvisorIdeaReviewQueue,
} from "../api";
import {
  buildAdvisoryOpportunitiesModel,
  type AdvisoryOpportunityRow,
} from "../advisory-opportunities-view-model";
import {
  buildIdeaCandidateActionAuthority,
  readPersistedAcceptedIdeaReviewAuthority,
  sameInstant,
} from "../idea-action-authority";
import { readAdvisorIdeaEvidenceIdentity } from "../idea-ai-explanation-contract";
import type {
  AdvisorIdeaCandidateDetailData,
  AdvisorIdeaQueueItem,
} from "../types";
import {
  useIdeaPresentationReceipts,
  type IdeaPresentationAuthority,
} from "../use-idea-presentation-receipts";
import AdvisoryOpportunityGrid from "./advisory-opportunity-grid";
import IdeaCandidateActionPanel, {
  type IdeaActionRefreshResult,
} from "./idea-candidate-action-panel";
import styles from "./advisory-opportunities-workspace.module.css";

const CANONICAL_IDEA_PORTFOLIO_ID = "PB_SG_GLOBAL_BAL_001";

function advisorIdeaQueueQueryOptions(
  portfolioId: string,
  evaluatedAtUtc: string,
) {
  return {
    queryKey: ["advisory-opportunities", portfolioId, evaluatedAtUtc] as const,
    queryFn: async () =>
      await getAdvisorIdeaReviewQueue({ portfolioId, evaluatedAtUtc }),
    ...workbenchStrictQueryDefaults,
  };
}

function nextQueueEvaluationBoundary(previousBoundary: string): string {
  return new Date(
    Math.max(Date.now(), Date.parse(previousBoundary) + 1),
  ).toISOString();
}

function gridDisplaysCandidate(
  gridApi: GridApi<AdvisoryOpportunityRow>,
  candidateId: string,
): boolean {
  for (let index = 0; index < gridApi.getDisplayedRowCount(); index += 1) {
    const rowNode = gridApi.getDisplayedRowAtIndex(index);
    if (
      rowNode?.id === candidateId ||
      rowNode?.data?.candidateId === candidateId
    ) {
      return true;
    }
  }
  return false;
}

async function revealCandidateQueueRow(
  container: HTMLElement | null,
  gridApi: GridApi<AdvisoryOpportunityRow> | null,
  candidateId: string,
): Promise<void> {
  const waitForRender = () =>
    new Promise<void>((resolve) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      window.setTimeout(resolve, 0);
    });
  await waitForRender();
  if (gridApi) {
    const rowNode = gridApi.getRowNode(candidateId);
    if (rowNode) {
      gridApi.ensureNodeVisible(rowNode, "middle");
      await waitForRender();
    }
  }
  if (!container) {
    return;
  }
  const marker = Array.from(
    container.querySelectorAll<HTMLElement>(
      "[data-idea-presentation-candidate]",
    ),
  ).find(
    (element) => element.dataset.ideaPresentationCandidate === candidateId,
  );
  if (!marker) {
    return;
  }
  marker.scrollIntoView?.({ block: "center", inline: "nearest" });
}

export default function AdvisoryOpportunitiesWorkspace({
  portfolioId,
  reviewContext,
  selectedCandidateId,
}: {
  portfolioId: string;
  reviewContext: WorkspaceReviewContext;
  selectedCandidateId?: string;
}) {
  const queryClient = useQueryClient();
  const presentationContainerRef = useRef<HTMLDivElement>(null);
  const opportunityGridApiRef = useRef<GridApi<AdvisoryOpportunityRow> | null>(
    null,
  );
  const isCanonicalIdeaPortfolio = portfolioId === CANONICAL_IDEA_PORTFOLIO_ID;
  const [queueEvaluatedAtUtc, setQueueEvaluatedAtUtc] = useState(() =>
    new Date().toISOString(),
  );
  const [opportunityFilterText, setOpportunityFilterText] = useState("");
  const [presentationRenewal, setPresentationRenewal] = useState<{
    candidateId: string;
    evaluatedAtUtc: string;
  }>();
  const { data, isLoading, error } = useQuery({
    ...advisorIdeaQueueQueryOptions(portfolioId, queueEvaluatedAtUtc),
    enabled: isCanonicalIdeaPortfolio,
  });
  const selectedCandidate = selectedCandidateId?.trim();
  const {
    data: candidateDetail,
    isLoading: isCandidateDetailLoading,
    error: candidateDetailError,
  } = useQuery({
    queryKey: ["advisory-opportunity-detail", portfolioId, selectedCandidate],
    queryFn: async () =>
      await getAdvisorIdeaCandidateDetail({
        candidateId: selectedCandidate ?? "",
        portfolioId,
      }),
    enabled: isCanonicalIdeaPortfolio && Boolean(selectedCandidate),
    ...workbenchStrictQueryDefaults,
  });

  const model = useMemo(
    () =>
      buildAdvisoryOpportunitiesModel({
        portfolioId,
        queue: data,
        selectedCandidateId: selectedCandidate,
      }),
    [portfolioId, data, selectedCandidate],
  );
  const selectedQueueItem = useMemo(
    () => findQueueItemByCandidateId(data?.items, selectedCandidate),
    [data?.items, selectedCandidate],
  );
  const receiptState = useIdeaPresentationReceipts({
    containerRef: presentationContainerRef,
    enabled: model.rows.length > 0,
    portfolioId,
    queue: data,
  });
  const currentPresentationAuthority = selectedCandidate
    ? receiptState.authorityByCandidateId.get(selectedCandidate)
    : undefined;
  const [retainedPresentedCandidate, setRetainedPresentedCandidate] = useState<{
    candidateId: string;
    queueItem: AdvisorIdeaQueueItem;
  }>();
  const retainedSelectedCandidate =
    retainedPresentedCandidate?.candidateId === selectedCandidate
      ? retainedPresentedCandidate
      : undefined;
  const selectedPresentedQueueItem =
    selectedQueueItem ?? retainedSelectedCandidate?.queueItem;
  useEffect(() => {
    if (
      !data ||
      !presentationRenewal ||
      !sameInstant(data.evaluatedAtUtc, presentationRenewal.evaluatedAtUtc)
    ) {
      return;
    }
    const renewalCandidateId = presentationRenewal.candidateId;
    const gridApi = opportunityGridApiRef.current;
    if (!gridApi?.getRowNode(renewalCandidateId)) {
      setPresentationRenewal(undefined);
      return;
    }
    if (
      opportunityFilterText &&
      !gridDisplaysCandidate(gridApi, renewalCandidateId)
    ) {
      setOpportunityFilterText("");
      return;
    }
    void revealCandidateQueueRow(
      presentationContainerRef.current,
      gridApi,
      renewalCandidateId,
    );
    setPresentationRenewal(undefined);
  }, [data, opportunityFilterText, presentationRenewal]);
  const proposalBuilderHref = buildReviewContextHref("/proposals/simulate", {
    ...reviewContext,
    portfolioId,
  });

  if (!isCanonicalIdeaPortfolio) {
    return (
      <ScreenStatePanel
        kind="error"
        title="Advisory opportunity review is not available for this portfolio"
        body="Select the supported demonstration portfolio before opening the opportunity queue."
        surface="default"
      />
    );
  }

  if (isLoading) {
    return (
      <SectionBlock>
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Text variant="body">Loading Idea review queue...</Text>
        </Stack>
      </SectionBlock>
    );
  }

  return (
    <SectionBlock
      title="Opportunities And Ideas"
      subtitle="Advisor-use triage of Lotus Idea candidates through the governed Gateway contract."
      bodyRef={presentationContainerRef}
      actions={
        <Link className="nav-link" href={proposalBuilderHref}>
          Open Proposal Builder
        </Link>
      }
    >
      {error ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Idea candidates are unavailable. No fallback opportunity list is
          shown.
        </Alert>
      ) : null}

      <div className={styles.decisionPanel}>
        <div>
          <Text variant="microLabel">Advisor Decision</Text>
          <Text variant="subsectionTitle" as="h2">
            {model.primaryDecision}
          </Text>
          <Text variant="secondary">{model.recommendedAction}</Text>
        </div>
        <div className={styles.ideaCount} aria-label="Idea candidates">
          <span>{model.candidateCount}</span>
          <strong>Idea candidates</strong>
        </div>
      </div>

      <div
        className={styles.proofStrip}
        aria-label="Idea worklist evidence status"
      >
        <span>Policy: {model.policyVersion}</span>
        <span>Evaluated: {model.evaluatedAtUtc}</span>
        <span>
          Durable storage:{" "}
          {model.durableStorageBacked ? "Backed" : "Not backed"}
        </span>
        <span>
          Supported feature:{" "}
          {model.supportedFeaturePromoted ? "Promoted" : "Not promoted"}
        </span>
        <span>Excluded: {model.excludedCount}</span>
      </div>

      {selectedCandidate ? (
        <IdeaCandidateDetailPanel
          detail={candidateDetail}
          currentQueueCandidatePresent={Boolean(selectedQueueItem)}
          error={candidateDetailError}
          isLoading={isCandidateDetailLoading}
          portfolioId={portfolioId}
          presentationAuthority={currentPresentationAuthority}
          candidateReasonCodes={selectedPresentedQueueItem?.reasonCodes ?? []}
          queueItem={selectedPresentedQueueItem}
          queueEvaluatedAtUtc={data?.evaluatedAtUtc}
          queuePolicyVersion={data?.policyVersion}
          selectedCandidateId={selectedCandidate}
          sourceSignalIds={
            selectedPresentedQueueItem?.candidate?.sourceSignalIds ?? []
          }
          onActionRecorded={async () => {
            if (selectedQueueItem && currentPresentationAuthority) {
              setRetainedPresentedCandidate({
                candidateId: selectedCandidate,
                queueItem: selectedQueueItem,
              });
            }
            const refreshedQueueEvaluatedAtUtc =
              nextQueueEvaluationBoundary(queueEvaluatedAtUtc);
            const detailQueryKey = [
              "advisory-opportunity-detail",
              portfolioId,
              selectedCandidate,
            ];

            try {
              await queryClient.invalidateQueries({
                queryKey: detailQueryKey,
                refetchType: "none",
              });
              const [refreshedQueue] = await Promise.all([
                queryClient.fetchQuery(
                  advisorIdeaQueueQueryOptions(
                    portfolioId,
                    refreshedQueueEvaluatedAtUtc,
                  ),
                ),
                queryClient.refetchQueries(
                  { queryKey: detailQueryKey, type: "active" },
                  { throwOnError: true },
                ),
              ]);
              setPresentationRenewal({
                candidateId: selectedCandidate,
                evaluatedAtUtc: refreshedQueueEvaluatedAtUtc,
              });
              setQueueEvaluatedAtUtc(refreshedQueueEvaluatedAtUtc);
              return {
                sourceRefreshSucceeded: true,
                currentQueueCandidatePresent: Boolean(
                  findQueueItemByCandidateId(
                    refreshedQueue.items,
                    selectedCandidate,
                  ),
                ),
              } satisfies IdeaActionRefreshResult;
            } catch {
              return {
                sourceRefreshSucceeded: false,
                currentQueueCandidatePresent: Boolean(selectedQueueItem),
              } satisfies IdeaActionRefreshResult;
            }
          }}
        />
      ) : null}

      {error ? (
        <ScreenStatePanel
          kind="error"
          title="Idea queue unavailable"
          body="The Lotus Idea review queue could not be loaded through Gateway. No local fallback queue is shown."
          surface="default"
        />
      ) : model.rows.length === 0 ? (
        <ScreenStatePanel
          kind="empty"
          title="No Idea candidates ready for review"
          body="Lotus Idea did not return reviewable candidates for this portfolio scope."
          action={
            <Link className="nav-link" href={proposalBuilderHref}>
              Open proposal builder
            </Link>
          }
          surface="default"
        />
      ) : data ? (
        <AdvisoryOpportunityGrid
          filterText={opportunityFilterText}
          onFilterTextChange={setOpportunityFilterText}
          onGridApiReady={(api) => {
            opportunityGridApiRef.current = api;
          }}
          receiptState={receiptState}
          rows={model.rows}
        />
      ) : null}
    </SectionBlock>
  );
}

function IdeaCandidateDetailPanel({
  candidateReasonCodes,
  currentQueueCandidatePresent,
  detail,
  error,
  isLoading,
  portfolioId,
  presentationAuthority,
  queueEvaluatedAtUtc,
  queueItem,
  queuePolicyVersion,
  selectedCandidateId,
  sourceSignalIds,
  onActionRecorded,
}: {
  candidateReasonCodes: string[];
  currentQueueCandidatePresent: boolean;
  detail?: AdvisorIdeaCandidateDetailData;
  error: Error | null;
  isLoading: boolean;
  portfolioId: string;
  presentationAuthority?: IdeaPresentationAuthority;
  queueEvaluatedAtUtc?: string;
  queueItem?: AdvisorIdeaQueueItem;
  queuePolicyVersion?: string;
  selectedCandidateId: string;
  sourceSignalIds: string[];
  onActionRecorded: () => Promise<IdeaActionRefreshResult>;
}) {
  const candidate = detail?.candidate;
  const evidence = detail?.evidence;
  const audit = detail?.auditSummary;
  const sourceRefs = evidence?.sourceRefs ?? [];
  const evidenceIdentity = readAdvisorIdeaEvidenceIdentity(evidence);
  const actionAuthority = buildIdeaCandidateActionAuthority({
    candidateId: selectedCandidateId,
    detailCandidateId: candidate?.candidateId,
    candidateMaterialVersion: queueItem?.candidate?.materialVersion,
    candidateEvidenceVersion: queueItem?.candidate?.evidenceVersion,
    detailCandidateMaterialVersion:
      candidate?.identity?.materialVersion ?? candidate?.materialVersion,
    detailCandidateEvidenceVersion:
      candidate?.identity?.evidenceVersion ?? candidate?.evidenceVersion,
    evidenceIdentity,
    detailSourceCutPosture: evidence?.sourceCutPosture,
    queueEvidencePacketId: queueItem?.candidate?.evidencePacketId,
    queueSourceCutPosture: queueItem?.candidate?.sourceCutPosture,
    queueSourceRevisionVectorDigest:
      queueItem?.candidate?.sourceRevisionVectorDigest,
  });
  const persistedAcceptedReviewAuthority =
    readPersistedAcceptedIdeaReviewAuthority({
      authority: actionAuthority,
      decisions: detail?.reviewDecisions,
      durableStorageBacked: detail?.durableStorageBacked === true,
    });
  return (
    <div
      className={styles.detailPanel}
      aria-label="Idea candidate source-safe detail"
    >
      <div className={styles.detailHeader}>
        <div>
          <Text variant="microLabel">Source-Safe Candidate Detail</Text>
          <Text variant="subsectionTitle" as="h3">
            {candidate?.candidateId ?? selectedCandidateId}
          </Text>
          <Text variant="secondary">
            Detail is fetched through Gateway with portfolio-scoped Idea caller
            headers.
          </Text>
        </div>
        <Link
          className="nav-link"
          href={`/recommendations?mode=opportunities&portfolioId=${encodeURIComponent(portfolioId)}`}
        >
          Close detail
        </Link>
      </div>
      {isLoading ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} />
          <Text variant="body">Loading source-safe candidate detail...</Text>
        </Stack>
      ) : error ? (
        <Alert severity="warning">
          Candidate detail is unavailable through Gateway. No raw API response
          is shown.
        </Alert>
      ) : (
        <>
          <div className={styles.detailGrid}>
            <span>Family: {formatDetailCode(candidate?.family)}</span>
            <span>
              Lifecycle: {formatDetailCode(candidate?.lifecycleStatus)}
            </span>
            <span>Review: {formatDetailCode(candidate?.reviewPosture)}</span>
            <span>
              Evidence: {evidence?.supportability ?? "Evidence pending"}
            </span>
            <span>Sources: {sourceRefs.length}</span>
            <span>
              Source refs:{" "}
              {sourceRefs.length > 0
                ? sourceRefs.map(formatSourceRef).join(", ")
                : "None"}
            </span>
            <span>
              Source signals:{" "}
              {sourceSignalIds.length > 0 ? sourceSignalIds.join(", ") : "None"}
            </span>
            <span>Queue policy: {queuePolicyVersion ?? "Policy pending"}</span>
            <span>
              Queue evaluated: {queueEvaluatedAtUtc ?? "Evaluation pending"}
            </span>
            <span>
              Evidence hash:{" "}
              {evidence?.evidenceContentHash ??
                "Not provided by Idea detail contract"}
            </span>
            <span>Audit events: {audit?.eventCount ?? 0}</span>
            <span>
              Durable storage:{" "}
              {detail?.durableStorageBacked ? "Backed" : "Not backed"}
            </span>
            <span>
              Supported feature:{" "}
              {detail?.supportedFeaturePromoted ? "Promoted" : "Not promoted"}
            </span>
          </div>
          {candidate?.candidateId ? (
            <IdeaCandidateActionPanel
              key={candidate.candidateId}
              candidateId={candidate.candidateId}
              candidateReasonCodes={candidateReasonCodes}
              currentQueueCandidatePresent={currentQueueCandidatePresent}
              actionAuthority={actionAuthority}
              evidenceIdentity={evidenceIdentity}
              persistedAcceptedReviewAuthority={
                persistedAcceptedReviewAuthority
              }
              portfolioId={portfolioId}
              presentationAuthority={presentationAuthority}
              onRecorded={onActionRecorded}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function findQueueItemByCandidateId(
  items: AdvisorIdeaQueueItem[] | undefined,
  candidateId: string | undefined,
): AdvisorIdeaQueueItem | undefined {
  if (!candidateId) {
    return undefined;
  }
  return items?.find((item) => item.candidate?.candidateId === candidateId);
}

function formatSourceRef(sourceRef: Record<string, unknown>): string {
  return (
    firstString(sourceRef, [
      "productId",
      "sourceProductId",
      "source_product_id",
      "sourceRef",
      "source_ref",
      "ref",
      "id",
    ]) ?? "Unidentified source ref"
  );
}

function firstString(
  source: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!source) {
    return undefined;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function formatDetailCode(value: string | undefined): string {
  if (!value) {
    return "Pending";
  }
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
