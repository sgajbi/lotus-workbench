import {
  authorizeBffPrincipal,
  type BffPrincipalAuthorityResult,
  type BffRouteAuthorityRequirement,
} from "./bff-principal-authority";
import type {
  DelegatedCredentialInputs,
  PrincipalVerificationInputs,
} from "./principal-credential";

const SESSION_AUDIENCE = "lotus-workbench-bff";
const GATEWAY_AUDIENCE = "lotus-gateway";
const WORKBENCH_APPLICATION = "lotus-workbench";

type ConfiguredPrincipalRuntime = {
  verification: PrincipalVerificationInputs;
  delegation: DelegatedCredentialInputs;
};

export async function authorizeConfiguredBffPrincipal(
  authorizationHeader: string | null,
  requirement: BffRouteAuthorityRequirement,
): Promise<BffPrincipalAuthorityResult> {
  const runtime = readConfiguredPrincipalRuntime();
  if (!runtime) {
    return {
      status: "denied",
      denialClass: "grant_store_unavailable",
      httpStatus: 503,
    };
  }
  // Platform #775 has not assigned or implemented the production tenant-membership
  // grant store. Omitting the resolver is deliberate: a signed token proves identity,
  // not membership or entitlement, and the governed resolver fails closed.
  return authorizeBffPrincipal(authorizationHeader, requirement, runtime);
}

function readConfiguredPrincipalRuntime(): ConfiguredPrincipalRuntime | null {
  const expectedIssuer = process.env.WORKBENCH_SESSION_CREDENTIAL_ISSUER?.trim();
  const delegatedIssuer = process.env.WORKBENCH_DELEGATED_CREDENTIAL_ISSUER?.trim();
  const keyId = process.env.WORKBENCH_DELEGATED_CREDENTIAL_KEY_ID?.trim();
  const jwks = readJsonObject(process.env.WORKBENCH_SESSION_CREDENTIAL_JWKS_JSON);
  const privateKey = readJsonObject(
    process.env.WORKBENCH_DELEGATED_CREDENTIAL_PRIVATE_JWK_JSON,
  );
  if (!expectedIssuer || !delegatedIssuer || !keyId || !jwks || !privateKey) {
    return null;
  }
  if (!Array.isArray(jwks.keys)) return null;
  return {
    verification: {
      expectedIssuer,
      expectedAudience: SESSION_AUDIENCE,
      jwks: jwks as PrincipalVerificationInputs["jwks"],
      revokedCredentialIds: readCsvSet(
        process.env.WORKBENCH_REVOKED_SESSION_CREDENTIAL_IDS,
      ),
      revokedSubjects: readCsvSet(process.env.WORKBENCH_REVOKED_PRINCIPAL_SUBJECTS),
    },
    delegation: {
      issuer: delegatedIssuer,
      audience: GATEWAY_AUDIENCE,
      actingApplication: WORKBENCH_APPLICATION,
      keyId,
      privateKey,
    },
  };
}

function readJsonObject(raw: string | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readCsvSet(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}
