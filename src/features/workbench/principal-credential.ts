import {
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
  type JsonWebKey as NodeJsonWebKey,
} from "node:crypto";

const SUPPORTED_ALGORITHM = "EdDSA";

export type PrincipalDenialClass =
  | "missing_credential"
  | "malformed_credential"
  | "unknown_key_id"
  | "present_but_unverified"
  | "wrong_issuer"
  | "wrong_audience"
  | "expired_credential"
  | "revoked_principal"
  | "tenant_not_a_member"
  | "grant_store_unavailable"
  | "capability_not_granted"
  | "delegated_capability_not_held_by_user"
  | "portfolio_outside_scope";

export type PrincipalDenial = {
  status: "denied";
  denialClass: PrincipalDenialClass;
  unauthenticated: boolean;
};

export type VerifiedPrincipalClaims = {
  issuer: string;
  audience: readonly string[];
  subject: string;
  tenantId: string;
  principalKind: "user" | "service" | "delegated";
  delegatedActor?: string;
  credentialId: string;
};

export type ResolvedPrincipal = VerifiedPrincipalClaims & {
  capabilities: ReadonlySet<string>;
  portfolioScope: ReadonlySet<string>;
};

export type PrincipalGrantSet = {
  capabilities: ReadonlySet<string>;
  portfolioScope: ReadonlySet<string>;
};

export type PrincipalGrantResolver = {
  tenantMembers(subject: string, tenantId: string): Promise<boolean>;
  grantsFor(subject: string, tenantId: string): Promise<PrincipalGrantSet>;
  applicationGrantsFor(
    application: string,
    tenantId: string,
  ): Promise<PrincipalGrantSet>;
};

export class PrincipalGrantStoreUnavailable extends Error {}

export type PrincipalVerificationInputs = {
  expectedIssuer: string;
  expectedAudience: string;
  jwks: JsonWebKeySet;
  now?: Date;
  revokedCredentialIds?: ReadonlySet<string>;
  revokedSubjects?: ReadonlySet<string>;
  leewaySeconds?: number;
};

export type DelegatedCredentialInputs = {
  issuer: string;
  audience: string;
  actingApplication: string;
  keyId: string;
  privateKey: NodeJsonWebKey;
  now?: Date;
  lifetimeSeconds?: number;
  credentialId?: string;
};

type JsonWebKeySet = {
  keys: readonly (NodeJsonWebKey & { kid?: string; alg?: string; crv?: string })[];
};
type JsonObject = Record<string, unknown>;

function deny(
  denialClass: PrincipalDenialClass,
  unauthenticated: boolean,
): PrincipalDenial {
  return { status: "denied", denialClass, unauthenticated };
}

function decodeJsonObject(segment: string): JsonObject | null {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(segment, "base64url").toString("utf8"),
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  } catch {
    return null;
  }
}

function stringList(value: unknown): readonly string[] {
  if (typeof value === "string" && value) return [value];
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item)
    ? value
    : [];
}

export function readBearerCredential(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function verifyPrincipalCredential(
  credential: string | null,
  inputs: PrincipalVerificationInputs,
): PrincipalDenial | VerifiedPrincipalClaims {
  if (!credential) return deny("missing_credential", true);
  const parts = credential.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return deny("malformed_credential", true);
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeJsonObject(headerSegment);
  const claims = decodeJsonObject(payloadSegment);
  if (!header || !claims || !/^[A-Za-z0-9_-]+$/.test(signatureSegment)) {
    return deny("malformed_credential", true);
  }
  if (header.alg !== SUPPORTED_ALGORITHM || typeof header.kid !== "string" || !header.kid) {
    return deny("malformed_credential", true);
  }
  const key = inputs.jwks.keys.find(
    (candidate) =>
      candidate.kid === header.kid &&
      candidate.kty === "OKP" &&
      candidate.crv === "Ed25519" &&
      (candidate.alg === undefined || candidate.alg === SUPPORTED_ALGORITHM),
  );
  if (!key) return deny("unknown_key_id", true);
  try {
    const valid = verify(
      null,
      Buffer.from(`${headerSegment}.${payloadSegment}`, "ascii"),
      createPublicKey({ key, format: "jwk" }),
      Buffer.from(signatureSegment, "base64url"),
    );
    if (!valid) return deny("present_but_unverified", true);
  } catch {
    return deny("unknown_key_id", true);
  }

  if (claims.iss !== inputs.expectedIssuer) return deny("wrong_issuer", true);
  const audience = stringList(claims.aud);
  if (!audience.includes(inputs.expectedAudience)) return deny("wrong_audience", true);

  const now = Math.floor((inputs.now ?? new Date()).getTime() / 1000);
  const leeway = inputs.leewaySeconds ?? 0;
  if (!Number.isInteger(claims.exp) || now >= Number(claims.exp) + leeway) {
    return deny("expired_credential", true);
  }
  if (claims.nbf !== undefined && !Number.isInteger(claims.nbf)) {
    return deny("malformed_credential", true);
  }
  if (Number.isInteger(claims.nbf) && now < Number(claims.nbf) - leeway) {
    return deny("expired_credential", true);
  }

  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    typeof claims.tenant !== "string" ||
    !claims.tenant ||
    typeof claims.jti !== "string" ||
    !claims.jti ||
    !["user", "service", "delegated"].includes(String(claims.principal_kind)) ||
    (claims.principal_kind === "delegated" &&
      (typeof claims.act !== "string" || !claims.act))
  ) {
    return deny("malformed_credential", true);
  }
  if (
    inputs.revokedCredentialIds?.has(claims.jti) ||
    inputs.revokedSubjects?.has(claims.sub)
  ) {
    return deny("revoked_principal", true);
  }
  return {
    issuer: inputs.expectedIssuer,
    audience,
    subject: claims.sub,
    tenantId: claims.tenant,
    principalKind: claims.principal_kind as VerifiedPrincipalClaims["principalKind"],
    delegatedActor: claims.principal_kind === "delegated" ? String(claims.act) : undefined,
    credentialId: claims.jti,
  };
}

export async function resolvePrincipal(
  credential: string | null,
  inputs: PrincipalVerificationInputs & {
    grantResolver?: PrincipalGrantResolver;
    requiredCapabilities?: readonly string[];
    requestedPortfolioIds?: readonly string[];
  },
): Promise<PrincipalDenial | ResolvedPrincipal> {
  const verified = verifyPrincipalCredential(credential, inputs);
  if ("status" in verified) return verified;
  if (!inputs.grantResolver) return deny("grant_store_unavailable", false);

  let member: boolean;
  let userGrants: PrincipalGrantSet;
  let applicationGrants: PrincipalGrantSet | undefined;
  try {
    member = await inputs.grantResolver.tenantMembers(
      verified.subject,
      verified.tenantId,
    );
    if (!member) return deny("tenant_not_a_member", false);
    userGrants = await inputs.grantResolver.grantsFor(
      verified.subject,
      verified.tenantId,
    );
    if (verified.principalKind === "delegated") {
      applicationGrants = await inputs.grantResolver.applicationGrantsFor(
        verified.delegatedActor!,
        verified.tenantId,
      );
    }
  } catch (error) {
    if (error instanceof PrincipalGrantStoreUnavailable) {
      return deny("grant_store_unavailable", false);
    }
    throw error;
  }

  const capabilities = applicationGrants
    ? intersection(userGrants.capabilities, applicationGrants.capabilities)
    : userGrants.capabilities;
  const portfolioScope = applicationGrants
    ? intersection(userGrants.portfolioScope, applicationGrants.portfolioScope)
    : userGrants.portfolioScope;
  const required = new Set(inputs.requiredCapabilities ?? []);
  if (![...required].every((capability) => capabilities.has(capability))) {
    const applicationHasAll =
      applicationGrants &&
      [...required].every((capability) => applicationGrants!.capabilities.has(capability));
    return deny(
      verified.principalKind === "delegated" && applicationHasAll
        ? "delegated_capability_not_held_by_user"
        : "capability_not_granted",
      false,
    );
  }
  if (
    !(inputs.requestedPortfolioIds ?? []).every((portfolioId) =>
      portfolioScope.has(portfolioId),
    )
  ) {
    return deny("portfolio_outside_scope", false);
  }
  return { ...verified, capabilities, portfolioScope };
}

export function issueDelegatedCredential(
  principal: ResolvedPrincipal,
  inputs: DelegatedCredentialInputs,
): string {
  if (principal.principalKind !== "user") {
    throw new Error("Only an admitted user session can be delegated by the Workbench BFF");
  }
  const issuedAt = Math.floor((inputs.now ?? new Date()).getTime() / 1000);
  const header = encodeJson({ alg: SUPPORTED_ALGORITHM, kid: inputs.keyId, typ: "JWT" });
  const payload = encodeJson({
    iss: inputs.issuer,
    aud: inputs.audience,
    sub: principal.subject,
    tenant: principal.tenantId,
    principal_kind: "delegated",
    act: inputs.actingApplication,
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + (inputs.lifetimeSeconds ?? 60),
    jti: inputs.credentialId ?? randomUUID(),
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign(
    null,
    Buffer.from(signingInput, "ascii"),
    createPrivateKey({ key: inputs.privateKey, format: "jwk" }),
  );
  return `${signingInput}.${signature.toString("base64url")}`;
}

function encodeJson(value: JsonObject): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function intersection<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): ReadonlySet<T> {
  return new Set([...left].filter((value) => right.has(value)));
}
