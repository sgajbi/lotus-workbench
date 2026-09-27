import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";

import { lotusThemeTokens } from "../theme/tokens";
import { cx } from "../utils/cx";
import Text from "./text";

export default function AnalyticsStat({
  label,
  value,
  support,
  emphasize = false,
  definition,
  valueTone = "neutral",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  support?: React.ReactNode;
  emphasize?: boolean;
  definition?: React.ReactNode;
  valueTone?: "neutral" | "success" | "warn" | "danger";
  onClick?: () => void;
}) {
  const accessibleLabel = `${label}: ${typeof value === "string" || typeof value === "number" ? value : "Expand"}`;
  const stat = (
    <Box
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={onClick ? "analytics-stat-interactive" : undefined}
      aria-label={onClick ? accessibleLabel : undefined}
      title={typeof definition === "string" ? definition : undefined}
      sx={{
        display: "grid",
        gap: lotusThemeTokens.spacing.step2,
        minWidth: 0,
        minHeight: Number.parseInt(lotusThemeTokens.control.height.touchTarget, 10),
        px: emphasize ? lotusThemeTokens.spacing.step6 : 0,
        py: emphasize ? lotusThemeTokens.spacing.step4 : 0,
        borderRadius: emphasize ? `${lotusThemeTokens.radius.md}px` : 0,
        border: "none",
        background: emphasize ? lotusThemeTokens.color.surface.panel : "transparent",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        outline: "2px solid transparent",
        outlineOffset: "2px",
      }}
    >
      <Text variant="dataLabel" as="span">
        {label}
      </Text>
      <Text
        variant={emphasize ? "metricValueL" : "metricValueM"}
        as="div"
        className={cx("analytics-stat-value", getAnalyticsStatToneClassName(valueTone))}
      >
        {value}
      </Text>
      {support ? (
        <Text variant="bodySmall" as="div">
          {support}
        </Text>
      ) : null}
    </Box>
  );

  if (!definition) {
    return stat;
  }

  return (
    <Tooltip title={definition} arrow>
      <Box component="span" sx={{ display: "block", minWidth: 0 }}>
        {stat}
      </Box>
    </Tooltip>
  );
}

function getAnalyticsStatToneClassName(tone: "neutral" | "success" | "warn" | "danger") {
  switch (tone) {
    case "success":
      return "analytics-stat-value-success";
    case "warn":
      return "analytics-stat-value-warn";
    case "danger":
      return "analytics-stat-value-danger";
    default:
      return "analytics-stat-value-neutral";
  }
}
