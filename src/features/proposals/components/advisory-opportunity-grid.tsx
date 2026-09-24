"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColDef, GridApi, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Alert } from "@mui/material";

import { ActionButton, Text, WorkbenchDataGridFrame } from "@/design-system";
import { ensureAgGridModulesRegistered } from "@/design-system/utils/ag-grid-modules";

import type { AdvisoryOpportunityRow } from "../advisory-opportunities-view-model";
import type { IdeaPresentationReceiptState } from "../use-idea-presentation-receipts";
import styles from "./advisory-opportunities-workspace.module.css";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ensureAgGridModulesRegistered();

export default function AdvisoryOpportunityGrid({
  filterText,
  onFilterTextChange,
  onGridApiReady,
  receiptState,
  rows,
}: {
  filterText: string;
  onFilterTextChange: (value: string) => void;
  onGridApiReady: (api: GridApi<AdvisoryOpportunityRow> | null) => void;
  receiptState: IdeaPresentationReceiptState;
  rows: AdvisoryOpportunityRow[];
}) {
  const columnDefs = useMemo<ColDef<AdvisoryOpportunityRow>[]>(
    () => [
      {
        cellRenderer: OpportunityCell,
        field: "title",
        flex: 2,
        headerName: "Opportunity",
        minWidth: 280,
        pinned: "left",
      },
      {
        cellDataType: "number",
        cellRenderer: QueuePositionCell,
        field: "rank",
        getQuickFilterText: ({ data }) =>
          data ? `${data.rank ?? "Unranked"} ${data.score}` : "",
        headerName: "Queue position",
        maxWidth: 136,
        minWidth: 116,
      },
      {
        cellRenderer: ReviewPostureCell,
        field: "priority",
        getQuickFilterText: ({ data }) =>
          data ? `${data.priority} ${data.reviewPosture}` : "",
        headerName: "Review priority",
        minWidth: 176,
      },
      {
        cellRenderer: SourceEvidenceCell,
        field: "sourceSignals",
        flex: 2,
        getQuickFilterText: ({ data }) =>
          data ? `${data.sourceSignals} ${data.reasonCodes}` : "",
        headerName: "Decision evidence",
        minWidth: 240,
      },
      {
        field: "nextAction",
        flex: 1,
        headerName: "Next decision",
        minWidth: 220,
        wrapText: true,
      },
    ],
    [],
  );
  const height = Math.min(430, Math.max(190, 34 + rows.length * 58));

  return (
    <WorkbenchDataGridFrame
      title="Advisor opportunity queue"
      subtitle="Prioritised candidates with the evidence needed to decide what to review next."
      controls={
        <label className={styles.queueFilter}>
          <Text variant="microLabel">Find an opportunity</Text>
          <input
            type="search"
            value={filterText}
            onChange={(event) => onFilterTextChange(event.target.value)}
            placeholder="Candidate, priority or evidence"
          />
        </label>
      }
    >
      {receiptState.status === "attention" ? (
        <Alert
          severity="warning"
          className={styles.receiptAlert}
          action={
            <ActionButton
              priority="quiet"
              onClick={() => void receiptState.retryFailed()}
            >
              Retry recording
            </ActionButton>
          }
        >
          Opportunity visibility could not be recorded. Review is withheld
          until visibility evidence is recorded.
        </Alert>
      ) : receiptState.status === "unavailable" ? (
        <Alert severity="warning" className={styles.receiptAlert}>
          Opportunity visibility evidence is unavailable. Review is withheld;
          no viewing confirmation has been claimed.
        </Alert>
      ) : null}
      <div
        className={`ag-theme-quartz ${styles.opportunityGrid}`}
        style={{ height }}
        aria-label="Idea candidate review queue"
        data-receipt-state={receiptState.status}
      >
        <AgGridReact<AdvisoryOpportunityRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            suppressHeaderMenuButton: true,
          }}
          quickFilterText={filterText}
          getRowId={({ data }) => data.candidateId}
          rowBuffer={2}
          suppressColumnVirtualisation
          suppressRowVirtualisation={false}
          onGridReady={({ api }) => {
            api.setGridAriaProperty("label", "Idea candidate review queue");
            onGridApiReady(api);
          }}
          onGridPreDestroyed={() => onGridApiReady(null)}
          onFirstDataRendered={({ api }) =>
            api.setGridAriaProperty("label", "Idea candidate review queue")
          }
          animateRows={false}
          ensureDomOrder
          headerHeight={34}
          rowHeight={58}
          theme="legacy"
        />
      </div>
    </WorkbenchDataGridFrame>
  );
}

function OpportunityCell({
  data,
}: ICellRendererParams<AdvisoryOpportunityRow>) {
  if (!data) {
    return null;
  }
  return (
    <div
      className={styles.presentationMarker}
      data-idea-presentation-candidate={data.candidateId}
    >
      <Link href={data.href}>{data.title}</Link>
      <span>{data.candidateId}</span>
    </div>
  );
}

function QueuePositionCell({
  data,
}: ICellRendererParams<AdvisoryOpportunityRow>) {
  return data ? (
    <div className={styles.compactCell}>
      <strong>{data.rank ?? "Unranked"}</strong>
      <span>{data.score}</span>
    </div>
  ) : null;
}

function ReviewPostureCell({
  data,
}: ICellRendererParams<AdvisoryOpportunityRow>) {
  return data ? (
    <div className={styles.compactCell}>
      <strong>{data.priority}</strong>
      <span>{data.reviewPosture}</span>
    </div>
  ) : null;
}

function SourceEvidenceCell({
  data,
}: ICellRendererParams<AdvisoryOpportunityRow>) {
  return data ? (
    <div className={styles.compactCell}>
      <strong>{data.sourceSignals}</strong>
      <span>{data.reasonCodes}</span>
    </div>
  ) : null;
}
