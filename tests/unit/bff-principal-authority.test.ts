import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { authorizeBffPrincipal } from "@/features/workbench/bff-principal-authority";
import {
  PrincipalGrantStoreUnavailable,
  verifyPrincipalCredential,
} from "@/features/workbench/principal-credential";

const NOW = new Date("2026-09-07T12:00:00Z");

function material(kid: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    kid,
    privateKey,
    publicJwks: {
      keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "EdDSA" }],
    },
  };
}

function sessionCredential(privateKey: KeyObject) {
  const header = Buffer.from(
    JSON.stringify({ alg: "EdDSA", kid: "session-key" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://identity.lotus.test",
      aud: "lotus-workbench-bff",
      sub: "user:advisor-001",
      tenant: "tenant-sg",
      principal_kind: "user",
      exp: Math.floor(NOW.getTime() / 1000) + 120,
      jti: "session-001",
    }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString("base64url")}`;
}

function dependencies(options: { unavailable?: boolean } = {}) {
  const session = material("session-key");
  const delegated = material("delegated-key");
  const grant = {
    capabilities: new Set(["idea.review.record"]),
    portfolioScope: new Set(["PB_SG_GLOBAL_BAL_001"]),
  };
  return {
    session,
    delegated,
    value: {
      verification: {
        expectedIssuer: "https://identity.lotus.test",
        expectedAudience: "lotus-workbench-bff",
        jwks: session.publicJwks,
        now: NOW,
      },
      grantResolver: {
        tenantMembers: vi.fn().mockResolvedValue(true),
        grantsFor: options.unavailable
          ? vi.fn().mockRejectedValue(new PrincipalGrantStoreUnavailable())
          : vi.fn().mockResolvedValue(grant),
        applicationGrantsFor: vi.fn().mockResolvedValue(grant),
      },
      delegation: {
        issuer: "https://workbench.lotus.test",
        audience: "lotus-gateway",
        actingApplication: "lotus-workbench",
        keyId: "delegated-key",
        privateKey: delegated.privateKey.export({ format: "jwk" }),
        now: NOW,
        credentialId: "delegated-001",
      },
    },
  };
}

describe("BFF principal authority", () => {
  it("admits an exact capability and portfolio then issues a verifiable delegated credential", async () => {
    const fixture = dependencies();
    const result = await authorizeBffPrincipal(
      `Bearer ${sessionCredential(fixture.session.privateKey)}`,
      {
        requiredCapabilities: ["idea.review.record"],
        requestedPortfolioIds: ["PB_SG_GLOBAL_BAL_001"],
      },
      fixture.value,
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "admitted",
        principal: expect.objectContaining({ subject: "user:advisor-001" }),
      }),
    );
    if (result.status !== "admitted") throw new Error("expected admission");
    expect(
      verifyPrincipalCredential(result.gatewayCredential, {
        expectedIssuer: "https://workbench.lotus.test",
        expectedAudience: "lotus-gateway",
        jwks: fixture.delegated.publicJwks,
        now: NOW,
      }),
    ).toEqual(
      expect.objectContaining({
        principalKind: "delegated",
        subject: "user:advisor-001",
        delegatedActor: "lotus-workbench",
      }),
    );
  });

  it.each([
    [null, 401, "missing_credential"],
    ["Bearer malformed", 401, "malformed_credential"],
  ] as const)("returns a bounded denial for %s", async (authorization, httpStatus, denialClass) => {
    const fixture = dependencies();
    await expect(
      authorizeBffPrincipal(
        authorization,
        { requiredCapabilities: [], requestedPortfolioIds: [] },
        fixture.value,
      ),
    ).resolves.toEqual({ status: "denied", httpStatus, denialClass });
    expect(fixture.value.grantResolver.grantsFor).not.toHaveBeenCalled();
  });

  it("returns authorization and availability denials without leaking requested scope", async () => {
    const denied = dependencies();
    await expect(
      authorizeBffPrincipal(
        `Bearer ${sessionCredential(denied.session.privateKey)}`,
        { requiredCapabilities: ["manage.write"], requestedPortfolioIds: [] },
        denied.value,
      ),
    ).resolves.toEqual({
      status: "denied",
      httpStatus: 403,
      denialClass: "capability_not_granted",
    });

    const unavailable = dependencies({ unavailable: true });
    await expect(
      authorizeBffPrincipal(
        `Bearer ${sessionCredential(unavailable.session.privateKey)}`,
        { requiredCapabilities: [], requestedPortfolioIds: ["PRIVATE"] },
        unavailable.value,
      ),
    ).resolves.toEqual({
      status: "denied",
      httpStatus: 503,
      denialClass: "grant_store_unavailable",
    });
  });
});
