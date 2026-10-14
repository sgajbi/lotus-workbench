import compositeCatalogue from "./report-ordering-catalogue-composite.v1.json";

export function buildCompositeReportOrderingResponse(compositeOnly = false) {
  const response = structuredClone(compositeCatalogue.response);
  if (compositeOnly) {
    response.reportFamilies = response.reportFamilies.filter(
      (family) => family.reportFamilyId === "composite_review",
    );
  }
  return response;
}

export function buildReportOrderingResponse() {
  return {
    contractVersion: "workbench-report-ordering.v1",
    sourceAuthority: "reporting",
    sourceContractVersion: "report-ordering-catalogue.v1",
    scopeSelection: { scopeType: "portfolio", scopeId: "PB_SG_GLOBAL_BAL_001" },
    catalogueAvailability: {
      state: "partial",
      reasonCode: "report_catalogue_partially_available",
      message: "Some report outputs are temporarily unavailable.",
    },
    scopeEligibility: {
      state: "ready",
      reasonCode: "selected_scope_eligible",
      message: "The selected portfolio is available for report ordering.",
    },
    reportFamilies: [
      {
        reportFamilyId: "portfolio_review",
        businessLabel: "Portfolio review report",
        description: "Advisor review pack for a client portfolio.",
        intendedUse: "advisor_client_portfolio_review",
        audienceRoles: ["client_advisor"],
        clientReleasePosture:
          "advisor_review_required_distribution_not_supported",
        orderingModes: [
          {
            modeId: "single_portfolio",
            businessLabel: "Single portfolio",
            description: "Create one report for the selected portfolio.",
            defaultOutputFormat: "json",
            interactive: true,
            eligibility: {
              state: "ready",
              reasonCode: "single_portfolio_ordering_ready",
              message: "This portfolio can be submitted for report creation.",
            },
            submission: {
              capabilityId: "reporting.portfolio_review.single",
              method: "POST",
              path: "/api/v1/reports/portfolio-reviews",
              state: "ready",
              reasonCode: "single_portfolio_ordering_ready",
            },
          },
          {
            modeId: "explicit_portfolio_batch",
            businessLabel: "Portfolio bundle",
            description:
              "Create the same report separately for selected portfolios in your book.",
            defaultOutputFormat: "json",
            interactive: true,
            eligibility: {
              state: "partial",
              reasonCode: "explicit_portfolio_selection_required",
              message:
                "Select the portfolios to include before submitting the report bundle.",
            },
            submission: {
              capabilityId: "reporting.portfolio_review.explicit_batch",
              method: "POST",
              path: "/api/v1/report-batches",
              state: "partial",
              reasonCode: "explicit_portfolio_selection_required",
            },
          },
        ],
        outputFormats: [
          {
            formatId: "json",
            businessLabel: "Structured data package",
            usePosture: "system_integration",
            state: "ready",
            reasonCode: "report_data_ready",
          },
          {
            formatId: "pdf",
            businessLabel: "Governed PDF document",
            usePosture: "governed_document",
            state: "unavailable",
            reasonCode: "render_metadata_unavailable",
          },
        ],
        configurationFields: [
          {
            fieldId: "as_of_date",
            businessLabel: "Report date",
            description: "Business date for reporting evidence.",
            inputType: "business_date",
            requirement: "required",
            defaultingPolicy: "caller_required",
            valueSource: "caller",
            options: [],
          },
          {
            fieldId: "reporting_currency",
            businessLabel: "Reporting currency",
            description: "Currency used for portfolio-level monetary values.",
            inputType: "currency",
            requirement: "optional",
            defaultingPolicy: "portfolio_currency_when_omitted",
            valueSource: "portfolio_context_or_caller",
            options: [],
          },
          {
            fieldId: "benchmark_code",
            businessLabel: "Comparison benchmark",
            description: "Approved benchmark for relative measures.",
            inputType: "benchmark",
            requirement: "optional",
            defaultingPolicy: "portfolio_benchmark_when_omitted",
            valueSource: "gateway_eligible_benchmark",
            options: [],
          },
          {
            fieldId: "allocation_dimensions",
            businessLabel: "Allocation views",
            description:
              "Business dimensions used to group portfolio allocation.",
            inputType: "multi_select",
            requirement: "optional",
            defaultingPolicy: "asset_class_when_omitted",
            valueSource: "report_catalogue",
            options: [
              { value: "asset_class", businessLabel: "Asset class" },
              { value: "currency", businessLabel: "Currency" },
            ],
          },
          {
            fieldId: "advisor_brief_run_id",
            businessLabel: "Accepted advisor brief",
            description:
              "Accepted advisor brief run included as reviewed commentary evidence.",
            inputType: "text",
            requirement: "conditional",
            defaultingPolicy: "caller_required",
            valueSource: "caller",
            options: [],
          },
        ],
        sections: [
          {
            sectionId: "CLIENT_PROFILE",
            businessLabel: "Client and mandate profile",
            description: "Client and mandate context.",
            displayOrder: 10,
            selectionPosture: "required",
            defaultSelected: true,
            dependencyFieldIds: [],
          },
          {
            sectionId: "OVERVIEW",
            businessLabel: "Portfolio overview",
            description: "Headline portfolio value, cash, and review context.",
            displayOrder: 20,
            selectionPosture: "optional",
            defaultSelected: true,
            dependencyFieldIds: [],
          },
          {
            sectionId: "ADVISOR_COMMENTARY",
            businessLabel: "Advisor commentary",
            description:
              "Reviewed advisor commentary for the client conversation.",
            displayOrder: 25,
            selectionPosture: "optional",
            defaultSelected: false,
            dependencyFieldIds: ["advisor_brief_run_id"],
            availability: {
              state: "ready",
              reasonCode: "advisor_brief_accepted",
              message:
                "An accepted Advisor Brief is available for this report context.",
              acceptedBrief: {
                runId: "abr_accepted_1",
                reviewedBy: "advisor.sg.301",
                reviewedAt: "2026-04-22T08:30:00Z",
              },
            },
          },
          {
            sectionId: "PERFORMANCE",
            businessLabel: "Performance review",
            description: "Portfolio returns and benchmark comparison.",
            displayOrder: 40,
            selectionPosture: "optional",
            defaultSelected: true,
            dependencyFieldIds: ["benchmark_code"],
          },
        ],
        availability: {
          state: "partial",
          reasonCode: "report_family_partially_available",
          message: "Available with a reduced set of output formats.",
        },
        eligibility: {
          state: "ready",
          reasonCode: "report_family_eligible",
          message: "This report family is available.",
        },
      },
    ],
  };
}

export function buildReportJobListResponse() {
  return {
    count: 1,
    appliedFilters: { portfolioId: "PB_SG_GLOBAL_BAL_001" },
    items: [
      {
        reportJobId: "rjob_1",
        reportRequestId: "rrq_1",
        reportType: "portfolio_review",
        tenantId: "tenant-sg",
        region: "APAC",
        portfolioScope: { portfolio_ids: ["PB_SG_GLOBAL_BAL_001"] },
        asOfDate: "2026-04-22",
        status: "completed",
        failureCategory: null,
        currentStep: "completed",
        retryEligible: false,
        cancelRequested: false,
        idempotencyKey: "intent_1",
        correlationId: "corr_1",
        createdAt: "2026-04-22T09:00:00Z",
        updatedAt: "2026-04-22T09:01:00Z",
      },
    ],
  };
}

export function buildReportBatchHandle() {
  return {
    batch_id: "rbch_1",
    status: "materialized",
    status_url: "/api/v1/report-batches/rbch_1",
    idempotency_key: "batch_intent_1",
    item_count: 2,
    supportability: null,
    render_supportability: null,
  };
}

export function buildReportBatchStatus() {
  return {
    batch_id: "rbch_1",
    selector_mode: "explicit_portfolio_list",
    tenant_id: "tenant-sg",
    region: "APAC",
    materialized_portfolio_ids: ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
    as_of_date: "2026-04-22",
    requested_output_formats: ["json"],
    reporting_currency: "SGD",
    status: "completed_with_failures",
    item_count: 2,
    status_counts: { succeeded: 1, failed_retryable: 1 },
    items: [
      {
        batch_item_id: "rbit_1",
        item_position: 1,
        portfolio_id: "PB_SG_GLOBAL_BAL_001",
        status: "succeeded",
        report_job_id: "rjob_1",
        attempt_count: 1,
        retry_eligible: false,
        next_retry_at: null,
        last_error_category: null,
        last_error_summary: null,
        created_at: "2026-04-22T09:00:00Z",
        started_at: "2026-04-22T09:00:01Z",
        completed_at: "2026-04-22T09:01:00Z",
        cancelled_at: null,
      },
      {
        batch_item_id: "rbit_2",
        item_position: 2,
        portfolio_id: "PB_SG_INCOME_002",
        status: "failed_retryable",
        report_job_id: null,
        attempt_count: 1,
        retry_eligible: true,
        next_retry_at: "2026-04-22T09:05:00Z",
        last_error_category: "source_unavailable",
        last_error_summary: "Portfolio evidence is temporarily unavailable.",
        created_at: "2026-04-22T09:00:00Z",
        started_at: "2026-04-22T09:00:01Z",
        completed_at: null,
        cancelled_at: null,
      },
    ],
    created_at: "2026-04-22T09:00:00Z",
    updated_at: "2026-04-22T09:01:00Z",
    started_at: "2026-04-22T09:00:01Z",
    completed_at: "2026-04-22T09:01:00Z",
    cancelled_at: null,
    failed_at: null,
    correlation_id: "corr_batch_1",
    trace_id: "trace_batch_1",
    supportability: null,
    render_supportability: null,
  };
}
