import { createHash } from "node:crypto";

import type { ResolvedPrincipal } from "./principal-credential";

export function derivePrincipalAuthorityContext(
  principal: ResolvedPrincipal,
): string {
  const authority = JSON.stringify({
    issuer: principal.issuer,
    subject: principal.subject,
    tenantId: principal.tenantId,
    principalKind: principal.principalKind,
    credentialId: principal.credentialId,
    capabilities: [...principal.capabilities].sort(),
    portfolioScope: [...principal.portfolioScope].sort(),
  });
  return createHash("sha256").update(authority, "utf8").digest("hex");
}
