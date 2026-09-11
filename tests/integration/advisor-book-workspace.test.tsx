import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdvisorBookWorkspace from "@/features/advisor-book/components/advisor-book-workspace";
import { WorkbenchApiError } from "@/features/workbench/api-client";
import { renderWithQueryClient } from "../helpers/query-client-test-harness";

const getAdvisorBookMock = vi.fn();
const routerPushMock = vi.fn();
const routerReplaceMock = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock("@/features/advisor-book/api", async () => {
  const actual = await vi.importActual<typeof import("@/features/advisor-book/api")>(
    "@/features/advisor-book/api",
  );
  return { ...actual, getAdvisorBook: (...args: unknown[]) => getAdvisorBookMock(...args) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/book",
  useRouter: () => ({ push: routerPushMock, replace: routerReplaceMock }),
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const readyResponse = {
  correlation_id: "corr-1",
  contract_version: "v1",
  scope: {
    kind: "own_book",
    label: "My book",
    as_of_date: "2026-04-10",
    booking_center_code: "Singapore",
  },
  page: {
    total_count: 1,
    offset: 0,
    limit: 25,
    returned_count: 1,
    sort_by: "portfolio_id",
    sort_order: "asc",
  },
  items: [
    {
      portfolio_id: "PB_SG_GLOBAL_BAL_001",
      display_name: "Global Balanced Mandate",
      client_id: "CIF_SG_GLOBAL_BAL_001",
      base_currency: "USD",
      booking_center_code: "Singapore",
      mandate_type: "DISCRETIONARY",
      status: "ACTIVE",
      opened_on: "2025-03-31",
      closed_on: null,
      membership_source: "PortfolioManagerBookMembership:v1",
      membership_reference: "portfolio:PB_SG_GLOBAL_BAL_001",
      membership_basis: "governed_role_assignment",
    },
  ],
  supportability: {
    state: "ready",
    reason_code: "advisor_book_ready",
    tenant_scope: "source_confirmed",
    limitations: ["delegated_scope_not_supported"],
  },
  provenance: {
    product_name: "PortfolioManagerBookMembership",
    product_version: "v1",
    generated_at: "2026-04-10T02:00:00Z",
    latest_evidence_timestamp: "2026-04-10T01:59:00Z",
    freshness_status: "CURRENT",
    data_quality_status: "ACCEPTED",
    source_evidence_current: true,
    snapshot_id: "pm_book_membership:abc",
    content_hash: "sha256:abc",
    lineage: { source_owner: "lotus-core" },
  },
} as const;

function renderAdvisorBookWorkspace() {
  return renderWithQueryClient(<AdvisorBookWorkspace />);
}

describe("AdvisorBookWorkspace", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
    getAdvisorBookMock.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams("asOfDate=2026-04-10"));
  });

  it("moves from source loading to a dense own-book summary and portfolio handoff", async () => {
    getAdvisorBookMock.mockResolvedValue(readyResponse);
    renderAdvisorBookWorkspace();

    expect(screen.getByRole("status")).toHaveTextContent("Loading your book");
    expect(await screen.findByText("Book available")).toBeInTheDocument();
    expect(screen.getByLabelText("Current book view")).toHaveTextContent(
      "Matching portfolios1",
    );
    expect(screen.getByText("1–1 of 1 portfolios")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Portfolios in my book" });
    expect(within(table).getByText("CIF_SG_GLOBAL_BAL_001")).toBeInTheDocument();
    expect(within(table).getByText("Discretionary mandate")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Global Balanced Mandate" })).toHaveAttribute(
      "href",
      "/portfolio?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-04-10",
    );
    const supportDisclosure = screen.getByTestId(
      "advisor-book-operating-evidence",
    );
    expect(supportDisclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Own book only")).not.toBeVisible();
    expect(screen.getByText("advisor_book_ready")).not.toBeVisible();
    fireEvent.click(screen.getByText("Book scope and operating evidence"));
    expect(supportDisclosure).toHaveAttribute("open");
    expect(
      within(supportDisclosure).getByRole("heading", {
        name: "Operating boundaries",
      }),
    ).toBeVisible();
    expect(
      within(supportDisclosure).getByRole("heading", {
        name: "Support references",
      }),
    ).toBeVisible();
    expect(screen.getByText("Own book only")).toBeVisible();
    expect(screen.getByText("advisor_book_ready")).toBeVisible();
    expect(
      screen.getByText(/Find a confirmed assignment and continue into its portfolio review/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/source-backed|portfolio membership/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/membership contract/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/team book|household|AUM|attention rank/i)).not.toBeInTheDocument();
    expect(screen.getByText("Checked just now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recheck book" })).toBeInTheDocument();
  });

  it("rechecks the current register once and keeps the receipt beside its result scope", async () => {
    getAdvisorBookMock.mockResolvedValue(readyResponse);
    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    fireEvent.click(screen.getByRole("button", { name: "Recheck book" }));

    await waitFor(() => expect(getAdvisorBookMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Checked just now")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Portfolios in my book" })).toBeInTheDocument();
    expect(screen.queryByText(/recheck failed/i)).not.toBeInTheDocument();
  });

  it("retains admitted assignments and their receipt when a recheck fails", async () => {
    getAdvisorBookMock
      .mockResolvedValueOnce(readyResponse)
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 502));
    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    fireEvent.click(screen.getByRole("button", { name: "Recheck book" }));

    expect(await screen.findByText(/Book recheck failed/)).toHaveTextContent(
      "displayed assignments remain from the previous successful check",
    );
    expect(screen.getByText("Checked just now")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Portfolios in my book" })).toBeInTheDocument();
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(2);
  });

  it("removes admitted rows when an explicit recheck is permission denied", async () => {
    getAdvisorBookMock
      .mockResolvedValueOnce(readyResponse)
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 403));
    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    fireEvent.click(screen.getByRole("button", { name: "Recheck book" }));

    expect(await screen.findByText("Book access is not available")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Portfolios in my book" })).not.toBeInTheDocument();
    expect(screen.queryByText("Checked just now")).not.toBeInTheDocument();
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(2);
  });

  it("shows recovery progress and prevents repeated retries while withheld book access is refetching", async () => {
    let resolveRecovery: ((value: typeof readyResponse) => void) | undefined;
    getAdvisorBookMock
      .mockResolvedValueOnce(readyResponse)
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 403))
      .mockImplementationOnce(
        () =>
          new Promise<typeof readyResponse>((resolve) => {
            resolveRecovery = resolve;
          }),
      );
    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    fireEvent.click(screen.getByRole("button", { name: "Recheck book" }));
    await screen.findByText("Book access is not available");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Loading your book")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      resolveRecovery?.(readyResponse);
    });
    expect(await screen.findByText("Book available")).toBeInTheDocument();
  });

  it("keeps repeated source limitations and raw references in one collapsed disclosure", async () => {
    getAdvisorBookMock.mockResolvedValue({
      ...readyResponse,
      supportability: {
        ...readyResponse.supportability,
        state: "degraded",
        reason_code: "advisor_book_unmapped_limitations",
        limitations: ["unmapped_one", "unmapped_two", "unmapped_one"],
      },
    });

    renderAdvisorBookWorkspace();
    await screen.findByText("Available with limitations");

    const disclosure = screen.getByTestId("advisor-book-operating-evidence");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getAllByText("Additional operating limitation")).toHaveLength(1);
    expect(screen.getByText("3 related limitations consolidated")).not.toBeVisible();
    expect(screen.getByText("unmapped_one, unmapped_two")).not.toBeVisible();

    fireEvent.click(screen.getByText("Book scope and operating evidence"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("3 related limitations consolidated")).toBeVisible();
    expect(screen.getByText("unmapped_one, unmapped_two")).toBeVisible();
  });

  it("does not request source data until an invalid business date is corrected", () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("asOfDate=not-a-date&clientId=CIF_SG_002&offset=25"),
    );

    renderAdvisorBookWorkspace();

    expect(screen.getByText("Business date not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/Portfolio assignments have not been requested/i)).toBeInTheDocument();
    expect(getAdvisorBookMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Business date"), {
      target: { value: "2026-04-11" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review book" }));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/book?asOfDate=2026-04-11&clientId=CIF_SG_002&offset=0",
      { scroll: false },
    );
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it("does not request source data for an ambiguous repeated business date", () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("asOfDate=2026-04-10&asOfDate=2026-04-11"),
    );

    renderAdvisorBookWorkspace();

    expect(screen.getByText("Business date not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/supplied more than once/i)).toBeInTheDocument();
    expect(screen.getByText(/Portfolio assignments have not been requested/i)).toBeInTheDocument();
    expect(getAdvisorBookMock).not.toHaveBeenCalled();
  });

  it.each([
    "portfolioId=PB_SG_GLOBAL_BAL_001&portfolioId=PB_OTHER_001&asOfDate=2026-04-10",
    "period=ONE_YEAR&asOfDate=2026-04-10",
    "reportingCurrency=usd&asOfDate=2026-04-10",
  ])("does not request source data for invalid review context %s", (query) => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams(query));

    renderAdvisorBookWorkspace();

    expect(screen.getByText("Business date not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/conflicting or unsupported context/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reset review context" })).toHaveAttribute(
      "href",
      "/book",
    );
    expect(screen.queryByLabelText("Business date")).not.toBeInTheDocument();
    expect(getAdvisorBookMock).not.toHaveBeenCalled();
  });

  it("does not use a configured development date outside a development environment", () => {
    vi.stubEnv("WORKBENCH_BUILD_ENVIRONMENT", "production");
    vi.stubEnv("NEXT_PUBLIC_WORKBENCH_ADVISOR_BOOK_AS_OF_DATE", "2026-04-10");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());

    renderAdvisorBookWorkspace();

    expect(screen.getByText("Business date not confirmed")).toBeInTheDocument();
    expect(screen.getByText(/local business date cannot be used/i)).toBeInTheDocument();
    expect(getAdvisorBookMock).not.toHaveBeenCalled();
  });

  it("updates supported source filters in the URL and resets paging", async () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("asOfDate=2026-04-10&offset=25&sortBy=portfolio_id"),
    );
    getAdvisorBookMock.mockResolvedValue({
      ...readyResponse,
      page: { ...readyResponse.page, offset: 25, total_count: 26 },
    });
    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    const clientReference = screen.getByRole("textbox", { name: "Client reference" });
    fireEvent.change(clientReference, {
      target: { value: "CIF_SG_002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply view" }));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/book?asOfDate=2026-04-10&offset=0&clientId=CIF_SG_002",
      { scroll: false },
    );
  });

  it("applies descending source sorting and clears the custom view without losing the date", async () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams(
        "asOfDate=2026-04-10&clientId=CIF_SG_002&mandateType=ADVISORY&sortBy=client_id&sortOrder=desc&offset=25",
      ),
    );
    getAdvisorBookMock.mockResolvedValue({
      ...readyResponse,
      page: {
        ...readyResponse.page,
        offset: 25,
        total_count: 26,
        sort_by: "client_id",
        sort_order: "desc",
      },
    });
    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("client_id");
    expect(screen.getByRole("combobox", { name: "Sort direction" })).toHaveValue("desc");
    expect(
      screen.getByText(
        "Client reference CIF_SG_002 · Advisory mandates · Displayed order: Client reference, descending",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply view" }));
    expect(routerPushMock).toHaveBeenLastCalledWith(
      "/book?asOfDate=2026-04-10&clientId=CIF_SG_002&mandateType=ADVISORY&sortBy=client_id&sortOrder=desc&offset=0",
      { scroll: false },
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear view" }));
    expect(routerPushMock).toHaveBeenLastCalledWith(
      "/book?asOfDate=2026-04-10",
      { scroll: false },
    );
  });

  it("keeps requested controls explicit when the source returns a different order", async () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams(
        "asOfDate=2026-04-10&sortBy=client_id&sortOrder=desc",
      ),
    );
    getAdvisorBookMock.mockResolvedValue(readyResponse);

    renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("client_id");
    expect(screen.getByRole("combobox", { name: "Sort direction" })).toHaveValue("desc");
    expect(
      screen.getByText(
        "All clients · All supported mandates · Displayed order: Portfolio reference, ascending · Requested order: Client reference, descending",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Displayed order: Client reference, descending/i)).not.toBeInTheDocument();
  });

  it("adopts URL filters and reuses the earlier exact view when returning", async () => {
    getAdvisorBookMock.mockResolvedValue(readyResponse);
    const { rerender } = renderAdvisorBookWorkspace();
    await screen.findByText("Book available");

    const clientReference = screen.getByRole("textbox", {
      name: "Client reference",
    });
    fireEvent.change(clientReference, {
      target: { value: "CIF_SG_002" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply view" }));

    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("asOfDate=2026-04-10&clientId=CIF_SG_002&offset=0"),
    );
    clientReference.focus();
    rerender(<AdvisorBookWorkspace />);
    const filteredClientReference = await screen.findByRole("textbox", {
      name: "Client reference",
    });
    expect(filteredClientReference).toBe(clientReference);
    expect(filteredClientReference).toHaveValue("CIF_SG_002");
    expect(filteredClientReference).toHaveFocus();
    await waitFor(() => expect(getAdvisorBookMock).toHaveBeenCalledTimes(2));

    useSearchParamsMock.mockReturnValue(new URLSearchParams("asOfDate=2026-04-10"));
    rerender(<AdvisorBookWorkspace />);

    const restoredClientReference = await screen.findByRole("textbox", {
      name: "Client reference",
    });
    expect(restoredClientReference).toBe(clientReference);
    expect(restoredClientReference).toHaveValue("");
    expect(restoredClientReference).toHaveFocus();
    expect(getAdvisorBookMock).toHaveBeenCalledTimes(2);
    expect(getAdvisorBookMock.mock.calls[0]?.[0]).toMatchObject({
      asOfDate: "2026-04-10",
      clientId: undefined,
    });
  });

  it("shows a permission-specific boundary without substituting the global catalogue", async () => {
    getAdvisorBookMock.mockRejectedValue(new WorkbenchApiError("advisor book", 403));
    renderAdvisorBookWorkspace();

    expect(await screen.findByText("Book access is not available")).toBeInTheDocument();
    expect(screen.getByText(/does not currently provide access/i)).toBeInTheDocument();
    expect(screen.getByText(/HTTP status 403.*contact support/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reference 403/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Portfolios in my book" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries a failed source request", async () => {
    getAdvisorBookMock
      .mockRejectedValueOnce(new WorkbenchApiError("advisor book", 502))
      .mockResolvedValueOnce(readyResponse);
    renderAdvisorBookWorkspace();

    expect(await screen.findByText(/HTTP status 502/i)).toBeInTheDocument();
    expect(screen.queryByText(/Reference 502/i)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(getAdvisorBookMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Book available")).toBeInTheDocument();
  });
});
