"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import { recordAdvisorIdeaPresentationReceipt } from "./api";
import {
  buildIdeaPresentationReceiptDrafts,
  createIdeaPresentationIdempotencyKey,
  readIdeaPresentationSource,
  type IdeaPresentationSource,
  type IdeaPresentationReceiptDraft,
} from "./idea-presentation-receipt";
import type { AdvisorIdeaReviewQueueData } from "./types";

const VISIBILITY_THRESHOLD = 0.5;
const MARKER_SELECTOR = "[data-idea-presentation-candidate]";

function subscribeToStaticBrowserCapability() {
  return () => undefined;
}

function getIntersectionObserverSupport() {
  return "IntersectionObserver" in globalThis;
}

function getServerIntersectionObserverSupport() {
  return true;
}

type ReceiptTransaction = {
  candidateId: string;
  evidencePacketId: string;
  idempotencyKey: string;
  request: IdeaPresentationReceiptDraft;
  receiptId?: string;
  snapshotKey: string;
  status: "pending" | "recorded" | "failed";
};

export type IdeaPresentationAuthority = {
  candidateId: string;
  evidencePacketId: string;
  receiptId: string;
  candidateMaterialVersion: number;
  candidateEvidenceVersion: number;
  sourceRevisionVectorDigest: `sha256:${string}`;
  sourceCutPosture: IdeaPresentationReceiptDraft["sourceCutPosture"];
};

export type IdeaPresentationReceiptState = {
  status: "ready" | "recording" | "attention" | "unavailable";
  failedCount: number;
  authorityByCandidateId: ReadonlyMap<string, IdeaPresentationAuthority>;
  retryFailed: () => Promise<void>;
};

export function useIdeaPresentationReceipts({
  containerRef,
  enabled,
  portfolioId,
  queue,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  portfolioId: string;
  queue?: AdvisorIdeaReviewQueueData;
}): IdeaPresentationReceiptState {
  const transactions = useRef(new Map<string, ReceiptTransaction>());
  const draftingCandidates = useRef(new Set<string>());
  const unavailableSourceSnapshot = useRef<{
    failedCount: number;
    snapshotKey: string;
  } | null>(null);
  const observationGeneration = useRef(0);
  const sources = useMemo(() => {
    const sourceMap = new Map<string, IdeaPresentationSource>();
    for (const item of queue?.items ?? []) {
      if (!queue) {
        continue;
      }
      const source = readIdeaPresentationSource(queue, item);
      if (source) {
        sourceMap.set(source.candidateId, source);
      }
    }
    return sourceMap;
  }, [queue]);
  const snapshotKey = useMemo(
    () =>
      JSON.stringify([
        queue?.evaluatedAtUtc,
        queue?.policyVersion,
        (queue?.items ?? []).map((item) => [
          item.rank,
          item.candidate?.candidateId,
          item.candidate?.materialVersion,
          item.candidate?.evidenceVersion,
          item.candidate?.evidencePacketId,
          item.candidate?.scorePolicyVersion,
          item.candidate?.sourceRevisionVectorDigest,
          item.candidate?.sourceCutPosture,
        ]),
      ]),
    [queue],
  );
  const activeSnapshotKey = useRef(snapshotKey);
  const [summary, setSummary] = useState<
    Pick<IdeaPresentationReceiptState, "status" | "failedCount"> & {
      snapshotKey: string;
      authorityByCandidateId: ReadonlyMap<string, IdeaPresentationAuthority>;
    }
  >({
    snapshotKey,
    status: "ready",
    failedCount: 0,
    authorityByCandidateId: new Map(),
  });
  const intersectionObserverSupported = useSyncExternalStore(
    subscribeToStaticBrowserCapability,
    getIntersectionObserverSupport,
    getServerIntersectionObserverSupport,
  );

  const refreshSummary = useCallback(() => {
    if (activeSnapshotKey.current !== snapshotKey) {
      return;
    }
    const sourceFailure = unavailableSourceSnapshot.current;
    if (sourceFailure?.snapshotKey === snapshotKey) {
      setSummary({
        snapshotKey,
        status: "unavailable",
        failedCount: sourceFailure.failedCount,
        authorityByCandidateId: new Map(),
      });
      return;
    }
    const entries = [...transactions.current.values()];
    const failedCount = entries.filter(
      (entry) => entry.status === "failed",
    ).length;
    setSummary({
      snapshotKey,
      status:
        failedCount > 0
          ? "attention"
          : entries.some((entry) => entry.status === "pending")
            ? "recording"
            : "ready",
      failedCount,
      authorityByCandidateId: buildAuthorityMap(entries),
    });
  }, [snapshotKey]);

  const submit = useCallback(
    async (transaction: ReceiptTransaction) => {
      try {
        const response = await recordAdvisorIdeaPresentationReceipt({
          candidateId: transaction.candidateId,
          portfolioId,
          idempotencyKey: transaction.idempotencyKey,
          request: transaction.request,
        });
        if (activeSnapshotKey.current !== transaction.snapshotKey) {
          return;
        }
        transaction.receiptId = response.receipt?.receiptId?.trim();
        transaction.status = "recorded";
      } catch {
        transaction.status = "failed";
      } finally {
        refreshSummary();
      }
    },
    [portfolioId, refreshSummary],
  );

  const emitVisibleSet = useCallback(
    async (visibleCandidateIds: string[], generation: number) => {
      const pendingCandidateIds = visibleCandidateIds.filter(
        (candidateId) =>
          !transactions.current.has(candidateId) &&
          !draftingCandidates.current.has(candidateId),
      );
      if (pendingCandidateIds.length === 0) {
        return;
      }
      for (const candidateId of pendingCandidateIds) {
        draftingCandidates.current.add(candidateId);
      }
      let drafts: Awaited<
        ReturnType<typeof buildIdeaPresentationReceiptDrafts>
      >;
      try {
        drafts = await buildIdeaPresentationReceiptDrafts({
          presentedAtUtc: new Date().toISOString(),
          sources,
          visibleCandidateIds,
        });
      } catch {
        if (observationGeneration.current !== generation) {
          return;
        }
        for (const candidateId of pendingCandidateIds) {
          draftingCandidates.current.delete(candidateId);
        }
        unavailableSourceSnapshot.current = {
          snapshotKey,
          failedCount: pendingCandidateIds.length,
        };
        setSummary({
          snapshotKey,
          status: "unavailable",
          failedCount: pendingCandidateIds.length,
          authorityByCandidateId: new Map(),
        });
        return;
      }
      if (observationGeneration.current !== generation) {
        return;
      }
      const newTransactions = drafts
        .filter(({ candidateId }) => pendingCandidateIds.includes(candidateId))
        .map(({ candidateId, request }) => ({
          candidateId,
          evidencePacketId: sources.get(candidateId)!.evidencePacketId,
          idempotencyKey: createIdeaPresentationIdempotencyKey(),
          request,
          snapshotKey,
          status: "pending" as const,
        }));
      for (const transaction of newTransactions) {
        draftingCandidates.current.delete(transaction.candidateId);
        transactions.current.set(transaction.candidateId, transaction);
      }
      refreshSummary();
      await Promise.all(newTransactions.map(submit));
    },
    [refreshSummary, snapshotKey, sources, submit],
  );

  useEffect(() => {
    activeSnapshotKey.current = snapshotKey;
    observationGeneration.current += 1;
    transactions.current.clear();
    draftingCandidates.current.clear();
    unavailableSourceSnapshot.current = null;
  }, [snapshotKey]);

  useEffect(() => {
    const root = containerRef.current;
    if (!enabled || !queue || !root) {
      return;
    }
    if (!intersectionObserverSupported) {
      return;
    }

    let generation = ++observationGeneration.current;
    const activeDraftingCandidates = draftingCandidates.current;
    const observed = new Set<Element>();
    const intersecting = new Map<Element, boolean>();
    let flushScheduled = false;
    const flush = () => {
      flushScheduled = false;
      if (document.visibilityState !== "visible") {
        return;
      }
      const markers = [...observed]
        .filter(
          (marker) =>
            marker.isConnected && intersecting.get(marker) === true,
        )
        .sort(compareVisualOrder);
      const visibleCandidateIds = [
        ...new Set(
          markers
            .map((marker) =>
              marker.getAttribute("data-idea-presentation-candidate"),
            )
            .filter((candidateId): candidateId is string =>
              Boolean(candidateId),
            ),
        ),
      ];
      if (visibleCandidateIds.length > 0) {
        void emitVisibleSet(visibleCandidateIds, generation);
      }
    };
    const scheduleFlush = () => {
      if (!flushScheduled) {
        flushScheduled = true;
        queueMicrotask(flush);
      }
    };
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(
            entry.target,
            entry.isIntersecting &&
              entry.intersectionRatio >= VISIBILITY_THRESHOLD,
          );
        }
        scheduleFlush();
      },
      { root: null, threshold: VISIBILITY_THRESHOLD },
    );
    const observeMarkers = () => {
      for (const marker of observed) {
        if (!marker.isConnected) {
          intersectionObserver.unobserve(marker);
          observed.delete(marker);
          intersecting.delete(marker);
        }
      }
      for (const marker of root.querySelectorAll(MARKER_SELECTOR)) {
        if (!observed.has(marker)) {
          observed.add(marker);
          if (document.visibilityState === "visible") {
            intersectionObserver.observe(marker);
          }
        }
      }
      scheduleFlush();
    };
    const handleDocumentVisibilityChange = () => {
      generation = ++observationGeneration.current;
      activeDraftingCandidates.clear();
      intersecting.clear();
      intersectionObserver.takeRecords();
      intersectionObserver.disconnect();
      if (document.visibilityState !== "visible") {
        return;
      }
      for (const marker of observed) {
        if (marker.isConnected) {
          intersectionObserver.observe(marker);
        }
      }
    };
    const mutationObserver = new MutationObserver(observeMarkers);
    mutationObserver.observe(root, { childList: true, subtree: true });
    observeMarkers();
    document.addEventListener(
      "visibilitychange",
      handleDocumentVisibilityChange,
    );

    return () => {
      if (observationGeneration.current === generation) {
        observationGeneration.current += 1;
        activeDraftingCandidates.clear();
      }
      document.removeEventListener(
        "visibilitychange",
        handleDocumentVisibilityChange,
      );
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [
    containerRef,
    emitVisibleSet,
    enabled,
    intersectionObserverSupported,
    queue,
    snapshotKey,
  ]);

  const retryFailed = useCallback(async () => {
    const failed = [...transactions.current.values()].filter(
      (transaction) => transaction.status === "failed",
    );
    for (const transaction of failed) {
      transaction.status = "pending";
    }
    refreshSummary();
    await Promise.all(failed.map(submit));
  }, [refreshSummary, submit]);

  const currentSummary =
    summary.snapshotKey === snapshotKey
      ? summary
      : {
          snapshotKey,
          status: "ready" as const,
          failedCount: 0,
          authorityByCandidateId: new Map<string, IdeaPresentationAuthority>(),
        };
  return {
    failedCount: currentSummary.failedCount,
    authorityByCandidateId: currentSummary.authorityByCandidateId,
    status: intersectionObserverSupported
      ? currentSummary.status
      : "unavailable",
    retryFailed,
  };
}

function buildAuthorityMap(
  transactions: ReceiptTransaction[],
): ReadonlyMap<string, IdeaPresentationAuthority> {
  const authorities = new Map<string, IdeaPresentationAuthority>();
  for (const transaction of transactions) {
    if (transaction.status !== "recorded" || !transaction.receiptId) {
      continue;
    }
    authorities.set(transaction.candidateId, {
      candidateId: transaction.candidateId,
      evidencePacketId: transaction.evidencePacketId,
      receiptId: transaction.receiptId,
      candidateMaterialVersion: transaction.request.candidateMaterialVersion,
      candidateEvidenceVersion: transaction.request.candidateEvidenceVersion,
      sourceRevisionVectorDigest: transaction.request.sourceRevisionVectorDigest,
      sourceCutPosture: transaction.request.sourceCutPosture,
    });
  }
  return authorities;
}

function compareVisualOrder(left: Element, right: Element): number {
  const leftRect = left.getBoundingClientRect();
  const rightRect = right.getBoundingClientRect();
  return leftRect.top - rightRect.top || leftRect.left - rightRect.left;
}
