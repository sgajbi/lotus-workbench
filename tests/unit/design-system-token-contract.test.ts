import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { lotusThemeTokens } from "@/design-system/theme/tokens";

const governedPaletteDeclarationPattern =
  /--(?:bg(?:-[a-z0-9-]+)?|panel(?:-[a-z0-9-]+)?|surface-[a-z0-9-]+|text(?:-[a-z0-9-]+)?|border(?:-[a-z0-9-]+)?|brand(?:-[a-z0-9-]+)?|analytic-(?:positive|negative)(?:-soft)?|warn-(?:bg|border|text)|success|danger|status-(?:success|warn|danger|neutral)-bg)\s*:/i;

function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Expected a six-digit hex colour, received ${hex}`);
  }

  const [red, green, blue] = [0, 2, 4]
    .map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lightest = Math.max(foregroundLuminance, backgroundLuminance);
  const darkest = Math.min(foregroundLuminance, backgroundLuminance);

  return (lightest + 0.05) / (darkest + 0.05);
}

function readRootCssVariables(): Record<string, string> {
  const tokenPath = path.resolve(__dirname, "../../src/styles/global/tokens.css");
  const css = fs.readFileSync(tokenPath, "utf8");
  const rootBlockMatch = css.match(/:root(?:\s*,\s*\[data-color-scheme="light"\])?\s*\{([\s\S]*?)\n\}/);
  if (!rootBlockMatch) {
    throw new Error("Could not find :root CSS token block in src/styles/global/tokens.css");
  }

  const variables: Record<string, string> = {};
  const variablePattern = /--([a-z0-9-]+):\s*([^;]+);/gi;

  for (const match of rootBlockMatch[1].matchAll(variablePattern)) {
    variables[`--${match[1]}`] = match[2].trim();
  }

  return variables;
}

function readImportedGlobalLayers(): Array<{ fileName: string; css: string }> {
  const globalsPath = path.resolve(__dirname, "../../src/app/globals.css");
  const globalsCss = fs.readFileSync(globalsPath, "utf8");
  const importPattern = /@import\s+["']([^"']+)["'];/g;

  return [...globalsCss.matchAll(importPattern)].map((match) => {
    const importedPath = path.resolve(path.dirname(globalsPath), match[1]);
    return {
      fileName: path.basename(importedPath),
      css: fs.readFileSync(importedPath, "utf8"),
    };
  });
}

describe("design-system token contract", () => {
  it("exposes the required grouped token domains for RFC-0021 slice 1", () => {
    expect(lotusThemeTokens).toMatchObject({
      color: expect.any(Object),
      colorSchemes: expect.any(Object),
      typography: expect.any(Object),
      spacing: expect.any(Object),
      radius: expect.any(Object),
      elevation: expect.any(Object),
      focus: expect.any(Object),
      layout: expect.any(Object),
      control: expect.any(Object),
      table: expect.any(Object),
      zIndex: expect.any(Object),
      motion: expect.any(Object),
      breakpoint: expect.any(Object),
    });
    expect(lotusThemeTokens.typography.variant).toMatchObject({
      workspaceTitle: expect.any(Object),
      pageTitle: expect.any(Object),
      sectionTitle: expect.any(Object),
      panelTitle: expect.any(Object),
      bodySmall: expect.any(Object),
      dataLabel: expect.any(Object),
      tableHeader: expect.any(Object),
      metricValueL: expect.any(Object),
      badgeLabel: expect.any(Object),
    });
    expect(lotusThemeTokens.color.surface).toMatchObject({
      primary: expect.any(String),
      secondary: expect.any(String),
      tertiary: expect.any(String),
      interactive: expect.any(String),
      selected: expect.any(String),
      topbar: expect.any(String),
    });
    expect(lotusThemeTokens.color.chart).toMatchObject({
      categorical: expect.any(Object),
      sequential: expect.any(Object),
      diverging: expect.any(Object),
      chrome: expect.any(Object),
    });
    expect(lotusThemeTokens.colorSchemes.light).toBe(lotusThemeTokens.color);
    expect(lotusThemeTokens.motion.duration.fast).toBe("120ms");
    expect(lotusThemeTokens.breakpoint).toMatchObject({
      compact: 420,
      mobile: 640,
      tablet: 768,
      desktop: 1024,
      wide: 1440,
    });
    expect(lotusThemeTokens.zIndex).toMatchObject({
      content: 1,
      pinnedCell: 2,
      pinnedHeader: 3,
      shellHeader: 20,
    });
    expect(lotusThemeTokens.layout).toMatchObject({
      panelPaddingDefault: expect.any(String),
      panelPaddingCompact: expect.any(String),
      panelPaddingDense: expect.any(String),
      workbenchPanelGap: expect.any(String),
      workbenchPanelGapMajor: expect.any(String),
    });
    expect(lotusThemeTokens.metricTile.height).toMatchObject({
      default: expect.any(String),
      compact: expect.any(String),
    });
  });

  it("keeps representative CSS root variables aligned with the shared TypeScript token baseline", () => {
    const cssVariables = readRootCssVariables();

    expect(cssVariables["--bg"]).toBe(lotusThemeTokens.color.surface.canvas);
    expect(cssVariables["--bg-alt"]).toBe(lotusThemeTokens.color.surface.canvasAlt);
    expect(cssVariables["--bg-page"]).toBe(lotusThemeTokens.color.surface.page);
    expect(cssVariables["--bg-foundation"]).toBe(lotusThemeTokens.color.surface.foundation);
    expect(cssVariables["--panel"]).toBe(lotusThemeTokens.color.surface.panel);
    expect(cssVariables["--panel-alt"]).toBe(lotusThemeTokens.color.surface.panelAlt);
    expect(cssVariables["--surface-primary"]).toBe(lotusThemeTokens.color.surface.primary);
    expect(cssVariables["--surface-secondary"]).toBe(lotusThemeTokens.color.surface.secondary);
    expect(cssVariables["--surface-tertiary"]).toBe(lotusThemeTokens.color.surface.tertiary);
    expect(cssVariables["--surface-interactive"]).toBe(lotusThemeTokens.color.surface.interactive);
    expect(cssVariables["--surface-selected"]).toBe(lotusThemeTokens.color.surface.selected);
    expect(cssVariables["--surface-topbar"]).toBe(lotusThemeTokens.color.surface.topbar);
    expect(cssVariables["--text"]).toBe(lotusThemeTokens.color.text.primary);
    expect(cssVariables["--text-muted"]).toBe(lotusThemeTokens.color.text.muted);
    expect(cssVariables["--text-inverse"]).toBe(lotusThemeTokens.color.text.inverse);
    expect(cssVariables["--text-inverse-muted"]).toBe(lotusThemeTokens.color.text.inverseMuted);
    expect(cssVariables["--text-disabled"]).toBe(lotusThemeTokens.color.text.disabled);
    expect(cssVariables["--border"]).toBe(lotusThemeTokens.color.border.default);
    expect(cssVariables["--border-strong"]).toBe(lotusThemeTokens.color.border.strong);
    expect(cssVariables["--border-interactive"]).toBe(lotusThemeTokens.color.border.interactive);
    expect(cssVariables["--brand"]).toBe(lotusThemeTokens.color.brand.base);
    expect(cssVariables["--brand-strong"]).toBe(lotusThemeTokens.color.brand.strong);
    expect(cssVariables["--brand-soft"]).toBe(lotusThemeTokens.color.brand.soft);
    expect(cssVariables["--brand-accent"]).toBe(lotusThemeTokens.color.brand.accent);
    expect(cssVariables["--brand-highlight"]).toBe(lotusThemeTokens.color.brand.highlight);
    expect(cssVariables["--brand-hover"]).toBe(lotusThemeTokens.color.brand.hover);
    expect(cssVariables["--brand-attention"]).toBe(lotusThemeTokens.color.brand.attention);
    expect(cssVariables["--brand-attention-text"]).toBe(
      lotusThemeTokens.color.brand.attentionText
    );
    expect(cssVariables["--analytic-positive"]).toBe(
      lotusThemeTokens.color.semantic.analyticPositive
    );
    expect(cssVariables["--analytic-positive-soft"]).toBe(
      lotusThemeTokens.color.semantic.analyticPositiveSoft
    );
    expect(cssVariables["--analytic-negative"]).toBe(
      lotusThemeTokens.color.semantic.analyticNegative
    );
    expect(cssVariables["--analytic-negative-soft"]).toBe(
      lotusThemeTokens.color.semantic.analyticNegativeSoft
    );
    expect(cssVariables["--chart-categorical-allocation"]).toBe(
      lotusThemeTokens.color.chart.categorical.allocation
    );
    expect(cssVariables["--chart-sequential-high"]).toBe(
      lotusThemeTokens.color.chart.sequential.high
    );
    expect(cssVariables["--chart-diverging-negative"]).toBe(
      lotusThemeTokens.color.chart.diverging.negative
    );
    expect(cssVariables["--warn-bg"]).toBe(lotusThemeTokens.color.statusBackground.warning);
    expect(cssVariables["--warn-border"]).toBe(lotusThemeTokens.color.semantic.warningBorder);
    expect(cssVariables["--success"]).toBe(lotusThemeTokens.color.semantic.success);
    expect(cssVariables["--warn-text"]).toBe(lotusThemeTokens.color.semantic.warning);
    expect(cssVariables["--danger"]).toBe(lotusThemeTokens.color.semantic.danger);
    expect(cssVariables["--status-success-bg"]).toBe(
      lotusThemeTokens.color.statusBackground.success
    );
    expect(cssVariables["--status-warn-bg"]).toBe(
      lotusThemeTokens.color.statusBackground.warning
    );
    expect(cssVariables["--status-danger-bg"]).toBe(
      lotusThemeTokens.color.statusBackground.danger
    );
    expect(cssVariables["--status-neutral-bg"]).toBe(
      lotusThemeTokens.color.statusBackground.neutral
    );
    expect(cssVariables["--space-4"]).toBe(lotusThemeTokens.spacing.step4);
    expect(cssVariables["--space-6"]).toBe(lotusThemeTokens.spacing.step6);
    expect(cssVariables["--space-7"]).toBe(lotusThemeTokens.spacing.step7);
    expect(cssVariables["--space-9"]).toBe(lotusThemeTokens.spacing.step9);
    expect(cssVariables["--radius-control"]).toBe(`${lotusThemeTokens.radius.control}px`);
    expect(cssVariables["--radius-tile"]).toBe(`${lotusThemeTokens.radius.tile}px`);
    expect(cssVariables["--radius-panel"]).toBe(`${lotusThemeTokens.radius.panel}px`);
    expect(cssVariables["--elevation-none"]).toBe(lotusThemeTokens.elevation.none);
    expect(cssVariables["--font-ui"]).toBe(lotusThemeTokens.typography.fontFamily.ui);
    expect(cssVariables["--type-label-size"]).toBe(
      lotusThemeTokens.typography.variant.dataLabel.size
    );
    expect(Number(cssVariables["--type-label-weight"])).toBe(
      lotusThemeTokens.typography.variant.dataLabel.weight
    );
    expect(cssVariables["--type-body-size"]).toBe(
      lotusThemeTokens.typography.variant.body.size
    );
    expect(cssVariables["--type-table-header-size"]).toBe(
      lotusThemeTokens.typography.variant.tableHeader.size
    );
    expect(Number(cssVariables["--type-table-header-weight"])).toBe(
      lotusThemeTokens.typography.variant.tableHeader.weight
    );
    expect(cssVariables["--type-table-cell-size"]).toBe(
      lotusThemeTokens.typography.variant.tableCell.size
    );
    expect(Number(cssVariables["--type-metric-m-weight"])).toBe(
      lotusThemeTokens.typography.variant.metricValueM.weight
    );
    expect(cssVariables["--text-sm"]).toBe(lotusThemeTokens.typography.size.textSm);
    expect(cssVariables["--text-3xl"]).toBe(lotusThemeTokens.typography.size.text3xl);
    expect(cssVariables["--tracking-label"]).toBe(lotusThemeTokens.typography.tracking.label);
    expect(cssVariables["--tracking-table"]).toBe(lotusThemeTokens.typography.tracking.table);
    expect(cssVariables["--tracking-badge"]).toBe(lotusThemeTokens.typography.tracking.badge);
    expect(cssVariables["--workbench-rail-width"]).toBe(lotusThemeTokens.layout.workbenchRailWidth);
    expect(cssVariables["--workbench-card-padding"]).toBe(
      lotusThemeTokens.layout.workbenchCardPadding
    );
    expect(cssVariables["--panel-padding-default"]).toBe(lotusThemeTokens.layout.panelPaddingDefault);
    expect(cssVariables["--panel-padding-compact"]).toBe(lotusThemeTokens.layout.panelPaddingCompact);
    expect(cssVariables["--panel-padding-dense"]).toBe(lotusThemeTokens.layout.panelPaddingDense);
    expect(cssVariables["--panel-gap-default"]).toBe(lotusThemeTokens.layout.workbenchPanelGap);
    expect(cssVariables["--panel-gap-major"]).toBe(lotusThemeTokens.layout.workbenchPanelGapMajor);
    expect(cssVariables["--metric-tile-height-default"]).toBe(lotusThemeTokens.metricTile.height.default);
    expect(cssVariables["--metric-tile-height-compact"]).toBe(lotusThemeTokens.metricTile.height.compact);
    expect(cssVariables["--focus-ring"]).toBe(lotusThemeTokens.focus.ring);
    expect(cssVariables["--motion-duration-fast"]).toBe(
      lotusThemeTokens.motion.duration.fast
    );
    expect(cssVariables["--motion-easing-standard"]).toBe(
      lotusThemeTokens.motion.easing.standard
    );
    expect(cssVariables["--breakpoint-desktop"]).toBe(
      `${lotusThemeTokens.breakpoint.desktop}px`
    );
    expect(Number(cssVariables["--z-index-pinned-header"])).toBe(
      lotusThemeTokens.zIndex.pinnedHeader
    );
  });

  it("keeps compatibility typography names as identity aliases of canonical variants", () => {
    const variants = lotusThemeTokens.typography.variant;

    expect(variants.cardTitle).toBe(variants.panelTitle);
    expect(variants.secondary).toBe(variants.bodySmall);
    expect(variants.eyebrow).toBe(variants.microLabel);
    expect(variants.metricValueL).toBe(variants.metricValue);
    expect(variants.metricValueM).toBe(variants.metricValueCompact);
    expect(variants.button).toBe(variants.buttonLabel);
    expect(variants.badge).toBe(variants.badgeLabel);
  });

  it("keeps advisor-facing text and semantic states at WCAG AA contrast", () => {
    const { color } = lotusThemeTokens;
    const requiredPairs = [
      [color.text.primary, color.surface.primary, "primary text on panels"],
      [color.text.muted, color.surface.primary, "muted text on panels"],
      [color.text.inverse, color.brand.strong, "inverse text on primary actions"],
      [color.text.inverseMuted, color.brand.strong, "secondary text on dark navigation"],
      [color.brand.attentionText, color.brand.strong, "selected navigation text"],
      [color.brand.base, color.surface.primary, "brand links on panels"],
      [color.semantic.success, color.statusBackground.success, "success state"],
      [color.semantic.warning, color.statusBackground.warning, "warning state"],
      [color.semantic.danger, color.statusBackground.danger, "danger state"],
    ] as const;

    for (const [foreground, background, label] of requiredPairs) {
      expect(contrastRatio(foreground, background), label).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps interactive control boundaries at WCAG non-text contrast", () => {
    const { color } = lotusThemeTokens;
    const requiredPairs = [
      [color.border.strong, color.surface.primary, "strong control border on panels"],
    ] as const;

    for (const [foreground, background, label] of requiredPairs) {
      expect(contrastRatio(foreground, background), label).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps global token definitions in the governed token layer", () => {
    const importedGlobalLayers = readImportedGlobalLayers();
    expect(importedGlobalLayers.map(({ fileName }) => fileName)).toContain("tokens.css");

    for (const { fileName, css } of importedGlobalLayers) {
      if (fileName === "tokens.css") {
        continue;
      }
      expect(css, `${fileName} must consume, not redeclare, palette tokens`).not.toMatch(
        governedPaletteDeclarationPattern
      );
    }

    const representativeRejectedOverrides = [
      "--bg-page: #fff;",
      ".panel { --bg-page: #fff; }",
      "--text-muted: #333;",
      "--brand-strong: #111;",
      "--border: #777;",
      "--analytic-positive-soft: #567;",
      "--status-danger-bg: #fee;",
      "--status-neutral-bg: #eee;",
    ];
    for (const declaration of representativeRejectedOverrides) {
      expect(declaration).toMatch(governedPaletteDeclarationPattern);
    }

    expect("--space-4: 16px;").not.toMatch(governedPaletteDeclarationPattern);
  });

  it("keeps direct proposal routes on root-scoped text authority", () => {
    const proposalStylePaths = [
      "proposal-advisory-workspace.module.css",
      "proposal-detail-view.module.css",
      "proposal-review-panel.module.css",
    ];

    for (const fileName of proposalStylePaths) {
      const css = fs.readFileSync(
        path.resolve(
          __dirname,
          `../../src/features/proposals/components/${fileName}`,
        ),
        "utf8",
      );
      expect(css, `${fileName} must use the root-scoped text token`).toContain(
        "var(--text)",
      );
      expect(
        css,
        `${fileName} must not depend on the portfolio-page scoped text token`,
      ).not.toContain("--portfolio-ui-text");
    }
  });

  it("keeps keyboard focus visible in Windows forced-colour mode", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../src/styles/global/workbench-shell.css"),
      "utf8",
    );

    expect(css).toMatch(
      /:focus-visible\s*\{[^}]*outline:\s*2px solid transparent;[^}]*box-shadow:\s*var\(--focus-ring\);/s,
    );
    expect(css).toMatch(
      /@media\s*\(forced-colors:\s*active\)\s*\{\s*:focus-visible\s*\{[^}]*outline-color:\s*Highlight;[^}]*box-shadow:\s*none;/s,
    );
    expect(css).not.toMatch(/:focus-visible\s*\{[^}]*outline:\s*none;/s);

    for (const { fileName, css: globalCss } of readImportedGlobalLayers()) {
      expect(globalCss, `${fileName} must preserve a forced-colours outline`).not.toMatch(
        /outline:\s*none/,
      );
    }

    const sourceRoot = path.resolve(__dirname, "../../src");
    const pending = [sourceRoot];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) {
        continue;
      }
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          pending.push(entryPath);
        } else if (entry.name.endsWith(".module.css") || entry.name.endsWith(".tsx")) {
          const source = fs.readFileSync(entryPath, "utf8");
          expect(
            source,
            `${path.relative(sourceRoot, entryPath)} must preserve a forced-colours outline`,
          ).not.toMatch(/outline\s*:\s*(?:["']none["']|none)/);
        }
      }
    }
  });
});
