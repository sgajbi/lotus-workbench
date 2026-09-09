import {
  WORKBENCH_AUTHORITY_CONTEXT_CLEARED,
  WORKBENCH_AUTHORITY_CONTEXT_HEADER,
  WORKBENCH_AUTHORITY_CONTEXT_PATTERN,
} from "./authority-context-contract";

type AuthorityChangeListener = () => void;
type AuthorityRequestContext = Readonly<{
  authority: string | null;
  sequence: number;
}>;

let activeAuthorityContext: string | null = null;
let nextRequestSequence = 0;
let latestAcceptedRequestSequence = 0;
const authorityChangeListeners = new Set<AuthorityChangeListener>();

export class StaleAuthorityResponseError extends Error {
  constructor() {
    super("The authenticated Workbench authority changed while this request was active");
    this.name = "StaleAuthorityResponseError";
  }
}

export function captureActiveAuthorityContext(): string | null {
  return typeof window === "undefined" ? null : activeAuthorityContext;
}

export function captureAuthorityRequestContext(): AuthorityRequestContext {
  return {
    authority: captureActiveAuthorityContext(),
    sequence: typeof window === "undefined" ? 0 : ++nextRequestSequence,
  };
}

export function reconcileResponseAuthorityContext(
  response: Response,
  requestContext: AuthorityRequestContext,
): void {
  if (typeof window === "undefined") return;
  if (!response.headers || typeof response.headers.get !== "function") return;
  const responseAuthorityHeader = response.headers.get(
    WORKBENCH_AUTHORITY_CONTEXT_HEADER,
  );
  const responseAuthority =
    responseAuthorityHeader === WORKBENCH_AUTHORITY_CONTEXT_CLEARED
      ? null
      : responseAuthorityHeader &&
          WORKBENCH_AUTHORITY_CONTEXT_PATTERN.test(responseAuthorityHeader)
        ? responseAuthorityHeader
        : undefined;
  if (responseAuthority === undefined) {
    return;
  }

  const authorityStateWasEstablished = latestAcceptedRequestSequence > 0;
  const responseConflictsWithActiveAuthority =
    authorityStateWasEstablished && responseAuthority !== activeAuthorityContext;
  const requestPredatesAcceptedAuthority =
    requestContext.sequence < latestAcceptedRequestSequence;
  const requestWasDispatchedForAnotherAuthority =
    requestContext.authority !== null &&
    requestContext.authority !== activeAuthorityContext;
  if (
    responseConflictsWithActiveAuthority &&
    (requestPredatesAcceptedAuthority || requestWasDispatchedForAnotherAuthority)
  ) {
    throw new StaleAuthorityResponseError();
  }
  if (responseAuthority === activeAuthorityContext) {
    latestAcceptedRequestSequence = Math.max(
      latestAcceptedRequestSequence,
      requestContext.sequence,
    );
    return;
  }

  const previousAuthority = activeAuthorityContext;
  activeAuthorityContext = responseAuthority;
  latestAcceptedRequestSequence = Math.max(
    latestAcceptedRequestSequence,
    requestContext.sequence,
  );
  if (previousAuthority !== null || authorityStateWasEstablished) {
    for (const listener of authorityChangeListeners) listener();
  }
}

export function subscribeToAuthorityChanges(
  listener: AuthorityChangeListener,
): () => void {
  authorityChangeListeners.add(listener);
  return () => authorityChangeListeners.delete(listener);
}

export function resetClientAuthorityContextForTests(): void {
  activeAuthorityContext = null;
  nextRequestSequence = 0;
  latestAcceptedRequestSequence = 0;
  authorityChangeListeners.clear();
}
