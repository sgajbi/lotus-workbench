import {
  issueDelegatedCredential,
  readBearerCredential,
  resolvePrincipal,
  type DelegatedCredentialInputs,
  type PrincipalDenialClass,
  type PrincipalGrantResolver,
  type PrincipalVerificationInputs,
  type ResolvedPrincipal,
} from "./principal-credential";

export type BffRouteAuthorityRequirement = {
  requiredCapabilities: readonly string[];
  requestedPortfolioIds: readonly string[];
};

export type BffPrincipalAuthorityDependencies = {
  verification: PrincipalVerificationInputs;
  grantResolver?: PrincipalGrantResolver;
  delegation: DelegatedCredentialInputs;
};

export type BffPrincipalAuthorityResult =
  | {
      status: "admitted";
      principal: ResolvedPrincipal;
      gatewayCredential: string;
    }
  | {
      status: "denied";
      denialClass: PrincipalDenialClass | "session_principal_kind_not_admitted";
      httpStatus: 401 | 403 | 503;
    };

export async function authorizeBffPrincipal(
  authorizationHeader: string | null,
  requirement: BffRouteAuthorityRequirement,
  dependencies: BffPrincipalAuthorityDependencies,
): Promise<BffPrincipalAuthorityResult> {
  const principal = await resolvePrincipal(
    readBearerCredential(authorizationHeader),
    {
      ...dependencies.verification,
      grantResolver: dependencies.grantResolver,
      requiredCapabilities: requirement.requiredCapabilities,
      requestedPortfolioIds: requirement.requestedPortfolioIds,
    },
  );
  if ("status" in principal) {
    return {
      status: "denied",
      denialClass: principal.denialClass,
      httpStatus: principal.unauthenticated
        ? 401
        : principal.denialClass === "grant_store_unavailable"
          ? 503
          : 403,
    };
  }
  if (principal.principalKind !== "user") {
    return {
      status: "denied",
      denialClass: "session_principal_kind_not_admitted",
      httpStatus: 403,
    };
  }
  return {
    status: "admitted",
    principal,
    gatewayCredential: issueDelegatedCredential(
      principal,
      dependencies.delegation,
    ),
  };
}
