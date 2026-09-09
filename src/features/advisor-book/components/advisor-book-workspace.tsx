"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import {
  ActionButton,
  ActionLink,
  AnalyticsTable,
  DefinitionList,
  FieldLabel,
  ScreenStatePanel,
  SectionBlock,
  SemanticBadge,
  WorkbenchDataAge,
  WorkbenchSummaryMetricStrip,
} from "@/design-system";
import {
  getWorkbenchApiErrorEvidence,
  isWorkbenchPermissionBlockedError,
} from "@/features/workbench/api-client";

import type { AdvisorBookQuery } from "../api";
import type {
  AdvisorBookSortBy,
  AdvisorBookSortOrder,
} from "../contracts";
import {
  resolveAdvisorBookAsOfDate,
  resolveAdvisorBookAsOfDateFromSearchParams,
  type AdvisorBookAsOfDateResolution,
} from "../configuration";
import { buildPortfolioContextHref } from "../navigation";
import { useAdvisorBook } from "../use-advisor-book";
import {
  buildAdvisorBookResultScopeModel,
  buildAdvisorBookWorkspaceModel,
} from "../view-model";
import styles from "../advisor-book-workspace.module.css";

const PAGE_SIZE = 25;

type AdvisorBookFilterDraft = {
  clientId: string;
  mandateType: string;
  sortBy: AdvisorBookSortBy;
  sortOrder: AdvisorBookSortOrder;
};

function buildAdvisorBookFilterDraft(
  query: AdvisorBookQuery,
): AdvisorBookFilterDraft {
  return {
    clientId: query.clientId ?? "",
    mandateType: query.mandateType ?? "",
    sortBy: query.sortBy ?? "portfolio_id",
    sortOrder: query.sortOrder ?? "asc",
  };
}

export default function AdvisorBookWorkspace() {
  const searchParams = useSearchParams();

  return <AdvisorBookWorkspaceContent searchParams={searchParams} />;
}

function AdvisorBookWorkspaceContent({
  searchParams,
}: {
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const dateResolution = resolveAdvisorBookAsOfDateFromSearchParams(searchParams);

  if (dateResolution.status === "not_confirmed") {
    return (
      <AdvisorBookDateRequired
        dateResolution={dateResolution}
        searchParams={searchParams}
      />
    );
  }

  return (
    <AdvisorBookSourceWorkspace
      asOfDate={dateResolution.value}
      searchParams={searchParams}
    />
  );
}

function AdvisorBookDateRequired({
  dateResolution,
  searchParams,
}: {
  dateResolution: Extract<AdvisorBookAsOfDateResolution, { status: "not_confirmed" }>;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [businessDate, setBusinessDate] = useState("");
  const reason =
    dateResolution.reason === "invalid_requested_date"
      ? "The requested business date is not a valid calendar date."
      : dateResolution.reason === "ambiguous_requested_date"
        ? "The requested business date was supplied more than once and cannot be confirmed."
      : dateResolution.reason === "invalid_review_context"
        ? "The portfolio review address contains conflicting or unsupported context."
      : dateResolution.reason === "invalid_development_configuration"
        ? "The configured local business date is not valid."
        : dateResolution.reason === "development_date_not_allowed"
          ? "A local business date cannot be used in this environment."
        : "No business date has been confirmed for this book view.";

  function confirmBusinessDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolution = resolveAdvisorBookAsOfDate(businessDate);
    if (resolution.status !== "confirmed") {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.set("asOfDate", resolution.value);
    next.set("offset", "0");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <ScreenStatePanel
      kind="unavailable"
      title="Business date not confirmed"
      body={`${reason} Portfolio assignments have not been requested.`}
      hint="Select the calendar date the own-book assignment should be reviewed against."
      action={dateResolution.reason === "invalid_review_context" ? (
        <ActionLink href="/book">Reset review context</ActionLink>
      ) : (
        <form
          className={styles.businessDateRecovery}
          onSubmit={confirmBusinessDate}
          aria-label="Choose business date"
        >
          <div className={styles.field}>
            <FieldLabel htmlFor="advisor-book-business-date">Business date</FieldLabel>
            <input
              id="advisor-book-business-date"
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
              required
            />
          </div>
          <ActionButton type="submit" priority="primary">
            Review book
          </ActionButton>
        </form>
      )}
    />
  );
}

function AdvisorBookSourceWorkspace({
  asOfDate,
  searchParams,
}: {
  asOfDate: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const query = useMemo(
    () => queryFromSearchParams(searchParams, asOfDate),
    [asOfDate, searchParams],
  );
  const filterIdentity = searchParams.toString();
  const queryFilterDraft = buildAdvisorBookFilterDraft(query);
  const [filterState, setFilterState] = useState({
    observedIdentity: filterIdentity,
    draft: queryFilterDraft,
  });
  let filterDraft = filterState.draft;
  if (filterState.observedIdentity !== filterIdentity) {
    filterDraft = queryFilterDraft;
    setFilterState({ observedIdentity: filterIdentity, draft: queryFilterDraft });
  }
  const {
    response,
    loading,
    error,
    recheckError,
    rechecking,
    checkedAt,
    reload,
  } = useAdvisorBook(query);

  function updateFilterDraft(
    patch: Partial<AdvisorBookFilterDraft>,
  ) {
    setFilterState({
      observedIdentity: filterIdentity,
      draft: { ...filterDraft, ...patch },
    });
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    setOptionalQuery(next, "clientId", filterDraft.clientId.trim());
    setOptionalQuery(next, "mandateType", filterDraft.mandateType);
    setOptionalQuery(
      next,
      "sortBy",
      filterDraft.sortBy === "portfolio_id" ? "" : filterDraft.sortBy,
    );
    setOptionalQuery(
      next,
      "sortOrder",
      filterDraft.sortOrder === "asc" ? "" : filterDraft.sortOrder,
    );
    next.set("offset", "0");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearView() {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["clientId", "mandateType", "sortBy", "sortOrder", "offset"]) {
      next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function changePage(offset: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("offset", String(Math.max(offset, 0)));
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const model = response ? buildAdvisorBookWorkspaceModel(response) : null;
  const resultScope = response
    ? buildAdvisorBookResultScopeModel(query, response.page)
    : null;
  const lastReturned = response
    ? response.page.offset + response.page.returned_count
    : 0;
  const errorEvidence = error ? getWorkbenchApiErrorEvidence(error) : null;
  const hasCustomView = Boolean(
    query.clientId ||
      query.mandateType ||
      query.sortBy !== "portfolio_id" ||
      query.sortOrder !== "asc",
  );

  return (
    <div className={styles.workspace}>
      {model ? (
        <div className={styles.contextStrip} aria-label="Book scope">
          <SemanticBadge
            tone={
              model.state === "ready"
                ? "success"
                : model.state === "degraded"
                  ? "warn"
                  : "default"
            }
          >
            {model.stateLabel}
          </SemanticBadge>
          <div className={styles.contextItem}>
            <span>Scope</span>
            <strong>{model.scopeLabel}</strong>
          </div>
          <div className={styles.contextItem}>
            <span>Business date</span>
            <strong>{model.asOfLabel}</strong>
          </div>
          <div className={styles.contextItem}>
            <span>Booking centre</span>
            <strong>{model.bookingCentreLabel}</strong>
          </div>
          <span className={styles.supportReference}>{model.stateDetail}</span>
        </div>
      ) : null}

      {model ? (
        <WorkbenchSummaryMetricStrip
          ariaLabel="Current book view"
          items={model.metrics.map((metric) => ({
            key: metric.label,
            label: metric.label,
            value: metric.value,
            support: metric.detail,
          }))}
        />
      ) : null}

      <SectionBlock
        title="Assigned portfolios"
        subtitle="Find a confirmed assignment and continue into its portfolio review."
      >
        <form
          className={styles.filterToolbar}
          onSubmit={applyFilters}
          aria-label="Book view controls"
        >
          <div className={styles.field}>
            <FieldLabel htmlFor="advisor-book-client-reference">Client reference</FieldLabel>
            <input
              id="advisor-book-client-reference"
              value={filterDraft.clientId}
              onChange={(event) =>
                updateFilterDraft({ clientId: event.target.value })
              }
              placeholder="Exact client reference"
              aria-label="Client reference"
              spellCheck={false}
            />
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="advisor-book-mandate">Mandate</FieldLabel>
            <select
              id="advisor-book-mandate"
              aria-label="Mandate"
              value={filterDraft.mandateType}
              onChange={(event) =>
                updateFilterDraft({ mandateType: event.target.value })
              }
            >
              <option value="">All supported mandates</option>
              <option value="ADVISORY">Advisory</option>
              <option value="DISCRETIONARY">Discretionary</option>
            </select>
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="advisor-book-sort">Sort by</FieldLabel>
            <select
              id="advisor-book-sort"
              aria-label="Sort by"
              value={filterDraft.sortBy}
              onChange={(event) =>
                updateFilterDraft({
                  sortBy: event.target.value as AdvisorBookSortBy,
                })
              }
            >
              <option value="portfolio_id">Portfolio</option>
              <option value="client_id">Client</option>
              <option value="mandate_type">Mandate</option>
            </select>
          </div>
          <div className={styles.field}>
            <FieldLabel htmlFor="advisor-book-sort-order">Direction</FieldLabel>
            <select
              id="advisor-book-sort-order"
              aria-label="Sort direction"
              value={filterDraft.sortOrder}
              onChange={(event) =>
                updateFilterDraft({
                  sortOrder: event.target.value as AdvisorBookSortOrder,
                })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <div className={styles.filterActions}>
            <ActionButton type="submit" priority="primary">Apply view</ActionButton>
            {hasCustomView ? (
              <ActionButton type="button" priority="quiet" onClick={clearView}>
                Clear view
              </ActionButton>
            ) : null}
          </div>
        </form>

        {loading ? (
          <ScreenStatePanel
            kind="loading"
            title="Loading your book"
            body="Confirming portfolio assignments for the selected business date."
            rows={6}
          />
        ) : error ? (
          <ScreenStatePanel
            kind={isWorkbenchPermissionBlockedError(error) ? "permission_blocked" : "error"}
            title={
              isWorkbenchPermissionBlockedError(error)
                ? "Book access is not available"
                : "Your book could not be loaded"
            }
            body={
              isWorkbenchPermissionBlockedError(error)
                ? "Your authenticated role does not currently provide access to this own-book view."
                : "Portfolio assignments are temporarily unavailable. No broader portfolio list has been substituted."
            }
            hint={
              errorEvidence
                ? `${errorEvidence.label} ${errorEvidence.value}. Retry, or contact support if access should be available.`
                : "Retry when portfolio assignments are available."
            }
            action={<ActionButton onClick={() => void reload()}>Retry</ActionButton>}
          />
        ) : response && model && resultScope ? (
          <>
            <div className={styles.resultScope}>
              <div className={styles.resultSummary} aria-live="polite">
                <strong>{resultScope.rangeLabel}</strong>
                <span>{resultScope.viewLabel}</span>
              </div>
              <div className={styles.receiptActions}>
                <WorkbenchDataAge updatedAt={checkedAt} />
                <ActionButton
                  priority="quiet"
                  disabled={rechecking}
                  onClick={() => void reload()}
                >
                  {rechecking ? "Rechecking…" : "Recheck book"}
                </ActionButton>
              </div>
            </div>

            {recheckError ? (
              <p className={styles.recheckFailure} role="status">
                Book recheck failed. The displayed assignments remain from the previous
                successful check.
              </p>
            ) : null}

            <AnalyticsTable
              ariaLabel="Portfolios in my book"
              density="compact"
              variant="portfolio"
              columns={[
                { key: "portfolio", label: "Portfolio" },
                { key: "client", label: "Client reference" },
                { key: "mandate", label: "Mandate" },
                { key: "currency", label: "Currency" },
                { key: "status", label: "Lifecycle" },
                { key: "membership", label: "Assignment basis" },
              ]}
              rows={model.rows.map((row) => ({
                key: row.portfolioId,
                cells: [
                  <div
                    key="portfolio"
                    className={styles.portfolioCell}
                    data-advisor-book-row="portfolio"
                    data-advisor-book-source="advisor-book"
                    data-portfolio-id={row.portfolioId}
                    data-lifecycle-state={row.sourceLifecycleState}
                  >
                    <Link
                      href={buildPortfolioContextHref({
                        pathname: "/book",
                        searchParams,
                        portfolioId: row.portfolioId,
                      })}
                    >
                      {row.portfolioLabel}
                    </Link>
                    <small>
                      {row.portfolioReferenceLabel} · Open Portfolio Review
                    </small>
                  </div>,
                  <span key="client" className={styles.referenceValue}>
                    {row.clientReference}
                  </span>,
                  row.mandateLabel,
                  row.currencyLabel,
                  row.statusLabel,
                  <span key="membership" className={styles.cellDetail}>
                    {row.membershipLabel}
                  </span>,
                ],
              }))}
              emptyState={{
                title: model.stateLabel,
                body: model.stateDetail,
              }}
            />

            <div className={styles.pagination} aria-label="Book pagination">
              <ActionButton
                priority="quiet"
                disabled={response.page.offset === 0}
                onClick={() =>
                  changePage(response.page.offset - response.page.limit)
                }
              >
                Previous
              </ActionButton>
              <span>
                {response.page.returned_count
                  ? `${response.page.offset + 1}–${lastReturned} of ${response.page.total_count}`
                  : `0 of ${response.page.total_count}`}
              </span>
              <ActionButton
                priority="quiet"
                disabled={lastReturned >= response.page.total_count}
                onClick={() =>
                  changePage(response.page.offset + response.page.limit)
                }
              >
                Next
              </ActionButton>
            </div>
          </>
        ) : null}
      </SectionBlock>

      {model ? (
        <details
          className={styles.supportDisclosure}
          data-testid="advisor-book-operating-evidence"
        >
          <summary>
            <span>
              <strong>Book scope and operating evidence</strong>
              <small>
                Review limitations and source references when operational follow-up is needed.
              </small>
            </span>
            <SemanticBadge tone={model.limitations.length ? "warn" : "success"}>
              {model.limitations.length
                ? `${model.limitations.length} ${model.limitations.length === 1 ? "boundary" : "boundaries"}`
                : "No limitations reported"}
            </SemanticBadge>
          </summary>
          <div className={styles.supportDisclosureBody}>
            <section aria-labelledby="advisor-book-operating-boundaries">
              <h3 id="advisor-book-operating-boundaries">Operating boundaries</h3>
              {model.limitations.length ? (
                <ul className={styles.limitations}>
                  {model.limitations.map((limitation) => (
                    <li key={limitation.key}>
                      <strong>{limitation.label}</strong>
                      <p>{limitation.detail}</p>
                      {limitation.occurrenceCount > 1 ? (
                        <small>
                          {limitation.occurrenceCount} related limitations consolidated
                        </small>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No operating limitations were reported for this own-book view.</p>
              )}
            </section>
            <section aria-labelledby="advisor-book-support-references">
              <h3 id="advisor-book-support-references">Support references</h3>
              <DefinitionList
                ariaLabel="Advisor book support references"
                items={model.supportDetails}
              />
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function queryFromSearchParams(
  searchParams: URLSearchParams | Readonly<URLSearchParams>,
  asOfDate: string,
): AdvisorBookQuery {
  const mandateType = searchParams.get("mandateType");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");
  return {
    asOfDate,
    clientId: searchParams.get("clientId") || undefined,
    mandateType:
      mandateType === "ADVISORY" || mandateType === "DISCRETIONARY"
        ? mandateType
        : undefined,
    sortBy:
      sortBy === "client_id" || sortBy === "mandate_type" || sortBy === "portfolio_id"
        ? sortBy
        : "portfolio_id",
    sortOrder: sortOrder === "desc" ? "desc" : "asc",
    offset: nonNegativeInteger(searchParams.get("offset")),
    limit: PAGE_SIZE,
  };
}

function nonNegativeInteger(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function setOptionalQuery(query: URLSearchParams, key: string, value: string) {
  if (value) query.set(key, value);
  else query.delete(key);
}
