const lightColorTokens = {
  surface: {
    canvas: "#f4f6f7",
    canvasAlt: "#eef2f4",
    page: "#f4f6f7",
    foundation: "#e8edf0",
    panel: "#ffffff",
    panelAlt: "#f8faf9",
    primary: "#ffffff",
    secondary: "#f2f5f5",
    tertiary: "#e8eeee",
    interactive: "#edf3f4",
    selected: "#e3edf0",
    topbar: "#fbfcfb",
  },
  text: {
    primary: "#18262f",
    muted: "#5b6872",
    inverse: "#ffffff",
    inverseMuted: "#c3d2d9",
    disabled: "#56636d",
  },
  border: {
    default: "#d5dde1",
    strong: "#7b8b94",
    interactive: "#8fa5b1",
    subtle: "1px solid #d5dde1",
  },
  brand: {
    base: "#214f68",
    strong: "#102f40",
    soft: "#e7f0f3",
    accent: "#765c25",
    highlight: "#2f6f91",
    hover: "#183e54",
    attention: "#d2b46f",
    attentionText: "#f4dda6",
  },
  semantic: {
    success: "#256247",
    warning: "#7d5714",
    warningBorder: "#c89b45",
    danger: "#a43e35",
    analyticPositive: "#2f6587",
    analyticPositiveSoft: "#66869a",
    analyticNegative: "#8f554c",
    analyticNegativeSoft: "#ad7b72",
  },
  statusBackground: {
    success: "#edf7f1",
    warning: "#fff7e6",
    danger: "#fff1ef",
    neutral: "#eef2f3",
  },
  chart: {
    categorical: {
      allocation: "#2f6f91",
      selection: "#3e7357",
      interaction: "#a43e35",
      total: "#263746",
    },
    sequential: {
      low: "#dce9ee",
      medium: "#66869a",
      high: "#214f68",
    },
    diverging: {
      negative: "#a43e35",
      neutral: "#7b8b94",
      positive: "#2f6587",
    },
    chrome: {
      axis: "#5b6872",
      grid: "rgba(123, 139, 148, 0.2)",
      tooltipBackground: "rgba(255, 255, 255, 0.98)",
      tooltipBorder: "rgba(33, 79, 104, 0.18)",
    },
  },
} as const;

const panelTitleTypography = {
  size: "1.125rem",
  weight: 600,
  lineHeight: 1.3333333333,
  tracking: "0",
} as const;

const bodySmallTypography = {
  size: "0.8125rem",
  weight: 400,
  lineHeight: 1.5384615385,
} as const;

const dataLabelTypography = {
  size: "0.75rem",
  weight: 500,
  lineHeight: 1.3333333333,
  tracking: "0.01em",
} as const;

const microLabelTypography = {
  size: "0.75rem",
  weight: 600,
  lineHeight: 1.3333333333,
  tracking: "0.04em",
} as const;

const metricValueLargeTypography = {
  size: "1.75rem",
  weight: 600,
  lineHeight: 1.1428571429,
  tracking: "0",
} as const;

const metricValueMediumTypography = {
  size: "1.375rem",
  weight: 600,
  lineHeight: 1.2727272727,
  tracking: "0",
} as const;

const buttonLabelTypography = {
  size: "0.875rem",
  weight: 600,
  lineHeight: 1.4285714286,
  tracking: "0",
} as const;

const badgeLabelTypography = {
  size: "0.75rem",
  weight: 600,
  lineHeight: 1.3333333333,
  tracking: "0.02em",
} as const;

const lotusColorSchemes = {
  light: lightColorTokens,
} as const;

export type LotusColorScheme = keyof typeof lotusColorSchemes;

export const lotusThemeTokens = {
  colorSchemes: lotusColorSchemes,
  // Compatibility access for existing consumers. New theme factories select colorSchemes explicitly.
  color: lightColorTokens,
  typography: {
    fontFamily: {
      ui: 'var(--font-lotus-ui-face), "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: "var(--font-lotus-display-face), Georgia, serif",
      mono: 'var(--font-lotus-mono-face), "IBM Plex Mono", ui-monospace, monospace',
    },
    size: {
      text2xs: "0.6875rem",
      textXs: "0.75rem",
      textSm: "0.875rem",
      textMd: "0.875rem",
      textLg: "1.0625rem",
      textXl: "1rem",
      text2xl: "1.125rem",
      text3xl: "2rem",
    },
    lineHeight: {
      tight: 1.15,
      snug: 1.3,
      body: 1.6,
    },
    tracking: {
      label: "0.01em",
      micro: "0.04em",
      table: "0.01em",
      badge: "0.02em",
      tight: "0",
      shellBrand: "-0.035em",
      shellUi: "0",
      analyticLabel: "0.06em",
    },
    variant: {
      workspaceTitle: {
        size: "1.5rem",
        weight: 600,
        lineHeight: 1.3333333333,
        tracking: "0",
      },
      pageTitle: {
        size: "1.5rem",
        weight: 600,
        lineHeight: 1.3333333333,
        tracking: "0",
      },
      sectionTitle: {
        size: "1.125rem",
        weight: 600,
        lineHeight: 1.3333333333,
        tracking: "0",
      },
      panelTitle: panelTitleTypography,
      subsectionTitle: {
        size: "0.875rem",
        weight: 600,
        lineHeight: 1.4285714286,
        tracking: "0",
      },
      cardTitle: panelTitleTypography,
      body: {
        size: "0.875rem",
        weight: 400,
        lineHeight: 1.4285714286,
      },
      bodySmall: bodySmallTypography,
      helperText: {
        size: "0.75rem",
        weight: 400,
        lineHeight: 1.5,
      },
      secondary: bodySmallTypography,
      dataLabel: dataLabelTypography,
      microLabel: microLabelTypography,
      eyebrow: microLabelTypography,
      metadata: {
        size: "0.75rem",
        weight: 400,
        lineHeight: 1.3333333333,
        tracking: "0",
      },
      metricValue: metricValueLargeTypography,
      metricValueCompact: metricValueMediumTypography,
      metricValueXL: {
        size: "2.125rem",
        weight: 600,
        lineHeight: 1.1176470588,
        tracking: "0",
      },
      metricValueL: metricValueLargeTypography,
      metricValueM: metricValueMediumTypography,
      tableHeader: {
        size: "0.75rem",
        weight: 600,
        lineHeight: 1.3333333333,
        tracking: "0.01em",
      },
      tableCell: {
        size: "0.875rem",
        weight: 400,
        lineHeight: 1.4285714286,
        tracking: "0",
      },
      buttonLabel: buttonLabelTypography,
      badgeLabel: badgeLabelTypography,
      button: buttonLabelTypography,
      badge: badgeLabelTypography,
      tooltipTitle: {
        size: "0.8125rem",
        weight: 600,
        lineHeight: 1.3846153846,
        tracking: "0",
      },
      tooltipBody: {
        size: "0.8125rem",
        weight: 400,
        lineHeight: 1.5384615385,
        tracking: "0",
      },
    },
    workbench: {
      textCompact: "0.75rem",
      textCompactStrong: "0.8125rem",
      summaryTitle: "1rem",
      summaryVisualLabel: "0.8125rem",
      summaryVisualValue: "0.875rem",
      summaryVisualMeta: "0.75rem",
      analyticLabel: "0.6875rem",
      analyticChip: "0.6875rem",
      analyticSupport: "0.71875rem",
      analyticContextValue: "0.78125rem",
      analyticSubtitle: "0.78125rem",
      analyticHeading: "0.875rem",
      analyticFallback: "0.75rem",
    },
  },
  spacing: {
    step1: "4px",
    step2: "8px",
    step3: "12px",
    step4: "16px",
    step5: "20px",
    step6: "24px",
    step7: "32px",
    step8: "40px",
    step9: "48px",
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    control: 6,
    tile: 8,
    panel: 10,
  },
  elevation: {
    none: "none",
    subtle: "0 1px 2px rgba(17, 24, 39, 0.03)",
    soft: "0 8px 24px rgba(17, 24, 39, 0.04)",
  },
  focus: {
    ring: "0 0 0 2px #2f6f91",
  },
  motion: {
    duration: {
      instant: "0ms",
      fast: "120ms",
      standard: "180ms",
      emphasized: "240ms",
    },
    easing: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      enter: "cubic-bezier(0, 0, 0.2, 1)",
      exit: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
  breakpoint: {
    compact: 420,
    mobile: 640,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
  },
  layout: {
    workbenchSectionGap: "12px",
    workbenchCardPadding: "12px",
    workbenchCardPaddingCompact: "12px",
    workbenchPageEdgePadding: "24px",
    workbenchPanelGap: "12px",
    workbenchPanelGapMajor: "12px",
    panelPaddingDefault: "16px",
    panelPaddingCompact: "12px",
    panelPaddingDense: "12px",
    workbenchPageFrameGap: "12px",
    workbenchPageFrameHeaderPadding: "0",
    workbenchSummaryBodyGap: "12px",
    workbenchTitleGap: "4px",
    workbenchMetricStripGap: "8px",
    workbenchMetricStripGapDense: "12px",
    workbenchRailWidth: "340px",
    workbenchRailCardPadding: "20px",
    workstationShellGap: "12px",
    workstationRailWidth: "280px",
    workstationSideWidth: "320px",
  },
  control: {
    height: {
      touchTarget: "44px",
      default: "40px",
      compactToolbar: "36px",
    },
  },
  metricTile: {
    height: {
      default: "112px",
      compact: "96px",
    },
  },
  table: {
    rowHeight: {
      compact: "44px",
      comfortable: "52px",
    },
    cellPadding: {
      x: "16px",
      y: "12px",
    },
  },
  zIndex: {
    base: 0,
    content: 1,
    pinnedCell: 2,
    pinnedHeader: 3,
    shellHeader: 20,
    overlay: 40,
    modal: 50,
    toast: 60,
  },
} as const;
