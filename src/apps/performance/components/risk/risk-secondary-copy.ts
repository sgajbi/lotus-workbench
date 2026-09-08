export const riskRollingPanelCopy = {
  title: "Rolling Risk",
  methodologyPanelTitle: "Rolling Risk",
  drilldownLabel: "View rolling series",
  detailTitle: "Window detail",
  reviewWindowLabel: "Review window",
  reviewWindowSupport: "Short to long horizon",
  detailTableAriaLabel: "Rolling risk summary table",
  detailTableEmptyState: {
    title: "No rolling risk metrics",
    body: "Rolling risk windows are not available for this portfolio context.",
  },
} as const;

export const riskAttributionPanelCopy = {
  title: "Historical Risk Attribution",
  methodologyPanelTitle: "Historical Risk Attribution",
  detailTitle: "Contributor review",
  detailAriaLabel: "Risk attribution detail",
  attributionTypeAriaLabel: "Risk attribution type",
  groupingAriaLabel: "Risk attribution grouping",
  warningsLabel: "Attribution notes",
  loadingTitle: "Loading historical risk attribution",
  loadingBody: "Fetching stateful attribution contributors for the selected controls.",
  blockedTitle: "Attribution selection blocked",
  blockedBody: "The selected attribution combination is blocked by the current stateful support matrix.",
  blockedHint: "Choose a supported attribution type and grouping combination to continue.",
  unavailableTitle: "Historical risk attribution unavailable",
  unavailableBody: "Historical risk attribution is not available for the selected portfolio context.",
  partialEyebrow: "Evidence posture",
  partialTitle: "Attribution is indicative",
  partialBody:
    "Source evidence is incomplete. When contributor values are available, they are shown without magnitude bars until the source reports the attribution as ready.",
  tableAriaLabel: "Historical risk attribution table",
  tableEmptyState: {
    title: "No attribution contributors",
    body: "Historical risk attribution did not return contributor rows for the selected controls.",
  },
} as const;
