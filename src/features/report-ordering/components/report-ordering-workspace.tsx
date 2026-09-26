"use client";

import { useCallback, useRef, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import PortfolioScreenRail from "@/apps/portfolio/components/portfolio-screen-rail";
import {
  ActionButton,
  AppPageShell,
  MainWithSideRailLayout,
  ScreenStatePanel,
  type ReviewContextStripModel,
  WorkbenchPageContainer,
  WorkbenchPageFrame,
  WorkbenchSectionStack,
} from "@/design-system";
import { isBusinessDateValue } from "@/design-system/utils/financial-formatters";
import {
  buildReviewContextHref,
  buildReviewContextNavigationHref,
} from "@/shell/review-context";

import { REPORT_CENTRE_TITLE } from "../report-ordering-terminology";
import { useReportOrderingWorkflow } from "../use-report-ordering-workflow";
import {
  findPortfolioReviewBatchMode,
  clearContextBoundReportSections,
  reconcileReportSectionAvailability,
  type ReportOrderingConfiguration,
  type ReportOrderingScopeMode,
} from "../view-model";
import styles from "../report-ordering-workspace.module.css";
import { ReportBatchStatusPanel } from "./report-batch-status";
import {
  ReportConfigurationPanel,
  type ReportConfigurationPanelHandle,
} from "./report-configuration-panel";
import { ReportReadinessRail } from "./report-readiness-rail";
import { ReportRequestHistory } from "./report-request-history";
import { ReportPortfolioScopePanel } from "./report-portfolio-scope-panel";

type ReportOrderingPortfolio = {
  portfolioId: string;
  asOfDate: string;
  sourceBaseCurrency: string;
  reportingCurrency: string;
  earliestReportDate: string;
  latestReportDate: string;
  reportingCurrencies: string[];
};

export function ReportOrderingWorkspace({
  portfolio,
  initialBatchId,
  reviewContext,
}: {
  portfolio: ReportOrderingPortfolio;
  initialBatchId?: string;
  reviewContext?: ReviewContextStripModel;
}) {
  return (
    <ReportOrderingWorkspaceSession
      key={`${portfolio.portfolioId}:${portfolio.asOfDate}:${portfolio.sourceBaseCurrency}:${portfolio.reportingCurrency}:${initialBatchId ?? "new"}`}
      portfolio={portfolio}
      initialBatchId={initialBatchId}
      reviewContext={
        reviewContext ?? {
          portfolioName: "Portfolio context unavailable",
          sourceState: "unavailable",
        }
      }
    />
  );
}

function ReportOrderingWorkspaceSession({
  portfolio,
  initialBatchId,
  reviewContext,
}: {
  portfolio: ReportOrderingPortfolio;
  initialBatchId?: string;
  reviewContext: ReviewContextStripModel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scopeMode, setScopeMode] = useState<ReportOrderingScopeMode>(
    initialBatchId ? "explicit_portfolio_batch" : "single_portfolio",
  );
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>(
    [],
  );
  const [portfolioSelectionState, setPortfolioSelectionState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const commitBatchAddress = useCallback(
    (
      batchId: string,
      context: Readonly<{ asOfDate: string; reportingCurrency: string }>,
    ) => {
      const href = buildReviewContextNavigationHref({
        pathname,
        searchParams,
        patch: {
          portfolioId: portfolio.portfolioId,
          asOfDate: context.asOfDate,
          reportingCurrency: context.reportingCurrency,
          batchId,
        },
      });
      if (href) {
        router.push(href, { scroll: false });
      }
    },
    [pathname, portfolio.portfolioId, router, searchParams],
  );
  const clearBatchAddress = useCallback(() => {
    const href = buildReviewContextNavigationHref({
      pathname,
      searchParams,
      patch: {
        portfolioId: portfolio.portfolioId,
        batchId: undefined,
      },
    });
    if (href) {
      router.push(href, { scroll: false });
    }
  }, [pathname, portfolio.portfolioId, router, searchParams]);
  const workflow = useReportOrderingWorkflow({
    portfolioId: portfolio.portfolioId,
    asOfDate: portfolio.asOfDate,
    sourceBaseCurrency: portfolio.sourceBaseCurrency,
    reportingCurrency: portfolio.reportingCurrency,
    scopeMode,
    selectedPortfolioIds,
    portfolioSelectionState,
    earliestReportDate: portfolio.earliestReportDate,
    latestReportDate: portfolio.latestReportDate,
    reportingCurrencies: portfolio.reportingCurrencies,
    initialBatchId,
    onBatchAccepted: commitBatchAddress,
  });
  const readinessRef = useRef<HTMLDivElement>(null);
  const configurationRef = useRef<HTMLDivElement>(null);
  const configurationPanelRef = useRef<ReportConfigurationPanelHandle>(null);
  const focusIntentRef = useRef(0);
  const workspaceState = workflow.screenState.workspace;
  const batchAvailable = Boolean(
    findPortfolioReviewBatchMode(workflow.model?.family ?? null),
  );
  const configurationLocked = workflow.submissionState === "submitting";
  const advisorBriefHref = buildReviewContextHref(
    "/performance?mode=advisor-brief",
    {
      portfolioId: portfolio.portfolioId,
      ...(workflow.configuration &&
      isBusinessDateValue(workflow.configuration.asOfDate)
        ? { asOfDate: workflow.configuration.asOfDate }
        : {}),
      ...(workflow.configuration &&
      portfolio.reportingCurrencies.includes(
        workflow.configuration.reportingCurrency,
      )
        ? { reportingCurrency: workflow.configuration.reportingCurrency }
        : {}),
    },
  );

  function updateConfiguration(patch: Partial<ReportOrderingConfiguration>) {
    if (
      patch.asOfDate !== undefined &&
      patch.asOfDate !== workflow.configuration?.asOfDate
    ) {
      setSelectedPortfolioIds([]);
      setPortfolioSelectionState("loading");
    }
    workflow.updateConfiguration(patch);
  }

  function focusReadiness() {
    requestAnimationFrame(() => readinessRef.current?.focus());
  }

  async function reviewRequest() {
    const valid = await configurationPanelRef.current?.validate();
    if (!valid || !workflow.reviewRequest()) return;
    focusReadiness();
  }

  async function submitRequest() {
    const focusIntent = ++focusIntentRef.current;
    await workflow.submitRequest();
    if (focusIntentRef.current === focusIntent) {
      focusReadiness();
    }
  }

  function startAnotherReport() {
    if (!workflow.startAnotherReport()) {
      return;
    }
    focusIntentRef.current += 1;
    clearBatchAddress();
    requestAnimationFrame(() => configurationRef.current?.focus());
  }

  const requestHistory = (
    <ReportRequestHistory
      rows={workflow.historyRows}
      currentReportJobId={workflow.submittedHandle?.report_job_id ?? null}
      state={workflow.historyState}
      error={workflow.historyError}
      onRefresh={() => void workflow.refreshHistory()}
    />
  );

  return (
    <AppPageShell
      pageKey="reports"
      className={styles.page}
      reviewContext={reviewContext}
    >
      <WorkbenchPageContainer className={styles.container}>
        <MainWithSideRailLayout
          className={styles.layout}
          mainClassName={styles.main}
          sideClassName={styles.side}
          sideDensity="comfortable"
          rail={
            <PortfolioScreenRail
              portfolioId={portfolio.portfolioId}
              activeScreen="reports"
              relationshipIdBase="report-ordering-workspace-rail"
            />
          }
          main={
            <WorkbenchPageFrame
              className={styles.frame}
              title={REPORT_CENTRE_TITLE}
              subtitle="Prepare approved portfolio reports, confirm readiness, and monitor each request."
            >
              <WorkbenchSectionStack className={styles.contentStack}>
                {initialBatchId ? (
                  <ReportBatchStatusPanel
                    status={workflow.batchStatus}
                    acceptedHandle={workflow.submittedBatchHandle}
                    requestedOutputFormats={
                      workflow.batchRequestedOutputFormats
                    }
                    error={workflow.batchStatusError}
                    onRefresh={() => void workflow.refreshBatchStatus()}
                    onReturnToSetup={clearBatchAddress}
                  />
                ) : workspaceState.kind !== "configuration" &&
                  workspaceState.kind !== "accepted" ? (
                  <ScreenStatePanel
                    className={styles.terminalState}
                    kind={workspaceState.kind}
                    surface="portfolio"
                    title={workspaceState.title}
                    body={workspaceState.body}
                    rows={workspaceState.kind === "loading" ? 5 : undefined}
                    action={
                      workspaceState.actionLabel ? (
                        <ActionButton
                          onClick={() => void workflow.refreshCatalogue()}
                        >
                          {workspaceState.actionLabel}
                        </ActionButton>
                      ) : undefined
                    }
                  />
                ) : workspaceState.kind === "accepted" ? (
                  scopeMode === "explicit_portfolio_batch" ? (
                    <ReportBatchStatusPanel
                      status={workflow.batchStatus}
                      acceptedHandle={workflow.submittedBatchHandle}
                      requestedOutputFormats={
                        workflow.batchRequestedOutputFormats
                      }
                      error={workflow.batchStatusError}
                      onRefresh={() => void workflow.refreshBatchStatus()}
                    />
                  ) : (
                    requestHistory
                  )
                ) : workflow.configuration ? (
                  <>
                    <div
                      ref={configurationRef}
                      tabIndex={-1}
                      role="region"
                      aria-label="Report configuration"
                      className={styles.focusTarget}
                    >
                      <ReportPortfolioScopePanel
                        currentPortfolioId={portfolio.portfolioId}
                        asOfDate={workflow.configuration.asOfDate}
                        scopeMode={scopeMode}
                        batchAvailable={batchAvailable}
                        disabled={configurationLocked}
                        selectedPortfolioIds={selectedPortfolioIds}
                        onScopeModeChange={(mode) => {
                          if (configurationLocked) return;
                          if (workflow.configuration) {
                            const next =
                              mode === "explicit_portfolio_batch"
                                ? clearContextBoundReportSections(
                                    workflow.model?.family ?? null,
                                    workflow.configuration,
                                  )
                                : workflow.catalogue
                                  ? reconcileReportSectionAvailability(
                                      workflow.catalogue,
                                      workflow.configuration,
                                    )
                                  : workflow.configuration;
                            workflow.updateConfiguration({
                              selectedSections: next.selectedSections,
                              configurationValues: next.configurationValues,
                            });
                          }
                          setScopeMode(mode);
                        }}
                        onSelectionChange={(portfolioIds) => {
                          if (!configurationLocked)
                            setSelectedPortfolioIds(portfolioIds);
                        }}
                        onBookStateChange={setPortfolioSelectionState}
                      />
                      <ReportConfigurationPanel
                        ref={configurationPanelRef}
                        model={workspaceState.model}
                        configuration={workflow.configuration}
                        disabled={configurationLocked}
                        updateConfiguration={updateConfiguration}
                        toggleSection={workflow.toggleSection}
                        advisorBriefHref={advisorBriefHref}
                        refreshAvailability={() =>
                          void workflow.refreshCatalogue()
                        }
                      />
                    </div>
                    {requestHistory}
                  </>
                ) : null}
              </WorkbenchSectionStack>
            </WorkbenchPageFrame>
          }
          side={
            <div className={styles.stickyRail}>
              <div
                ref={readinessRef}
                tabIndex={-1}
                role="region"
                aria-label="Report request readiness"
                className={styles.focusTarget}
              >
                <ReportReadinessRail
                  model={workflow.model}
                  screenState={workflow.screenState.readiness}
                  preflightReviewed={workflow.preflightReviewed}
                  canSubmitReviewedRequest={workflow.canSubmitReviewedRequest}
                  submissionState={workflow.submissionState}
                  supportReference={workflow.supportReference}
                  scopeLabel={
                    scopeMode === "explicit_portfolio_batch"
                      ? workflow.batchPortfolioIds.length > 0
                        ? `${workflow.batchPortfolioIds.length} selected portfolios`
                        : initialBatchId
                          ? "Addressed portfolio bundle"
                          : `${selectedPortfolioIds.length} selected portfolios`
                      : "Selected portfolio"
                  }
                  isPortfolioBundle={scopeMode === "explicit_portfolio_batch"}
                  onReview={() => void reviewRequest()}
                  onSubmit={() => void submitRequest()}
                  onStartAnother={startAnotherReport}
                />
              </div>
            </div>
          }
        />
      </WorkbenchPageContainer>
    </AppPageShell>
  );
}
