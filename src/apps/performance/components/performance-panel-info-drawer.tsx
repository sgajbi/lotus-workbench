"use client";

import { useState } from "react";

import Drawer from "@mui/material/Drawer";

import { Text } from "@/design-system";

export type PerformancePanelInfoRow = {
  key: string;
  label: string;
  value: string;
  support: string;
};

export default function PerformancePanelInfoDrawer({
  panelTitle,
  rows,
  title = "Methodology & coverage",
  description = "Coverage, methodology, and supportability details for the current panel.",
  triggerVariant = "pill",
}: {
  panelTitle: string;
  rows: PerformancePanelInfoRow[];
  title?: string;
  description?: string;
  triggerVariant?: "pill" | "inline";
}) {
  const [open, setOpen] = useState(false);

  if (!rows.length) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={
          triggerVariant === "inline"
            ? "performance-panel-inline-action"
            : "performance-risk-info-trigger"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${panelTitle} methodology and coverage`}
        onClick={() => setOpen(true)}
      >
        <span
          className={
            triggerVariant === "inline"
              ? "performance-panel-inline-action-label"
              : "performance-risk-info-trigger-label"
          }
        >
          {triggerVariant === "inline" ? "View Details" : title}
        </span>
      </button>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          className: "performance-risk-info-drawer",
          "aria-label": `${panelTitle} methodology and coverage`,
        }}
      >
        <div className="performance-risk-info-drawer-shell">
          <div className="performance-risk-info-drawer-header">
            <Text variant="eyebrow">Context available</Text>
            <Text variant="sectionTitle">{panelTitle}</Text>
            <Text variant="secondary">{description}</Text>
          </div>

          <div className="performance-risk-info-drawer-body">
            <div className="performance-risk-context-list performance-risk-context-list-compact performance-panel-info-list">
              {rows.map((row) => (
                <div key={row.key} className="performance-risk-context-item performance-panel-info-row">
                  <div className="performance-risk-context-item-copy performance-panel-info-row-copy">
                    <Text variant="dataLabel">{row.label}</Text>
                    <Text variant="metadata">{row.support}</Text>
                  </div>
                  <Text
                    variant="cardTitle"
                    className="performance-risk-context-item-value performance-panel-info-row-value"
                  >
                    {row.value}
                  </Text>
                </div>
              ))}
            </div>
          </div>

          <div className="performance-risk-info-drawer-footer">
            <button
              type="button"
              className="performance-risk-info-dismiss"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
