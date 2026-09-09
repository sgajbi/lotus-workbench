import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAdvisorBookSearchParams,
  getAdvisorBook,
} from "@/features/advisor-book/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("advisor-book API", () => {
  it("builds only Gateway-supported filters and paging fields", () => {
    expect(
      buildAdvisorBookSearchParams({
        asOfDate: "2026-04-10",
        clientId: " CIF_SG_001 ",
        mandateType: "ADVISORY",
        sortBy: "client_id",
        sortOrder: "desc",
        offset: 25,
        limit: 25,
      }).toString(),
    ).toBe(
      "asOfDate=2026-04-10&clientId=CIF_SG_001&mandateType=ADVISORY&sortBy=client_id&sortOrder=desc&offset=25&limit=25",
    );
  });

  it("loads the own-book contract only through the Workbench BFF", async () => {
    const payload = {
      correlation_id: "corr-1",
      contract_version: "v1",
      scope: {
        kind: "own_book",
        label: "My book",
        as_of_date: "2026-04-10",
        booking_center_code: "Singapore",
      },
      page: {
        total_count: 0,
        offset: 0,
        limit: 25,
        returned_count: 0,
        sort_by: "portfolio_id",
        sort_order: "asc",
      },
      items: [],
      supportability: {
        state: "empty",
        reason_code: "advisor_book_empty",
        tenant_scope: "source_confirmed",
        limitations: ["delegated_scope_not_supported"],
      },
      provenance: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    await expect(
      getAdvisorBook(
        { asOfDate: "2026-04-10" },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "/api/bff/api/v1/advisor-book/portfolios?asOfDate=2026-04-10",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("rejects source evidence returned for a different business date", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          correlation_id: "corr-date-mismatch",
          contract_version: "v1",
          scope: {
            kind: "own_book",
            label: "My book",
            as_of_date: "2026-04-09",
            booking_center_code: "Singapore",
          },
          page: {
            total_count: 0,
            offset: 0,
            limit: 25,
            returned_count: 0,
            sort_by: "portfolio_id",
            sort_order: "asc",
          },
          items: [],
          supportability: {
            state: "empty",
            reason_code: "advisor_book_empty",
            tenant_scope: "source_confirmed",
            limitations: ["delegated_scope_not_supported"],
          },
          provenance: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getAdvisorBook({ asOfDate: "2026-04-10" })).rejects.toThrow(
      /business date did not match the requested source scope/i,
    );
  });
});
