import { describe, expect, it } from "vitest";

import { createLotusMuiTheme } from "@/design-system/theme/mui-theme";
import { lotusThemeTokens } from "@/design-system/theme/tokens";

describe("Lotus MUI theme", () => {
  it("aligns palette and typography with Lotus design tokens", () => {
    const theme = createLotusMuiTheme();

    expect(theme.palette.primary.main).toBe(lotusThemeTokens.color.brand.base);
    expect(theme.palette.primary.dark).toBe(lotusThemeTokens.color.brand.strong);
    expect(theme.palette.background.default).toBe(lotusThemeTokens.color.surface.canvas);
    expect(theme.palette.text.primary).toBe(lotusThemeTokens.color.text.primary);
    expect(theme.typography.fontFamily).toBe(lotusThemeTokens.typography.fontFamily.ui);
    expect(theme.typography.h1.fontFamily).toBe(lotusThemeTokens.typography.fontFamily.display);
    expect(theme.breakpoints.values).toMatchObject({
      sm: lotusThemeTokens.breakpoint.compact,
      md: lotusThemeTokens.breakpoint.tablet,
      lg: lotusThemeTokens.breakpoint.desktop,
      xl: lotusThemeTokens.breakpoint.wide,
    });
    expect(theme.transitions.duration.standard).toBe(180);
  });

  it("selects the governed light colour scheme instead of hardcoding a second palette", () => {
    const theme = createLotusMuiTheme("light");

    expect(theme.palette.mode).toBe("light");
    expect(theme.palette.primary.main).toBe(
      lotusThemeTokens.colorSchemes.light.brand.base,
    );
    expect(theme.palette.background.paper).toBe(
      lotusThemeTokens.colorSchemes.light.surface.panel,
    );
  });

  it("applies shared component posture for paper and buttons", () => {
    const theme = createLotusMuiTheme();
    const paper = theme.components?.MuiPaper?.styleOverrides?.root;
    const button = theme.components?.MuiButton?.styleOverrides?.root;

    expect(paper).toMatchObject({
      borderRadius: lotusThemeTokens.radius.panel,
      border: lotusThemeTokens.color.border.subtle,
      boxShadow: lotusThemeTokens.elevation.subtle,
    });
    expect(button).toMatchObject({
      borderRadius: lotusThemeTokens.radius.control,
    });
  });
});
