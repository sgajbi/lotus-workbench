import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertFullValidationOutputBoundary,
  resolveValidationConfig,
} from "../../scripts/live/validation/args.mjs";
import {
  DEFAULT_CANONICAL_CONTRACT,
  DEFAULT_PANEL_REGISTRY,
} from "../../scripts/live/validation/contract-metadata.mjs";
import {
  buildSummaryPaths,
  createValidationSummary,
  ensureDirectory,
  writeShotIndex,
  writeValidationSummary,
} from "../../scripts/live/validation/evidence-summary-writer.mjs";

describe("live validation contract modules", () => {
  it("resolves canonical defaults and normalizes trailing slashes", () => {
    const config = resolveValidationConfig(
      [
        "--workbench-base-url",
        "http://workbench.dev.lotus///",
        "--gateway-base-url",
        "http://gateway.dev.lotus//",
        "--timeout-ms",
        "45000",
        "--idea-candidate-id",
        "idea_low_income_ef02ad8793485081",
      ],
      "C:\\lotus-workbench",
    );

    expect(config.portfolioId).toBe("PB_SG_GLOBAL_BAL_001");
    expect(config.benchmarkCode).toBe("BMK_PB_GLOBAL_BALANCED_60_40");
    expect(config.workbenchBaseUrl).toBe("http://workbench.dev.lotus");
    expect(config.gatewayBaseUrl).toBe("http://gateway.dev.lotus");
    expect(config.ideaBaseUrl).toBe("http://127.0.0.1:8330");
    expect(config.timeoutMs).toBe(45000);
    expect(config.ideaCandidateId).toBe("idea_low_income_ef02ad8793485081");
    expect(config.ideaCandidateLifecycle).toBe("ready_for_review");
    expect(config.validationProfile).toBe("client-demo");
    expect(config.outputDir).toContain("output");
    expect(config.outputDir).toContain("diagnostic-client-demo");
    expect(config.mainlineSourceProvenancePath).toBeNull();
  });

  it("accepts only governed Idea restart lifecycle states", () => {
    expect(
      resolveValidationConfig(["--idea-candidate-lifecycle", "approved"])
        .ideaCandidateLifecycle,
    ).toBe("approved");
    expect(
      resolveValidationConfig([
        "--idea-candidate-lifecycle",
        "converted_to_proposal",
      ]).ideaCandidateLifecycle,
    ).toBe("converted_to_proposal");
    expect(() =>
      resolveValidationConfig(["--idea-candidate-lifecycle", "generated"]),
    ).toThrow("Unsupported canonical Idea candidate lifecycle");
  });

  it("requires an explicit supported demo profile and records its non-proof boundary", async () => {
    const config = resolveValidationConfig([
      "--validation-profile",
      "client-demo",
    ]);
    expect(config.validationProfile).toBe("client-demo");
    expect(() =>
      resolveValidationConfig(["--validation-profile", "skip-idea"]),
    ).toThrow("Unsupported canonical validation profile");
    const summary = createValidationSummary({
      portfolioId: "PB_SG_GLOBAL_BAL_001",
      benchmarkCode: "BMK_PB_GLOBAL_BALANCED_60_40",
      canonicalContract: DEFAULT_CANONICAL_CONTRACT,
      panelRegistry: DEFAULT_PANEL_REGISTRY,
      workbenchBaseUrl: "http://workbench.dev.lotus",
      gatewayBaseUrl: "http://gateway.dev.lotus",
      validationProfile: config.validationProfile,
    });
    expect(summary.validationProfile).toBe("client-demo");
    expect(summary.excludedProofs).toEqual([
      expect.objectContaining({
        proofScope: "idea.presentation_backed_downstream_capacity_probe",
        owningIssue: "sgajbi/lotus-idea#1345",
      }),
    ]);
    expect(summary.excludedProofs[0].claimBoundary).toContain(
      "No Idea downstream-capacity acceptance",
    );
    const tempDir = mkdtempSync(join(tmpdir(), "lotus-client-demo-profile-"));
    try {
      const { shotIndexPath, summaryPath } = buildSummaryPaths(tempDir);
      await writeValidationSummary(summaryPath, summary);
      await writeShotIndex(shotIndexPath, summary, summaryPath);
      const persisted = JSON.parse(readFileSync(summaryPath, "utf8"));
      expect(persisted.excludedProofs).toHaveLength(1);
      expect(readFileSync(shotIndexPath, "utf8")).toContain(
        "Excluded proof: idea.presentation_backed_downstream_capacity_probe",
      );
      expect(readFileSync(shotIndexPath, "utf8")).toContain(
        "No Idea downstream-capacity acceptance or full-profile certification",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps full browser output in governed diagnostic staging", () => {
    expect(() =>
      assertFullValidationOutputBoundary({
        validationProfile: "full",
        outputDir: join(
          "lotus-workbench",
          "output",
          "playwright",
          "live-canonical",
        ),
      }),
    ).toThrow("canonical publication requires the post-browser capacity probe");
    const tempDir = mkdtempSync(join(tmpdir(), "lotus-full-staging-"));
    const stagingDir = join(
      tempDir,
      "diagnostic-live-canonical-pending-0123456789abcdef0123456789abcdef",
    );
    const linkedDir = join(
      tempDir,
      "diagnostic-live-canonical-pending-fedcba9876543210fedcba9876543210",
    );
    const linkTarget = join(tempDir, "published-target");
    try {
      mkdirSync(stagingDir);
      mkdirSync(linkTarget);
      symlinkSync(linkTarget, linkedDir, "junction");
      expect(() =>
        assertFullValidationOutputBoundary({
          validationProfile: "full",
          outputDir: stagingDir,
        }),
      ).not.toThrow();
      expect(() =>
        assertFullValidationOutputBoundary({
          validationProfile: "full",
          outputDir: linkedDir,
        }),
      ).toThrow("refuses linked");
      expect(() =>
        assertFullValidationOutputBoundary({
          validationProfile: "full",
          outputDir: join(
            tempDir,
            "diagnostic-live-canonical-pending-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          ),
        }),
      ).toThrow("orchestration-created staging directory");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
    expect(() =>
      assertFullValidationOutputBoundary({
        validationProfile: "client-demo",
        outputDir: join(
          "lotus-workbench",
          "output",
          "playwright",
          "diagnostic-client-demo",
        ),
      }),
    ).not.toThrow();
  });

  it("builds governed summary evidence with registry metadata and writable artifacts", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "lotus-validation-"));

    try {
      const { summaryPath, shotIndexPath } = buildSummaryPaths(tempDir);
      const summary = createValidationSummary({
        generatedAt: "2026-04-11T00:00:00.000Z",
        portfolioId: DEFAULT_CANONICAL_CONTRACT.portfolioId,
        benchmarkCode: DEFAULT_CANONICAL_CONTRACT.benchmarkCode,
        canonicalContract: {
          ...DEFAULT_CANONICAL_CONTRACT,
          sourcePath: "deterministic-fallback",
        },
        panelRegistry: DEFAULT_PANEL_REGISTRY,
        workbenchBaseUrl: "http://workbench.dev.lotus",
        gatewayBaseUrl: "http://gateway.dev.lotus",
      });

      summary.screenshots.push({
        name: "performance-risk-live.png",
        path: join(tempDir, "performance-risk-live.png"),
        route: "/performance?portfolioId=PB_SG_GLOBAL_BAL_001&mode=risk",
        panel: "performance.risk.snapshot",
        portfolioId: DEFAULT_CANONICAL_CONTRACT.portfolioId,
        benchmarkCode: DEFAULT_CANONICAL_CONTRACT.benchmarkCode,
        asOfDate: DEFAULT_CANONICAL_CONTRACT.canonicalAsOfDate,
        state: "demo_ready",
      });

      await ensureDirectory(tempDir);
      await writeValidationSummary(summaryPath, summary);
      await writeShotIndex(shotIndexPath, summary, summaryPath);

      const persistedSummary = JSON.parse(readFileSync(summaryPath, "utf8"));
      const shotIndex = readFileSync(shotIndexPath, "utf8");

      expect(persistedSummary.panelRegistry.contractId).toBe(
        "workbench-panel-registry",
      );
      expect(persistedSummary.panelRegistry.governedByRfc).toBe("RFC-0077");
      expect(persistedSummary.canonicalContract.contractId).toBe(
        "canonical-front-office-demo-data-contract",
      );
      expect(
        persistedSummary.canonicalContract.dpmCommandCenter
          .multiPortfolioWaveScenario.minimumPortfolioCount,
      ).toBe(3);
      expect(
        persistedSummary.canonicalContract.dpmCommandCenter
          .multiPortfolioWaveScenario.portfolios,
      ).toHaveLength(3);
      expect(
        persistedSummary.canonicalContract.dpmCommandCenter
          .workbenchCallerTenantId,
      ).toBe("tenant-sg");
      expect(shotIndex).toContain("performance-risk-live.png");
      expect(shotIndex).toContain("performance.risk.snapshot");
      expect(shotIndex).toContain(
        "Validation summary: live-validation-summary.json",
      );
      expect(shotIndex).not.toContain(tempDir);
      expect(persistedSummary.screenshots[0].path).toBe(
        "performance-risk-live.png",
      );
      expect(shotIndex).toContain("2026-04-10");
      expect(persistedSummary.workflowPackChecks).toEqual([]);
      expect(persistedSummary.advisorBookChecks).toEqual([]);
      expect(persistedSummary.ideaCapacityProbe).toEqual({
        status: "pending_post_browser_probe",
        productionCapacityCertified: false,
      });
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "advisor.book_overview" &&
            panel.screenshotName === "advisor-book-overview-live.png" &&
            panel.gatewayEndpoint === "/api/v1/advisor-book/portfolios",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.every(
          (panel) => !panel.route.includes("{portfolioId}"),
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "reporting.report_centre" &&
            panel.screenshotName === "reporting-report-centre-live.png" &&
            panel.gatewayEndpoint === "/api/v1/report-ordering/options",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "dpm.portfolio_memory" &&
            panel.gatewayEndpoint ===
              "/api/v1/dpm/command-center/portfolios/{portfolio_id}/memory",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "dpm.construction_alternatives" &&
            panel.screenshotName === "dpm-construction-alternatives-live.png",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "dpm.pm_operating_quality" &&
            panel.gatewayEndpoint ===
              "/api/v1/dpm/command-center/pm-operating-quality/score-runs",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "dpm.copilot_workspace" &&
            panel.owningService === "lotus-ai",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "proposal.memo_evidence_pack" &&
            panel.screenshotName === "proposal-memo-evidence-pack-live.png" &&
            panel.owningService === "lotus-advise",
        ),
      ).toBe(true);
      expect(
        DEFAULT_PANEL_REGISTRY.panels.some(
          (panel) =>
            panel.panelId === "advisory.bank_demo_proof" &&
            panel.screenshotName === "advisory-bank-demo-proof-live.png" &&
            panel.gatewayEndpoint ===
              "/api/v1/advisory/bank-demo-proof/supported-claim-register",
        ),
      ).toBe(true);
      const bankDemoProof = DEFAULT_CANONICAL_CONTRACT.advisoryProposalScenarios
        ?.bankDemoProof as
        | {
            scenarioId: string;
            expectedClaimPostures: Record<string, string>;
          }
        | undefined;
      expect(bankDemoProof?.scenarioId).toBe(
        "RFC28_BANK_DEMO_CLIENT_READY_PROOF_CANONICAL",
      );
      expect(
        bankDemoProof?.expectedClaimPostures.client_ready_publication_blocked,
      ).toBe("UNSUPPORTED");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
