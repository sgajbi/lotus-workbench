"use client";

import { useEffect, useState } from "react";

import { formatTimestampValue } from "../utils/financial-formatters";
import { cx } from "../utils/cx";
import styles from "./workbench-data-age.module.css";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const CLOCK_SKEW_TOLERANCE_MS = MINUTE_MS;

type WorkbenchDataAgeProps = {
  updatedAt: number | null;
  subject: string;
  className?: string;
  now?: number;
};

export type WorkbenchDataAgeModel = {
  visibleLabel: string;
  accessibleLabel: string;
  exactLabel: string;
  dateTime: string;
};

export function formatWorkbenchDataAge(
  updatedAt: number | null,
  now = Date.now(),
): WorkbenchDataAgeModel | null {
  if (
    typeof updatedAt !== "number" ||
    !Number.isFinite(updatedAt) ||
    updatedAt <= 0 ||
    updatedAt - now > CLOCK_SKEW_TOLERANCE_MS
  ) {
    return null;
  }

  const boundedAge = Math.max(0, now - updatedAt);
  const dateTime = new Date(updatedAt).toISOString();
  const exactLabel = formatTimestampValue(dateTime);
  if (exactLabel === "N/A") {
    return null;
  }

  if (boundedAge < MINUTE_MS) {
    return {
      visibleLabel: "Checked just now",
      accessibleLabel: "checked less than one minute ago",
      exactLabel,
      dateTime,
    };
  }

  if (boundedAge < HOUR_MS) {
    const minutes = Math.floor(boundedAge / MINUTE_MS);
    return {
      visibleLabel: `Checked ${minutes} min ago`,
      accessibleLabel: `checked ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`,
      exactLabel,
      dateTime,
    };
  }

  if (boundedAge < DAY_MS) {
    const hours = Math.floor(boundedAge / HOUR_MS);
    return {
      visibleLabel: `Checked ${hours} ${hours === 1 ? "hr" : "hrs"} ago`,
      accessibleLabel: `checked ${hours} ${hours === 1 ? "hour" : "hours"} ago`,
      exactLabel,
      dateTime,
    };
  }

  return {
    visibleLabel: `Checked ${exactLabel}`,
    accessibleLabel: `checked at ${exactLabel}`,
    exactLabel,
    dateTime,
  };
}

function getNextAgeUpdateDelay(updatedAt: number, now: number): number | null {
  const age = Math.max(0, now - updatedAt);
  if (age < MINUTE_MS) {
    return Math.max(1, MINUTE_MS - age);
  }
  if (age < HOUR_MS) {
    return Math.max(1, MINUTE_MS - (age % MINUTE_MS));
  }
  if (age < DAY_MS) {
    return Math.max(1, HOUR_MS - (age % HOUR_MS));
  }
  return null;
}

export default function WorkbenchDataAge({
  updatedAt,
  subject,
  className,
  now: fixedNow,
}: WorkbenchDataAgeProps) {
  const [clockNow, setClockNow] = useState(() => fixedNow ?? Date.now());
  const effectiveNow = fixedNow ?? clockNow;
  const model = formatWorkbenchDataAge(updatedAt, effectiveNow);

  useEffect(() => {
    if (fixedNow !== undefined || !model || updatedAt === null) {
      return;
    }
    const delay = getNextAgeUpdateDelay(updatedAt, effectiveNow);
    if (delay === null) {
      return;
    }
    const timeout = window.setTimeout(() => setClockNow(Date.now()), delay);
    return () => window.clearTimeout(timeout);
  }, [effectiveNow, fixedNow, model, updatedAt]);

  if (!model) {
    return (
      <span
        className={cx(styles.root, styles.unavailable, className)}
        aria-label={`${subject} check time unavailable.`}
      >
        Check time unavailable
      </span>
    );
  }

  return (
    <time
      className={cx(styles.root, className)}
      dateTime={model.dateTime}
      title={`Exact check time: ${model.exactLabel}`}
      aria-label={`${subject} ${model.accessibleLabel}. Exact check time ${model.exactLabel}.`}
    >
      {model.visibleLabel}
    </time>
  );
}
