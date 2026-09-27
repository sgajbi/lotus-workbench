"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button } from "@mui/material";

import {
  createProposalMemo,
  getProposalMemo,
  getProposalMemoLineage,
  getProposalMemoProjection,
  getProposalMemoReplayEvidence,
  requestProposalMemoAdvisorCommentary,
  requestProposalMemoReportPackage,
  reviewProposalMemo,
} from "../api";
import { formatProposalEvidenceHash } from "../proposal-evidence-formatters";
import {
  buildAdvisorCommentaryPayload,
  buildApproveMemoPayload,
  buildCreateMemoPayload,
  buildMemoActionIdempotencyKey,
  buildMemoReportPackagePayload,
} from "../proposal-memo-action-payloads";
import {
  buildProposalMemoPostureModel,
  confirmedProposalVersionFromMemoAction,
  confirmedProposalVersionFromMemoRefresh,
  confirmMemoCommentaryRefresh,
  confirmMemoCreateRefresh,
  confirmMemoReportPackageRefresh,
  confirmMemoReviewRefresh,
  ProposalMemoRefreshVerificationError,
  PROPOSAL_MEMO_PROJECTION_AUDIENCE_LABELS,
  PROPOSAL_MEMO_PROJECTION_AUDIENCES,
  type ProposalMemoProjectionAudience,
  type ProposalMemoRefreshEvidence,
} from "../proposal-memo-posture-view-model";
import {
  PROPOSAL_MEMO_ACTION_FAILURE_COPY,
  proposalMemoPendingActionCopy,
  proposalMemoActionSuccessCopy,
  proposalMemoRefreshFailureCopy,
  type ProposalMemoActionCopyKey,
} from "@/copy/proposal-memo-copy";
import {
  isProposalMemoSourceConfirmedAbsent,
  resolveProposalMemoSourceState,
} from "../proposal-memo-source-state";
import {
  resolveHistoricalMemoLineageSource,
  resolveHistoricalMemoSourceIdentity,
} from "../proposal-memo-source-identity";
import { workbenchStrictQueryDefaults } from "@/features/platform-runtime/query-policy";
import {
  SectionBlock,
  SemanticBadge,
  SupportDetails,
  Text,
  WorkbenchStatusStrip,
} from "@/design-system";
import styles from "./proposal-review-panel.module.css";

type Props = {
  proposalId: string;
  currentVersionNo?: number | null;
};

type PendingMemoAction = ProposalMemoActionCopyKey;

type PendingMemoActionState =
  | {
      kind: PendingMemoAction;
      versionNo: number;
    }
  | {
      kind: "refresh";
      versionNo: number;
    };

type MemoActionFailure = {
  copy: string;
  versionNo: number;
};

type MemoActionSuccess = {
  copy: string;
  versionNo: number;
};

type PendingConfirmationFailure =
  | "source-unconfirmed"
  | "historical-lineage-unavailable";

type PendingMemoConfirmation = (
  | {
      kind: "create";
      result: Awaited<ReturnType<typeof createProposalMemo>>;
    }
  | {
      kind: "review";
      result: Awaited<ReturnType<typeof reviewProposalMemo>>;
    }
  | {
      kind: "report";
      result: Awaited<ReturnType<typeof requestProposalMemoReportPackage>>;
    }
  | {
      kind: "commentary";
      result: Awaited<ReturnType<typeof requestProposalMemoAdvisorCommentary>>;
    }
) & {
  selectedAudience: ProposalMemoProjectionAudience;
  versionNo: number;
};

function confirmPendingMemoRefresh(
  confirmation: PendingMemoConfirmation,
  refreshed: ProposalMemoRefreshEvidence,
): void {
  switch (confirmation.kind) {
    case "create":
      confirmMemoCreateRefresh({ action: confirmation.result, refreshed });
      break;
    case "review":
      confirmMemoReviewRefresh({ action: confirmation.result, refreshed });
      break;
    case "report":
      confirmMemoReportPackageRefresh({
        action: confirmation.result,
        refreshed,
      });
      break;
    case "commentary":
      confirmMemoCommentaryRefresh({
        action: confirmation.result,
        refreshed,
      });
  }
}

function confirmedPendingActionVersion(
  confirmation: PendingMemoConfirmation,
  proposalId: string,
  versionNo: number,
): number {
  const actionMemo = confirmation.kind === "create"
    ? confirmation.result
    : confirmation.result.memo;
  return confirmedProposalVersionFromMemoAction(
    actionMemo,
    proposalId,
    versionNo,
  );
}

function classifyPartialHistoricalLineage(
  pendingConfirmation: PendingMemoConfirmation | undefined,
  lineage: ProposalMemoRefreshEvidence["lineage"] | undefined,
  proposalId: string,
  versionNo: number,
): void {
  if (!pendingConfirmation || !lineage) {
    return;
  }
  const actionVersionFloor = confirmedPendingActionVersion(
    pendingConfirmation,
    proposalId,
    versionNo,
  );
  if (
    lineage.proposal?.current_version_no === undefined
    || lineage.proposal.current_version_no < actionVersionFloor
  ) {
    return;
  }
  const actionMemo = pendingConfirmation.kind === "create"
    ? pendingConfirmation.result
    : pendingConfirmation.result.memo;
  const actionIdentity = resolveHistoricalMemoSourceIdentity(
    actionMemo,
    proposalId,
    versionNo,
  );
  if (
    resolveHistoricalMemoLineageSource(
      lineage,
      actionIdentity,
      proposalId,
      versionNo,
    ).kind === "historical-item-missing"
  ) {
    throw new ProposalMemoRefreshVerificationError(
      "historical-lineage-unavailable",
    );
  }
}

function upsertPendingAction(
  current: PendingMemoActionState[],
  next: PendingMemoActionState,
): PendingMemoActionState[] {
  return [...current.filter((item) => item.versionNo !== next.versionNo), next];
}

function removePendingAction(
  current: PendingMemoActionState[],
  completed: PendingMemoActionState,
): PendingMemoActionState[] {
  return current.filter(
    (item) =>
      item.versionNo !== completed.versionNo || item.kind !== completed.kind,
  );
}

function hasPendingAction(
  actions: PendingMemoActionState[],
  versionNo: number,
  kind?: PendingMemoActionState["kind"],
): boolean {
  return actions.some(
    (action) =>
      action.versionNo === versionNo
      && (kind === undefined || action.kind === kind),
  );
}

export default function ProposalMemoPosturePanel({
  proposalId,
  currentVersionNo,
}: Props) {
  return (
    <ProposalMemoPosturePanelProposalScope
      key={proposalId}
      proposalId={proposalId}
      currentVersionNo={currentVersionNo}
    />
  );
}

function ProposalMemoPosturePanelProposalScope({
  proposalId,
  currentVersionNo,
}: Props) {
  const [pendingActions, setPendingActions] = useState<
    PendingMemoActionState[]
  >([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingMemoConfirmation[]
  >([]);
  const [confirmationFailures, setConfirmationFailures] = useState<
    Record<number, PendingConfirmationFailure>
  >({});
  const [actionFailure, setActionFailure] =
    useState<MemoActionFailure | null>(null);
  const [actionSuccess, setActionSuccess] =
    useState<MemoActionSuccess | null>(null);
  const [confirmedVersionFloor, setConfirmedVersionFloor] = useState<
    number | null
  >(null);

  return (
    <ProposalMemoPosturePanelSession
      key={`${proposalId}:${currentVersionNo ?? "unavailable"}`}
      proposalId={proposalId}
      currentVersionNo={currentVersionNo}
      actionFailure={actionFailure}
      confirmedVersionFloor={confirmedVersionFloor}
      confirmationFailures={confirmationFailures}
      actionSuccess={actionSuccess}
      pendingActions={pendingActions}
      pendingConfirmations={pendingConfirmations}
      onActionFailureChange={setActionFailure}
      onConfirmedVersionFloorChange={setConfirmedVersionFloor}
      onConfirmationFailuresChange={setConfirmationFailures}
      onActionSuccessChange={setActionSuccess}
      onPendingActionsChange={setPendingActions}
      onPendingConfirmationsChange={setPendingConfirmations}
    />
  );
}

type SessionProps = Props & {
  actionFailure: MemoActionFailure | null;
  confirmedVersionFloor: number | null;
  confirmationFailures: Record<number, PendingConfirmationFailure>;
  actionSuccess: MemoActionSuccess | null;
  pendingActions: PendingMemoActionState[];
  pendingConfirmations: PendingMemoConfirmation[];
  onActionFailureChange: (value: MemoActionFailure | null) => void;
  onConfirmedVersionFloorChange: Dispatch<SetStateAction<number | null>>;
  onConfirmationFailuresChange: Dispatch<
    SetStateAction<Record<number, PendingConfirmationFailure>>
  >;
  onActionSuccessChange: Dispatch<SetStateAction<MemoActionSuccess | null>>;
  onPendingActionsChange: Dispatch<SetStateAction<PendingMemoActionState[]>>;
  onPendingConfirmationsChange: Dispatch<
    SetStateAction<PendingMemoConfirmation[]>
  >;
};

function ProposalMemoPosturePanelSession({
  proposalId,
  currentVersionNo,
  actionFailure,
  confirmedVersionFloor,
  confirmationFailures,
  actionSuccess,
  pendingActions,
  pendingConfirmations,
  onActionFailureChange: setActionFailure,
  onConfirmedVersionFloorChange: setConfirmedVersionFloor,
  onConfirmationFailuresChange: setConfirmationFailures,
  onActionSuccessChange: setActionSuccess,
  onPendingActionsChange: setPendingActions,
  onPendingConfirmationsChange,
}: SessionProps) {
  const versionNo = currentVersionNo ?? null;
  const [actorReference, setActorReference] = useState("");
  const [reviewRationale, setReviewRationale] = useState("");
  const [audience, setAudience] =
    useState<ProposalMemoProjectionAudience>("ADVISOR");

  const memoQuery = useQuery({
    queryKey: ["proposal-memo", proposalId, versionNo],
    queryFn: async () =>
      await getProposalMemo(proposalId, requireVersion(versionNo)),
    ...workbenchStrictQueryDefaults,
    enabled: versionNo !== null,
  });
  const projectionQuery = useQuery({
    queryKey: ["proposal-memo-projection", proposalId, versionNo, audience],
    queryFn: async () =>
      await getProposalMemoProjection(
        proposalId,
        requireVersion(versionNo),
        audience,
    ),
    ...workbenchStrictQueryDefaults,
    placeholderData: (previousData) => previousData,
    enabled: versionNo !== null,
  });
  const lineageQuery = useQuery({
    queryKey: ["proposal-memo-lineage", proposalId, versionNo],
    queryFn: async () => await getProposalMemoLineage(proposalId),
    ...workbenchStrictQueryDefaults,
    enabled: versionNo !== null,
  });
  const replayQuery = useQuery({
    queryKey: ["proposal-memo-replay-evidence", proposalId, versionNo],
    queryFn: async () =>
      await getProposalMemoReplayEvidence(
        proposalId,
        requireVersion(versionNo),
      ),
    ...workbenchStrictQueryDefaults,
    enabled: versionNo !== null,
  });

  const sourceLoading = Boolean(
    versionNo !== null
    && (memoQuery.isPending
      || projectionQuery.isPending
      || lineageQuery.isPending
      || replayQuery.isPending),
  );
  const sourceRefreshing = Boolean(
    versionNo !== null
    && (memoQuery.isFetching
      || projectionQuery.isFetching
      || lineageQuery.isFetching
      || replayQuery.isFetching),
  );
  const sourceConfirmsMemoAbsent = isProposalMemoSourceConfirmedAbsent({
    lineageData: lineageQuery.data,
    lineageError: lineageQuery.error,
    memoData: memoQuery.data,
    memoError: memoQuery.error,
    projectionData: projectionQuery.data,
    projectionError: projectionQuery.error,
    proposalId,
    replayData: replayQuery.data,
    replayError: replayQuery.error,
    versionNo,
  });
  const posture = useMemo(
    () =>
      buildProposalMemoPostureModel({
        lineageData: lineageQuery.data,
        memoData: memoQuery.data,
        proposalId,
        projectionData: projectionQuery.data,
        replayData: replayQuery.data,
        selectedAudience: audience,
        sourceConfirmsMemoAbsent,
        versionNo,
      }),
    [
      audience,
      lineageQuery.data,
      memoQuery.data,
      proposalId,
      projectionQuery.data,
      replayQuery.data,
      sourceConfirmsMemoAbsent,
      versionNo,
    ],
  );
  const sourceEvidenceReadable = Boolean(
    memoQuery.data ||
      projectionQuery.data ||
      lineageQuery.data ||
      replayQuery.data,
  );
  const sourceReadable = Boolean(
    versionNo !== null && !sourceLoading && sourceEvidenceReadable,
  );
  const sourceState = resolveProposalMemoSourceState({
    isChecking: sourceLoading || sourceRefreshing,
    lineageData: lineageQuery.data,
    lineageError: lineageQuery.error,
    memoData: memoQuery.data,
    memoError: memoQuery.error,
    projectionData: projectionQuery.data,
    projectionError: projectionQuery.error,
    proposalId,
    replayData: replayQuery.data,
    replayError: replayQuery.error,
    sourceIdentityCurrent: posture.sourceIdentityCurrent,
    versionNo,
  });
  const sourceUnavailable = sourceState === "unavailable";
  const sourceReady = sourceState === "ready" || sourceState === "not-prepared";
  const actorEntered = actorReference.trim().length > 0;
  const blockingPendingConfirmation = pendingConfirmations.find(
    (confirmation) => versionNo !== null && confirmation.versionNo >= versionNo,
  ) ?? null;
  const versionRegressionBlocked = Boolean(
    versionNo !== null
    && confirmedVersionFloor !== null
    && versionNo < confirmedVersionFloor,
  );
  const workflowBlocked =
    blockingPendingConfirmation !== null || versionRegressionBlocked;
  const pendingVersionAction = pendingActions.find(
    (action) => action.versionNo === versionNo,
  ) ?? null;
  const pendingMutation = pendingActions.find(
    (action) => action.kind !== "refresh",
  ) ?? null;
  const actionControlsBusy =
    pendingMutation !== null || pendingVersionAction !== null;
  const pendingConfirmationRefreshing = Boolean(
    blockingPendingConfirmation
    && hasPendingAction(
      pendingActions,
      blockingPendingConfirmation.versionNo,
      "refresh",
    ),
  );

  async function refreshMemoState(
    targetVersionNo: number,
    targetAudience: ProposalMemoProjectionAudience,
    pendingConfirmation?: PendingMemoConfirmation,
  ): Promise<ProposalMemoRefreshEvidence> {
    if (targetVersionNo !== versionNo || targetAudience !== audience) {
      const [memoResult, projectionResult, lineageResult, replayResult] =
        await Promise.allSettled([
        getProposalMemo(proposalId, targetVersionNo),
        getProposalMemoProjection(proposalId, targetVersionNo, targetAudience),
        getProposalMemoLineage(proposalId),
        getProposalMemoReplayEvidence(proposalId, targetVersionNo),
      ]);
      if (
        memoResult.status === "rejected"
        || projectionResult.status === "rejected"
        || lineageResult.status === "rejected"
        || replayResult.status === "rejected"
      ) {
        classifyPartialHistoricalLineage(
          pendingConfirmation,
          lineageResult.status === "fulfilled"
            ? lineageResult.value
            : undefined,
          proposalId,
          targetVersionNo,
        );
        throw new Error("MEMO_REFRESH_UNAVAILABLE");
      }
      return {
        memo: memoResult.value,
        proposalId,
        projection: projectionResult.value,
        lineage: lineageResult.value,
        replay: replayResult.value,
        selectedAudience: targetAudience,
        versionNo: targetVersionNo,
      };
    }

    const [memoResult, projectionResult, lineageResult, replayResult] =
      await Promise.all([
        memoQuery.refetch(),
        projectionQuery.refetch(),
        lineageQuery.refetch(),
        replayQuery.refetch(),
      ]);
    if (
      memoResult.error ||
      projectionResult.error ||
      lineageResult.error ||
      replayResult.error ||
      !memoResult.data ||
      !projectionResult.data ||
      !lineageResult.data ||
      !replayResult.data
    ) {
      classifyPartialHistoricalLineage(
        pendingConfirmation,
        lineageResult.error ? undefined : lineageResult.data,
        proposalId,
        targetVersionNo,
      );
      throw new Error("MEMO_REFRESH_UNAVAILABLE");
    }
    return {
      memo: memoResult.data,
      proposalId,
      projection: projectionResult.data,
      lineage: lineageResult.data,
      replay: replayResult.data,
      selectedAudience: targetAudience,
      versionNo: targetVersionNo,
    };
  }

  async function handleCreateMemo() {
    if (
      versionNo === null
      || !actorEntered
      || !posture.sourceIdentityCurrent
      || posture.hasMemo
      || actionControlsBusy
      || workflowBlocked
    ) {
      return;
    }
    await runMemoAction("create", versionNo, async () => ({
      kind: "create",
      result: await createProposalMemo(
        proposalId,
        versionNo,
        buildCreateMemoPayload(actorReference),
        buildMemoActionIdempotencyKey({
          proposalId,
          versionNo,
          operation: "create",
        }),
      ),
      selectedAudience: audience,
      versionNo,
    }));
  }

  async function handleReviewMemo() {
    if (
      versionNo === null ||
      !actorEntered ||
      !posture.canRecordReview ||
      !posture.memoHash ||
      !reviewRationale.trim() ||
      actionControlsBusy ||
      workflowBlocked
    ) {
      return;
    }
    await runMemoAction(
      "review",
      versionNo,
      async () => ({
        kind: "review",
        result: await reviewProposalMemo(
          proposalId,
          versionNo,
          buildApproveMemoPayload({
            advisorId: actorReference,
            memoHash: posture.memoHash!,
            reviewReason: reviewRationale,
          }),
          buildMemoActionIdempotencyKey({
            proposalId,
            versionNo,
            operation: "review",
          }),
        ),
        selectedAudience: audience,
        versionNo,
      }),
      () => setReviewRationale(""),
    );
  }

  async function handleRequestDiscussionMaterial() {
    if (
      versionNo === null ||
      !actorEntered ||
      !posture.canRequestReportPackage ||
      !posture.memoHash ||
      actionControlsBusy ||
      workflowBlocked
    ) {
      return;
    }
    await runMemoAction("report", versionNo, async () => ({
      kind: "report",
      result: await requestProposalMemoReportPackage(
        proposalId,
        versionNo,
        buildMemoReportPackagePayload({
          advisorId: actorReference,
          memoHash: posture.memoHash!,
        }),
        buildMemoActionIdempotencyKey({
          proposalId,
          versionNo,
          operation: "report-package",
        }),
      ),
      selectedAudience: audience,
      versionNo,
    }));
  }

  async function handleRequestCommentary() {
    if (
      versionNo === null ||
      !actorEntered ||
      !posture.canRequestCommentary ||
      !posture.memoHash ||
      actionControlsBusy ||
      workflowBlocked
    ) {
      return;
    }
    await runMemoAction("commentary", versionNo, async () => ({
      kind: "commentary",
      result: await requestProposalMemoAdvisorCommentary(
        proposalId,
        versionNo,
        buildAdvisorCommentaryPayload({
          advisorId: actorReference,
          memoHash: posture.memoHash!,
        }),
        buildMemoActionIdempotencyKey({
          proposalId,
          versionNo,
          operation: "advisor-commentary",
        }),
      ),
      selectedAudience: audience,
      versionNo,
    }));
  }

  async function runMemoAction(
    action: PendingMemoAction,
    actionVersionNo: number,
    operation: () => Promise<PendingMemoConfirmation>,
    onConfirmed?: () => void,
  ) {
    const actionState = { kind: action, versionNo: actionVersionNo } as const;
    setPendingActions((current) => upsertPendingAction(current, actionState));
    setActionFailure(null);
    setConfirmationFailures((current) =>
      omitConfirmationFailure(current, actionVersionNo),
    );
    setActionSuccess((current) =>
      current?.versionNo === actionVersionNo ? null : current,
    );
    let confirmation: PendingMemoConfirmation | null = null;
    try {
      const persistedConfirmation = await operation();
      confirmation = persistedConfirmation;
      onPendingConfirmationsChange((current) =>
        upsertPendingConfirmation(current, persistedConfirmation),
      );
      const responseVersionFloor = confirmedPendingActionVersion(
        persistedConfirmation,
        proposalId,
        persistedConfirmation.versionNo,
      );
      setConfirmedVersionFloor((current) =>
        Math.max(current ?? 0, responseVersionFloor),
      );
      const refreshed = await refreshMemoState(
        persistedConfirmation.versionNo,
        persistedConfirmation.selectedAudience,
        persistedConfirmation,
      );
      const confirmedSourceVersionNo =
        confirmedProposalVersionFromMemoRefresh(refreshed);
      setConfirmedVersionFloor((current) =>
        Math.max(current ?? 0, confirmedSourceVersionNo),
      );
      confirmPendingMemoRefresh(persistedConfirmation, refreshed);
      onPendingConfirmationsChange((current) =>
        removePendingConfirmation(current, persistedConfirmation),
      );
      onConfirmed?.();
      setActionSuccess({
        copy: proposalMemoActionSuccessCopy(action, actionVersionNo),
        versionNo: actionVersionNo,
      });
    } catch (error) {
      if (confirmation) {
        const failedConfirmation = confirmation;
        setConfirmationFailures((current) => ({
          ...current,
          [failedConfirmation.versionNo]:
            error instanceof ProposalMemoRefreshVerificationError
            && error.reason === "historical-lineage-unavailable"
              ? "historical-lineage-unavailable"
              : "source-unconfirmed",
        }));
      } else {
        setActionFailure({
          copy: PROPOSAL_MEMO_ACTION_FAILURE_COPY[action],
          versionNo: actionVersionNo,
        });
      }
    } finally {
      setPendingActions((current) => removePendingAction(current, actionState));
    }
  }

  async function handleRefreshConfirmation(
    pendingConfirmation: PendingMemoConfirmation,
  ) {
    if (
      hasPendingAction(pendingActions, pendingConfirmation.versionNo)
    ) {
      return;
    }

    const refreshState = {
      kind: "refresh",
      versionNo: pendingConfirmation.versionNo,
    } as const;
    setPendingActions((current) => upsertPendingAction(current, refreshState));
    setConfirmationFailures((current) =>
      omitConfirmationFailure(current, pendingConfirmation.versionNo),
    );
    setActionSuccess((current) =>
      current?.versionNo === pendingConfirmation.versionNo ? null : current,
    );
    try {
      const responseVersionFloor = confirmedPendingActionVersion(
        pendingConfirmation,
        proposalId,
        pendingConfirmation.versionNo,
      );
      setConfirmedVersionFloor((current) =>
        Math.max(current ?? 0, responseVersionFloor),
      );
      const refreshed = await refreshMemoState(
        pendingConfirmation.versionNo,
        pendingConfirmation.selectedAudience,
        pendingConfirmation,
      );
      const confirmedSourceVersionNo =
        confirmedProposalVersionFromMemoRefresh(refreshed);
      setConfirmedVersionFloor((current) =>
        Math.max(current ?? 0, confirmedSourceVersionNo),
      );
      confirmPendingMemoRefresh(pendingConfirmation, refreshed);
      if (
        pendingConfirmation.kind === "review"
        && pendingConfirmation.versionNo === versionNo
      ) {
        setReviewRationale("");
      }
      setActionSuccess((current) =>
        current && current.versionNo > pendingConfirmation.versionNo
          ? current
          : {
              copy: proposalMemoActionSuccessCopy(
                pendingConfirmation.kind,
                pendingConfirmation.versionNo,
              ),
              versionNo: pendingConfirmation.versionNo,
            },
      );
      onPendingConfirmationsChange((current) =>
        removePendingConfirmation(current, pendingConfirmation),
      );
    } catch (error) {
      setConfirmationFailures((current) => ({
        ...current,
        [pendingConfirmation.versionNo]:
          error instanceof ProposalMemoRefreshVerificationError
          && error.reason === "historical-lineage-unavailable"
            ? "historical-lineage-unavailable"
            : "source-unconfirmed",
      }));
    } finally {
      setPendingActions((current) =>
        removePendingAction(current, refreshState),
      );
    }
  }

  return (
    <SectionBlock
      id="proposal-memo-evidence-pack"
      className={styles.panel}
      title="Advisor memo and evidence pack"
      subtitle="Prepare the working memo, record advisor review, then request material for the client discussion."
      actions={
        <SemanticBadge
          tone={
            !workflowBlocked
            && sourceReady
            && posture.sourceEvidenceAligned
              ? "success"
              : "warn"
          }
        >
          {versionNo === null
            ? "Version required"
            : versionRegressionBlocked
              ? "Proposal refresh required"
              : blockingPendingConfirmation !== null
                ? pendingConfirmationRefreshing || sourceRefreshing
                ? "Checking record"
                : "Awaiting confirmation"
              : pendingMutation !== null
                ? "Recording action"
              : sourceLoading || sourceRefreshing
                ? "Checking evidence"
                : sourceUnavailable
                  ? "Evidence unavailable"
                  : posture.statusLabel}
        </SemanticBadge>
      }
    >
      <div
        data-testid="proposal-memo-source-state"
        data-source-state={sourceState}
        aria-busy={sourceLoading || sourceRefreshing}
      >
        {sourceLoading || sourceRefreshing ? (
          <Alert severity="info">
            Checking the current memo, review and retained evidence before showing
            the next advisor action.
          </Alert>
        ) : null}
      </div>
      {versionNo === null ? (
        <Alert severity="warning">
          A current proposal version is required before memo evidence can be
          prepared or reviewed.
        </Alert>
      ) : null}
      {versionRegressionBlocked ? (
        <Alert severity="warning" role="alert">
          Memo evidence is confirmed through proposal version {confirmedVersionFloor},
          but the active proposal record reports version {versionNo}. Refresh the
          proposal record before taking another action.
        </Alert>
      ) : null}
      {sourceUnavailable && blockingPendingConfirmation === null ? (
        <Alert
          severity="warning"
          action={
            <Button
              className={styles.confirmationRefreshAction}
              color="inherit"
              size="small"
              onClick={() =>
                void refreshMemoState(
                  requireVersion(versionNo),
                  audience,
                ).catch(() => undefined)
              }
            >
              Refresh record
            </Button>
          }
        >
          Current memo evidence is unavailable. Existing information remains
          visible, but no action will be confirmed until the source record
          refreshes.
        </Alert>
      ) : null}
      {pendingConfirmations.map((pendingConfirmation) => (
        <Alert
          key={`${pendingConfirmation.kind}:${pendingConfirmation.versionNo}`}
          severity="warning"
          role="alert"
          data-testid="proposal-memo-confirmation-recovery"
          data-confirmation-state={
            hasPendingAction(
              pendingActions,
              pendingConfirmation.versionNo,
              "refresh",
            )
              ? "refreshing"
              : confirmationFailures[pendingConfirmation.versionNo]
                === "historical-lineage-unavailable"
                ? "lineage-unavailable"
              : "awaiting-source"
          }
          action={
            <Button
              className={styles.confirmationRefreshAction}
              color="inherit"
              size="small"
              disabled={hasPendingAction(
                pendingActions,
                pendingConfirmation.versionNo,
              )}
              onClick={() => void handleRefreshConfirmation(pendingConfirmation)}
            >
              {hasPendingAction(
                pendingActions,
                pendingConfirmation.versionNo,
                "refresh",
              )
                ? "Refreshing…"
                : "Refresh record"}
            </Button>
          }
        >
          {proposalMemoRefreshFailureCopy({
            action: pendingConfirmation.kind,
            currentVersionNo: versionNo,
            historicalEvidenceUnavailable:
              confirmationFailures[pendingConfirmation.versionNo]
              === "historical-lineage-unavailable",
            versionNo: pendingConfirmation.versionNo,
          })}
        </Alert>
      ))}
      {actionFailure?.versionNo === versionNo
      && blockingPendingConfirmation === null ? (
        <Alert severity="warning" role="alert">
          {actionFailure.copy}
        </Alert>
      ) : null}
      {pendingMutation !== null
      && pendingMutation.versionNo !== versionNo ? (
        <Alert severity="info" role="status">
          {proposalMemoPendingActionCopy(
            pendingMutation.kind,
            pendingMutation.versionNo,
          )}
        </Alert>
      ) : null}
      {actionSuccess ? (
        <Alert
          severity="success"
          role="status"
          data-testid="proposal-memo-action-status"
        >
          {actionSuccess.copy}
        </Alert>
      ) : null}

      {sourceReadable ? (
        <>
      <WorkbenchStatusStrip
        label="Advisor memo workflow"
        items={posture.workflowItems}
        className={styles.workflow}
        gridClassName={styles.workflowGrid}
        itemClassName={styles.workflowItem}
        itemLabelClassName={styles.workflowLabel}
        itemBodyClassName={styles.workflowBody}
        itemChipClassName={styles.workflowChip}
        itemSupportClassName={styles.workflowSupport}
      />

      <section
        className={styles.nextAction}
        aria-labelledby="memo-next-action-title"
      >
        <Text variant="eyebrow">Memo next step</Text>
        <Text variant="cardTitle" as="h3" id="memo-next-action-title">
          {posture.nextActionTitle}
        </Text>
        <Text variant="secondary">{posture.nextActionDetail}</Text>
      </section>

      {posture.nextActionKey === "review" ? (
        <label className={styles.rationaleField}>
          <Text variant="dataLabel">Advisor review rationale</Text>
          <textarea
            className="textarea"
            rows={3}
            value={reviewRationale}
            onChange={(event) => setReviewRationale(event.target.value)}
            disabled={actionControlsBusy || workflowBlocked}
            placeholder="Explain why the memo evidence is appropriate for advisor use."
          />
        </label>
      ) : null}

      <SupportDetails
        summary="Memo record details"
        context={`Version ${versionNo ?? "not available"} · ${posture.projectionAudienceLabel} · ${
          actorEntered
            ? "advisor reference entered"
            : "advisor reference required"
        }`}
      >
        <div className={`${styles.recordGrid} ${styles.memoRecordGrid}`}>
          <div className={styles.readOnlyRecord}>
            <Text variant="dataLabel">Current proposal version</Text>
            <Text variant="body">{versionNo ?? "Not available"}</Text>
          </div>
          <label className={styles.reviewerField}>
            <Text variant="dataLabel">Advisor or reviewer reference</Text>
            <input
              className="input"
                value={actorReference}
                onChange={(event) => setActorReference(event.target.value)}
                disabled={actionControlsBusy || workflowBlocked}
                placeholder="Enter the advisor or reviewer reference"
              autoComplete="off"
            />
          </label>
          <label className={styles.reviewerField}>
            <Text variant="dataLabel">Audience view</Text>
            <select
              className="input"
              value={audience}
              disabled={actionControlsBusy || workflowBlocked}
              onChange={(event) =>
                setAudience(
                  event.target.value as ProposalMemoProjectionAudience,
                )
              }
            >
              {PROPOSAL_MEMO_PROJECTION_AUDIENCES.map((item) => (
                <option key={item} value={item}>
                  {PROPOSAL_MEMO_PROJECTION_AUDIENCE_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <dl className={`${styles.supportFacts} ${styles.memoSupportFacts}`}>
          <div>
            <dt>Memo evidence</dt>
            <dd>{formatProposalEvidenceHash(posture.memoHash)}</dd>
          </div>
          <div>
            <dt>Recorded activity</dt>
            <dd>
              {posture.eventCount} event{posture.eventCount === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt>Retained material</dt>
            <dd>{posture.reportArchiveRefsLabel}</dd>
          </div>
          <div>
            <dt>Commentary role</dt>
            <dd>{posture.commentaryAuthorityLabel}</dd>
          </div>
        </dl>
      </SupportDetails>
        </>
      ) : null}

      {sourceReady ? (
        <div className={styles.actionArea}>
        <div className={styles.actionRow}>
          {posture.nextActionKey === "prepare" ? (
            <Button
              type="button"
              variant="contained"
              disabled={
                !actorEntered ||
                 versionNo === null ||
                 sourceLoading ||
                 actionControlsBusy ||
                 workflowBlocked
               }
              onClick={() => void handleCreateMemo()}
            >
              {pendingVersionAction?.kind === "create"
                ? "Preparing memo…"
                : "Prepare advisor memo"}
            </Button>
          ) : null}
          {posture.nextActionKey === "review" ? (
            <Button
              type="button"
              variant="contained"
              disabled={
                !actorEntered ||
                !reviewRationale.trim() ||
                 !posture.canRecordReview ||
                 sourceLoading ||
                 actionControlsBusy ||
                 workflowBlocked
               }
              onClick={() => void handleReviewMemo()}
            >
              {pendingVersionAction?.kind === "review"
                ? "Recording review…"
                : "Record advisor review"}
            </Button>
          ) : null}
          {posture.nextActionKey === "report" ? (
            <Button
              type="button"
              variant="contained"
              disabled={
                !actorEntered ||
                 !posture.canRequestReportPackage ||
                 sourceLoading ||
                 actionControlsBusy ||
                 workflowBlocked
               }
              onClick={() => void handleRequestDiscussionMaterial()}
            >
              {pendingVersionAction?.kind === "report"
                ? "Requesting material…"
                : "Request discussion material"}
            </Button>
          ) : null}
          {posture.canRequestCommentary ? (
            <Button
              type="button"
              variant="outlined"
              disabled={
                !actorEntered ||
                sourceLoading ||
                actionControlsBusy ||
                workflowBlocked
              }
              onClick={() => void handleRequestCommentary()}
            >
              {pendingVersionAction?.kind === "commentary"
                ? "Requesting review aid…"
                : posture.commentaryRecorded
                  ? "Refresh advisor commentary"
                  : "Request advisor commentary"}
            </Button>
          ) : null}
        </div>
        <Text variant="metadata" className={styles.actionSupport}>
          Discussion material and commentary remain advisor working aids. Client
          release, delivery, suitability approval and implementation are
          separate controlled steps.
        </Text>
        </div>
      ) : null}
    </SectionBlock>
  );
}

function requireVersion(versionNo: number | null): number {
  if (versionNo === null) {
    throw new Error("A current proposal version is required.");
  }
  return versionNo;
}

function upsertPendingConfirmation(
  confirmations: PendingMemoConfirmation[],
  next: PendingMemoConfirmation,
): PendingMemoConfirmation[] {
  return [
    ...confirmations.filter(
      (confirmation) => confirmation.versionNo !== next.versionNo,
    ),
    next,
  ];
}

function removePendingConfirmation(
  confirmations: PendingMemoConfirmation[],
  completed: PendingMemoConfirmation,
): PendingMemoConfirmation[] {
  return confirmations.filter(
    (confirmation) => confirmation.versionNo !== completed.versionNo,
  );
}

function omitConfirmationFailure(
  failures: Record<number, PendingConfirmationFailure>,
  versionNo: number,
): Record<number, PendingConfirmationFailure> {
  const next = { ...failures };
  delete next[versionNo];
  return next;
}
