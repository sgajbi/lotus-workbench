"use client";

import type { ReactNode } from "react";

import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";

import { Text } from "@/design-system";

type RiskDetailDrawerContextItem = {
  label: string;
  value: string;
};

export default function RiskDetailDrawer({
  open,
  title,
  subtitle,
  contextItems,
  summaryTitle,
  summaryBody,
  notes,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  contextItems: RiskDetailDrawerContextItem[];
  summaryTitle: string;
  summaryBody: string;
  notes?: Array<{ key: string; title: string; body: string }>;
  children: ReactNode;
  onClose: () => void;
}) {
  const compactScreen = useMediaQuery("(max-width: 960px)");
  const drawerLabel = `${title} detail`;

  return (
    <Drawer
      anchor={compactScreen ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      PaperProps={{
        className: [
          "performance-risk-detail-drawer",
          compactScreen ? "performance-risk-detail-drawer-mobile" : "",
        ]
          .filter(Boolean)
          .join(" "),
        "aria-label": drawerLabel,
      }}
    >
      <div className="performance-risk-detail-drawer-shell">
        <div className="performance-risk-detail-drawer-header">
          <div className="performance-risk-detail-drawer-header-copy">
            <Text variant="eyebrow">Analytical detail</Text>
            <Text variant="sectionTitle">{title}</Text>
            <Text variant="secondary">{subtitle}</Text>
          </div>
          <button
            type="button"
            className="performance-risk-detail-drawer-close"
            onClick={onClose}
            aria-label={`Close ${title} detail`}
          >
            Close
          </button>
        </div>

        {contextItems.length ? (
          <div className="performance-risk-detail-drawer-context" aria-label={`${title} detail context`}>
            {contextItems.map((item) => (
              <div key={item.label} className="performance-risk-detail-drawer-context-item">
                <Text variant="dataLabel">{item.label}</Text>
                <Text variant="cardTitle">{item.value}</Text>
              </div>
            ))}
          </div>
        ) : null}

        <div className="performance-risk-detail-drawer-summary">
          <Text variant="cardTitle">{summaryTitle}</Text>
          <Text variant="secondary">{summaryBody}</Text>
        </div>

        <div className="performance-risk-detail-drawer-body">{children}</div>

        {notes?.length ? (
          <div className="performance-risk-detail-drawer-notes" aria-label={`${title} detail notes`}>
            {notes.map((note) => (
              <div key={note.key} className="performance-risk-note-card">
                <div className="performance-risk-note-copy">
                  <Text variant="cardTitle">{note.title}</Text>
                  <Text variant="secondary">{note.body}</Text>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
