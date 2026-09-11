import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PortfolioScreenRailComponent from "../../src/apps/portfolio/components/portfolio-screen-rail";

const usePathnameMock = vi.fn();
const useAdvisorBookMock = vi.fn();
const reloadAdvisorBookMock = vi.fn();

function PortfolioScreenRail({
  relationshipIdBase = "portfolio-screen-rail-test",
  ...props
}: Omit<ComponentProps<typeof PortfolioScreenRailComponent>, "relationshipIdBase"> & {
  relationshipIdBase?: string;
}) {
  return (
    <PortfolioScreenRailComponent
      {...props}
      relationshipIdBase={relationshipIdBase}
    />
  );
}

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/features/advisor-book/use-advisor-book", () => ({
  useAdvisorBook: (...args: unknown[]) => useAdvisorBookMock(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

function openPortfolioContextOptions() {
  const summary = screen.getByLabelText("Change portfolio");
  const disclosure = summary.closest("details");

  if (!disclosure) {
    throw new Error("Portfolio context disclosure is missing");
  }

  disclosure.open = true;
  fireEvent(disclosure, new Event("toggle"));
}

describe("PortfolioScreenRail", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WORKBENCH_ADVISOR_BOOK_AS_OF_DATE", "2026-04-10");
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/income");
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/income?period=YTD&portfolioId=PB_SG_GLOBAL_BAL_001");
    useAdvisorBookMock.mockReturnValue({
      loading: false,
      error: null,
      reload: reloadAdvisorBookMock,
      response: {
        items: [
          {
            portfolio_id: "PB_SG_GLOBAL_BAL_001",
            display_name: "Global Balanced",
            client_id: "CIF_SG_001",
          },
          {
            portfolio_id: "PB_SG_INCOME_002",
            display_name: "Income Mandate",
            client_id: "CIF_SG_002",
          },
        ],
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the active business view without repeating shell-owned portfolio identity", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    expect(screen.queryByText("Selected portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("PB_SG_GLOBAL_BAL_001")).not.toBeInTheDocument();
    const disclosure = screen.getByRole("button", { name: /current view income/i });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveAttribute(
      "aria-controls",
      "portfolio-screen-rail-test-navigation",
    );
    expect(
      screen.getByRole("navigation", { name: "Workbench screen navigation" }),
    ).toHaveAttribute("id", "portfolio-screen-rail-test-navigation");
    expect(screen.getByRole("link", { name: /income and activity booked income/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("group", { name: "Primary workspaces" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all workspaces/i })).toHaveAttribute(
      "aria-controls",
      "portfolio-screen-rail-test-workspace-directory",
    );
    expect(screen.queryByRole("link", { name: /positions valuation/i })).not.toBeInTheDocument();
  });

  it("keeps every disclosure relationship unique across multiple rail instances", () => {
    const modeItems = [
      {
        key: "overview",
        label: "Overview",
        detail: "Advisor priorities",
        active: true,
        href: "/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001",
      },
      {
        key: "suitability",
        label: "Suitability",
        detail: "Mandate fit",
        active: false,
        href: "/proposals?portfolioId=PB_SG_GLOBAL_BAL_001&mode=suitability",
      },
    ];

    const { container } = render(
      <>
        <PortfolioScreenRailComponent
          portfolioId="PB_SG_GLOBAL_BAL_001"
          activeScreen="advisory"
          relationshipIdBase="primary-advisory-rail"
          modeItems={modeItems}
        />
        <PortfolioScreenRailComponent
          portfolioId="PB_SG_GLOBAL_BAL_001"
          activeScreen="advisory"
          relationshipIdBase="secondary-advisory-rail"
          modeItems={modeItems}
        />
      </>,
    );

    const controlledIds = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-controls"))
      .filter((id): id is string => Boolean(id));
    expect(controlledIds).toEqual([
      "primary-advisory-rail-navigation",
      "primary-advisory-rail-workspace-directory",
      "primary-advisory-rail-workflow-directory",
      "secondary-advisory-rail-navigation",
      "secondary-advisory-rail-workspace-directory",
      "secondary-advisory-rail-workflow-directory",
    ]);
    expect(new Set(controlledIds).size).toBe(controlledIds.length);
    for (const controlledId of controlledIds) {
      expect(container.querySelectorAll(`#${controlledId}`)).toHaveLength(1);
    }
  });

  it("opens with native button behavior and closes after destination selection", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    const disclosure = screen.getByRole("button", { name: /current view income/i });
    fireEvent.click(disclosure);

    const navigation = screen.getByRole("navigation", {
      name: "Workbench screen navigation",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(navigation).toHaveAttribute("data-navigation-state", "expanded");

    fireEvent.click(screen.getByRole("button", { name: /all workspaces/i }));
    fireEvent.click(within(navigation).getByRole("link", { name: /positions/i }));

    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveFocus();
    expect(
      screen.getByRole("navigation", { name: "Workbench screen navigation" }),
    ).toHaveAttribute("data-navigation-state", "collapsed");
  });

  it("returns nested navigation to its closed default when the compact rail closes", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="advisory"
        modeNavigationLabel="Advisory lifecycle navigation"
        modeItems={[
          {
            key: "overview",
            label: "Overview",
            detail: "Advisor priorities",
            active: true,
            href: "/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001",
          },
          {
            key: "suitability",
            label: "Suitability",
            detail: "Mandate fit",
            active: false,
            href: "/proposals?portfolioId=PB_SG_GLOBAL_BAL_001&mode=suitability",
          },
        ]}
      />,
    );

    const railDisclosure = screen.getByRole("button", {
      name: /current view overview/i,
    });
    fireEvent.click(railDisclosure);

    const allWorkspaces = screen.getByRole("button", { name: /all workspaces/i });
    const changeStep = screen.getByRole("button", {
      name: /change workflow step/i,
    });
    fireEvent.click(allWorkspaces);
    fireEvent.click(changeStep);

    expect(allWorkspaces).toHaveAttribute("aria-expanded", "true");
    expect(changeStep).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /positions valuation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Suitability" })).toBeInTheDocument();

    fireEvent.click(railDisclosure);
    expect(railDisclosure).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(railDisclosure);
    expect(screen.getByRole("button", { name: /all workspaces/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.getByRole("button", { name: /change workflow step/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /positions valuation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Suitability" })).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the disclosure control", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    const disclosure = screen.getByRole("button", { name: /current view income/i });
    fireEvent.click(disclosure);
    const performanceLink = screen.getByRole("link", { name: /performance/i });
    performanceLink.focus();
    fireEvent.keyDown(performanceLink, { key: "Escape" });

    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveFocus();
  });

  it("reveals the grouped workspace directory and restores disclosure focus on Escape", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    const allWorkspaces = screen.getByRole("button", { name: /all workspaces/i });
    fireEvent.click(allWorkspaces);

    expect(allWorkspaces).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Portfolio records")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Advice and proposals")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /income and activity booked income/i }),
    ).toHaveLength(1);
    const positionsLink = screen.getByRole("link", { name: /positions valuation/i });
    expect(positionsLink).toHaveAttribute(
      "href",
      "/positions?portfolioId=PB_SG_GLOBAL_BAL_001&period=YTD",
    );

    positionsLink.focus();
    fireEvent.keyDown(positionsLink, { key: "Escape" });

    expect(allWorkspaces).toHaveAttribute("aria-expanded", "false");
    expect(allWorkspaces).toHaveFocus();
    expect(screen.queryByRole("link", { name: /positions valuation/i })).not.toBeInTheDocument();
  });

  it("carries the source-confirmed date, period, and currency across screen links", () => {
    window.history.replaceState(
      {},
      "",
      "/income?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-08-21&period=YTD&reportingCurrency=SGD",
    );

    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /all workspaces/i }));
    expect(screen.getByRole("link", { name: /positions valuation/i })).toHaveAttribute(
      "href",
      "/positions?portfolioId=PB_SG_GLOBAL_BAL_001&asOfDate=2026-08-21&period=YTD&reportingCurrency=SGD",
    );
  });

  it.each([
    "/income?portfolioId=PB_SG_GLOBAL_BAL_001&portfolioId=PB_OTHER_001",
    "/income?portfolioId=PB_OTHER_001&period=YTD",
  ])("blocks navigation for conflicting review context %s", (href) => {
    window.history.replaceState({}, "", href);

    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Review context needs attention",
    );
    expect(
      screen.queryByRole("navigation", { name: "Workbench screen navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /performance/i })).not.toBeInTheDocument();
  });

  it("keeps only the current workflow step visible until the advisor changes it", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="advisory"
        modeNavigationLabel="Advisory lifecycle navigation"
        modeItems={[
          {
            key: "overview",
            label: "Overview",
            detail: "Advisor priorities",
            active: true,
            href: "/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001",
          },
          {
            key: "suitability",
            label: "Suitability",
            detail: "Mandate fit",
            active: false,
            href: "/proposals?portfolioId=PB_SG_GLOBAL_BAL_001&mode=suitability",
          },
        ]}
      />,
    );

    const workflow = screen.getByRole("group", {
      name: "Advisory lifecycle navigation",
    });
    expect(within(workflow).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(workflow).queryByRole("link", { name: "Suitability" })).not.toBeInTheDocument();

    const changeStep = within(workflow).getByRole("button", {
      name: /change workflow step/i,
    });
    fireEvent.click(changeStep);
    const suitability = within(workflow).getByRole("link", { name: "Suitability" });
    expect(suitability).toBeInTheDocument();

    suitability.focus();
    fireEvent.keyDown(suitability, { key: "Escape" });
    expect(changeStep).toHaveFocus();
    expect(changeStep).toHaveAttribute("aria-expanded", "false");
  });

  it("returns focus to the visible workflow control after a desktop mode decision", () => {
    const onSelect = vi.fn();
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="performance"
        modeNavigationLabel="Performance surface navigation"
        modeItems={[
          {
            key: "summary",
            label: "Performance Overview",
            detail: "Portfolio outcomes",
            active: true,
            onSelect: vi.fn(),
          },
          {
            key: "analysis",
            label: "Performance Analysis",
            detail: "Attribution and diagnostics",
            active: false,
            onSelect,
          },
        ]}
      />,
    );

    const workflow = screen.getByRole("group", {
      name: "Performance surface navigation",
    });
    const changeStep = within(workflow).getByRole("button", {
      name: /change workflow step/i,
    });
    fireEvent.click(changeStep);
    fireEvent.click(
      within(workflow).getByRole("button", { name: "Performance Analysis" }),
    );

    expect(onSelect).toHaveBeenCalledOnce();
    expect(changeStep).toHaveFocus();
    expect(changeStep).toHaveAttribute("aria-expanded", "false");
  });

  it("counts only actionable workflow steps while retaining unavailable discovery", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="advisory"
        modeNavigationLabel="Advisory lifecycle navigation"
        modeItems={[
          {
            key: "overview",
            label: "Overview",
            detail: "Advisor priorities",
            active: true,
            href: "/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001",
          },
          {
            key: "suitability",
            label: "Suitability",
            detail: "Mandate fit",
            active: false,
            disabled: true,
            title: "Suitability is not available for this portfolio.",
          },
          {
            key: "proposal",
            label: "Proposal review",
            detail: "Advice approval",
            active: false,
            href: "/proposals?portfolioId=PB_SG_GLOBAL_BAL_001",
          },
        ]}
      />,
    );

    const workflow = screen.getByRole("group", {
      name: "Advisory lifecycle navigation",
    });
    const changeStep = within(workflow).getByRole("button", {
      name: /change workflow step 1 available step/i,
    });
    fireEvent.click(changeStep);

    expect(within(workflow).getByRole("link", { name: "Proposal review" })).toBeInTheDocument();
    expect(within(workflow).getByRole("button", { name: "Suitability" })).toBeDisabled();
  });

  it("does not offer a workflow-change action when every alternative is unavailable", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="advisory"
        modeNavigationLabel="Advisory lifecycle navigation"
        modeItems={[
          {
            key: "overview",
            label: "Overview",
            detail: "Advisor priorities",
            active: true,
            href: "/recommendations?portfolioId=PB_SG_GLOBAL_BAL_001",
          },
          {
            key: "suitability",
            label: "Suitability",
            detail: "Mandate fit",
            active: false,
            disabled: true,
          },
          {
            key: "diagnostics",
            label: "Diagnostics",
            detail: "Supporting evidence",
            active: false,
          },
        ]}
      />,
    );

    const workflow = screen.getByRole("group", {
      name: "Advisory lifecycle navigation",
    });
    expect(within(workflow).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(workflow).queryByRole("button", { name: /change workflow step/i }),
    ).not.toBeInTheDocument();
    expect(within(workflow).queryByText("Suitability")).not.toBeInTheDocument();
    expect(within(workflow).queryByText("Diagnostics")).not.toBeInTheDocument();
  });

  it("identifies the active nested workspace and runs its supported action", () => {
    const onSelect = vi.fn();
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="manage"
        modeNavigationLabel="Manage workspace navigation"
        modeItems={[
          {
            key: "overview",
            label: "Overview",
            detail: "Operating posture",
            active: false,
            onSelect: vi.fn(),
          },
          {
            key: "mandate",
            label: "Mandate health",
            detail: "Mandate controls and exceptions",
            active: true,
            onSelect,
          },
        ]}
      />,
    );

    const disclosure = screen.getByRole("button", { name: /current view mandate health/i });
    expect(disclosure).toHaveAccessibleName(
      /current view mandate health mandate management · mandate controls and exceptions/i,
    );
    fireEvent.click(disclosure);
    fireEvent.click(screen.getByRole("button", { name: "Mandate health" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
  });

  it("builds source-backed portfolio links without losing the active business task", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    openPortfolioContextOptions();
    const option = screen.getByRole("link", { name: /Income Mandate CIF_SG_002/i });

    expect(option).toHaveAttribute(
      "href",
      "/income?portfolioId=PB_SG_INCOME_002&period=YTD",
    );
    fireEvent.click(option);
    expect(window.sessionStorage.getItem("lotus:advisor-book-context-focus")).toBe("true");
  });

  it("refreshes portfolio links when the active task query changes", () => {
    usePathnameMock.mockReturnValue("/performance");
    window.history.replaceState(
      {},
      "",
      "/performance?mode=summary&period=YTD&portfolioId=PB_SG_GLOBAL_BAL_001",
    );
    const { rerender } = render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="performance"
      />,
    );
    openPortfolioContextOptions();

    expect(
      screen.getByRole("link", { name: /Income Mandate CIF_SG_002/i }),
    ).toHaveAttribute(
      "href",
      "/performance?portfolioId=PB_SG_INCOME_002&period=YTD&mode=summary",
    );

    window.history.replaceState(
      {},
      "",
      "/performance?mode=risk&period=YTD&portfolioId=PB_SG_GLOBAL_BAL_001",
    );
    rerender(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="performance"
      />,
    );

    expect(
      screen.getByRole("link", { name: /Income Mandate CIF_SG_002/i }),
    ).toHaveAttribute(
      "href",
      "/performance?portfolioId=PB_SG_INCOME_002&period=YTD&mode=risk",
    );
  });

  it("loads own-book options only when the advisor opens portfolio context", () => {
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    expect(useAdvisorBookMock).not.toHaveBeenCalled();

    openPortfolioContextOptions();

    expect(useAdvisorBookMock).toHaveBeenCalledOnce();
  });

  it("offers an explicit retry when portfolio membership cannot be confirmed", () => {
    useAdvisorBookMock.mockReturnValue({
      loading: false,
      error: new Error("source unavailable"),
      response: null,
      reload: reloadAdvisorBookMock,
    });
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    openPortfolioContextOptions();
    expect(screen.getByText(/switching is unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry portfolios" }));

    expect(reloadAdvisorBookMock).toHaveBeenCalledOnce();
  });

  it("does not request portfolio options while the business date is unconfirmed", () => {
    vi.stubEnv("NEXT_PUBLIC_WORKBENCH_ADVISOR_BOOK_AS_OF_DATE", "");
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    openPortfolioContextOptions();

    expect(useAdvisorBookMock).not.toHaveBeenCalled();
    expect(screen.getByText(/business date is confirmed in My book/i)).toBeInTheDocument();
  });

  it("does not claim membership when the selected portfolio is outside the returned book page", () => {
    render(
      <PortfolioScreenRail portfolioId="UNCONFIRMED" activeScreen="income" />,
    );

    openPortfolioContextOptions();
    expect(screen.getByText(/not confirmed in the returned own-book page/i)).toBeInTheDocument();
  });

  it("restores keyboard focus after a portfolio context change", () => {
    window.sessionStorage.setItem("lotus:advisor-book-context-focus", "true");
    render(
      <PortfolioScreenRail
        portfolioId="PB_SG_GLOBAL_BAL_001"
        activeScreen="income"
      />,
    );

    expect(screen.getByLabelText("Change portfolio")).toHaveFocus();
    expect(window.sessionStorage.getItem("lotus:advisor-book-context-focus")).toBeNull();
  });
});
