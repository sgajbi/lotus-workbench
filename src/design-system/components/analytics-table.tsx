import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableFooter from "@mui/material/TableFooter";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { lotusThemeTokens } from "../theme/tokens";
import { cx } from "../utils/cx";

export type AnalyticsTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  stickyOffset?: number | string;
  headerWrap?: boolean;
};

export type AnalyticsTableRow = {
  key: string;
  cells: React.ReactNode[];
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export type AnalyticsTableDensity = "compact" | "comfortable";
export type AnalyticsTableVariant =
  "default" | "analysis" | "observation" | "portfolio";

type AnalyticsTableState = {
  title: string;
  body: string;
};

const densityPaddingY = {
  compact: lotusThemeTokens.table.cellPadding.y,
  comfortable: "14px",
} as const;

const densityFontSize = {
  compact: lotusThemeTokens.typography.variant.tableCell.size,
  comfortable: lotusThemeTokens.typography.variant.tableCell.size,
} as const;

const headerFontSize = {
  compact: lotusThemeTokens.typography.variant.tableHeader.size,
  comfortable: lotusThemeTokens.typography.variant.tableHeader.size,
} as const;

const footerFontSize = {
  compact: lotusThemeTokens.typography.variant.tableCell.size,
  comfortable: lotusThemeTokens.typography.variant.tableCell.size,
} as const;

export default function AnalyticsTable({
  ariaLabel,
  columns,
  rows,
  footer,
  className,
  dense,
  density = dense ? "compact" : "comfortable",
  variant = "default",
  emptyState,
  loadingState,
  scrollRegionLabel,
  tableMinWidth,
}: {
  ariaLabel: string;
  columns: AnalyticsTableColumn[];
  rows: AnalyticsTableRow[];
  footer?: React.ReactNode[];
  className?: string;
  dense?: boolean;
  density?: AnalyticsTableDensity;
  variant?: AnalyticsTableVariant;
  emptyState?: AnalyticsTableState;
  loadingState?: AnalyticsTableState;
  scrollRegionLabel?: string;
  tableMinWidth?: number | string;
}) {
  const hasRows = rows.length > 0;
  const state = !hasRows ? (loadingState ?? emptyState ?? null) : null;
  const headerCellSx = getHeaderCellSx(density);
  const bodyCellSx = getBodyCellSx(density);
  const footerCellSx = getFooterCellSx(density);

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      role={scrollRegionLabel ? "region" : undefined}
      aria-label={scrollRegionLabel}
      tabIndex={scrollRegionLabel ? 0 : undefined}
      className={cx(
        "analytics-table-frame",
        `analytics-table-density-${density}`,
        `analytics-table-variant-${variant}`,
        density === "compact" && "analytics-table-frame-dense",
        className,
      )}
      sx={{
        borderRadius: `${lotusThemeTokens.radius.md}px`,
        borderColor: lotusThemeTokens.color.border.default,
        boxShadow: "none",
        bgcolor: lotusThemeTokens.color.surface.panel,
        overflow: "auto",
        ...(scrollRegionLabel
          ? {
              "&:focus-visible": {
                outline: "2px solid transparent",
                outlineOffset: "2px",
                boxShadow: lotusThemeTokens.focus.ring,
              },
            }
          : {}),
      }}
    >
      <Table
        size="small"
        aria-label={ariaLabel}
        sx={{
          minWidth: tableMinWidth,
          tableLayout: tableMinWidth ? "fixed" : undefined,
          "& td, & th": {
            fontVariantNumeric: "tabular-nums slashed-zero",
            fontFeatureSettings: '"tnum" 1, "zero" 1',
          },
          "& tbody tr:last-of-type td": {
            borderBottom: "none",
          },
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                align={column.align ?? "left"}
                className={cx(
                  "analytics-table-cell",
                  "analytics-table-head-cell",
                  column.align === "right" && "analytics-table-cell-numeric",
                )}
                sx={headerCellSx}
                style={getColumnCellStyle(column, "header")}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {state ? (
            <TableRow className="analytics-table-state-row">
              <TableCell
                colSpan={Math.max(columns.length, 1)}
                className="analytics-table-state-cell"
              >
                <div className="analytics-table-state">
                  <strong className="analytics-table-state-title">
                    {state.title}
                  </strong>
                  <span className="analytics-table-state-body">
                    {state.body}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow
                key={row.key}
                hover
                className={cx("analytics-table-row", row.className)}
                onClick={row.onClick}
                onMouseEnter={row.onMouseEnter}
                onMouseLeave={row.onMouseLeave}
                tabIndex={row.onClick ? 0 : undefined}
                aria-label={row.ariaLabel}
                style={
                  {
                    "--analytics-table-pinned-background": getPinnedRowBackground(
                      variant,
                      rowIndex,
                    ),
                  } as React.CSSProperties
                }
                onKeyDown={
                  row.onClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          row.onClick?.();
                        }
                      }
                    : undefined
                }
                sx={{
                  "&:hover": {
                    "--analytics-table-pinned-background":
                      lotusThemeTokens.color.surface.tertiary,
                  },
                  ...(row.onClick
                    ? {
                        cursor: "pointer",
                        "&:focus-visible": {
                          outline: "2px solid transparent",
                          outlineOffset: "2px",
                          boxShadow: `inset ${lotusThemeTokens.focus.ring}`,
                        },
                      }
                    : {}),
                }}
              >
                {row.cells.map((cell, index) => {
                  const column = columns[index];
                  return (
                    <TableCell
                      key={`${row.key}-${column?.key ?? index}`}
                      align={column?.align ?? "left"}
                      className={cx(
                        "analytics-table-cell",
                        "analytics-table-body-cell",
                        column?.align === "right" &&
                          "analytics-table-cell-numeric",
                      )}
                      sx={bodyCellSx}
                      style={getColumnCellStyle(column, "body")}
                    >
                      {cell}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
        {footer && hasRows ? (
          <TableFooter>
            <TableRow>
              {footer.map((cell, index) => {
                const column = columns[index];
                return (
                  <TableCell
                    key={`footer-${column?.key ?? index}`}
                    align={column?.align ?? "left"}
                    className={cx(
                      "analytics-table-cell",
                      "analytics-table-footer-cell",
                      column?.align === "right" &&
                        "analytics-table-cell-numeric",
                    )}
                    sx={footerCellSx}
                    style={getColumnCellStyle(column, "footer")}
                  >
                    {cell}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </TableContainer>
  );
}

function getColumnCellStyle(
  column: AnalyticsTableColumn | undefined,
  section: "header" | "body" | "footer",
): React.CSSProperties | undefined {
  if (
    !column ||
    (column.width === undefined &&
      column.stickyOffset === undefined &&
      !column.headerWrap)
  ) {
    return undefined;
  }

  return {
    ...(column.width !== undefined ? { width: column.width } : {}),
    ...(section === "header" && column.headerWrap
      ? { whiteSpace: "normal", lineHeight: 1.2 }
      : {}),
    ...(column.stickyOffset !== undefined
      ? {
          position: "sticky",
          left: column.stickyOffset,
          zIndex:
            section === "header"
              ? lotusThemeTokens.zIndex.pinnedHeader
              : lotusThemeTokens.zIndex.pinnedCell,
          backgroundColor:
            section === "body"
              ? `var(--analytics-table-pinned-background, ${lotusThemeTokens.color.surface.panel})`
              : lotusThemeTokens.color.surface.panelAlt,
        }
      : {}),
  };
}

function getPinnedRowBackground(
  variant: AnalyticsTableVariant,
  rowIndex: number,
) {
  const usesAlternatingRows = variant === "analysis" || variant === "observation";
  return usesAlternatingRows && rowIndex % 2 === 1
    ? lotusThemeTokens.color.surface.panelAlt
    : lotusThemeTokens.color.surface.panel;
}

function getHeaderCellSx(density: AnalyticsTableDensity) {
  return {
    position: "sticky",
    top: 0,
    zIndex: lotusThemeTokens.zIndex.content,
    py: densityPaddingY[density],
    px: lotusThemeTokens.table.cellPadding.x,
    fontSize: headerFontSize[density],
    fontWeight: lotusThemeTokens.typography.variant.tableHeader.weight,
    letterSpacing: lotusThemeTokens.typography.variant.tableHeader.tracking,
    textTransform: "uppercase",
    color: lotusThemeTokens.color.text.muted,
    bgcolor: lotusThemeTokens.color.surface.panelAlt,
    borderBottomColor: lotusThemeTokens.color.border.default,
    whiteSpace: "nowrap",
  } as const;
}

function getBodyCellSx(density: AnalyticsTableDensity) {
  return {
    fontSize: densityFontSize[density],
    lineHeight: lotusThemeTokens.typography.variant.tableCell.lineHeight,
    fontWeight: lotusThemeTokens.typography.variant.tableCell.weight,
    py: densityPaddingY[density],
    px: lotusThemeTokens.table.cellPadding.x,
    color: lotusThemeTokens.color.text.primary,
    borderBottomColor: lotusThemeTokens.color.border.default,
    whiteSpace: "nowrap",
  } as const;
}

function getFooterCellSx(density: AnalyticsTableDensity) {
  return {
    fontSize: footerFontSize[density],
    fontWeight: 600,
    lineHeight: lotusThemeTokens.typography.variant.tableCell.lineHeight,
    py: densityPaddingY[density],
    px: lotusThemeTokens.table.cellPadding.x,
    color: lotusThemeTokens.color.text.primary,
    borderTop: "1px solid",
    borderTopColor: lotusThemeTokens.color.border.default,
    bgcolor: lotusThemeTokens.color.surface.panelAlt,
    whiteSpace: "nowrap",
  } as const;
}
