import { createTheme } from "@mui/material";

import { lotusThemeTokens } from "./tokens";
import type { LotusColorScheme } from "./tokens";

export function createLotusMuiTheme(colorScheme: LotusColorScheme = "light") {
  const color = lotusThemeTokens.colorSchemes[colorScheme];

  return createTheme({
    palette: {
      mode: colorScheme,
      primary: {
        main: color.brand.base,
        dark: color.brand.strong,
        light: color.brand.accent,
      },
      secondary: {
        main: color.brand.highlight,
      },
      background: {
        default: color.surface.canvas,
        paper: color.surface.panel,
      },
      text: {
        primary: color.text.primary,
        secondary: color.text.muted,
      },
      success: {
        main: color.semantic.success,
      },
      warning: {
        main: color.semantic.warning,
      },
      error: {
        main: color.semantic.danger,
      },
      divider: color.border.default,
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: lotusThemeTokens.breakpoint.compact,
        md: lotusThemeTokens.breakpoint.tablet,
        lg: lotusThemeTokens.breakpoint.desktop,
        xl: lotusThemeTokens.breakpoint.wide,
      },
    },
    transitions: {
      duration: {
        shortest: Number.parseInt(lotusThemeTokens.motion.duration.fast, 10),
        shorter: Number.parseInt(lotusThemeTokens.motion.duration.fast, 10),
        short: Number.parseInt(lotusThemeTokens.motion.duration.standard, 10),
        standard: Number.parseInt(lotusThemeTokens.motion.duration.standard, 10),
        complex: Number.parseInt(lotusThemeTokens.motion.duration.emphasized, 10),
        enteringScreen: Number.parseInt(lotusThemeTokens.motion.duration.emphasized, 10),
        leavingScreen: Number.parseInt(lotusThemeTokens.motion.duration.standard, 10),
      },
      easing: {
        easeInOut: lotusThemeTokens.motion.easing.standard,
        easeOut: lotusThemeTokens.motion.easing.enter,
        easeIn: lotusThemeTokens.motion.easing.exit,
        sharp: lotusThemeTokens.motion.easing.exit,
      },
    },
    shape: {
      borderRadius: lotusThemeTokens.radius.control,
    },
    typography: {
      fontFamily: lotusThemeTokens.typography.fontFamily.ui,
      h1: {
        fontFamily: lotusThemeTokens.typography.fontFamily.display,
        fontWeight: 600,
        letterSpacing: "-0.03em",
      },
      h2: {
        fontFamily: lotusThemeTokens.typography.fontFamily.display,
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      h3: {
        fontFamily: lotusThemeTokens.typography.fontFamily.display,
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      button: {
        fontWeight: 700,
        textTransform: "none",
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            color: color.text.primary,
            backgroundColor: color.surface.canvas,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            borderRadius: lotusThemeTokens.radius.panel,
            border: color.border.subtle,
            boxShadow: lotusThemeTokens.elevation.subtle,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: lotusThemeTokens.radius.control,
          },
        },
      },
    },
  });
}
