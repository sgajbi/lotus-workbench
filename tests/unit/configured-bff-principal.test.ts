import { beforeEach, describe, expect, it } from "vitest";

import { authorizeConfiguredBffPrincipal } from "@/features/workbench/configured-bff-principal";

const ENVIRONMENT_KEYS = [
  "WORKBENCH_SESSION_CREDENTIAL_ISSUER",
  "WORKBENCH_SESSION_CREDENTIAL_JWKS_JSON",
  "WORKBENCH_DELEGATED_CREDENTIAL_ISSUER",
  "WORKBENCH_DELEGATED_CREDENTIAL_KEY_ID",
  "WORKBENCH_DELEGATED_CREDENTIAL_PRIVATE_JWK_JSON",
  "WORKBENCH_REVOKED_SESSION_CREDENTIAL_IDS",
  "WORKBENCH_REVOKED_PRINCIPAL_SUBJECTS",
] as const;

describe("configured BFF principal authority", () => {
  beforeEach(() => {
    for (const key of ENVIRONMENT_KEYS) delete process.env[key];
  });

  it("fails closed when verified identity configuration is absent", async () => {
    await expect(
      authorizeConfiguredBffPrincipal(null, {
        requiredCapabilities: [],
        requestedPortfolioIds: [],
      }),
    ).resolves.toEqual({
      status: "denied",
      denialClass: "grant_store_unavailable",
      httpStatus: 503,
    });
  });

  it("does not treat configured keys as an implemented grant authority", async () => {
    process.env.WORKBENCH_SESSION_CREDENTIAL_ISSUER = "https://identity.example";
    process.env.WORKBENCH_SESSION_CREDENTIAL_JWKS_JSON = JSON.stringify({ keys: [] });
    process.env.WORKBENCH_DELEGATED_CREDENTIAL_ISSUER = "https://workbench.example";
    process.env.WORKBENCH_DELEGATED_CREDENTIAL_KEY_ID = "workbench-key";
    process.env.WORKBENCH_DELEGATED_CREDENTIAL_PRIVATE_JWK_JSON = JSON.stringify({
      kty: "OKP",
      crv: "Ed25519",
      d: "not-used-before-grant-resolution",
      x: "not-used-before-grant-resolution",
    });

    await expect(
      authorizeConfiguredBffPrincipal("Bearer anything", {
        requiredCapabilities: ["idea.review.record"],
        requestedPortfolioIds: [],
      }),
    ).resolves.toEqual({
      status: "denied",
      denialClass: "malformed_credential",
      httpStatus: 401,
    });
  });
});
