"use client";

import {
  ActionButton,
  AnalyticsTable,
  OperationalRecordList,
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  WorkbenchInlineRefreshNote,
} from "@/design-system";

import type { ReportRequestRow } from "../view-model";
import styles from "../report-ordering-workspace.module.css";

export function ReportRequestHistory({
  rows,
  currentReportJobId,
  state,
  error,
  onRefresh,
}: {
  rows: ReportRequestRow[];
  currentReportJobId: string | null;
  state: "loading" | "ready" | "permission_blocked" | "error";
  error: string | null;
  onRefresh: () => void;
}) {
  const hasRows = rows.length > 0;
  const isInitialLoading = state === "loading" && !hasRows;
  const isRefreshing = state === "loading" && hasRows;
  const refreshFailed = state === "error" && hasRows;
  const compactRows = prioritizeCurrentRequest(rows, currentReportJobId);
  const visibleCompactRows = compactRows.slice(0, 3);
  const retainedCompactRows = compactRows.slice(3);

  return (
    <SectionBlock
      title="Recent report requests"
      subtitle="Current lifecycle state for this portfolio. Active requests refresh automatically; archive and delivery remain separate controls."
      className={styles.section}
      actions={
        <ActionButton priority="quiet" onClick={onRefresh} disabled={state === "loading"}>
          Refresh
        </ActionButton>
      }
    >
      {state === "permission_blocked" || (state === "error" && !hasRows) ? (
        <ScreenStatePanel
          kind={state === "permission_blocked" ? "permission_blocked" : "error"}
          surface="portfolio"
          title={state === "permission_blocked" ? "Recent requests are restricted" : "Recent requests unavailable"}
          body={error ?? "Recent report request history could not be loaded."}
          action={<ActionButton onClick={onRefresh}>Try Again</ActionButton>}
        />
      ) : (
        <>
          {isRefreshing ? (
            <WorkbenchInlineRefreshNote message="Refreshing recent requests. Previously confirmed lifecycle evidence remains visible." />
          ) : null}
          {refreshFailed ? (
            <WorkbenchInlineRefreshNote message="The latest lifecycle check did not complete. Previously confirmed requests remain visible; use Refresh to check again." />
          ) : null}
          <div className={styles.historyResponsive} data-testid="report-request-history-layout">
            <div className={styles.historyDesktop}>
              <AnalyticsTable
                ariaLabel="Recent portfolio report requests"
                density="compact"
                variant="portfolio"
                loadingState={
                  isInitialLoading
                    ? { title: "Loading recent requests", body: "Checking the current reporting lifecycle." }
                    : undefined
                }
                emptyState={{
                  title: "No report requests yet",
                  body: "Submit the first approved report request for this portfolio.",
                }}
                columns={[
                  { key: "report", label: "Report", width: "15%" },
                  { key: "date", label: "Report date", width: "14%" },
                  { key: "requested", label: "Requested", width: "19%" },
                  { key: "status", label: "Lifecycle", width: "34%" },
                  { key: "support", label: "Support", width: "18%" },
                ]}
                tableMinWidth="48rem"
                rows={rows.map((row) => ({
                  key: row.key,
                  cells: [
                    <ReportRequestIdentity
                      key={`${row.key}-identity`}
                      reportLabel={row.reportLabel}
                      current={row.key === currentReportJobId}
                    />,
                    row.reportDate,
                    row.requestedAt,
                    <div key={`${row.key}-status`} className={styles.historyStatus}>
                      <SemanticBadge tone={row.tone}>{row.statusLabel}</SemanticBadge>
                      <small>{row.statusDetail}</small>
                    </div>,
                    <ReportSupportReference key={`${row.key}-support`} reference={row.supportReference} />,
                  ],
                }))}
              />
            </div>
            <div className={styles.historyCompact}>
              {isInitialLoading ? (
                <ScreenStatePanel
                  kind="loading"
                  surface="portfolio"
                  title="Loading recent requests"
                  body="Checking the current reporting lifecycle."
                  rows={2}
                />
              ) : !hasRows ? (
                <ScreenStatePanel
                  kind="empty"
                  surface="portfolio"
                  title="No report requests yet"
                  body="Submit the first approved report request for this portfolio."
                />
              ) : (
                <>
                  <OperationalRecordList
                    ariaLabel="Recent portfolio report request details"
                    items={toOperationalRecords(visibleCompactRows, currentReportJobId)}
                  />
                  {retainedCompactRows.length > 0 ? (
                    <details className={styles.retainedHistoryDisclosure}>
                      <summary>
                        Show {retainedCompactRows.length} more retained request
                        {retainedCompactRows.length === 1 ? "" : "s"}
                      </summary>
                      <OperationalRecordList
                        ariaLabel="Additional retained portfolio report request details"
                        items={toOperationalRecords(retainedCompactRows, currentReportJobId)}
                      />
                    </details>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </SectionBlock>
  );
}

function prioritizeCurrentRequest(
  rows: ReportRequestRow[],
  currentReportJobId: string | null,
): ReportRequestRow[] {
  if (!currentReportJobId) return rows;
  const currentRow = rows.find((row) => row.key === currentReportJobId);
  return currentRow
    ? [currentRow, ...rows.filter((row) => row.key !== currentReportJobId)]
    : rows;
}

function toOperationalRecords(
  rows: ReportRequestRow[],
  currentReportJobId: string | null,
) {
  return rows.map((row) => ({
    key: row.key,
    title:
      row.key === currentReportJobId
        ? `Current request — ${row.reportLabel}`
        : row.reportLabel,
    description: row.statusDetail,
    status: <SemanticBadge tone={row.tone}>{row.statusLabel}</SemanticBadge>,
    facts: [
      { label: "Report date", value: row.reportDate },
      { label: "Requested", value: row.requestedAt },
    ],
    detail: <ReportSupportReference reference={row.supportReference} />,
  }));
}

function ReportRequestIdentity({
  reportLabel,
  current,
}: {
  reportLabel: string;
  current: boolean;
}) {
  return (
    <div className={styles.historyIdentity}>
      <span>{reportLabel}</span>
      {current ? <small>Current request</small> : null}
    </div>
  );
}

function ReportSupportReference({ reference }: { reference: string }) {
  return (
    <details className={styles.supportDisclosure}>
      <summary>Support reference</summary>
      <code>{reference}</code>
    </details>
  );
}
