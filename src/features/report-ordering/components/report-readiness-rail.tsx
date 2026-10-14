"use client";

import { ActionButton, DefinitionList, Panel, SemanticBadge } from "@/design-system";

import type { ReportOrderingReadinessState } from "../report-ordering-screen-state";
import type { ReportOrderingViewModel } from "../view-model";
import styles from "../report-ordering-workspace.module.css";

export function ReportReadinessRail({
  model,
  screenState,
  preflightReviewed,
  canSubmitReviewedRequest,
  submissionState,
  supportReference,
  scopeLabel,
  isPortfolioBundle,
  onReview,
  onSubmit,
  onStartAnother,
  onRefreshCatalogue,
}: {
  model: ReportOrderingViewModel | null;
  screenState: ReportOrderingReadinessState;
  preflightReviewed: boolean;
  canSubmitReviewedRequest: boolean;
  submissionState: "idle" | "submitting" | "accepted" | "error";
  supportReference: string | null;
  scopeLabel: string;
  isPortfolioBundle: boolean;
  onReview: () => void;
  onSubmit: () => void;
  onStartAnother: () => void;
  onRefreshCatalogue: () => void;
}) {
  const requestModel = screenState.requestModel === undefined ? model : screenState.requestModel;
  const selectedSections = requestModel?.sectionChoices.filter((section) => section.selected) ?? [];
  const selectedOutput = requestModel?.outputChoices.find(
    (output) => output.id === requestModel.configuration.outputFormat,
  );
  const validationIssues = screenState.showValidationSummary
    ? model?.readiness.issues ?? []
    : [];
  const displayTitle = isPortfolioBundle
    ? bundleStatusTitle(screenState.kind, screenState.title)
    : screenState.title;

  return (
    <div className={styles.readinessStack}>
      <Panel
        className={styles.readinessPanel}
        density="compact"
        aria-busy={screenState.busy}
      >
        <div
          className={styles.readinessStatus}
          role={screenState.kind === "not_accepted" ? "alert" : "status"}
          aria-live={screenState.kind === "not_accepted" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <div className={styles.railHeading}>
            <div>
              <span className={styles.eyebrow}>Request readiness</span>
              <h2>{displayTitle}</h2>
            </div>
            <SemanticBadge tone={screenState.tone} emphasis="strong">
              {screenState.badgeLabel}
            </SemanticBadge>
          </div>
          <p>{screenState.detail}</p>
        </div>

        {validationIssues.length ? (
          <div className={styles.validationSummary} role="alert">
            <strong>Complete before review</strong>
            <ul>
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {requestModel && screenState.showRequestSummary ? (
          <DefinitionList
            ariaLabel="Report request summary"
            className={styles.readinessFacts}
            items={[
              { label: "Report", value: requestModel.family?.businessLabel ?? "Not selected" },
              { label: "Scope", value: scopeLabel },
              { label: "Report date", value: requestModel.configuration.asOfDate || "Not selected" },
              { label: "Output", value: selectedOutput?.label ?? "Not selected" },
              { label: "Sections", value: `${selectedSections.length} selected` },
              { label: "Audience", value: requestModel.audienceLabel },
            ]}
          />
        ) : null}

        {!requestModel && screenState.kind === "accepted" && isPortfolioBundle ? (
          <DefinitionList ariaLabel="Report request scope" items={[{ label: "Scope", value: scopeLabel }]} />
        ) : null}

        {screenState.catalogueNotice ? (
          <div className={styles.validationSummary} role="status">
            <strong>{screenState.catalogueNotice.title}</strong>
            <p>{screenState.catalogueNotice.body}</p>
            {screenState.catalogueNotice.actionLabel ? (
              <ActionButton priority="secondary" onClick={onRefreshCatalogue} disabled={screenState.busy}>
                {screenState.catalogueNotice.actionLabel}
              </ActionButton>
            ) : null}
          </div>
        ) : null}

        {screenState.showActions ? (
          <div className={styles.actionStack}>
            <ActionButton
              priority="secondary"
              onClick={onReview}
              disabled={!model?.canReview || submissionState === "submitting"}
            >
              {preflightReviewed
                ? "Reviewed"
                : isPortfolioBundle
                  ? "Review Portfolio Bundle"
                  : "Review Request"}
            </ActionButton>
            <ActionButton
              priority="primary"
              onClick={onSubmit}
              disabled={!canSubmitReviewedRequest}
            >
              {submissionState === "submitting"
                ? "Submitting…"
                : submissionState === "error"
                  ? isPortfolioBundle ? "Retry Portfolio Bundle" : "Retry Report Request"
                  : isPortfolioBundle ? "Submit Portfolio Bundle" : "Submit Report Request"}
            </ActionButton>
            {!preflightReviewed && model?.canSubmit ? (
              <small>Review the current setup before submitting.</small>
            ) : null}
          </div>
        ) : null}

        {screenState.kind === "accepted" ? (
          <div className={styles.actionStack}>
            <ActionButton priority="primary" onClick={onStartAnother} disabled={!screenState.canStartAnother}>
              Create another report
            </ActionButton>
            <small>The next request starts from the current portfolio setup.</small>
          </div>
        ) : null}

        {screenState.kind === "accepted" && supportReference ? (
          <details className={styles.supportDisclosure}>
            <summary>Support reference</summary>
            <code>{supportReference}</code>
          </details>
        ) : null}

        <section className={styles.boundarySection} aria-labelledby="report-client-release-title">
          <span className={styles.eyebrow}>Client-use boundary</span>
          <h3 id="report-client-release-title">{screenState.clientReleaseTitle}</h3>
          <p>{screenState.clientReleaseDetail}</p>
          <div className={styles.boundarySteps} aria-label="Separate report lifecycle controls">
            <span>Request</span>
            <span>Report data</span>
            <span>Archive</span>
            <span>Client delivery</span>
          </div>
        </section>
      </Panel>
    </div>
  );
}

function bundleStatusTitle(kind: ReportOrderingReadinessState["kind"], fallback: string): string {
  if (kind === "accepted") return "Portfolio bundle accepted";
  if (kind === "submitting") return "Submitting portfolio bundle";
  if (kind === "not_accepted") return "Portfolio bundle not accepted";
  return fallback;
}
