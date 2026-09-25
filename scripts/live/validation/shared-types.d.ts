export type ValidationPanelState =
  | "ready"
  | "loading"
  | "empty"
  | "partial"
  | "unavailable"
  | "error"
  | "supported_blank";

export interface ValidationConfig {
  args: Map<string, string>;
  portfolioId: string;
  benchmarkCode: string;
  workbenchBaseUrl: string;
  gatewayBaseUrl: string;
  ideaBaseUrl: string;
  outputDir: string;
  timeoutMs: number;
  canonicalAsOfDate: string;
  ideaCandidateId: string | null;
  ideaCandidateLifecycle: "ready_for_review" | "reviewed_by_advisor" | "approved";
  validationProfile: "full" | "client-demo";
  mainlineSourceProvenancePath: string | null;
}

export interface CanonicalContractMetadata {
  contractId: string;
  contractVersion: string;
  governedByRfc: string;
  portfolioId: string;
  benchmarkCode: string;
  canonicalAsOfDate: string;
  sourcePath?: string;
  advisoryProposalScenarios?: Record<string, unknown>;
}

export interface PanelRegistryEntry {
  panelId: string;
  owningService: string;
  gatewayEndpoint: string | null;
  requiredSupportState: ValidationPanelState;
  route: string;
  allowedStates: ValidationPanelState[];
  screenshotName: string | null;
  knownLimitations: string[];
  ownerFollowUpRfc: string | null;
}

export interface PanelRegistryMetadata {
  contractId: string;
  contractVersion: string;
  governedByRfc: string;
  canonicalDataContract: string;
  sourcePath: string;
  panels: PanelRegistryEntry[];
}

export interface ValidationSummary {
  generatedAt?: string;
  portfolioId?: string;
  benchmarkCode?: string;
  canonicalContract?: CanonicalContractMetadata;
  panelRegistry?: {
    contractId: string;
    contractVersion: string;
    governedByRfc: string;
    canonicalDataContract: string;
    sourcePath: string;
  };
  workbenchBaseUrl?: string;
  gatewayBaseUrl?: string;
  validationProfile?: "full" | "client-demo";
  excludedProofs?: Array<{
    proofScope: string;
    reasonCode: string;
    owningIssue: string;
    claimBoundary: string;
  }>;
  dns?: Array<Record<string, unknown>>;
  apiChecks?: Array<Record<string, unknown>>;
  workflowPackChecks?: Array<Record<string, unknown>>;
  uiChecks?: Array<Record<string, unknown>>;
  calculationChecks?: Array<Record<string, unknown>>;
  panelClassifications?: Array<Record<string, unknown>>;
  rfc3643FeatureCoverage?: Record<string, unknown> | null;
  supportabilityMatrix?: Record<string, unknown> | null;
  supportabilityChecks?: Array<Record<string, unknown>>;
  screenshots?: Array<Record<string, unknown>>;
  ideaCapacityProbe?: Record<string, unknown> | null;
}

export interface BrowserValidationPage {
  mouse?: {
    move(x: number, y: number): Promise<void>;
  };
  keyboard?: {
    press(key: string): Promise<void>;
  };
  screenshot(options: { path: string; fullPage: boolean }): Promise<void>;
  goto?(url: string, options?: Record<string, unknown>): Promise<void>;
  getByRole?(role: string, options?: Record<string, unknown>): unknown;
  getByLabel?(label: string, options?: Record<string, unknown>): unknown;
  getByText?(text: string | RegExp, options?: Record<string, unknown>): unknown;
}

export interface BrowserValidationHelpers {
  assertListHasItems(locator: unknown, description: string): Promise<void>;
  assertTableHasRows(
    locator: unknown,
    minimumRows: number,
    description: string,
  ): Promise<void>;
  screenshotRegisteredPanel(
    page: BrowserValidationPage,
    panelId: string,
    metadata?: { route?: string; state?: string },
  ): Promise<void>;
  resolveRegistryRoute(routeTemplate: string): string;
}
