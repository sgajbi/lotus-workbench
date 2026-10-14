import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import compositeCatalogue from "../fixtures/report-ordering-catalogue-composite.v1.json";
import compositeProvenance from "../fixtures/report-ordering-catalogue-composite.v1.provenance.json";

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
  buildCompositeReportOrderingResponse,
  buildReportJobListResponse,
  buildReportOrderingResponse,
} from "../fixtures/report-ordering-fixtures";

function expectCanonicalCompositeFixture(text: string) {
  const bytes = Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
  expect(bytes.length).toBe(compositeProvenance.fixtureStorage.fixtureBytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(compositeProvenance.fixtureStorage.fixtureSha256);
}

describe("report ordering contracts", () => {
  it("pins the real Gateway service fixture and honest offline/capture provenance without external dependencies", () => {
    expectCanonicalCompositeFixture(readFileSync(compositeProvenance.fixtureStorage.path, "utf8"));
    expect(compositeCatalogue.schemaVersion).toBe("gateway-841-public-service-fixture.v2");
    expect(compositeCatalogue.catalogueProvenance).toMatchObject({ sourceBodyBytes: 13837, sourceBodySha256: compositeProvenance.retainedProducerCapture.bodySha256 });
    expect(compositeCatalogue.generation).toMatchObject({ method: "offline_report_ordering_service", httpRequestCount: 0, catalogueSourceInvocationCount: 1, availabilitySourceInvocationCount: 1 });
    expect(compositeCatalogue.availabilityProvenance).toMatchObject({ provenancePosture: "offline_source_valid_contract_input", sourceContract: { state: "unavailable", reason_code: "advisor_brief_not_reviewed", accepted_brief: null } });
    expect(compositeProvenance.observedReportRuntime.imageContentsVerified).toBe(false);
    expect(compositeCatalogue.requestContext).toMatchObject({ callerHeaders: { "X-Role": "portfolio_manager", "X-Caller-Portfolio-Ids": "PB_SG_GLOBAL_BAL_001" }, selection: { scopeType: "portfolio", scopeId: "PB_SG_GLOBAL_BAL_001" } });
  });

  it.each(["LF", "CRLF"])("accepts the canonical fixture with %s checkout line endings", (lineEnding) => {
    const canonical = readFileSync(compositeProvenance.fixtureStorage.path, "utf8").replace(/\r\n/g, "\n");
    expect(canonical.endsWith("\n")).toBe(true);
    expectCanonicalCompositeFixture(lineEnding === "CRLF" ? canonical.replace(/\n/g, "\r\n") : canonical);
  });

  it.each(["changed content", "missing trailing newline", "extra trailing newline"])("refuses fixture %s after declared line-ending normalization", (alteration) => {
    const canonical = readFileSync(compositeProvenance.fixtureStorage.path, "utf8").replace(/\r\n/g, "\n");
    const altered = alteration === "changed content"
      ? canonical.replace("Composite calculated review", "Composite calculated revieX")
      : alteration === "missing trailing newline" ? canonical.slice(0, -1) : `${canonical}\n`;
    expect(altered).not.toBe(canonical);
    expect(() => expectCanonicalCompositeFixture(altered.replace(/\n/g, "\r\n"))).toThrow();
  });

  it("admits the known composite metadata without treating pinned fields as section editors", () => {
    const response = buildCompositeReportOrderingResponse();
    const parsed = parseReportOrderingResponse(response);
    expect(parsed).toEqual(response);
    expect(parsed.reportFamilies.map((family) => family.reportFamilyId)).toEqual([
      "portfolio_review", "proof_pack", "rebalance_wave", "outcome_review", "composite_review",
    ]);
    const composite = parsed.reportFamilies[4];
    expect(composite.configurationFields.map((field) => [field.fieldId, field.inputType, field.valueSource])).toEqual([
      "composite_selection", "composite_linked_selection", "composite_source_products", "composite_source_context",
      "composite_eligibility_selection", "composite_pooled_selection", "composite_notice_selection",
    ].map((fieldId) => [fieldId, "pinned_source_selection", "caller"]));
    expect(composite.orderingModes[0]).toMatchObject({ modeId: "single_composite", interactive: false, eligibility: { state: "unsupported", reasonCode: "gateway_submission_not_supported" }, submission: null });
    expect(composite.outputFormats).toContainEqual(expect.objectContaining({ formatId: "xlsx", state: "ready", reasonCode: "render_supportability_ready" }));
  });

  it.each([
    "unknown mode", "unknown default format", "unknown output", "unknown input", "unknown value source",
    "extra response field", "extra family field", "extra mode field", "extra output field", "extra configuration field",
    "wrong contract version", "wrong source version", "missing metadata", "unknown state", "duplicate pinned field",
    "unknown pinned identity", "pinned options", "wrong pinned requirement", "wrong pinned policy", "wrong family binding",
    "interactive composite", "ready composite mode", "workflow composite mode", "composite submission", "composite section",
    "missing pinned field", "text editor substitution", "stripped composite portfolio metadata", "stripped composite workflow metadata",
  ])("refuses %s without weakening known composite admission", (scenario) => {
    const response = buildCompositeReportOrderingResponse(true);
    const family = response.reportFamilies[0];
    const mode = family.orderingModes[0];
    const field = family.configurationFields[0];
    switch (scenario) {
      case "unknown mode": mode.modeId = "invented"; break;
      case "unknown default format": mode.defaultOutputFormat = "invented"; break;
      case "unknown output": family.outputFormats[0].formatId = "invented"; break;
      case "unknown input": field.inputType = "invented"; break;
      case "unknown value source": field.valueSource = "pinned_source_selection"; break;
      case "extra response field": Object.assign(response, { authority: "invented" }); break;
      case "extra family field": Object.assign(family, { selection: {} }); break;
      case "extra mode field": Object.assign(mode, { selector: {} }); break;
      case "extra output field": Object.assign(family.outputFormats[0], { download: "/invented" }); break;
      case "extra configuration field": Object.assign(field, { selection: {} }); break;
      case "wrong contract version": response.contractVersion = "workbench-report-ordering.v2"; break;
      case "wrong source version": response.sourceContractVersion = "report-ordering-catalogue.v2"; break;
      case "missing metadata": field.businessLabel = ""; break;
      case "unknown state": mode.eligibility.state = "invented"; break;
      case "duplicate pinned field": family.configurationFields[1] = structuredClone(field); break;
      case "unknown pinned identity": field.fieldId = "composite_invented_selection"; break;
      case "pinned options": field.options.push({ value: "invented", businessLabel: "Invented" }); break;
      case "wrong pinned requirement": field.requirement = "optional"; break;
      case "wrong pinned policy": field.defaultingPolicy = "omitted_preserves_legacy_contract"; break;
      case "wrong family binding": family.reportFamilyId = "portfolio_review"; break;
      case "interactive composite": mode.interactive = true; break;
      case "ready composite mode": mode.eligibility.state = "ready"; break;
      case "workflow composite mode": mode.eligibility.reasonCode = "source_workflow_only"; break;
      case "composite submission": mode.submission = structuredClone(buildCompositeReportOrderingResponse().reportFamilies[0].orderingModes[0].submission); break;
      case "composite section": family.sections.push(structuredClone(buildCompositeReportOrderingResponse().reportFamilies[0].sections[0])); break;
      case "missing pinned field": family.configurationFields.pop(); break;
      case "text editor substitution": field.inputType = "text"; break;
      case "stripped composite portfolio metadata":
        family.orderingModes = [structuredClone(buildCompositeReportOrderingResponse().reportFamilies[0].orderingModes[0])];
        family.configurationFields = [];
        break;
      case "stripped composite workflow metadata":
        family.orderingModes = [structuredClone(buildCompositeReportOrderingResponse().reportFamilies[1].orderingModes[0])];
        family.configurationFields = [];
        break;
    }
    expect(() => parseReportOrderingResponse(response)).toThrow();
  });

  it("preserves explicit scope refusal on composite metadata", () => {
    const response = buildCompositeReportOrderingResponse(true);
    response.scopeEligibility = { state: "permission_blocked", reasonCode: "scope_denied", message: "Access denied." };
    response.reportFamilies[0].eligibility = response.scopeEligibility;
    response.reportFamilies[0].orderingModes[0].eligibility = response.scopeEligibility;
    expect(parseReportOrderingResponse(response)).toEqual(response);
  });

  it.each(["partial", "unavailable"])("retains %s composite source evidence without converting it to ready", (state) => {
    const response = buildCompositeReportOrderingResponse(true);
    const composite = response.reportFamilies[0];
    composite.availability = { state, reasonCode: "source_limit", message: "Exact source limit." };
    composite.outputFormats[1].state = state;
    composite.outputFormats[1].reasonCode = "source_workbook_limit";
    expect(parseReportOrderingResponse(response).reportFamilies[0]).toEqual(composite);
  });

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
