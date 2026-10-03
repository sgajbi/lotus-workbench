import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildPortfolioDateFacts,
  formatShareOfPortfolioValue,
  PORTFOLIO_REVIEW_DATE_LABEL,
  PORTFOLIO_CURRENCY_LABELS,
  PORTFOLIO_EVIDENCE_LABELS,
  PORTFOLIO_MODULE_LABELS,
  PORTFOLIO_SCREEN_LABELS,
  PORTFOLIO_VALUATION_DATE_LABEL,
  PORTFOLIO_VALUE_LABEL,
} from "../../src/apps/portfolio/portfolio-terminology";

const PORTFOLIO_SOURCE_ROOT = join(process.cwd(), "src", "apps", "portfolio");
const FORBIDDEN_PORTFOLIO_AUM_COPY =
  /\bAUM\b|assets under management|PORTFOLIO_AUM_UNAVAILABLE|assets_under_management_base/i;
const FORBIDDEN_PORTFOLIO_UI_COPY =
  /\b(?:Booked holdings|Available holdings|Top holdings|Ranked holdings|Direct holdings(?: only)?|contributing holdings|Search holdings|Export holdings|Unrealized P&L|Realized P&L|Portfolio Currency|Base Currency|Reporting Currency|Transaction Currency|Trade currency)\b/;
const ALLOWED_BOUNDARY_REFERENCES = {
  "api.ts": [
    { snippet: "assets_under_management_base: number;", count: 1 },
    { snippet: ".assets_under_management_base", count: 2 },
  ],
  "workspace-config.ts": [
    { snippet: 'case "PORTFOLIO_AUM_UNAVAILABLE":', count: 1 },
  ],
} as const;

function portfolioSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return portfolioSourceFiles(absolutePath);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

function stripAllowedBoundaryReferences(
  relativePath: string,
  source: string,
): string {
  const boundaryReferences =
    ALLOWED_BOUNDARY_REFERENCES[
      relativePath as keyof typeof ALLOWED_BOUNDARY_REFERENCES
    ] ?? [];

  return boundaryReferences.reduce((remainingSource, { snippet, count }) => {
    expect(
      remainingSource.split(snippet).length - 1,
      `${relativePath}: ${snippet}`,
    ).toBe(count);
    return remainingSource.replaceAll(snippet, "");
  }, source);
}

describe("portfolio terminology", () => {
  it("uses one selected-portfolio value term and allocation-share phrase", () => {
    expect(PORTFOLIO_VALUE_LABEL).toBe("Portfolio value");
    expect(formatShareOfPortfolioValue("92.00%")).toBe(
      "92.00% of portfolio value",
    );
  });

  it("uses one date vocabulary and adds review date only when it differs", () => {
    expect(
      buildPortfolioDateFacts("2026-04-10", "2026-04-10"),
    ).toEqual([
      { label: PORTFOLIO_VALUATION_DATE_LABEL, date: "2026-04-10" },
    ]);
    expect(
      buildPortfolioDateFacts("2026-04-10", "2026-04-01"),
    ).toEqual([
      { label: PORTFOLIO_VALUATION_DATE_LABEL, date: "2026-04-10" },
      { label: PORTFOLIO_REVIEW_DATE_LABEL, date: "2026-04-01" },
    ]);
  });

  it("owns the canonical portfolio screen and currency labels", () => {
    expect(PORTFOLIO_SCREEN_LABELS).toEqual({
      portfolioReview: "Portfolio review",
      allocation: "Allocation",
      transactions: "Transactions",
      incomeAndActivity: "Income and activity",
      positions: "Positions",
      projectedCashFlow: "Projected cash flow",
      reportCentre: "Report centre",
    });
    expect(PORTFOLIO_CURRENCY_LABELS).toEqual({
      base: "Base currency",
      reporting: "Reporting currency",
      instrument: "Instrument currency",
      transaction: "Transaction currency",
    });
    expect(PORTFOLIO_EVIDENCE_LABELS).toEqual({
      sourceLimitations: "Source limitations",
      evidenceCoverage: "Evidence coverage",
      activeLimitations: "Active limitations",
    });
  });

  it("keeps subordinate record modules distinct from their route task headings", () => {
    expect(PORTFOLIO_MODULE_LABELS).toEqual({
      projectedMovementDetail: "Projection detail",
      bookedPortfolioInventory: "Booked portfolio inventory",
    });
    expect(PORTFOLIO_MODULE_LABELS.projectedMovementDetail).not.toBe(
      PORTFOLIO_SCREEN_LABELS.projectedCashFlow,
    );
    expect(PORTFOLIO_MODULE_LABELS.bookedPortfolioInventory).not.toBe(
      PORTFOLIO_SCREEN_LABELS.positions,
    );
  });

  it.each([
    "Total AUM",
    "Assets under management",
    "PORTFOLIO_AUM_UNAVAILABLE",
    "assets_under_management_base",
  ])("detects forbidden portfolio copy or leaked contract identifier: %s", (copy) => {
    expect(copy).toMatch(FORBIDDEN_PORTFOLIO_AUM_COPY);
  });

  it("permits legacy identifiers only in their exact source-boundary syntax", () => {
    expect(
      stripAllowedBoundaryReferences(
        "api.ts",
        [
          "assets_under_management_base: number;",
          "summary.assets_under_management_base",
          "payload.summary.assets_under_management_base",
        ].join("\n"),
      ),
    ).not.toMatch(FORBIDDEN_PORTFOLIO_AUM_COPY);
    expect(
      stripAllowedBoundaryReferences(
        "workspace-config.ts",
        'case "PORTFOLIO_AUM_UNAVAILABLE":',
      ),
    ).not.toMatch(FORBIDDEN_PORTFOLIO_AUM_COPY);
  });

  it("reserves AUM language for source contract identifiers, not portfolio UI copy", () => {
    for (const filePath of portfolioSourceFiles(PORTFOLIO_SOURCE_ROOT)) {
      const relativePath = relative(PORTFOLIO_SOURCE_ROOT, filePath).replaceAll(
        "\\",
        "/",
      );
      const sourceWithoutContractIdentifiers = stripAllowedBoundaryReferences(
        relativePath,
        readFileSync(filePath, "utf8"),
      );

      expect(sourceWithoutContractIdentifiers, filePath).not.toMatch(
        FORBIDDEN_PORTFOLIO_AUM_COPY,
      );
    }
  });

  it.each([0, 2])("rejects a drifted boundary declaration count of %s", (count) => {
    const source = [
      ...Array.from({ length: count }, () => "assets_under_management_base: number;"),
      "summary.assets_under_management_base",
      "payload.summary.assets_under_management_base",
    ].join("\n");
    expect(() => stripAllowedBoundaryReferences("api.ts", source)).toThrow();
  });

  it("prevents retired position, currency, and UK-English variants from returning to portfolio UI", () => {
    for (const filePath of portfolioSourceFiles(PORTFOLIO_SOURCE_ROOT)) {
      expect(readFileSync(filePath, "utf8"), filePath).not.toMatch(
        FORBIDDEN_PORTFOLIO_UI_COPY,
      );
    }
  });
});
