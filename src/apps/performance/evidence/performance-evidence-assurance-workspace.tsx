import {
  ScreenStatePanel,
  SemanticBadge,
  Text,
  WorkbenchDataGridFrame,
  WorkbenchSummaryMetricStrip,
} from "@/design-system";
import type { PerformanceEvidenceView } from "@/features/workbench/types";
import type { WorkspaceCapability } from "@/shell/workspace-capabilities";

import {
  buildPerformanceEvidenceAssuranceViewModel,
  PERFORMANCE_EVIDENCE_COPY,
} from "./performance-evidence-assurance-view-model";
import type { PerformanceEvidenceSelectionContext } from "./performance-evidence-assurance-view-model";
import styles from "./performance-evidence-assurance-workspace.module.css";

export default function PerformanceEvidenceAssuranceWorkspace({
  capability,
  evidenceView,
  selection,
}: {
  capability: WorkspaceCapability;
  evidenceView?: PerformanceEvidenceView | null;
  selection: PerformanceEvidenceSelectionContext;
}) {
  const title = PERFORMANCE_EVIDENCE_COPY.workspace.title;
  const subtitle = PERFORMANCE_EVIDENCE_COPY.workspace.subtitle;

  if (capability.state === "unavailable" || !evidenceView) {
    return (
      <WorkbenchDataGridFrame
        id="performance-evidence"
        title={title}
        subtitle={subtitle}
        className={`performance-detail-panel-wide performance-analysis-module performance-lotus-stage performance-lotus-stage-evidence ${styles.frame} ${styles.unavailableFrame}`}
      >
        <ScreenStatePanel
          kind={capability.state === "partial" ? "partial" : "unavailable"}
          title={
            capability.state === "partial"
              ? PERFORMANCE_EVIDENCE_COPY.workspace.incompleteTitle
              : PERFORMANCE_EVIDENCE_COPY.workspace.unavailableTitle
          }
          body={PERFORMANCE_EVIDENCE_COPY.workspace.unavailableBody}
          hint={capability.reason}
          className={styles.statePanel}
          surface="analysis"
        />
      </WorkbenchDataGridFrame>
    );
  }

  const view = buildPerformanceEvidenceAssuranceViewModel(capability, evidenceView, selection);

  return (
    <WorkbenchDataGridFrame
      id="performance-evidence"
      title={title}
      subtitle={subtitle}
      className={`performance-detail-panel-wide performance-analysis-module performance-lotus-stage performance-lotus-stage-evidence ${styles.frame}`}
    >
      <div
        className={styles.workspace}
        data-testid="performance-evidence-assurance"
        data-assurance-state={view.state}
      >
        <section className={`${styles.assuranceSummary} ${styles[view.state]}`} aria-labelledby="performance-assurance-heading">
          <div className={styles.assuranceCopy}>
            <Text variant="eyebrow" as="span">
              {PERFORMANCE_EVIDENCE_COPY.summary.eyebrow}
            </Text>
            <Text variant="sectionTitle" as="h4" id="performance-assurance-heading">
              {view.posture}
            </Text>
            <Text variant="bodySmall" className={styles.assuranceDescription}>
              {view.summary}
            </Text>
          </div>
          <dl
            className={styles.context}
            aria-label={PERFORMANCE_EVIDENCE_COPY.summary.contextLabel}
          >
            {view.context.map((item) => (
              <div key={item.label} className={styles.contextItem}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <WorkbenchSummaryMetricStrip
          ariaLabel="Calculation assurance measures"
          className={styles.metrics}
          itemClassName={styles.metric}
          items={view.metrics.map((metric) => ({
            key: metric.label,
            label: metric.label,
            value: metric.value,
            support: metric.support,
          }))}
        />

        <div className={styles.reviewGrid}>
          <section className={styles.reviewSection} aria-labelledby="performance-control-exceptions-heading">
            <div className={styles.sectionHeading}>
              <div>
                <Text variant="eyebrow" as="span">Review first</Text>
                <Text variant="panelTitle" as="h4" id="performance-control-exceptions-heading">
                  Control exceptions
                </Text>
              </div>
              <span className={styles.sectionCount}>{view.exceptions.length}</span>
            </div>
            {view.exceptions.length ? (
              <ol className={styles.exceptionList}>
                {view.exceptions.map((exception) => (
                  <li key={exception.key} className={styles.exceptionItem}>
                    <span className={`${styles.exceptionMarker} ${styles[exception.tone]}`} aria-hidden="true" />
                    <div className={styles.exceptionBody}>
                      <div className={styles.exceptionTitleRow}>
                        <Text variant="dataLabel" as="strong">{exception.title}</Text>
                        <SemanticBadge tone={exception.tone}>
                          {exception.tone === "danger" ? "Resolve" : "Review"}
                        </SemanticBadge>
                      </div>
                      <Text variant="bodySmall">{exception.detail}</Text>
                      <Text variant="helperText" className={styles.nextStep}>
                        <strong>Next step:</strong> {exception.action}
                      </Text>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.allClear}>
                <span className={styles.allClearMark} aria-hidden="true">✓</span>
                <div>
                  <Text variant="dataLabel" as="strong">No source-reported evidence exceptions</Text>
                  <Text variant="bodySmall">
                    Calculation and supporting evidence are confirmed for this internal review scope.
                  </Text>
                </div>
              </div>
            )}
          </section>

          <section className={styles.reviewSection} aria-labelledby="performance-calculation-coverage-heading">
            <div className={styles.sectionHeading}>
              <div>
                <Text variant="eyebrow" as="span">Evidence by result</Text>
                <Text variant="panelTitle" as="h4" id="performance-calculation-coverage-heading">
                  Calculation coverage
                </Text>
              </div>
              <span className={styles.sectionCount}>{view.calculations.length}</span>
            </div>
            {view.calculations.length ? (
              <div className={styles.calculationList} role="list">
                {view.calculations.map((calculation) => (
                  <article key={calculation.key} className={styles.calculation} role="listitem">
                    <div className={styles.calculationIdentity}>
                      <Text variant="dataLabel" as="h5">{calculation.title}</Text>
                      <Text variant="bodySmall">{calculation.purpose}</Text>
                    </div>
                    <dl className={styles.calculationStates}>
                      <div>
                        <dt>Calculation</dt>
                        <dd>
                          <SemanticBadge tone={calculation.calculationTone}>
                            {calculation.calculationStatus}
                          </SemanticBadge>
                        </dd>
                      </div>
                      <div>
                        <dt>Supporting evidence</dt>
                        <dd>
                          <SemanticBadge tone={calculation.evidenceTone}>
                            {calculation.evidenceStatus}
                          </SemanticBadge>
                        </dd>
                      </div>
                    </dl>
                    {calculation.records.length ? (
                      <ul className={styles.recordList} aria-label={`${calculation.title} supporting records`}>
                        {calculation.records.map((record) => (
                          <li key={record.key}>
                            {record.href ? (
                              <a href={record.href} className={styles.recordLink}>
                                <span>{record.label}</span>
                                <span aria-hidden="true">↗</span>
                              </a>
                            ) : (
                              <span className={styles.recordUnavailable}>{record.label}</span>
                            )}
                            <span className={styles.recordSupport}>{record.support}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Text variant="helperText" className={styles.noRecords}>
                        No supporting record is published for this calculation.
                      </Text>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.noCalculations}>
                <Text variant="dataLabel" as="strong">No calculation evidence reported</Text>
                <Text variant="bodySmall">
                  The result cannot be treated as assured until the source publishes calculation-level evidence.
                </Text>
              </div>
            )}
            {view.history.length > 0 && (
              <section className={styles.reviewSection} aria-labelledby="performance-history-heading">
                <Text variant="panelTitle" as="h5" id="performance-history-heading">
                  {PERFORMANCE_EVIDENCE_COPY.history.title}
                </Text>
                <Text variant="bodySmall">{PERFORMANCE_EVIDENCE_COPY.history.scope}</Text>
                <div className={styles.calculationList} role="list">
                  {view.history.map((history) => (
                    <article key={history.key} className={styles.calculation} role="listitem">
                      <Text variant="dataLabel" as="h6">{history.title}</Text>
                      <SemanticBadge tone={history.tone}>{history.status}</SemanticBadge>
                      <dl className={`${styles.calculationStates} ${styles.recordList}`}>
                        {history.rows.map((row) => (
                          <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>

        <section className={styles.evidenceAccess} aria-labelledby="performance-evidence-access-heading">
          <div>
            <Text variant="eyebrow" as="span">Supporting material</Text>
            <Text variant="panelTitle" as="h4" id="performance-evidence-access-heading">
              Evidence access
            </Text>
            <Text variant="bodySmall">
              Open source-published calculation records above. {view.methodologyCount > 0
                ? PERFORMANCE_EVIDENCE_COPY.methodology.recorded(view.methodologyCount)
                : PERFORMANCE_EVIDENCE_COPY.methodology.none}
            </Text>
          </div>
          <details className={styles.supportDisclosure}>
            <summary>Technical support details</summary>
            <div className={styles.supportBody}>
              <p>
                Use these source identifiers, versions, states, and routes only for investigation and support.
              </p>
              <div className={styles.supportGroups}>
                {view.supportGroups.map((group) => (
                  <section key={group.key} className={styles.supportGroup} aria-label={group.title}>
                    <h5>{group.title}</h5>
                    <dl>
                      {group.rows.map((row, index) => (
                        <div key={`${row.label}-${index}`}>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            </div>
          </details>
        </section>
      </div>
    </WorkbenchDataGridFrame>
  );
}
