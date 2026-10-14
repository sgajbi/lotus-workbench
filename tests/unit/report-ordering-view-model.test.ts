import { describe, expect, it } from "vitest";

import {
  parseReportJobListResponse,
  parseReportOrderingResponse,
  type ReportJobListItem,
} from "@/features/report-ordering/contracts";
import {
  applyReportScopeReadiness,
  buildReportOrderingViewModel,
  configurationFingerprint,
  createReportOrderingConfiguration,
  findPortfolioReviewBatchMode,
  selectedReportConfigurationValues,
  selectReportOrderingFamily,
  toReportRequestRows,
} from "@/features/report-ordering/view-model";
import {
  buildReportJobListResponse,
  buildReportOrderingResponse,
  buildCompositeReportOrderingResponse,
} from "../fixtures/report-ordering-fixtures";

const sourceContext = {
  asOfDate: "2026-04-22",
  reportingCurrency: "SGD",
  earliestReportDate: "2025-01-06",
  latestReportDate: "2026-04-22",
  reportingCurrencies: ["SGD", "USD"],
};

describe("report ordering view model", () => {
  it("keeps all five projected families and separates composite metadata from actual workflows", () => {
    const response = parseReportOrderingResponse(buildCompositeReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(response, sourceContext);
    const model = buildReportOrderingViewModel(response, configuration, sourceContext);
    expect(model.eligibleFamilies.map((family) => family.reportFamilyId)).toEqual(["portfolio_review"]);
    expect(model.workflowManagedFamilies.map((family) => family.reportFamilyId)).toEqual(["proof_pack", "rebalance_wave", "outcome_review"]);
    expect(model.nonOrderableFamilies).toEqual([response.reportFamilies[4]]);
    expect(model.outputChoices.map((output) => output.id)).toEqual(["json", "pdf"]);
    expect(model.canSubmit).toBe(true);
    expect(selectReportOrderingFamily(response, configuration, "composite_review")).toBe(configuration);
  });

  it("cannot configure, review or submit a composite-only publication", () => {
    const response = parseReportOrderingResponse(buildCompositeReportOrderingResponse(true));
    const configuration = createReportOrderingConfiguration(response, sourceContext);
    const model = buildReportOrderingViewModel(response, configuration, sourceContext);
    expect(configuration).toMatchObject({ familyId: "", modeId: "", configurationValues: {}, selectedSections: [], outputFormat: "json" });
    expect(model.family).toBeNull();
    expect(model.mode).toBeNull();
    expect(model.outputChoices).toEqual([]);
    expect(model.sectionChoices).toEqual([]);
    expect(model.workflowManagedFamilies).toEqual([]);
    expect(model.nonOrderableFamilies).toEqual(response.reportFamilies);
    expect(model.canSubmit).toBe(false);
    expect(model.canReview).toBe(false);
  });

  it("excludes XLSX even if a supported family publishes it as its preferred ready output", () => {
    const payload = buildCompositeReportOrderingResponse();
    const family = payload.reportFamilies[0];
    family.outputFormats.unshift(structuredClone(payload.reportFamilies[4].outputFormats[1]));
    family.orderingModes[0].defaultOutputFormat = "xlsx";
    const response = parseReportOrderingResponse(payload);
    const configuration = createReportOrderingConfiguration(response, sourceContext);
    expect(configuration.outputFormat).toBe("json");
    const model = buildReportOrderingViewModel(response, configuration, sourceContext);
    expect(model.outputChoices.map((output) => output.id)).toEqual(["json", "pdf"]);
    expect(buildReportOrderingViewModel(response, { ...configuration, outputFormat: "xlsx" } as unknown as typeof configuration, sourceContext).canSubmit).toBe(false);
  });

  it.each(["portfolio", "workflow"])("keeps composite identity non-orderable when unchecked %s metadata strips its pins", (mode) => {
    const response = parseReportOrderingResponse(buildCompositeReportOrderingResponse(true));
    const ordinary = parseReportOrderingResponse(buildCompositeReportOrderingResponse());
    const composite = response.reportFamilies[0];
    composite.orderingModes = [ordinary.reportFamilies[mode === "portfolio" ? 0 : 1].orderingModes[0]];
    composite.configurationFields = [];
    const configuration = createReportOrderingConfiguration(response, sourceContext);
    const model = buildReportOrderingViewModel(response, configuration, sourceContext);
    expect(configuration.familyId).toBe("");
    expect(model.eligibleFamilies).toEqual([]);
    expect(model.workflowManagedFamilies).toEqual([]);
    expect(model.nonOrderableFamilies).toEqual([composite]);
    expect(model.canReview).toBe(false);
    expect(model.canSubmit).toBe(false);
  });

  it.each([false, true])("preserves source unavailability with retained families=%s for single and batch actions", (retainFamilies) => {
    const payload = buildReportOrderingResponse();
    payload.catalogueAvailability = {
      state: "unavailable", reasonCode: "report_catalogue_contract_invalid",
      message: "Report choices are temporarily unavailable.",
    };
    if (!retainFamilies) payload.reportFamilies = [];
    const response = parseReportOrderingResponse(payload);
    const model = buildReportOrderingViewModel(
      response, createReportOrderingConfiguration(response, sourceContext), sourceContext,
    );
    expect(model.catalogueAvailability).toEqual(response.catalogueAvailability);
    expect(model.scopeEligibility).toEqual(response.scopeEligibility);
    for (const candidate of [model, applyReportScopeReadiness(model, "explicit_portfolio_batch", ["P1", "P2"])]) {
      expect(candidate.canSubmit).toBe(false);
      expect(candidate.canReview).toBe(false);
      expect(candidate.readiness.issues).toContain(payload.catalogueAvailability.message);
    }
  });

  it("selects the source-ready JSON path while keeping unavailable PDF visible", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(configuration.outputFormat).toBe("json");
    expect(model.canSubmit).toBe(true);
    expect(model.readiness.title).toBe("Ready with available outputs");
    expect(model.outputChoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "json", available: true }),
        expect.objectContaining({
          id: "pdf",
          available: false,
          supportReason: expect.stringContaining("temporarily unavailable"),
        }),
      ]),
    );
  });

  it("keeps required sections selected and blocks invalid report dates", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    configuration.asOfDate = "not-a-date";
    configuration.selectedSections = [];
    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(model.canSubmit).toBe(false);
    expect(model.readiness.issues).toEqual(
      expect.arrayContaining([
        "Select a valid report date.",
        "Client and mandate profile is required.",
        "Select at least one report section.",
      ]),
    );
  });

  it("blocks report dates outside the source-confirmed portfolio range", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    configuration.asOfDate = "2026-04-23";

    expect(
      buildReportOrderingViewModel(response, configuration, sourceContext)
        .readiness.issues,
    ).toContain("Select a report date from 06 Jan 2025 to 22 Apr 2026.");
  });

  it("blocks reporting currencies not confirmed by the portfolio source", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    configuration.reportingCurrency = "XYZ";

    expect(
      buildReportOrderingViewModel(response, configuration, sourceContext)
        .readiness.issues,
    ).toContain("Select a reporting currency confirmed for this portfolio.");
    expect(
      buildReportOrderingViewModel(
        response,
        {
          ...configuration,
          reportingCurrency: "",
        },
        sourceContext,
      ).canSubmit,
    ).toBe(false);
  });

  it("does not validate reporting currency when the selected family does not publish it", () => {
    const payload = buildReportOrderingResponse();
    payload.reportFamilies[0].configurationFields =
      payload.reportFamilies[0].configurationFields.filter(
        (field) => field.fieldId !== "reporting_currency",
      );
    const response = parseReportOrderingResponse(payload);
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    configuration.reportingCurrency = "XYZ";

    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(model.canSubmit).toBe(true);
    expect(model.readiness.issues).not.toContain(
      "Select a reporting currency confirmed for this portfolio.",
    );
  });

  it("surfaces permission posture without exposing raw reason codes as primary copy", () => {
    const payload = buildReportOrderingResponse();
    payload.scopeEligibility = {
      state: "permission_blocked",
      reasonCode: "selected_scope_not_entitled",
      message: "The selected portfolio is not available to this user.",
    };
    payload.reportFamilies = [];
    const response = parseReportOrderingResponse(payload);
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(model.canSubmit).toBe(false);
    expect(model.readiness.issues.join(" ")).toContain(
      "The selected portfolio is not available to this user.",
    );
    expect(model.readiness.issues.join(" ")).not.toContain(
      "selected_scope_not_entitled",
    );
  });

  it("normalizes set ordering when deciding whether a preflight became stale", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const first = createReportOrderingConfiguration(response, sourceContext);
    first.selectedSections = ["OVERVIEW", "CLIENT_PROFILE"];
    const second = {
      ...first,
      selectedSections: ["CLIENT_PROFILE", "OVERVIEW"],
    };

    expect(configurationFingerprint(first)).toBe(
      configurationFingerprint(second),
    );
    expect(
      configurationFingerprint({ ...second, asOfDate: "2026-04-23" }),
    ).not.toBe(configurationFingerprint(first));
  });

  it("labels completed report data separately from archive and client delivery", () => {
    const rows = toReportRequestRows(buildReportJobListResponse().items);

    expect(rows[0]).toEqual(
      expect.objectContaining({
        reportDate: "22 Apr 2026",
        requestedAt: "22 Apr 2026, 09:00 UTC",
        statusLabel: "Report data complete",
        statusDetail: expect.stringContaining(
          "Archive and client delivery remain separate",
        ),
        tone: "success",
      }),
    );
  });

  it("fails closed when Reporting returns an unmapped lifecycle step", () => {
    const response = buildReportJobListResponse();
    response.items[0].currentStep = "SOMETHING_NEW";

    expect(toReportRequestRows(response.items)[0]).toEqual(
      expect.objectContaining({
        statusLabel: "Status not reported",
        tone: "default",
      }),
    );
  });

  it.each([
    ["status", undefined],
    ["status", null],
    ["status", ""],
    ["currentStep", undefined],
    ["currentStep", null],
    ["currentStep", ""],
  ])("keeps the affected request visible when %s is %s", (key, value) => {
    const response = buildReportJobListResponse();
    const item = response.items[0] as Record<string, unknown>;
    if (value === undefined) delete item[key];
    else item[key] = value;

    const parsed = parseReportJobListResponse(response);
    expect(toReportRequestRows(parsed.items)[0]).toEqual(
      expect.objectContaining({
        statusLabel: "Status not reported",
        tone: "default",
      }),
    );
  });

  it("explains incomplete source data without exposing a failure code", () => {
    const response = buildReportJobListResponse();
    const item = {
      ...response.items[0],
      status: "failed",
      currentStep: "failed",
      failureCategory: "data_incomplete",
    } as ReportJobListItem;

    const row = toReportRequestRows([item])[0];
    expect(row.statusDetail).toContain(
      "could not be completed from its sources",
    );
    expect(JSON.stringify(row)).not.toContain("data_incomplete");
  });

  it("normalizes report request instants to disclosed UTC and fails closed without a source zone", () => {
    const [request] = buildReportJobListResponse().items;
    const [normalized] = toReportRequestRows([
      { ...request, createdAt: "2026-04-22T17:00:00+08:00" },
    ]);
    const [unconfirmed] = toReportRequestRows([
      { ...request, createdAt: "2026-04-22T09:00:00" },
    ]);

    expect(normalized?.requestedAt).toBe("22 Apr 2026, 09:00 UTC");
    expect(unconfirmed?.requestedAt).toBe("Time unavailable");
    expect(JSON.stringify(unconfirmed)).not.toContain("2026-04-22T09:00:00");
  });

  it("separates directly orderable reports from evidence created by governed workflows", () => {
    const payload = buildReportOrderingResponse();
    const workflowFamily = structuredClone(payload.reportFamilies[0]);
    const response = parseReportOrderingResponse({
      ...payload,
      reportFamilies: [
        ...payload.reportFamilies,
        {
          ...workflowFamily,
          reportFamilyId: "proof_pack",
          businessLabel: "Pre-trade decision evidence",
          orderingModes: [
            {
              modeId: "source_workflow",
              businessLabel: "Advisory workflow",
              description: "Created as part of an approved advisory decision.",
              defaultOutputFormat: "json",
              interactive: false,
              eligibility: {
                state: "ready",
                reasonCode: "source_workflow_ready",
                message: "Created from its source business workflow.",
              },
            },
          ],
        },
      ],
    });
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(
      model.eligibleFamilies.map((family) => family.reportFamilyId),
    ).toEqual(["portfolio_review"]);
    expect(
      model.workflowManagedFamilies.map((family) => family.reportFamilyId),
    ).toEqual(["proof_pack"]);
    expect(model.canSubmit).toBe(true);
  });

  it("rebuilds family-owned defaults when selecting another orderable report", () => {
    const payload = buildReportOrderingResponse();
    const alternateFamily = structuredClone(payload.reportFamilies[0]);
    alternateFamily.reportFamilyId = "portfolio_review_condensed";
    alternateFamily.businessLabel = "Condensed portfolio review";
    alternateFamily.sections = [
      {
        ...alternateFamily.sections[0],
        sectionId: "CONDENSED_PROFILE",
        businessLabel: "Condensed client profile",
        dependencyFieldIds: ["advisor_brief_run_id"],
      },
    ];
    const response = parseReportOrderingResponse({
      ...payload,
      reportFamilies: [...payload.reportFamilies, alternateFamily],
    });
    const current = createReportOrderingConfiguration(response, sourceContext);
    current.configurationValues.advisor_brief_run_id = "abr_previous";
    current.allocationDimensions = ["asset_class"];

    const selected = selectReportOrderingFamily(
      response,
      current,
      "portfolio_review_condensed",
    );

    expect(selected).toEqual(
      expect.objectContaining({
        familyId: "portfolio_review_condensed",
        modeId: "single_portfolio",
        selectedSections: ["CONDENSED_PROFILE"],
        configurationValues: { advisor_brief_run_id: "" },
        allocationDimensions: [],
      }),
    );
  });

  it("does not restore context-bound defaults without current availability evidence", () => {
    const payload = buildReportOrderingResponse();
    const alternateFamily = structuredClone(payload.reportFamilies[0]);
    alternateFamily.reportFamilyId = "portfolio_review_condensed";
    alternateFamily.businessLabel = "Condensed portfolio review";
    const commentary = alternateFamily.sections.find(
      (section) => section.sectionId === "ADVISOR_COMMENTARY",
    );
    if (!commentary) throw new Error("Advisor commentary fixture missing");
    commentary.defaultSelected = true;
    const response = parseReportOrderingResponse({
      ...payload,
      reportFamilies: [...payload.reportFamilies, alternateFamily],
    });
    const current = createReportOrderingConfiguration(response, sourceContext);

    const selected = selectReportOrderingFamily(
      response,
      current,
      "portfolio_review_condensed",
      "unavailable",
    );

    expect(selected.selectedSections).not.toContain("ADVISOR_COMMENTARY");
    expect(selected.configurationValues.advisor_brief_run_id).toBe("");
  });

  it("blocks a retained commentary selection when current evidence is unavailable", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    configuration.selectedSections.push("ADVISOR_COMMENTARY");

    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
      "unavailable",
    );

    expect(model.canSubmit).toBe(false);
    expect(model.readiness.issues).toContain(
      "Confirm reviewed commentary for the current report date and currency, or remove it from this request.",
    );
  });

  it("submits the exact source-bound accepted brief only for its selected section", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    configuration.selectedSections.push("ADVISOR_COMMENTARY");

    expect(configuration.configurationValues.advisor_brief_run_id).toBe(
      "abr_accepted_1",
    );
    expect(
      buildReportOrderingViewModel(response, configuration, sourceContext)
        .canSubmit,
    ).toBe(true);
    expect(
      selectedReportConfigurationValues(
        response.reportFamilies[0],
        configuration,
      ),
    ).toEqual({
      advisor_brief_run_id: "abr_accepted_1",
    });

    configuration.selectedSections = configuration.selectedSections.filter(
      (sectionId) => sectionId !== "ADVISOR_COMMENTARY",
    );
    expect(
      selectedReportConfigurationValues(
        response.reportFamilies[0],
        configuration,
      ),
    ).toEqual({});
  });

  it.each([
    ["advisor_brief_not_reviewed", "Review required", "advisor_brief"],
    [
      "advisor_brief_context_mismatch",
      "Different report context",
      "advisor_brief",
    ],
    [
      "advisor_brief_availability_unknown",
      "Availability not confirmed",
      "refresh",
    ],
  ] as const)(
    "keeps unavailable commentary fail closed for %s",
    (reasonCode, label, recovery) => {
      const payload = buildReportOrderingResponse();
      const commentary = payload.reportFamilies[0].sections.find(
        (section) => section.sectionId === "ADVISOR_COMMENTARY",
      );
      if (!commentary) throw new Error("Advisor commentary fixture missing");
      const availability = commentary.availability as {
        state: string;
        reasonCode: string;
        message: string;
        acceptedBrief?: unknown;
      };
      availability.state = "unavailable";
      availability.reasonCode = reasonCode;
      availability.message = "Source-owned availability message.";
      delete availability.acceptedBrief;
      const response = parseReportOrderingResponse(payload);
      const configuration = createReportOrderingConfiguration(
        response,
        sourceContext,
      );
      configuration.selectedSections.push("ADVISOR_COMMENTARY");
      configuration.configurationValues.advisor_brief_run_id = "manual_run";

      const section = buildReportOrderingViewModel(
        response,
        configuration,
        sourceContext,
      ).sectionChoices.find(
        (candidate) => candidate.id === "ADVISOR_COMMENTARY",
      );

      expect(section).toEqual(
        expect.objectContaining({
          selected: false,
          selectable: false,
          availabilityLabel: label,
          recovery,
          acceptedBrief: null,
        }),
      );
    },
  );

  it("does not retain unavailable default commentary as a hidden selection", () => {
    const payload = buildReportOrderingResponse();
    const commentary = payload.reportFamilies[0].sections.find(
      (section) => section.sectionId === "ADVISOR_COMMENTARY",
    );
    if (!commentary) throw new Error("Advisor commentary fixture missing");
    commentary.defaultSelected = true;
    const availability = commentary.availability as {
      state: string;
      reasonCode: string;
      message: string;
      acceptedBrief?: unknown;
    };
    availability.state = "unavailable";
    availability.reasonCode = "advisor_brief_not_reviewed";
    availability.message = "Review and accept the Advisor Brief first.";
    delete availability.acceptedBrief;

    const response = parseReportOrderingResponse(payload);
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    const model = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(configuration.selectedSections).not.toContain(
      "ADVISOR_COMMENTARY",
    );
    expect(model.canSubmit).toBe(true);
    expect(
      model.sectionChoices.find(
        (section) => section.id === "ADVISOR_COMMENTARY",
      ),
    ).toEqual(
      expect.objectContaining({
        selected: false,
        selectable: false,
        availabilityLabel: "Review required",
      }),
    );
  });

  it("requires a source-published batch capability and at least two selected portfolios", () => {
    const response = parseReportOrderingResponse(buildReportOrderingResponse());
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    const baseModel = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(
      findPortfolioReviewBatchMode(baseModel.family)?.submission?.path,
    ).toBe("/api/v1/report-batches");
    expect(
      applyReportScopeReadiness(baseModel, "explicit_portfolio_batch", [
        "PB_SG_GLOBAL_BAL_001",
      ]).readiness.issues,
    ).toContain(
      "Select at least two portfolios from your book for a portfolio bundle.",
    );
    expect(
      applyReportScopeReadiness(baseModel, "explicit_portfolio_batch", [
        "PB_SG_GLOBAL_BAL_001",
        "PB_SG_INCOME_002",
      ]),
    ).toEqual(expect.objectContaining({ canSubmit: true }));
    expect(
      applyReportScopeReadiness(
        baseModel,
        "explicit_portfolio_batch",
        ["PB_SG_GLOBAL_BAL_001", "PB_SG_INCOME_002"],
        "error",
      ),
    ).toEqual(expect.objectContaining({ canSubmit: false }));
  });

  it("keeps bundle readiness independent when single-portfolio ordering is unavailable", () => {
    const payload = buildReportOrderingResponse();
    const singleMode = payload.reportFamilies[0].orderingModes[0];
    singleMode.interactive = false;
    singleMode.eligibility.state = "unavailable";
    singleMode.eligibility.reasonCode = "single_portfolio_unavailable";
    singleMode.submission.state = "unavailable";
    singleMode.submission.reasonCode = "single_portfolio_unavailable";
    const response = parseReportOrderingResponse(payload);
    const configuration = createReportOrderingConfiguration(
      response,
      sourceContext,
    );
    const baseModel = buildReportOrderingViewModel(
      response,
      configuration,
      sourceContext,
    );

    expect(baseModel.family?.reportFamilyId).toBe("portfolio_review");
    expect(baseModel.readiness.issues).toContain(
      "Single-portfolio ordering is not currently available for this report.",
    );
    expect(
      applyReportScopeReadiness(baseModel, "explicit_portfolio_batch", [
        "PB_SG_GLOBAL_BAL_001",
        "PB_SG_INCOME_002",
      ]),
    ).toEqual(
      expect.objectContaining({
        canSubmit: true,
        readiness: expect.objectContaining({ state: "ready", issues: [] }),
      }),
    );
  });

  it("accepts only the governed selection-required batch capability posture", () => {
    const payload = buildReportOrderingResponse();
    const mode = payload.reportFamilies[0].orderingModes[1];

    mode.eligibility.reasonCode = "report_family_partially_available";
    expect(
      findPortfolioReviewBatchMode(
        parseReportOrderingResponse(payload).reportFamilies[0],
      ),
    ).toBeNull();

    mode.eligibility.reasonCode = "explicit_portfolio_selection_required";
    mode.submission.reasonCode = "report_family_partially_available";
    expect(
      findPortfolioReviewBatchMode(
        parseReportOrderingResponse(payload).reportFamilies[0],
      ),
    ).toBeNull();
  });

  it("fails closed when the published batch path is not the governed Gateway endpoint", () => {
    const payload = buildReportOrderingResponse();
    payload.reportFamilies[0].orderingModes[1].submission.path =
      "/api/v1/internal/batches";

    expect(() => parseReportOrderingResponse(payload)).toThrow();
  });
});
