import {
  generateKeyPairSync,
  sign,
  type KeyObject,
} from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  PrincipalGrantStoreUnavailable,
  issueDelegatedCredential,
  readBearerCredential,
  resolvePrincipal,
  verifyPrincipalCredential,
  type PrincipalGrantResolver,
} from "@/features/workbench/principal-credential";

const NOW = new Date("2026-09-07T12:00:00Z");
const ISSUER = "https://identity.lotus.test/realms/lotus";
const AUDIENCE = "lotus-workbench-bff";

function createSigningMaterial(kid = "issuer-key") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    kid,
    privateKey,
    jwks: {
      keys: [
        {
          ...publicKey.export({ format: "jwk" }),
          kid,
          alg: "EdDSA",
          use: "sig",
        },
      ],
    },
  };
}

function credential(
  privateKey: KeyObject,
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
) {
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: "EdDSA", kid: "issuer-key", typ: "JWT", ...header }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(
    JSON.stringify({
      iss: ISSUER,
      aud: AUDIENCE,
      sub: "user:advisor.sg.001",
      tenant: "tenant-sg",
      principal_kind: "user",
      exp: Math.floor(NOW.getTime() / 1000) + 300,
      nbf: Math.floor(NOW.getTime() / 1000) - 60,
      jti: "credential-001",
      ...claims,
    }),
  ).toString("base64url");
  const input = `${encodedHeader}.${encodedPayload}`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString("base64url")}`;
}

function inputs(
  jwks: Parameters<typeof verifyPrincipalCredential>[1]["jwks"],
) {
  return { expectedIssuer: ISSUER, expectedAudience: AUDIENCE, jwks, now: NOW };
}

function grants(
  capabilities = ["portfolio.read"],
  portfolioScope = ["PB_SG_GLOBAL_BAL_001"],
) {
  return { capabilities: new Set(capabilities), portfolioScope: new Set(portfolioScope) };
}

function grantResolver(overrides: Partial<PrincipalGrantResolver> = {}): PrincipalGrantResolver {
  return {
    tenantMembers: vi.fn().mockResolvedValue(true),
    grantsFor: vi.fn().mockResolvedValue(grants()),
    applicationGrantsFor: vi.fn().mockResolvedValue(grants()),
    ...overrides,
  };
}

describe("principal credential verification", () => {
  it("accepts only an exact bearer credential", () => {
    expect(readBearerCredential("Bearer signed.value.here")).toBe("signed.value.here");
    expect(readBearerCredential("Basic abc")).toBeNull();
    expect(readBearerCredential("Bearer one two")).toBeNull();
    expect(readBearerCredential(null)).toBeNull();
  });

  it("verifies a real Ed25519 signature before trusting its claims", () => {
    const material = createSigningMaterial();
    const token = credential(material.privateKey);
    expect(verifyPrincipalCredential(token, inputs(material.jwks))).toEqual(
      expect.objectContaining({
        subject: "user:advisor.sg.001",
        tenantId: "tenant-sg",
        principalKind: "user",
        credentialId: "credential-001",
      }),
    );

    const foreign = createSigningMaterial();
    const unsignedByIssuer = credential(foreign.privateKey);
    expect(
      verifyPrincipalCredential(unsignedByIssuer, inputs(material.jwks)),
    ).toEqual({
      status: "denied",
      denialClass: "present_but_unverified",
      unauthenticated: true,
    });
  });

  it.each([
    [null, "missing_credential"],
    ["not-a-jws", "malformed_credential"],
  ] as const)("refuses %s as %s", (token, denialClass) => {
    const material = createSigningMaterial();
    expect(verifyPrincipalCredential(token, inputs(material.jwks))).toEqual({
      status: "denied",
      denialClass,
      unauthenticated: true,
    });
  });

  it.each([
    [{ iss: "https://foreign.example" }, "wrong_issuer"],
    [{ aud: "lotus-gateway" }, "wrong_audience"],
    [{ exp: Math.floor(NOW.getTime() / 1000) - 1 }, "expired_credential"],
    [{ nbf: Math.floor(NOW.getTime() / 1000) + 1 }, "expired_credential"],
  ] as const)("refuses verified claims with %j as %s", (claims, denialClass) => {
    const material = createSigningMaterial();
    expect(
      verifyPrincipalCredential(
        credential(material.privateKey, claims),
        inputs(material.jwks),
      ),
    ).toEqual({ status: "denied", denialClass, unauthenticated: true });
  });

  it("refuses unknown keys and revoked identities", () => {
    const material = createSigningMaterial();
    const token = credential(material.privateKey);
    expect(verifyPrincipalCredential(token, inputs({ keys: [] }))).toEqual({
      status: "denied",
      denialClass: "unknown_key_id",
      unauthenticated: true,
    });
    expect(
      verifyPrincipalCredential(token, {
        ...inputs(material.jwks),
        revokedSubjects: new Set(["user:advisor.sg.001"]),
      }),
    ).toEqual({
      status: "denied",
      denialClass: "revoked_principal",
      unauthenticated: true,
    });
  });
});

describe("principal grant resolution", () => {
  it("fails closed when the grant authority is unavailable", async () => {
    const material = createSigningMaterial();
    await expect(
      resolvePrincipal(credential(material.privateKey), inputs(material.jwks)),
    ).resolves.toEqual({
      status: "denied",
      denialClass: "grant_store_unavailable",
      unauthenticated: false,
    });
  });

  it("resolves an admitted user without narrowing requested scope", async () => {
    const material = createSigningMaterial();
    await expect(
      resolvePrincipal(credential(material.privateKey), {
        ...inputs(material.jwks),
        grantResolver: grantResolver(),
        requiredCapabilities: ["portfolio.read"],
        requestedPortfolioIds: ["PB_SG_GLOBAL_BAL_001"],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        subject: "user:advisor.sg.001",
        capabilities: new Set(["portfolio.read"]),
        portfolioScope: new Set(["PB_SG_GLOBAL_BAL_001"]),
      }),
    );
  });

  it("intersects delegated user and application authority", async () => {
    const material = createSigningMaterial();
    const resolver = grantResolver({
      grantsFor: vi.fn().mockResolvedValue(
        grants(["portfolio.read", "idea.review"], ["P1", "P2"]),
      ),
      applicationGrantsFor: vi
        .fn()
        .mockResolvedValue(grants(["portfolio.read"], ["P1"])),
    });
    const token = credential(material.privateKey, {
      principal_kind: "delegated",
      act: "lotus-workbench",
    });
    await expect(
      resolvePrincipal(token, {
        ...inputs(material.jwks),
        grantResolver: resolver,
        requiredCapabilities: ["portfolio.read"],
        requestedPortfolioIds: ["P1"],
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        capabilities: new Set(["portfolio.read"]),
        portfolioScope: new Set(["P1"]),
      }),
    );
  });

  it("distinguishes membership, grant, delegated and scope refusals", async () => {
    const material = createSigningMaterial();
    const user = credential(material.privateKey);
    await expect(
      resolvePrincipal(user, {
        ...inputs(material.jwks),
        grantResolver: grantResolver({ tenantMembers: vi.fn().mockResolvedValue(false) }),
      }),
    ).resolves.toEqual(expect.objectContaining({ denialClass: "tenant_not_a_member" }));
    await expect(
      resolvePrincipal(user, {
        ...inputs(material.jwks),
        grantResolver: grantResolver(),
        requiredCapabilities: ["manage.write"],
      }),
    ).resolves.toEqual(expect.objectContaining({ denialClass: "capability_not_granted" }));
    await expect(
      resolvePrincipal(user, {
        ...inputs(material.jwks),
        grantResolver: grantResolver(),
        requestedPortfolioIds: ["OTHER"],
      }),
    ).resolves.toEqual(expect.objectContaining({ denialClass: "portfolio_outside_scope" }));

    const delegated = credential(material.privateKey, {
      principal_kind: "delegated",
      act: "lotus-workbench",
    });
    await expect(
      resolvePrincipal(delegated, {
        ...inputs(material.jwks),
        grantResolver: grantResolver({
          grantsFor: vi.fn().mockResolvedValue(grants([])),
          applicationGrantsFor: vi.fn().mockResolvedValue(grants(["manage.write"])),
        }),
        requiredCapabilities: ["manage.write"],
      }),
    ).resolves.toEqual(
      expect.objectContaining({ denialClass: "delegated_capability_not_held_by_user" }),
    );
  });

  it("maps a failed grant lookup to unavailable without exposing resource facts", async () => {
    const material = createSigningMaterial();
    await expect(
      resolvePrincipal(credential(material.privateKey), {
        ...inputs(material.jwks),
        grantResolver: grantResolver({
          grantsFor: vi.fn().mockRejectedValue(new PrincipalGrantStoreUnavailable()),
        }),
      }),
    ).resolves.toEqual({
      status: "denied",
      denialClass: "grant_store_unavailable",
      unauthenticated: false,
    });
  });
});

describe("delegated Gateway credentials", () => {
  it("binds a short-lived delegated credential to the admitted user and Workbench", async () => {
    const sessionMaterial = createSigningMaterial();
    const gatewayMaterial = createSigningMaterial("workbench-key");
    const resolved = await resolvePrincipal(
      credential(sessionMaterial.privateKey),
      {
        ...inputs(sessionMaterial.jwks),
        grantResolver: grantResolver(),
        requiredCapabilities: ["portfolio.read"],
      },
    );
    if ("status" in resolved) throw new Error("expected an admitted principal");

    const delegated = issueDelegatedCredential(resolved, {
      issuer: "https://workbench.lotus.test",
      audience: "lotus-gateway",
      actingApplication: "lotus-workbench",
      keyId: "workbench-key",
      privateKey: gatewayMaterial.privateKey.export({ format: "jwk" }),
      now: NOW,
      lifetimeSeconds: 45,
      credentialId: "delegated-001",
    });

    expect(
      verifyPrincipalCredential(delegated, {
        expectedIssuer: "https://workbench.lotus.test",
        expectedAudience: "lotus-gateway",
        jwks: gatewayMaterial.jwks,
        now: new Date(NOW.getTime() + 30_000),
      }),
    ).toEqual(
      expect.objectContaining({
        subject: "user:advisor.sg.001",
        tenantId: "tenant-sg",
        principalKind: "delegated",
        delegatedActor: "lotus-workbench",
        credentialId: "delegated-001",
      }),
    );
  });

  it("does not delegate a service or already-delegated principal", () => {
    const gatewayMaterial = createSigningMaterial("workbench-key");
    expect(() =>
      issueDelegatedCredential(
        {
          issuer: ISSUER,
          audience: [AUDIENCE],
          subject: "service:batch",
          tenantId: "tenant-sg",
          principalKind: "service",
          credentialId: "service-001",
          capabilities: new Set(),
          portfolioScope: new Set(),
        },
        {
          issuer: "https://workbench.lotus.test",
          audience: "lotus-gateway",
          actingApplication: "lotus-workbench",
          keyId: "workbench-key",
          privateKey: gatewayMaterial.privateKey.export({ format: "jwk" }),
        },
      ),
    ).toThrow("Only an admitted user session");
  });
});
