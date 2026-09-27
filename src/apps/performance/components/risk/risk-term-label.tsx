import Tooltip from "@mui/material/Tooltip";

import { Text } from "@/design-system";

export default function RiskTermLabel({
  label,
  definition,
}: {
  label: string;
  definition: string;
}) {
  return (
    <span className="performance-risk-term-label">
      <Text variant="dataLabel" className="workbench-summary-metric-label">
        {label}
      </Text>
      <Tooltip title={definition} arrow>
        <button
          type="button"
          className="performance-risk-term-trigger"
          aria-label={`${label}: ${definition}`}
        />
      </Tooltip>
    </span>
  );
}
