"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActionButton } from "@/design-system";

import {
  resolveAdvisorBookAsOfDateFromSearchParams,
  type AdvisorBookAsOfDateResolution,
} from "../configuration";
import { buildPortfolioContextHref } from "../navigation";
import { useAdvisorBook } from "../use-advisor-book";
import styles from "../advisor-book-context-switcher.module.css";

const RESTORE_FOCUS_KEY = "lotus:advisor-book-context-focus";

export default function AdvisorBookContextSwitcher({
  pathname,
  portfolioId,
}: {
  pathname: string;
  portfolioId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const activeSearchParams = useSearchParams();
  const locationSearch = activeSearchParams?.toString() ?? "";

  useEffect(() => {
    if (window.sessionStorage.getItem(RESTORE_FOCUS_KEY) === "true") {
      window.sessionStorage.removeItem(RESTORE_FOCUS_KEY);
      summaryRef.current?.focus();
    }
  }, [portfolioId]);

  const dateResolution = resolveAdvisorBookAsOfDateFromSearchParams(
    new URLSearchParams(locationSearch),
  );

  return (
    <div className={styles.switcher}>
      <div className={styles.header}>
        <span>
          <span className={styles.fullContextLabel}>Portfolio context</span>
          <span className={styles.compactContextLabel}>Portfolio</span>
        </span>
      </div>
      <details
        className={styles.disclosure}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          ref={summaryRef}
          className={styles.summary}
          aria-label="Change portfolio"
        >
          <span className={styles.fullChangeLabel}>Change portfolio</span>
          <span className={styles.compactChangeLabel}>Change</span>
        </summary>
        {expanded ? (
          <AdvisorBookContextOptions
            pathname={pathname}
            locationSearch={locationSearch}
            dateResolution={dateResolution}
            portfolioId={portfolioId}
          />
        ) : null}
      </details>
      <p className={styles.support}>
        Open to load portfolios assigned to you for the current business task.
      </p>
    </div>
  );
}

function AdvisorBookContextOptions({
  pathname,
  locationSearch,
  dateResolution,
  portfolioId,
}: {
  pathname: string;
  locationSearch: string;
  dateResolution: AdvisorBookAsOfDateResolution;
  portfolioId: string;
}) {
  if (dateResolution.status === "not_confirmed") {
    return (
      <p className={`${styles.optionState} ${styles.warning}`}>
        Portfolio switching is unavailable until a business date is confirmed in My book.
      </p>
    );
  }

  return (
    <AdvisorBookContextOptionsWithDate
      pathname={pathname}
      locationSearch={locationSearch}
      asOfDate={dateResolution.value}
      portfolioId={portfolioId}
    />
  );
}

function AdvisorBookContextOptionsWithDate({
  pathname,
  locationSearch,
  asOfDate,
  portfolioId,
}: {
  pathname: string;
  locationSearch: string;
  asOfDate: string;
  portfolioId: string;
}) {
  const query = useMemo(
    () => ({ asOfDate, sortBy: "client_id" as const, sortOrder: "asc" as const, limit: 100 }),
    [asOfDate],
  );
  const { response, loading, error, reload } = useAdvisorBook(query);
  const searchParams = new URLSearchParams(locationSearch);
  const selectedMembership = response?.items.find((item) => item.portfolio_id === portfolioId);

  if (loading) {
    return <p className={styles.optionState} role="status">Confirming own-book membership…</p>;
  }
  if (error) {
    return (
      <div className={`${styles.optionState} ${styles.warning}`}>
        <p>Switching is unavailable until book membership can be confirmed.</p>
        <ActionButton priority="secondary" onClick={() => void reload()}>
          Retry portfolios
        </ActionButton>
      </div>
    );
  }
  if (!response?.items.length) {
    return <p className={styles.optionState}>No portfolio memberships are available to switch.</p>;
  }

  return (
    <div>
      {!selectedMembership ? (
        <p className={`${styles.optionState} ${styles.warning}`}>
          The selected portfolio is not confirmed in the returned own-book page.
        </p>
      ) : null}
      <ul className={styles.options} aria-label="Portfolio context options">
        {response.items.map((item) => {
          const selected = item.portfolio_id === portfolioId;
          return (
            <li key={item.portfolio_id}>
              {selected ? (
                <span className={styles.selected} aria-current="true">
                  <strong>{item.display_name}</strong>
                  <small>{item.client_id} · Current</small>
                </span>
              ) : (
                <Link
                  href={buildPortfolioContextHref({
                    pathname,
                    searchParams,
                    portfolioId: item.portfolio_id,
                  })}
                  onClick={() =>
                    window.sessionStorage.setItem(RESTORE_FOCUS_KEY, "true")
                  }
                >
                  <strong>{item.display_name}</strong>
                  <small>{item.client_id}</small>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
