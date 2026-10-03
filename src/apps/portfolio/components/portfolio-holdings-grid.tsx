"use client";

import { type Dispatch, type SetStateAction, useMemo, useRef, useState } from "react";

import type { ColDef, GridApi, GridReadyEvent, ICellRendererParams } from "ag-grid-community";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import type { PortfolioPositionView } from "../types";
import { formatCount, formatCurrency, formatDate, formatPct, formatQuantity } from "../formatters";
import { PORTFOLIO_CURRENCY_LABELS, PORTFOLIO_SCREEN_LABELS } from "../portfolio-terminology";
import {
  buildPortfolioScreenHref,
  type PortfolioReviewContext,
} from "../portfolio-screen-navigation";
import {
  buildDefaultHoldingsColumnVisibility,
  buildExpandedHoldingsColumnVisibility,
  buildHoldingsExportRows,
  buildHoldingsRows,
  countUnpricedHoldings,
  HOLDINGS_COLUMN_LABELS,
  type HoldingsColumnKey,
  type HoldingsRow,
  sumHoldingsMarketValue,
} from "./portfolio-holdings-grid-helpers";
import {
  buildPortfolioDataGridColumn,
  getPortfolioAmountToneClass,
  shouldPinPortfolioGridLeadColumns,
} from "./portfolio-grid-helpers";
import PortfolioDataGridFrame from "./portfolio-data-grid-frame";
import { downloadCsv } from "./portfolio-grid-export";
import PortfolioModuleState from "./portfolio-module-state";
import PortfolioRecordGridShell from "./portfolio-record-grid-shell";

type HoldingsGridProps = {
  reviewContext: PortfolioReviewContext;
  positions: PortfolioPositionView[];
  baseCurrency: string;
  columnMode: "essential" | "expanded";
  kicker?: string;
  title?: string;
  description?: string;
  filterLabel?: string | null;
  onClearFilter?: () => void;
  onRowSelect?: (row: HoldingsRow) => void;
};

export type { HoldingsRow };

export default function PortfolioHoldingsGrid({
  reviewContext,
  positions,
  baseCurrency,
  columnMode,
  kicker = "Positions",
  title = PORTFOLIO_SCREEN_LABELS.positions,
  description,
  filterLabel,
  onClearFilter,
  onRowSelect,
}: HoldingsGridProps) {
  const { portfolioId, asOfDate } = reviewContext;
  const resolvedDescription =
    description ?? `As of ${formatDate(asOfDate)} in ${baseCurrency}`;
  const gridApiRef = useRef<GridApi<HoldingsRow> | null>(null);
  const [chooserAnchor, setChooserAnchor] = useState<HTMLElement | null>(null);
  const [quickSearch, setQuickSearch] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<Record<HoldingsColumnKey, boolean>>(() =>
    buildDefaultHoldingsColumnVisibility(columnMode)
  );
  const hasHiddenColumns = Object.values(columnVisibility).some((isVisible) => !isVisible);
  const pinImportantColumns = shouldPinPortfolioGridLeadColumns(columnMode);
  const bookFirstTradeHref = buildPortfolioScreenHref(
    `/workbench/${encodeURIComponent(portfolioId)}`,
    reviewContext,
  );
  const reviewReadinessHref = buildPortfolioScreenHref(
    "/portfolio#portfolio-attention",
    reviewContext,
  );

  const rowData = useMemo<HoldingsRow[]>(
    () => buildHoldingsRows(positions, baseCurrency),
    [baseCurrency, positions]
  );
  const unpricedCount = useMemo(() => countUnpricedHoldings(positions), [positions]);
  const totalMarketValue = sumHoldingsMarketValue(rowData);

  const columnDefs = useMemo<ColDef<HoldingsRow>[]>(
    () => [
      buildHoldingsColumn({
        key: "instrument",
        headerName: "Instrument",
        field: "instrument",
        pinned: pinImportantColumns ? "left" : null,
        hide: !columnVisibility.instrument,
        minWidth: 230,
        flex: 2,
        cellRenderer: holdingsInstrumentCellRenderer,
        cellRendererParams: { onReview: onRowSelect },
      }),
      buildHoldingsColumn({
        key: "assetClass",
        headerName: "Asset class",
        field: "assetClass",
        pinned: pinImportantColumns ? "left" : null,
        hide: !columnVisibility.assetClass,
        minWidth: 126,
        flex: 1.1,
      }),
      buildHoldingsColumn({
        key: "status",
        headerName: "Status",
        field: "status",
        hide: !columnVisibility.status,
        minWidth: 132,
        cellRenderer: holdingsStatusCellRenderer,
      }),
      buildHoldingsColumn({
        key: "quantity",
        headerName: "Quantity",
        field: "quantity",
        type: "numericColumn",
        hide: !columnVisibility.quantity,
        minWidth: 104,
        valueFormatter: ({ value }) => formatQuantity(value),
      }),
      buildHoldingsColumn({
        key: "price",
        headerName: "Price",
        field: "price",
        type: "numericColumn",
        hide: !columnVisibility.price,
        minWidth: 108,
        valueFormatter: ({ value, data }) =>
          value === null || value === undefined ? "—" : formatCurrency(value, data?.currency ?? baseCurrency),
      }),
      buildHoldingsColumn({
        key: "marketValue",
        headerName: "Market value",
        field: "marketValue",
        type: "numericColumn",
        hide: !columnVisibility.marketValue,
        minWidth: 132,
        valueFormatter: ({ value }) => formatCurrency(value, baseCurrency),
      }),
      buildHoldingsColumn({
        key: "costBasis",
        headerName: "Cost basis",
        field: "costBasis",
        type: "numericColumn",
        hide: !columnVisibility.costBasis,
        minWidth: 132,
        valueFormatter: ({ value }) => formatCurrency(value, baseCurrency),
      }),
      buildHoldingsColumn({
        key: "weight",
        headerName: "Weight",
        field: "weight",
        type: "numericColumn",
        hide: !columnVisibility.weight,
        minWidth: 98,
        valueFormatter: ({ value }) => formatPct(value),
      }),
      buildHoldingsColumn({
        key: "upl",
        headerName: "Unrealised P&L",
        field: "upl",
        type: "numericColumn",
        hide: !columnVisibility.upl,
        minWidth: 138,
        valueFormatter: ({ value }) => formatCurrency(value, baseCurrency),
        cellClass: ({ value }) =>
          `portfolio-data-grid-cell portfolio-data-grid-cell-numeric ${getPortfolioAmountToneClass(value)}`,
      }),
      buildHoldingsColumn({
        key: "currency",
        headerName: PORTFOLIO_CURRENCY_LABELS.instrument,
        field: "currency",
        hide: !columnVisibility.currency,
        minWidth: 92,
      }),
      buildHoldingsColumn({
        key: "sector",
        headerName: "Sector",
        field: "sector",
        hide: !columnVisibility.sector,
        minWidth: 118,
      }),
      buildHoldingsColumn({
        key: "heldSince",
        headerName: "Held since",
        field: "heldSince",
        hide: !columnVisibility.heldSince,
        minWidth: 116,
        valueFormatter: ({ value }) => formatDate(value),
      }),
      buildHoldingsColumn({
        key: "isin",
        headerName: "ISIN",
        field: "isin",
        hide: !columnVisibility.isin,
        minWidth: 128,
      }),
    ],
    [baseCurrency, columnVisibility, onRowSelect, pinImportantColumns]
  );

  return (
    <PortfolioRecordGridShell
      kicker={kicker}
      title={title}
      description={resolvedDescription}
      summaryLabel={formatCount(rowData.length, "position")}
      summaryValue={totalMarketValue === null ? "Unavailable" : formatCurrency(totalMarketValue, baseCurrency)}
      searchControl={
        <TextField
          size="small"
          value={quickSearch}
          onChange={(event) => setQuickSearch(event.target.value)}
          placeholder="Search ticker or description"
          inputProps={{ "aria-label": "Search positions" }}
          className="portfolio-record-search"
        />
      }
      actions={
        <>
          <Button
            size="small"
            variant="outlined"
            aria-haspopup="menu"
            aria-expanded={Boolean(chooserAnchor)}
            aria-label="Choose position columns"
            onClick={(event) => setChooserAnchor(event.currentTarget)}
          >
            Columns
          </Button>
          {filterLabel && onClearFilter ? (
            <Button
              size="small"
              variant="contained"
              aria-label={`Filter active: ${filterLabel}`}
              onClick={onClearFilter}
            >
              Filter
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            aria-label="Export positions"
            onClick={() => exportHoldingsCsv(rowData, columnVisibility, baseCurrency)}
          >
            Export
          </Button>
          {hasHiddenColumns ? (
            <Button
              size="small"
              variant="outlined"
              aria-label="Show all position columns"
              onClick={() => setColumnVisibility(buildExpandedHoldingsColumnVisibility())}
            >
              Show all columns
            </Button>
          ) : null}
        </>
      }
    >

      {filterLabel ? (
        <div className="portfolio-grid-toolbar">
          <div className="portfolio-grid-toolbar-copy">
            <span>{filterLabel}</span>
          </div>
          <div className="portfolio-grid-toolbar-actions">
            <Button size="small" variant="text" onClick={onClearFilter}>
              Clear filter
            </Button>
            <span>{formatCount(rowData.length, "position")} in the selected portfolio</span>
          </div>
        </div>
      ) : null}

      {rowData.length ? (
        <>
          {unpricedCount ? (
            <PortfolioModuleState
              variant="status"
              state="partial"
              title="Positions partially valued"
              body={`${formatCount(unpricedCount, "position")} is missing current price or valuation data.`}
              hint="The selected portfolio remains usable, but market value and P&L are incomplete for some positions."
            />
          ) : null}
          <PortfolioDataGridFrame<HoldingsRow>
            ariaLabel="Portfolio positions grid"
            density={columnMode}
            rowData={rowData}
            columnDefs={columnDefs}
            quickFilterText={quickSearch}
            getRowId={({ data }) => data.securityId}
            onGridReady={(event: GridReadyEvent<HoldingsRow>) => {
              gridApiRef.current = event.api;
            }}
            onRowClicked={({ data }) => {
              if (data) {
                onRowSelect?.(data);
              }
            }}
          />
        </>
      ) : filterLabel ? (
        <PortfolioModuleState
          variant="status"
          state="empty"
          title="No contributing positions found"
          body={`No booked positions match ${filterLabel}.`}
          hint="The exposure may rely on classification detail that is not present on the booked positions."
          action={
            <button type="button" onClick={onClearFilter}>
              Clear exposure
            </button>
          }
        />
      ) : (
        <PortfolioModuleState
          variant="status"
          state="empty"
          title="No positions in this portfolio"
          body="The position inventory is empty."
          hint="Add securities, cash funding, or subscriptions to populate the portfolio."
          why={{
            body:
              "Positions require booked securities or funded balances. Until inventory is booked into the portfolio, the positions grid stays empty.",
            label: "Why positions are unavailable",
          }}
          action={
            <>
              <a href={bookFirstTradeHref}>Book first trade</a>
              <a href={reviewReadinessHref}>Review readiness</a>
            </>
          }
        />
      )}

      <Menu anchorEl={chooserAnchor} open={Boolean(chooserAnchor)} onClose={() => setChooserAnchor(null)}>
        {Object.entries(HOLDINGS_COLUMN_LABELS).map(([key, label]) => (
          <MenuItem key={key} onClick={() => toggleHoldingsColumn(key as HoldingsColumnKey, setColumnVisibility)}>
            <FormControlLabel
              control={<Checkbox checked={columnVisibility[key as HoldingsColumnKey]} />}
              label={label}
            />
          </MenuItem>
        ))}
      </Menu>
    </PortfolioRecordGridShell>
  );
}

function buildHoldingsColumn(
  config: ColDef<HoldingsRow> & { key: HoldingsColumnKey }
): ColDef<HoldingsRow> {
  const columnConfig = { ...config };
  delete (columnConfig as { key?: HoldingsColumnKey }).key;
  return buildPortfolioDataGridColumn(columnConfig);
}

function holdingsInstrumentCellRenderer(
  params: ICellRendererParams<HoldingsRow, string> & {
    onReview?: (row: HoldingsRow) => void;
  },
) {
  const row = params.data;
  if (!row) {
    return params.value ?? "";
  }

  const content = (
    <>
      <strong>{row.instrument}</strong>
      <span>{row.securityId}{row.isin ? ` / ${row.isin}` : ""}</span>
    </>
  );

  return params.onReview ? (
    <button
      type="button"
      className="portfolio-instrument-cell portfolio-instrument-review"
      aria-label={`Review ${row.instrument} position`}
      onClick={(event) => {
        event.stopPropagation();
        params.onReview?.(row);
      }}
    >
      {content}
    </button>
  ) : (
    <div className="portfolio-instrument-cell">{content}</div>
  );
}

function holdingsStatusCellRenderer(params: ICellRendererParams<HoldingsRow, string>) {
  const value = params.value ?? "Not reported";
  const tone = params.data?.statusTone ?? "warn";
  return (
    <span className={`portfolio-position-status portfolio-position-status-${tone}`}>
      {value}
    </span>
  );
}

function toggleHoldingsColumn(
  key: HoldingsColumnKey,
  setColumnVisibility: Dispatch<SetStateAction<Record<HoldingsColumnKey, boolean>>>
) {
  setColumnVisibility((current) => ({ ...current, [key]: !current[key] }));
}

function exportHoldingsCsv(
  rows: HoldingsRow[],
  visibility: Record<HoldingsColumnKey, boolean>,
  baseCurrency: string
) {
  downloadCsv("portfolio-positions.csv", buildHoldingsExportRows(rows, visibility, baseCurrency));
}
