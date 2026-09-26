import React, { act } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ActionLink,
  ActionButton,
  ActionListCard,
  AppPageShell,
  AnalyticsModule,
  AnalyticsRankedList,
  AnalyticsStat,
  AnalyticsTable,
  ContextCard,
  DefinitionList,
  DeferredModulePlaceholder,
  DetailCard,
  DetailDrawer,
  DisclosureToggleButton,
  DegradedStatePanel,
  EmptyStatePanel,
  FieldLabel,
  FilterBar,
  InsightCallout,
  KpiStatTile,
  MainWithSideRailLayout,
  ModuleStatePanel,
  ModeTabs,
  MetricRow,
  PageToolbar,
  Panel,
  ReadinessIndicator,
  ReviewContextStrip,
  SectionBlock,
  SectionLabel,
  SectionHeader,
  SemanticBadge,
  SourceRefreshAction,
  WorkspaceHeader,
  WorkspaceMenuNav,
  WorkbenchDeferredSection,
  WorkbenchChoiceGroup,
  WorkbenchContextNotice,
  WorkbenchInlineRefreshNote,
  WorkbenchRefreshStatus,
  WorkbenchPageContainer,
  WorkbenchPageFrame,
  WorkbenchPageHeader,
  WorkbenchLoadingState,
  WorkbenchRailCard,
  WorkbenchStatusRow,
  WorkbenchSectionStack,
  WorkbenchStatusStrip,
  WorkbenchTaskDirectory,
  WorkbenchSummaryToolbar,
  WorkbenchToolbarPlaceholder,
  WorkbenchSummaryVisualCard,
  WorkbenchSummaryVisualHeading,
  WorkbenchSummaryVisualLabel,
  WorkbenchSummaryVisualMeta,
  WorkbenchSummaryVisualTrack,
  WorkbenchSummaryVisualValue,
  WorkstationPage,
  WorkstationShell,
} from "@/design-system";

describe("design-system components", () => {
  it("renders source-scope guidance as a compact labelled note", () => {
    render(
      <WorkbenchContextNotice
        title="Performance source context"
        body="Analytics use the source valuation date."
      />,
    );

    expect(
      screen.getByTestId("workbench-context-notice"),
    ).toHaveAccessibleName("Performance source context");
    expect(screen.getByText("Analytics use the source valuation date.")).toBeVisible();
  });

  it("renders a keyboard-reachable business task directory with source posture", () => {
    render(
      <WorkbenchTaskDirectory
        ariaLabel="Portfolio management tasks"
        items={[
          {
            key: "mandate",
            title: "Mandate health",
            description: "Review mandate evidence and resolve open items.",
            status: "2 attention items",
            href: "/workbench/PF_1001?mode=mandate",
            actionLabel: "Open mandate health",
          },
        ]}
      />
    );

    const directory = screen.getByRole("navigation", {
      name: "Portfolio management tasks",
    });
    const link = within(directory).getByRole("link", {
      name: /Mandate health.*2 attention items.*Open mandate health/i,
    });

    expect(link).toHaveAttribute("href", "/workbench/PF_1001?mode=mandate");
    expect(within(directory).getByText("Review mandate evidence and resolve open items.")).toBeVisible();
  });

  it("renders the compact workspace header with title and meta", () => {
    render(
        <WorkspaceHeader
          title="Portfolio"
          meta={
            <>
            <SemanticBadge>2 portfolios</SemanticBadge>
            <SemanticBadge tone="success">Catalog live</SemanticBadge>
            </>
          }
        />
    );

    expect(screen.getByRole("heading", { name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByText("2 portfolios")).toHaveClass("semantic-badge");
    expect(screen.getByText("Catalog live")).toHaveClass("semantic-badge-success");
  });

  it("renders a focused workspace switcher with active and disabled states", () => {
    render(
      <WorkspaceMenuNav
        ariaLabel="Workspace Navigation"
        items={[
          { key: "portfolio", label: "Portfolio", href: "/portfolio" },
          { key: "performance", label: "Performance", href: "/performance", active: true },
          { key: "proposal", label: "Proposal", disabled: true },
        ]}
      />
    );

    expect(screen.getByRole("navigation", { name: "Workspace Navigation" })).toBeInTheDocument();
    const disclosure = screen.getByRole("button", {
      name: "Switch workspace. Current workspace Performance",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(screen.getByText("Workspace directory")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Portfolio" })).toHaveAttribute("href", "/portfolio");
    expect(screen.getByRole("link", { name: "Performance" })).toHaveAttribute("aria-current", "page");
    const unavailableProposal = screen.getByText("Proposal");
    expect(unavailableProposal).toHaveAttribute("aria-disabled", "true");
    expect(unavailableProposal.tagName).toBe("SPAN");
    expect(unavailableProposal).not.toHaveAttribute("tabindex");
    expect(screen.queryByText("Available workspaces")).not.toBeInTheDocument();

    screen.getByRole("link", { name: "Portfolio" }).focus();
    fireEvent.keyDown(screen.getByRole("link", { name: "Portfolio" }), { key: "Escape" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveFocus();
  });

  it("restores focus to the workspace trigger after a workspace is selected", () => {
    render(
      <WorkspaceMenuNav
        ariaLabel="Workspace Navigation"
        items={[
          { key: "portfolio", label: "Portfolio", href: "/portfolio", active: true },
          { key: "performance", label: "Performance", href: "/performance" },
        ]}
      />
    );

    const disclosure = screen.getByRole("button", {
      name: "Switch workspace. Current workspace Portfolio",
    });
    fireEvent.click(disclosure);
    const performance = screen.getByRole("link", { name: "Performance" });
    performance.addEventListener("click", (event) => event.preventDefault(), {
      capture: true,
      once: true,
    });
    performance.focus();
    fireEvent.click(performance);

    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveFocus();
  });

  it("resets detail drawer tab selection when reopening the same item", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <DetailDrawer
        open
        kicker="Position"
        title="UST 10Y"
        summaryItems={[{ label: "Weight", value: "4.2%" }]}
        tabs={[
          { key: "summary", label: "Summary", content: <div>Summary content</div> },
          { key: "evidence", label: "Evidence", content: <div>Evidence content</div> },
        ]}
        fullPageHref="/portfolio?position=ust"
        fullPageLabel="Open full record"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(screen.getByRole("tabpanel", { name: "Evidence" })).toHaveTextContent(
      "Evidence content",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <DetailDrawer
        open={false}
        kicker="Position"
        title="UST 10Y"
        summaryItems={[{ label: "Weight", value: "4.2%" }]}
        tabs={[
          { key: "summary", label: "Summary", content: <div>Summary content</div> },
          { key: "evidence", label: "Evidence", content: <div>Evidence content</div> },
        ]}
        fullPageHref="/portfolio?position=ust"
        fullPageLabel="Open full record"
        onClose={onClose}
      />,
    );
    rerender(
      <DetailDrawer
        open
        kicker="Position"
        title="UST 10Y"
        summaryItems={[{ label: "Weight", value: "4.2%" }]}
        tabs={[
          { key: "summary", label: "Summary", content: <div>Summary content</div> },
          { key: "evidence", label: "Evidence", content: <div>Evidence content</div> },
        ]}
        fullPageHref="/portfolio?position=ust"
        fullPageLabel="Open full record"
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("tabpanel", { name: "Summary" })).toHaveTextContent(
      "Summary content",
    );
  });

  it("omits a full-record action when the owning screen cannot supply a governed address", () => {
    render(
      <DetailDrawer
        open
        kicker="Position"
        title="UST 10Y"
        summaryItems={[{ label: "Weight", value: "4.2%" }]}
        tabs={[{ key: "summary", label: "Summary", content: <div>Summary content</div> }]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders core panel and row primitives with shared classes", () => {
    render(
      <Panel>
        <SectionLabel>Summary</SectionLabel>
        <MetricRow label="Positions" value="12" />
      </Panel>
    );

    expect(screen.getByText("Summary")).toHaveClass("pill");
    expect(screen.getByText("Positions")).toHaveClass("metric-row-label");
    expect(screen.getByText("12")).toHaveClass("metric-row-value");
    expect(screen.getByText("12").closest(".metric-row")).toHaveClass("suite-row");
    expect(screen.getByText("12").closest("article")).toHaveClass(
      "section-card",
      "panel-shell",
      "panel-shell-surface-primary",
      "panel-shell-density-default"
    );
  });

  it("supports stacked metric rows for long business identifiers", () => {
    render(
      <MetricRow
        layout="stacked"
        label="Mandate"
        value="MANDATE_PB_SG_GLOBAL_BAL_001"
      />
    );

    expect(screen.getByText("MANDATE_PB_SG_GLOBAL_BAL_001").closest(".metric-row"))
      .toHaveClass("metric-row-stacked");
  });

  it("renders panel surface and density variants through the shared shell contract", () => {
    render(<Panel surface="secondary" density="compact">Secondary panel</Panel>);

    expect(screen.getByText("Secondary panel").closest("article")).toHaveClass(
      "panel-shell-surface-secondary",
      "panel-shell-density-compact"
    );
  });

  it("renders the shared workstation shell with explicit slot structure", () => {
    render(
      <WorkstationPage>
        <WorkstationShell
          sideDensity="comfortable"
          rail={<Panel>Workstation Rail</Panel>}
          main={<Panel>Workstation Main</Panel>}
          side={<Panel>Workstation Side</Panel>}
        />
      </WorkstationPage>
    );

    expect(document.querySelector(".workstation-page")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-both")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-rail")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-main")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-side")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-side-density-comfortable")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-side-comfortable")).toBeTruthy();
  });

  it("renders shared app-shell composition primitives with the workstation contract underneath", () => {
    render(
      <AppPageShell pageKey="performance" className="performance-page">
        <MainWithSideRailLayout
          className="performance-layout"
          rail={<Panel>Rail</Panel>}
          main={<Panel>Main</Panel>}
          side={<Panel>Side</Panel>}
          sideDensity="comfortable"
        />
      </AppPageShell>
    );

    expect(document.querySelector("main.app-page-shell.app-page-shell-performance.performance-page"))
      .toBeTruthy();
    expect(document.querySelector(".main-with-side-rail-layout.performance-layout")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-both")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-rail")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-main")).toBeTruthy();
    expect(document.querySelector(".workstation-shell-side")).toBeTruthy();
  });

  it("renders source-confirmed review context through the shared page shell", () => {
    render(
      <AppPageShell
        pageKey="portfolio"
        reviewContext={{
          portfolioName: "Global Balanced Mandate",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          clientId: "CIF_SG_000184",
          mandateType: "Discretionary",
          bookingCenter: "Singapore",
          businessDate: "10 Apr 2026",
          currency: { kind: "base", value: "USD" },
        }}
      >
        <Panel>Portfolio decisions</Panel>
      </AppPageShell>
    );

    const strip = screen.getByTestId("review-context-strip");
    expect(strip).toHaveAttribute("data-source-state", "confirmed");
    expect(strip).toHaveAccessibleName("Review context");
    expect(screen.getByText("Global Balanced Mandate")).toBeVisible();
    expect(screen.getByText("Discretionary")).toBeVisible();
    expect(screen.getByText("Singapore")).toBeVisible();
    expect(screen.getByText("10 Apr 2026")).toBeVisible();
    expect(screen.getByText("USD")).toBeVisible();
    expect(screen.getByText("Support details").closest("details")).not.toHaveAttribute("open");
    expect(
      Array.from(strip.querySelectorAll<HTMLElement>("[data-context-slot]"), (element) =>
        element.getAttribute("data-context-slot"),
      ),
    ).toEqual([
      "portfolio-name",
      "business-date",
      "currency",
      "mandate",
      "booking-centre",
      "support-details",
    ]);
  });

  it("keeps missing context explicit and copies only confirmed identifiers", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <AppPageShell
        reviewContext={{
          portfolioName: "Global Balanced Mandate",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
          sourceState: "partial",
          notice: {
            label: "Source valuation date",
            message: "Performance is shown at the latest source-supported date.",
            tone: "attention",
          },
        }}
      >
        <Panel>Portfolio decisions</Panel>
      </AppPageShell>
    );

    expect(screen.getByTestId("review-context-strip")).toHaveAttribute(
      "data-source-state",
      "partial"
    );
    expect(screen.getAllByText("Not confirmed")).toHaveLength(5);
    expect(screen.getByText("Performance is shown at the latest source-supported date.")).toBeVisible();

    fireEvent.click(screen.getByText("Support details"));
    const copyPortfolio = screen.getByRole("button", { name: "Copy Portfolio ID" });
    fireEvent.click(copyPortfolio);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("PB_SG_GLOBAL_BAL_001"));
    expect(copyPortfolio).toHaveTextContent("Copied");
    expect(screen.queryByRole("button", { name: "Copy Client ID" })).not.toBeInTheDocument();
  });

  it("clears copied status when the source identity changes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { rerender } = render(
      <ReviewContextStrip
        context={{
          portfolioName: "Global Balanced Mandate",
          portfolioId: "PB_SG_GLOBAL_BAL_001",
        }}
      />,
    );

    fireEvent.click(screen.getByText("Support details"));
    const copyPortfolio = screen.getByRole("button", { name: "Copy Portfolio ID" });
    fireEvent.click(copyPortfolio);
    await waitFor(() => expect(copyPortfolio).toHaveTextContent("Copied"));
    expect(screen.getByText("Portfolio ID copied.")).toBeInTheDocument();

    rerender(
      <ReviewContextStrip
        context={{
          portfolioName: "Income Mandate",
          portfolioId: "PB_SG_INCOME_002",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy Portfolio ID" })).toHaveTextContent("Copy");
    expect(screen.queryByText("Portfolio ID copied.")).not.toBeInTheDocument();
  });

  it("renders the shared workbench page frame with shared header and section stack", () => {
    render(
      <WorkstationPage>
        <WorkbenchPageContainer className="portfolio-page-container">
          <WorkbenchPageFrame
            title="Portfolio"
            subtitle="Front-office portfolio context"
            actions={<SemanticBadge>Catalog live</SemanticBadge>}
          >
            <WorkbenchSectionStack>
              <Panel>Summary Section</Panel>
            </WorkbenchSectionStack>
          </WorkbenchPageFrame>
        </WorkbenchPageContainer>
      </WorkstationPage>
    );

    expect(document.querySelector(".workbench-page-container.portfolio-page-container")).toBeTruthy();
    expect(document.querySelector(".workbench-page-frame")).toBeTruthy();
    expect(document.querySelector(".workbench-page-frame-header.workbench-page-header")).toBeTruthy();
    expect(document.querySelector(".workbench-page-frame-body")).toBeTruthy();
    expect(document.querySelector(".workbench-section-stack")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Portfolio" })).toBeInTheDocument();
    expect(screen.getByText("Catalog live")).toHaveClass("semantic-badge");
  });

  it("renders section blocks with a standardized header and body seam", () => {
    render(
      <SectionBlock
        title="Service State"
        subtitle="Operational posture"
        actions={<button type="button">Refresh</button>}
        headerClassName="owned-section-header"
      >
        <MetricRow label="Portfolio catalog" value="Ready" />
      </SectionBlock>
    );

    expect(document.querySelector(".section-block")).toBeTruthy();
    expect(document.querySelector(".section-block-body")).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Service State section header" }),
    ).toHaveClass("owned-section-header");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByText("Portfolio catalog")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders shared semantic badges, action buttons, and true mode tabs", () => {
    const onChange = vi.fn();
    const onClick = vi.fn();
    const onDisabledClick = vi.fn();

    render(
      <>
        <SemanticBadge tone="warn" emphasis="strong">
          Review
        </SemanticBadge>
        <ActionButton priority="primary" onClick={onClick} aria-label="Copy decision note">
          Copy Note
        </ActionButton>
        <ActionButton priority="primary" disabled onClick={onDisabledClick}>
          Submit Portfolio Bundle
        </ActionButton>
        <ActionButton disabled onClick={onDisabledClick}>
          Refresh Book
        </ActionButton>
        <ActionButton priority="quiet" disabled onClick={onDisabledClick}>
          Clear Selection
        </ActionButton>
        <ActionButton aria-disabled="true" onClick={onDisabledClick}>
          Checking Catalogue
        </ActionButton>
        <ModeTabs
          idBase="workspace-modes"
          value="advisor"
          onChange={onChange}
          ariaLabel="Workspace modes"
          accentModeKey="advisor"
          options={[
            { key: "summary", label: "Summary" },
            { key: "advisor", label: "Advisor Brief" },
          ]}
        />
      </>
    );

    expect(screen.getByText("Review")).toHaveClass("semantic-badge", "semantic-badge-warn", "semantic-badge-strong");
    expect(screen.getByRole("button", { name: "Copy decision note" })).toHaveClass(
      "action-button",
      "action-button-primary"
    );
    expect(screen.getByRole("button", { name: "Submit Portfolio Bundle" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit Portfolio Bundle" })).toHaveClass(
      "action-button",
      "action-button-primary"
    );
    expect(screen.getByRole("button", { name: "Refresh Book" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear Selection" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear Selection" })).toHaveClass(
      "action-button-quiet"
    );
    const ariaDisabledAction = screen.getByRole("button", { name: "Checking Catalogue" });
    expect(ariaDisabledAction).toHaveAttribute("aria-disabled", "true");
    expect(ariaDisabledAction).not.toBeDisabled();
    ariaDisabledAction.focus();
    fireEvent.click(ariaDisabledAction);
    expect(ariaDisabledAction).toHaveFocus();
    expect(onDisabledClick).not.toHaveBeenCalled();
    expect(screen.getByRole("tablist", { name: "Workspace modes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Advisor Brief" })).toHaveAttribute(
      "data-state",
      "selected"
    );
    expect(screen.getByRole("tab", { name: "Advisor Brief" })).toHaveAttribute(
      "aria-controls",
      "workspace-modes-panel-advisor"
    );
    expect(screen.getByRole("tab", { name: "Advisor Brief" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(screen.getByRole("tab", { name: "Advisor Brief" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("summary");

    onChange.mockClear();
    const verticalArrow = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(screen.getByRole("tab", { name: "Summary" }), verticalArrow);
    expect(verticalArrow.defaultPrevented).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Copy decision note" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Portfolio Bundle" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Book" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Selection" }));
    fireEvent.click(screen.getByRole("tab", { name: "Summary" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDisabledClick).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("summary");
  });

  it("keeps a source refresh action focusable while fencing repeated requests", async () => {
    let resolveRefresh!: () => void;
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveRefresh = resolve;
      })
    );
    const view = render(
      <SourceRefreshAction
        refreshScope="portfolio-a:first"
        idleLabel="Retry advisory priorities"
        busyLabel="Checking advisory priorities"
        isRefreshing={false}
        onRefresh={onRefresh}
      />
    );

    const retry = screen.getByRole("button", { name: "Retry advisory priorities" });
    retry.focus();
    fireEvent.click(retry);
    fireEvent.click(retry);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(retry).toHaveFocus();

    view.rerender(
      <SourceRefreshAction
        refreshScope="portfolio-a:first"
        idleLabel="Refresh advisory priorities"
        busyLabel="Checking advisory priorities"
        isRefreshing
        onRefresh={onRefresh}
      />
    );

    const pending = screen.getByRole("button", { name: "Checking advisory priorities" });
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending).not.toBeDisabled();
    expect(pending).toHaveFocus();
    fireEvent.click(pending);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh();
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it("allows the current source scope to refresh while an obsolete scope is still pending", async () => {
    const resolveRefreshes: Array<() => void> = [];
    const onRefresh = vi.fn(
      () => new Promise<void>((resolve) => resolveRefreshes.push(resolve))
    );
    const view = render(
      <SourceRefreshAction
        refreshScope="portfolio-a:first"
        idleLabel="Retry advisory priorities"
        busyLabel="Checking advisory priorities"
        isRefreshing={false}
        onRefresh={onRefresh}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry advisory priorities" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    view.rerender(
      <SourceRefreshAction
        refreshScope="portfolio-b:first"
        idleLabel="Retry advisory priorities"
        busyLabel="Checking advisory priorities"
        isRefreshing={false}
        onRefresh={onRefresh}
      />
    );
    const currentRetry = screen.getByRole("button", { name: "Retry advisory priorities" });
    fireEvent.click(currentRetry);
    fireEvent.click(currentRetry);
    expect(onRefresh).toHaveBeenCalledTimes(2);

    await act(async () => resolveRefreshes[0]?.());
    fireEvent.click(currentRetry);
    expect(onRefresh).toHaveBeenCalledTimes(2);

    await act(async () => resolveRefreshes[1]?.());
    fireEvent.click(currentRetry);
    expect(onRefresh).toHaveBeenCalledTimes(3);
    await act(async () => resolveRefreshes[2]?.());
  });

  it("renders the shared disclosure toggle contract with consistent labels and chevron state", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <DisclosureToggleButton expanded={false} onToggle={onToggle} />
    );

    const button = screen.getByRole("button", { name: "Expand" });
    expect(button).toHaveClass("disclosure-toggle-button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <DisclosureToggleButton
        expanded
        decorative
        className="portfolio-disclosure-toggle"
        collapsedToggleLabel="Expand"
        expandedToggleLabel="Collapse"
      />
    );
    expect(screen.getByText("Collapse")).toHaveClass("disclosure-toggle-button-label");
    expect(document.querySelector(".disclosure-toggle-button-decorative")).toBeTruthy();
  });

  it("renders the shared workbench rail card primitive", () => {
    render(
      <WorkbenchRailCard className="portfolio-context-card">
        <div className="portfolio-card-header">
          <h3 className="portfolio-side-card-title">Portfolio Context</h3>
          <p className="portfolio-card-subtitle">Identity and setup.</p>
        </div>
      </WorkbenchRailCard>
    );

    expect(document.querySelector(".workbench-rail-card.portfolio-context-card")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Portfolio Context" })).toBeInTheDocument();
  });

  it("renders degraded state actions", () => {
    render(
      <DegradedStatePanel
        label="Workspace"
        title="Portfolio unavailable"
        status="Core feed unavailable"
        actions={[{ href: "/performance", label: "Open Performance" }]}
      >
        <p>Upstream services are unavailable.</p>
      </DegradedStatePanel>
    );

    expect(screen.getByText("Portfolio unavailable")).toBeInTheDocument();
    expect(screen.getByText("Core feed unavailable")).toHaveClass("semantic-badge-warn");
    expect(screen.getByRole("link", { name: "Open Performance" })).toHaveAttribute(
      "href",
      "/performance"
    );
  });

  it("renders shared action links with navigation styling", () => {
    render(<ActionLink href="/portfolio">Open Portfolio</ActionLink>);

    expect(screen.getByRole("link", { name: "Open Portfolio" })).toHaveAttribute(
      "href",
      "/portfolio"
    );
    expect(screen.getByRole("link", { name: "Open Portfolio" })).toHaveClass("nav-link");
  });

  it("renders analytics tables with aligned numeric columns and totals", () => {
    render(
      <AnalyticsTable
        className="analysis-table"
        ariaLabel="Allocation summary"
        variant="analysis"
        columns={[
          { key: "bucket", label: "Bucket" },
          { key: "value", label: "Market Value", align: "right" },
          { key: "weight", label: "Weight", align: "right" },
        ]}
        rows={[
          { key: "row-1", cells: ["Equity", "$500,000", "62.5%"] },
          { key: "row-2", cells: ["Cash", "$300,000", "37.5%"] },
        ]}
        footer={["Total", "$800,000", "100%"]}
      />
    );

    expect(screen.getByRole("table", { name: "Allocation summary" })).toBeInTheDocument();
    expect(
      document.querySelector(
        ".analytics-table-frame.analytics-table-variant-analysis.analytics-table-density-comfortable.analysis-table"
      )
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Market Value" })).toBeInTheDocument();
    expect(screen.getByText("$800,000")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("makes an explicitly named scrollable analytics table region keyboard reachable", () => {
    render(
      <AnalyticsTable
        ariaLabel="Projected cash movement schedule"
        scrollRegionLabel="Projected cash movement schedule, horizontally scrollable"
        columns={[{ key: "date", label: "Date" }]}
        rows={[{ key: "row-1", cells: ["31 Dec 2026"] }]}
      />
    );

    const scrollRegion = screen.getByRole("region", {
      name: "Projected cash movement schedule, horizontally scrollable",
    });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    expect(
      screen.getByRole("table", { name: "Projected cash movement schedule" })
    ).toBeInTheDocument();
  });

  it("supports governed widths and pinned context columns without page-specific selectors", () => {
    render(
      <AnalyticsTable
        ariaLabel="Return history"
        scrollRegionLabel="Return history columns"
        tableMinWidth="36rem"
        columns={[
          { key: "period", label: "Period", width: "4.75rem", stickyOffset: 0 },
          {
            key: "window",
            label: "Window",
            width: "8.75rem",
            stickyOffset: "4.75rem",
          },
          {
            key: "portfolio",
            label: "Cumulative Portfolio",
            align: "right",
            headerWrap: true,
          },
        ]}
        rows={[{ key: "row-1", cells: ["Jan", "1-31 Jan 2026", "1.20%"] }]}
      />
    );

    const table = screen.getByRole("table", { name: "Return history" });
    expect(table).toHaveStyle({ minWidth: "36rem", tableLayout: "fixed" });
    expect(screen.getByRole("columnheader", { name: "Period" })).toHaveStyle({
      width: "4.75rem",
      position: "sticky",
      left: "0px",
      zIndex: "3",
    });
    expect(screen.getByRole("columnheader", { name: "Window" })).toHaveStyle({
      width: "8.75rem",
      position: "sticky",
      left: "4.75rem",
      zIndex: "3",
    });
    expect(screen.getByText("Jan")).toHaveStyle({
      position: "sticky",
      left: "0px",
      zIndex: "2",
      backgroundColor: "var(--analytics-table-pinned-background, #ffffff)",
    });
    expect(screen.getByText("Jan").closest("tr")).toHaveStyle({
      "--analytics-table-pinned-background": "#ffffff",
    });
    expect(
      screen.getByRole("columnheader", { name: "Cumulative Portfolio" }),
    ).toHaveStyle({ whiteSpace: "normal", lineHeight: "1.2" });
  });

  it("renders dense analytics tables through the shared frame contract", () => {
    render(
      <AnalyticsTable
        density="compact"
        variant="observation"
        ariaLabel="Dense allocation summary"
        columns={[
          { key: "bucket", label: "Bucket" },
          { key: "value", label: "Market Value", align: "right" },
        ]}
        rows={[{ key: "row-1", cells: ["Equity", "$500,000"] }]}
      />
    );

    expect(screen.getByRole("table", { name: "Dense allocation summary" })).toBeInTheDocument();
    expect(
      document.querySelector(
        ".analytics-table-frame.analytics-table-density-compact.analytics-table-frame-dense.analytics-table-variant-observation"
      )
    ).toBeTruthy();
  });

  it("supports keyboard activation for interactive analytics table rows", () => {
    const onClick = vi.fn();

    render(
      <AnalyticsTable
        ariaLabel="Interactive allocation summary"
        columns={[
          { key: "bucket", label: "Bucket" },
          { key: "value", label: "Market Value", align: "right" },
        ]}
        rows={[
          {
            key: "row-1",
            cells: ["Equity", "500,000 USD"],
            ariaLabel: "Equity row",
            onClick,
          },
        ]}
      />
    );

    fireEvent.keyDown(screen.getByLabelText("Equity row"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders shared empty and loading table states through the table shell", () => {
    const { rerender } = render(
      <AnalyticsTable
        ariaLabel="Portfolio cash ledger"
        variant="portfolio"
        density="compact"
        columns={[
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount", align: "right" },
        ]}
        rows={[]}
        emptyState={{
          title: "No cash movements",
          body: "Booked cash movements will appear once treasury events are published.",
        }}
      />
    );

    expect(screen.getByText("No cash movements")).toHaveClass("analytics-table-state-title");
    expect(
      screen.getByText("Booked cash movements will appear once treasury events are published.")
    ).toHaveClass("analytics-table-state-body");
    expect(
      document.querySelector(
        ".analytics-table-frame.analytics-table-variant-portfolio.analytics-table-density-compact"
      )
    ).toBeTruthy();

    rerender(
      <AnalyticsTable
        ariaLabel="Portfolio cash ledger"
        variant="portfolio"
        density="compact"
        columns={[
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount", align: "right" },
        ]}
        rows={[]}
        loadingState={{
          title: "Loading cash ledger",
          body: "Cash ledger rows are loading for the selected horizon.",
        }}
      />
    );

    expect(screen.getByText("Loading cash ledger")).toBeInTheDocument();
    expect(screen.getByText("Cash ledger rows are loading for the selected horizon.")).toBeInTheDocument();
  });

  it("renders analytics stats with semantic tone and business tooltip", async () => {
    const onClick = vi.fn();

    render(
      <AnalyticsStat
        label="Book Readiness"
        value="Partial"
        support="1 active exception"
        valueTone="warn"
        definition="Operational readiness based on holdings coverage and reporting status."
        onClick={onClick}
      />
    );

    fireEvent.mouseOver(screen.getByText("Book Readiness"));
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText(/operational readiness based on holdings coverage/i)).toBeInTheDocument();
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(onClick).toHaveBeenCalled();
  });

  it("renders modular page primitives for toolbar, section header, callouts, and context", () => {
    render(
      <>
        <PageToolbar>
          <FilterBar>
            <button type="button">Filters</button>
          </FilterBar>
        </PageToolbar>
        <SectionHeader title="Holdings" subtitle="As of 28 Mar 2026 in USD" actions={<button type="button">Export</button>} />
        <KpiStatTile label="AUM" value="1,250,000 USD" support="As of 28 Mar 2026" />
        <ReadinessIndicator label="Pricing" status="Partial" tone="warn" href="#pricing" />
        <InsightCallout title="Pricing not yet published" detail="Current holdings are not fully valued." severity="warning" href="#portfolio-attention" />
        <EmptyStatePanel
          title="No holdings yet"
          body="The holdings inventory is empty."
          hint="Book a trade to populate the book."
          why={{ body: "Holdings require booked positions or funded balances." }}
        />
        <ModuleStatePanel
          state="partial"
          title="Partial data"
          body="Some values are available."
          hint="Pricing is still missing for one holding."
          why={{ body: "Allocation requires valued holdings." }}
        />
        <ContextCard
          title="Portfolio Context"
          subtitle="Executive identity and book setup details."
          groups={[
            {
              key: "identity",
              title: "Identity",
              facts: [{ label: "Portfolio", value: "PORT_1" }],
            },
          ]}
        />
        <DetailCard title="Operational Detail" subtitle="Current source-backed fields.">
          <DefinitionList
            ariaLabel="Operational detail"
            items={[{ label: "Latest transaction", value: "24 Feb 2026" }]}
          />
        </DetailCard>
        <ActionListCard
          title="Next Actions"
          subtitle="Recommended workflow sequence."
          items={[
            {
              key: "fund",
              sequence: 1,
              title: "Fund portfolio",
              impact: "Cash is required before trades can settle.",
              target: "Target: Operations",
              href: "/workbench",
              ctaLabel: "Fund",
              recommended: true,
            },
          ]}
        />
      </>
    );

    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Holdings" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No holdings yet", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pricing not yet published")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Partial data", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Portfolio Context")).toBeInTheDocument();
    expect(screen.getByText("Operational Detail")).toBeInTheDocument();
    expect(screen.getByText("Latest transaction")).toHaveClass("workbench-definition-term");
    expect(screen.getByText("24 Feb 2026")).toHaveClass("workbench-definition-value");
    expect(screen.getByText("Fund portfolio")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Why this section is unavailable" }).length
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("toolbar", { name: "Page controls" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pricing readiness: Partial. Open related section.")).toBeInTheDocument();
  });

  it("renders KPI tiles with explicit semantic slots, tone, and density", () => {
    render(
      <KpiStatTile
        label="Book Readiness"
        value="Ready"
        support="0 active exceptions"
        valueTone="success"
        density="compact"
      />
    );

    expect(screen.getByText("Book Readiness")).toHaveAttribute("data-slot", "label");
    expect(screen.getByText("Ready")).toHaveAttribute("data-slot", "value");
    expect(screen.getByText("0 active exceptions")).toHaveAttribute("data-slot", "support");
    expect(screen.getByText("Ready").closest('[data-tone="success"]')).toHaveAttribute(
      "data-density",
      "compact"
    );
  });

  it("renders analytics modules with the shared workbench summary-card contract", () => {
    render(
      <AnalyticsModule
        compact
        surface="secondary"
        title="Shared Summary"
        subtitle="Shared subtitle"
        actions={<button type="button">Module Action</button>}
      >
        <div>Body</div>
      </AnalyticsModule>
    );

    expect(
      document.querySelector(
        ".workbench-summary-card.workbench-summary-card-compact.panel-shell-surface-secondary.panel-shell-density-compact"
      )
    ).toBeTruthy();
    expect(screen.getByText("Shared Summary")).toHaveClass("workbench-summary-card-title");
    expect(screen.getByText("Shared subtitle")).toHaveClass("workbench-summary-card-subtitle");
    expect(screen.getByRole("button", { name: "Module Action" })).toBeInTheDocument();
    const title = screen.getByText("Shared Summary");
    const subtitle = screen.getByText("Shared subtitle");
    const action = screen.getByRole("button", { name: "Module Action" });
    const header = document.querySelector(".workbench-summary-card-header");
    expect(header).toContainElement(title);
    expect(header).not.toContainElement(subtitle);
    expect(title.closest(".MuiBox-root")?.parentElement).toContainElement(action);
  });

  it("renders field labels through the shared typography contract", () => {
    render(<FieldLabel htmlFor="benchmark-select">Benchmark</FieldLabel>);

    expect(screen.getByText("Benchmark")).toHaveClass("workbench-field-label", "ui-text-label");
    expect(screen.getByText("Benchmark").tagName).toBe("LABEL");
    expect(screen.getByText("Benchmark")).toHaveAttribute("for", "benchmark-select");
  });

  it("renders ranked analytics content with shared summary visual typography classes", () => {
    render(
      <AnalyticsRankedList
        title="Highest"
        label="Contribution"
        scale={1}
        rows={[
          {
            key: "row-1",
            title: "Apple Inc",
            subtitle: "Avg. Weight 24.00%",
            value: "1.55%",
            magnitudePct: 1.55,
            tone: "positive",
          },
        ]}
      />
    );

    expect(screen.getByText("Highest")).toHaveClass("workbench-summary-visual-heading");
    expect(screen.getByText("Contribution")).toHaveClass("workbench-summary-visual-meta");
    expect(screen.getByText("Apple Inc")).toHaveClass("workbench-summary-visual-label");
    expect(screen.getByText("Avg. Weight 24.00%")).toHaveClass("workbench-summary-visual-meta");
    expect(screen.getByText("1.55%")).toHaveClass("workbench-summary-visual-value");
  });

  it("renders reusable workbench summary visual primitives with the shared class contract", () => {
    render(
      <>
        <WorkbenchSummaryToolbar>
          <span>Toolbar Item</span>
        </WorkbenchSummaryToolbar>
        <WorkbenchSummaryVisualCard>
          <WorkbenchSummaryVisualHeading>Visual Heading</WorkbenchSummaryVisualHeading>
          <WorkbenchSummaryVisualLabel>Visual Label</WorkbenchSummaryVisualLabel>
          <WorkbenchSummaryVisualMeta>Visual Meta</WorkbenchSummaryVisualMeta>
          <WorkbenchSummaryVisualTrack className="custom-track">
            <span>Track Body</span>
          </WorkbenchSummaryVisualTrack>
          <WorkbenchSummaryVisualValue>123</WorkbenchSummaryVisualValue>
        </WorkbenchSummaryVisualCard>
      </>
    );

    expect(document.querySelector(".workbench-summary-toolbar")).toBeTruthy();
    expect(document.querySelector(".workbench-summary-visual-card")).toBeTruthy();
    expect(screen.getByText("Visual Heading")).toHaveClass("workbench-summary-visual-heading");
    expect(screen.getByText("Visual Label")).toHaveClass("workbench-summary-visual-label");
    expect(screen.getByText("Visual Meta")).toHaveClass("workbench-summary-visual-meta");
    expect(screen.getByText("123")).toHaveClass("workbench-summary-visual-value");
    expect(document.querySelector(".custom-track")).toBeTruthy();
  });

  it("renders the shared neutral workbench page header with title, subtitle, and actions", () => {
    render(
      <WorkbenchPageHeader
        title="Performance Workbench"
        subtitle="Benchmark-aware portfolio performance, attribution, and contribution analysis"
        actions={<button type="button">Header Action</button>}
      />
    );

    expect(screen.getByRole("heading", { name: "Performance Workbench" })).toHaveClass(
      "workbench-page-header-title"
    );
    expect(
      screen.getByText(
        "Benchmark-aware portfolio performance, attribution, and contribution analysis"
      )
    ).toHaveClass("workbench-page-header-subtitle");
    expect(screen.getByRole("button", { name: "Header Action" })).toBeInTheDocument();
    expect(document.querySelector(".workbench-page-header-actions")).toBeTruthy();
  });

  it("renders the shared workbench status strip with consistent item structure", () => {
    render(
      <WorkbenchStatusStrip
        label="Capability status"
        className="performance-trust-strip"
        gridClassName="performance-trust-strip-grid"
        itemClassName="performance-trust-item"
        itemLabelClassName="performance-trust-item-label"
        itemBodyClassName="performance-trust-item-body"
        itemChipClassName="performance-trust-item-chip"
        itemSupportClassName="performance-trust-item-support"
        items={[
          {
            label: "Benchmark",
            value: "Assigned",
            support: "Relative analytics are active.",
            tone: "success",
          },
          {
            label: "Evidence",
            value: "Pending",
            support: "Evidence is not yet exposed.",
            tone: "default",
          },
        ]}
      />
    );

    expect(screen.getByLabelText("Capability status")).toBeInTheDocument();
    expect(screen.getByText("Benchmark")).toHaveClass("performance-trust-item-label");
    expect(screen.getByText("Assigned")).toHaveClass("performance-trust-item-chip");
    expect(screen.getByText("Relative analytics are active.")).toHaveClass(
      "performance-trust-item-support"
    );
    expect(screen.getByText("Pending")).toHaveClass("performance-trust-item-chip");
  });

  it("renders the shared workbench status row with compact status chips", () => {
    render(
      <WorkbenchStatusRow
        label="Observation status"
        className="performance-observation-strip"
        items={[
          { value: "As of 2026-03-29" },
          { value: "USD" },
          { value: "2 observations", tone: "success" },
          { value: "Relative measurement", tone: "success" },
        ]}
      />
    );

    expect(screen.getByRole("group", { name: "Observation status" })).toBeInTheDocument();
    expect(screen.getByText("As of 2026-03-29")).toHaveClass("semantic-badge");
    expect(screen.getByText("2 observations")).toHaveClass("semantic-badge", "semantic-badge-success");
    expect(screen.getByText("Relative measurement")).toHaveClass("semantic-badge", "semantic-badge-success");
  });

  it("renders a reusable deferred workbench section with shared heading structure", () => {
    render(
      <WorkbenchDeferredSection
        className="performance-summary-context-section"
        title="Return vs Benchmark"
        subtitle="How the portfolio tracked against the selected benchmark over the current period."
        loadingTitle="Loading return path"
        loadingMessage="Return path is loading after first paint."
      >
        <div>Deferred content</div>
      </WorkbenchDeferredSection>
    );

    expect(document.querySelector(".performance-summary-context-section")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Return vs Benchmark" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "How the portfolio tracked against the selected benchmark over the current period."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Loading return path")).toBeInTheDocument();
    expect(screen.getByText("Return path is loading after first paint.")).toBeInTheDocument();
  });

  it("renders the shared deferred placeholder class contract with optional extension classes", () => {
    render(
      <DeferredModulePlaceholder
        title="Loading analysis"
        message="Analysis is loading after first paint."
        className="performance-analysis-loading"
      />
    );

    const placeholder = screen.getByRole("status");
    expect(placeholder).toHaveClass(
      "deferred-module-placeholder",
      "workbench-deferred-placeholder",
      "performance-analysis-loading"
    );
    expect(within(placeholder).getByText("Loading analysis")).toBeInTheDocument();
    expect(within(placeholder).getByText("Analysis is loading after first paint.")).toBeInTheDocument();
  });

  it("renders exclusive business choices as a radio group with one keyboard tab stop", () => {
    const onChange = vi.fn();

    render(
      <WorkbenchChoiceGroup
        value="summary"
        onChange={onChange}
        ariaLabel="Workbench mode"
        className="performance-mode-switch"
        options={[
          { key: "summary", label: "Summary" },
          { key: "analysis", label: "Analysis" },
          { key: "evidence", label: "Evidence" },
        ]}
      />
    );

    const group = screen.getByRole("radiogroup", { name: "Workbench mode" });
    expect(group).toHaveClass("performance-mode-switch");
    expect(screen.getByRole("radio", { name: "Summary" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Summary" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Analysis" })).toHaveAttribute("tabindex", "-1");

    fireEvent.click(screen.getByRole("radio", { name: "Evidence" }));
    expect(onChange).toHaveBeenCalledWith("evidence");
  });

  it("supports disabled exclusive choices and skips them during arrow-key navigation", () => {
    function ChoiceFixture() {
      const [value, setValue] = React.useState("asset_class");
      return (
        <WorkbenchChoiceGroup
          value={value}
          onChange={setValue}
          ariaLabel="Allocation dimensions"
          options={[
            { key: "asset_class", label: "Asset Class" },
            { key: "region", label: "Region", disabled: true, title: "Region pending source support" },
            { key: "sector", label: "Sector" },
          ]}
        />
      );
    }

    render(
      <ChoiceFixture />
    );

    const assetClass = screen.getByRole("radio", { name: "Asset Class" });
    expect(assetClass).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: "Region" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Region" })).toHaveAttribute(
      "title",
      "Region pending source support"
    );

    fireEvent.keyDown(assetClass, { key: "ArrowRight" });
    const sector = screen.getByRole("radio", { name: "Sector" });
    expect(sector).toHaveFocus();
    expect(sector).toHaveAttribute("aria-checked", "true");
    expect(sector).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(sector, { key: "Home" });
    expect(assetClass).toHaveFocus();
    expect(assetClass).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(assetClass, { key: "End" });
    expect(sector).toHaveFocus();
    expect(sector).toHaveAttribute("aria-checked", "true");
  });

  it("renders the shared workbench toolbar placeholder with generic field widths", () => {
    render(
      <WorkbenchToolbarPlaceholder
        className="portfolio-workspace-toolbar"
        contextMessage="Loading workspace controls…"
        fields={[
          { key: "as-of", label: "As of" },
          { key: "view", label: "View", width: "wide" },
          { key: "period", label: "Period", width: "period" },
        ]}
      />
    );

    expect(document.querySelector(".workbench-toolbar-placeholder.portfolio-workspace-toolbar"))
      .toBeTruthy();
    expect(document.querySelector(".workbench-toolbar-placeholder-row")).toBeTruthy();
    expect(document.querySelectorAll(".workbench-toolbar-placeholder-field")).toHaveLength(3);
    expect(screen.getByText("As of")).toHaveClass("workbench-toolbar-placeholder-label");
    expect(document.querySelector(".workbench-toolbar-placeholder-control-wide")).toBeTruthy();
    expect(document.querySelector(".workbench-toolbar-placeholder-control-period")).toBeTruthy();
    expect(screen.getByText("Loading workspace controls…")).toBeInTheDocument();
  });

  it("renders the shared workbench loading state with explicit copy and skeleton", () => {
    render(
      <WorkbenchLoadingState
        title="Loading transactions"
        message="Transaction ledger detail is loading for the selected window."
        rows={5}
      />
    );

    const loadingState = screen.getByRole("status");
    expect(loadingState).toHaveClass("workbench-loading-state");
    expect(within(loadingState).getByText("Loading transactions")).toBeInTheDocument();
    expect(
      within(loadingState).getByText("Transaction ledger detail is loading for the selected window.")
    ).toBeInTheDocument();
    expect(loadingState.querySelector(".module-skeleton")).toBeTruthy();
  });

  it("renders the shared inline refresh note with polite status semantics", () => {
    render(<WorkbenchInlineRefreshNote message="Refreshing transactions…" />);

    const refreshNote = screen.getByRole("status");
    expect(refreshNote).toHaveClass("workbench-inline-refresh-note");
    expect(refreshNote).toHaveTextContent("Refreshing transactions…");
  });

  it("keeps pending refresh context programmatically available without a recovery action", () => {
    render(
      <WorkbenchRefreshStatus
        kind="pending"
        eyebrow="Updating source analysis"
        title="Confirming the selected performance view"
        message="The source-confirmed view remains available."
        requestedContext="3Y"
        confirmedContext="YTD · NET returns"
      />
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(within(status).getByText("Requested")).toBeInTheDocument();
    expect(within(status).getByText("3Y")).toBeInTheDocument();
    expect(within(status).getByText("Source-confirmed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry performance selection/i }))
      .not.toBeInTheDocument();
  });

  it("announces failed refreshes and exposes one bounded retry action", () => {
    const onRetry = vi.fn();
    render(
      <WorkbenchRefreshStatus
        kind="failed"
        eyebrow="Selection not applied"
        title="Performance selection could not be confirmed"
        message="The last source-confirmed view remains in place."
        requestedContext="3Y"
        confirmedContext="YTD · NET returns"
        onRetry={onRetry}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    const retry = within(alert).getByRole("button", {
      name: "Retry performance selection",
    });
    expect(retry).toHaveTextContent("Retry selection");
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not repeat context when a refresh failed without a new selection", () => {
    render(
      <WorkbenchRefreshStatus
        kind="failed"
        eyebrow="Portfolio review"
        title="Portfolio detail could not be refreshed"
        message="The previous portfolio view remains active while the refresh is retried."
        confirmedContext="28 Mar 2026 · USD · 30D"
      />
    );

    const alert = screen.getByRole("alert");
    expect(within(alert).queryByText("Requested")).not.toBeInTheDocument();
    expect(within(alert).getByText("Source-confirmed")).toBeInTheDocument();
    expect(within(alert).getByText("28 Mar 2026 · USD · 30D"))
      .toBeInTheDocument();
  });

  it("announces a compact source-confirmed refresh without moving focus or repeating context", () => {
    render(<button type="button">Continue analysis</button>);
    const continuingTask = screen.getByRole("button", { name: "Continue analysis" });
    continuingTask.focus();

    render(
      <WorkbenchRefreshStatus
        kind="confirmed"
        eyebrow="Source analysis updated"
        title="Performance selection confirmed"
        confirmedContext="3Y · NET returns"
      />
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("data-state", "confirmed");
    expect(within(status).getByText("3Y · NET returns")).toBeInTheDocument();
    expect(within(status).queryByText("Requested")).not.toBeInTheDocument();
    expect(within(status).queryByText("Source-confirmed")).not.toBeInTheDocument();
    expect(continuingTask).toHaveFocus();
    expect(screen.queryByRole("button", { name: /Retry performance selection/i }))
      .not.toBeInTheDocument();
  });

  it("can defer content without rendering a duplicate wrapper header", async () => {
    render(
      <WorkbenchDeferredSection
        className="performance-summary-driver-section"
        title="Performance Drivers"
        subtitle="Top contributors and detractors for the current performance outcome."
        loadingTitle="Loading contributors"
        loadingMessage="Contributor ranking is loading after first paint."
        deferHeader
        hideHeader
        placeholder={null}
      >
        <div>Deferred driver content</div>
      </WorkbenchDeferredSection>
    );

    expect(document.querySelector(".performance-summary-driver-section")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Performance Drivers" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Deferred driver content")).toBeInTheDocument();
    });
  });
});
