"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isWorkbenchPermissionBlockedError } from "@/features/workbench/api-client";

import {
  getPortfolioReviewBatchStatus,
  getReportOrderingOptions,
  listPortfolioReviewOrders,
  submitPortfolioReviewBatch,
  submitPortfolioReviewOrder,
} from "./api";
import type {
  ReportBatchHandle,
  ReportBatchReference,
  ReportBatchStatus,
  ReportJobHandle,
  ReportJobListResponse,
  ReportOrderingResponse,
} from "./contracts";
import { admitReportJobReceipt } from "./report-job-receipt";
import {
  buildReportOrderingScreenState,
  type ReportOrderingCatalogueState,
  type ReportOrderingSubmissionState,
} from "./report-ordering-screen-state";
import { isActiveReportJobLifecycle } from "./report-job-lifecycle";
import {
  applyReportScopeReadiness,
  buildReportOrderingViewModel,
  clearContextBoundReportSections,
  configurationFingerprint,
  createReportOrderingConfiguration,
  reconcileReportSectionAvailability,
  selectedReportConfigurationValues,
  selectReportOrderingFamily,
  toReportRequestRows,
  type ReportOrderingConfiguration,
  type ReportOrderingScopeMode,
  type ReportSectionAvailabilityEvidence,
  type ReportOrderingSourceContext,
} from "./view-model";

type ReviewedIntent = {
  portfolioId: string;
  scopeFingerprint: string;
  configurationFingerprint: string;
  sourceFingerprint: string;
  idempotencyKey: string;
};

type SubmissionProgressState = {
  portfolioId: string;
  state: ReportOrderingSubmissionState;
  error: string | null;
};

type ActiveBatchIntent = {
  portfolioIds: string[];
  asOfDate: string;
  requestedOutputFormats: string[];
  reportingCurrency: string | null;
};

type BatchWorkspaceState = {
  portfolioId: string;
  handle: ReportBatchReference | null;
  intent: ActiveBatchIntent | null;
  status: ReportBatchStatus | null;
  error: string | null;
};

function resolveConfirmedBatchReportingCurrency(
  responseCurrency: string | null,
  sourceBaseCurrency: string,
) {
  return responseCurrency ?? sourceBaseCurrency;
}

type HistoryLoadState = "loading" | "ready" | "permission_blocked" | "error";

type ReportAvailabilityContext = Readonly<{
  asOfDate: string;
  reportingCurrency: string;
}>;

type SectionAvailabilityEvidence = {
  contextKey: string;
  state: Exclude<ReportSectionAvailabilityEvidence, "current"> | "current";
};

export function useReportOrderingWorkflow({
  portfolioId,
  asOfDate,
  sourceBaseCurrency,
  reportingCurrency,
  earliestReportDate,
  latestReportDate,
  reportingCurrencies,
  scopeMode = "single_portfolio",
  selectedPortfolioIds = [portfolioId],
  portfolioSelectionState = "ready",
  initialBatchId,
  onBatchAccepted,
}: {
  portfolioId: string;
  asOfDate: string;
  sourceBaseCurrency: string;
  reportingCurrency: string;
  earliestReportDate: string;
  latestReportDate: string;
  reportingCurrencies: string[];
  scopeMode?: ReportOrderingScopeMode;
  selectedPortfolioIds?: string[];
  portfolioSelectionState?: "loading" | "ready" | "error";
  initialBatchId?: string;
  onBatchAccepted?: (
    batchId: string,
    context: Readonly<{ asOfDate: string; reportingCurrency: string }>,
  ) => void;
}) {
  const reportingCurrenciesKey = reportingCurrencies.join("\u0000");
  const sourceContext = useMemo<ReportOrderingSourceContext>(
    () => ({
      asOfDate,
      reportingCurrency,
      earliestReportDate,
      latestReportDate,
      reportingCurrencies: reportingCurrenciesKey
        ? reportingCurrenciesKey.split("\u0000")
        : [],
    }),
    [
      asOfDate,
      earliestReportDate,
      latestReportDate,
      reportingCurrenciesKey,
      reportingCurrency,
    ],
  );
  const [catalogue, setCatalogue] = useState<ReportOrderingResponse | null>(
    null,
  );
  const [catalogueState, setCatalogueState] =
    useState<ReportOrderingCatalogueState>("loading");
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [sectionAvailabilityEvidence, setSectionAvailabilityEvidence] =
    useState<SectionAvailabilityEvidence | null>(null);
  const [configuration, setConfiguration] =
    useState<ReportOrderingConfiguration | null>(null);
  const [history, setHistory] = useState<ReportJobListResponse | null>(null);
  const [historyState, setHistoryState] = useState<HistoryLoadState>("loading");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [reviewedIntent, setReviewedIntent] = useState<ReviewedIntent | null>(
    null,
  );
  const [submissionProgress, setSubmissionProgress] =
    useState<SubmissionProgressState>({
      portfolioId,
      state: "idle",
      error: null,
    });
  const [submittedHandlesByPortfolio, setSubmittedHandlesByPortfolio] =
    useState<Record<string, ReportJobHandle>>({});
  const [batchWorkspaceState, setBatchWorkspaceState] =
    useState<BatchWorkspaceState>({
      portfolioId,
      handle: null,
      intent: null,
      status: null,
      error: null,
    });
  const sourceFingerprintRef = useRef<string>("");
  const activePortfolioIdRef = useRef(portfolioId);
  const activeBatchIdRef = useRef<string | null>(null);
  const workspaceGenerationRef = useRef(0);
  const batchStatusRequestSequenceRef = useRef(0);
  const historyRequestSequenceRef = useRef(0);
  const catalogueRequestSequenceRef = useRef(0);
  const activeBatchWorkspaceState: BatchWorkspaceState =
    batchWorkspaceState.portfolioId === portfolioId
      ? batchWorkspaceState
      : {
          portfolioId,
          handle: null,
          intent: null,
          status: null,
          error: null,
        };
  const submittedBatchHandle = activeBatchWorkspaceState.handle;
  const activeBatchIntent = activeBatchWorkspaceState.intent;
  const batchStatus = activeBatchWorkspaceState.status;
  const batchStatusError = activeBatchWorkspaceState.error;

  const isActiveWorkspaceGeneration = useCallback(
    (expectedPortfolioId: string, expectedGeneration: number) =>
      activePortfolioIdRef.current === expectedPortfolioId &&
      workspaceGenerationRef.current === expectedGeneration,
    [],
  );

  const updateBatchWorkspace = useCallback(
    (
      batchId: string,
      update: (current: BatchWorkspaceState) => BatchWorkspaceState,
    ) => {
      setBatchWorkspaceState((current) =>
        current.portfolioId === portfolioId &&
        current.handle?.batch_id === batchId
          ? update(current)
          : current,
      );
    },
    [portfolioId],
  );

  const loadBatchStatus = useCallback(
    async (batchId: string, expectedIntent: ActiveBatchIntent) => {
      const requestSequence = ++batchStatusRequestSequenceRef.current;
      updateBatchWorkspace(batchId, (current) => ({ ...current, error: null }));
      try {
        const response = await getPortfolioReviewBatchStatus(batchId);
        if (
          activeBatchIdRef.current !== batchId ||
          batchStatusRequestSequenceRef.current !== requestSequence
        ) {
          return false;
        }
        if (response.batch_id !== batchId) {
          updateBatchWorkspace(batchId, (current) => ({
            ...current,
            error:
              "The bundle was accepted, but the returned portfolio outcomes did not match this request.",
          }));
          return false;
        }
        const returnedPortfolioIds = [
          ...response.materialized_portfolio_ids,
        ].sort();
        if (
          expectedIntent.portfolioIds.length !== returnedPortfolioIds.length ||
          expectedIntent.portfolioIds.some(
            (portfolioId, index) => portfolioId !== returnedPortfolioIds[index],
          )
        ) {
          updateBatchWorkspace(batchId, (current) => ({
            ...current,
            error:
              "The bundle was accepted, but the returned portfolios did not match the reviewed selection.",
          }));
          return false;
        }
        const returnedOutputFormats = [
          ...response.requested_output_formats,
        ].sort();
        if (
          response.as_of_date !== expectedIntent.asOfDate ||
          expectedIntent.requestedOutputFormats.length !==
            returnedOutputFormats.length ||
          expectedIntent.requestedOutputFormats.some(
            (outputFormat, index) =>
              outputFormat !== returnedOutputFormats[index],
          ) ||
          response.reporting_currency !== expectedIntent.reportingCurrency
        ) {
          updateBatchWorkspace(batchId, (current) => ({
            ...current,
            error:
              "The bundle was accepted, but the returned report setup did not match the reviewed request.",
          }));
          return false;
        }
        updateBatchWorkspace(batchId, (current) => ({
          ...current,
          status: response,
          error: null,
        }));
        return true;
      } catch {
        if (
          activeBatchIdRef.current !== batchId ||
          batchStatusRequestSequenceRef.current !== requestSequence
        ) {
          return false;
        }
        updateBatchWorkspace(batchId, (current) => ({
          ...current,
          error:
            "The bundle was accepted, but current portfolio outcomes could not be loaded.",
        }));
        return false;
      }
    },
    [updateBatchWorkspace],
  );

  const rehydrateBatchStatus = useCallback(
    async (batchId: string) => {
      const workspaceGeneration = workspaceGenerationRef.current;
      const requestSequence = ++batchStatusRequestSequenceRef.current;
      activeBatchIdRef.current = batchId;
      setBatchWorkspaceState({
        portfolioId,
        handle: null,
        intent: null,
        status: null,
        error: null,
      });
      try {
        const response = await getPortfolioReviewBatchStatus(batchId);
        if (
          !isActiveWorkspaceGeneration(portfolioId, workspaceGeneration) ||
          activeBatchIdRef.current !== batchId ||
          batchStatusRequestSequenceRef.current !== requestSequence
        ) {
          return false;
        }
        if (
          response.batch_id !== batchId ||
          !response.materialized_portfolio_ids.includes(portfolioId)
        ) {
          setBatchWorkspaceState({
            portfolioId,
            handle: null,
            intent: null,
            status: null,
            error:
              "This report bundle does not confirm the selected portfolio. No portfolio outcomes are shown.",
          });
          return false;
        }
        const confirmedReportingCurrency =
          resolveConfirmedBatchReportingCurrency(
            response.reporting_currency,
            sourceBaseCurrency,
          );
        if (
          response.as_of_date !== asOfDate ||
          confirmedReportingCurrency !== reportingCurrency
        ) {
          setBatchWorkspaceState({
            portfolioId,
            handle: null,
            intent: null,
            status: null,
            error:
              "This report bundle does not match the selected review date or reporting currency. No portfolio outcomes are shown.",
          });
          return false;
        }
        const intent: ActiveBatchIntent = {
          portfolioIds: [...response.materialized_portfolio_ids].sort(),
          asOfDate: response.as_of_date,
          requestedOutputFormats: [...response.requested_output_formats].sort(),
          reportingCurrency: response.reporting_currency,
        };
        setBatchWorkspaceState({
          portfolioId,
          handle: {
            batch_id: response.batch_id,
            supportability: response.supportability,
            render_supportability: response.render_supportability,
          },
          intent,
          status: response,
          error: null,
        });
        return true;
      } catch {
        if (
          !isActiveWorkspaceGeneration(portfolioId, workspaceGeneration) ||
          activeBatchIdRef.current !== batchId ||
          batchStatusRequestSequenceRef.current !== requestSequence
        ) {
          return false;
        }
        setBatchWorkspaceState({
          portfolioId,
          handle: null,
          intent: null,
          status: null,
          error:
            "The addressed report bundle could not be confirmed by Reporting. No portfolio outcomes are shown.",
        });
        return false;
      }
    },
    [
      asOfDate,
      isActiveWorkspaceGeneration,
      portfolioId,
      reportingCurrency,
      sourceBaseCurrency,
    ],
  );

  useEffect(() => {
    if (
      !submittedBatchHandle ||
      !activeBatchIntent ||
      (batchStatus && isTerminalBatchStatus(batchStatus.status)) ||
      (!batchStatus && !batchStatusError)
    ) {
      return;
    }
    const timer = window.setTimeout(
      () => {
        void loadBatchStatus(submittedBatchHandle.batch_id, activeBatchIntent);
      },
      batchStatusError ? 10_000 : 5_000,
    );
    return () => window.clearTimeout(timer);
  }, [
    activeBatchIntent,
    batchStatus,
    batchStatusError,
    loadBatchStatus,
    submittedBatchHandle,
  ]);

  const loadHistory = useCallback(async () => {
    const workspaceGeneration = workspaceGenerationRef.current;
    const requestSequence = ++historyRequestSequenceRef.current;
    setHistoryState("loading");
    setHistoryError(null);
    try {
      const response = await listPortfolioReviewOrders(portfolioId);
      if (
        !isActiveWorkspaceGeneration(portfolioId, workspaceGeneration) ||
        historyRequestSequenceRef.current !== requestSequence
      ) {
        return;
      }
      setHistory(response);
      setHistoryState("ready");
    } catch (error) {
      if (
        !isActiveWorkspaceGeneration(portfolioId, workspaceGeneration) ||
        historyRequestSequenceRef.current !== requestSequence
      ) {
        return;
      }
      const permissionBlocked = isWorkbenchPermissionBlockedError(error);
      if (permissionBlocked) setHistory(null);
      setHistoryState(permissionBlocked ? "permission_blocked" : "error");
      setHistoryError(historyErrorCopy(error));
    }
  }, [isActiveWorkspaceGeneration, portfolioId]);

  useEffect(() => {
    if (
      scopeMode !== "single_portfolio" ||
      historyState === "loading" ||
      historyState === "permission_blocked"
    )
      return;
    const submittedHandle = submittedHandlesByPortfolio[portfolioId] ?? null;
    const hasActiveHistory =
      history?.items.some((item) =>
        isActiveReportJobLifecycle(item.status, item.currentStep),
      ) ?? false;
    const submittedLifecycleObserved = Boolean(
      submittedHandle &&
      history?.items.some(
        (item) => item.reportJobId === submittedHandle.report_job_id,
      ),
    );
    if (!hasActiveHistory && (!submittedHandle || submittedLifecycleObserved))
      return;

    const timer = window.setTimeout(
      () => {
        void loadHistory();
      },
      historyState === "error" ? 10_000 : 5_000,
    );
    return () => window.clearTimeout(timer);
  }, [
    history,
    historyState,
    loadHistory,
    portfolioId,
    scopeMode,
    submittedHandlesByPortfolio,
  ]);

  const loadCatalogue = useCallback(
    async (
      resetConfiguration: boolean,
      availabilityContext: ReportAvailabilityContext = {
        asOfDate: sourceContext.asOfDate,
        reportingCurrency: sourceContext.reportingCurrency,
      },
      retainedCatalogue: ReportOrderingResponse | null = null,
    ) => {
      const workspaceGeneration = workspaceGenerationRef.current;
      const requestSequence = ++catalogueRequestSequenceRef.current;
      const contextKey = reportAvailabilityContextKey(availabilityContext);
      if (retainedCatalogue) {
        setSectionAvailabilityEvidence({ contextKey, state: "checking" });
      } else {
        setCatalogueState("loading");
        setCatalogueError(null);
      }
      try {
        const response = await getReportOrderingOptions(
          portfolioId,
          availabilityContext,
        );
        if (
          !isActiveWorkspaceGeneration(portfolioId, workspaceGeneration) ||
          catalogueRequestSequenceRef.current !== requestSequence
        ) {
          return;
        }
        const nextSourceFingerprint = catalogueSourceFingerprint(
          response,
          sourceContext,
          contextKey,
        );
        if (
          sourceFingerprintRef.current &&
          sourceFingerprintRef.current !== nextSourceFingerprint
        ) {
          setReviewedIntent(null);
        }
        sourceFingerprintRef.current = nextSourceFingerprint;
        setCatalogue(response);
        setConfiguration((current) =>
          resetConfiguration || !current || !current.familyId
            ? createReportOrderingConfiguration(response, {
                ...sourceContext,
                ...availabilityContext,
              })
            : reconcileReportSectionAvailability(response, current),
        );
        setSectionAvailabilityEvidence({ contextKey, state: "current" });
        setCatalogueState("ready");
        setCatalogueError(
          response.scopeEligibility.state === "permission_blocked"
            ? response.scopeEligibility.message
            : response.catalogueAvailability.state === "unavailable"
              ? response.catalogueAvailability.message
              : response.scopeEligibility.state === "unavailable" ||
                  response.scopeEligibility.state === "unsupported"
                ? response.scopeEligibility.message
                : null,
        );
      } catch (error) {
        if (
          !isActiveWorkspaceGeneration(portfolioId, workspaceGeneration) ||
          catalogueRequestSequenceRef.current !== requestSequence
        ) {
          return;
        }
        if (retainedCatalogue) {
          sourceFingerprintRef.current = catalogueSourceFingerprint(
            retainedCatalogue,
            sourceContext,
            contextKey,
          );
          setSectionAvailabilityEvidence({ contextKey, state: "unavailable" });
          setReviewedIntent(null);
          return;
        }
        setCatalogue(null);
        setConfiguration(null);
        setReviewedIntent(null);
        setCatalogueState(
          isWorkbenchPermissionBlockedError(error)
            ? "permission_blocked"
            : "error",
        );
        setCatalogueError(catalogueErrorCopy(error));
      }
    },
    [isActiveWorkspaceGeneration, portfolioId, sourceContext],
  );

  useEffect(() => {
    activePortfolioIdRef.current = portfolioId;
    activeBatchIdRef.current = initialBatchId ?? null;
    batchStatusRequestSequenceRef.current += 1;
    sourceFingerprintRef.current = "";
    catalogueRequestSequenceRef.current += 1;
    const timer = window.setTimeout(() => {
      setSectionAvailabilityEvidence(null);
      void loadCatalogue(true);
      void loadHistory();
      if (initialBatchId) {
        void rehydrateBatchStatus(initialBatchId);
      }
    }, 0);
    return () => {
      workspaceGenerationRef.current += 1;
      window.clearTimeout(timer);
    };
  }, [
    initialBatchId,
    loadCatalogue,
    loadHistory,
    portfolioId,
    rehydrateBatchStatus,
  ]);

  const configurationAvailabilityContext = useMemo(
    () =>
      configuration
        ? {
            asOfDate: configuration.asOfDate,
            reportingCurrency: configuration.reportingCurrency,
          }
        : null,
    [configuration],
  );
  const configurationAvailabilityContextKey = configurationAvailabilityContext
    ? reportAvailabilityContextKey(configurationAvailabilityContext)
    : "";
  useEffect(() => {
    if (
      !configurationAvailabilityContext ||
      sectionAvailabilityEvidence?.contextKey ===
        configurationAvailabilityContextKey ||
      configurationAvailabilityContext.asOfDate <
        sourceContext.earliestReportDate ||
      configurationAvailabilityContext.asOfDate >
        sourceContext.latestReportDate ||
      !sourceContext.reportingCurrencies.includes(
        configurationAvailabilityContext.reportingCurrency,
      )
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadCatalogue(
        false,
        configurationAvailabilityContext,
        catalogue,
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    configurationAvailabilityContext,
    configurationAvailabilityContextKey,
    catalogue,
    loadCatalogue,
    sectionAvailabilityEvidence?.contextKey,
    sourceContext.earliestReportDate,
    sourceContext.latestReportDate,
    sourceContext.reportingCurrencies,
  ]);

  const currentSectionAvailabilityEvidence: ReportSectionAvailabilityEvidence =
    sectionAvailabilityEvidence?.contextKey ===
    configurationAvailabilityContextKey
      ? sectionAvailabilityEvidence.state
      : "checking";

  const baseModel = useMemo(
    () =>
      catalogue && configuration
        ? buildReportOrderingViewModel(
            catalogue,
            configuration,
            sourceContext,
            currentSectionAvailabilityEvidence,
          )
        : null,
    [
      catalogue,
      configuration,
      currentSectionAvailabilityEvidence,
      sourceContext,
    ],
  );
  const activeScopePortfolioIds =
    initialBatchId && activeBatchIntent
      ? activeBatchIntent.portfolioIds
      : selectedPortfolioIds;
  const activePortfolioSelectionState = initialBatchId
    ? activeBatchIntent
      ? "ready"
      : batchStatusError
        ? "error"
        : "loading"
    : portfolioSelectionState;
  const model = useMemo(
    () =>
      baseModel
        ? applyReportScopeReadiness(
            baseModel,
            scopeMode,
            activeScopePortfolioIds,
            activePortfolioSelectionState,
          )
        : null,
    [
      activePortfolioSelectionState,
      activeScopePortfolioIds,
      baseModel,
      scopeMode,
    ],
  );
  const publishedConfigurationFieldIds = useMemo(
    () =>
      new Set(
        model?.family?.configurationFields.map((field) => field.fieldId) ?? [],
      ),
    [model?.family?.configurationFields],
  );
  const currentConfigurationFingerprint = configuration
    ? configurationFingerprint(configuration)
    : "";
  const currentSourceFingerprint =
    catalogue && sectionAvailabilityEvidence
      ? catalogueSourceFingerprint(
          catalogue,
          sourceContext,
          sectionAvailabilityEvidence.contextKey,
        )
      : "";
  const currentScopeFingerprint = JSON.stringify({
    scopeMode,
    portfolioIds: [...activeScopePortfolioIds].sort(),
  });
  const activeReviewedIntent =
    reviewedIntent?.portfolioId === portfolioId ? reviewedIntent : null;
  const preflightReviewed = Boolean(
    activeReviewedIntent &&
    activeReviewedIntent.configurationFingerprint ===
      currentConfigurationFingerprint &&
    activeReviewedIntent.sourceFingerprint === currentSourceFingerprint &&
    activeReviewedIntent.scopeFingerprint === currentScopeFingerprint,
  );
  const submittedHandle = submittedHandlesByPortfolio[portfolioId] ?? null;
  const activeSubmissionProgress =
    submissionProgress.portfolioId === portfolioId
      ? submissionProgress
      : { portfolioId, state: "idle" as const, error: null };
  const acceptedHandle =
    scopeMode === "explicit_portfolio_batch"
      ? submittedBatchHandle
      : submittedHandle;
  const submissionState = acceptedHandle
    ? "accepted"
    : activeSubmissionProgress.state;
  const submissionError = acceptedHandle
    ? null
    : activeSubmissionProgress.error;
  const screenState = useMemo(
    () =>
      buildReportOrderingScreenState({
        catalogueState,
        catalogueError,
        model,
        preflightReviewed,
        submissionState,
        submissionError,
      }),
    [
      catalogueError,
      catalogueState,
      model,
      preflightReviewed,
      submissionError,
      submissionState,
    ],
  );

  const updateConfiguration = useCallback(
    (patch: Partial<ReportOrderingConfiguration>) => {
      if (activeSubmissionProgress.state === "submitting") {
        return;
      }
      setConfiguration((current) => {
        if (!current) {
          return current;
        }
        if (
          catalogue &&
          patch.familyId &&
          patch.familyId !== current.familyId
        ) {
          return selectReportOrderingFamily(
            catalogue,
            current,
            patch.familyId,
            scopeMode === "explicit_portfolio_batch"
              ? "unavailable"
              : currentSectionAvailabilityEvidence,
          );
        }
        const next = { ...current, ...patch };
        const contextChanged =
          (patch.asOfDate !== undefined &&
            patch.asOfDate !== current.asOfDate) ||
          (patch.reportingCurrency !== undefined &&
            patch.reportingCurrency !== current.reportingCurrency);
        if (!contextChanged) return next;

        const cleared = clearContextBoundReportSections(
          model?.family ?? null,
          next,
        );
        const nextContextKey = reportAvailabilityContextKey({
          asOfDate: next.asOfDate,
          reportingCurrency: next.reportingCurrency,
        });
        return catalogue &&
          sectionAvailabilityEvidence?.state === "current" &&
          sectionAvailabilityEvidence.contextKey === nextContextKey
          ? reconcileReportSectionAvailability(catalogue, cleared)
          : cleared;
      });
      setReviewedIntent(null);
      setSubmissionProgress((current) =>
        current.portfolioId === portfolioId && current.state === "submitting"
          ? current
          : { portfolioId, state: "idle", error: null },
      );
    },
    [
      activeSubmissionProgress.state,
      catalogue,
      currentSectionAvailabilityEvidence,
      model?.family,
      portfolioId,
      scopeMode,
      sectionAvailabilityEvidence,
    ],
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      const choice = model?.sectionChoices.find(
        (section) => section.id === sectionId,
      );
      if (
        !choice ||
        !choice.selectable ||
        (choice.required && choice.selected)
      ) {
        return;
      }
      const selectedSections = choice.selected
        ? (configuration?.selectedSections.filter((id) => id !== sectionId) ??
          [])
        : [...(configuration?.selectedSections ?? []), sectionId];
      updateConfiguration({ selectedSections });
    },
    [
      configuration?.selectedSections,
      model?.sectionChoices,
      updateConfiguration,
    ],
  );

  const reviewRequest = useCallback(() => {
    if (!model?.canSubmit || !configuration) {
      return false;
    }
    setReviewedIntent((current) => {
      const fingerprint = configurationFingerprint(configuration);
      if (
        current?.portfolioId === portfolioId &&
        current.scopeFingerprint === currentScopeFingerprint &&
        current?.configurationFingerprint === fingerprint &&
        current.sourceFingerprint === sourceFingerprintRef.current
      ) {
        return current;
      }
      return {
        portfolioId,
        scopeFingerprint: currentScopeFingerprint,
        configurationFingerprint: fingerprint,
        sourceFingerprint: sourceFingerprintRef.current,
        idempotencyKey: createReportOrderIntentKey(),
      };
    });
    setSubmissionProgress((current) =>
      current.portfolioId === portfolioId
        ? { ...current, error: null }
        : { portfolioId, state: "idle", error: null },
    );
    return true;
  }, [configuration, currentScopeFingerprint, model?.canSubmit, portfolioId]);

  const submitRequest = useCallback(async () => {
    if (
      !configuration ||
      !model?.canSubmit ||
      !activeReviewedIntent ||
      activeReviewedIntent.configurationFingerprint !==
        configurationFingerprint(configuration) ||
      activeReviewedIntent.sourceFingerprint !== sourceFingerprintRef.current ||
      activeReviewedIntent.scopeFingerprint !== currentScopeFingerprint
    ) {
      return false;
    }

    const submissionWorkspaceGeneration = workspaceGenerationRef.current;
    setSubmissionProgress({ portfolioId, state: "submitting", error: null });
    try {
      const sharedOrder = {
        asOfDate: configuration.asOfDate,
        outputFormat: configuration.outputFormat,
        ...(publishedConfigurationFieldIds.has("reporting_currency") &&
        configuration.reportingCurrency
          ? { reportingCurrency: configuration.reportingCurrency }
          : {}),
        ...(publishedConfigurationFieldIds.has("allocation_dimensions") &&
        configuration.allocationDimensions.length
          ? { allocationDimensions: configuration.allocationDimensions }
          : {}),
        configurationValues: selectedReportConfigurationValues(
          model.family,
          configuration,
        ),
        sections: configuration.selectedSections,
        idempotencyKey: activeReviewedIntent.idempotencyKey,
      };
      const handle =
        scopeMode === "explicit_portfolio_batch"
          ? await submitPortfolioReviewBatch({
              ...sharedOrder,
              portfolioIds: [...activeScopePortfolioIds].sort(),
            })
          : await submitPortfolioReviewOrder({ ...sharedOrder, portfolioId });
      if (
        !isActiveWorkspaceGeneration(portfolioId, submissionWorkspaceGeneration)
      ) {
        return false;
      }
      if (scopeMode === "explicit_portfolio_batch") {
        const batchHandle = handle as ReportBatchHandle;
        if (
          batchHandle.idempotency_key !== activeReviewedIntent.idempotencyKey ||
          batchHandle.item_count !== activeScopePortfolioIds.length
        ) {
          throw new Error(
            "The accepted bundle did not match the reviewed request intent.",
          );
        }
        const batchIntent: ActiveBatchIntent = {
          portfolioIds: [...activeScopePortfolioIds].sort(),
          asOfDate: configuration.asOfDate,
          requestedOutputFormats: [configuration.outputFormat],
          reportingCurrency:
            publishedConfigurationFieldIds.has("reporting_currency") &&
            configuration.reportingCurrency
              ? configuration.reportingCurrency
              : null,
        };
        activeBatchIdRef.current = batchHandle.batch_id;
        setBatchWorkspaceState({
          portfolioId,
          handle: batchHandle,
          intent: batchIntent,
          status: null,
          error: null,
        });
        onBatchAccepted?.(batchHandle.batch_id, {
          asOfDate: batchIntent.asOfDate,
          reportingCurrency:
            batchIntent.reportingCurrency ?? sourceBaseCurrency,
        });
        await loadBatchStatus(batchHandle.batch_id, batchIntent);
        if (
          !isActiveWorkspaceGeneration(
            portfolioId,
            submissionWorkspaceGeneration,
          ) ||
          activeBatchIdRef.current !== batchHandle.batch_id
        ) {
          return false;
        }
      } else {
        const reportHandle = admitReportJobReceipt(
          handle as ReportJobHandle,
          activeReviewedIntent.idempotencyKey,
        );
        setSubmittedHandlesByPortfolio((current) => ({
          ...current,
          [portfolioId]: reportHandle,
        }));
      }
      setSubmissionProgress({ portfolioId, state: "accepted", error: null });
      if (scopeMode === "single_portfolio") await loadHistory();
      return true;
    } catch (error) {
      if (
        !isActiveWorkspaceGeneration(portfolioId, submissionWorkspaceGeneration)
      ) {
        return false;
      }
      setSubmissionProgress({
        portfolioId,
        state: "error",
        error: submissionErrorCopy(error),
      });
      return false;
    }
  }, [
    configuration,
    isActiveWorkspaceGeneration,
    loadHistory,
    loadBatchStatus,
    model,
    portfolioId,
    publishedConfigurationFieldIds,
    activeReviewedIntent,
    currentScopeFingerprint,
    scopeMode,
    activeScopePortfolioIds,
    onBatchAccepted,
    sourceBaseCurrency,
  ]);

  const startAnotherReport = useCallback(() => {
    if (!acceptedHandle) {
      return false;
    }

    setSubmittedHandlesByPortfolio((current) => {
      const next = { ...current };
      delete next[portfolioId];
      return next;
    });
    setReviewedIntent(null);
    activeBatchIdRef.current = null;
    batchStatusRequestSequenceRef.current += 1;
    setBatchWorkspaceState({
      portfolioId,
      handle: null,
      intent: null,
      status: null,
      error: null,
    });
    setSubmissionProgress({ portfolioId, state: "idle", error: null });
    return true;
  }, [acceptedHandle, portfolioId]);

  return {
    catalogue,
    catalogueState,
    catalogueError,
    configuration,
    model,
    history,
    historyRows: toReportRequestRows(history?.items ?? []),
    historyState,
    historyError,
    submissionState,
    submissionError,
    submittedHandle,
    submittedBatchHandle,
    batchStatus,
    batchStatusError,
    batchRequestedOutputFormats:
      submittedBatchHandle && activeBatchIntent
        ? activeBatchIntent.requestedOutputFormats
        : [],
    batchPortfolioIds: activeBatchIntent?.portfolioIds ?? [],
    supportReference:
      submittedBatchHandle?.batch_id ?? submittedHandle?.report_job_id ?? null,
    screenState,
    preflightReviewed,
    canSubmitReviewedRequest:
      Boolean(model?.canSubmit && preflightReviewed) &&
      submissionState !== "submitting" &&
      submissionState !== "accepted",
    updateConfiguration,
    toggleSection,
    reviewRequest,
    submitRequest,
    startAnotherReport,
    refreshCatalogue: () =>
      loadCatalogue(
        false,
        configurationAvailabilityContext ?? sourceContext,
        catalogue,
      ),
    refreshHistory: loadHistory,
    refreshBatchStatus: () =>
      submittedBatchHandle && activeBatchIntent
        ? loadBatchStatus(submittedBatchHandle.batch_id, activeBatchIntent)
        : initialBatchId
          ? rehydrateBatchStatus(initialBatchId)
          : Promise.resolve(false),
  };
}

function reportAvailabilityContextKey(
  context: ReportAvailabilityContext,
): string {
  return `${context.asOfDate}\u0000${context.reportingCurrency}`;
}

function catalogueSourceFingerprint(
  response: ReportOrderingResponse,
  sourceContext: ReportOrderingSourceContext,
  availabilityContextKey: string,
): string {
  return JSON.stringify({ response, sourceContext, availabilityContextKey });
}

export function createReportOrderIntentKey(): string {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `workbench-report-order-${randomPart}`;
}

function catalogueErrorCopy(error: unknown): string {
  return isWorkbenchPermissionBlockedError(error)
    ? "This portfolio is not available for report ordering with the current business role."
    : "Approved report choices are temporarily unavailable. Try again or contact Reporting Operations.";
}

function historyErrorCopy(error: unknown): string {
  return isWorkbenchPermissionBlockedError(error)
    ? "Recent report requests are not available for this portfolio."
    : "Recent report requests could not be loaded. New ordering availability is shown separately.";
}

function submissionErrorCopy(error: unknown): string {
  return isWorkbenchPermissionBlockedError(error)
    ? "This report request is no longer permitted for the selected portfolio."
    : "The report request was not accepted. Your reviewed setup is preserved for a safe retry.";
}

function isTerminalBatchStatus(status: ReportBatchStatus["status"]): boolean {
  return (
    status === "completed" ||
    status === "completed_with_failures" ||
    status === "failed" ||
    status === "cancelled"
  );
}
