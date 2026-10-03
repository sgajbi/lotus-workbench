import type { PortfolioPositionView } from "../types";
import { formatStatus } from "../formatters";
import { PORTFOLIO_CURRENCY_LABELS } from "../portfolio-terminology";
import {
  buildPortfolioPositionState,
  type PortfolioPositionStateKind,
  type PortfolioPositionStateTone,
} from "../portfolio-position-state-view-model";

export type HoldingsColumnKey =
  | "instrument"
  | "assetClass"
  | "quantity"
  | "price"
  | "marketValue"
  | "costBasis"
  | "weight"
  | "upl"
  | "currency"
  | "status"
  | "sector"
  | "heldSince"
  | "isin";

export type HoldingsRow = {
  securityId: string;
  instrument: string;
  assetClass: string;
  quantity: number;
  price: number | null;
  marketValue: number | null;
  costBasis: number | null;
  weight: number | null;
  upl: number | null;
  currency: string;
  status: string;
  statusKind: PortfolioPositionStateKind;
  statusTone: PortfolioPositionStateTone;
  sector: string;
  heldSince: string | null;
  isin: string | null;
  raw: PortfolioPositionView;
};

export const DEFAULT_HOLDINGS_COLUMN_VISIBILITY: Record<HoldingsColumnKey, boolean> = {
  instrument: true,
  assetClass: true,
  quantity: true,
  price: true,
  marketValue: true,
  costBasis: true,
  weight: true,
  upl: true,
  currency: true,
  status: true,
  sector: false,
  heldSince: false,
  isin: false,
};

export const HOLDINGS_COLUMN_LABELS: Record<HoldingsColumnKey, string> = {
  instrument: "Instrument",
  assetClass: "Asset class",
  quantity: "Quantity",
  price: "Price",
  marketValue: "Market value",
  costBasis: "Cost basis",
  weight: "Weight",
  upl: "Unrealised P&L",
  currency: PORTFOLIO_CURRENCY_LABELS.instrument,
  status: "Status",
  sector: "Sector",
  heldSince: "Held since",
  isin: "ISIN",
};

export function buildDefaultHoldingsColumnVisibility(
  columnMode: "essential" | "expanded",
): Record<HoldingsColumnKey, boolean> {
  return columnMode === "essential"
    ? { ...DEFAULT_HOLDINGS_COLUMN_VISIBILITY, sector: false, heldSince: false, isin: false }
    : { ...DEFAULT_HOLDINGS_COLUMN_VISIBILITY, sector: true, heldSince: true };
}

export function buildExpandedHoldingsColumnVisibility(): Record<HoldingsColumnKey, boolean> {
  return {
    ...DEFAULT_HOLDINGS_COLUMN_VISIBILITY,
    sector: true,
    heldSince: true,
    isin: true,
  };
}

export function buildHoldingsRows(
  positions: PortfolioPositionView[],
  baseCurrency: string,
): HoldingsRow[] {
  return positions.map((position) => buildHoldingRow(position, baseCurrency));
}

export function buildHoldingRow(
  position: PortfolioPositionView,
  baseCurrency: string,
): HoldingsRow {
  const positionState = buildPortfolioPositionState(position);

  return {
    securityId: position.security_id,
    instrument: position.instrument_name,
    assetClass: formatStatus(position.asset_class),
    quantity: position.quantity,
    price: position.market_price ?? null,
    marketValue: position.market_value_base ?? null,
    costBasis: position.cost_basis_base ?? null,
    weight: position.weight_pct ?? null,
    upl: position.unrealized_gain_loss_base ?? null,
    currency: position.currency ?? baseCurrency,
    status: positionState.label,
    statusKind: positionState.kind,
    statusTone: positionState.tone,
    sector: formatStatus(position.sector),
    heldSince: position.held_since_date ?? null,
    isin: position.isin ?? null,
    raw: position,
  };
}

export function countUnpricedHoldings(positions: PortfolioPositionView[]): number {
  return positions.filter(
    (position) =>
      position.market_value_base == null ||
      (position.source_record_type !== "cash_balance" && position.market_price == null),
  ).length;
}

export function sumHoldingsMarketValue(rows: HoldingsRow[]): number | null {
  if (rows.some((row) => row.marketValue === null)) return null;
  return rows.reduce((total, row) => total + row.marketValue!, 0);
}

export function buildHoldingsExportRows(
  rows: HoldingsRow[],
  visibility: Record<HoldingsColumnKey, boolean>,
  baseCurrency: string,
): Record<string, string | number>[] {
  const visibleColumns = (Object.keys(HOLDINGS_COLUMN_LABELS) as HoldingsColumnKey[]).filter(
    (key) => visibility[key],
  );

  return rows.map((row) => {
    const output: Record<string, string | number> = {};
    visibleColumns.forEach((key) => {
      switch (key) {
        case "instrument":
          output["Instrument"] = row.instrument;
          break;
        case "assetClass":
          output["Asset class"] = row.assetClass;
          break;
        case "quantity":
          output["Quantity"] = row.quantity;
          break;
        case "price":
          output["Price"] = row.price ?? "";
          break;
        case "marketValue":
          output[`Market value (${baseCurrency})`] = row.marketValue ?? "";
          break;
        case "costBasis":
          output[`Cost basis (${baseCurrency})`] = row.costBasis ?? "";
          break;
        case "weight":
          output["Weight %"] = row.weight ?? "";
          break;
        case "upl":
          output[`Unrealised P&L (${baseCurrency})`] = row.upl ?? "";
          break;
        case "currency":
          output[PORTFOLIO_CURRENCY_LABELS.instrument] = row.currency;
          break;
        case "status":
          output["Status"] = row.status;
          break;
        case "sector":
          output["Sector"] = row.sector;
          break;
        case "heldSince":
          output["Held since"] = row.heldSince ?? "";
          break;
        case "isin":
          output["ISIN"] = row.isin ?? "";
          break;
      }
    });
    return output;
  });
}
