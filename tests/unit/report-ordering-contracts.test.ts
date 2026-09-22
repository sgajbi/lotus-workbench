import { describe, expect, it } from "vitest";

import {
  parseReportBatchHandle,
  parseReportBatchStatus,
  parseReportJobHandle,
  parseReportJobListResponse,
  parseReportOrderingResponse,
} from "@/features/report-ordering/contracts";
import {
  buildReportBatchHandle,
  buildReportBatchStatus,
  buildReportJobListResponse,
  buildReportOrderingResponse,
} from "../fixtures/report-ordering-fixtures";

describe("report ordering contracts", () => {
  it("accepts the governed Workbench ordering shape and independent format states", () => {
    const parsed = parseReportOrderingResponse(buildReportOrderingResponse());

    expect(parsed.reportFamilies[0].outputFormats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ formatId: "json", state: "ready" }),
        expect.objectContaining({ formatId: "pdf", state: "unavailable" }),
      ]),
    );
  });

  it("accepts catalogue-driven conditional text fields without relaxing the contract", () => {
    const parsed = parseReportOrderingResponse(buildReportOrderingResponse());

    expect(parsed.reportFamilies[0].configurationFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldId: "advisor_brief_run_id",
          inputType: "text",
          requirement: "conditional",
        }),
      ]),
    );
    expect(parsed.reportFamilies[0].sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionId: "ADVISOR_COMMENTARY",
          dependencyFieldIds: ["advisor_brief_run_id"],
          availability: expect.objectContaining({
            state: "ready",
            reasonCode: "advisor_brief_accepted",
            acceptedBrief: expect.objectContaining({ runId: "abr_accepted_1" }),
          }),
        }),
      ]),
    );
  });

  it.each(["required", "optional"])(
    "rejects Advisor Commentary evidence with %s requirement",
    (requirement) => {
      const response = buildReportOrderingResponse();
      const field = response.reportFamilies[0].configurationFields.find(
        (candidate) => candidate.fieldId === "advisor_brief_run_id",
      );
      if (!field) throw new Error("Advisor commentary field missing");
      field.requirement = requirement;

      expect(() => parseReportOrderingResponse(response)).toThrow(
        "Advisor Commentary evidence must be conditional",
      );
    },
  );

  it.each([
    [
      "missing availability",
      (section: Record<string, unknown>) => delete section.availability,
    ],
    [
      "null availability",
      (section: Record<string, unknown>) => {
        section.availability = null;
      },
    ],
    [
      "missing accepted-brief dependency",
      (section: Record<string, unknown>) => {
        section.dependencyFieldIds = [];
      },
    ],
    [
      "different dependency",
      (section: Record<string, unknown>) => {
        section.dependencyFieldIds = ["benchmark_code"];
      },
    ],
  ])("rejects Advisor Commentary with %s", (_scenario, mutateSection) => {
    const response = buildReportOrderingResponse();
    const section = response.reportFamilies[0].sections.find(
      (candidate) => candidate.sectionId === "ADVISOR_COMMENTARY",
    ) as unknown as Record<string, unknown>;
    mutateSection(section);

    expect(() => parseReportOrderingResponse(response)).toThrow(
      "Section availability must use the implemented Advisor Commentary binding",
    );
  });

  it("rejects duplicate commentary identities before choosing accepted evidence", () => {
    const response = buildReportOrderingResponse();
    const commentary = response.reportFamilies[0].sections.find(
      (section) => section.sectionId === "ADVISOR_COMMENTARY",
    );
    if (!commentary) throw new Error("Advisor commentary section missing");
    const duplicate = structuredClone(commentary);
    if (!duplicate.availability?.acceptedBrief) {
      throw new Error("Accepted commentary fixture missing");
    }
    duplicate.availability.acceptedBrief.runId = "abr_accepted_2";
    response.reportFamilies[0].sections.push(duplicate);

    expect(() => parseReportOrderingResponse(response)).toThrow(
      "Report section identifiers must be unique",
    );
  });

  it.each([
    [
      "ready without accepted evidence",
      (availability: Record<string, unknown>) => {
        delete availability.acceptedBrief;
      },
    ],
    [
      "unavailable with accepted evidence",
      (availability: Record<string, unknown>) => {
        availability.state = "unavailable";
        availability.reasonCode = "advisor_brief_not_reviewed";
      },
    ],
    [
      "accepted reason with unavailable state",
      (availability: Record<string, unknown>) => {
        availability.state = "unavailable";
      },
    ],
    [
      "unrecognized reason",
      (availability: Record<string, unknown>) => {
        availability.state = "unavailable";
        availability.reasonCode = "advisor_brief_assumed_missing";
        delete availability.acceptedBrief;
      },
    ],
    [
      "review evidence without an offset",
      (availability: Record<string, unknown>) => {
        const acceptedBrief = availability.acceptedBrief as Record<
          string,
          unknown
        >;
        acceptedBrief.reviewedAt = "2026-04-22T08:30:00";
      },
    ],
  ])(
    "rejects section availability with %s",
    (_scenario, mutateAvailability) => {
      const response = buildReportOrderingResponse();
      const availability = response.reportFamilies[0].sections[2]
        .availability as Record<string, unknown>;
      mutateAvailability(availability);

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it("keeps absent section availability distinct from unavailable", () => {
    const response = buildReportOrderingResponse();
    delete response.reportFamilies[0].sections[1].availability;

    const parsed = parseReportOrderingResponse(response);

    expect(parsed.reportFamilies[0].sections[1].availability).toBeUndefined();
  });

  it("accepts provider null availability for sections without section-specific evidence", () => {
    const response = buildReportOrderingResponse();
    response.catalogueAvailability.state = "ready";
    for (const section of response.reportFamilies[0].sections) {
      if (section.sectionId !== "ADVISOR_COMMENTARY") {
        (section as Record<string, unknown>).availability = null;
      }
    }

    const parsed = parseReportOrderingResponse(response);

    expect(parsed.catalogueAvailability.state).toBe("ready");
    expect(parsed.reportFamilies[0].sections[0].availability).toBeNull();
    expect(parsed.reportFamilies[0].sections[2].availability?.state).toBe("ready");
  });

  it("rejects invented section-specific availability on unrelated sections", () => {
    const response = buildReportOrderingResponse();
    (response.reportFamilies[0].sections[1] as Record<string, unknown>).availability = {
      state: "ready",
      reasonCode: "advisor_brief_accepted",
      message: "Unrelated section cannot claim brief evidence.",
      acceptedBrief: {
        runId: "abr_accepted_1",
        reviewedBy: "advisor.sg.301",
        reviewedAt: "2026-04-22T08:30:00Z",
      },
    };

    expect(() => parseReportOrderingResponse(response)).toThrow(
      "Section availability must use the implemented Advisor Commentary binding",
    );
  });

  it.each([
    "sections",
    "as_of_date",
    "reporting_currency",
    "benchmark_code",
    "allocation_dimensions",
  ])(
    "rejects a text field that could replace the dedicated %s control",
    (fieldId) => {
      const response = buildReportOrderingResponse();
      response.reportFamilies[0].configurationFields.push({
        fieldId,
        businessLabel: "Conflicting report option",
        description:
          "A generic value must not replace a structured report option.",
        inputType: "text",
        requirement: "optional",
        defaultingPolicy: "caller_optional",
        valueSource: "caller",
        options: [],
      });

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it("rejects a conditional text field without a declared section dependency", () => {
    const response = buildReportOrderingResponse();
    response.reportFamilies[0].configurationFields.push({
      fieldId: "unbound_advisor_evidence",
      businessLabel: "Unbound advisor evidence",
      description: "Conditional evidence needs a declared business dependency.",
      inputType: "text",
      requirement: "conditional",
      defaultingPolicy: "caller_required_when_section_selected",
      valueSource: "caller",
      options: [],
    });

    expect(() => parseReportOrderingResponse(response)).toThrow();
  });

  it("rejects a report section dependency without an admitted configuration field", () => {
    const response = buildReportOrderingResponse();
    response.reportFamilies[0].sections[0].dependencyFieldIds = [
      "missing_evidence",
    ];

    expect(() => parseReportOrderingResponse(response)).toThrow();
  });

  it("rejects duplicate dependency identities within a report section", () => {
    const response = buildReportOrderingResponse();
    response.reportFamilies[0].sections[2].dependencyFieldIds = [
      "advisor_brief_run_id",
      "advisor_brief_run_id",
    ];

    expect(() => parseReportOrderingResponse(response)).toThrow();
  });

  it.each(["gateway_eligible_benchmark", "report_catalogue"])(
    "rejects an editable text field owned by %s",
    (valueSource) => {
      const response = buildReportOrderingResponse();
      response.reportFamilies[0].configurationFields.push({
        fieldId: "source_owned_reference",
        businessLabel: "Source-owned reference",
        description:
          "A source-owned value must not become an advisor override.",
        inputType: "text",
        requirement: "optional",
        defaultingPolicy: "source_owned",
        valueSource,
        options: [],
      });

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it.each([
    "advisor.note",
    "advisor[brief]",
    "advisor]brief[",
    "advisor:note",
    "advisor/note",
    "Advisor_Note",
    "advisor-note",
  ])("rejects the non-canonical text field identifier %s", (fieldId) => {
    const response = buildReportOrderingResponse();
    response.reportFamilies[0].configurationFields.push({
      fieldId,
      businessLabel: "Advisor evidence",
      description: "The identifier must remain a flat form value.",
      inputType: "text",
      requirement: "optional",
      defaultingPolicy: "caller_optional",
      valueSource: "caller",
      options: [],
    });

    expect(() => parseReportOrderingResponse(response)).toThrow();
  });

  it.each([
    ["as_of_date", "portfolio_date_when_omitted"],
    ["reporting_currency", "caller_required"],
    ["benchmark_code", "caller_required"],
    ["allocation_dimensions", "caller_required"],
  ])(
    "rejects the dedicated %s control with incompatible %s defaulting policy",
    (fieldId, defaultingPolicy) => {
      const response = buildReportOrderingResponse();
      const field = response.reportFamilies[0].configurationFields.find(
        (candidate) => candidate.fieldId === fieldId,
      );
      if (!field) throw new Error(`Fixture field ${fieldId} is missing`);
      field.defaultingPolicy = defaultingPolicy;

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it.each([
    ["status", undefined],
    ["status", null],
    ["status", ""],
    ["currentStep", undefined],
    ["currentStep", null],
    ["currentStep", ""],
  ])(
    "admits missing lifecycle evidence for fail-closed row rendering: %s=%s",
    (key, value) => {
      const response = buildReportJobListResponse();
      const item = response.items[0] as Record<string, unknown>;
      if (value === undefined) delete item[key];
      else item[key] = value;

      expect(parseReportJobListResponse(response).items).toHaveLength(1);
    },
  );

  it("rejects duplicate configuration field identifiers", () => {
    const response = buildReportOrderingResponse();
    response.reportFamilies[0].configurationFields.push({
      fieldId: "advisor_brief_run_id",
      businessLabel: "Duplicate advisor evidence",
      description: "Configuration identities must remain unambiguous.",
      inputType: "text",
      requirement: "optional",
      defaultingPolicy: "caller_optional",
      valueSource: "caller",
      options: [],
    });

    expect(() => parseReportOrderingResponse(response)).toThrow();
  });

  it.each([
    ["as_of_date", "portfolio_context_or_caller"],
    ["reporting_currency", "report_catalogue"],
    ["benchmark_code", "caller"],
    ["allocation_dimensions", "caller"],
  ])(
    "rejects the dedicated %s control with incompatible %s source authority",
    (fieldId, valueSource) => {
      const response = buildReportOrderingResponse();
      const field = response.reportFamilies[0].configurationFields.find(
        (candidate) => candidate.fieldId === fieldId,
      );
      if (!field) throw new Error(`Fixture field ${fieldId} is missing`);
      field.valueSource = valueSource;

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it.each([
    ["as_of_date", "business_date"],
    ["reporting_currency", "currency"],
    ["benchmark_code", "benchmark"],
    ["allocation_dimensions", "multi_select"],
  ])(
    "rejects a conditional %s field that the ordering form cannot collect",
    (fieldId, inputType) => {
      const response = buildReportOrderingResponse();
      response.reportFamilies[0].configurationFields.push({
        fieldId,
        businessLabel: "Unsupported conditional evidence",
        description: "Evidence that must not be silently omitted.",
        inputType,
        requirement: "conditional",
        defaultingPolicy: "caller_required_when_section_selected",
        valueSource: "caller",
        options: [],
      });

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it.each([
    ["benchmark_code", "benchmark"],
    ["allocation_dimensions", "multi_select"],
  ])(
    "rejects a required %s field whose empty state the form cannot enforce",
    (fieldId, inputType) => {
      const response = buildReportOrderingResponse();
      const field = response.reportFamilies[0].configurationFields.find(
        (candidate) => candidate.fieldId === fieldId,
      );
      if (!field) throw new Error(`Fixture field ${fieldId} is missing`);
      field.inputType = inputType;
      field.requirement = "required";

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it.each([
    ["valuation_date", "business_date"],
    ["settlement_currency", "currency"],
    ["grouping_dimensions", "multi_select"],
  ])(
    "rejects an unimplemented non-text catalogue field %s",
    (fieldId, inputType) => {
      const response = buildReportOrderingResponse();
      response.reportFamilies[0].configurationFields.push({
        fieldId,
        businessLabel: "Unimplemented field",
        description: "A field without a matching Workbench control.",
        inputType,
        requirement: "optional",
        defaultingPolicy: "caller_optional",
        valueSource: "caller",
        options: [],
      });

      expect(() => parseReportOrderingResponse(response)).toThrow();
    },
  );

  it("fails closed when the Gateway contract contains an unknown primary field", () => {
    expect(() =>
      parseReportOrderingResponse({
        ...buildReportOrderingResponse(),
        sourceService: "lotus-report",
      }),
    ).toThrow();
  });

  it("fails closed for unsupported submission paths", () => {
    const altered = buildReportOrderingResponse() as Record<string, unknown>;
    const families = altered.reportFamilies as Array<Record<string, unknown>>;
    const modes = families[0].orderingModes as Array<Record<string, unknown>>;
    modes[0].submission = {
      ...(modes[0].submission as Record<string, unknown>),
      path: "/api/v1/internal/run-anything",
    };

    expect(() => parseReportOrderingResponse(altered)).toThrow();
  });

  it("parses durable job handles and bounded recent-request history", () => {
    expect(
      parseReportJobHandle({
        report_request_id: "rrq_1",
        report_job_id: "rjob_1",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_1",
        idempotency_key: "intent_1",
      }).status,
    ).toBe("accepted");

    const history = parseReportJobListResponse(buildReportJobListResponse());

    expect(history.items[0].portfolioScope.portfolio_ids).toEqual([
      "PB_SG_GLOBAL_BAL_001",
    ]);
  });

  it.each([
    [
      "missing report job",
      {
        report_request_id: "rrq_1",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_1",
        idempotency_key: "intent_1",
      },
    ],
    [
      "empty status reference",
      {
        report_request_id: "rrq_1",
        report_job_id: "rjob_1",
        status: "accepted",
        status_url: "",
        idempotency_key: "intent_1",
      },
    ],
    [
      "non-string request identity",
      {
        report_request_id: 42,
        report_job_id: "rjob_1",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_1",
        idempotency_key: "intent_1",
      },
    ],
    [
      "unexpected receipt field",
      {
        report_request_id: "rrq_1",
        report_job_id: "rjob_1",
        status: "accepted",
        status_url: "/api/v1/report-jobs/rjob_1",
        idempotency_key: "intent_1",
        inferred_success: true,
      },
    ],
  ])("rejects a malformed single-report receipt: %s", (_caseName, receipt) => {
    expect(() => parseReportJobHandle(receipt)).toThrow();
  });

  it("keeps valid report history when a legacy job has no correlation reference", () => {
    const response = buildReportJobListResponse();
    response.items[0].correlationId = "";

    const history = parseReportJobListResponse(response);

    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toEqual(
      expect.objectContaining({
        reportJobId: "rjob_1",
        correlationId: "",
      }),
    );
  });

  it("parses durable batch acceptance and per-portfolio source outcomes", () => {
    expect(parseReportBatchHandle(buildReportBatchHandle()).item_count).toBe(2);
    const status = parseReportBatchStatus(buildReportBatchStatus());
    expect(status.status).toBe("completed_with_failures");
    expect(status.items.map((item) => item.status)).toEqual([
      "succeeded",
      "failed_retryable",
    ]);
  });

  it("fails closed when a batch status invents an unsupported item state", () => {
    const response = buildReportBatchStatus();
    response.items[0].status = "emailed_to_client";
    expect(() => parseReportBatchStatus(response)).toThrow();
  });

  it.each([
    [
      "a mismatched item count",
      (response: ReturnType<typeof buildReportBatchStatus>) => {
        response.item_count = 3;
      },
    ],
    [
      "duplicate materialized portfolios",
      (response: ReturnType<typeof buildReportBatchStatus>) => {
        response.materialized_portfolio_ids[1] =
          response.materialized_portfolio_ids[0];
      },
    ],
    [
      "duplicate outcome positions",
      (response: ReturnType<typeof buildReportBatchStatus>) => {
        response.items[1].item_position = response.items[0].item_position;
      },
    ],
    [
      "duplicate outcome portfolios",
      (response: ReturnType<typeof buildReportBatchStatus>) => {
        response.items[1].portfolio_id = response.items[0].portfolio_id;
      },
    ],
    [
      "an outcome outside the materialized selection",
      (response: ReturnType<typeof buildReportBatchStatus>) => {
        response.items[1].portfolio_id = "PB_SG_UNREVIEWED_003";
      },
    ],
  ])(
    "fails closed when batch status contains %s",
    (_scenario, mutateResponse) => {
      const response = buildReportBatchStatus();
      mutateResponse(response);

      expect(() => parseReportBatchStatus(response)).toThrow();
    },
  );
});
