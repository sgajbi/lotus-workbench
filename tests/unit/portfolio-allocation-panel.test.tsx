import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PortfolioAllocationPanel from "../../src/apps/portfolio/components/portfolio-allocation-panel";
import type { PortfolioAllocationView } from "../../src/apps/portfolio/types";
import { qualifyAllocationControl } from "../fixtures/qualify-allocation-control";

const allocationViews: PortfolioAllocationView[] = [
  {
    dimension: "asset_class",
    buckets: [
      { bucket: "Equities", position_count: 7, market_value_base: 725000, weight_pct: 58 },
      { bucket: "Fixed Income", position_count: 4, market_value_base: 320000, weight_pct: 25.6 },
    ],
  },
  {
    dimension: "currency",
    buckets: [{ bucket: "USD", position_count: 9, market_value_base: 925000, weight_pct: 74 }],
  },
  {
    dimension: "sector",
    buckets: [{ bucket: "Technology", position_count: 4, market_value_base: 525000, weight_pct: 42 }],
  },
];

describe("PortfolioAllocationPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hydrates strategic allocation views, enables live region support, and emits selections", async () => {
    const onSelectionChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (!url.includes("/allocations?")) {
          throw new Error(`Unexpected fetch: ${url}`);
        }

        if (url.includes("look_through_mode=prefer_look_through")) {
          return jsonResponse({
            reporting_currency: "USD",
            look_through: {
              requested_mode: "prefer_look_through",
              effective_mode: "prefer_look_through",
              applied: true,
            },
            views: [
              {
                dimension: "region",
                buckets: [
                  {
                    bucket: "Asia",
                    position_count: 3,
                    market_value_base: 300000,
                    weight_pct: 24,
                  },
                ],
              },
            ],
          });
        }

        return jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: "prefer_look_through",
            effective_mode: "direct_only",
            applied: false,
          },
          views: [
            ...allocationViews,
            {
              dimension: "region",
              buckets: [
                {
                  bucket: "North America",
                  position_count: 6,
                  market_value_base: 625000,
                  weight_pct: 50,
                },
              ],
            },
          ],
        });
      })
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByRole("radio", { name: "Asset Class" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Currency" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Sector" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Region" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Region" })).toHaveAttribute(
      "title",
      "Region allocation coverage unavailable",
    );
    expect(screen.queryByTitle("Region pending source support")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radiogroup")).toHaveLength(2);
    expect(document.querySelectorAll(".portfolio-allocation-card")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Asset Class allocation view" })).toBeInTheDocument();
    expect(screen.getByText("Portfolio exposure")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking expanded exposure coverage" })).toBeDisabled();
    expect(screen.getByText("725,000 USD")).toHaveClass("portfolio-allocation-ranked-number");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show expanded exposure" })).toBeEnabled(),
    );
    expect(screen.getByText("Source coverage confirmed")).toBeInTheDocument();
    expect(
      screen.getByText("Expanded exposure is available for this portfolio snapshot"),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Region" })).not.toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("radio", { name: "Currency" }));
    expect(screen.getByRole("region", { name: "Currency allocation view" })).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "USD: 925,000 USD, 74.00%, 9 positions. Review contributing positions.",
      }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      dimension: "currency",
      bucket: "USD",
    });

    fireEvent.click(screen.getByRole("button", { name: "Show expanded exposure" }));
    await waitFor(() =>
      expect(
        screen.getByText("Region • 1 exposures • Expanded exposure")
      ).toBeInTheDocument()
    );
    expect(onSelectionChange).toHaveBeenCalledWith(null);
    expect(
      screen.getByRole("button", {
        name: "Asia: 300,000 USD, 24.00%, 3 positions. Expanded exposure contributor detail is unavailable.",
      }),
    ).toBeDisabled();
  });

  it("supports keyboard activation on donut chart segments", async () => {
    const onSelectionChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: "prefer_look_through",
            effective_mode: "direct_only",
            applied: false,
          },
          views: allocationViews,
        })
      )
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={onSelectionChange}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Expanded exposure unavailable for current portfolio snapshot",
        })
      ).toBeDisabled()
    );

    fireEvent.keyDown(
      screen.getByLabelText("Equities: 58.00%. Review contributing positions."),
      { key: "Enter" }
    );

    expect(onSelectionChange).toHaveBeenCalledWith({
      dimension: "asset_class",
      bucket: "Equities",
    });
  });

  it("renders a professional empty state while keeping the module controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: "prefer_look_through",
            effective_mode: "direct_only",
            applied: false,
          },
          views: [{ dimension: "asset_class", buckets: [] }],
        })
      )
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={[{ dimension: "asset_class", buckets: [] }]}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={() => {}}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Expanded exposure unavailable for current portfolio snapshot",
        })
      ).toBeDisabled()
    );

    expect(screen.getByRole("radio", { name: "Asset Class" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Region" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("No open positions in the source snapshot.")).toBeInTheDocument();
    expect(screen.getByText("Allocation source snapshot is empty")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Asset Class allocation view" })).toBeInTheDocument();
  });

  it("keeps look-through disabled when gateway falls back to direct holdings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (!url.includes("/allocations?")) {
          throw new Error(`Unexpected fetch: ${url}`);
        }

        return jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: url.includes("look_through_mode=prefer_look_through")
              ? "prefer_look_through"
              : "direct_only",
            effective_mode: "direct_only",
            applied: false,
          },
          views: allocationViews,
        });
      })
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={() => {}}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Expanded exposure unavailable for current portfolio snapshot",
        })
      ).toBeDisabled()
    );
  });

  it("keeps unconfirmed preferred-mode responses recoverable without replacing direct evidence", async () => {
    let allocationRequestCount = 0;
    const onSelectionChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        allocationRequestCount += 1;
        if (allocationRequestCount === 1) {
          return jsonResponse({
            reporting_currency: "USD",
            views: [
              {
                dimension: "asset_class",
                buckets: [
                  {
                    bucket: "Unconfirmed exposure",
                    position_count: 1,
                    market_value_base: 1,
                    weight_pct: 100,
                  },
                ],
              },
            ],
          });
        }
        return jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: "direct_only",
            effective_mode: "direct_only",
            applied: false,
          },
          views: [],
        });
      }),
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={{ dimension: "asset_class", bucket: "Equities" }}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Expanded exposure could not be confirmed")).toBeInTheDocument(),
    );
    expect(screen.getByText("725,000 USD")).toBeInTheDocument();
    expect(screen.queryByText("Unconfirmed exposure")).not.toBeInTheDocument();
    expect(onSelectionChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Recheck exposure coverage" }));

    await waitFor(() => expect(allocationRequestCount).toBe(2));
    await waitFor(() =>
      expect(screen.getByText("Expanded exposure could not be confirmed")).toBeInTheDocument(),
    );
    expect(screen.getByText("725,000 USD")).toBeInTheDocument();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("keeps direct allocation usable and recovers source coverage without moving focus", async () => {
    let allocationRequestCount = 0;
    const onSelectionChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        allocationRequestCount += 1;
        if (allocationRequestCount === 1) {
          return jsonResponse({ code: "allocation_source_unavailable" }, 503);
        }
        return jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: "prefer_look_through",
            effective_mode: "prefer_look_through",
            applied: true,
          },
          views: [
            {
              dimension: "region",
              buckets: [
                {
                  bucket: "Asia",
                  position_count: 3,
                  market_value_base: 300000,
                  weight_pct: 24,
                },
              ],
            },
          ],
        });
      }),
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={{ dimension: "asset_class", bucket: "Equities" }}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Expanded exposure could not be confirmed")).toBeInTheDocument(),
    );
    expect(screen.getByText("725,000 USD")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Expanded exposure coverage could not be confirmed",
      }),
    ).toBeDisabled();

    const recheck = screen.getByRole("button", { name: "Recheck exposure coverage" });
    const selectedExposure = screen.getByRole("button", {
      name: "Equities: 725,000 USD, 58.00%, 7 positions. Review contributing positions.",
    });
    expect(selectedExposure).toHaveClass("portfolio-allocation-ranked-row-selected");
    recheck.focus();
    fireEvent.click(recheck);
    expect(recheck).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(recheck);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(selectedExposure).toHaveClass("portfolio-allocation-ranked-row-selected");

    await waitFor(() => expect(screen.getByText("Source coverage confirmed")).toBeInTheDocument());
    expect(
      screen.getByText("Expanded exposure is available for this portfolio snapshot"),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(recheck);
    expect(recheck).toHaveAttribute("aria-disabled", "false");
    expect(allocationRequestCount).toBe(3);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(selectedExposure).toHaveClass("portfolio-allocation-ranked-row-selected");
    expect(screen.getByRole("button", { name: "Show expanded exposure" })).toBeEnabled();
  });

  it("applies an empty direct fallback and clears the invalidated exposure", async () => {
    let allocationRequestCount = 0;
    let resolveRecheck: ((response: Response) => void) | undefined;
    const recheckResponse = new Promise<Response>((resolve) => {
      resolveRecheck = resolve;
    });
    const onSelectionChange = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        allocationRequestCount += 1;
        if (allocationRequestCount === 1) {
          return jsonResponse({ code: "allocation_source_unavailable" }, 503);
        }
        return recheckResponse;
      }),
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={{ dimension: "asset_class", bucket: "Equities" }}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Expanded exposure could not be confirmed")).toBeInTheDocument(),
    );
    const recheck = screen.getByRole("button", { name: "Recheck exposure coverage" });
    fireEvent.click(recheck);

    expect(onSelectionChange).not.toHaveBeenCalled();
    resolveRecheck?.(
      jsonResponse({
        reporting_currency: "USD",
        look_through: {
          requested_mode: "prefer_look_through",
          effective_mode: "direct_only",
          applied: false,
        },
        views: [],
      }),
    );

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(null));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Direct positions only")).toBeInTheDocument();
    expect(screen.getByText("No open positions in the source snapshot.")).toBeInTheDocument();
    expect(screen.queryByText("725,000 USD")).not.toBeInTheDocument();
  });

  it("clears a selection invalidated by the initial direct fallback", async () => {
    let resolveInitialCoverage: ((response: Response) => void) | undefined;
    const initialCoverageResponse = new Promise<Response>((resolve) => {
      resolveInitialCoverage = resolve;
    });
    const onSelectionChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => initialCoverageResponse));

    const { rerender } = render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={onSelectionChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Equities: 725,000 USD, 58.00%, 7 positions. Review contributing positions.",
      }),
    );
    expect(onSelectionChange).toHaveBeenCalledWith({
      dimension: "asset_class",
      bucket: "Equities",
    });

    rerender(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={{ dimension: "asset_class", bucket: "Equities" }}
        onSelectionChange={onSelectionChange}
      />,
    );
    onSelectionChange.mockClear();

    resolveInitialCoverage?.(
      jsonResponse({
        reporting_currency: "USD",
        look_through: {
          requested_mode: "prefer_look_through",
          effective_mode: "direct_only",
          applied: false,
        },
        views: [],
      }),
    );

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(null));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("No open positions in the source snapshot.")).toBeInTheDocument();
    expect(screen.queryByText("725,000 USD")).not.toBeInTheDocument();
  });

  it("keeps source-confirmed empty expanded coverage distinct from unsupported coverage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          reporting_currency: "USD",
          look_through: {
            requested_mode: "prefer_look_through",
            effective_mode: "prefer_look_through",
            applied: true,
          },
          views: [],
        }),
      ),
    );

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={() => {}}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Show expanded exposure" })).toBeEnabled(),
    );
    expect(screen.getByText("Source coverage confirmed")).toBeInTheDocument();
    expect(
      screen.getByText("Expanded exposure is available for this portfolio snapshot"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Direct positions only")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show expanded exposure" }));

    expect(screen.getByText("No open positions in the source snapshot.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show direct positions" })).toBeEnabled();
    expect(screen.getByText("Source coverage confirmed")).toBeInTheDocument();
  });

  it("keeps malformed successful coverage responses failed and recoverable", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        reporting_currency: "USD",
        code: "unexpected_success_envelope",
      }),
    );
    const onSelectionChange = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PortfolioAllocationPanel
        portfolioId="MANUAL_PB_USD_001"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={{ dimension: "asset_class", bucket: "Equities" }}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Expanded exposure could not be confirmed")).toBeInTheDocument(),
    );
    expect(screen.getByText("725,000 USD")).toBeInTheDocument();

    const recheck = screen.getByRole("button", { name: "Recheck exposure coverage" });
    fireEvent.click(recheck);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText("Expanded exposure could not be confirmed")).toBeInTheDocument(),
    );
    expect(recheck).toHaveAttribute("aria-disabled", "false");
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("does not let a superseded portfolio response replace newer coverage evidence", async () => {
    let resolveSupersededRequest: ((response: Response) => void) | undefined;
    const supersededRequest = new Promise<Response>((resolve) => {
      resolveSupersededRequest = resolve;
    });
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("PORTFOLIO_OLD")) {
        return supersededRequest;
      }
      return jsonResponse({
        portfolio_id: "PORTFOLIO_NEW",
        reporting_currency: "USD",
        look_through: {
          requested_mode: "prefer_look_through",
          effective_mode: "direct_only",
          applied: false,
        },
        views: allocationViews,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSelectionChange = vi.fn();

    const { rerender } = render(
      <PortfolioAllocationPanel
        portfolioId="PORTFOLIO_OLD"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={onSelectionChange}
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender(
      <PortfolioAllocationPanel
        portfolioId="PORTFOLIO_NEW"
        allocationViews={allocationViews}
        baseCurrency="USD"
        asOfDate="2026-03-28"
        reportingCurrency="USD"
        selectedAllocation={null}
        onSelectionChange={onSelectionChange}
      />,
    );
    await waitFor(() => expect(screen.getByText("Direct positions only")).toBeInTheDocument());

    resolveSupersededRequest?.(
      jsonResponse({
        reporting_currency: "USD",
        look_through: {
          requested_mode: "prefer_look_through",
          effective_mode: "prefer_look_through",
          applied: true,
        },
        views: [
          {
            dimension: "region",
            buckets: [
              {
                bucket: "Superseded exposure",
                position_count: 1,
                market_value_base: 1,
                weight_pct: 100,
              },
            ],
          },
        ],
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Expanded exposure unavailable for current portfolio snapshot",
        }),
      ).toBeDisabled(),
    );
    expect(screen.queryByText("Superseded exposure")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show expanded exposure" })).not.toBeInTheDocument();
  });
});

function jsonResponse(payload: unknown, status = 200): Response {
  const qualified = payload && typeof payload === "object" && "views" in payload
    ? qualifyAllocationControl(payload as Parameters<typeof qualifyAllocationControl>[0]) : payload;
  return new Response(JSON.stringify(qualified), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
